import { parseVerbalInputWithLLM } from '../adapters/llmAdapter';
import { characterRepo, memoryAssociationRepo, subjectiveAssociationRepo, subjectiveEpisodeRepo } from '../infrastructure/repositories';
import { db } from '../infrastructure/db';
import { MemoryEpisode } from './memoryEpisodes';
import { memoryTagLabel } from '../domain/memoryTagLabels';

const pending = new Set<string>();
const clean = (value: unknown, limit = 600) => String(value || '').replace(/\s+/g, ' ').trim().slice(0, limit);
const keyFor = (episode: MemoryEpisode) => `${episode.id}:${episode.moments.map(moment => moment.id).join(',')}`;
const allowedExpectation = new Set(['seek', 'avoid', 'freeze', 'endure', 'anticipate']);

export type SubjectiveEpisode = {
    title: string;
    summary: string;
    appraisal: string;
    agency: 'wanted' | 'mixed' | 'endured' | 'resisted' | 'lost_control';
    emotionalArc: string[];
    associations: Array<{ target: string; tagLinks: string[]; evidence: string[]; valence: number; strength: number; expectation: 'seek' | 'avoid' | 'freeze' | 'endure' | 'anticipate' }>;
    openLoops: string[];
};

export type SubjectiveInterventionResult = {
    affected: number;
    operation: string;
    changes: Array<{
        target: string;
        before: { valence: number; strength: number; expectation: SubjectiveEpisode['associations'][number]['expectation'] };
        after: { valence: number; strength: number; expectation: SubjectiveEpisode['associations'][number]['expectation'] };
    }>;
};

function syncAssociationEffects(subjectId: string, episode: MemoryEpisode, summary: SubjectiveEpisode) {
    // A tag affects future choices only through associations that actually
    // name it. An episode-wide average made unrelated facets of one memory
    // receive exactly the same learned meaning.
    const effects = episode.tags.filter(tag => /^[a-z0-9_-]+$/i.test(tag)).flatMap(tag => {
        const linked = summary.associations.filter(item => item.tagLinks.includes(tag));
        if (!linked.length) return [];
        const signal = linked.reduce((sum, item) => sum + item.valence * item.strength, 0) / linked.length;
        const expectation = linked.slice().sort((a, b) => b.strength - a.strength)[0]!.expectation;
        return [{ tag, weight: Math.max(-.45, Math.min(.45, signal * .35)), expectation }];
    });
    memoryAssociationRepo.replaceSource(subjectId, keyFor(episode), effects);
    const characters = characterRepo.listAll();
    subjectiveAssociationRepo.replaceSource(subjectId, keyFor(episode), summary.associations.map(item => {
        const person = characters.find(character => character.name.toLowerCase() === item.target.toLowerCase());
        const links = Array.isArray(item.tagLinks) && item.tagLinks.length ? item.tagLinks : episode.tags;
        return { type: person ? 'person' : 'concept', key: person ? person.subjectId || person.id : item.target.toLowerCase(), label: item.target, tagLinks: links.filter(tag => episode.tags.includes(tag)), valence: item.valence, strength: item.strength, expectation: item.expectation };
    }));
}

function usesSeminalFact(episode: MemoryEpisode) {
    return /семенн|сперм/iu.test([episode.text, ...episode.moments.map(moment => moment.text)].join(' '));
}

function useConcreteTerms(summary: SubjectiveEpisode, episode: MemoryEpisode) {
    if (usesSeminalFact(episode)) {
        summary.summary = summary.summary.replace(/биоматериал(?:а|ом|у|е)?/giu, 'спермы');
        summary.appraisal = summary.appraisal.replace(/биоматериал(?:а|ом|у|е)?/giu, 'спермы');
        if (!/семенн|сперм/iu.test(summary.summary)) {
            summary.summary = `Через трубку капсулы мне в рот подали порцию спермы Калибратора. ${summary.summary}`;
        }
    }
    return summary;
}

