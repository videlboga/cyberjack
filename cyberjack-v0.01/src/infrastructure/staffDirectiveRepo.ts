import { db } from './db';

export interface StaffDirective {
    id: number;
    playerId: string;
    /** Исполнитель алгоритма: любой персонаж (сотрудник или актив). */
    executorId: string;
    subjectId: string;
    contractId?: string;
    goal: string;
    spec?: DirectiveSpec;
    status: 'active' | 'completed' | 'cancelled';
    createdMinute: number;
    updatedMinute?: number;
}

/**
 * Спецификация алгоритма, который сотрудник выполняет автономно.
 * Поле `kind` определяет тип алгоритма; остальные поля — параметры.
 */
export type DirectiveSpec =
    | { kind: 'contract'; contractId: string }
    | { kind: 'sequence'; actions: { actionId: string; pointId?: string; repeats?: number }[] }
    | { kind: 'category'; tags: string[]; repeats?: number }
    | {
          kind: 'condition';
          /** Действие, выполняемое пока условие истинно. */
          actionId: string;
          pointId?: string;
          /** Условие: метрика и порог. */
          metric: 'sensitivity' | 'capacity' | 'tension' | 'attitude' | 'openness' | 'plasticity';
          operator: '>=' | '<=' | '>';
          value: number;
          /** Действие, выполняемое когда условие ложно (опционально). */
          elseActionId?: string;
      };

const mapRow = (r: any): StaffDirective => ({
    id: r.id,
    playerId: r.player_id,
    executorId: r.staff_id,
    subjectId: r.subject_id,
    contractId: r.contract_id || undefined,
    goal: r.goal,
    spec: r.spec ? JSON.parse(r.spec) : undefined,
    status: r.status,
    createdMinute: r.created_minute,
    updatedMinute: r.updated_minute ?? undefined,
});

export const staffDirectiveRepo = {
    /** Активные указания для исполнителя (сотрудник или актив). */
    listActiveForExecutor(executorId: string, playerId = 'PL-1'): StaffDirective[] {
        const rows = db.prepare(`
            SELECT * FROM staff_directives
            WHERE player_id = ? AND staff_id = ? AND status = 'active'
            ORDER BY created_minute
        `).all(playerId, executorId) as any[];
        return rows.map(mapRow);
    },

    /** Активные указания на конкретного актива. */
    listActiveForSubject(subjectId: string, playerId = 'PL-1'): StaffDirective[] {
        const rows = db.prepare(`
            SELECT * FROM staff_directives
            WHERE player_id = ? AND subject_id = ? AND status = 'active'
            ORDER BY created_minute
        `).all(playerId, subjectId) as any[];
        return rows.map(mapRow);
    },

    /** Все активные указания (для автономного тика). */
    listAllActive(playerId = 'PL-1'): StaffDirective[] {
        const rows = db.prepare(`
            SELECT * FROM staff_directives
            WHERE player_id = ? AND status = 'active'
            ORDER BY created_minute
        `).all(playerId) as any[];
        return rows.map(mapRow);
    },

    /** Выдать поручение исполнителю. Идемпотентно по (executor, subject, contract). */
    assign(input: {
        executorId: string;
        subjectId: string;
        contractId?: string;
        goal: string;
        spec?: DirectiveSpec;
        playerId?: string;
    }): StaffDirective {
        const playerId = input.playerId || 'PL-1';
        const now = Number((db.prepare(`SELECT total_minutes FROM world_state WHERE id = 'main'`).get() as any)?.total_minutes || 0);
        const specJson = input.spec ? JSON.stringify(input.spec) : null;
        db.prepare(`
            INSERT INTO staff_directives (player_id, staff_id, subject_id, contract_id, goal, spec, status, created_minute)
            VALUES (?, ?, ?, ?, ?, ?, 'active', ?)
            ON CONFLICT(player_id, staff_id, subject_id, contract_id) DO UPDATE SET
                goal = excluded.goal, spec = excluded.spec, status = 'active', updated_minute = excluded.created_minute
        `).run(playerId, input.executorId, input.subjectId, input.contractId || null, input.goal, specJson, now);
        const row = db.prepare(`
            SELECT * FROM staff_directives
            WHERE player_id = ? AND staff_id = ? AND subject_id = ? AND contract_id IS ?
        `).get(playerId, input.executorId, input.subjectId, input.contractId || null) as any;
        return mapRow(row);
    },

    /** Завершить указание. */
    complete(id: number): void {
        const now = Number((db.prepare(`SELECT total_minutes FROM world_state WHERE id = 'main'`).get() as any)?.total_minutes || 0);
        db.prepare(`UPDATE staff_directives SET status = 'completed', updated_minute = ? WHERE id = ?`).run(now, id);
    },

    /** Отменить указание. */
    cancel(id: number): void {
        const now = Number((db.prepare(`SELECT total_minutes FROM world_state WHERE id = 'main'`).get() as any)?.total_minutes || 0);
        db.prepare(`UPDATE staff_directives SET status = 'cancelled', updated_minute = ? WHERE id = ?`).run(now, id);
    },
};
