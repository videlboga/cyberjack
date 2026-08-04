import { db } from '../infrastructure/db';
import { ensureStarterClothing } from '../infrastructure/starterClothing';
import { getBaseHumanAnatomy } from '../domain/anatomy';
import { generateCharacterContext } from '../orchestration/characterGenerator/generator';
import { regenerateGeneratedProfile } from '../orchestration/characterGenerator/profileManager';

type CandidateSeed = {
    id: string;
    seed: string;
    name?: string;
    age?: number;
    gender?: 'female' | 'male';
    forced?: string[];
    description?: string;
};

const GENERATED_CANDIDATES: CandidateSeed[] = [
    {
        id: 'NPC-CAND-SUMI',
        seed: 'omnicron-sumi-inner-v1',
        name: 'Суми',
        age: 18,
        gender: 'female',
        forced: ['origin_inner_ring', 'origin_place_clean_sector'],
        description: 'Восемнадцатилетняя уроженка центральных контуров. Выросла среди чистых переходов и регламентированной жизни внутреннего кольца; впервые оказывается за пределами привычной защищённой среды.',
    },
    { id: 'NPC-CAND-GEN-02', seed: 'omnicron-candidate-random-02-v1' },
    { id: 'NPC-CAND-GEN-03', seed: 'omnicron-candidate-random-03-v1' },
    {
        id: 'NPC-CAND-GEN-04',
        seed: 'omnicron-candidate-random-04-v1',
        name: 'Май',
        age: 19,
        gender: 'female',
    },
    { id: 'NPC-CAND-GEN-05', seed: 'omnicron-candidate-random-05-v1' },
];

function clamp(value: number) {
    return Math.max(0, Math.min(100, value));
}

function describeGeneratedCandidate(profile: any): string {
    const tags = new Set<string>(profile.sourceTags || []);
    const origin = tags.has('origin_inner_ring') ? 'внутреннее кольцо'
        : tags.has('origin_mid_ring') ? 'срединные сектора'
            : tags.has('origin_outer_ring') ? 'внешние кольца'
                : tags.has('origin_perimeter') ? 'Периметр'
                    : 'неуточнённый сектор';
    const role = tags.has('role_researcher') ? 'исследовательская работа'
        : tags.has('role_clerk') ? 'станционный учёт и документация'
            : tags.has('role_worker') ? 'технические и ремонтные работы'
                : tags.has('role_thug') ? 'силовая среда внешних секторов'
                    : tags.has('role_cultist') ? 'закрытая религиозная община'
                        : tags.has('role_pampered') ? 'обеспеченная жизнь под опекой'
                            : 'разрозненные станционные работы';
    const disposition = tags.has('psy_defiant') ? 'сопротивляется навязанным решениям'
        : tags.has('psy_submissive') ? 'ищет ясные ориентиры и предсказуемую структуру'
            : tags.has('psy_curious_masochist') ? 'любопытство сильнее осторожности'
                : tags.has('psy_anxious') ? 'настороженно реагирует на неопределённость'
                    : 'поведение ещё требует наблюдения';
    return `Происхождение: ${origin}. Опыт: ${role}. Поведенческий профиль: ${disposition}.`;
}

