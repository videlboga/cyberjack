export const CYBERJACK_UI_SOURCE = 'cyberjack' as const;

export type CyberjackBridgeHoverMessage = {
  source: typeof CYBERJACK_UI_SOURCE;
  type: 'hover';
  subjectId: string;
  partId: string;
  x: number;
  y: number;
};

export type CyberjackBridgeRadialMessage = {
  source: typeof CYBERJACK_UI_SOURCE;
  type: 'radial' | 'click';
  subjectId: string;
  partId: string;
  x: number;
  y: number;
};

export type CyberjackBridgeHideHoverMessage = {
  source: typeof CYBERJACK_UI_SOURCE;
  type: 'hideHover';
};

export type CyberjackBridgeHideRadialMessage = {
  source: typeof CYBERJACK_UI_SOURCE;
  type: 'hideRadial';
  x?: number;
  y?: number;
};

export type CyberjackBridgeFocusSubjectMessage = {
  source: typeof CYBERJACK_UI_SOURCE;
  type: 'focusSubject';
  subjectId: string;
};

export type CyberjackBridgeFocusChatMessage = {
  source: typeof CYBERJACK_UI_SOURCE;
  type: 'focusChat';
};

export type CyberjackBridgeSceneBindingMessage = {
  source: typeof CYBERJACK_UI_SOURCE;
  type: 'sceneBinding';
  sceneId: string;
  playerId: string;
  subjectId: string;
  playerName?: string;
  subjectName?: string;
};

export type CyberjackBridgeMessage =
  | CyberjackBridgeHoverMessage
  | CyberjackBridgeRadialMessage
  | CyberjackBridgeHideHoverMessage
  | CyberjackBridgeHideRadialMessage
  | CyberjackBridgeFocusSubjectMessage
  | CyberjackBridgeFocusChatMessage
  | CyberjackBridgeSceneBindingMessage;

export type CyberjackUiApi = {
  showHoverInfo: (subjectId: string, partId: string, normX: number, normY: number) => void;
  hideHoverInfo: () => void;
  updateSpeechBubblePosition: (actorId: string, normX: number, normY: number) => void;
  showRadialMenu: (subjectId: string, partId: string, normX: number, normY: number) => void;
  hideRadialMenu: (normX: number, normY: number) => void;
  focusSubject?: (subjectId: string) => void;
  focusChat?: () => void;
};

export function isCyberjackBridgeMessage(value: unknown): value is CyberjackBridgeMessage {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<CyberjackBridgeMessage> & { source?: unknown; type?: unknown };
  if (data.source !== CYBERJACK_UI_SOURCE) return false;
  return typeof data.type === 'string';
}

export function isPointerPosition(value: unknown): value is { x: number; y: number } {
  return !!value && typeof value === 'object' &&
    typeof (value as any).x === 'number' &&
    typeof (value as any).y === 'number';
}

export function normalizeCyberjackPointerPosition(
  x: number,
  y: number,
  viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1,
  viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 1
) {
  const looksNormalized = x >= 0 && x <= 1 && y >= 0 && y <= 1;
  if (looksNormalized) {
    return { x, y };
  }

  return {
    x: viewportWidth > 0 ? x / viewportWidth : 0,
    y: viewportHeight > 0 ? y / viewportHeight : 0
  };
}

export function createCyberjackUiApi(api: CyberjackUiApi) {
  if (typeof window === 'undefined') return api;
  (window as any).CyberjackUI = api;
  return api;
}

export function destroyCyberjackUiApi() {
  if (typeof window === 'undefined') return;
  if ((window as any).CyberjackUI) {
    delete (window as any).CyberjackUI;
  }
}

export function postCyberjackMessage(message: CyberjackBridgeMessage) {
  if (typeof window === 'undefined') return;
  window.postMessage(message, '*');
}
