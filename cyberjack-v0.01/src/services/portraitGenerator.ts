/**
 * PortraitGenerator — собирает промпт для ComfyUI (Z-Image) из контекста сцены
 * и генерирует изображение через ComfyUI API.
 *
 * Z-Image Turbo использует свободные текстовые описания (не danbooru-теги),
 * Qwen3-4B text encoder, 8 шагов, cfg=1.0, 512x512.
 *
 * Поток:
 * 1. collectVisualContext() — извлекает позу, одежду, состояние, эмоцию из контекста
 * 2. buildImagePrompt() — собирает свободное описание сцены на английском
 * 3. generateImage() — отправляет Z-Image workflow в ComfyUI, ждёт результат
 * 4. broadcastEvent('scene_image', ...) — пушит URL на фронт через WebSocket
 */

import { activeContextsRepo, presetRepo, characterRepo } from '../infrastructure/repositories';
import { broadcastEvent } from '../api/socket';
import * as fs from 'fs';
import * as path from 'path';

const COMFY_URL = process.env.COMFY_URL || 'http://127.0.0.1:8188';
const ZIMAGE_CHECKPOINT = process.env.COMFY_CHECKPOINT || 'whiplashNSFW_v50FilmicFisheyeZIT.safetensors';
const ZIMAGE_VAE = 'zimage_vae.safetensors';
const ZIMAGE_TEXT_ENCODER = 'zimage_qwen3_4b.safetensors';

// ─── Контекст → визуальные теги ───────────────────────────

interface VisualContext {
    pose: string | null;
    equipment: string[];
    clothing: string[];
    effects: string[];
    emotion: string | null;
    characterName: string;
    interactionHint: string | null;
    narratorReaction: string | null;
}

/** Маппинг preset ID → визуальное описание для Z-Image (свободный текст) */
const POSE_DESC: Record<string, string> = {
    pose_standing: 'standing upright',
    pose_sitting: 'sitting on the floor',
    pose_lying_down: 'lying on her back on the floor',
    pose_all_fours: 'on all fours, hands and knees on the floor',
    pose_spread_eagle: 'lying spread eagle, arms and legs spread wide',
    pose_kneeling: 'kneeling on the floor',
};

const EQUIPMENT_DESC: Record<string, string> = {
    act_apply_handcuffs: 'wrists bound together with handcuffs',
    act_apply_collar: 'wearing a metal collar around her neck',
    act_insert_plug: '',
    act_suspend_wrists: 'arms raised above her head, wrists suspended by chains',
    eq_blindfold_apply: 'blindfolded with a black blindfold',
    eq_gag_apply: 'wearing a ball gag in her mouth',
};

const CLOTHING_DESC: Record<string, string> = {
    eq_clothe_jumpsuit: 'wearing a futuristic white jumpsuit, fully clothed',
    eq_clothe_dress: 'wearing a simple white dress',
    eq_clothe_stockings: 'wearing black thigh-high stockings',
    eq_clothe_underwear: 'wearing a white bra',
    eq_clothe_panties: 'wearing white panties',
};

const EFFECT_DESC: Record<string, string> = {
    effect_apathy: 'with empty, vacant eyes and an exhausted, broken expression',
    effect_chronic_apathy: 'with lifeless eyes and a completely broken, soulless expression',
    effect_suggestibility: 'with a dazed, glassy-eyed submissive expression',
    effect_freeze: 'frozen stiff with wide, terrified eyes and tense posture',
    effect_subspace: 'deeply blushing with heavy-lidded dazed eyes, euphoric and drooling expression',
    effect_panic: 'with a terrified expression, wide eyes filled with tears, hyperventilating',
    effect_sensory_overload: 'overwhelmed with eyes rolling back, mouth open, sweating profusely',
    effect_active_defiance: 'with an angry, defiant expression, glaring fiercely',
    effect_hyperesthesia: 'flinching with flushed, oversensitive skin',
    effect_local_hyperesthesia: 'flinching with flushed, sensitive skin',
    effect_local_numbness: 'with a numb, unresponsive expression',
};

