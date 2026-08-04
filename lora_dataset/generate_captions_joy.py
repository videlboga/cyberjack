#!/usr/bin/env python3
"""Generate detailed captions using JoyCaption (LLaVA-based).
Also detects text/speech bubbles in images for filtering."""
import os, sys, time, json
import torch
from pathlib import Path
from PIL import Image

# Use ComfyUI venv
sys.path.insert(0, '/home/cyberkitty/comfyui/venv/lib/python3.14/site-packages')

from transformers import AutoProcessor
from transformers.models.llava.modeling_llava import LlavaForConditionalGeneration

MODEL_ID = "fancyfeast/llama-joycaption-beta-one-hf-llava"
IMAGES_DIR = "/home/cyberkitty/Projects/cyberjack/lora_dataset/images"
CAPTIONS_FILE = "/home/cyberkitty/Projects/cyberjack/lora_dataset/captions_joy.txt"
TEXT_FLAG_FILE = "/home/cyberkitty/Projects/cyberjack/lora_dataset/has_text.txt"

print("Loading JoyCaption model...")
processor = AutoProcessor.from_pretrained(MODEL_ID, trust_remote_code=True)

# Load with CPU offload for 8GB VRAM
model = LlavaForConditionalGeneration.from_pretrained(
    MODEL_ID,
    dtype=torch.bfloat16,
    device_map="auto",
    trust_remote_code=True,
    low_cpu_mem_usage=True,
)
model.eval()
print("JoyCaption loaded.")

# Prompt for detailed anime-style captions
CAPTION_PROMPT = "Write a detailed description of this image for use in training an AI image model. Describe: the character(s) appearance (hair, eyes, body type), clothing or lack thereof, pose, expression, setting/environment, any restraints or equipment, and artistic style. Write in English, be specific and concise (2-3 sentences max). Do NOT describe text, speech bubbles, or watermarks."

TEXT_DETECTION_PROMPT = "Does this image contain visible text, speech bubbles, dialogue, captions, or watermarks? Answer only 'YES' or 'NO'."

images = sorted([f for f in os.listdir(IMAGES_DIR) if f.endswith(('.jpg', '.png', '.jpeg'))])
print(f"Found {len(images)} images")

# Resume support
done = set()
if os.path.exists(CAPTIONS_FILE):
    with open(CAPTIONS_FILE, 'r') as f:
        for line in f:
            if '\t' in line:
                done.add(line.split('\t')[0])
print(f"Already done: {len(done)}")

text_images = set()
if os.path.exists(TEXT_FLAG_FILE):
    with open(TEXT_FLAG_FILE, 'r') as f:
        for line in f:
            text_images.add(line.strip())

t0 = time.time()
processed = 0

with open(CAPTIONS_FILE, 'a') as cap_f, open(TEXT_FLAG_FILE, 'a') as text_f:
    for i, filename in enumerate(images):
        if filename in done:
            continue
        
        filepath = os.path.join(IMAGES_DIR, filename)
        try:
            img = Image.open(filepath).convert('RGB')
            
            # Resize for speed
            max_dim = max(img.size)
            if max_dim > 768:
                ratio = 768 / max_dim
                img = img.resize((int(img.size[0] * ratio), int(img.size[1] * ratio)), Image.LANCZOS)
            
            # Step 1: Text detection — use chat template with image token
            messages = [
                {"role": "user", "content": "<|reserved_special_token_69|>\n" + TEXT_DETECTION_PROMPT}
            ]
            chat_text = processor.apply_chat_template(messages, add_generation_prompt=True, tokenize=False)
            inputs = processor(text=chat_text, images=img, return_tensors="pt", add_special_tokens=False).to(model.device, dtype=model.dtype)
            
            with torch.no_grad():
                output = model.generate(**inputs, max_new_tokens=5, do_sample=False)
            
            text_answer = processor.decode(output[0, inputs["input_ids"].shape[1]:], skip_special_tokens=True).strip().upper()
            has_text = "YES" in text_answer
            
            if has_text:
                text_f.write(filename + "\n")
                text_f.flush()
                text_images.add(filename)
            
            # Step 2: Detailed caption
            messages = [
                {"role": "user", "content": "<|reserved_special_token_69|>\n" + CAPTION_PROMPT}
            ]
            chat_text = processor.apply_chat_template(messages, add_generation_prompt=True, tokenize=False)
            inputs = processor(text=chat_text, images=img, return_tensors="pt", add_special_tokens=False).to(model.device, dtype=model.dtype)
            
            with torch.no_grad():
                output = model.generate(**inputs, max_new_tokens=100, do_sample=False, temperature=1.0)
            
            caption = processor.decode(output[0, inputs["input_ids"].shape[1]:], skip_special_tokens=True).strip()
            caption = caption.replace("\n", " ").strip()
            if len(caption) > 300:
                caption = caption[:297] + "..."
            
            entry = f"{filename}\t{caption}\n"
            cap_f.write(entry)
            cap_f.flush()
            
            processed += 1
            
        except Exception as e:
            print(f"  ERROR on {filename}: {e}")
            cap_f.write(f"{filename}\terror: {str(e)[:50]}\n")
            cap_f.flush()
        
        if (i + 1) % 20 == 0:
            elapsed = time.time() - t0
            rate = processed / elapsed if elapsed > 0 else 0
            remaining = (len(images) - len(done) - processed) / rate if rate > 0 else 0
            text_count = len(text_images)
            print(f"  {i+1}/{len(images)} | {rate:.1f}/s | ETA: {remaining:.0f}s | text: {text_count} | last: {caption[:60] if 'caption' in dir() else '?'}")

elapsed = time.time() - t0
print(f"\nDone! {processed} captions in {elapsed:.1f}s")
print(f"Images with text: {len(text_images)}")
print(f"Captions: {CAPTIONS_FILE}")
print(f"Text list: {TEXT_FLAG_FILE}")