import { compactMemoryReaction } from './memoryLayer';
import { InteractionObservation } from '../domain/types';
import { resolvePortraitEmotion } from '../domain/portraitEmotion';

export interface EpisodeMemoryAtom {
    id: number;
    text: string;
    tags: string[];
    relatedSubjects: string[];
    metadata: Record<string, any>;
}

export interface MemoryEpisodeMoment {
    id: number;
    title: string;
    text: string;
    worldMinute: number | string | null;
    actorName?: string;
    sceneId?: string;
    actionId?: string;
    participantIds?: string[];
    portraitEmotion?: string;
}

export interface MemoryEpisode {
    /** The latest atom is the stable selection handle used by the chair. */
    id: number;
    title: string;
    text: string;
    tags: string[];
    relatedSubjectIds: string[];
    worldMinute: number | string | null;
    atomCount: number;
    moments: MemoryEpisodeMoment[];
}

type MemoryScene = {
    atoms: EpisodeMemoryAtom[];
    kind: 'lived' | 'observed' | 'conversation' | 'correction';
    container: string;
    participants: string[];
};

const clean = (value: unknown) => String(value || '').replace(/\s+/g, ' ').trim();
const clipped = (value: unknown, limit: number) => {
    const text = clean(value);
    return text.length > limit ? `${text.slice(0, limit - 1).trimEnd()}…` : text;
};
const distinct = <T,>(values: T[]) => [...new Set(values)];

function observationFor(atom: EpisodeMemoryAtom): InteractionObservation | null {
    return atom.metadata?.observation || null;
}

function portraitEmotionFor(atom: EpisodeMemoryAtom) {
    const observation: any = observationFor(atom) || {};
    return resolvePortraitEmotion({
        speech: atom.metadata?.characterSpeech,
        behavioralState: observation.behavioralState,
        reaction: observation.reaction,
        transitions: observation.transitions,
        state: observation.state || observation.reactionSnapshot?.state,
    });
}

function containerFor(atom: EpisodeMemoryAtom) {
    return clean(atom.metadata?.objectiveFacts?.container);
}

function kindFor(atom: EpisodeMemoryAtom): MemoryScene['kind'] {
    if (atom.metadata?.mentalCorrection) return 'correction';
    if (atom.metadata?.observed) return 'observed';
    if (atom.metadata?.socialTransaction) return 'conversation';
    return 'lived';
}

function participantsFor(atom: EpisodeMemoryAtom) {
    const metadata = atom.metadata || {};
    return distinct([
        ...atom.relatedSubjects,
        metadata.actorId,
        metadata.targetId,
    ].filter(Boolean).map(String)).sort();
}

function sameParticipants(left: MemoryScene, right: EpisodeMemoryAtom) {
    const participants = participantsFor(right);
    return left.participants.length === participants.length && left.participants.every((id, index) => id === participants[index]);
}

function hasMajorTransition(atom: EpisodeMemoryAtom) {
    const transitions = observationFor(atom)?.transitions || [];
    return transitions.some((transition: any) => ['discharge', 'breakdown', 'overload'].includes(transition.kind));
}

function hasUnresolvedBuildUp(scene: MemoryScene) {
    return scene.atoms.some(atom => {
        const observation = observationFor(atom);
        const environment = clean(atom.metadata?.objectiveFacts?.environment).toLowerCase();
        const arousal = Number((observation as any)?.reactionSnapshot?.affect?.arousal || 0);
        return /удерж|обрывается|незаверш|на грани/u.test(environment) || arousal >= 70;
    });
}

function hasTransferSignal(scene: MemoryScene) {
    return scene.atoms.some(atom => /помещ|перевед|капсул|перенес|перемещ/u.test([
        atom.metadata?.playerSpeech,
        atom.metadata?.characterSpeech,
        atom.text,
    ].map(clean).join(' ')));
}

function scenesContinueArc(left: MemoryScene, right: MemoryScene) {
    const gap = right.atoms[0].id - left.atoms.at(-1)!.id;
    if (gap > 12 || left.kind !== 'lived' || right.kind !== 'lived') return false;
    if (left.participants.length !== right.participants.length || !left.participants.every((id, index) => id === right.participants[index])) return false;
    if (left.container === right.container) return true;
    if (hasTransferSignal(left) || hasTransferSignal(right)) return true;
    return right.atoms.some(hasMajorTransition) && hasUnresolvedBuildUp(left);
}