/** Эмоция из tickResult → свободное описание */
function emotionFromTickResult(pleasure: number, discomfort: number, overload: number, engagement: number): string | null {
    if (overload > 70) return 'overwhelmed with eyes rolling back, mouth open, sweating profusely';
    if (pleasure > 60) return 'blushing deeply with half-closed eyes, heavy breathing, an expression of intense pleasure';
    if (discomfort > 50) return 'grimacing in pain with a tense, suffering expression';
    if (engagement > 60) return 'with flushed cheeks and slightly parted lips, focused and attentive';
    if (pleasure > 30) return 'with a soft smile and relaxed expression, lightly blushing';
    return null;
}

/** Извлечение ключевых визуальных деталей из narratorReaction */
function extractVisualHints(narratorText: string): string | null {
    const hints: string[] = [];
    const lower = narratorText.toLowerCase();

    if (lower.includes('поцелуй') || lower.includes('целует')) hints.push('kissing someone');
    if (lower.includes('объяти') || lower.includes('обнимает')) hints.push('being embraced');
    if (lower.includes('шлепок') || lower.includes('удар')) hints.push('being struck');
    if (lower.includes('глаж') || lower.includes('поглажи')) hints.push('being caressed');
    if (lower.includes('наклон') || lower.includes('склонив')) hints.push('someone leaning over her');
    if (lower.includes('подняла голову') || lower.includes('поднял голову')) hints.push('looking up');
    if (lower.includes('закрыла глаза') || lower.includes('глаза закрылись') || lower.includes('жмурится')) hints.push('eyes closed');
    if (lower.includes('приоткрыла губы') || lower.includes('рот приоткрыт')) hints.push('lips parted');
    if (lower.includes('дрож') || lower.includes('подрагива')) hints.push('trembling');
    if (lower.includes('выдох') || lower.includes('дыхание')) hints.push('breathing heavily');
    if (lower.includes('покорн')) hints.push('submissive expression');
    if (lower.includes('улыб')) hints.push('smiling');
    if (lower.includes('касает') || lower.includes('трога') || lower.includes('прикоснов')) hints.push('being touched');

    return hints.length ? hints.join(', ') : null;
}

export function collectVisualContext(
    subjectId: string,
    playerId: string,
    tickResult?: { pleasure?: number; discomfort?: number; overload?: number; engagement?: number },
    narratorReaction?: string
): VisualContext {
    const contexts = activeContextsRepo.getAllForSubject(subjectId);
    const subjectChar = characterRepo.get(subjectId);
    const characterName = subjectChar?.name || subjectId;

    let pose: string | null = null;
    const equipment: string[] = [];
    const clothing: string[] = [];
    const effects: string[] = [];

    for (const ctx of contexts) {
        const preset = presetRepo.getActionPreset(ctx.actionId);
        if (!preset) continue;

        if (POSE_DESC[ctx.actionId]) {
            pose = POSE_DESC[ctx.actionId];
        } else if (EQUIPMENT_DESC[ctx.actionId]) {
            const desc = EQUIPMENT_DESC[ctx.actionId];
            if (desc && !equipment.includes(desc)) equipment.push(desc);
        } else if (CLOTHING_DESC[ctx.actionId]) {
            const desc = CLOTHING_DESC[ctx.actionId];
            if (desc && !clothing.includes(desc)) clothing.push(desc);
        } else if (EFFECT_DESC[ctx.actionId]) {
            const desc = EFFECT_DESC[ctx.actionId];
            if (desc && !effects.includes(desc)) effects.push(desc);
        }
    }

    const emotion = tickResult
        ? emotionFromTickResult(
            tickResult.pleasure ?? 0,
            tickResult.discomfort ?? 0,
            tickResult.overload ?? 0,
            tickResult.engagement ?? 0
        )
        : null;

    const interactionHint = narratorReaction ? extractVisualHints(narratorReaction) : null;

    return { pose, equipment, clothing, effects, emotion, characterName, interactionHint, narratorReaction: narratorReaction || null };
}