function normalize(value: any): SubjectiveEpisode | null {
    if (!value || typeof value !== 'object' || !clean(value.summary, 900)) return null;
    const agency = ['wanted', 'mixed', 'endured', 'resisted', 'lost_control'].includes(value.agency) ? value.agency : 'mixed';
    const summary = clean(value.summary, 900);
    const associations = Array.isArray(value.associations) ? value.associations.slice(0, 8).flatMap((item: any) => {
        const target = clean(item?.target, 70);
        if (!target || !allowedExpectation.has(item.expectation)) return [];
        const evidence = Array.isArray(item.evidence) ? item.evidence.map((phrase: unknown) => clean(phrase, 150)).filter((phrase: string) => phrase.length >= 3 && summary.toLocaleLowerCase().includes(phrase.toLocaleLowerCase())).slice(0, 3) : [];
        return [{ target, tagLinks: Array.isArray(item.tagLinks) ? item.tagLinks.map(String) : [], evidence, valence: Math.max(-1, Math.min(1, Number(item.valence) || 0)), strength: Math.max(0, Math.min(1, Number(item.strength) || 0)), expectation: item.expectation }];
    }) : [];
    const generatedTitle = clean(value.title, 80) || summary.replace(/[.!?].*$/u, '').split(' ').slice(0, 6).join(' ');
    return { title: generatedTitle || 'Личное воспоминание', summary, appraisal: clean(value.appraisal, 450), agency, emotionalArc: Array.isArray(value.emotionalArc) ? value.emotionalArc.map((x: unknown) => clean(x, 70)).filter(Boolean).slice(0, 5) : [], associations, openLoops: Array.isArray(value.openLoops) ? value.openLoops.map((x: unknown) => clean(x, 160)).filter(Boolean).slice(0, 4) : [] };
}

function bindAssociationsToEpisode(summary: SubjectiveEpisode, episode: MemoryEpisode): SubjectiveEpisode {
    return {
        ...summary,
        associations: summary.associations.map(item => ({
            ...item,
            tagLinks: [...new Set(item.tagLinks.filter(tag => episode.tags.includes(tag)))].slice(0, 8),
        })).filter(item => item.tagLinks.length >= 1),
    };
}

export function hasCompleteAssociationCoverage(summary: SubjectiveEpisode | null, episode: MemoryEpisode) {
    if (!summary || !episode.tags.length) return false;
    const evidenceByTag = new Map<string, string[]>();
    for (const association of summary.associations) {
        if (!association.evidence.length) continue;
        for (const tag of association.tagLinks) {
            evidenceByTag.set(tag, [...(evidenceByTag.get(tag) || []), ...association.evidence]);
        }
    }
    return episode.tags.every(tag => (evidenceByTag.get(tag) || []).length > 0);
}

export function hasAssociationLink(summary: SubjectiveEpisode | null, tags: string[]) {
    return Boolean(tags.length >= 1 && summary?.associations.some(association => tags.every(tag => association.tagLinks.includes(tag))));
}

/**
 * Этап 7. Происхождение тега и связанные фрагменты.
 *
 * Возвращает для тега его источник (ассоциация) и буквальные фрагменты
 * текста (evidence), которые его подтверждают. Это даёт UI возможность
 * показать, откуда тег взялся, и подсветить связанные фрагменты.
 */
export function fragmentsForTag(summary: SubjectiveEpisode | null, tag: string): { source: string; evidence: string[] }[] {
    if (!summary) return [];
    return summary.associations
        .filter(association => association.tagLinks.includes(tag))
        .map(association => ({
            source: association.target,
            evidence: association.evidence,
        }));
}

/** Все теги эпизода с их происхождением и связанными фрагментами. */
export function tagOrigins(summary: SubjectiveEpisode | null, episode: MemoryEpisode): Array<{ tag: string; label: string; sources: string[]; evidence: string[] }> {
    if (!summary) return [];
    return episode.tags.map(tag => {
        const fragments = fragmentsForTag(summary, tag);
        return {
            tag,
            label: memoryTagLabel(tag),
            sources: Array.from(new Set(fragments.map(fragment => fragment.source))),
            evidence: Array.from(new Set(fragments.flatMap(fragment => fragment.evidence))),
        };
    });
}

export type ManualTagLink = { target: string; tagLinks: string[]; evidence: string[]; valence: number; strength: number; expectation: SubjectiveEpisode['associations'][number]['expectation']; manual: true };

