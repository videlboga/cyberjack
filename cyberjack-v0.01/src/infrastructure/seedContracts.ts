import { db } from './db';
import { contractRepo } from './contractRepo';

console.log("[SeedContracts] Начинаем заполнение фракций и контрактов...");

// ─── Фракции ────────────────────────────────────────────────────────────────

const factions = [
    {
        id: 'fac_veil',
        name: 'Veil Biotech',
        type: 'research_center',
        description: 'Исследует крайние эмоциональные состояния. Считает, что аномалия раскрывается только через предельные переживания.',
        meta: { approach: 'extreme', preferredStates: ['high_tension', 'low_attitude', 'high_sensitivity'] }
    },
    {
        id: 'fac_helix',
        name: 'Helix Dynamics',
        type: 'syndicate',
        description: 'Управляет эмоциональными профилями активов. Стремится к предсказуемости и стандартизации реакций.',
        meta: { approach: 'controlled', preferredStates: ['high_attitude', 'high_openness', 'stable'] }
    },
    {
        id: 'fac_continuum',
        name: 'Continuum Archive',
        type: 'other',
        description: 'Собирает и интерпретирует данные. Покупает активов для долговременного наблюдения.',
        meta: { approach: 'observational', preferredStates: ['high_plasticity', 'high_openness'] }
    }
];

// ─── Контракты ──────────────────────────────────────────────────────────────

