import React, { useEffect, useMemo, useRef, useState } from 'react';
import { buildCalibrationVisualDescriptorV4, resolveCalibrationAvatarV4, resolveMentalChairAvatar, resolveCellRoutineAvatar, resolveSleepAvatar } from '../domain/characterVisuals';

type PortraitContext = { id?: string; actionId?: string };
type PortraitState = {
  tension?: number;
  attitude?: number;
  openness?: number;
  behavioralState?: string;
  transitions?: Array<{ kind?: string; title?: string }>;
  contexts?: PortraitContext[];
};

const contextIds = (contexts: PortraitContext[] = []) => new Set(
  contexts.map(context => context.actionId || context.id).filter(Boolean),
);

const wardrobeFor = (contexts: PortraitContext[] = []) => {
  const ids = contextIds(contexts);
  if (ids.has('eq_clothe_dress') && ids.has('eq_clothe_stockings')) return 'dress_stockings';
  if (ids.has('eq_clothe_dress')) return 'dress';
  if (ids.has('eq_clothe_costume')) return 'costume';
  if (ids.has('eq_clothe_lab_gown')) return 'lab_gown';
  if (ids.has('eq_clothe_jumpsuit')) return 'jumpsuit';
  if (ids.has('eq_clothe_calibration_set')) return 'calibration_set';
  if (ids.has('eq_clothe_underwear') || ids.has('eq_clothe_panties')) return 'underwear';
  return 'nude';
};

const poseFor = (contexts: PortraitContext[] = []) => {
  const ids = contextIds(contexts);
  if (ids.has('act_suspend_wrists')) return 'suspended';
  if (ids.has('pose_spread_eagle')) return 'spread_eagle';
  if (ids.has('pose_all_fours')) return 'all_fours';
  if (ids.has('pose_lying_down')) return 'lying';
  if (ids.has('pose_kneeling')) return 'kneeling';
  if (ids.has('pose_sitting')) return 'sitting';
  return 'standing';
};

const legacyPortraits: Record<string, string> = {
  eden: '/avatars/Eden.png', eli: '/avatars/Eli.png', kai: '/avatars/Kai.png',
  mara: '/avatars/Mara.png', nyx: '/avatars/Nyx.png', ren: '/avatars/Ren.png',
  runis: '/avatars/Runis.png', silas: '/avatars/Silas.png', vex: '/avatars/Vex.png',
};

// VRM-портрет: живая модель вместо статичной картинки. Сервер раздачи
// (control-room dashboard) должен быть поднят на VRM_PORTRAIT_BASE.
const VRM_PORTRAIT_BASE = "http://127.0.0.1:8765";
const VRM_CHARACTERS: Record<string, { dir: string; prefix: string }> = {
  mira: { dir: "models/x20/mira", prefix: "Mira_outfit" },
  rin: { dir: "models/x20/outfits", prefix: "Rin_outfit" },
  kai: { dir: "models/x20/kai", prefix: "Kai_outfit" },
};
const characterSlugFor = (id?: string | null): string | null =>
  id === "S-AV-01" ? "mira"
    : id === "NPC-LAB-01" ? "iona"
      : id === "NPC-CAND-01" ? "nika"
        : id === "NPC-CAND-SUMI" ? "sumi"
          : id === "NPC-CAND-GEN-02" ? "eli"
            : id === "NPC-CAND-GEN-03" ? "rin"
              : id === "NPC-CAND-GEN-04" ? "mai"
                : id === "NPC-CAND-GEN-05" ? "kai"
                  : id === "NPC-CAND-KATE" ? "kate"
                    : id === "NPC-RIN-01" ? "rin"
                      : null;
const vrmsForSlug = new Set(Object.keys(VRM_CHARACTERS));
const vrmOutfitFor = (slug: string, wardrobe: string): number => {
  if (wardrobe === "nude") return 3;
  if (wardrobe === "underwear") return slug === "mira" ? 1 : 3;
  if (wardrobe === "dress") return slug === "mira" ? 2 : 1;
  return 0;
};
const vrmPortraitUrl = (slug: string, wardrobe: string): string => {
  const def = VRM_CHARACTERS[slug];
  const index = vrmOutfitFor(slug, wardrobe);
  const file = `${def.prefix}_${String(index).padStart(2, "0")}.vrm`;
  return `${VRM_PORTRAIT_BASE}/vrm_portrait.html?vrm=${encodeURIComponent(`${def.dir}/${file}`)}`;
};

