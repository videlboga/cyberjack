import { beforeEach, describe, expect, it } from 'vitest';
import '../infrastructure/seed';
import { db } from '../infrastructure/db';
import { resourceRepo, characterItemsRepo, subjectRepo, activeContextsRepo } from '../infrastructure/repositories';
import { advanceWorldTime, ensureWorldSeed, getWorldClock } from '../scenario/worldService';
import { resetWorldSeed } from '../scenario/worldService';

beforeEach(() => {
    resetWorldSeed();
    ensureWorldSeed();
    db.prepare('DELETE FROM character_resources WHERE character_id = ?').run('PL-1');
    db.prepare('DELETE FROM character_items WHERE character_id = ?').run('PL-1');
    db.prepare('DELETE FROM subjects WHERE id = ?').run('SUB-ECO');
    db.prepare('DELETE FROM characters WHERE id = ?').run('SUB-ECO');
    db.prepare('DELETE FROM laboratory_room_assignments WHERE player_id = ?').run('PL-1');
    db.prepare(`UPDATE world_state SET total_minutes = 480, last_upkeep_day = 1 WHERE id = 'main'`).run();
});

const credits = () => {
    const row = db.prepare('SELECT amount FROM character_resources WHERE character_id = ? AND resource_key = ?').get('PL-1', 'credits') as any;
    return row ? Number(row.amount) : 0;
};

describe('Этап 4: экономика', () => {
    it('списывает ежедневное содержание при смене дня (фикс + за активов)', () => {
        resourceRepo.save({ id: 'PL-1', resources: { credits: { characterId: 'PL-1', resourceKey: 'credits', amount: 1000 } } });
        // День 1 (480 мин). Переходим на день 2 (1440 мин) — списание должно сработать.
        advanceWorldTime(1440 - 480, 'test');
        // Без активов в лаборатории: 1000 - 30 (базовая ставка) = 970
        expect(credits()).toBe(970);
    });

    it('не списывает повторно в тот же день', () => {
        resourceRepo.save({ id: 'PL-1', resources: { credits: { characterId: 'PL-1', resourceKey: 'credits', amount: 1000 } } });
        advanceWorldTime(1440 - 480, 'test'); // день 2
        const afterFirst = credits();
        advanceWorldTime(60, 'test'); // ещё час в день 2
        expect(credits()).toBe(afterFirst); // не списано повторно
    });

    it('капсула без ампулы восстанавливает медленнее, с ампулой — быстрее', () => {
        subjectRepo.save('SUB-ECO', 'Тест', {
            sensitivity: 50, capacity: 10, openness: 50, plasticity: 50, attitude: 50,
            tension: 80, baselineCapacity: 60,
        });
        // Помещаем в капсулу
        db.prepare(`INSERT INTO laboratory_assets (player_id, asset_id, name, description, state, metadata)
            VALUES ('PL-1', 'lab_recovery_capsule', 'Капсула', '', 'installed', ?)
            ON CONFLICT(player_id, asset_id) DO UPDATE SET metadata = excluded.metadata`).run(JSON.stringify({ subjectId: 'SUB-ECO' }));

        // Без ампулы: 1 час → +3 capacity (базовый темп)
        advanceWorldTime(60, 'test');
        let core = subjectRepo.get('SUB-ECO')!;
        const noAmpoule = core.capacity;
        expect(noAmpoule).toBe(13); // 10 + 3

        // С ампулой: контекст Regen-R активен (эффект на сутки) → +8 capacity
        activeContextsRepo.add('ctx-regen', 'SUB-ECO', 'capsule_infusion_regenerative', 1440, 'global', 'PL-1');
        advanceWorldTime(60, 'test');
        core = subjectRepo.get('SUB-ECO')!;
        expect(core.capacity).toBe(21); // 13 + 8
    });
});
