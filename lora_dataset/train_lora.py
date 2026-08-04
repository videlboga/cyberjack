#!/usr/bin/env python3
"""Z-Image LoRA training — azureZit fine-tune, DiT + peft LoRA.

Models:
  - DiT transformer: /workspace/azureZit.safetensors (12GB, on volume)
  - VAE: HF Tongyi-MAI/Z-Image-Turbo subfolder=vae (168MB, downloaded to /dev/shm)
  - Text encoder: HF Tongyi-MAI/Z-Image-Turbo subfolder=text_encoder (8GB, to /dev/shm)

VRAM (RTX 3090 24GB):
  - DiT bf16: ~12GB
  - TE on CPU, chunked GPU forward: 0GB persistent
  - VAE bf16: 0.17GB
  - LoRA + optimizer: ~1.5GB
  - Activations: ~2-4GB
  - Total: ~16-18GB
"""
import os, sys, json, time, gc

os.environ.setdefault("HF_HOME", "/dev/shm/hf_cache")
os.environ.setdefault("TRANSFORMERS_CACHE", "/dev/shm/hf_cache")
os.environ.setdefault("HF_HUB_CACHE", "/dev/shm/hf_cache")

import torch
import torch.nn.functional as F
from torch.utils.data import Dataset, DataLoader
from PIL import Image
import numpy as np

# === Config ===
IMAGES_DIR = "/workspace/images"
CAPTIONS_FILE = "/workspace/captions.txt"  # 198 lines, tab-separated: filename\tcaption
CKPT_PATH = "/workspace/azureZit.safetensors"  # DiT only, 12GB
HF_REPO = "Tongyi-MAI/Z-Image-Turbo"
OUTPUT_DIR = "/workspace/lora_output"
TRIGGER = "ikelag_style"

RESOLUTION = 512
BATCH_SIZE = 1
GRAD_ACCUM = 4
LEARNING_RATE = 1e-4
NUM_EPOCHS = 15
LORA_RANK = 32
LORA_ALPHA = 16
SAVE_EVERY = 50  # save checkpoint every N optimizer steps
MAX_SEQ_LEN = 512

os.makedirs(OUTPUT_DIR, exist_ok=True)

# === Dataset ===
class ImageDataset(Dataset):
    def __init__(self, images_dir, captions_file, size=512):
        self.size = size
        self.samples = []
        captions = {}
        if os.path.exists(captions_file):
            with open(captions_file) as f:
                for line in f:
                    if "\t" in line:
                        name, cap = line.strip().split("\t", 1)
                        if not cap.startswith("error"):
                            captions[name] = cap.strip()
        for fname in sorted(os.listdir(images_dir)):
            if fname.endswith((".jpg", ".png", ".jpeg", ".webp")):
                cap = captions.get(fname, "")
                if not cap:
                    print(f"WARNING: no caption for {fname}, skipping")
                    continue
                # Prepend trigger word
                cap = f"{TRIGGER}, {cap}"
                self.samples.append((os.path.join(images_dir, fname), cap))
        print(f"Dataset: {len(self.samples)} images with captions")

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, idx):
        img_path, caption = self.samples[idx]
        img = Image.open(img_path).convert("RGB")
        w, h = img.size
        # Center crop to square
        target = min(w, h)
        left = (w - target) // 2
        top = (h - target) // 2
        img = img.crop((left, top, left + target, top + target))
        img = img.resize((self.size, self.size), Image.LANCZOS)
        arr = np.array(img).astype(np.float32) / 127.5 - 1.0
        arr = torch.from_numpy(arr).permute(2, 0, 1)
        return {"pixel_values": arr, "caption": caption}


