import { characterRepo, memoryRepo } from '../infrastructure/repositories';
import { db } from '../infrastructure/db';
import { aggregateMemoryEpisodes } from '../services/memoryEpisodes';
import { getSubjectiveEpisode, queueSubjectiveEpisode } from '../services/subjectiveMemoryEpisodes';
import { parseVerbalInputWithLLM } from '../adapters/llmAdapter';
import { deriveAcquiredTraits, parsePreferences } from '../domain/conditioning';

let running = false;
let cursor = 0;
let pass = 0;

db.exec(`CREATE TABLE IF NOT EXISTS dossier_narratives (
    subject_id TEXT PRIMARY KEY,
    fingerprint TEXT NOT NULL,
    self_description TEXT NOT NULL,
    trait_expression TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

async function materializeNextDossierNarrative() {
    const characters = characterRepo.listAll().filter(character => character.id !== 'PL-1' && Boolean(character.subjectId));
    for (const character of characters) {
        const subjectId = character.subjectId || character.id;
        const subject = db.prepare('SELECT sensitivity,capacity,openness,plasticity,attitude,tension,preferences FROM subjects WHERE id=?').get(subjectId) as any;
        if (!subject) continue;
        const traits = deriveAcquiredTraits(subject.preferences).filter(trait => trait.level > 0);
        const tags = Object.entries(parsePreferences(subject.preferences).tags)
            .filter(([, value]) => Math.abs(Number(value)) >= .15)
            .sort(([, a], [, b]) => Math.abs(Number(b)) - Math.abs(Number(a))).slice(0, 6);
        const fingerprint = JSON.stringify({
            core: ['sensitivity','capacity','openness','plasticity','attitude','tension'].map(key => Math.round(Number(subject[key]) / 8) * 8),
            traits: traits.map(trait => [trait.id, trait.level]), tags: tags.map(([tag, value]) => [tag, Math.round(Number(value) * 10) / 10]),
        });
        const existing = db.prepare('SELECT fingerprint FROM dossier_narratives WHERE subject_id=?').get(subjectId) as any;
        if (existing?.fingerprint === fingerprint) continue;
        const { parsed } = await parseVerbalInputWithLLM([{ role: 'system', content: `Ты пишешь две короткие, точные заметки для досье персонажа ${character.name}. Только JSON {selfDescription,traitExpression}. Не добавляй события, мотивы или диагнозы, которых нет во входных данных. selfDescription — от первого лица, 1–2 предложения о том, как она ощущает своё текущее состояние и самые сильные ассоциации. traitExpression — от третьего лица, 1–2 предложения о том, как закреплённые черты проявляются наблюдаемо. Не упоминай числа, JSON, «теги» и «модель».` }, { role: 'user', content: JSON.stringify({ core: subject, traits, associations: tags }) }], { type: 'json_object' }, 'memory');
        const selfDescription = String(parsed?.selfDescription || '').trim();
        const traitExpression = String(parsed?.traitExpression || '').trim();
        if (!selfDescription || !traitExpression) return;
        db.prepare(`INSERT INTO dossier_narratives(subject_id,fingerprint,self_description,trait_expression)
          VALUES(?,?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(subject_id) DO UPDATE SET fingerprint=excluded.fingerprint,self_description=excluded.self_description,trait_expression=excluded.trait_expression,updated_at=CURRENT_TIMESTAMP`)
          .run(subjectId, fingerprint, selfDescription, traitExpression);
        return;
    }
}

/**
 * Materializes subjective memories independently from UI reads. One episode
 * per pass keeps the LLM available for commands and dialogue, while the
 * rotating cursor prevents the newest unfinished memory from starving older
 * episodes forever.
 */
export async function materializeNextSubjectiveMemory() {
    if (running) return;
    running = true;
    try {
        // The dossier voice is also low priority, but must not wait until the
        // entire archive is complete: new episodes can keep arriving forever.
        pass++;
        if (pass % 4 === 0) {
            await materializeNextDossierNarrative();
            return;
        }
        const characters = characterRepo.listAll()
            .filter(character => character.id !== 'PL-1' && Boolean(character.subjectId));
        const candidates = characters.flatMap(character => {
            const subjectId = character.subjectId || character.id;
            return aggregateMemoryEpisodes(memoryRepo.listRecent(subjectId, 160, 'episode_v2'), 12)
                .filter(episode => !getSubjectiveEpisode(subjectId, episode))
                .map(episode => ({ subjectId, characterName: character.name, episode }));
        });
        if (candidates.length) {
            const next = candidates[cursor % candidates.length];
            cursor = (cursor + 1) % candidates.length;
            await queueSubjectiveEpisode(next.subjectId, next.characterName, next.episode);
            return;
        }
        await materializeNextDossierNarrative();
    } catch (error: any) {
        console.warn('[SubjectiveMemoryWorker] materialization failed:', error?.message || error);
    } finally {
        running = false;
    }
}

export function startSubjectiveMemoryWorker() {
    // The worker is now driven by the unified background job queue
    // (memory.materialize) scheduled from advanceSimulationTime. This
    // function is kept as a no-op compatibility shim so the server startup
    // path does not need to change; the actual scheduling happens in
    // simulationTime.scheduleMemoryMaterialization.
}

export function stopSubjectiveMemoryWorker() {
    // No-op: the queue owns the schedule.
}
