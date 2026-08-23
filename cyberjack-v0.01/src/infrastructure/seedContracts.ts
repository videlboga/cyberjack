import { db } from './db';
import { contractRepo } from './contractRepo';
import { CONTRACT_DATA } from './contractData';

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
    },
    {
        id: 'fac_core',
        name: 'Центр адаптивной психофизиологии',
        type: 'research_center',
        description: 'Центральная лаборатория станции. Изучает предельные психофизиологические состояния и фобические отклики, запрашивая активов с выраженными аверсиями для продолжительной стимуляции.',
        meta: { approach: 'extreme', preferredStates: ['high_sensitivity', 'low_attitude', 'aversion'] }
    }
];

// ─── Стартовый набор контрактов ─────────────────────────────────────────────
// Единственный источник контента — CONTRACT_DATA (contractData.ts). Здесь
// перечислены только id, которые должны быть доступны сразу при старте;
// остальные выдаются динамическим пулом (contractPool) после 540-й минуты.

const STARTER_CONTRACT_IDS = [
    'contract_veil_exposure_01',
    'contract_veil_clinical_01',
    'contract_veil_forced_orgasm_01',
    'contract_helix_compliance_01',
    'contract_helix_restraint_01',
    'contract_helix_interface_01',
    'contract_continuum_pain_rewrite_01',
    'contract_continuum_relation_rewrite_01',
    'contract_continuum_orgasm_rewrite_01',
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

    // Стартовые контракты из единого каталога.
    const byId = new Map(CONTRACT_DATA.map(c => [c.id, c]));
    for (const id of STARTER_CONTRACT_IDS) {
        const c = byId.get(id);
        if (!c) {
            console.warn(`[SeedContracts] Стартовый контракт не найден в каталоге: ${id}`);
            continue;
        }
        // Content seeding must not reset a player's accepted/completed order
        // whenever the API process restarts.
        const existing = contractRepo.get(id);
        if (existing && existing.state !== 'available') continue;
        contractRepo.save({
            id: c.id,
            issuerId: c.issuerId,
            title: c.title,
            description: c.description,
            state: existing?.state || 'available',
            acceptedByPlayerId: undefined,
            attachedSubjectId: undefined,
            deadlineTick: undefined,
            format: c.format,
            durationMinutes: c.durationMinutes,
            offerDeadlineMinutes: c.offerDeadlineMinutes,
            return_profile: c.return_profile,
            conditions: c.conditions as any,
            rewards: c.rewards as any,
            penalties: c.penalties as any,
            difficulty: c.difficulty,
            cruelty: c.cruelty,
        });
    }
    console.log(`[SeedContracts] Загружено стартовых контрактов: ${STARTER_CONTRACT_IDS.length}`);
})();

console.log("[SeedContracts] Завершено.");
