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
        id: 'contract_veil_pain_01',
        issuerId: 'fac_veil',
        title: 'Болевой резонанс (Veil Biotech)',
        description: 'Veil Biotech заказывает актив, способный к стойкому болевому резонансу. Актив должен быть сломлен и покорен, с низким сопротивлением и высокой чувствительностью. Испытания Veil требуют, чтобы актив не сопротивлялся боли.',
        state: 'available' as const,
        conditions: [
            { type: 'attitude' as const, operator: '>' as const, value: 75 },
            { type: 'custom' as const, key: 'sensitivity', operator: '>' as const, value: 70 },
            { type: 'custom' as const, key: 'capacity', operator: '<' as const, value: 40 }
        ],
        rewards: { credits: 800, trust: 15, items: ['drug_sensitizer'] },
        penalties: { credits: -100, trust: -5 }
    },
    {
        id: 'contract_helix_obedience_01',
        issuerId: 'fac_helix',
        title: 'Стандартизация покорности (Helix Dynamics)',
        description: 'Helix Dynamics требует актив с высокой покорностью и открытостью для стандартизированных процедур. Актив должен быть восприимчив к новым воздействиям и не оказывать сопротивления. Идеальный актив для Helix — предсказуемый и податливый.',
        state: 'available' as const,
        conditions: [
            { type: 'attitude' as const, operator: '>' as const, value: 80 },
            { type: 'custom' as const, key: 'openness', operator: '>' as const, value: 75 },
            { type: 'custom' as const, key: 'plasticity', operator: '>' as const, value: 60 }
        ],
        rewards: { credits: 600, trust: 10, items: ['eq_handcuffs'] },
        penalties: { credits: -50, trust: -3 }
    },
    {
        id: 'contract_continuum_study_01',
        issuerId: 'fac_continuum',
        title: 'Долгосрочное наблюдение (Continuum Archive)',
        description: 'Continuum Archive приобретает актив для долговременного наблюдения за дрейфом базовых состояний. Актив должен обладать высокой пластичностью и открытостью — это позволяет отслеживать медленные изменения психики.',
        state: 'available' as const,
        conditions: [
            { type: 'custom' as const, key: 'plasticity', operator: '>' as const, value: 80 },
            { type: 'custom' as const, key: 'openness', operator: '>' as const, value: 70 }
        ],
        rewards: { credits: 400, trust: 5 },
        penalties: {}
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
    for (const c of contracts) {
        // Content seeding must not reset a player's accepted/completed order
        // whenever the API process restarts.
        if (contractRepo.get(c.id)) continue;
        contractRepo.save({
            id: c.id,
            issuerId: c.issuerId,
            title: c.title,
            description: c.description,
            state: c.state,
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