export function createManualTagLink(subjectId: string, episode: MemoryEpisode, tags: string[], label: string): ManualTagLink {
    const normalizedTags = [...new Set(tags)].sort();
    const summary = getSubjectiveEpisode(subjectId, episode);
    const generated = summary?.associations.find(association => normalizedTags.every(tag => association.tagLinks.includes(tag)));
    if (!generated) throw new Error('Пересобранный эпизод не содержит выбранную связь');
    const sourceKey = `${keyFor(episode)}:manual-link:${normalizedTags.join('|')}`;
    db.prepare(`INSERT INTO subjective_associations (subject_id,source_key,target_type,target_key,target_label,tag_links,valence,strength,expectation)
        VALUES (?, ?, 'tag_link', ?, ?, ?, ?, ?, ?)
        ON CONFLICT(subject_id,source_key,target_type,target_key) DO UPDATE SET target_label=excluded.target_label,tag_links=excluded.tag_links,valence=excluded.valence,strength=excluded.strength,expectation=excluded.expectation`)
        .run(subjectId, sourceKey, normalizedTags.join('|'), label, JSON.stringify(normalizedTags), generated.valence, generated.strength, generated.expectation);
    return { target: label, tagLinks: normalizedTags, evidence: generated.evidence, valence: generated.valence, strength: generated.strength, expectation: generated.expectation, manual: true };
}

export function removeManualTagLink(subjectId: string, episode: MemoryEpisode, tags: string[]) {
    const normalizedTags = [...new Set(tags)].sort();
    const sourceKey = `${keyFor(episode)}:manual-link:${normalizedTags.join('|')}`;
    return db.prepare(`DELETE FROM subjective_associations WHERE subject_id=? AND source_key=? AND target_type='tag_link'`).run(subjectId, sourceKey).changes;
}

export function listManualTagLinks(subjectId: string, episode: MemoryEpisode): ManualTagLink[] {
    const prefix = `${keyFor(episode)}:manual-link:%`;
    return (db.prepare(`SELECT target_label,tag_links,valence,strength,expectation FROM subjective_associations WHERE subject_id=? AND source_key LIKE ? AND target_type='tag_link'`).all(subjectId, prefix) as any[])
        .flatMap(row => {
            try {
                const tagLinks = JSON.parse(row.tag_links || '[]');
                return [{ target: String(row.target_label), tagLinks, evidence: [], valence: Number(row.valence), strength: Number(row.strength), expectation: row.expectation, manual: true }];
            } catch { return []; }
        });
}

export function getSubjectiveEpisode(subjectId: string, episode: MemoryEpisode): SubjectiveEpisode | null {
    const rawSummary = normalize(subjectiveEpisodeRepo.get(subjectId, keyFor(episode))) as SubjectiveEpisode | null;
    const summary = rawSummary ? bindAssociationsToEpisode(rawSummary, episode) : null;
    // This function is used while assembling read-only scenario snapshots.
    // Applying association effects here made opening a screen write several
    // times to SQLite, blocking the Node event loop on fsync.
    if (summary) useConcreteTerms(summary, episode);
    return summary;
}