export const canonicalCharacterPortrait = (
  id?: string | null,
  name?: string | null,
  contexts: PortraitContext[] = [],
  state?: PortraitState | null,
  sleeping = false,
): string | null => {
  // Some scene payloads expose contexts on the participant state, while
  // directory and legacy payloads carry them beside it.  Treat both as one
  // source of truth so a portrait cannot fall back to an outdated wardrobe.
  const visualContexts = Array.from(
    new Map(
      [...(state?.contexts || []), ...contexts]
        .map((context) => [context.actionId || context.id, context] as const)
        .filter(([actionId]) => Boolean(actionId)),
    ).values(),
  );
  const wardrobe = wardrobeFor(visualContexts);
  const slug = id === 'S-AV-01' ? 'mira'
    : id === 'NPC-LAB-01' ? 'iona'
      : id === 'NPC-CAND-01' ? 'nika'
        : id === 'NPC-CAND-SUMI' ? 'sumi'
          : id === 'NPC-CAND-GEN-02' ? 'eli'
            : id === 'NPC-CAND-GEN-03' ? 'rin'
              : id === 'NPC-CAND-GEN-04' ? 'mai'
                : id === 'NPC-CAND-GEN-05' ? 'kai'
                  : id === 'NPC-CAND-KATE' ? 'kate'
                    : id === 'NPC-RIN-01' ? 'rin'
                      : null;
  if (slug && id) {
    const descriptorContexts = visualContexts
      .map(context => context.actionId || context.id)
      .filter((actionId): actionId is string => Boolean(actionId))
      .map(actionId => ({ actionId }));
    const climax = (state?.transitions || []).some(transition =>
      /discharge|climax|разряд/i.test(`${transition.kind || ''} ${transition.title || ''}`)
    );
    const descriptor = buildCalibrationVisualDescriptorV4(id, {
      contexts: descriptorContexts,
      tension: state?.tension,
      attitude: state?.attitude,
      openness: state?.openness,
    }, state?.behavioralState, climax);
    const inMentalChair = descriptorContexts.some(context => context.actionId === 'context_mental_correction_chair');
    const cellRoutineAvatar = resolveCellRoutineAvatar(descriptor.characterSlug, descriptor.affect, descriptorContexts);
    const sleepAvatar = sleeping ? resolveSleepAvatar(descriptor.characterSlug, descriptor.affect) : null;
    return (inMentalChair ? resolveMentalChairAvatar(descriptor) : null)
      || sleepAvatar
      || cellRoutineAvatar
      || resolveCalibrationAvatarV4(descriptor)
      || `/character-images/cutout/rendered/${slug}/${poseFor(visualContexts)}__${wardrobe}__none__neutral.png`
      || `/character-images/rendered/${slug}/${poseFor(visualContexts)}__${wardrobe}__none__neutral.png`;
  }
  const normalizedName = String(name || '').trim().toLowerCase();
  return legacyPortraits[normalizedName] || null;
};

