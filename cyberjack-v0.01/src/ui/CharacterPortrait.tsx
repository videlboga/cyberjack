import React, { useEffect, useState } from 'react';
import { buildCalibrationVisualDescriptorV4, resolveCalibrationAvatarV4 } from '../domain/characterVisuals';

type PortraitContext = { id?: string; actionId?: string };

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

export const canonicalCharacterPortrait = (id?: string | null, name?: string | null, contexts: PortraitContext[] = []): string | null => {
  const wardrobe = wardrobeFor(contexts);
  const slug = id === 'S-AV-01' ? 'mira' : id === 'NPC-LAB-01' ? 'iona' : id === 'NPC-CAND-01' ? 'nika' : null;
  if (slug && id) {
    const visualContexts = contexts
      .map(context => context.actionId || context.id)
      .filter((actionId): actionId is string => Boolean(actionId))
      .map(actionId => ({ actionId }));
    const descriptor = buildCalibrationVisualDescriptorV4(id, { contexts: visualContexts });
    return resolveCalibrationAvatarV4(descriptor)
      || `/character-images/rendered/${slug}/${poseFor(contexts)}__${wardrobe}__none__neutral.png`;
  }
  const normalizedName = String(name || '').trim().toLowerCase();
  return legacyPortraits[normalizedName] || null;
};

export function CharacterPortrait({
  id, name, portrait, contexts = [], className,
}: {
  id?: string | null;
  name: string;
  portrait?: string | null;
  contexts?: PortraitContext[];
  className?: string;
}) {
  const canonical = canonicalCharacterPortrait(id, name, contexts);
  const sources = Array.from(new Set([portrait, canonical].filter(Boolean))) as string[];
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
