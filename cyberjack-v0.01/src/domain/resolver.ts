export type CommandIntent =
  | { type: "change_pose"; targetPoseId: string }
  | { type: "activate_context"; targetContextId: string }
  | { type: "deactivate_context"; targetContextId: string }
  | { type: "none" };

export type ResolvedFunctions = {
  availableFunctions: string[];
  blockedFunctions: Record<string, string[]>;
};

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

  const sortedContexts = [...activeContexts].sort((a, b) => (b.priority || 0) - (a.priority || 0));

  for (const ctx of sortedContexts) {
    if (ctx.blockedFunctions) {
      for (const fn of ctx.blockedFunctions) {
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

  const reqFns = preset.requiredFunctions || [];
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
