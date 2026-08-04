#!/usr/bin/env python3
"""JoyCaption for LoRA dataset — full captions (no truncation).
Generates detailed descriptions for 198 images."""
import os, sys, time, torch
from PIL import Image

sys.path.insert(0, '/usr/local/lib/python3.11/dist-packages')
from transformers import AutoProcessor
from transformers.models.llava.modeling_llava import LlavaForConditionalGeneration

MODEL_ID = "fancyfeast/llama-joycaption-beta-one-hf-llava"
IMAGES_DIR = "/workspace/images"
CAPTIONS_FILE = "/workspace/captions.txt"

print("Loading JoyCaption...")
processor = AutoProcessor.from_pretrained(MODEL_ID, trust_remote_code=True)
model = LlavaForConditionalGeneration.from_pretrained(
    MODEL_ID, dtype=torch.bfloat16, device_map="auto",
    trust_remote_code=True, low_cpu_mem_usage=True,
)
model.eval()
print("Loaded.")

CAPTION_PROMPT = "Write a detailed description of this image for AI training. Describe: characters (appearance, hair, eyes, body), clothing or nudity, pose, expression, restraints or equipment, setting, and art style. 2-3 sentences. English only."

images = sorted([f for f in os.listdir(IMAGES_DIR) if f.endswith(('.jpg', '.png', '.jpeg'))])
print(f"Total: {len(images)} images")

done = set()
if os.path.exists(CAPTIONS_FILE):
    with open(CAPTIONS_FILE, 'r') as f:
        for line in f:
            if '\t' in line:
                done.add(line.split('\t')[0])
print(f"Already done: {len(done)}, remaining: {len(images) - len(done)}")

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
                output = model.generate(**inputs, max_new_tokens=200, do_sample=False)
            
            caption = processor.decode(output[0, inputs["input_ids"].shape[1]:], skip_special_tokens=True).strip().replace("\n", " ")
            # NO truncation — full caption
            
            cap_f.write(f"{filename}\t{caption}\n")
            cap_f.flush()
            processed += 1
            
        except Exception as e:
            cap_f.write(f"{filename}\terror: {str(e)[:80]}\n")
            cap_f.flush()
        
        if (i + 1) % 10 == 0:
            elapsed = time.time() - t0
            rate = processed / elapsed if elapsed > 0 else 0
            remaining = (len(images) - len(done) - processed) / rate if rate > 0 else 0
            print(f"  {i+1}/{len(images)} | {rate:.1f}/s | ETA: {remaining:.0f}s | {caption[:60] if 'caption' in dir() else '?'}")

elapsed = time.time() - t0
print(f"\nDone! {processed} captions in {elapsed:.0f}s ({elapsed/60:.1f}min)")
print(f"Saved to: {CAPTIONS_FILE}")