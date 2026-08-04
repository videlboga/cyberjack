#!/usr/bin/env python3
"""Prepare LoRA dataset: dedup, remove text-heavy images, resize to 768px."""
import os, sys, hashlib
from pathlib import Path
from PIL import Image, ImageOps
import imagehash

SOURCE = "/home/cyberkitty/hdd_backup/Новая папка2"
DEST = "/home/cyberkitty/Projects/cyberjack/lora_dataset/images"
MAX_SIZE = 768
MIN_SIZE = 256  # skip tiny images
HASH_THRESHOLD = 5  # phash difference threshold for duplicates

os.makedirs(DEST, exist_ok=True)

# Step 1: Find all images
print("Step 1: Finding images...")
extensions = {'.jpg', '.jpeg', '.png', '.webp', '.bmp'}
all_images = []
for root, dirs, files in os.walk(SOURCE):
    for f in files:
        if os.path.splitext(f)[1].lower() in extensions:
            all_images.append(os.path.join(root, f))
print(f"  Found: {len(all_images)} images")

# Step 2: Dedup by perceptual hash
print("Step 2: Deduplicating...")
seen_hashes = []  # list of (hash, filepath)
duplicates = 0
unique_images = []

for i, filepath in enumerate(all_images):
    try:
        img = Image.open(filepath).convert('RGB')
        h = imagehash.phash(img, hash_size=16)
        
        is_dup = False
        for existing_hash, _ in seen_hashes:
            if h - existing_hash < HASH_THRESHOLD:
                is_dup = True
                break
        
        if is_dup:
            duplicates += 1
        else:
            seen_hashes.append((h, filepath))
            unique_images.append(filepath)
    except Exception as e:
        pass  # skip unreadable
    
    if (i + 1) % 200 == 0:
        print(f"  Processed {i+1}/{len(all_images)} | dupes: {duplicates} | unique: {len(unique_images)}")

print(f"  Duplicates removed: {duplicates}")
print(f"  Unique images: {len(unique_images)}")

# Step 3: Filter out text-heavy images
# Heuristic: convert to grayscale, threshold to B&W, check for large contiguous
# white regions with dark text (typical of manga/doujin text overlays)
print("Step 3: Filtering text-heavy images...")

def has_text_overlay(img):
    """Detect text overlays by checking for large white regions with dark pixels."""
    gray = img.convert('L')
    w, h = gray.size
    if w < 200 or h < 200:
        return False
    
    # Downscale for speed
    small = gray.resize((200, 200))
    pixels = list(small.getdata())
    
    # Count white pixels (potential text background)
    white = sum(1 for p in pixels if p > 240)
    white_ratio = white / len(pixels)
    
    # Count dark pixels on white-ish background (potential text)
    dark_on_light = 0
    for idx, p in enumerate(pixels):
        if p < 80:  # dark pixel
            # Check if surrounded by light pixels (text on white bg)
            x = idx % 200
            y = idx // 200
            if 0 < x < 199 and 0 < y < 199:
                neighbors = [pixels[y*200 + x-1], pixels[y*200 + x+1],
                           pixels[(y-1)*200 + x], pixels[(y+1)*200 + x]]
                light_neighbors = sum(1 for n in neighbors if n > 180)
                if light_neighbors >= 3:
                    dark_on_light += 1
    
    text_ratio = dark_on_light / len(pixels)
    
    # Heuristic: if >15% white area and >2% dark-on-light, likely has text
    return white_ratio > 0.15 and text_ratio > 0.02

text_filtered = 0
clean_images = []

for filepath in unique_images:
    try:
        img = Image.open(filepath).convert('RGB')
        if has_text_overlay(img):
            text_filtered += 1
        else:
            clean_images.append(filepath)
    except:
        pass

print(f"  Text-heavy removed: {text_filtered}")
print(f"  Clean images: {len(clean_images)}")

# Step 4: Resize and save
print("Step 4: Resizing and saving...")
saved = 0
skipped_small = 0

for filepath in clean_images:
    try:
        img = Image.open(filepath).convert('RGB')
        w, h = img.size
        
        # Skip too small
        if min(w, h) < MIN_SIZE:
            skipped_small += 1
            continue
        
        # Resize maintaining aspect ratio, max 768 on longest side
        if max(w, h) > MAX_SIZE:
            ratio = MAX_SIZE / max(w, h)
            new_w = int(w * ratio)
            new_h = int(h * ratio)
            img = img.resize((new_w, new_h), Image.LANCZOS)
        
        # Generate sequential filename
        out_name = f"img_{saved:05d}.jpg"
        out_path = os.path.join(DEST, out_name)
        img.save(out_path, "JPEG", quality=95)
        saved += 1
        
        if saved % 100 == 0:
            print(f"  Saved {saved}...")
    except Exception as e:
        pass

print(f"\n{'='*50}")
print(f"DATASET SUMMARY")
print(f"{'='*50}")
print(f"  Total found:      {len(all_images)}")
print(f"  Duplicates:       {duplicates}")
print(f"  Text-heavy:       {text_filtered}")
print(f"  Too small:        {skipped_small}")
print(f"  Final dataset:    {saved}")
print(f"  Output:           {DEST}")