/**
 * Собирает свободное текстовое описание сцены для Z-Image.
 * Z-Image понимает естественный язык (через Qwen3-4B), не danbooru-теги.
 */
export function buildImagePrompt(ctx: VisualContext): { positive: string; negative: string } {
    const parts: string[] = [
        'cinematic film still, photorealistic, a young woman with dark hair in a sterile sci-fi laboratory with blue lighting',
        'detailed face, correct anatomy',
    ];

    if (ctx.pose) parts.push(`She is ${ctx.pose}`);

    if (ctx.clothing.length) {
        parts.push(`She is ${ctx.clothing.join(' and ')}`);
    } else {
        parts.push('She is wearing only simple white underwear');
    }

    if (ctx.equipment.length) {
        parts.push(`She is ${ctx.equipment.join(' and ')}`);
    }

    if (ctx.effects.length) {
        parts.push(`She looks ${ctx.effects.join(', ')}`);
    }

    if (ctx.emotion) {
        parts.push(`Her expression is ${ctx.emotion}`);
    }

    if (ctx.interactionHint) {
        parts.push(ctx.interactionHint);
    }

    // Последняя реплика рассказчика — даёт модели контекст происходящего
    if (ctx.narratorReaction) {
        parts.push(`Scene: ${ctx.narratorReaction}`);
    }

    const positive = parts.join('. ') + '. masterpiece, best quality';

    const negative = 'bad anatomy, extra limbs, merged bodies, fused characters, missing limbs, deformed, blurry, low quality, watermark, extra fingers, fused fingers, missing fingers';

    return { positive, negative };
}

// ─── ComfyUI API (Z-Image workflow) ───────────────────────

let imageCounter = 0;

