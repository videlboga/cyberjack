// src/infrastructure/repositories.ts
import { db } from './db';
import { SubjectCoreState, SubjectPointState, PlayerState, Scene } from '../domain/types';

export const subjectRepo = {
    save(id: string, name: string, state: SubjectCoreState) {
        const stmt = db.prepare(`
            INSERT INTO subjects (id, name, sensitivity, capacity, openness, plasticity, attitude)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                sensitivity = excluded.sensitivity,
                capacity = excluded.capacity,
                openness = excluded.openness,
                plasticity = excluded.plasticity,
                attitude = excluded.attitude
        `);
        stmt.run(id, name, state.sensitivity, state.capacity, state.openness, state.plasticity, state.attitude);
    },
    
    get(id: string): (SubjectCoreState & { name: string, id?: string }) | null {
        const stmt = db.prepare('SELECT * FROM subjects WHERE id = ?');
        const row = stmt.get(id) as any;
        if (!row) return null;
        return {
            id: row.id,
            name: row.name,
            sensitivity: row.sensitivity,
            capacity: row.capacity,
            openness: row.openness,
            plasticity: row.plasticity,
            attitude: row.attitude
        };
    },

    getWithPoint(id: string, pointId: string): any {
        const stateObj = db.prepare('SELECT * FROM subjects WHERE id = ?').get(id);
        const pointObj = db.prepare('SELECT * FROM subject_point_states WHERE subject_id = ? AND point_id = ?').get(id, pointId);
        if (!stateObj) return null;
        return { ...(stateObj as object), point: pointObj };
    },

    getUIState(id: string, pointId: string): any {
        const subject = this.getWithPoint(id, pointId);
        const actions = db.prepare('SELECT id, label FROM action_presets').all();
        const points = db.prepare('SELECT p.id, p.label FROM point_presets p JOIN subject_point_states sps ON p.id = sps.point_id WHERE sps.subject_id = ?').all(id);
        
        return {
            subject,
            availableActions: actions,
            availablePoints: points
        };
    }
};

export const pointStateRepo = {
    save(subjectId: string, pointId: string, state: SubjectPointState) {
        const stmt = db.prepare(`
            INSERT INTO subject_point_states (subject_id, point_id, local_sensitivity, local_attitude)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(subject_id, point_id) DO UPDATE SET
                local_sensitivity = excluded.local_sensitivity,
                local_attitude = excluded.local_attitude
        `);
        stmt.run(subjectId, pointId, state.localSensitivity, state.localAttitude);
    },
    
    get(subjectId: string, pointId: string): SubjectPointState | null {
        const stmt = db.prepare('SELECT * FROM subject_point_states WHERE subject_id = ? AND point_id = ?');
        const row = stmt.get(subjectId, pointId) as any;
        if (!row) return null;
        return {
            localSensitivity: row.local_sensitivity,
            localAttitude: row.local_attitude
        };
    }
};

export const eventLogRepo = {
    append(subjectId: string, actionType: string, actionPayload: any, resultPayload: any) {
        const stmt = db.prepare(`
            INSERT INTO event_logs (subject_id, action_type, action_payload, result_payload)
            VALUES (?, ?, ?, ?)
        `);
        stmt.run(subjectId, actionType, JSON.stringify(actionPayload), JSON.stringify(resultPayload));
    }
};

