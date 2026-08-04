import type { GeneratedProfileV2 } from '../orchestration/characterGenerator/types';

// These are starting dispositions expressed through the same semantic
// preference system that later conditioning develops. They are not permanent
// flags: lived experience can reinforce, weaken or reverse them.
export const CHARACTER_STARTING_TRAIT_TAGS: Record<string, Record<string, number>> = {
    // Май: an established but not maximal masochistic disposition (level 2).
    'NPC-CAND-GEN-04': { pain: 3.5, impact: 3.5 },
    // Мира already seeks safety through compliance; this is only a mild
    // starting tendency, not consent and not irreversible submission.
    'S-AV-01': { control: 2.2, command: 2.2, submission: 2.2 },
    // Мара grew up repairing station machinery and finds mechanisms familiar.
    'NPC-CAND-GEN-03': { electronic: 2.0, machine: 2.0 },
};

export function applyCharacterStartingTraits(profile: GeneratedProfileV2): GeneratedProfileV2 {
    const starting = CHARACTER_STARTING_TRAIT_TAGS[profile.subjectId];
    if (!starting) return profile;
    return {
        ...profile,
        mechanicalSeed: {
            ...profile.mechanicalSeed,
            preferences: {
                ...profile.mechanicalSeed.preferences,
                tags: {
                    ...starting,
                    ...(profile.mechanicalSeed.preferences?.tags || {}),
                },
            },
        },
    };
}

