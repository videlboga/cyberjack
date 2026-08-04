#!/bin/bash
# RunPod setup — install deps, verify, DO NOT start training.
# Training is started separately via Jupyter notebook.
set -e

echo "=== Step 1: Force torch 2.6.0+cu124 (diffusers 0.38 requires it) ==="
pip3 install --force-reinstall torch==2.6.0 torchvision==0.21.0 --index-url https://download.pytorch.org/whl/cu124 2>&1 | tail -5

echo "=== Step 2: Install deps ==="
pip3 install diffusers==0.38.0 peft accelerate transformers Pillow huggingface_hub 2>&1 | tail -5

echo "=== Step 3: Verify imports ==="
python3 -c "
import torch; print('torch', torch.__version__, 'cuda', torch.cuda.is_available())
from diffusers import ZImageTransformer2DModel; print('ZImageTransformer OK')
from diffusers import ZImagePipeline; print('ZImagePipeline OK')
from diffusers import AutoencoderKL; print('AutoencoderKL OK')
from diffusers import FlowMatchEulerDiscreteScheduler; print('FlowMatchEuler OK')
import peft; print('peft', peft.__version__)
import transformers; print('transformers', transformers.__version__)
"

echo "=== Step 4: Check files on volume ==="
ls -lh /workspace/azureZit.safetensors 2>/dev/null && echo "azureZit OK" || echo "azureZit MISSING"
ls /workspace/images/ 2>/dev/null | wc -l | xargs echo "images:"
ls /workspace/captions.txt 2>/dev/null && echo "captions OK" || echo "captions MISSING"
ls /workspace/train_lora.py 2>/dev/null && echo "train_lora OK" || echo "train_lora MISSING"

echo "=== Step 5: Disk space ==="
df -h /workspace /dev/shm 2>&1
du -sh /workspace/* 2>/dev/null | sort -rh

echo ""
echo "=== SETUP COMPLETE ==="
echo "To start training, open Jupyter and run train_lora.py"
echo "Or: python3 /workspace/train_lora.py"