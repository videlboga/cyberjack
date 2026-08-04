import { db } from '../infrastructure/db';
import { storyThreadRepo } from '../infrastructure/eventDirectorRepo';
import type { GeneratedProfileV2 } from '../orchestration/characterGenerator/types';

type StorySeed = NonNullable<GeneratedProfileV2['storySeed']>;

const CUSTOM_SEEDS:Record<string, StorySeed> = {
    'S-AV-01': {
        unresolvedPast:'После падения семьи Миру переписали в активы как продолжение учёта, но обстоятельства ликвидации семьи остались неясными.',
        externalLink:'Lattice и архив внешнего кольца',
        concealedFact:'В документах о ликвидации семьи есть чужое решение, которое можно связать с действующим куратором.',
        pressure:'Мира привыкла ждать, что за ней не придут; любое обещание помощи проверяет эту уверенность.',
        activationTriggers:['trust_60','family_chat','lattice_contact','outer_ring','contract_completed'],
        possibleDirections:['восстановить историю семьи','потребовать компенсацию у виновных','использовать архивный след против Lattice'],
    },
    'NPC-LAB-01': {
        unresolvedPast:'Иона сохранила исходный журнал аварийной смены, после которой руководство переписало обстоятельства гибели пациента.',
        externalLink:'бывшая клиника и медицинский канал внешней обшивки',
        concealedFact:'Копия журнала доказывает не только ошибку руководства, но и испытание незаявленного протокола.',
        pressure:'Кто-то отслеживает уцелевшие копии телеметрии и может выйти на лабораторию.',
        activationTriggers:['medical_anomaly','drug_side_effect','trust_60','veil_contact','equipment_failure'],
        possibleDirections:['передать доказательства','вычислить заказчика протокола','обменять журнал на защиту лаборатории'],
    },
    'NPC-CAND-01': {
        unresolvedPast:'Ника увидела в исследовательском секторе то, чего видеть не должна была, и сохранила молчание.',
        externalLink:'внутренний клинический канал Veil Biotech',
        concealedFact:'Увиденное связано с серией стимуляторов, следы которой могут появиться в снабжении лаборатории.',
        pressure:'Veil считает её либо свидетелем, либо потенциально полезным исполнителем.',
        activationTriggers:['recruitment','veil_supply','biography_chat','sensitivity_150','trust_60'],
        possibleDirections:['раскрыть происхождение серии','вернуться в Veil под прикрытием','скрыть участие Ники'],
    },
    'NPC-CAND-SUMI': {
        unresolvedPast:'Суми помогла кому-то в центральных контурах, и эта помощь обернулась для неё проблемой.',
        externalLink:'Lattice и чистый сектор внутреннего кольца',
        concealedFact:'Получатель помощи использовал доступ Суми и оставил след, который теперь ведёт к ней.',
        pressure:'Впервые оказавшись без защиты центральных контуров, Суми должна решить, доверять ли прежнему знакомому снова.',
        activationTriggers:['recruitment','lattice_contact','inner_ring','biography_chat','trust_60'],
        possibleDirections:['найти прежнего знакомого','очистить имя Суми','использовать оставленный доступ'],
    },
    'NPC-CAND-GEN-02': {
        unresolvedPast:'Эли увидела запрещённую операцию возле медицинского блока и сделала вид, что ничего не произошло.',
        externalLink:'Lattice и служебные каналы срединных секторов',
        concealedFact:'Операция была частью намеренно скрытого перемещения человека или данных.',
        pressure:'Прежняя зависимость от Lattice позволяет найти Эли через старые учётные записи.',
        activationTriggers:['recruitment','medical_anomaly','lattice_contact','biography_chat','trust_60'],
        possibleDirections:['установить судьбу исчезнувшего','подделать учётный след','продать сведения конкурирующей фракции'],
    },
    'NPC-CAND-GEN-03': {
        unresolvedPast:'Мара нашла в технических уровнях фрагмент, которого не должно было существовать.',
        externalLink:'Continuum Archive и закрытое хранилище внутреннего кольца',
        concealedFact:'Находка содержит несовместимую с официальными архивами версию станционного события.',
        pressure:'Continuum ищет потерянный фрагмент, но внутри организации нет согласия о том, следует ли его уничтожить.',
        activationTriggers:['recruitment','continuum_contact','archive_visit','anomaly_event','biography_chat'],
        possibleDirections:['восстановить содержимое находки','передать её одной из сторон Continuum','сопоставить фрагмент с Аномалией'],
    },
    'NPC-CAND-GEN-04': {
        unresolvedPast:'Май однажды оставили ждать и не вернулись; с тех пор она старается быть незаменимо полезной.',
        externalLink:'Lattice и прежний куратор срединного сектора',
        concealedFact:'Исчезновение было осознанным разрывом связи, а не аварией или забывчивостью.',
        pressure:'Старый куратор может предложить знакомую безопасность в обмен на подчинение.',
        activationTriggers:['recruitment','trust_60','lattice_contact','abandonment_echo','biography_chat'],
        possibleDirections:['узнать причину исчезновения','отказаться от старого куратора','перехватить его сеть зависимых'],
    },
    'NPC-CAND-GEN-05': {
        unresolvedPast:'Рен был наказан за чужой поступок и так и не узнал, кто переложил на него вину.',
        externalLink:'Continuum Archive и силовая сеть внешних колец',
        concealedFact:'В архивных фрагментах сохранился идентификатор настоящего виновника или заказчика.',
        pressure:'Те же люди могут использовать старое обвинение, чтобы заставить Рена работать на них.',
        activationTriggers:['recruitment','continuum_contact','outer_ring','conflict','biography_chat'],
        possibleDirections:['найти виновника','снять старое обвинение','использовать обвинение как путь внутрь силовой сети'],
    },
};