def main():
    from diffusers import ZImagePipeline, AutoencoderKL
    from peft import LoraConfig, get_peft_model, get_peft_model_state_dict
    from transformers import AutoModelForCausalLM, AutoTokenizer

    print("=" * 60)
    print("Z-Image DiT LoRA Training")
    print(f"torch={torch.__version__}, cuda={torch.cuda.is_available()}")
    print(f"GPU: {torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'N/A'}")
    print(f"VRAM: {torch.cuda.get_device_properties(0).total_memory / 1e9:.1f}GB" if torch.cuda.is_available() else "")
    print("=" * 60)

    # === 1. Load Text Encoder (CPU, chunked GPU forward) ===
    print("\n[1/5] Loading text encoder from HF (CPU)...")
    te = AutoModelForCausalLM.from_pretrained(
        HF_REPO, subfolder="text_encoder",
        torch_dtype=torch.bfloat16,
        cache_dir="/dev/shm/hf_cache",
    )
    tokenizer = AutoTokenizer.from_pretrained(
        HF_REPO, subfolder="tokenizer",
        cache_dir="/dev/shm/hf_cache",
    )
    te.eval()
    te.requires_grad_(False)
    print(f"  TE loaded: {sum(p.numel() for p in te.parameters()) / 1e9:.1f}B params, on CPU")

    # === 2. Load VAE from HF ===
    print("\n[2/5] Loading VAE from HF...")
    vae = AutoencoderKL.from_pretrained(
        HF_REPO, subfolder="vae",
        torch_dtype=torch.bfloat16,
        cache_dir="/dev/shm/hf_cache",
    ).to("cuda")
    vae.requires_grad_(False)
    vae.eval()
    print(f"  VAE loaded: scaling_factor={vae.config.scaling_factor}")

    # === 3. Load DiT from checkpoint ===
    print("\n[3/5] Loading ZImagePipeline from checkpoint...")
    pipe = ZImagePipeline.from_single_file(
        CKPT_PATH,
        torch_dtype=torch.bfloat16,
        text_encoder=te,
        tokenizer=tokenizer,
        vae=vae,
    ).to("cuda")
    transformer = pipe.transformer
    print(f"  DiT loaded: {sum(p.numel() for p in transformer.parameters()) / 1e9:.1f}B params")

    # Free pipe but keep transformer + vae + te refs
    del pipe
    gc.collect()
    torch.cuda.empty_cache()

    # === 4. Apply LoRA ===
    print("\n[4/5] Applying LoRA...")
    # Find attention linear modules
    target_modules = set()
    for name, module in transformer.named_modules():
        if isinstance(module, torch.nn.Linear):
            mod_name = name.split(".")[-1]
            if mod_name in ("to_q", "to_k", "to_v", "to_out", "q_proj", "k_proj", "v_proj", "o_proj", "qkv"):
                target_modules.add(mod_name)
    target_modules = sorted(target_modules) if target_modules else ["to_q", "to_k", "to_v", "to_out"]
    print(f"  LoRA targets: {target_modules}")

    lora_config = LoraConfig(
        r=LORA_RANK,
        lora_alpha=LORA_ALPHA,
        target_modules=target_modules,
        lora_dropout=0.05,
        bias="none",
    )
    transformer = get_peft_model(transformer, lora_config)
    transformer.print_trainable_parameters()

    # Enable gradient checkpointing if available
    try:
        transformer.gradient_checkpointing_enable()
        print("  Gradient checkpointing: ON")
    except Exception:
        print("  Gradient checkpointing: not available")

    # === 5. Training ===
    print("\n[5/5] Starting training...")
    dataset = ImageDataset(IMAGES_DIR, CAPTIONS_FILE, RESOLUTION)
    dataloader = DataLoader(dataset, batch_size=BATCH_SIZE, shuffle=True, num_workers=2, pin_memory=True)

    optimizer = torch.optim.AdamW(
        [p for p in transformer.parameters() if p.requires_grad],
        lr=LEARNING_RATE,
        betas=(0.9, 0.999),
        weight_decay=0.01,
    )

    # Flow matching scheduler
    from diffusers import FlowMatchEulerDiscreteScheduler
    noise_scheduler = FlowMatchEulerDiscreteScheduler(num_train_timesteps=1000, shift=3.0)

    total_steps = NUM_EPOCHS * len(dataset) // (BATCH_SIZE * GRAD_ACCUM)
    print(f"  {NUM_EPOCHS} epochs x {len(dataset)} images = {total_steps} optimizer steps")
    print(f"  lr={LEARNING_RATE}, rank={LORA_RANK}, alpha={LORA_ALPHA}, batch={BATCH_SIZE}x{GRAD_ACCUM}")
    print(f"  resolution={RESOLUTION}, max_seq_len={MAX_SEQ_LEN}")

    step = 0
    t0 = time.time()

    for epoch in range(NUM_EPOCHS):
        transformer.train()
        epoch_loss = 0.0
        num_batches = 0

        for batch_idx, batch in enumerate(dataloader):
            pixel_values = batch["pixel_values"].to("cuda", dtype=torch.float32)
            captions = batch["caption"]

            # --- VAE encode -> latents ---
            with torch.no_grad():
                latents = vae.encode(pixel_values).latent_dist.sample()
                latents = latents * vae.config.scaling_factor
                latents = latents.to(torch.bfloat16)

            # --- Text encode (TE on CPU -> GPU forward -> back to CPU) ---
            with torch.no_grad():
                # Use tokenizer chat template (Z-Image specific)
                formatted = []
                for cap in captions:
                    messages = [{"role": "user", "content": cap}]
                    text = tokenizer.apply_chat_template(
                        messages,
                        tokenize=False,
                        add_generation_prompt=True,
                        enable_thinking=True,
                    )
                    formatted.append(text)

                text_inputs = tokenizer(
                    formatted,
                    padding="max_length",
                    max_length=MAX_SEQ_LEN,
                    truncation=True,
                    return_tensors="pt",
                )
                input_ids = text_inputs.input_ids
                attention_mask = text_inputs.attention_mask.bool()

                # Move TE to GPU for forward, then back to CPU
                te.to("cuda")
                te_outputs = te(
                    input_ids=input_ids.to("cuda"),
                    attention_mask=attention_mask.to("cuda"),
                    output_hidden_states=True,
                )
                prompt_embeds = te_outputs.hidden_states[-2]  # [batch, seq, dim]

                # Extract per-sample valid tokens -> list of tensors
                cap_feats = []
                for i in range(prompt_embeds.shape[0]):
                    cap_feats.append(prompt_embeds[i][attention_mask[i]])

                # Move TE back to CPU to free VRAM
                te.to("cpu")
                torch.cuda.empty_cache()

            # --- Flow matching: add noise to latents ---
            noise = torch.randn_like(latents)
            timesteps = torch.randint(
                0, noise_scheduler.config.num_train_timesteps,
                (latents.shape[0],), device="cuda"
            ).long()
            sigmas = timesteps.float() / noise_scheduler.config.num_train_timesteps
            sigmas = sigmas.view(-1, 1, 1, 1)
            noisy_latents = (1 - sigmas) * latents + sigmas * noise
            noisy_latents = noisy_latents.to(torch.bfloat16)

            # Target: velocity = noise - latents
            target = (noise - latents).to(torch.bfloat16)

            # --- Transformer forward ---
            # Z-Image expects x as list of tensors with extra dim
            latent_input = noisy_latents.unsqueeze(2)  # [B, C, 1, H, W]
            latent_list = list(latent_input.unbind(dim=0))

            model_pred = transformer(
                x=latent_list,
                t=timesteps,
                cap_feats=cap_feats,
            ).sample

            # model_pred is list of tensors -> stack
            if isinstance(model_pred, (list, tuple)):
                model_pred = torch.stack([t.float() for t in model_pred], dim=0)
            else:
                model_pred = model_pred.float()
            model_pred = model_pred.squeeze(2)  # remove extra dim

            # Flow matching loss
            target = target.squeeze(2) if target.dim() == 5 else target
            loss = F.mse_loss(model_pred, target.float())
            loss = loss / GRAD_ACCUM
            loss.backward()

            epoch_loss += loss.item() * GRAD_ACCUM
            num_batches += 1

            if (batch_idx + 1) % GRAD_ACCUM == 0:
                torch.nn.utils.clip_grad_norm_(transformer.parameters(), 1.0)
                optimizer.step()
                optimizer.zero_grad()
                step += 1

                if step % 5 == 0:
                    elapsed = time.time() - t0
                    avg_loss = epoch_loss / max(num_batches, 1)
                    vram = torch.cuda.memory_used() / 1e9
                    print(f"  E{epoch+1} S{step} loss={avg_loss:.4f} vram={vram:.1f}GB t={elapsed:.0f}s")

                if step % SAVE_EVERY == 0:
                    save_path = os.path.join(OUTPUT_DIR, f"lora_step{step}")
                    os.makedirs(save_path, exist_ok=True)
                    # Save only LoRA weights
                    state_dict = get_peft_model_state_dict(transformer)
                    torch.save(state_dict, os.path.join(save_path, "lora_weights.pt"))
                    print(f"  Saved: {save_path}/lora_weights.pt")

        avg_epoch_loss = epoch_loss / max(num_batches, 1)
        print(f"Epoch {epoch+1}/{NUM_EPOCHS} done, avg_loss={avg_epoch_loss:.4f}")

    # === Final save ===
    final_path = os.path.join(OUTPUT_DIR, "lora_final")
    os.makedirs(final_path, exist_ok=True)
    state_dict = get_peft_model_state_dict(transformer)
    torch.save(state_dict, os.path.join(final_path, "lora_weights.pt"))
    print(f"\nFinal LoRA saved to: {final_path}/lora_weights.pt")
    print(f"Total time: {(time.time() - t0) / 60:.1f} min")
    print(f"Total steps: {step}")


if __name__ == "__main__":
    main()