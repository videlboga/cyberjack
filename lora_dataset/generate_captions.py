#!/usr/bin/env python3
"""Generate captions for LoRA dataset using BLIP."""
import os, sys, time
from pathlib import Path

# Use ComfyUI venv for transformers + torch
sys.path.insert(0, '/home/cyberkitty/comfyui/venv/lib/python3.14/site-packages')

import torch
from transformers import BlipProcessor, BlipForConditionalGeneration
from PIL import Image

IMAGES_DIR = "/home/cyberkitty/Projects/cyberjack/lora_dataset/images"
CAPTIONS_FILE = "/home/cyberkitty/Projects/cyberjack/lora_dataset/captions.txt"

print("Loading BLIP model...")
processor = BlipProcessor.from_pretrained("Salesforce/blip-image-captioning-base")
model = BlipForConditionalGeneration.from_pretrained(
    "Salesforce/blip-image-captioning-base",
    torch_dtype=torch.float16
).to("cuda")
model.eval()
print("BLIP loaded.")

# Check if BLIP is in HF cache
images = sorted([f for f in os.listdir(IMAGES_DIR) if f.endswith(('.jpg', '.png', '.jpeg'))])
print(f"Found {len(images)} images to caption")

# Check for existing captions (resume)
done = set()
if os.path.exists(CAPTIONS_FILE):
    with open(CAPTIONS_FILE, 'r') as f:
        for line in f:
            if '\t' in line:
                done.add(line.split('\t')[0])
print(f"Already captioned: {len(done)}")

results = []
t0 = time.time()

with open(CAPTIONS_FILE, 'a') as out_f:
    for i, filename in enumerate(images):
        if filename in done:
            continue
        
        filepath = os.path.join(IMAGES_DIR, filename)
        try:
            img = Image.open(filepath).convert('RGB')
            
            # Generate caption
            inputs = processor(img, return_tensors="pt").to("cuda", torch.float16)
            with torch.no_grad():
                output = model.generate(**inputs, max_new_tokens=50, num_beams=2, min_length=5)
            
            caption = processor.decode(output[0], skip_special_tokens=True).strip()
            
            # Add trigger word prefix for LoRA training
            entry = f"{filename}\t{caption}\n"
            out_f.write(entry)
            out_f.flush()
            results.append((filename, caption))
            
        except Exception as e:
            print(f"  ERROR on {filename}: {e}")
            out_f.write(f"{filename}\terror\n")
            out_f.flush()
        
        if (i + 1) % 50 == 0:
            elapsed = time.time() - t0
            rate = (i + 1 - len(done)) / elapsed
            remaining = (len(images) - i - 1) / rate if rate > 0 else 0
            print(f"  {i+1}/{len(images)} | {rate:.1f}/s | ETA: {remaining:.0f}s | last: {caption[:60]}")

elapsed = time.time() - t0
print(f"\nDone! {len(results)} captions in {elapsed:.1f}s")
print(f"Saved to: {CAPTIONS_FILE}")