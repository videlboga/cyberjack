const targetGroups: Record<string, string[]> = {
    head: ['head', 'hair', 'face', 'lips', 'neck'],
    torso: ['shoulders', 'chest', 'nipples', 'belly', 'back', 'waist'],
    limbs: ['arms', 'hands', 'inner_thighs', 'legs', 'knees', 'feet'],
    intimate: ['buttocks', 'anus', 'groin', 'penis', 'testicles', 'prostate', 'vulva', 'vagina', 'clitoris']
};

export function expandActionTargets(targets?: string[] | null): string[] {
    if (!targets?.length) return [];
    return Array.from(new Set(targets.flatMap(target => targetGroups[target] || [target])));
}

export function isActionTargetAllowed(targets: string[] | null | undefined, pointId: string): boolean {
    if (!targets?.length) return true;
    return expandActionTargets(targets).includes(pointId);
}
