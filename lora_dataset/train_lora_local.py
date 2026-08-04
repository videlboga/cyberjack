#!/usr/bin/env python3
"""train_lora_local.py — Z-Image DiT LoRA training on RTX 3070 Ti (8GB VRAM).

Strategy for 8GB VRAM:
  1. Text encoder (Qwen3-4B) on CPU → pre-compute all text embeddings once, cache
  2. DiT 4-bit NF4 on GPU (~3.5GB)
  3. VAE bf16 on GPU (0.2GB)
  4. LoRA r=16 + optimizer (~0.5GB)
  5. Activations with gradient checkpointing (~1-2GB)
  6. Resolution 512, batch=1, grad_accum=4

Usage:
    /home/cyberkitty/Projects/porn-search/.venv/bin/python train_lora_local.py
"""
import os, sys, json, time, gc, math

os.environ["HF_HOME"] = os.path.expanduser("~/.cache/huggingface")
os.environ["TRANSFORMERS_CACHE"] = os.path.expanduser("~/.cache/huggingface/hub")

import torch
# Set memory fraction BEFORE any CUDA operations to avoid NVML init crash
torch.cuda.set_per_process_memory_fraction(0.95)
import torch.nn.functional as F
from torch.utils.data import Dataset, DataLoader
from PIL import Image
import numpy as np
import bitsandbytes as bnb

# === Config ===
IMAGES_DIR = "/home/cyberkitty/Projects/cyberjack/lora_dataset/images"
CAPTIONS_FILE = "/home/cyberkitty/Projects/cyberjack/lora_dataset/captions.json"
CKPT_PATH = "/home/cyberkitty/comfyui/models/checkpoints/azureZitAnimeStyleNSFW_10BF16.safetensors"
HF_REPO = "Tongyi-MAI/Z-Image-Turbo"
OUTPUT_DIR = "/home/cyberkitty/Projects/cyberjack/lora_dataset/lora_output_local"
TRIGGER = "ikelag_style"

RESOLUTION = 256
BATCH_SIZE = 1
GRAD_ACCUM = 4
LEARNING_RATE = 1e-4
NUM_EPOCHS = 10
LORA_RANK = 16
LORA_ALPHA = 8
SAVE_EVERY = 25
MAX_SEQ_LEN = 512
USE_4BIT = True  # 4-bit NF4 quantization for DiT

os.makedirs(OUTPUT_DIR, exist_ok=True)


# === Key remapping: azureZit → diffusers ZImageTransformer2DModel ===
def build_remap(ckpt_keys, model_keys_set):
    remap = {}
    for ck in ckpt_keys:
        dk = ck.replace("model.diffusion_model.", "")
        if dk in model_keys_set:
            remap[ck] = dk
            continue
        if dk.endswith(".attention.qkv.weight"):
            prefix = dk[:-len(".attention.qkv.weight")]
            remap[ck + ".q"] = f"{prefix}.attention.to_q.weight"
            remap[ck + ".k"] = f"{prefix}.attention.to_k.weight"
            remap[ck + ".v"] = f"{prefix}.attention.to_v.weight"
            continue
        if dk.endswith(".attention.q_norm.weight"):
            prefix = dk[:-len(".attention.q_norm.weight")]
            remap[ck] = f"{prefix}.attention.norm_q.weight"
            continue
        if dk.endswith(".attention.k_norm.weight"):
            prefix = dk[:-len(".attention.k_norm.weight")]
            remap[ck] = f"{prefix}.attention.norm_k.weight"
            continue
        if dk.endswith(".attention.out.weight"):
            prefix = dk[:-len(".attention.out.weight")]
            remap[ck] = f"{prefix}.attention.to_out.0.weight"
            continue
        if dk.startswith("final_layer."):
            suffix = dk[len("final_layer."):]
            target = f"all_final_layer.2-1.{suffix}"
            if target in model_keys_set:
                remap[ck] = target
                continue
        if dk.startswith("x_embedder."):
            suffix = dk[len("x_embedder."):]
            target = f"all_x_embedder.2-1.{suffix}"
            if target in model_keys_set:
                remap[ck] = target
                continue
    return remap


