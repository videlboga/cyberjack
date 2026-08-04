import actionPointAssets from '../infrastructure/data/visual/action-point-assets.generated.json';

export type ActionButtonGroup = 'contact' | 'intimate' | 'pose' | 'equipment' | 'clothing';

const groupFolders: Record<ActionButtonGroup, string> = {
  contact: 'contact',
  intimate: 'intimacy',
  pose: 'poses',
  equipment: 'equipment',
  clothing: 'clothing',
};

export function resolveActionButtonImage(
  actionId: string,
  group: ActionButtonGroup,
  pointId?: string | null,
): string {
  const visualId = actionId === 'breath_blow' ? 'feather_stroke' : actionId;
  const pointAsset = pointId
    ? (actionPointAssets as Record<string, string>)[`${pointId}/${visualId}`]
    : undefined;

  return pointAsset
    || `/character-images/actions/${groupFolders[group]}/${visualId}.png`;
}
