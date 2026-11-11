"""T-поза (A-pose) генератор: costume + nude × 8 персонажей, neutral.

Стандартный пайплайн: тот же checkpoint/семплер/размер, что и base-avatar.
Сиды фиксированы per char+clothing. Skip-existing.
Выход: public/character-images/rendered/{slug}/tpose__{cloth}__none__neutral.png
"""
import requests, time, json, os, urllib.request, sys, hashlib

COMFYUI = "http://127.0.0.1:8188"
CYBERJACK = "/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01"
BASE_MATRIX = os.path.join(CYBERJACK, "src/infrastructure/data/visual/character-image-matrix.json")

CHECKPOINT = os.environ.get("CYBERJACK_CHECKPOINT", "rinFlanimeIllustrious_v40.safetensors")

SCORE = "score_9, score_8_up, score_7_up"
BG = "plain white background, pure white backdrop, studio lighting, soft lighting, full body in frame, head to toe"
BASE_NEG = (
    "score_6, score_5, score_4, low quality, worst quality, bad anatomy, extra limbs, deformed, "
    "watermark, text, realistic, 3d, background clutter, furniture, "
    "cut off, out of frame, cropped, close-up, portrait, upper body only, "
    "wings, angel wings, feathers, halo, background ornaments, magic circle, runes, mandala, "
    "smile, shocked, ahegao, crying, wide eyes, terrified"
)

SLUGS = {
    'S-AV-01': 'mira', 'NPC-LAB-01': 'iona', 'NPC-CAND-01': 'nika',
    'NPC-SUMI-01': 'sumi', 'NPC-ELI-01': 'eli', 'NPC-MAI-01': 'mai',
    'NPC-RIN-01': 'rin', 'NPC-KATE-01': 'kate',
}

# Личные костюмы (канон по рендерам/промт-описаниям)
COSTUME_TAGS = {
    'mira': ['oversized dark hoodie', 'black shorts', 'bare legs'],
    'iona': ['white lab blouse', 'long dark skirt'],
    'nika': ['black crop top', 'cargo pants'],
    'sumi': ['pastel pink hoodie', 'pleated skirt'],
    'eli': ['athletic tank top', 'jogger pants'],
    'mai': ['violet long dress'],
    'rin': ['green cardigan', 'long skirt'],
    'kate': ['oversized cream knitted sweater dress', 'white thighhighs'],
}
NUDE_TAGS = ['nude', 'completely nude']

POSE_TAGS = ['standing', 'full body', 'a-pose', 'arms slightly away from body', 'symmetrical pose', 'character reference sheet']

def build_prompt(char, cloth):
    appearance = char['appearanceTags']
    positive = [SCORE, '1girl, solo', ', '.join(appearance)]
    positive += POSE_TAGS
    if cloth == 'costume':
        positive += COSTUME_TAGS[char_slug(char['id'])]
    else:
        positive += NUDE_TAGS + ['detailed skin, detailed body']
    positive.append(BG)
    negative = list(BASE_NEG.split(', '))
    if cloth != 'nude':
        negative += ['nude', 'bare breasts', 'pussy']
    return ', '.join(positive), ', '.join(negative)

def char_slug(cid):
    return SLUGS[cid]

def build_workflow(positive, negative, seed):
    wf = {"10": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": CHECKPOINT}}}
    pm, pc = ["10", 0], ["10", 1]
    wf["6"] = {"class_type": "CLIPTextEncode", "inputs": {"text": positive, "clip": pc}}
    wf["7"] = {"class_type": "CLIPTextEncode", "inputs": {"text": negative, "clip": pc}}
    wf["5"] = {"class_type": "EmptyLatentImage", "inputs": {"width": 896, "height": 1152, "batch_size": 1}}
    wf["11"] = {"class_type": "CLIPSetLastLayer", "inputs": {"clip": pc, "stop_at_clip_layer": -2}}
    pc = ["11", 0]
    wf["3"] = {"class_type": "KSampler", "inputs": {
        "seed": seed, "steps": 28, "cfg": 5.0,
        "sampler_name": "euler_ancestral", "scheduler": "normal", "denoise": 1.0,
        "model": pm, "positive": ["6", 0], "negative": ["7", 0], "latent_image": ["5", 0]
    }}
    wf["8"] = {"class_type": "VAEDecode", "inputs": {"samples": ["3", 0], "vae": ["10", 2]}}
    wf["9"] = {"class_type": "SaveImage", "inputs": {"filename_prefix": "cj_tpose", "images": ["8", 0]}}
    return wf

def queue_prompt(wf):
    r = requests.post(f"{COMFYUI}/prompt", json={"prompt": wf}, timeout=30)
    if r.status_code != 200:
        raise RuntimeError(f"{r.status_code}: {r.text[:300]}")
    return r.json()["prompt_id"]

def poll_result(pid, timeout=600):
    for _ in range(timeout // 3):
        r = requests.get(f"{COMFYUI}/history/{pid}", timeout=10)
        entry = r.json().get(pid, {})
        st = entry.get("status", {})
        if st.get("status_str") == "success" and st.get("completed"):
            for nid, out in entry.get("outputs", {}).items():
                if isinstance(out, dict) and "images" in out and out["images"]:
                    return out["images"][0]
            raise RuntimeError("No images")
        if st.get("status_str") == "error":
            raise RuntimeError(f"Error: {json.dumps(st)[:500]}")
        time.sleep(3)
    raise TimeoutError(f"Timeout for {pid}")

def download(img_info, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    url = f"{COMFYUI}/view?filename={img_info['filename']}&subfolder={img_info.get('subfolder','')}&type={img_info.get('type','output')}"
    urllib.request.urlretrieve(url, path)

def main():
    with open(BASE_MATRIX) as f:
        matrix = json.load(f)
    characters = {c['id']: c for c in matrix['characters']}

    dry = '--dry-run' in sys.argv
    jobs = []
    for cid in SLUGS:
        char = characters.get(cid)
        if not char:
            print(f"!! {cid} отсутствует в матрице — пропуск", flush=True)
            continue
        slug = SLUGS[cid]
        for cloth in ('costume', 'nude'):
            rel = f"public/character-images/rendered/{slug}/tpose__{cloth}__none__neutral.png"
            jobs.append((cid, slug, cloth, rel))

    print(f"T-pose jobs: {len(jobs)}", flush=True)
    done = skipped = failed = 0
    for i, (cid, slug, cloth, rel) in enumerate(jobs):
        char = characters[cid]
        save_path = os.path.join(CYBERJACK, rel)
        seed = int(hashlib.md5(f"tpose_{cid}_{cloth}".encode()).hexdigest()[:8], 16) % (2**31)
        positive, negative = build_prompt(char, cloth)

        if not dry and os.path.exists(save_path) and os.path.getsize(save_path) > 1000:
            skipped += 1
            print(f"  [{i+1}/{len(jobs)}] {slug}/{cloth}: skip existing", flush=True)
            continue

        print(f"  [{i+1}/{len(jobs)}] {slug}/{cloth} seed={seed}... ", flush=True)
        if dry:
            print(f"POS: {positive}\nNEG: {negative}\n", flush=True)
            done += 1
            continue
        try:
            pid = queue_prompt(build_workflow(positive, negative, seed))
            img = poll_result(pid)
            download(img, save_path)
            done += 1
            print("ok", flush=True)
        except Exception as e:
            failed += 1
            print(f"FAIL: {e}", flush=True)

    print(f"\nDone: {done}, skipped: {skipped}, failed: {failed}", flush=True)

if __name__ == '__main__':
    main()