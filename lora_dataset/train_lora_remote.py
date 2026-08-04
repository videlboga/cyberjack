#!/usr/bin/env python3
"""LoRA training script for Z-Image (azureZit) on RunPod RTX 3090.
Uses diffusers + peft for DiT LoRA training."""
import os, sys, json, time
import torch
from torch.utils.data import Dataset, DataLoader
from PIL import Image

# Will be filled after models are downloaded
IMAGES_DIR = "/workspace/images"
CAPTIONS_FILE = "/workspace/captions_joy.txt"
OUTPUT_DIR = "/workspace/lora_output"
MODEL_DIR = "/workspace/models/azureZit"

os.makedirs(OUTPUT_DIR, exist_ok=True)

# --- Dataset ---
class ImageCaptionDataset(Dataset):
    def __init__(self, images_dir, captions_file, processor, size=512):
        self.images_dir = images_dir
        self.processor = processor
        self.size = size
        self.samples = []
        
        # Load captions
        captions = {}
        if os.path.exists(captions_file):
            with open(captions_file) as f:
                for line in f:
                    if '\t' in line:
                        name, cap = line.strip().split('\t', 1)
                        captions[name] = cap
        
        # Match with images
        for f in sorted(os.listdir(images_dir)):
            if f.endswith(('.jpg', '.png', '.jpeg')):
                cap = captions.get(f, "anime style illustration")
                # Add trigger word
                cap = f"ikelag_style, {cap}"
                self.samples.append((os.path.join(images_dir, f), cap))
        
        print(f"Dataset: {len(self.samples)} images")
    
    def __len__(self):
        return len(self.samples)
    
    def __getitem__(self, idx):
        img_path, caption = self.samples[idx]
        img = Image.open(img_path).convert('RGB')
        
        # Resize maintaining aspect ratio
        w, h = img.size
        if max(w, h) > self.size:
            ratio = self.size / max(w, h)
            img = img.resize((int(w * ratio), int(h * ratio)), Image.LANCZOS)
        
        # Center crop to square
        w, h = img.size
        left = (w - self.size) // 2
        top = (h - self.size) // 2
        img = img.crop((left, top, left + self.size, top + self.size))
        
        return img, caption

# --- Training ---
def main():
    from transformers import AutoProcessor
    from transformers.models.llava.modeling_llava import LlavaForConditionalGeneration
    from peft import LoraConfig, get_peft_model
    
    print("Loading model...")
    processor = AutoProcessor.from_pretrained("fancyfeast/llama-joycaption-beta-one-hf-llava")
    model = LlavaForConditionalGeneration.from_pretrained(
        "fancyfeast/llama-joycaption-beta-one-hf-llava",
        torch_dtype=torch.bfloat16,
        device_map="cuda",
    )
    
    # Configure LoRA
    lora_config = LoraConfig(
        r=32,
        lora_alpha=16,
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj"],
        lora_dropout=0.05,
        bias="none",
        task_type="CAUSAL_LM",
    )
    
    model = get_peft_model(model, lora_config)
    model.print_trainable_parameters()
    
    # Dataset
    dataset = ImageCaptionDataset(IMAGES_DIR, CAPTIONS_FILE, processor)
    
    # ... training loop ...
    # This is a placeholder — actual training requires
    # proper diffusers DiT training pipeline
    
    print("NOTE: This script needs to be adapted for Z-Image DiT architecture.")
    print("Z-Image uses a DiT (Diffusion Transformer) not a standard UNet.")
    print("Use ai-toolkit or kohya_ss for proper DiT LoRA training.")

if __name__ == "__main__":
    main()