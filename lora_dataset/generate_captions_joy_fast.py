#!/usr/bin/env python3
"""JoyCaption — fast mode: single caption per image, no text detection.
Text detection done separately via simple heuristic."""
import os, sys, time, torch
from PIL import Image

sys.path.insert(0, '/home/cyberkitty/comfyui/venv/lib/python3.14/site-packages')
from transformers import AutoProcessor
from transformers.models.llava.modeling_llava import LlavaForConditionalGeneration

MODEL_ID = "fancyfeast/llama-joycaption-beta-one-hf-llava"
IMAGES_DIR = "/home/cyberkitty/Projects/cyberjack/lora_dataset/images"
CAPTIONS_FILE = "/home/cyberkitty/Projects/cyberjack/lora_dataset/captions_joy.txt"

print("Loading JoyCaption...")
processor = AutoProcessor.from_pretrained(MODEL_ID, trust_remote_code=True)
model = LlavaForConditionalGeneration.from_pretrained(
    MODEL_ID, dtype=torch.bfloat16, device_map="auto",
    trust_remote_code=True, low_cpu_mem_usage=True,
)
model.eval()
print("Loaded.")

CAPTION_PROMPT = "Write a short, concise description (1-2 sentences) of this image for AI training. Describe: characters, clothing/nudity, pose, restraints, setting, art style. English only."

images = sorted([f for f in os.listdir(IMAGES_DIR) if f.endswith(('.jpg', '.png', '.jpeg'))])

done = set()
if os.path.exists(CAPTIONS_FILE):
    with open(CAPTIONS_FILE, 'r') as f:
        for line in f:
            if '\t' in line:
                done.add(line.split('\t')[0])
print(f"Total: {len(images)}, done: {len(done)}, remaining: {len(images) - len(done)}")

t0 = time.time()
processed = 0

with open(CAPTIONS_FILE, 'a') as cap_f:
    for i, filename in enumerate(images):
        if filename in done:
            continue
        
        filepath = os.path.join(IMAGES_DIR, filename)
        try:
            img = Image.open(filepath).convert('RGB')
            max_dim = max(img.size)
            if max_dim > 512:
                ratio = 512 / max_dim
                img = img.resize((int(img.size[0] * ratio), int(img.size[1] * ratio)), Image.LANCZOS)
            
            messages = [{"role": "user", "content": "<|reserved_special_token_69|>\n" + CAPTION_PROMPT}]
            chat_text = processor.apply_chat_template(messages, add_generation_prompt=True, tokenize=False)
            inputs = processor(text=chat_text, images=img, return_tensors="pt", add_special_tokens=False).to(model.device, dtype=model.dtype)
            
            with torch.no_grad():
                output = model.generate(**inputs, max_new_tokens=60, do_sample=False)
            
            caption = processor.decode(output[0, inputs["input_ids"].shape[1]:], skip_special_tokens=True).strip().replace("\n", " ")
            if len(caption) > 250:
                caption = caption[:247] + "..."
            
            cap_f.write(f"{filename}\t{caption}\n")
            cap_f.flush()
            processed += 1
            
        except Exception as e:
            cap_f.write(f"{filename}\terror: {str(e)[:50]}\n")
            cap_f.flush()
        
        if (i + 1) % 10 == 0:
            elapsed = time.time() - t0
            rate = processed / elapsed if elapsed > 0 else 0
            remaining = (len(images) - len(done) - processed) / rate if rate > 0 else 0
            print(f"  {i+1}/{len(images)} | {rate:.1f}/s | ETA: {remaining/60:.0f}min | {caption[:50] if 'caption' in dir() else '?'}")

elapsed = time.time() - t0
print(f"\nDone! {processed} in {elapsed:.0f}s ({elapsed/60:.1f}min)")