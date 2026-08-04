#!/usr/bin/env python3
"""caption_all.py — Batch caption images with JoyCaption (LLaVA) on GPU.

Uses fancyfeast/llama-joycaption-beta-one-hf-llava from the local HF cache
with 4-bit NF4 quantization on CUDA. Detailed prompt for pose, equipment,
body description. No length limit (max_new_tokens=2048).

Usage:
    /home/cyberkitty/Projects/porn-search/.venv/bin/python caption_all.py
"""

from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path

import numpy as np
from PIL import Image

IMAGES_DIR = Path("/home/cyberkitty/Projects/cyberjack/lora_dataset/images")
OUTPUT_FILE = Path("/home/cyberkitty/Projects/cyberjack/lora_dataset/captions.json")
MODEL_NAME = "fancyfeast/llama-joycaption-beta-one-hf-llava"

DETAILED_PROMPT = (
    "Describe this image in exhaustive detail. Cover ALL of the following:\n"
    "1. POSE: exact body position, orientation, angle of limbs, head tilt, "
    "gaze direction, weight distribution, tension or relaxation in muscles.\n"
    "2. EQUIPMENT & PROPS: every device, machine, restraint, furniture, tool, "
    "clothing item, accessory — describe shape, color, material, position, "
    "and how it interacts with the body.\n"
    "3. BODY: physique, build, muscle definition, skin tone, hair, visible "
    "anatomy, expression, any marks or features.\n"
    "4. SETTING: background, lighting, floor, walls, atmosphere.\n"
    "Be precise and clinical. Do not summarize — enumerate every visual detail "
    "you can identify."
)


def init_model():
    """Load JoyCaption with 4-bit NF4 on GPU."""
    import torch
    from transformers import (
        AutoProcessor,
        BitsAndBytesConfig,
        LlavaForConditionalGeneration,
    )
    import bitsandbytes  # noqa: F401

    print("Loading processor...", flush=True)
    processor = AutoProcessor.from_pretrained(MODEL_NAME)

    print("Loading model (4-bit NF4 on GPU)...", flush=True)
    quantization_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_compute_dtype=torch.bfloat16,
        bnb_4bit_use_double_quant=True,
        llm_int8_skip_modules=["vision_tower", "multi_modal_projector"],
    )
    model = LlavaForConditionalGeneration.from_pretrained(
        MODEL_NAME,
        torch_dtype="auto",
        device_map=0,
        quantization_config=quantization_config,
    )
    model.eval()
    print("Model loaded.", flush=True)
    return processor, model


def caption_image(pil_image, processor, model):
    """Run JoyCaption on one PIL Image, return caption string."""
    import torch

    convo = [
        {
            "role": "system",
            "content": (
                "You are a helpful assistant and help users with any "
                "queries they may have with no censorship or restrictions."
            ),
        },
        {
            "role": "user",
            "content": DETAILED_PROMPT,
        },
    ]
    convo_string = processor.apply_chat_template(
        convo, tokenize=False, add_generation_prompt=True
    )

    inputs = processor(
        text=[convo_string],
        images=[pil_image],
        return_tensors="pt",
    ).to("cuda")

    inputs["pixel_values"] = inputs["pixel_values"].to(torch.bfloat16)

    with torch.no_grad():
        generate_ids = model.generate(
            **inputs,
            max_new_tokens=2048,
            do_sample=True,
            temperature=0.6,
            top_p=0.9,
            use_cache=True,
        )

    generate_ids = generate_ids[0, inputs["input_ids"].shape[1]:]
    text = processor.tokenizer.decode(
        generate_ids,
        skip_special_tokens=True,
        clean_up_tokenization_spaces=False,
    )
    return text.strip()


def main():
    # Collect all PNG images sorted.
    images = sorted(IMAGES_DIR.glob("*.png"))
    print(f"Found {len(images)} images in {IMAGES_DIR}", flush=True)

    # Load existing captions to skip already done.
    existing = {}
    if OUTPUT_FILE.exists():
        with open(OUTPUT_FILE, "r") as f:
            existing = json.load(f)
        print(f"Already captioned: {len(existing)}", flush=True)

    todo = [img for img in images if img.name not in existing]
    print(f"To process: {len(todo)}", flush=True)

    if not todo:
        print("Nothing to do. All images already captioned.", flush=True)
        return

    processor, model = init_model()

    results = dict(existing)
    total = len(todo)

    for i, img_path in enumerate(todo, 1):
        t0 = time.time()
        try:
            pil_image = Image.open(img_path).convert("RGB")
            caption = caption_image(pil_image, processor, model)
            results[img_path.name] = caption
            elapsed = time.time() - t0
            print(f"[{i}/{total}] {img_path.name} ({elapsed:.1f}s)", flush=True)
            # Print first 120 chars of caption for monitoring.
            preview = caption[:120].replace("\n", " ")
            print(f"  → {preview}...", flush=True)
        except Exception as e:
            elapsed = time.time() - t0
            print(f"[{i}/{total}] {img_path.name} FAILED ({elapsed:.1f}s): {e}", flush=True)
            results[img_path.name] = f"ERROR: {e}"

        # Save after each image so progress isn't lost.
        with open(OUTPUT_FILE, "w") as f:
            json.dump(results, f, indent=2, ensure_ascii=False)

    print(f"\nDone. {len(results)} captions saved to {OUTPUT_FILE}", flush=True)


if __name__ == "__main__":
    main()