export function CharacterPortrait({
  id, name, portrait, contexts = [], state, sleeping = false, className,
}: {
  id?: string | null;
  name: string;
  portrait?: string | null;
  contexts?: PortraitContext[];
  state?: PortraitState | null;
  sleeping?: boolean;
  className?: string;
}) {
  const canonical = canonicalCharacterPortrait(id, name, contexts, state, sleeping);
  // The authored `portrait` is a stable identity fallback. The canonical
  // visual reflects the character's actual pose, clothing, restraints and
  // affect, so it must be attempted first whenever the matrix covers it.
  // A sleeping character must never fall back to a standing portrait: the
  // sleep avatar is authoritative, and a transient load error must not
  // permanently swap it for the awake visual.
  const sources = Array.from(
    new Set([canonical, ...(sleeping ? [] : [portrait])].filter(Boolean)),
  ) as string[];
  const [sourceIndex, setSourceIndex] = useState(0);
  useEffect(() => setSourceIndex(0), [id, name, portrait, canonical, sleeping]);
  const source = sources[sourceIndex];

  // VRM-портрет: карточка персонажа становится живой моделью (idle + мимика
  // по состоянию + рот по репликам). Падение сервера/времени загрузки —
  // мягкий откат на прежнюю картинку.
  const slug = id ? characterSlugFor(id) : null;
  const vrmSlug = slug && vrmsForSlug.has(slug) ? slug : null;
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [vrmAlive, setVrmAlive] = useState<'pending' | 'ready' | 'failed'>('pending');
  useEffect(() => setVrmAlive('pending'), [id]);
  const vrmDescriptor = useMemo(() => {
    if (!vrmSlug || !id || sleeping) return null;
    const actionIds = [
      ...(state?.contexts || []).map(context => context.actionId || context.id),
      ...(contexts || []).map(context => context.actionId || context.id),
    ].filter((actionId): actionId is string => Boolean(actionId));
    const climax = (state?.transitions || []).some(transition =>
      /discharge|climax|разряд/i.test(`${transition.kind || ''} ${transition.title || ''}`),
    );
    return buildCalibrationVisualDescriptorV4(id, {
      contexts: actionIds.map(actionId => ({ actionId })),
      tension: state?.tension,
      attitude: state?.attitude,
      openness: state?.openness,
    }, state?.behavioralState, climax);
  }, [vrmSlug, id, sleeping, contexts, state]);
  const postVisual = useMemo(() => () => {
    const win = iframeRef.current?.contentWindow;
    if (!win || !vrmDescriptor) return;
    const interaction = vrmDescriptor.interaction
      ? {
          family: vrmDescriptor.interaction.family,
          phase: vrmDescriptor.interaction.phase,
          intensity: vrmDescriptor.interaction.intensity,
          variant: vrmDescriptor.interaction.variant,
        }
      : null;
    win.postMessage({
      type: 'visual',
      affect: vrmDescriptor.affect,
      activation: vrmDescriptor.mode === 'device' ? 'working' : 'calm',
      pose: vrmDescriptor.pose,
      interaction,
      speed: vrmDescriptor.interaction ? 0.9 + (vrmDescriptor.interaction.intensity || 0) * 0.8 : 1,
      bg: '#23262b',
    }, '*');
  }, [vrmDescriptor]);
  useEffect(() => {
    if (vrmAlive === 'ready') postVisual();
  }, [postVisual, vrmAlive]);
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data || {};
      if (data.type === 'portrait-ready') setVrmAlive(alive => (alive === 'pending' ? 'ready' : alive));
      else if (data.type === 'portrait-error') setVrmAlive('failed');
    };
    const onSpeech = (event: Event) => {
      const detail = (event as CustomEvent).detail || {};
      iframeRef.current?.contentWindow?.postMessage({ type: 'speech', audio: String(detail.path || '') }, '*');
    };
    window.addEventListener('message', onMessage);
    window.addEventListener('vrm-portrait-speech', onSpeech);
    return () => {
      window.removeEventListener('message', onMessage);
      window.removeEventListener('vrm-portrait-speech', onSpeech);
    };
  }, []);
  const vrmUrl = vrmSlug ? vrmPortraitUrl(vrmSlug, wardrobeFor((state?.contexts || []).concat(contexts).map(c => ({ actionId: c.actionId || c.id })))) : null;
  const handleIframeLoad = () => {
    if (vrmAlive === 'failed') return;
    postVisual();
    window.setTimeout(() => setVrmAlive(alive => (alive === 'pending' ? 'failed' : alive)), 3500);
  };

  if (!source) return <b className={className}>{name.slice(0, 1).toUpperCase()}</b>;
  const fallbackImage = <img
    className={['character-portrait-image', className].filter(Boolean).join(' ')}
    src={source}
    alt={name}
    onError={() => {
      // Retry the same authoritative source once before advancing; a sleeping
      // character has no awake fallback, so a single transient failure must not
      // strand it on the initial-letter placeholder.
      setSourceIndex(index => (index + 1 < sources.length ? index + 1 : index));
    }}
  />;
  if (!vrmUrl || vrmAlive === 'failed' || sleeping) return fallbackImage;
  return (
    <span className={['character-portrait-vrm-wrap', className].filter(Boolean).join(' ')} style={{ position: 'relative', display: 'inline-block' }}>
      {fallbackImage}
      <iframe
        ref={iframeRef}
        src={vrmUrl}
        title={`VRM · ${name}`}
        onLoad={handleIframeLoad}
        style={{
          position: 'absolute', inset: 0, width: '100%', height: '100%',
          border: 'none', background: 'transparent', zIndex: 1, pointerEvents: 'none',
        }}
      />
    </span>
  );
}