const contracts = [
    {
        id: 'contract_veil_resonance_01',
        issuerId: 'fac_veil',
        title: 'Резонансный контур',
        description: 'Veil Biotech ищет редкий профиль: боль уже осмыслена как значимый сигнал, но чувствительность не перешла в сенсорный срыв, а ресурс сохранился для длинной серии. Слишком покорный или истощённый актив даёт плохую границу для сравнения.',
        state: 'available' as const,
        conditions: [
            { type: 'preference' as const, key: 'pain', operator: '>=' as const, value: 18 },
            { type: 'custom' as const, key: 'sensitivity', operator: '>=' as const, value: 68 },
            { type: 'custom' as const, key: 'sensitivity', operator: '<=' as const, value: 86 },
            { type: 'custom' as const, key: 'capacity', operator: '>=' as const, value: 45 },
            { type: 'attitude' as const, operator: '<=', value: 72 },
            { type: 'acquired_trait' as const, key: 'trait_masochist', operator: '>=' as const, value: 1 }
        ],
        rewards: { credits: 780, trust: 14, items: ['drug_sensitizer'] },
        penalties: { credits: -110, trust: -5 }
    },
    {
        id: 'contract_veil_exposure_02',
        issuerId: 'fac_veil',
        title: 'Открытая экспозиция',
        description: 'Veil проверяет переходный профиль: интерес к демонстрации уже закрепился, однако общая открытость ещё не растворила осторожность. Их интересует напряжение между влечением к вниманию и сохранённой дистанцией.',
        state: 'available' as const,
        conditions: [
            { type: 'preference' as const, key: 'exposure', operator: '>=' as const, value: 16 },
            { type: 'custom' as const, key: 'openness', operator: '>=' as const, value: 64 },
            { type: 'custom' as const, key: 'sensitivity', operator: '>=' as const, value: 60 },
            { type: 'custom' as const, key: 'openness', operator: '<=', value: 78 },
            { type: 'attitude' as const, operator: '>=', value: 55 },
            { type: 'acquired_trait' as const, key: 'trait_exhibitionist', operator: '>=' as const, value: 1 }
        ],
        rewards: { credits: 690, trust: 12 },
        penalties: { credits: -90, trust: -4 }
    },
    {
        id: 'contract_veil_clinical_03',
        issuerId: 'fac_veil',
        title: 'Клинический допуск',
        description: 'Veil открывает серию инвазивных измерений и ищет актив, для которого медицинская рамка уже стала приемлемой. Важна не покорность сама по себе, а сочетание доверия к процедуре, пластичности и рабочего резерва.',
        state: 'available' as const,
        conditions: [
            { type: 'preference' as const, key: 'clinical', operator: '>=' as const, value: 15 },
            { type: 'custom' as const, key: 'plasticity', operator: '>=' as const, value: 62 },
            { type: 'attitude' as const, operator: '>=' as const, value: 60 },
            { type: 'custom' as const, key: 'capacity', operator: '>=' as const, value: 52 },
            { type: 'attitude' as const, operator: '<=', value: 80 },
            { type: 'custom' as const, key: 'sensitivity', operator: '<=', value: 78 },
            { type: 'acquired_trait' as const, key: 'trait_clinical_fetish', operator: '>=' as const, value: 1 }
        ],
        rewards: { credits: 840, trust: 16 },
        penalties: { credits: -120, trust: -6 }
    },
    {
        id: 'contract_helix_compliance_01', issuerId: 'fac_helix', title: 'Повторяемый отклик',
        description: 'Helix Dynamics валидирует стандартный поведенческий профиль для линейки процедур. Им нужен не сломанный актив, а предсказуемый: открытый к инструкции, достаточно пластичный и уже умеющий превращать внешнее требование в устойчивую реакцию.', state: 'available' as const,
        conditions: [
            { type: 'attitude' as const, operator: '>=' as const, value: 72 },
            { type: 'custom' as const, key: 'openness', operator: '>=' as const, value: 70 },
            { type: 'custom' as const, key: 'plasticity', operator: '>=' as const, value: 66 },
            { type: 'custom' as const, key: 'plasticity', operator: '<=', value: 82 },
            { type: 'custom' as const, key: 'capacity', operator: '>=', value: 55 },
            { type: 'acquired_trait' as const, key: 'trait_conditioned_submission', operator: '>=', value: 2 }
        ], rewards: { credits: 820, trust: 15, items: ['eq_handcuffs'] }, penalties: { credits: -100, trust: -5 }
    },
    {
        id: 'contract_helix_restraint_02', issuerId: 'fac_helix', title: 'Контур фиксации',
        description: 'Инженеры Helix калибруют систему контроля позы. Нужен актив, который не только терпит ограничение движений, но и сохраняет приемлемый ресурс для серийных испытаний; это отделяет пригодный профиль от разовой перегрузки.', state: 'available' as const,
        conditions: [
            { type: 'preference' as const, key: 'restraint', operator: '>=' as const, value: 17 },
            { type: 'custom' as const, key: 'capacity', operator: '>=' as const, value: 58 },
            { type: 'custom' as const, key: 'openness', operator: '>=' as const, value: 58 },
            { type: 'custom' as const, key: 'openness', operator: '<=', value: 74 },
            { type: 'attitude' as const, operator: '>=', value: 58 },
            { type: 'acquired_trait' as const, key: 'trait_restraint_fetish', operator: '>=', value: 1 }
        ], rewards: { credits: 730, trust: 13 }, penalties: { credits: -90, trust: -4 }
    },
    {
        id: 'contract_helix_interface_03', issuerId: 'fac_helix', title: 'Интерфейсный профиль',
        description: 'Helix готовит тестовый пул для сенсорного интерфейса. Заказчику важна положительная реакция на электронные средства, высокая чувствительность и принятие оператора — но без ухода в перегруженный профиль: актив должен различать сигнал, а не тонуть в нём.', state: 'available' as const,
        conditions: [
            { type: 'preference' as const, key: 'electronic', operator: '>=' as const, value: 16 },
            { type: 'custom' as const, key: 'sensitivity', operator: '>=' as const, value: 65 },
            { type: 'attitude' as const, operator: '>=' as const, value: 65 },
            { type: 'custom' as const, key: 'sensitivity', operator: '<=', value: 82 },
            { type: 'custom' as const, key: 'capacity', operator: '>=', value: 50 },
            { type: 'acquired_trait' as const, key: 'trait_technophile', operator: '>=', value: 1 }
        ], rewards: { credits: 760, trust: 14 }, penalties: { credits: -100, trust: -5 }
    },
    {
        id: 'contract_continuum_drift_01', issuerId: 'fac_continuum', title: 'Карта медленного дрейфа',
        description: 'Continuum Archive собирает долгую последовательность наблюдений, а не эффект одной сессии. Им подходит актив с уже подвижной базой: открытый к новому опыту, пластичный и достаточно устойчивый, чтобы изменения можно было сравнивать во времени.', state: 'available' as const,
        conditions: [
            { type: 'custom' as const, key: 'plasticity', operator: '>=' as const, value: 76 },
            { type: 'custom' as const, key: 'openness', operator: '>=' as const, value: 72 },
            { type: 'custom' as const, key: 'capacity', operator: '>=' as const, value: 50 },
            { type: 'custom' as const, key: 'plasticity', operator: '<=', value: 88 },
            { type: 'custom' as const, key: 'openness', operator: '<=', value: 84 },
            { type: 'attitude' as const, operator: '>=' as const, value: 52 }
        ], rewards: { credits: 680, trust: 15 }, penalties: { credits: -80, trust: -4 }
    },
    {
        id: 'contract_continuum_crossindex_02', issuerId: 'fac_continuum', title: 'Перекрёстный индекс',
        description: 'Архив сверяет биометрические записи с субъективной оценкой процедуры. Нужен актив, у которого одновременно закрепились два независимых ассоциативных контура: медицинский и электронный. Такая комбинация помогает отличать общий сдвиг от случайной реакции.', state: 'available' as const,
        conditions: [
            { type: 'preference' as const, key: 'clinical', operator: '>=' as const, value: 13 },
            { type: 'preference' as const, key: 'electronic', operator: '>=' as const, value: 13 },
            { type: 'custom' as const, key: 'plasticity', operator: '>=' as const, value: 68 },
            { type: 'custom' as const, key: 'sensitivity', operator: '>=' as const, value: 58 },
            { type: 'custom' as const, key: 'openness', operator: '<=', value: 72 },
            { type: 'attitude' as const, operator: '>=', value: 54 }
        ], rewards: { credits: 740, trust: 16 }, penalties: { credits: -100, trust: -5 }
    },
    {
        id: 'contract_continuum_recovery_03', issuerId: 'fac_continuum', title: 'Устойчивое восстановление',
        description: 'Continuum ищет профиль для наблюдения за возвращением к рабочему состоянию после нагрузки. В этой серии ценна не экстремальность, а баланс: актив должен сохранять ресурс, принимать процедуру и оставаться достаточно открытым, чтобы фиксировать последующие изменения.', state: 'available' as const,
        conditions: [
            { type: 'custom' as const, key: 'capacity', operator: '>=' as const, value: 68 },
            { type: 'custom' as const, key: 'sensitivity', operator: '>=', value: 50 },
            { type: 'custom' as const, key: 'sensitivity', operator: '<=', value: 72 },
            { type: 'attitude' as const, operator: '>=' as const, value: 62 },
            { type: 'custom' as const, key: 'openness', operator: '>=' as const, value: 60 },
            { type: 'custom' as const, key: 'plasticity', operator: '>=' as const, value: 55 }
        ], rewards: { credits: 650, trust: 13 }, penalties: { credits: -70, trust: -3 }
    }
];