def load_dit_4bit():
    """Load azureZit DiT with 4-bit NF4 quantization on GPU."""
    print("Creating ZImageTransformer2DModel and loading azureZit weights...", flush=True)
    from diffusers.models.transformers import ZImageTransformer2DModel
    from safetensors import safe_open

    model = ZImageTransformer2DModel()
    model_keys_set = set(model.state_dict().keys())

    print("  Loading azureZit checkpoint and remapping keys...", flush=True)
    new_sd = {}
    with safe_open(CKPT_PATH, framework="pt") as st:
        ckpt_keys = list(st.keys())
        for ck in ckpt_keys:
            dk = ck.replace("model.diffusion_model.", "")
            if dk in model_keys_set:
                new_sd[dk] = st.get_tensor(ck).to(torch.bfloat16)
                continue
            if dk.endswith(".attention.qkv.weight"):
                qkv = st.get_tensor(ck)
                q, k, v = qkv.chunk(3, dim=0)
                prefix = dk[:-len(".attention.qkv.weight")]
                new_sd[f"{prefix}.attention.to_q.weight"] = q.to(torch.bfloat16)
                new_sd[f"{prefix}.attention.to_k.weight"] = k.to(torch.bfloat16)
                new_sd[f"{prefix}.attention.to_v.weight"] = v.to(torch.bfloat16)
                continue
            if dk.endswith(".attention.q_norm.weight"):
                prefix = dk[:-len(".attention.q_norm.weight")]
                new_sd[f"{prefix}.attention.norm_q.weight"] = st.get_tensor(ck).to(torch.bfloat16)
                continue
            if dk.endswith(".attention.k_norm.weight"):
                prefix = dk[:-len(".attention.k_norm.weight")]
                new_sd[f"{prefix}.attention.norm_k.weight"] = st.get_tensor(ck).to(torch.bfloat16)
                continue
            if dk.endswith(".attention.out.weight"):
                prefix = dk[:-len(".attention.out.weight")]
                new_sd[f"{prefix}.attention.to_out.0.weight"] = st.get_tensor(ck).to(torch.bfloat16)
                continue
            if dk.startswith("final_layer."):
                suffix = dk[len("final_layer."):]
                target = f"all_final_layer.2-1.{suffix}"
                if target in model_keys_set:
                    new_sd[target] = st.get_tensor(ck).to(torch.bfloat16)
                    continue
            if dk.startswith("x_embedder."):
                suffix = dk[len("x_embedder."):]
                target = f"all_x_embedder.2-1.{suffix}"
                if target in model_keys_set:
                    new_sd[target] = st.get_tensor(ck).to(torch.bfloat16)
                    continue

    print(f"  Remapped {len(new_sd)}/{len(model_keys_set)} keys", flush=True)
    missing, unexpected = model.load_state_dict(new_sd, strict=False)
    if missing:
        print(f"  Missing keys: {len(missing)}", flush=True)
        for k in missing[:5]:
            print(f"    {k}")
    if unexpected:
        print(f"  Unexpected keys: {len(unexpected)}", flush=True)

    # Replace all Linear modules with Linear4bit (NF4 quantization on CPU)
    print("  Replacing Linear layers with Linear4bit (NF4)...", flush=True)
    import bitsandbytes.functional as bnf

    def replace_linears(parent, prefix=""):
        for name, child in list(parent.named_children()):
            if isinstance(child, torch.nn.Linear) and not isinstance(child, bnb.nn.Linear4bit):
                # Quantize weight on CPU
                w = child.weight.data.to(torch.bfloat16)
                qw, qstate = bnf.quantize_4bit(w, quant_type="nf4", compress_statistics=True)

                qlayer = bnb.nn.Linear4bit(
                    child.in_features, child.out_features,
                    bias=child.bias is not None,
                    quant_type="nf4",
                    compute_dtype=torch.bfloat16,
                )
                qlayer.weight = bnb.nn.Params4bit(
                    data=qw, quant_state=qstate, quant_type="nf4", requires_grad=False,
                )
                if child.bias is not None:
                    qlayer.bias = torch.nn.Parameter(child.bias.data.to(torch.bfloat16))
                setattr(parent, name, qlayer)
            else:
                replace_linears(child, prefix)

    replace_linears(model)

    # Move quantized model to GPU manually (avoid module.to('cuda') which triggers NVML)
    print("  Moving quantized model to GPU...", flush=True)
    for name, param in model.named_parameters():
        if isinstance(param, bnb.nn.Params4bit):
            # Move quantized weight data + quant_state to GPU
            param.data = param.data.to("cuda")
            qs = param.quant_state
            if qs is not None:
                qs.absmax = qs.absmax.to("cuda")
                if qs.code is not None:
                    qs.code = qs.code.to("cuda")
                if hasattr(qs, "state2") and qs.state2 is not None:
                    qs.state2.absmax = qs.state2.absmax.to("cuda")
                    if qs.state2.code is not None:
                        qs.state2.code = qs.state2.code.to("cuda")
        else:
            param.data = param.data.to("cuda")
    for name, buf in model.named_buffers():
        buf.data = buf.data.to("cuda")

    model.eval()
    model.requires_grad_(False)

    vram = torch.cuda.memory_allocated() / 1e9
    print(f"  DiT loaded (4-bit), VRAM: {vram:.1f}GB", flush=True)
    return model


