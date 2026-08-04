#!/bin/bash
# RunPod setup script — prepares everything for LoRA training
# Run: bash setup_pod.sh
set -e

echo "=== Installing packages ==="
pip3 install -q diffusers peft accelerate transformers torch torchvision Pillow huggingface_hub 2>&1 | tail -5

echo "=== Checking files ==="
ls -lh /workspace/azureZit.safetensors 2>/dev/null || echo "WARNING: azureZit not found"
ls -lh /workspace/zimage_vae.safetensors 2>/dev/null || echo "WARNING: VAE not found"
ls /workspace/images/ 2>/dev/null | wc -l || echo "WARNING: images not found"
ls -lh /root/zimage_te/text_encoder/ 2>/dev/null | head -5 || echo "WARNING: text encoder not found"

echo "=== Setup complete ==="
echo "Next steps:"
echo "  1. Generate captions: python3 /workspace/generate_captions_full.py"
echo "  2. Train LoRA: python3 /workspace/train_lora.py"