function actionLabel(atom: EpisodeMemoryAtom) {
    return clean(observationFor(atom)?.action?.label || atom.metadata?.actionLabel || atom.metadata?.actionId || 'событие');
}

function displayAtomText(atom: EpisodeMemoryAtom) {
    const observation = observationFor(atom);
    const action = observation?.action;
    const parts: string[] = [];
    const actorName = clean(atom.metadata?.actorName || atom.metadata?.actorId || 'кто-то');
    if (atom.metadata?.observed) {
        const target = clean(atom.metadata.targetName || atom.metadata.targetId || 'другой персонаж');
        parts.push(`${actorName} ${actionLabel(atom).toLowerCase()} в отношении ${target}.`);
    } else if (action?.description) {
        parts.push(clipped(action.description, 300)
            .replace(/в рот персонажа/giu, 'мне в рот')
            .replace(/персонажу/giu, 'мне')
            .replace(/персонажа/giu, 'меня'));
    } else {
        parts.push(clipped(atom.text, 300));
    }
    const reaction = clean(atom.metadata?.memoryReaction) || compactMemoryReaction(observation);
    if (reaction) parts.push(reaction);
    if (atom.metadata?.playerSpeech) parts.push(`${atom.metadata?.observed ? actorName : 'Калибратор'} сказал: «${clipped(atom.metadata.playerSpeech, 160)}».`);
    if (atom.metadata?.characterSpeech) parts.push(atom.metadata?.observed
        ? `В ответ от ${clean(atom.metadata.targetName || atom.metadata.targetId || 'собеседника')}: «${clipped(atom.metadata.characterSpeech, 160)}».`
        : `Я ответила: «${clipped(atom.metadata.characterSpeech, 160)}».`);
    if (atom.metadata?.observedOutcome) parts.push(`Затем: ${clipped(atom.metadata.observedOutcome, 180)}.`);
    return parts.join(' ');
}

function displayContainer(container: string) {
    const normalized = container.toLowerCase();
    if (normalized.includes('секс-машин')) return 'в модуле секс-машины';
    if (normalized.includes('капсул')) return 'в восстановительной капсуле';
    if (normalized.includes('диагностическ') && normalized.includes('стол')) return 'на диагностическом столе';
    return container ? `в ${container.toLowerCase()}` : 'в этой сцене';
}

function momentsWord(count: number) {
    const suffix = count % 10 === 1 && count % 100 !== 11 ? 'момент'
        : count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 12 || count % 100 > 14) ? 'момента'
            : 'моментов';
    return `${count} ${suffix}`;
}

function countedWord(count: number, one: string, few: string, many: string) {
    const suffix = count % 10 === 1 && count % 100 !== 11 ? one
        : count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 12 || count % 100 > 14) ? few
            : many;
    return `${count} ${suffix}`;
}

function sceneTitle(scene: MemoryScene, resolveSubjectName: (id: string) => string) {
    const first = scene.atoms[0];
    if (scene.kind === 'observed') {
        return `Наблюдение: ${clean(first.metadata.targetName || resolveSubjectName(first.metadata.targetId) || first.metadata.targetId || 'сцена')}`;
    }
    if (scene.kind === 'conversation') {
        const other = first.relatedSubjects[0];
        return `Диалог: ${clean(first.metadata.relatedSubjectName || resolveSubjectName(other) || other || 'собеседник')}`;
    }
    if (scene.kind === 'correction') return 'Сеанс коррекции памяти';
    if (/секс-машин/u.test(scene.container)) return 'Удержание в модуле секс-машины';
    if (/капсул/u.test(scene.container)) return 'Восстановление в капсуле';
    if (scene.container) return `Сцена: ${scene.container}`;
    return `Эпизод: ${actionLabel(first)}`;
}

