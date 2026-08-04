export type CommandIntent =
  | { type: "change_pose"; targetPoseId: string }
  | { type: "activate_context"; targetContextId: string }
  | { type: "deactivate_context"; targetContextId: string }
  | { type: "deactivate_contexts"; targetContextIds: string[] }
  | { type: "move"; targetLocation: string }
  | { type: "change_current_interaction"; goal: "stop" | "start" | "adjust"; suggestedActionId?: string; targetId?: string; pointId?: string }
  | { type: "perform_action"; actionId: string; targetId?: string; pointId?: string }
  | { type: "perform_described_action"; description: string; matchedActionId: string | null; targetId?: string; pointId?: string; requiredItem?: string; refusal?: string; modifiers?: { intensity?: number; valence?: number; contact?: number; sharpness?: number; novelty?: number } }
  | { type: "none" };

export type ResolvedFunctions = {
  availableFunctions: string[];
  blockedFunctions: Record<string, string[]>;
};

export function resolveInteractionActionCandidate(input: {
  presets: any[];
  activeContextIds: string[];
  goal: "stop" | "start" | "adjust";
  suggestedActionId?: string;
  pointId?: string;
}) {
  const activeIds = new Set(input.activeContextIds);
  const suggested = input.presets.find(preset => preset.id === input.suggestedActionId);
  const suggestedTags = new Set(suggested?.tags || []);
  return input.presets
    .filter(preset => {
      const required: string[] = preset.requireContexts || [];
      const removed: string[] = preset.removeContexts || [];
      const requirementsMet = required.every(contextId => activeIds.has(contextId));
      if (!requirementsMet) return false;
      if (input.goal === 'stop') {
        return required.length > 0 && removed.some(contextId => activeIds.has(contextId));
      }
      if (input.goal === 'adjust') {
        return required.length > 0 && (
          preset.contextConfig?.type === 'interaction_level'
          || /adjust|increase|decrease|усил|ослаб/i.test(`${preset.id} ${preset.label || preset.name || ''}`)
        );
      }
      return Boolean(preset.contextConfig) && !activeIds.has(preset.id);
    })
    .map(preset => {
      const sharedTags = (preset.tags || []).filter((tag: string) => suggestedTags.has(tag)).length;
      const pointMatch = input.pointId && (preset.validTargets || []).includes(input.pointId) ? 1 : 0;
      const exact = preset.id === input.suggestedActionId ? 1 : 0;
      return { preset, score: exact * 100 + pointMatch * 10 + sharedTags };
    })
    .sort((left, right) => right.score - left.score)[0]?.preset;
}

export const resolveStopActionCandidate = (input: Omit<Parameters<typeof resolveInteractionActionCandidate>[0], 'goal'>) =>
  resolveInteractionActionCandidate({ ...input, goal: 'stop' });

export function resolveAvailableFunctions(input: {
  anatomyPoints: any[];
  activeContexts: any[];
}): ResolvedFunctions {
  const { anatomyPoints, activeContexts } = input;
  const availableSet = new Set<string>();
  const blockedFunctions: Record<string, string[]> = {};

  for (const point of anatomyPoints) {
    if (point.providesFunctions) {
      for (const fn of point.providesFunctions) {
        availableSet.add(fn);
      }
    }
  }

  const sortedContexts = [...activeContexts].filter(c => c.contextConfig).sort((a, b) => (b.contextConfig?.priority || 0) - (a.contextConfig?.priority || 0));

  for (const ctx of sortedContexts) {
    const config = ctx.contextConfig;
    if (config?.blockedFunctions) {
      for (const fn of config.blockedFunctions) {
        if (availableSet.has(fn)) {
          availableSet.delete(fn);
        }
        if (!blockedFunctions[fn]) {
          blockedFunctions[fn] = [];
        }
        blockedFunctions[fn].push(ctx.label || ctx.id);
      }
    }
  }

  return {
    availableFunctions: Array.from(availableSet),
    blockedFunctions
  };
}

export function canExecuteCommand(input: {
  commandIntent: CommandIntent;
  contextPresets: any[];
  resolvedFunctions: ResolvedFunctions;
}): { allowed: boolean; blockedReasons: string[] } {
  const { commandIntent, contextPresets, resolvedFunctions } = input;

  if (commandIntent.type === 'none') {
    return { allowed: true, blockedReasons: [] };
  }

  let targetCtxId: string | undefined;

  if (commandIntent.type === 'change_pose') {
    targetCtxId = commandIntent.targetPoseId;
  } else if (commandIntent.type === 'activate_context') {
    targetCtxId = commandIntent.targetContextId;
  }

  if (!targetCtxId) return { allowed: true, blockedReasons: [] };

  const preset = contextPresets.find(c => c.id === targetCtxId);
  if (!preset) {
    return { allowed: false, blockedReasons: [`Целевой контекст не найден (${targetCtxId})`] };
  }

  const reqFns = preset.contextConfig?.requiredFunctions || [];
  const blockedReasons: string[] = [];
  let allowed = true;

  for (const fn of reqFns) {
    if (!resolvedFunctions.availableFunctions.includes(fn)) {
      allowed = false;
      const blockers = resolvedFunctions.blockedFunctions[fn] || ['неизвестная причина'];
      blockedReasons.push(`Функция ${fn} недоступна из-за: ${blockers.join(', ')}`);
    }
  }

  return { allowed, blockedReasons };
}
