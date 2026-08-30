import os, io, base64, json, time, urllib.request

DIR = "/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/public/character-images/rendered/kai"
URL = "http://127.0.0.1:11434/api/chat"

def to_b64(path):
    from PIL import Image
    img = Image.open(path).convert('RGB')
    img.thumbnail((700, 700))
    buf = io.BytesIO()
    img.save(buf, 'PNG')
    return base64.b64encode(buf.getvalue()).decode()

def ask(path):
    data = to_b64(path)
    payload = {
        "model": "kimi-k2.6:cloud",
        "messages": [{"role": "user", "content": "Оцени возраст персонажа одним словом: ребёнок/подросток/взрослый", "images": [data]}],
        "stream": False
    }
    req = urllib.request.Request(URL, data=json.dumps(payload).encode(), headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=120) as r:
        resp = json.loads(r.read().decode())
    return resp.get("message", {}).get("content", "")

files = sorted(f for f in os.listdir(DIR) if f.startswith(("sitting", "lying")) and f.endswith(".png"))
print(f"Total files: {len(files)}", flush=True)

problems = []
for f in files:
    path = os.path.join(DIR, f)
    try:
        ans = ask(path).strip().lower()
        print(f"{f} => {ans}", flush=True)
        if "ребёнок" in ans or "ребенок" in ans or "подросток" in ans:
            problems.append(f)
    except Exception as e:
        print(f"{f} => ERR {e}", flush=True)
    time.sleep(0.3)

print("=== PROBLEMS ===")
for p in problems:
    print(p)
