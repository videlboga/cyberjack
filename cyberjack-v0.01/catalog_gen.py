"""
CyberJack visual asset catalog generator.
Scans all character-images, extracts PNG metadata (prompt, seed, settings),
builds a JSON catalog for reproducibility and consistency.
"""
import os, json, hashlib
from PIL import Image

CYBERJACK = '/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01'
CHAR_IMG = os.path.join(CYBERJACK, 'public/character-images')
EXCLUDE_DIRS = {'interactions', 'interactions-expanded'}
CATALOG_PATH = os.path.join(CYBERJACK, 'visual-asset-catalog.json')

def extract_metadata(img_path):
    """Extract workflow metadata from PNG."""
    try:
        img = Image.open(img_path)
        if 'prompt' not in img.info:
            return None
        prompt = json.loads(img.info['prompt'])
        
        meta = {
            'checkpoint': '',
            'positive_prompt': '',
            'negative_prompt': '',
            'seed': None,
            'steps': None,
            'cfg': None,
            'sampler': '',
            'scheduler': '',
            'width': None,
            'height': None,
            'loras': [],
        }
        
        for k, v in prompt.items():
            ct = v.get('class_type', '')
            inputs = v.get('inputs', {})
            
            if ct == 'CheckpointLoaderSimple':
                meta['checkpoint'] = inputs.get('ckpt_name', '')
            elif ct == 'UNETLoader':
                meta['checkpoint'] = inputs.get('unet_name', '')
            elif ct == 'CLIPTextEncode':
                text = inputs.get('text', '')
                if k == '6' or (not meta['positive_prompt'] and 'score' in text.lower()):
                    meta['positive_prompt'] = text
                elif k == '7' or (not meta['negative_prompt'] and 'score_6' in text.lower()):
                    meta['negative_prompt'] = text
            elif ct == 'TextEncodeZImageOmni':
                text = inputs.get('prompt', '')
                if not meta['positive_prompt']:
                    meta['positive_prompt'] = text
            elif ct == 'KSampler':
                meta['seed'] = inputs.get('seed')
                meta['steps'] = inputs.get('steps')
                meta['cfg'] = inputs.get('cfg')
                meta['sampler'] = inputs.get('sampler_name', '')
                meta['scheduler'] = inputs.get('scheduler', '')
            elif ct == 'SamplerCustomAdvanced':
                # Advanced sampler — seed in RandomNoise
                pass
            elif ct == 'RandomNoise':
                meta['seed'] = inputs.get('noise_seed')
            elif ct == 'EmptyLatentImage' or ct == 'EmptySD3LatentImage':
                meta['width'] = inputs.get('width')
                meta['height'] = inputs.get('height')
            elif ct == 'EmptyLTXVLatentVideo':
                meta['width'] = inputs.get('width')
                meta['height'] = inputs.get('height')
                meta['frames'] = inputs.get('length')
            elif ct == 'LoraLoader':
                lora_name = inputs.get('lora_name', '')
                if lora_name:
                    meta['loras'].append({
                        'name': lora_name,
                        'strength_model': inputs.get('strength_model'),
                        'strength_clip': inputs.get('strength_clip'),
                    })
            elif ct == 'CLIPSetLastLayer':
                meta['clip_skip'] = inputs.get('stop_at_clip_layer')
        
        # File hash for integrity
        with open(img_path, 'rb') as f:
            meta['file_hash'] = hashlib.md5(f.read()).hexdigest()
        meta['file_size'] = os.path.getsize(img_path)
        
        return meta
    except Exception as e:
        return {'error': str(e)}


def scan_all():
    catalog = {
        'version': 1,
        'generated_at': '', 
        'stats': {},
        'items': []
    }
    
    from datetime import datetime
    catalog['generated_at'] = datetime.now().isoformat()
    
    if not os.path.isdir(CHAR_IMG):
        return catalog
    
    for entry in sorted(os.listdir(CHAR_IMG)):
        if entry in EXCLUDE_DIRS: continue
        full = os.path.join(CHAR_IMG, entry)
        if not os.path.isdir(full): continue
        
        for root, dirs, files in os.walk(full):
            dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
            for fname in sorted(files):
                if not fname.endswith('.png'): continue
                fpath = os.path.join(root, fname)
                rel = os.path.relpath(fpath, CHAR_IMG)
                
                meta = extract_metadata(fpath)
                if meta is None:
                    meta = {}
                
                item = {
                    'path': rel,
                    'category': entry,
                    'filename': fname,
                    **meta,
                }
                catalog['items'].append(item)
    
    # Stats
    from collections import Counter
    cats = Counter(i['category'] for i in catalog['items'])
    catalog['stats'] = {
        'total': len(catalog['items']),
        'by_category': dict(cats),
        'with_metadata': sum(1 for i in catalog['items'] if i.get('seed') is not None),
        'checkpoints': dict(Counter(i.get('checkpoint','') for i in catalog['items'] if i.get('checkpoint'))),
    }
    
    return catalog


if __name__ == '__main__':
    print('Scanning character-images...', flush=True)
    catalog = scan_all()
    
    with open(CATALOG_PATH, 'w') as f:
        json.dump(catalog, f, indent=2, ensure_ascii=False)
    
    print(f'Catalog: {catalog["stats"]["total"]} items', flush=True)
    print(f'  With metadata: {catalog["stats"]["with_metadata"]}', flush=True)
    print(f'  Categories: {catalog["stats"]["by_category"]}', flush=True)
    print(f'  Checkpoints: {catalog["stats"]["checkpoints"]}', flush=True)
    print(f'  Saved to: {CATALOG_PATH}', flush=True)