const readJson = (value:string | null) => {
    try { return JSON.parse(value || '{}') as Record<string,any>; } catch { return {}; }
};

export function ensureCharacterStorySeeds() {
    const now = Number((db.prepare(`SELECT total_minutes FROM world_state WHERE id = 'main'`).get() as any)?.total_minutes || 0);
    const rows = db.prepare(`
        SELECT id,name,current_scene_id,profile_json FROM characters
        WHERE id IN ('S-AV-01','NPC-LAB-01','NPC-CAND-01','NPC-CAND-SUMI',
                     'NPC-CAND-GEN-02','NPC-CAND-GEN-03','NPC-CAND-GEN-04','NPC-CAND-GEN-05')
    `).all() as any[];
    for (const row of rows) {
        const profile = readJson(row.profile_json);
        const seed:StorySeed | undefined = CUSTOM_SEEDS[row.id] || profile.storySeed || profile.generatedProfile?.storySeed;
        if (!seed) continue;
        profile.storySeed = seed;
        if (profile.generatedProfile) profile.generatedProfile.storySeed = seed;
        db.prepare(`UPDATE characters SET profile_json = ? WHERE id = ?`).run(JSON.stringify(profile), row.id);

        const isCandidate = row.current_scene_id === 'scene_broker';
        const existing = storyThreadRepo.findBySource('character_story_seed', row.id);
        if (existing) {
            if (!isCandidate && existing.status === 'dormant') {
                db.prepare(`
                    UPDATE story_threads
                    SET status = 'open', visibility = 'hinted', updated_minute = ?
                    WHERE id = ?
                `).run(now, existing.id);
            }
            continue;
        }
        storyThreadRepo.save({
            id:`thread:character-origin:${row.id}`,
            type:'character_origin',
            title:`Незавершённое прошлое: ${row.name}`,
            status:isCandidate ? 'dormant' : 'open',
            stage:'seed',
            subjectId:row.id,
            relatedCharacterIds:[],
            facts:[seed.unresolvedPast, `Внешняя связь: ${seed.externalLink}.`],
            tags:['character','origin','personal',...seed.activationTriggers],
            tension:.25,
            importance:.65,
            visibility:isCandidate ? 'hidden' : 'hinted',
            sourceType:'character_story_seed',
            sourceId:row.id,
            createdMinute:now,
            updatedMinute:now,
            metadata:{
                concealedFact:seed.concealedFact,
                pressure:seed.pressure,
                activationTriggers:seed.activationTriggers,
                possibleDirections:seed.possibleDirections,
            },
        });
    }
}
