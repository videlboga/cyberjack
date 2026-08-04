import React, { useEffect, useState } from 'react';
import { buildCalibrationVisualDescriptorV4, resolveCalibrationAvatarV4 } from '../domain/characterVisuals';

type PortraitContext = { id?: string; actionId?: string };
type PortraitState = {
  tension?: number;
  attitude?: number;
  openness?: number;
  behavioralState?: string;
  transitions?: Array<{ kind?: string; title?: string }>;
};

const contextIds = (contexts: PortraitContext[] = []) => new Set(
  contexts.map(context => context.actionId || context.id).filter(Boolean),
);

const wardrobeFor = (contexts: PortraitContext[] = []) => {
  const ids = contextIds(contexts);
  if (ids.has('eq_clothe_dress') && ids.has('eq_clothe_stockings')) return 'dress_stockings';
  if (ids.has('eq_clothe_dress')) return 'dress';
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

export const canonicalCharacterPortrait = (
  id?: string | null,
  name?: string | null,
  contexts: PortraitContext[] = [],
  state?: PortraitState | null,
): string | null => {
  const wardrobe = wardrobeFor(contexts);
  const slug = id === 'S-AV-01' ? 'mira'
    : id === 'NPC-LAB-01' ? 'iona'
      : id === 'NPC-CAND-01' ? 'nika'
        : id === 'NPC-CAND-SUMI' ? 'sumi'
          : id === 'NPC-CAND-GEN-02' ? 'eli'
            : id === 'NPC-CAND-GEN-04' ? 'mai'
              : null;
  if (slug && id) {
    const visualContexts = contexts
      .map(context => context.actionId || context.id)
      .filter((actionId): actionId is string => Boolean(actionId))
      .map(actionId => ({ actionId }));
    const climax = (state?.transitions || []).some(transition =>
      /discharge|climax|разряд/i.test(`${transition.kind || ''} ${transition.title || ''}`)
    );
    const descriptor = buildCalibrationVisualDescriptorV4(id, {
      contexts: visualContexts,
      tension: state?.tension,
      attitude: state?.attitude,
      openness: state?.openness,
    }, state?.behavioralState, climax);
    return resolveCalibrationAvatarV4(descriptor)
      || `/character-images/rendered/${slug}/${poseFor(contexts)}__${wardrobe}__none__neutral.png`;
  }
  const normalizedName = String(name || '').trim().toLowerCase();
  return legacyPortraits[normalizedName] || null;
};

export function CharacterPortrait({
  id, name, portrait, contexts = [], state, className,
}: {
  id?: string | null;
  name: string;
  portrait?: string | null;
  contexts?: PortraitContext[];
  state?: PortraitState | null;
  className?: string;
}) {
  const canonical = canonicalCharacterPortrait(id, name, contexts, state);
  // The authored `portrait` is a stable identity fallback. The canonical
  // visual reflects the character's actual pose, clothing, restraints and
  // affect, so it must be attempted first whenever the matrix covers it.
  const sources = Array.from(new Set([canonical, portrait].filter(Boolean))) as string[];
  const [sourceIndex, setSourceIndex] = useState(0);
  useEffect(() => setSourceIndex(0), [id, name, portrait, canonical]);
  const source = sources[sourceIndex];
  if (!source) return <b className={className}>{name.slice(0, 1).toUpperCase()}</b>;
  return <img
    className={['character-portrait-image', className].filter(Boolean).join(' ')}
    src={source}
    alt={name}
    onError={() => setSourceIndex(index => index + 1)}
  />;
}