async function queueZImageWorkflow(positive: string, negative: string, seed: number): Promise<string> {
    const workflow: Record<string, any> = {
        "4": { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: ZIMAGE_CHECKPOINT } },
        "10": { class_type: "CLIPLoader", inputs: { clip_name: ZIMAGE_TEXT_ENCODER, type: "lumina2" } },
        "11": { class_type: "VAELoader", inputs: { vae_name: ZIMAGE_VAE } },
        "6": { class_type: "CLIPTextEncodeLumina2", inputs: {
            system_prompt: "superior",
            user_prompt: positive,
            clip: ["10", 0]
        }},
        "7": { class_type: "CLIPTextEncodeLumina2", inputs: {
            system_prompt: "superior",
            user_prompt: negative,
            clip: ["10", 0]
        }},
        "12": { class_type: "ModelSamplingFlux", inputs: {
            model: ["4", 0], max_shift: 3.0, base_shift: 0.5,
            width: 512, height: 512
        }},
        "5": { class_type: "EmptyLatentImage", inputs: { width: 512, height: 512, batch_size: 1 } },
        "3": { class_type: "KSampler", inputs: {
            seed, steps: 8, cfg: 1.0,
            sampler_name: "euler", scheduler: "simple", denoise: 1.0,
            model: ["12", 0], positive: ["6", 0], negative: ["7", 0], latent_image: ["5", 0]
        }},
        "8": { class_type: "VAEDecode", inputs: { samples: ["3", 0], vae: ["11", 0] } },
        "9": { class_type: "SaveImage", inputs: { filename_prefix: "cyberjack_scene", images: ["8", 0] } }
    };

    const resp = await fetch(`${COMFY_URL}/prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: workflow }),
    });

    if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(`ComfyUI queue failed: ${resp.status} ${errText.slice(0, 200)}`);
    }

    const data = await resp.json() as any;
    const promptId = data.prompt_id;
    if (!promptId) throw new Error(`ComfyUI returned no prompt_id: ${JSON.stringify(data)}`);
    return promptId;
}

async function pollComfyResult(promptId: string, timeoutMs: number = 180000): Promise<{ filename: string; buffer: Buffer }> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
        await new Promise(r => setTimeout(r, 3000));

        const histResp = await fetch(`${COMFY_URL}/history/${promptId}`);
        if (!histResp.ok) continue;

        const history = await histResp.json() as any;
        if (!(promptId in history)) continue;

        const outputs = history[promptId]?.outputs;
        if (!outputs?.['9']) continue;

        const images = outputs['9'].images;
        if (!images?.length) continue;

        const imgInfo = images[0];
        const filename = imgInfo.filename;
        const subfolder = imgInfo.subfolder || '';

        const imgUrl = `${COMFY_URL}/view?filename=${encodeURIComponent(filename)}&subfolder=${encodeURIComponent(subfolder)}`;
        const imgResp = await fetch(imgUrl);
        if (!imgResp.ok) throw new Error(`Failed to download image: ${imgResp.status}`);

        const arrayBuffer = await imgResp.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        if (buffer.length < 1000) {
            throw new Error('Image too small — possible VAE OOM (0-byte PNG)');
        }

        return { filename, buffer };
    }

    throw new Error(`ComfyUI generation timeout after ${timeoutMs}ms`);
}

// ─── Публичный API ────────────────────────────────────────

export interface PortraitResult {
    subjectId: string;
    imageUrl: string;       // URL для фронтенда
    promptText: string;
    timestamp: string;
}

/**
 * Генерирует изображение сцены и пушит его на фронт через WebSocket.
 * Сохраняет файл в public/scene-images/ и слает URL (не base64).
 */
export async function generateSceneImage(
    subjectId: string,
    playerId: string,
    tickResult?: { pleasure?: number; discomfort?: number; overload?: number; engagement?: number },
    narratorReaction?: string,
    seed?: number,
): Promise<PortraitResult | null> {
    try {
        const ctx = collectVisualContext(subjectId, playerId, tickResult, narratorReaction);
        const { positive, negative } = buildImagePrompt(ctx);

        const actualSeed = seed ?? Math.floor(Math.random() * 1000000);

        console.log(`[PortraitGen] Z-Image generating for ${subjectId}: ${positive.slice(0, 150)}...`);

        const promptId = await queueZImageWorkflow(positive, negative, actualSeed);
        const { filename, buffer } = await pollComfyResult(promptId);

        // Сохраняем в public/scene-images/ (статичная директория Express)
        const outDir = path.resolve(process.cwd(), 'public', 'scene-images');
        if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
        const localPath = path.join(outDir, filename);
        fs.writeFileSync(localPath, buffer);

        // URL для фронтенда
        const imageUrl = `/scene-images/${filename}`;

        const result: PortraitResult = {
            subjectId,
            imageUrl,
            promptText: positive,
            timestamp: new Date().toISOString(),
        };

        // Пушим на фронт через WebSocket (URL, не base64 — быстро)
        broadcastEvent('scene_image', {
            subjectId,
            imageUrl,
            promptText: positive,
            timestamp: result.timestamp,
        });

        console.log(`[PortraitGen] Scene image ready: ${imageUrl}`);
        return result;
    } catch (err: any) {
        console.error(`[PortraitGen] Failed:`, err.message);
        return null;
    }
}

/**
 * Решает, нужно ли генерировать изображение для данного тика.
 */
export function shouldGenerateImage(params: {
    actionApplied: boolean;
    systemNotes: string[];
    contextChanged: boolean;
    tickResult?: { pleasure?: number; discomfort?: number; overload?: number; engagement?: number };
}): boolean {
    if (params.actionApplied) return true;
    if (params.systemNotes.length > 0) return true;
    if (params.contextChanged) return true;

    const tr = params.tickResult;
    if (tr && ((tr.pleasure ?? 0) > 50 || (tr.discomfort ?? 0) > 50 || (tr.overload ?? 0) > 60)) return true;

    return false;
}