function sceneSummary(scene: MemoryScene) {
    const labels = scene.atoms.map(actionLabel);
    const counts = [...new Map(labels.map(label => [label, labels.filter(item => item === label).length] as const))]
        .map(([label, count]) => count > 1 ? `${count} × ${label.toLowerCase()}` : label.toLowerCase());
    const outcome = scene.atoms.flatMap(atom => observationFor(atom)?.transitions || [])
        .find((transition: any) => ['discharge', 'breakdown', 'overload'].includes(transition.kind));
    const lastSpeech = [...scene.atoms].reverse().find(atom => clean(atom.metadata.characterSpeech));
    const intro = scene.kind === 'correction'
        ? `В кресле коррекции памяти произошёл ${momentsWord(scene.atoms.length)}.`
        : scene.kind === 'observed'
        ? `Персонаж наблюдал ${momentsWord(scene.atoms.length)}: ${counts.slice(0, 4).join(', ')}.`
        : scene.kind === 'conversation'
            ? `В разговоре прозвучало ${countedWord(scene.atoms.length, 'реплика', 'реплики', 'реплик')}.`
            : `${displayContainer(scene.container).replace(/^в/u, 'В')} произошло ${momentsWord(scene.atoms.length)}: ${counts.slice(0, 4).join(', ')}.`;
    return [
        intro,
        outcome ? `Финал сцены: ${clean((outcome as any).title || (outcome as any).text)}.` : '',
        lastSpeech ? `Последняя реплика: «${clipped(lastSpeech.metadata.characterSpeech, 180)}».` : '',
    ].filter(Boolean).join(' ');
}

function makeEpisode(scenes: MemoryScene[], resolveSubjectName: (id: string) => string): MemoryEpisode {
    const atoms = scenes.flatMap(scene => scene.atoms);
    const last = atoms.at(-1)!;
    const tags = distinct(atoms.flatMap(atom => atom.tags));
    const relatedSubjectIds = distinct(atoms.flatMap(atom => participantsFor(atom)));
    const crossSceneOutcome = scenes.length > 1
        ? 'Последующая сцена продолжила накопленное состояние и завершилась заметным переходом.'
        : '';
    return {
        id: last.id,
        title: scenes.length > 1 ? `${sceneTitle(scenes[0], resolveSubjectName)} → ${sceneTitle(scenes.at(-1)!, resolveSubjectName)}` : sceneTitle(scenes[0], resolveSubjectName),
        text: [...scenes.map(sceneSummary), crossSceneOutcome].filter(Boolean).join(' '),
        tags,
        relatedSubjectIds,
        worldMinute: last.metadata?.worldMinute || last.metadata?.timestamp || null,
        atomCount: atoms.length,
        moments: atoms.map(atom => ({
            id: atom.id,
            title: actionLabel(atom),
            text: displayAtomText(atom),
            worldMinute: atom.metadata?.worldMinute || atom.metadata?.timestamp || null,
            actorName: atom.metadata?.observed ? clean(atom.metadata?.actorName || atom.metadata?.actorId || 'кто-то') : undefined,
            sceneId: clean(atom.metadata?.sceneId),
            actionId: clean(atom.metadata?.actionId || observationFor(atom)?.action?.id),
            participantIds: participantsFor(atom),
            portraitEmotion: portraitEmotionFor(atom),
        })),
    };
}

/**
 * Turns raw memory atoms into deterministic scenes and short causal arcs.
 * Atoms are retained intact; the latest atom id is the episode's selection id.
 */
export function aggregateMemoryEpisodes(records: EpisodeMemoryAtom[], limit = 12, resolveSubjectName = (id: string) => id): MemoryEpisode[] {
    const ordered = [...records].sort((a, b) => a.id - b.id);
    const scenes: MemoryScene[] = [];
    for (const atom of ordered) {
        const previous = scenes.at(-1);
        const kind = kindFor(atom);
        const container = containerFor(atom);
        const continues = previous
            && previous.kind === kind
            && sameParticipants(previous, atom)
            // A gap is a boundary for speech and observation: those memories
            // have their own conversational/event cadence. It is deliberately
            // not one for lived memory in the same container: another
            // character may act for a long time while this subject remains in
            // the capsule or device, and legacy data has no separate "still
            // placed here" atom.
            && (kind === 'lived' || atom.id - previous.atoms.at(-1)!.id <= 12)
            && (kind !== 'lived' || previous.container === container);
        if (continues) {
            previous.atoms.push(atom);
        } else {
            scenes.push({ atoms: [atom], kind, container, participants: participantsFor(atom) });
        }
    }

    const arcs: MemoryScene[][] = [];
    let latestLivedArc: MemoryScene[] | null = null;
    for (const scene of scenes) {
        if (scene.kind === 'lived' && latestLivedArc && scenesContinueArc(latestLivedArc.at(-1)!, scene)) {
            latestLivedArc.push(scene);
            continue;
        }
        const arc = [scene];
        arcs.push(arc);
        if (scene.kind === 'lived') latestLivedArc = arc;
    }
    return arcs.map(arc => makeEpisode(arc, resolveSubjectName)).sort((a, b) => b.id - a.id).slice(0, limit);
}