export const presetRepo = {
    saveActionPreset(id: string, label: string, values: any) {
        const stmt = db.prepare(`
            INSERT INTO action_presets (id, label, values_json)
            VALUES (?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                label = excluded.label,
                values_json = excluded.values_json
        `);
        stmt.run(id, label, JSON.stringify(values));
    },
    getActionPreset(id: string): any | null {
        const stmt = db.prepare('SELECT * FROM action_presets WHERE id = ?');
        const row = stmt.get(id) as any;
        if (!row) return null;
        return JSON.parse(row.values_json);
    },
    
    savePointPreset(preset: any) {
        const stmt = db.prepare(`
            INSERT INTO point_presets (id, label, values_json, parent_id, provides_functions, tags)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                label = excluded.label,
                values_json = excluded.values_json,
                parent_id = excluded.parent_id,
                provides_functions = excluded.provides_functions,
                tags = excluded.tags
        `);
        stmt.run(preset.id, preset.label, JSON.stringify(preset.values || {}), preset.parentId || null, JSON.stringify(preset.providesFunctions || []), JSON.stringify(preset.tags || []));
    },
    getPointPreset(id: string): any | null {
        const stmt = db.prepare('SELECT * FROM point_presets WHERE id = ?');
        const row = stmt.get(id) as any;
        if (!row) return null;
        return {
            id: row.id,
            label: row.label,
            values: JSON.parse(row.values_json),
            parentId: row.parent_id,
            providesFunctions: JSON.parse(row.provides_functions || '[]'),
            tags: JSON.parse(row.tags || '[]')
        };
    },
    getAllPointPresets(): any[] {
        const stmt = db.prepare('SELECT * FROM point_presets');
        const rows = stmt.all() as any[];
        return rows.map(row => ({
            id: row.id,
            label: row.label,
            values: JSON.parse(row.values_json),
            parentId: row.parent_id,
            providesFunctions: JSON.parse(row.provides_functions || '[]'),
            tags: JSON.parse(row.tags || '[]')
        }));
    },

    saveContextPreset(preset: any) {
        const stmt = db.prepare(`
            INSERT INTO context_presets (id, label, point_id, modifiers_json, type, slot, exclusive_within_slot, blocks_slots, affected_point_ids, blocked_functions, boosted_functions, required_functions, priority)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                label = excluded.label,
                point_id = excluded.point_id,
                modifiers_json = excluded.modifiers_json,
                type = excluded.type,
                slot = excluded.slot,
                exclusive_within_slot = excluded.exclusive_within_slot,
                blocks_slots = excluded.blocks_slots,
                affected_point_ids = excluded.affected_point_ids,
                blocked_functions = excluded.blocked_functions,
                boosted_functions = excluded.boosted_functions,
                required_functions = excluded.required_functions,
                priority = excluded.priority
        `);
        stmt.run(
            preset.id, preset.label, preset.point_id || 'general', JSON.stringify(preset.modifiers || {}),
            preset.type || 'condition', preset.slot || 'general', preset.exclusiveWithinSlot ? 1 : 0,
            JSON.stringify(preset.blocksSlots || []), JSON.stringify(preset.affectedPointIds || []),
            JSON.stringify(preset.blockedFunctions || []), JSON.stringify(preset.boostedFunctions || []),
            JSON.stringify(preset.requiredFunctions || []), preset.priority || 0
        );
    },
    getContextPreset(id: string): any | null {
        const stmt = db.prepare('SELECT * FROM context_presets WHERE id = ?');
        const row = stmt.get(id) as any;
        if (!row) return null;
        return { 
            id: row.id, label: row.label, point_id: row.point_id, 
            modifiers: JSON.parse(row.modifiers_json),
            type: row.type, slot: row.slot, exclusiveWithinSlot: row.exclusive_within_slot === 1,
            blocksSlots: JSON.parse(row.blocks_slots || '[]'),
            affectedPointIds: JSON.parse(row.affected_point_ids || '[]'),
            blockedFunctions: JSON.parse(row.blocked_functions || '[]'),
            boostedFunctions: JSON.parse(row.boosted_functions || '[]'),
            requiredFunctions: JSON.parse(row.required_functions || '[]'),
            priority: row.priority
        };
    },

    getAllContextPresetsFull(): any[] {
        const stmt = db.prepare('SELECT * FROM context_presets');
        return stmt.all().map((row: any) => ({
            id: row.id, label: row.label, point_id: row.point_id,
            modifiers: JSON.parse(row.modifiers_json),
            type: row.type, slot: row.slot, exclusiveWithinSlot: row.exclusive_within_slot === 1,
            blocksSlots: JSON.parse(row.blocks_slots || '[]'),
            affectedPointIds: JSON.parse(row.affected_point_ids || '[]'),
            blockedFunctions: JSON.parse(row.blocked_functions || '[]'),
            boostedFunctions: JSON.parse(row.boosted_functions || '[]'),
            requiredFunctions: JSON.parse(row.required_functions || '[]'),
            priority: row.priority
        }));
    },    getAllContextPresets(): { id: string, label: string, point_id: string }[] {
        const stmt = db.prepare('SELECT id, label, point_id FROM context_presets');
        return stmt.all() as { id: string, label: string, point_id: string }[];
    },

    pointPresetExists(id: string): boolean {
        const row = db.prepare('SELECT 1 FROM point_presets WHERE id = ?').get(id);
        return !!row;
    }
};

export const activeContextsRepo = {
    add(eventId: string, contextId: string, duration: number = -1) {
        const stmt = db.prepare(`
            INSERT INTO active_contexts (event_id, context_id, duration)
            VALUES (?, ?, ?)
            ON CONFLICT(event_id, context_id) DO UPDATE SET duration = excluded.duration
        `);
        stmt.run(eventId, contextId, duration);
    },
    getAllForEvent(eventId: string): { id: string, ticks: number }[] {
        const stmt = db.prepare('SELECT context_id, coalesce(ticks_active, 0) as ticks_active FROM active_contexts WHERE event_id = ?');
        const rows = stmt.all(eventId) as any[];
        return rows.map(r => ({ id: r.context_id, ticks: r.ticks_active }));
    },
    incrementTicks(eventId: string) {
        const stmt = db.prepare('UPDATE active_contexts SET ticks_active = ticks_active + 1 WHERE event_id = ?');
        stmt.run(eventId);
    },
    remove(eventId: string, contextId: string) {
        const stmt = db.prepare('DELETE FROM active_contexts WHERE event_id = ? AND context_id = ?');
        stmt.run(eventId, contextId);
    }
};

export const playerRepo = {
    save(player: PlayerState) {
        const stmt = db.prepare(`
            INSERT INTO players (id, resources)
            VALUES (?, ?)
            ON CONFLICT(id) DO UPDATE SET resources = excluded.resources
        `);
        stmt.run(player.id, JSON.stringify(player.resources));
    },
    get(id: string): PlayerState | null {
        const stmt = db.prepare('SELECT * FROM players WHERE id = ?');
        const row = stmt.get(id) as any;
        if (!row) return null;
        return {
            id: row.id,
            resources: JSON.parse(row.resources)
        };
    }
};

export const sceneRepo = {
    save(scene: Scene) {
        const stmt = db.prepare(`
            INSERT INTO scenes (id, available_actions)
            VALUES (?, ?)
            ON CONFLICT(id) DO UPDATE SET available_actions = excluded.available_actions
        `);
        stmt.run(scene.id, JSON.stringify(scene.availableActions));
    },
    get(id: string): Scene | null {
        const stmt = db.prepare('SELECT * FROM scenes WHERE id = ?');
        const row = stmt.get(id) as any;
        if (!row) return null;
        return {
            id: row.id,
            availableActions: JSON.parse(row.available_actions)
        };
    }
};
