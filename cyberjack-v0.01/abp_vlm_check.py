#!/usr/bin/env python3
"""Run VLM (gemma4:cloud) on all actions-by-point images to check scene accuracy."""
import requests, base64, json, os, sys, time
from concurrent.futures import ThreadPoolExecutor, as_completed
from collections import defaultdict

OLLAMA = 'http://localhost:11434'
MODEL = 'gemma4:cloud'
BASE = '/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/public/character-images/actions-by-point'
RESULTS = '/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/abp-vlm-results.json'

# Action descriptions for VLM question
ACTION_DESC = {
    'feather_stroke': 'a feather being stroked on skin',
    'gentle_stroke': 'a hand gently stroking skin',
    'firm_grip': 'a hand firmly gripping skin',
    'deep_massage': 'hands massaging skin deeply',
    'ice_cube': 'an ice cube touching skin',
    'hot_wax': 'hot wax dripping on skin',
    'light_bite': 'teeth lightly biting skin',
    'hard_bite': 'teeth biting skin hard',
    'pinch': 'fingers pinching skin',
    'scratching': 'fingernails scratching skin',
    'slap': 'a hand slapping skin',
    'hard_slap': 'a hand slapping skin hard',
    'needle_prick': 'a needle pricking skin',
    'taser_shock': 'a taser device shocking skin',
    'licking': 'a tongue licking skin',
    'light_kiss': 'lips kissing skin',
    'hair_pull': 'hair being pulled',
    'wait': 'a person waiting calmly',
    'act_start_penetration': 'penetration beginning',
    'finger_insertion': 'a finger being inserted',
    'fingering': 'fingering',
    'vibrator_pulse': 'a vibrator pulsing against skin',
    'breath_tease': 'breath teasing skin',
}

def get_action_desc(fname):
    stem = fname.replace('.png', '')
    # Remove _sN suffix
    if '_s' in stem and stem.rsplit('_s', 1)[1].isdigit():
        stem = stem.rsplit('_s', 1)[0]
    return ACTION_DESC.get(stem, f'the action: {stem}')

def analyze_image(fpath, point, fname):
    """Send image to gemma4:cloud, get YES/NO + description."""
    desc = get_action_desc(fname)
    prompt = f'Does this image clearly show {desc} on the {point.replace("_", " ")} area of a body? Answer only YES or NO on the first line, then one sentence describing what you actually see.'

    with open(fpath, 'rb') as f:
        b64 = base64.b64encode(f.read()).decode()

    try:
        r = requests.post(f'{OLLAMA}/api/generate', json={
            'model': MODEL,
            'prompt': prompt,
            'images': [b64],
            'stream': False,
        }, timeout=90)
        resp = r.json().get('response', '').strip()
        first_line = resp.split('\n')[0].upper()
        is_yes = 'YES' in first_line
        return {
            'path': os.path.relpath(fpath, BASE),
            'point': point,
            'fname': fname,
            'match': is_yes,
            'response': resp[:300],
        }
    except Exception as e:
        return {
            'path': os.path.relpath(fpath, BASE),
            'point': point,
            'fname': fname,
            'match': None,
            'response': f'ERROR: {str(e)[:200]}',
        }

def main():
    # Collect all images
    images = []
    for point in sorted(os.listdir(BASE)):
        pd = os.path.join(BASE, point)
        if not os.path.isdir(pd): continue
        for fname in sorted(os.listdir(pd)):
            if not fname.endswith('.png'): continue
            images.append((os.path.join(pd, fname), point, fname))

    print(f'Total images: {len(images)}', flush=True)

    # Load existing results
    existing = {}
    if os.path.exists(RESULTS):
        with open(RESULTS) as f:
            existing = {r['path']: r for r in json.load(f)}
    
    # Filter out already analyzed
    todo = [(f, p, n) for f, p, n in images if os.path.relpath(f, BASE) not in existing]
    print(f'Already done: {len(existing)}, to do: {len(todo)}', flush=True)

    if not todo:
        print('Nothing to do.', flush=True)
        return

    results = list(existing.values())
    done = 0
    failed = 0

    # Process sequentially (ollama cloud may not handle parallel well)
    for fpath, point, fname in todo:
        rel = os.path.relpath(fpath, BASE)
        sys.stdout.write(f'  [{done+failed+1}/{len(todo)}] {rel}... ')
        sys.stdout.flush()
        result = analyze_image(fpath, point, fname)
        results.append(result)
        if result['match'] is not None:
            print(f'{"YES" if result["match"] else "NO"}', flush=True)
            done += 1
        else:
            print(f'FAIL: {result["response"][:80]}', flush=True)
            failed += 1
        
        # Save every 10 images
        if (done + failed) % 10 == 0:
            with open(RESULTS, 'w') as f:
                json.dump(results, f, indent=2, ensure_ascii=False)
        
        time.sleep(0.5)

    # Final save
    with open(RESULTS, 'w') as f:
        json.dump(results, f, indent=2, ensure_ascii=False)

    # Summary
    yes = sum(1 for r in results if r['match'] == True)
    no = sum(1 for r in results if r['match'] == False)
    err = sum(1 for r in results if r['match'] is None)
    print(f'\nResults: {yes} YES, {no} NO, {err} errors, {len(results)} total', flush=True)
    print(f'Saved to: {RESULTS}', flush=True)

if __name__ == '__main__':
    main()