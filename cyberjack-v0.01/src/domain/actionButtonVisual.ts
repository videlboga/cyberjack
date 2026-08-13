import actionPointAssets from '../infrastructure/data/visual/action-point-assets.generated.json';

export type ActionButtonGroup = 'contact' | 'intimate' | 'pose' | 'equipment' | 'clothing';

const groupFolders: Record<ActionButtonGroup, string> = {
  contact: 'contact',
  intimate: 'intimacy',
  pose: 'poses',
  equipment: 'equipment',
  clothing: 'clothing',
};

/** Canonical action illustrations for the oral control family. */
const oralActionImage = (actionId: string): string | null => {
  if (actionId === 'act_start_oral_giving') {
    return '/character-images/actions-by-point/oral/blowjob.png';
  }
  if (actionId === 'act_deepen_oral') {
    return '/character-images/actions-by-point/oral/deep_blowjob.png';
  }
  return null;
};

/** True only when this exact body-point/action pair has authored artwork. */
export function hasActionPointImage(actionId: string, pointId?: string | null): boolean {
  if (!pointId) return false;
  const visualId = actionId === 'breath_blow' ? 'feather_stroke' : actionId;
  return Boolean((actionPointAssets as Record<string, string>)[`${pointId}/${visualId}`]);
}

export function resolveActionButtonImage(
  actionId: string,
  group: ActionButtonGroup,
  pointId?: string | null,
  characterSlug?: string | null,
): string {
  const oralImage = oralActionImage(actionId);
  if (oralImage) return oralImage;
  const visualId = actionId === 'breath_blow' ? 'feather_stroke' : actionId;
  const pointAsset = pointId
    ? (actionPointAssets as Record<string, string>)[`${pointId}/${visualId}`]
    : undefined;

  return pointAsset
    || `/character-images/actions/${groupFolders[group]}/${visualId}.png`;
}