def load_vae():
    """Load VAE on GPU."""
    from diffusers import AutoencoderKL
    vae = AutoencoderKL.from_pretrained(
        HF_REPO, subfolder="vae",
        torch_dtype=torch.bfloat16,
        device_map="auto",
    )
    vae.requires_grad_(False)
    vae.eval()
    vram = torch.cuda.memory_allocated() / 1e9
    print(f"  VAE loaded, VRAM: {vram:.1f}GB", flush=True)
    return vae


def precompute_text_embeddings(captions, tokenizer, text_encoder, device="cuda"):
    """Pre-compute text embeddings on GPU (fast), return dict filename → embedding.

    TE is loaded on GPU temporarily, embeddings computed, then TE freed.
    """
    print(f"Pre-computing text embeddings on {device}...", flush=True)
    # TE already on device via device_map='auto', no .to() needed

    embeddings = {}

    for i, (fname, caption) in enumerate(captions.items()):
        # Build chat template
        messages = [{"role": "user", "content": f"{TRIGGER}, {caption}"}]
        text = tokenizer.apply_chat_template(
            messages,
            tokenize=False,
            add_generation_prompt=True,
        )
        text_inputs = tokenizer(
            text,
            padding="max_length",
            max_length=MAX_SEQ_LEN,
            truncation=True,
            return_tensors="pt",
        )
        input_ids = text_inputs.input_ids.to(device)
        attention_mask = text_inputs.attention_mask.bool().to(device)

        with torch.no_grad():
            outputs = text_encoder(
                input_ids=input_ids,
                attention_mask=attention_mask,
                output_hidden_states=True,
            )
            # Use second-to-last hidden state
            embed = outputs.hidden_states[-2]  # [1, seq, dim]
            # Extract valid tokens only
            valid = embed[0][attention_mask[0]]  # [valid_len, dim]

        embeddings[fname] = valid.cpu().to(torch.bfloat16)
        del input_ids, attention_mask, embed, valid, outputs

        if (i + 1) % 10 == 0:
            vram = torch.cuda.memory_allocated() / 1e9 if device == "cuda" else 0
            print(f"  {i+1}/{len(captions)} embedded (VRAM: {vram:.1f}GB)", flush=True)

    print(f"  Done: {len(embeddings)} embeddings cached", flush=True)
    return embeddings


class CachedDataset(Dataset):
    """Dataset using pre-computed text embeddings."""

    def __init__(self, images_dir, captions, text_embeddings, size=512):
        self.size = size
        self.samples = []

        for fname in sorted(captions.keys()):
            img_path = os.path.join(images_dir, fname)
            if not os.path.exists(img_path):
                continue
            if fname not in text_embeddings:
                continue
            self.samples.append((img_path, fname, captions[fname]))

        print(f"Dataset: {len(self.samples)} images with cached embeddings")

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, idx):
        img_path, fname, caption = self.samples[idx]
        img = Image.open(img_path).convert("RGB")
        w, h = img.size
        target = min(w, h)
        left = (w - target) // 2
        top = (h - target) // 2
        img = img.crop((left, top, left + target, top + target))
        img = img.resize((self.size, self.size), Image.LANCZOS)
        arr = np.array(img).astype(np.float32) / 127.5 - 1.0
        arr = torch.from_numpy(arr).permute(2, 0, 1)
        return {
            "pixel_values": arr,
            "fname": fname,
            "caption": caption,
        }