export function queueSubjectiveEpisode(subjectId: string, characterName: string, episode: MemoryEpisode, force = false, correction = '', requiredAssociationTags: string[] = [], rejectOnFailure = false, forbiddenAssociationTags: string[] = []): Promise<void> | null {
    if (!process.env.OPENROUTER_API_KEY && !process.env.LLM_API_KEY) return null;
    const sourceKey = keyFor(episode);
    if ((!force && subjectiveEpisodeRepo.get(subjectId, sourceKey)) || pending.has(`${subjectId}:${sourceKey}`)) return null;
    const pendingKey = `${subjectId}:${sourceKey}`;
    pending.add(pendingKey);
    const facts = episode.moments.map(moment => `- ${moment.title}: ${clean(moment.text, 300)}`).join('\n').slice(0, 7500);
    const correctionBlock = correction ? `\nКОРРЕКЦИЯ ВОСПРИЯТИЯ: «${clean(correction, 500)}». Это не новый факт и не приказ персонажу. Вплети её только в личную оценку, эмоциональную дугу и связи памяти; не меняй объективные события.\n` : '';
    const concreteFactRule = usesSeminalFact(episode) ? 'В этом эпизоде обязательно прямо скажи в summary: через трубку капсулы мне в рот подали сперму Калибратора. Не заменяй это «биоматериалом», «составом» или безымянной жидкостью.\n' : '';
    const job = parseVerbalInputWithLLM([{ role: 'system', content: `Ты создаёшь эпизодическую память персонажа ${characterName}. Только JSON. Факты ниже — исчерпывающая истина. Не добавляй действий, мотивов, диагнозов, зависимости, согласия, намерений или отношений, которых в них прямо нет. Сохраняй имена точно, не меняй род и не сокращай их; внутренние id вроде PL-1 не упоминай — используй отображаемое имя из фактов. Если атом помечен как «Наблюдение», персонаж только видел и слышал чужой разговор: кратко передай его тему, важные реплики, ответ и видимый итог; никогда не пиши, что наблюдатель сделал, спросил или приказал. Если имя ${characterName} встречается как цель, это сам персонаж: используй «я/мне/меня», а не третье лицо. Пиши по-русски от первого лица, живо и связно, без канцелярита и перечня атомов. Называй секс, фиксацию, насилие, сперму, оргазм, страх и боль своими именами, если они есть в фактах. Удовольствие или оргазм не равны согласию. ${concreteFactRule}Верни {title,summary,appraisal,agency,emotionalArc,associations,openLoops}. associations: создай 2–8 конкретных ассоциаций. У каждой обязательно есть target (место, человек, действие, часть тела или голос), tagLinks — массив из 1–8 ТОЧНЫХ тегов из списка ниже, связывающих эту ассоциацию, evidence — 1–3 точных фрагмента из уже написанного summary (по 3–18 слов), которые относятся к этой ассоциации. Фрагменты в evidence должны буквально встречаться в summary, без перефразирования. valence от -1 до 1, strength от 0 до 1, expectation: seek|avoid|freeze|endure|anticipate. Покрой КАЖДЫЙ допустимый тег хотя бы одной связью: если тег описывает отдельный момент, у него должна быть своя связь с конкретным target и evidence. Не используй в tagLinks слова вне списка и не оставляй массив пустым.\n\nДОПУСТИМЫЕ ТЕГИ: ${episode.tags.join(', ')}\nАРКА: ${episode.title}\nДЕТЕРМИНИРОВАННЫЙ ИТОГ: ${episode.text}${correctionBlock}\nФАКТЫ:\n${facts}` }], { type: 'json_object' }, 'memory')
        .then(result => normalize(result.parsed))
        .then(summary => summary ? bindAssociationsToEpisode(summary, episode) : null)
        .then(summary => {
            // Background generation may wait for a complete map of an episode.
            // A deliberate chair intervention has a narrower contract: it must
            // preserve a valid subjective account and, when tags were selected,
            // include those exact anchors. Requiring full coverage here made a
            // large episode impossible to edit (the prompt caps associations).
            const isValid = summary && (requiredAssociationTags.length
                ? hasAssociationLink(summary, requiredAssociationTags)
                : forbiddenAssociationTags.length
                    ? !hasAssociationLink(summary, forbiddenAssociationTags)
                    : correction
                        ? true
                        : hasCompleteAssociationCoverage(summary, episode));
            if (isValid && summary) {
            useConcreteTerms(summary, episode);
            subjectiveEpisodeRepo.save(subjectId, sourceKey, episode.moments.map(moment => moment.id), summary);
            syncAssociationEffects(subjectId, episode, summary);
        } else if (summary) {
            throw new Error(requiredAssociationTags.length
                ? 'модель не создала требуемую ручную связь между выбранными тегами'
                : 'модель не связала каждый тег эпизода с точной цитатой');
        } })
        .catch(error => {
            console.warn('[SubjectiveMemory] generation failed:', error.message);
            if (rejectOnFailure) throw error;
        })
        .finally(() => pending.delete(pendingKey));
    return job;
}

export function regenerateSubjectiveEpisode(subjectId: string, characterName: string, episode: MemoryEpisode, correction: string, requiredAssociationTags: string[] = [], forbiddenAssociationTags: string[] = []) {
    return queueSubjectiveEpisode(subjectId, characterName, episode, true, correction, requiredAssociationTags, true, forbiddenAssociationTags);
}