function seedOneCandidate(spec: CandidateSeed): boolean {
    if (db.prepare('SELECT 1 FROM characters WHERE id = ?').get(spec.id)) return false;

    const draft = generateCharacterContext({
        seed: spec.seed,
        archetype: 'person',
        forced: spec.forced,
    });
    const identity = {
        name: spec.name || draft.baseProfile?.name || spec.id,
        age: spec.age ?? Number(draft.baseProfile?.age || 25),
        gender: spec.gender || (draft.baseProfile?.gender === 'male' ? 'male' : 'female'),
        anatomy: 'human',
        status: 'candidate',
    };
    const canonical = {
        base: identity,
        title: 'Кандидат',
        description: spec.description || '',
        recruitment: { staffCost: 180, assetCost: 260 },
        visual: spec.id === 'NPC-CAND-SUMI' ? { slug: 'sumi' }
            : spec.id === 'NPC-CAND-GEN-02' ? { slug: 'eli' }
                : spec.id === 'NPC-CAND-GEN-04' ? { slug: 'mai' }
                : undefined,
        origin: spec.id === 'NPC-CAND-SUMI'
            ? {
                birthplaceId: 'inner-ring-clean-sector',
                biography: spec.description,
            }
            : undefined,
    };

    db.prepare(`
        INSERT INTO characters (id, name, kind, subject_id, current_scene_id, profile_json)
        VALUES (?, ?, 'npc', ?, 'scene_broker', ?)
    `).run(spec.id, identity.name, spec.id, JSON.stringify(canonical));

    const profile = regenerateGeneratedProfile(spec.id, { seed: spec.seed, forced: spec.forced });
    const core = profile.mechanicalSeed.coreModifiers || {};
    const metric = (key:string) => clamp(50 + Number(core[key] || 0));
    const staffCost = 170 + Math.round((metric('capacity') + metric('openness')) / 10) * 10;
    const assetCost = 220 + Math.round((metric('plasticity') + metric('sensitivity')) / 8) * 10;

    db.transaction(() => {
        // A partially reset database may retain mechanical rows after the
        // character card was removed. These ids belong exclusively to this
        // deterministic seed, so rebuilding the orphan is safe.
        db.prepare('DELETE FROM subject_point_states WHERE subject_id = ?').run(spec.id);
        db.prepare('DELETE FROM subjects WHERE id = ?').run(spec.id);
        db.prepare(`
            INSERT INTO subjects (
                id,name,sensitivity,capacity,openness,plasticity,attitude,tension,preferences,
                baseline_sensitivity,baseline_capacity,baseline_openness,baseline_plasticity,baseline_attitude
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?)
        `).run(
            spec.id, identity.name,
            metric('sensitivity'), metric('capacity'), metric('openness'), metric('plasticity'), metric('attitude'),
            JSON.stringify(profile.mechanicalSeed.preferences || {}),
            metric('sensitivity'), metric('capacity'), metric('openness'), metric('plasticity'), metric('attitude')
        );

        const insertPoint = db.prepare(`
            INSERT INTO subject_point_states (
                subject_id,point_id,local_sensitivity,local_attitude,local_openness,familiarity,exposure_count,
                baseline_local_sensitivity,baseline_local_attitude,baseline_local_openness
            ) VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?, ?)
        `);
        for (const point of getBaseHumanAnatomy(identity.gender, 'none')) {
            insertPoint.run(spec.id, point.id, point.sens, point.att, metric('openness'), point.sens, point.att, metric('openness'));
        }

        db.prepare(`
            INSERT INTO scene_characters (scene_id,character_id,role,can_act,presence_state,slot_id)
            VALUES ('scene_broker', ?, 'candidate', 1, 'present', NULL)
            ON CONFLICT(scene_id,character_id) DO UPDATE SET
                role='candidate',can_act=1,presence_state='present'
        `).run(spec.id);

        const stored = db.prepare('SELECT profile_json FROM characters WHERE id = ?').get(spec.id) as any;
        const profileJson = JSON.parse(stored.profile_json || '{}');
        profileJson.title = 'Кандидат';
        profileJson.description = spec.description || describeGeneratedCandidate(profile);
        profileJson.generatedCandidateSeed = spec.seed;
        profileJson.recruitment = { staffCost, assetCost };
        if (spec.id === 'NPC-CAND-SUMI') {
            profileJson.visual = { slug:'sumi' };
            profileJson.origin = {
                ...(profileJson.origin || {}),
                birthplaceId:'inner-ring-clean-sector',
                biography:spec.description,
            };
        }
        if (spec.id === 'NPC-CAND-GEN-02') profileJson.visual = { slug:'eli' };
        db.prepare('UPDATE characters SET profile_json = ? WHERE id = ?').run(JSON.stringify(profileJson), spec.id);
    })();

    ensureStarterClothing(spec.id, ['eq_clothe_underwear']);
    return true;
}

export function ensureGeneratedCandidates(): string[] {
    const created = GENERATED_CANDIDATES.filter(seedOneCandidate).map(candidate => candidate.id);
    for (const spec of GENERATED_CANDIDATES) {
        if (spec.description) continue;
        const row = db.prepare('SELECT profile_json FROM characters WHERE id = ?').get(spec.id) as any;
        if (!row) continue;
        const profileJson = JSON.parse(row.profile_json || '{}');
        if (!profileJson.generatedProfile) continue;
        profileJson.description = describeGeneratedCandidate(profileJson.generatedProfile);
        profileJson.generatedCandidateSeed = spec.seed;
        db.prepare('UPDATE characters SET profile_json = ? WHERE id = ?').run(JSON.stringify(profileJson), spec.id);
    }
    return created;
}

export const GENERATED_CANDIDATE_IDS = GENERATED_CANDIDATES.map(candidate => candidate.id);