def main():
    from diffusers import FlowMatchEulerDiscreteScheduler
    from peft import LoraConfig, get_peft_model, get_peft_model_state_dict
    from transformers import AutoModelForCausalLM, AutoTokenizer

    print("=" * 60, flush=True)
    print("Z-Image DiT LoRA Training (Local 8GB VRAM)", flush=True)
    print(f"torch={torch.__version__}, cuda={torch.cuda.is_available()}", flush=True)
    print(f"GPU: {torch.cuda.get_device_name(0)}", flush=True)
    print(f"VRAM: {torch.cuda.get_device_properties(0).total_memory / 1e9:.1f}GB", flush=True)
    print("=" * 60, flush=True)

    # === 1. Load captions ===
    with open(CAPTIONS_FILE) as f:
        captions = json.load(f)
    print(f"\nCaptions: {len(captions)}", flush=True)

    # === 2. Load Text Encoder on GPU temporarily ===
    print("\n[1/6] Loading text encoder (GPU)...", flush=True)
    # Use device_map='auto' — .to('cuda') and device_map='cuda:0' both crash
    # with NVML driver mismatch, but 'auto' works (may offload some to CPU)
    te = AutoModelForCausalLM.from_pretrained(
        HF_REPO, subfolder="text_encoder",
        torch_dtype=torch.bfloat16,
        device_map="auto",
        cache_dir=os.path.expanduser("~/.cache/huggingface/hub"),
    )
    tokenizer = AutoTokenizer.from_pretrained(
        HF_REPO, subfolder="tokenizer",
        cache_dir=os.path.expanduser("~/.cache/huggingface/hub"),
    )
    te.eval()
    te.requires_grad_(False)
    vram = torch.cuda.memory_allocated() / 1e9
    print(f"  TE loaded: {sum(p.numel() for p in te.parameters()) / 1e9:.1f}B params, VRAM: {vram:.1f}GB", flush=True)

    # === 3. Pre-compute text embeddings on GPU ===
    print("\n[2/6] Pre-computing text embeddings...", flush=True)
    text_embeddings = precompute_text_embeddings(captions, tokenizer, te, device="cuda")

    # Free TE completely before loading DiT
    del te
    gc.collect()
    torch.cuda.empty_cache()
    vram = torch.cuda.memory_allocated() / 1e9
    print(f"  TE freed, VRAM after cleanup: {vram:.1f}GB", flush=True)

    # === 4. Load VAE ===
    print("\n[3/6] Loading VAE...", flush=True)
    vae = load_vae()

    # === 5. Load DiT (4-bit) ===
    print("\n[4/6] Loading DiT (4-bit NF4)...", flush=True)
    transformer = load_dit_4bit()

    # === 6. Apply LoRA ===
    print("\n[5/6] Applying LoRA...", flush=True)
    target_modules = ["to_q", "to_k", "to_v", "to_out.0"]
    # Verify these exist
    found = set()
    for name, module in transformer.named_modules():
        mod_name = name.split(".")[-1]
        if mod_name in target_modules:
            found.add(mod_name)
    print(f"  Found target modules: {sorted(found)}", flush=True)

    lora_config = LoraConfig(
        r=LORA_RANK,
        lora_alpha=LORA_ALPHA,
        target_modules=target_modules,
        lora_dropout=0.05,
        bias="none",
    )
    transformer = get_peft_model(transformer, lora_config)
    transformer.print_trainable_parameters()

    try:
        transformer.gradient_checkpointing_enable()
        print("  Gradient checkpointing: ON", flush=True)
    except Exception as e:
        print(f"  Gradient checkpointing: OFF ({e})", flush=True)

    # === 7. Training ===
    print("\n[6/6] Starting training...", flush=True)
    dataset = CachedDataset(IMAGES_DIR, captions, text_embeddings, RESOLUTION)
    dataloader = DataLoader(dataset, batch_size=BATCH_SIZE, shuffle=True, num_workers=0)

    optimizer = torch.optim.AdamW(
        [p for p in transformer.parameters() if p.requires_grad],
        lr=LEARNING_RATE,
        betas=(0.9, 0.999),
        weight_decay=0.01,
    )

    noise_scheduler = FlowMatchEulerDiscreteScheduler(num_train_timesteps=1000, shift=3.0)

    total_steps = NUM_EPOCHS * len(dataset) // (BATCH_SIZE * GRAD_ACCUM)
    print(f"  {NUM_EPOCHS} epochs x {len(dataset)} images = {total_steps} optimizer steps", flush=True)
    print(f"  lr={LEARNING_RATE}, rank={LORA_RANK}, alpha={LORA_ALPHA}", flush=True)
    print(f"  batch={BATCH_SIZE}x{GRAD_ACCUM}, resolution={RESOLUTION}", flush=True)

    step = 0
    t0 = time.time()

    for epoch in range(NUM_EPOCHS):
        transformer.train()
        epoch_loss = 0.0
        num_batches = 0

        for batch_idx, batch in enumerate(dataloader):
            pixel_values = batch["pixel_values"].to("cuda", dtype=torch.bfloat16)
            fname = batch["fname"][0]

            # --- VAE encode → latents ---
            with torch.no_grad():
                latents = vae.encode(pixel_values).latent_dist.sample()
                latents = latents * vae.config.scaling_factor
                latents = latents.to(torch.bfloat16)
            del pixel_values
            torch.cuda.empty_cache()

            # --- Get pre-computed text embedding ---
            cap_feats = [text_embeddings[fname].to("cuda")]  # list of [valid_len, dim]

            # --- Flow matching: add noise ---
            noise = torch.randn_like(latents)
            timesteps = torch.randint(
                0, noise_scheduler.config.num_train_timesteps,
                (latents.shape[0],), device="cuda"
            ).long()
            sigmas = timesteps.float() / noise_scheduler.config.num_train_timesteps
            sigmas = sigmas.view(-1, 1, 1, 1)
            noisy_latents = (1 - sigmas) * latents + sigmas * noise
            noisy_latents = noisy_latents.to(torch.bfloat16)

            target = (noise - latents).to(torch.bfloat16)

            # --- DiT forward ---
            latent_input = noisy_latents.unsqueeze(2)  # [B, C, 1, H, W]
            latent_list = list(latent_input.unbind(dim=0))

            model_pred = transformer(
                x=latent_list,
                t=timesteps,
                cap_feats=cap_feats,
            ).sample

            if isinstance(model_pred, (list, tuple)):
                model_pred = torch.stack([t.float() for t in model_pred], dim=0)
            else:
                model_pred = model_pred.float()
            model_pred = model_pred.squeeze(2)

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
                    vram = torch.cuda.memory_allocated() / 1e9
                    print(f"  E{epoch+1} S{step} loss={avg_loss:.4f} vram={vram:.1f}GB t={elapsed:.0f}s", flush=True)

                if step % SAVE_EVERY == 0:
                    save_path = os.path.join(OUTPUT_DIR, f"lora_step{step}")
                    os.makedirs(save_path, exist_ok=True)
                    state_dict = get_peft_model_state_dict(transformer)
                    torch.save(state_dict, os.path.join(save_path, "lora_weights.pt"))
                    print(f"  Saved: {save_path}/lora_weights.pt", flush=True)

        avg_epoch_loss = epoch_loss / max(num_batches, 1)
        print(f"Epoch {epoch+1}/{NUM_EPOCHS} done, avg_loss={avg_epoch_loss:.4f}", flush=True)

    # === Final save ===
    final_path = os.path.join(OUTPUT_DIR, "lora_final")
    os.makedirs(final_path, exist_ok=True)
    state_dict = get_peft_model_state_dict(transformer)
    torch.save(state_dict, os.path.join(final_path, "lora_weights.pt"))
    print(f"\nFinal LoRA saved to: {final_path}/lora_weights.pt", flush=True)
    print(f"Total time: {(time.time() - t0) / 60:.1f} min", flush=True)
    print(f"Total steps: {step}", flush=True)


if __name__ == "__main__":
    main()