// ─── Запись в БД ────────────────────────────────────────────────────────────

db.transaction(() => {
    // Фракции
    const insertFaction = db.prepare(`
        INSERT INTO factions (id, name, type, description, meta)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            type = excluded.type,
            description = excluded.description,
            meta = excluded.meta
    `);
    for (const f of factions) {
        insertFaction.run(f.id, f.name, f.type, f.description, JSON.stringify(f.meta || {}));
    }
    console.log(`[SeedContracts] Загружено фракций: ${factions.length}`);

    // Контракты
    db.prepare("DELETE FROM asset_contracts WHERE state = 'available'").run();
    for (const c of contracts) {
        // Content seeding must not reset a player's accepted/completed order
        // whenever the API process restarts.
        const existing = contractRepo.get(c.id);
        if (existing && existing.state !== 'available') continue;
        contractRepo.save({
            id: c.id,
            issuerId: c.issuerId,
            title: c.title,
            description: c.description,
            state: existing?.state || c.state,
            acceptedByPlayerId: undefined,
            attachedSubjectId: undefined,
            deadlineTick: undefined,
            conditions: c.conditions as any,
            rewards: c.rewards as any,
            penalties: c.penalties as any
        });
    }
    console.log(`[SeedContracts] Загружено контрактов: ${contracts.length}`);
})();

console.log("[SeedContracts] Завершено.");