export function applySubjectiveIntervention(subjectId: string, episode: MemoryEpisode, target: string, operation: string, intensity: number): SubjectiveInterventionResult {
    const raw = normalize(subjectiveEpisodeRepo.get(subjectId, keyFor(episode))) as SubjectiveEpisode | null;
    if (!raw) return { affected: 0, operation, changes: [] };
    const delta = Math.max(.02, Math.min(.22, intensity * .22));
    let affected = 0;
    const changes: SubjectiveInterventionResult['changes'] = [];
    const summary = bindAssociationsToEpisode({
        ...raw,
        associations: raw.associations.map(item => {
            if (item.target.toLocaleLowerCase() !== target.toLocaleLowerCase()) return item;
            affected++;
            const valence = operation === 'anxiety' ? Math.max(-1, item.valence - delta)
                : operation === 'reframe' ? item.valence * (1 - delta)
                    : Math.max(-1, Math.min(1, item.valence + Math.sign(item.valence || 1) * delta));
            const strength = operation === 'reframe' ? Math.max(0, item.strength - delta) : Math.min(1, item.strength + delta);
            const after = { ...item, valence, strength };
            changes.push({
                target: item.target,
                before: { valence: item.valence, strength: item.strength, expectation: item.expectation },
                after: { valence: after.valence, strength: after.strength, expectation: after.expectation },
            });
            return after;
        }),
    }, episode);
    subjectiveEpisodeRepo.save(subjectId, keyFor(episode), episode.moments.map(moment => moment.id), summary);
    syncAssociationEffects(subjectId, episode, summary);
    return { affected, operation, changes };
}

/**
 * A tag is a first-class memory anchor. It does not need an LLM-created
 * association to be a valid intervention target.
 */
export function applySubjectiveTagIntervention(
    subjectId: string,
    episode: MemoryEpisode,
    tag: string,
    label: string,
    operation: string,
    intensity: number,
): SubjectiveInterventionResult {
    const sourceKey = `${keyFor(episode)}:tag:${tag}`;
    const row = db.prepare(`SELECT valence, strength, expectation FROM subjective_associations
        WHERE subject_id = ? AND source_key = ? AND target_type = 'tag' AND target_key = ?`)
        .get(subjectId, sourceKey, tag) as any;
    const before = {
        valence: Number(row?.valence || 0),
        strength: Number(row?.strength ?? .25),
        expectation: (row?.expectation || 'anticipate') as SubjectiveEpisode['associations'][number]['expectation'],
    };
    const delta = Math.max(.02, Math.min(.22, intensity * .22));
    const after = {
        valence: operation === 'anxiety' ? Math.max(-1, before.valence - delta)
            : operation === 'reframe' ? before.valence * (1 - delta)
                : Math.min(1, before.valence + delta),
        strength: operation === 'reframe' ? Math.max(0, before.strength - delta) : Math.min(1, before.strength + delta),
        expectation: (operation === 'anxiety' ? 'avoid' : operation === 'reinforce' ? 'seek' : 'anticipate') as SubjectiveEpisode['associations'][number]['expectation'],
    };
    const write = db.transaction(() => {
        db.prepare(`INSERT INTO subjective_associations (subject_id,source_key,target_type,target_key,target_label,tag_links,valence,strength,expectation)
            VALUES (?, ?, 'tag', ?, ?, ?, ?, ?, ?)
            ON CONFLICT(subject_id,source_key,target_type,target_key) DO UPDATE SET target_label=excluded.target_label,tag_links=excluded.tag_links,valence=excluded.valence,strength=excluded.strength,expectation=excluded.expectation`)
            .run(subjectId, sourceKey, tag, label, JSON.stringify([tag]), after.valence, after.strength, after.expectation);
        db.prepare(`INSERT INTO memory_association_effects (subject_id,source_key,tag,weight,expectation)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(subject_id,source_key,tag) DO UPDATE SET weight=excluded.weight,expectation=excluded.expectation`)
            .run(subjectId, sourceKey, tag, Math.max(-.45, Math.min(.45, after.valence * after.strength * .35)), after.expectation);
    });
    write();
    return { affected: 1, operation, changes: [{ target: label, before, after }] };
}

/** Explicit admin/backfill entrypoint. Normal UI requests queue only one job. */
export async function materializeSubjectiveEpisodes(subjectId: string, characterName: string, episodes: MemoryEpisode[]) {
    for (const episode of episodes) await queueSubjectiveEpisode(subjectId, characterName, episode);
}
