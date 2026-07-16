// src/infrastructure/repositories.ts
import { db } from './db';
import { SubjectCoreState, SubjectPointState, ResourceState, Scene, Character, CharacterRelation, SceneCharacterPresence } from '../domain/types';
import { applyDecayLevel, clamp } from '../engine/utils';

const mapCharacter = (row: any): Character => ({
    id: row.id,
    name: row.name,
    kind: row.kind,
    subjectId: row.subject_id,
    playerId: row.player_id,
    currentSceneId: row.current_scene_id,
    profileJson: row.profile_json || null
});

const mapRelation = (row: any): CharacterRelation => ({
    fromId: row.from_id,
    toId: row.to_id,
    knows: Boolean(row.knows),
    present: Boolean(row.present),
    canInteract: Boolean(row.can_interact),
    attitude: row.attitude,
    openness: row.openness ?? 0,
    plasticity: row.plasticity ?? 0,
    familiarityLevel: row.familiarity_level ?? 0,
    generalOpinion: row.general_opinion,
    recentMemories: row.recent_memories ? JSON.parse(row.recent_memories) : [],
    baselineAttitude: row.baseline_attitude,
    baselineOpenness: row.baseline_openness,
    baselinePlasticity: row.baseline_plasticity,
    target: row.target_id
        ? {
              id: row.target_id,
              name: row.target_name,
              kind: row.target_kind,
              subjectId: row.target_subject_id,
              playerId: row.target_player_id
          }
        : undefined
});

export const characterItemsRepo = {
    save(item: { characterId: string; itemId: string; state?: string; charges?: number; metadata?: Record<string, unknown> }) {
        db.prepare(`
            INSERT INTO character_items (character_id, item_id, state, charges, metadata)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(character_id, item_id) DO UPDATE SET
                state = excluded.state,
                charges = excluded.charges,
                metadata = excluded.metadata
        `).run(
            item.characterId, 
            item.itemId, 
            item.state || 'active', 
            item.charges ?? -1, 
            JSON.stringify(item.metadata || {})
        );
    },
    get(characterId: string, itemId: string): { characterId: string; itemId: string; state: string; charges: number; metadata: Record<string, unknown> } | null {
        const row = db.prepare('SELECT * FROM character_items WHERE character_id = ? AND item_id = ?').get(characterId, itemId) as any;
        if (!row) return null;
        return {
            characterId: row.character_id,
            itemId: row.item_id,
            state: row.state,
            charges: row.charges,
            metadata: JSON.parse(row.metadata || '{}')
        };
    },
    listFor(characterId: string) {
        return db.prepare('SELECT * FROM character_items WHERE character_id = ?').all(characterId).map((row: any) => ({
            characterId: row.character_id,
            itemId: row.item_id,
            state: row.state,
            charges: row.charges,
            metadata: JSON.parse(row.metadata || '{}')
        }));
    },
    remove(characterId: string, itemId: string) {
        db.prepare('DELETE FROM character_items WHERE character_id = ? AND item_id = ?').run(characterId, itemId);
    }
};

export const itemRepo = {
    getAll(): { id: string; name: string; type: string; tags: string[]; description: string }[] {
        return db.prepare('SELECT * FROM items').all().map((row: any) => ({
            id: row.id,
            name: row.name,
            type: row.type,
            tags: row.tags ? JSON.parse(row.tags) : [],
            description: row.description || ''
        }));
    },
    get(id: string): { id: string; name: string; type: string; tags: string[]; description: string } | null {
        const row = db.prepare('SELECT * FROM items WHERE id = ?').get(id) as any;
        if (!row) return null;
        return {
            id: row.id,
            name: row.name,
            type: row.type,
            tags: row.tags ? JSON.parse(row.tags) : [],
            description: row.description || ''
        };
    }
};

export const sceneObjectsRepo = {
    save(obj: { id: string; sceneId: string; nodeId?: string; itemId: string; ownerId?: string; state?: string; metadata?: Record<string, unknown> }) {
        db.prepare(`
            INSERT INTO scene_objects (id, scene_id, node_id, item_id, owner_id, state, metadata)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                node_id = excluded.node_id,
                item_id = excluded.item_id,
                owner_id = excluded.owner_id,
                state = excluded.state,
                metadata = excluded.metadata
        `).run(
            obj.id,
            obj.sceneId,
            obj.nodeId || null,
            obj.itemId,
            obj.ownerId || null,
            obj.state || 'active',
            JSON.stringify(obj.metadata || {})
        );
    },
    get(id: string) {
        const row = db.prepare('SELECT * FROM scene_objects WHERE id = ?').get(id) as any;
        if (!row) return null;
        return {
            id: row.id,
            sceneId: row.scene_id,
            nodeId: row.node_id,
            itemId: row.item_id,
            ownerId: row.owner_id,
            state: row.state,
            metadata: JSON.parse(row.metadata || '{}')
        };
    },
    listForScene(sceneId: string) {
        return db.prepare('SELECT * FROM scene_objects WHERE scene_id = ?').all(sceneId).map((row: any) => ({
            id: row.id,
            sceneId: row.scene_id,
            nodeId: row.node_id,
            itemId: row.item_id,
            ownerId: row.owner_id,
            state: row.state,
            metadata: JSON.parse(row.metadata || '{}')
        }));
    },
    remove(id: string) {
        db.prepare('DELETE FROM scene_objects WHERE id = ?').run(id);
    }
};

export const sceneLayoutsRepo = {
    save(sceneId: string, layout: { nodes: any[]; edges: any[] }) {
        db.prepare(`
            INSERT INTO scene_layouts (scene_id, layout_json)
            VALUES (?, ?)
            ON CONFLICT(scene_id) DO UPDATE SET layout_json = excluded.layout_json
        `).run(sceneId, JSON.stringify(layout));
    },
    get(sceneId: string): { sceneId: string; nodes: any[]; edges: any[] } | null {
        const row = db.prepare('SELECT * FROM scene_layouts WHERE scene_id = ?').get(sceneId) as any;
        if (!row) return null;
        return {
            sceneId: row.scene_id,
            ...JSON.parse(row.layout_json)
        };
    }
};

export const characterRepo = {
    ensureSubject(subjectId: string, name: string): Character {
    const stmt = db.prepare(`
            INSERT INTO characters (id, name, kind, subject_id)
            VALUES (?, ?, 'subject', ?)
            ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                subject_id = excluded.subject_id
        `);
        stmt.run(subjectId, name, subjectId);
        return this.get(subjectId)!;
    },
    ensureCharacter(playerId: string, name: string): Character {
        const stmt = db.prepare(`
            INSERT INTO characters (id, name, kind, player_id)
            VALUES (?, ?, 'player', ?)
            ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                kind = excluded.kind,
                player_id = excluded.player_id
        `);
        stmt.run(playerId, name, playerId);
        return this.get(playerId)!;
    },
    ensurePlayer(playerId: string, name: string): Character {
        const stmt = db.prepare(`
            INSERT INTO characters (id, name, kind, player_id)
            VALUES (?, ?, 'player', ?)
            ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                kind = excluded.kind,
                player_id = excluded.player_id
        `);
        stmt.run(playerId, name, playerId);
        return this.get(playerId)!;
    },
    get(id: string): Character | null {
        const row = db.prepare('SELECT * FROM characters WHERE id = ?').get(id);
        return row ? mapCharacter(row) : null;
    },
    listByIds(ids: string[]): Character[] {
        if (!ids.length) return [];
        const placeholders = ids.map(() => '?').join(',');
        const rows = db.prepare(`SELECT * FROM characters WHERE id IN (${placeholders})`).all(...ids);
        return rows.map(mapCharacter);
    },
    listAll(): Character[] {
        const rows = db.prepare('SELECT * FROM characters').all();
        return rows.map(mapCharacter);
    },
    updateLocation(id: string, sceneId: string | null) {
        db.prepare('UPDATE characters SET current_scene_id = ? WHERE id = ?').run(sceneId, id);
    }
};

export const characterRelationRepo = {
    ensure(fromId: string, toId: string, defaults?: Partial<CharacterRelation>): CharacterRelation {
        const existing = db.prepare(
            `SELECT cr.*, c.id as target_id, c.name as target_name, c.kind as target_kind, c.subject_id as target_subject_id, c.player_id as target_player_id
             FROM character_relations cr LEFT JOIN characters c ON c.id = cr.to_id
             WHERE cr.from_id = ? AND cr.to_id = ?`
        ).get(fromId, toId);
        if (existing) return mapRelation(existing);
        const stmt = db.prepare(`
            INSERT INTO character_relations (from_id, to_id, knows, present, can_interact, attitude, openness, plasticity, baseline_attitude, baseline_openness, baseline_plasticity, familiarity_level, general_opinion, recent_memories)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, '', '[]')
        `);
        stmt.run(
            fromId,
            toId,
            defaults?.knows === false ? 0 : 1,
            defaults?.present === false ? 0 : 1,
            defaults?.canInteract === false ? 0 : 1,
            defaults?.attitude ?? 50,
            defaults?.openness ?? 0,
            defaults?.plasticity ?? 0,
            defaults?.baselineAttitude ?? defaults?.attitude ?? 50,
            defaults?.baselineOpenness ?? defaults?.openness ?? 0,
            defaults?.baselinePlasticity ?? defaults?.plasticity ?? 0
        );
        return this.get(fromId, toId)!;
    },
    get(fromId: string, toId: string): CharacterRelation | null {
        const row = db.prepare(
            `SELECT cr.*, c.id as target_id, c.name as target_name, c.kind as target_kind, c.subject_id as target_subject_id, c.player_id as target_player_id
             FROM character_relations cr LEFT JOIN characters c ON c.id = cr.to_id
             WHERE cr.from_id = ? AND cr.to_id = ?`
        ).get(fromId, toId);
        return row ? mapRelation(row) : null;
    },
    listFor(fromId: string): CharacterRelation[] {
        const stmt = db.prepare(
            `SELECT cr.*, c.id as target_id, c.name as target_name, c.kind as target_kind, c.subject_id as target_subject_id, c.player_id as target_player_id
             FROM character_relations cr LEFT JOIN characters c ON c.id = cr.to_id
             WHERE cr.from_id = ?`
        );
        const rows = stmt.all(fromId);
        return rows.map(mapRelation);
    },
    
    updateSocialStats(fromId: string, toId: string, stats: { familiarityDelta: number, generalOpinion?: string, newMemory?: string }) {
        const existing = this.ensure(fromId, toId);
        
        const newFam = existing.familiarityLevel !== undefined ? Math.min(1.0, existing.familiarityLevel + stats.familiarityDelta) : stats.familiarityDelta;
        let opinion = stats.generalOpinion || existing.generalOpinion || '';
        
        let mems = existing.recentMemories || [];
        if (stats.newMemory) {
             mems.push(stats.newMemory);
             if (mems.length > 5) mems.shift(); // Keep only last 5 
        }
        
        const stmt = db.prepare(`
            UPDATE character_relations 
            SET familiarity_level = ?,
                general_opinion = ?,
                recent_memories = ?
            WHERE from_id = ? AND to_id = ?
        `);
        stmt.run(newFam, opinion, JSON.stringify(mems), fromId, toId);
    },
    updateAttitude(fromId: string, toId: string, attitude: number, options?: { baselineAttitude?: number, openness?: number, plasticity?: number }) {
        this.ensure(fromId, toId);
        const stmt = db.prepare(`
            UPDATE character_relations 
            SET attitude = COALESCE(?, attitude),
                baseline_attitude = COALESCE(?, baseline_attitude),
                openness = COALESCE(?, openness),
                plasticity = COALESCE(?, plasticity)
            WHERE from_id = ? AND to_id = ?
        `);
        stmt.run(
            attitude,
            options?.baselineAttitude ?? null,
            options?.openness ?? null,
            options?.plasticity ?? null,
            fromId,
            toId
        );
    },
    updateFlags(fromId: string, toId: string, flags: Partial<Pick<CharacterRelation, 'knows' | 'present' | 'canInteract'>>) {
        const current = this.ensure(fromId, toId);
        const stmt = db.prepare(
            `UPDATE character_relations SET knows = ?, present = ?, can_interact = ? WHERE from_id = ? AND to_id = ?`
        );
        stmt.run(
            flags.knows === undefined ? (current.knows ? 1 : 0) : flags.knows ? 1 : 0,
            flags.present === undefined ? (current.present ? 1 : 0) : flags.present ? 1 : 0,
            flags.canInteract === undefined ? (current.canInteract ? 1 : 0) : flags.canInteract ? 1 : 0,
            fromId,
            toId
        );
    }
};

export const subjectRepo = {
    save(id: string, name: string, state: SubjectCoreState) {
        const baselineSensitivity = state.baselineSensitivity ?? state.sensitivity;
        const baselineCapacity = state.baselineCapacity ?? state.capacity;
        const baselineOpenness = state.baselineOpenness ?? state.openness;
        const baselinePlasticity = state.baselinePlasticity ?? state.plasticity;
        const baselineAttitude = state.baselineAttitude ?? state.attitude;
        
        let preferences = '{}';
        if (state.preferences !== undefined) {
            try {
                const parsed = typeof state.preferences === 'string' ? JSON.parse(state.preferences) : state.preferences;
                const hasAny = (obj: any) => obj && Object.keys(obj).length > 0;
                const meaningful = hasAny(parsed.actions) || hasAny(parsed.points) || hasAny(parsed.contexts);
                if (meaningful) {
                    preferences = typeof state.preferences === 'string' ? state.preferences : JSON.stringify(parsed);
                } else {
                    // treat empty prefs as not provided -> preserve existing
                    const existing = db.prepare('SELECT preferences FROM subjects WHERE id = ?').get(id) as any;
                    if (existing && existing.preferences) preferences = existing.preferences;
                }
            } catch (e) {
                // If parse failed, just preserve existing
                const existing = db.prepare('SELECT preferences FROM subjects WHERE id = ?').get(id) as any;
                if (existing && existing.preferences) preferences = existing.preferences;
            }
        } else {
            const existing = db.prepare('SELECT preferences FROM subjects WHERE id = ?').get(id) as any;
            if (existing && existing.preferences) preferences = existing.preferences;
        }
        // Use a guarded upsert: only overwrite preferences when the incoming value is not the empty literal
        // This prevents accidental wipes when callers pass '{}' or other empty markers.
        const stmt = db.prepare(`
            INSERT INTO subjects (id, name, sensitivity, capacity, openness, plasticity, attitude, tension, preferences, baseline_sensitivity, baseline_capacity, baseline_openness, baseline_plasticity, baseline_attitude)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                sensitivity = excluded.sensitivity,
                capacity = excluded.capacity,
                openness = excluded.openness,
                plasticity = excluded.plasticity,
                attitude = excluded.attitude,
                tension = excluded.tension,
                preferences = CASE WHEN excluded.preferences = '{}' THEN subjects.preferences ELSE excluded.preferences END,
                baseline_sensitivity = excluded.baseline_sensitivity,
                baseline_capacity = excluded.baseline_capacity,
                baseline_openness = excluded.baseline_openness,
                baseline_plasticity = excluded.baseline_plasticity,
                baseline_attitude = excluded.baseline_attitude
        `);
        stmt.run(
            id,
            name,
            state.sensitivity,
            state.capacity,
            state.openness,
            state.plasticity,
            state.attitude,
            state.tension ?? 0,
            preferences,
            baselineSensitivity,
            baselineCapacity,
            baselineOpenness,
            baselinePlasticity,
            baselineAttitude
        );
        characterRepo.ensureSubject(id, name);
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
            attitude: row.attitude,
            tension: row.tension || 0,
            preferences: row.preferences || '{}',
            baselineSensitivity: row.baseline_sensitivity,
            baselineCapacity: row.baseline_capacity,
            baselineOpenness: row.baseline_openness,
            baselinePlasticity: row.baseline_plasticity,
            baselineAttitude: row.baseline_attitude
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
        const points = db.prepare('SELECT p.id, p.label, sps.local_sensitivity, sps.local_attitude, sps.local_openness, sps.familiarity, sps.exposure_count FROM point_presets p JOIN subject_point_states sps ON p.id = sps.point_id WHERE sps.subject_id = ?').all(id);

        return {
            subject,
            availableActions: actions,
            availablePoints: points
        };
    }
};

export const subjectPreferencesRepo = {
    get(subjectId: string): { actions: Record<string, number>; points: Record<string, number>; contexts: Record<string, number> } {
        const row = db.prepare('SELECT preferences FROM subjects WHERE id = ?').get(subjectId) as any;
        if (!row || !row.preferences) return { actions: {}, points: {}, contexts: {} };
        try {
            const parsed = JSON.parse(row.preferences);
            return {
                actions: parsed.actions || {},
                points: parsed.points || {},
                contexts: parsed.contexts || {}
            };
        } catch (e) {
            return { actions: {}, points: {}, contexts: {} };
        }
    },
    set(subjectId: string, prefs: { actions?: Record<string, number>; points?: Record<string, number>; contexts?: Record<string, number> }) {
        const asJson = JSON.stringify({ actions: prefs.actions || {}, points: prefs.points || {}, contexts: prefs.contexts || {} });
        db.prepare('UPDATE subjects SET preferences = ? WHERE id = ?').run(asJson, subjectId);
    },
    /** Adjust a single preference entry by delta and clamp to [-5,5] */
    adjust(subjectId: string, category: 'actions' | 'points' | 'contexts', key: string, delta: number) {
        const prefs = this.get(subjectId);
        const bucket = (prefs as any)[category] as Record<string, number>;
        const current = bucket[key] ?? 0;
        const next = Math.max(-5, Math.min(5, current + delta));
        bucket[key] = next;
        this.set(subjectId, prefs);
        return next;
    }
};

export const pointStateRepo = {
    save(subjectId: string, pointId: string, state: SubjectPointState) {
        const canonicalPointId = pointId.trim().toLowerCase();
        const baselineLocalSensitivity = state.baselineLocalSensitivity ?? state.localSensitivity;
        const baselineLocalAttitude = state.baselineLocalAttitude ?? state.localAttitude;
        const baselineLocalOpenness = state.baselineLocalOpenness ?? state.localOpenness ?? 50;
        const stmt = db.prepare(`
            INSERT INTO subject_point_states (subject_id, point_id, local_sensitivity, local_attitude, local_openness, familiarity, exposure_count, baseline_local_sensitivity, baseline_local_attitude, baseline_local_openness)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(subject_id, point_id) DO UPDATE SET
                local_sensitivity = excluded.local_sensitivity,
                local_attitude = excluded.local_attitude,
                local_openness = excluded.local_openness,
                familiarity = excluded.familiarity,
                exposure_count = excluded.exposure_count,
                baseline_local_sensitivity = excluded.baseline_local_sensitivity,
                baseline_local_attitude = excluded.baseline_local_attitude,
                baseline_local_openness = excluded.baseline_local_openness
        `);
        stmt.run(
            subjectId,
            canonicalPointId,
            state.localSensitivity,
            state.localAttitude,
            state.localOpenness ?? 50,
            state.familiarity ?? 0,
            state.exposureCount ?? 0,
            baselineLocalSensitivity,
            baselineLocalAttitude,
            baselineLocalOpenness
        );
    },
    
    getAllForSubject(subjectId: string): SubjectPointState[] {
        const stmt = db.prepare('SELECT * FROM subject_point_states WHERE subject_id = ?');
        const rows = stmt.all(subjectId) as any[];
        return rows.map((row: any) => ({
            pointId: row.point_id,
            localSensitivity: row.local_sensitivity,
            localAttitude: row.local_attitude,
            localOpenness: row.local_openness ?? 50,
            familiarity: row.familiarity ?? 0,
            exposureCount: row.exposure_count ?? 0,
            baselineLocalSensitivity: row.baseline_local_sensitivity,
            baselineLocalAttitude: row.baseline_local_attitude,
            baselineLocalOpenness: row.baseline_local_openness
        }));
    },

    get(subjectId: string, pointId: string): SubjectPointState | null {
        const stmt = db.prepare('SELECT * FROM subject_point_states WHERE subject_id = ? AND point_id = ?');
        const row = stmt.get(subjectId, pointId.trim().toLowerCase()) as any;
        if (!row) return null;
        return {
            pointId: row.point_id,
            localSensitivity: row.local_sensitivity,
            localAttitude: row.local_attitude,
            localOpenness: row.local_openness ?? 50,
            familiarity: row.familiarity ?? 0,
            exposureCount: row.exposure_count ?? 0,
            baselineLocalSensitivity: row.baseline_local_sensitivity,
            baselineLocalAttitude: row.baseline_local_attitude,
            baselineLocalOpenness: row.baseline_local_openness
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
    saveActionPreset(id: string, label: string, values: any, contextConfig?: any) {
        const stmt = db.prepare(`
            INSERT INTO action_presets (id, label, values_json, context_config_json)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                label = excluded.label,
                values_json = excluded.values_json,
                context_config_json = excluded.context_config_json
        `);
        stmt.run(id, label, JSON.stringify(values), contextConfig ? JSON.stringify(contextConfig) : null);
    },
    getActionPreset(id: string): any | null {
        const stmt = db.prepare('SELECT * FROM action_presets WHERE id = ?');
        const row = stmt.get(id) as any;
        if (!row) return null;
        const valJson = JSON.parse(row.values_json);
        return {
            id: row.id,
            label: row.label,
            type: row.type || 'physical',
            tags: row.tags ? JSON.parse(row.tags) : [],
            vector: valJson,
            removeContexts: valJson.removeContexts,
            requireContexts: valJson.requireContexts,
            requiresItem: row.requires_item || valJson.requiresItem || null,
            requiresSceneObject: valJson.requiresSceneObject || null,
            validTargets: valJson.validTargets || null,
            contextConfig: row.context_config_json ? JSON.parse(row.context_config_json) : undefined
        };
    },
    getAllActionPresets(): any[] {
        const stmt = db.prepare('SELECT * FROM action_presets');
        return stmt.all().map((row: any) => {
            const valJson = JSON.parse(row.values_json);
            return {
                id: row.id,
                label: row.label,
                type: row.type || 'physical',
                tags: row.tags ? JSON.parse(row.tags) : [],
                vector: valJson,
                removeContexts: valJson.removeContexts,
                requireContexts: valJson.requireContexts,
                requiresItem: row.requires_item || valJson.requiresItem || null,
                requiresSceneObject: valJson.requiresSceneObject || null,
                validTargets: valJson.validTargets || null,
                contextConfig: row.context_config_json ? JSON.parse(row.context_config_json) : undefined
            };
        });
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
    pointPresetExists(id: string): boolean {
        const row = db.prepare('SELECT 1 FROM point_presets WHERE id = ?').get(id);
        return !!row;
    }
};

export const stateTriggersRepo = {
    get(subjectId: string, triggerCode: string): number {
        const stmt = db.prepare(`SELECT active_ticks FROM state_triggers WHERE subject_id = ? AND trigger_code = ?`);
        const row = stmt.get(subjectId, triggerCode) as any;
        return row ? row.active_ticks : 0;
    },
    set(subjectId: string, triggerCode: string, ticks: number) {
        db.prepare(`
            INSERT INTO state_triggers (id, subject_id, trigger_code, active_ticks)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(subject_id, trigger_code) DO UPDATE SET active_ticks = excluded.active_ticks
        `).run(Math.random().toString(36).substring(2, 15), subjectId, triggerCode, ticks);
    },
    increment(subjectId: string, triggerCode: string, delta: number = 1): number {
        const current = this.get(subjectId, triggerCode);
        const next = current + delta;
        this.set(subjectId, triggerCode, next);
        return next;
    },
    reset(subjectId: string, triggerCode: string) {
        db.prepare(`DELETE FROM state_triggers WHERE subject_id = ? AND trigger_code = ?`).run(subjectId, triggerCode);
    }
};

export const activeContextsRepo = {
    add(id: string, subjectId: string, actionId: string, duration: number = -1, pointId: string | null = null, initiatorId?: string | null) {
        const stmt = db.prepare(`
            INSERT INTO active_contexts (id, subject_id, action_id, duration, point_id, initiator_id)
            VALUES (?, ?, ?, ?, ?, ?)
        `);
        stmt.run(id, subjectId, actionId, duration, pointId, initiatorId || null);
    },
    getAllForSubject(subjectId: string): { id: string; actionId: string; ticksActive: number; duration: number; pointId: string | null; initiatorId?: string | null }[] {
        const stmt = db.prepare('SELECT id, action_id, coalesce(ticks_active, 0) as ticks_active, duration, point_id, initiator_id FROM active_contexts WHERE subject_id = ?');
        const rows = stmt.all(subjectId) as any[];
        return rows.map(r => ({
            id: r.id,
            actionId: r.action_id,
            ticksActive: Number(r.ticks_active) || 0,
            duration: r.duration === null || r.duration === undefined ? -1 : Number(r.duration),
            pointId: r.point_id,
            initiatorId: r.initiator_id || null
        }));
    },
    incrementTicks(subjectId: string, amount: number = 1) {
        const stmt = db.prepare('UPDATE active_contexts SET ticks_active = ticks_active + ? WHERE subject_id = ?');
        stmt.run(amount, subjectId);
    },
    remove(id: string) {
        const stmt = db.prepare('DELETE FROM active_contexts WHERE id = ?');
        stmt.run(id);
    },
    removeByActionId(subjectId: string, actionId: string) {
        const stmt = db.prepare('DELETE FROM active_contexts WHERE subject_id = ? AND action_id = ?');
        stmt.run(subjectId, actionId);
    }
    ,
    removeByActionIdAndPoint(subjectId: string, actionId: string, pointId: string | null) {
        if (pointId === null) {
            const stmt = db.prepare('DELETE FROM active_contexts WHERE subject_id = ? AND action_id = ? AND point_id IS NULL');
            stmt.run(subjectId, actionId);
        } else {
            const stmt = db.prepare('DELETE FROM active_contexts WHERE subject_id = ? AND action_id = ? AND point_id = ?');
            stmt.run(subjectId, actionId, pointId);
        }
    }
};

export const resourceRepo = {
    save(state: ResourceState) {
        // Ensure a character row exists for this id to satisfy FK constraints
        characterRepo.ensureCharacter(state.id, state.id);
        const stmt = db.prepare(`
            INSERT INTO character_resources (character_id, resource_key, amount, max_amount, regen_rate, metadata)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(character_id, resource_key) DO UPDATE SET
                amount = excluded.amount,
                max_amount = excluded.max_amount,
                regen_rate = excluded.regen_rate,
                metadata = excluded.metadata
        `);
        db.transaction(() => {
            for (const [key, resRaw] of Object.entries(state.resources)) {
                // Accept either a number (amount) or an object describing the resource
                const res: any = typeof resRaw === 'number' ? { amount: Number(resRaw) } : resRaw || {};
                stmt.run(
                    state.id,
                    key,
                    Number(res.amount ?? 0),
                    res.maxAmount ?? null,
                    res.regenRate ?? null,
                    JSON.stringify(res.metadata || {})
                );
            }
        })();
    },
    get(id: string): ResourceState | null {
        const rows = db.prepare('SELECT * FROM character_resources WHERE character_id = ?').all(id) as any[];
        if (!rows.length) return null;
        
        const resources: Record<string, any> = {};
        for (const row of rows) {
            resources[row.resource_key] = {
                characterId: row.character_id,
                resourceKey: row.resource_key,
                amount: row.amount,
                maxAmount: row.max_amount !== null ? row.max_amount : undefined,
                regenRate: row.regen_rate !== null ? row.regen_rate : undefined,
                metadata: JSON.parse(row.metadata || '{}')
            };
        }
        return {
            id,
            resources
        };
    },
    applyRegeneration(characterIds?: string[]) {
        // Regenerate up to max_amount
        db.prepare(`
            UPDATE character_resources
            SET amount = MIN(amount + regen_rate, max_amount)
            WHERE regen_rate IS NOT NULL 
              AND max_amount IS NOT NULL 
              AND amount < max_amount
        `).run();

        // Regenerate unbounded
        db.prepare(`
            UPDATE character_resources
            SET amount = amount + regen_rate
            WHERE regen_rate IS NOT NULL AND max_amount IS NULL
        `).run();
    }
};

export const playerRepo = {
    save(state: { id: string; resources?: Record<string, any>; profileJson?: any }) {
        const stmt = db.prepare(`
            INSERT INTO players (id, resources, profile_json)
            VALUES (?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                resources = excluded.resources,
                profile_json = excluded.profile_json
        `);
        stmt.run(state.id, JSON.stringify(state.resources || {}), JSON.stringify(state.profileJson || {}));
    },
    get(id: string) {
        const row = db.prepare('SELECT * FROM players WHERE id = ?').get(id) as any;
        if (!row) return null;
        return {
            id: row.id,
            resources: JSON.parse(row.resources || '{}'),
            profileJson: JSON.parse(row.profile_json || '{}')
        };
    }
};

export const sceneRepo = {
    save(scene: Scene) {
        const stmt = db.prepare(`
            INSERT INTO scenes (id, available_actions, action_costs, transitions, description, slots)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                available_actions = excluded.available_actions,
                action_costs = excluded.action_costs,
                transitions = excluded.transitions,
                description = excluded.description,
                slots = excluded.slots
        `);
        stmt.run(
            scene.id,
            JSON.stringify(scene.availableActions),
            JSON.stringify(scene.actionCosts || {}),
            JSON.stringify(scene.transitions || []),
            scene.description || '',
            JSON.stringify(scene.slots || [])
        );
    },
    get(id: string): Scene | null {
        const stmt = db.prepare('SELECT * FROM scenes WHERE id = ?');
        const row = stmt.get(id) as any;
        if (!row) return null;
        return {
            id: row.id,
            description: row.description,
            availableActions: JSON.parse(row.available_actions || '[]'),
            actionCosts: row.action_costs ? JSON.parse(row.action_costs) : undefined,
            transitions: row.transitions ? JSON.parse(row.transitions) : undefined,
            slots: row.slots ? JSON.parse(row.slots) : []
        };
    },
    list(): Scene[] {
        const stmt = db.prepare('SELECT * FROM scenes');
        const rows = stmt.all() as any[];
        return rows.map(row => ({
            id: row.id,
            description: row.description,
            availableActions: JSON.parse(row.available_actions || '[]'),
            actionCosts: row.action_costs ? JSON.parse(row.action_costs) : undefined,
            transitions: row.transitions ? JSON.parse(row.transitions) : undefined,
            slots: row.slots ? JSON.parse(row.slots) : []
        }));
    }
};

const mapScenePresence = (row: any): SceneCharacterPresence => ({
    character: {
        id: row.character_id,
        name: row.character_name,
        kind: row.character_kind,
        subjectId: row.character_subject_id,
        playerId: row.character_player_id,
        currentSceneId: row.character_current_scene_id
    },
    role: row.role || 'participant',
    canAct: Boolean(row.can_act),
    presenceState: row.presence_state || 'present',
    slotId: row.slot_id
});

export const sceneCharacterRepo = {
    list(sceneId: string): SceneCharacterPresence[] {
        const stmt = db.prepare(
            `SELECT sc.scene_id, sc.role, sc.can_act, sc.presence_state, sc.slot_id,
                    c.id as character_id, c.name as character_name, c.kind as character_kind,
                    c.subject_id as character_subject_id, c.player_id as character_player_id,
                    c.current_scene_id as character_current_scene_id
             FROM scene_characters sc
             JOIN characters c ON c.id = sc.character_id
             WHERE sc.scene_id = ?`
        );
        const rows = stmt.all(sceneId) as any[];
        return rows.map(mapScenePresence);
    },
    set(sceneId: string, characterId: string, opts: { role?: string; canAct?: boolean; presenceState?: string; slotId?: string } = {}) {
        const stmt = db.prepare(
            `INSERT INTO scene_characters (scene_id, character_id, role, can_act, presence_state, slot_id)
             VALUES (?, ?, ?, ?, ?, ?)
             ON CONFLICT(scene_id, character_id) DO UPDATE SET
                role = excluded.role,
                can_act = excluded.can_act,
                presence_state = excluded.presence_state,
                slot_id = excluded.slot_id`
        );
        stmt.run(
            sceneId,
            characterId,
            opts.role || 'participant',
            opts.canAct === false ? 0 : 1,
            opts.presenceState || 'present',
            opts.slotId || null
        );
        characterRepo.updateLocation(characterId, sceneId);
    },
    remove(sceneId: string, characterId: string) {
        const stmt = db.prepare('DELETE FROM scene_characters WHERE scene_id = ? AND character_id = ?');
        stmt.run(sceneId, characterId);
        characterRepo.updateLocation(characterId, null);
    },
    moveCharacter(characterId: string, nextSceneId: string | null, opts?: { role?: string; canAct?: boolean; presenceState?: string; slotId?: string }) {
        const current = db.prepare('SELECT scene_id FROM scene_characters WHERE character_id = ?').get(characterId) as { scene_id: string } | undefined;
        if (current) {
            this.remove(current.scene_id, characterId);
        }
        if (nextSceneId) {
            this.set(nextSceneId, characterId, opts);
        } else {
            characterRepo.updateLocation(characterId, null);
        }
    }
};

export const chatMemoryRepo = {
    append(subjectId: string, role: 'user' | 'assistant', content: string, contextLabel?: string): number | null {
        if (!content || !subjectId) return null;
        const stmt = db.prepare('INSERT INTO chat_memory (subject_id, role, content, context_label) VALUES (?, ?, ?, ?)');
        const info = stmt.run(subjectId, role, content, contextLabel || null);
        return Number(info.lastInsertRowid) || null;
    },
    getRecent(subjectId: string, limit = 10): Array<{ id: number; role: 'user' | 'assistant'; content: string; contextLabel?: string; createdAt?: string }> {
        const stmt = db.prepare(
            'SELECT id, role, content, context_label AS contextLabel, created_at AS createdAt FROM chat_memory WHERE subject_id = ? ORDER BY id DESC LIMIT ?'
        );
        const rows = stmt.all(subjectId, limit) as Array<{ id: number; role: 'user' | 'assistant'; content: string; contextLabel?: string; createdAt?: string }>;
        return rows.reverse();
    },
    getSince(subjectId: string, afterId: number, limit = 100): Array<{ id: number; role: 'user' | 'assistant'; content: string }> {
        const stmt = db.prepare(
            'SELECT id, role, content FROM chat_memory WHERE subject_id = ? AND id > ? ORDER BY id ASC LIMIT ?'
        );
        return stmt.all(subjectId, afterId, limit) as Array<{ id: number; role: 'user' | 'assistant'; content: string }>;
    },
    getLastId(subjectId: string): number {
        const stmt = db.prepare('SELECT id FROM chat_memory WHERE subject_id = ? ORDER BY id DESC LIMIT 1');
        const row = stmt.get(subjectId) as { id: number } | undefined;
        return row?.id ?? 0;
    },
    updateContent(id: number, content: string) {
        db.prepare('UPDATE chat_memory SET content = ? WHERE id = ?').run(content, id);
    },
    deleteBefore(subjectId: string, beforeId: number) {
        db.prepare('DELETE FROM chat_memory WHERE subject_id = ? AND id < ?').run(subjectId, beforeId);
    },
    clear(subjectId: string) {
        db.prepare('DELETE FROM chat_memory WHERE subject_id = ?').run(subjectId);
    }
};

export const chatSummaryRepo = {
    save(record: {
        subjectId: string;
        summaryText: string;
        importantEvents?: string[];
        startMessageId?: number;
        endMessageId?: number;
    }) {
        const stmt = db.prepare(
            'INSERT INTO chat_memory_summary (subject_id, summary_text, important_events, start_message_id, end_message_id) VALUES (?, ?, ?, ?, ?)'
        );
        stmt.run(
            record.subjectId,
            record.summaryText,
            JSON.stringify(record.importantEvents || []),
            record.startMessageId ?? null,
            record.endMessageId ?? null
        );
    },
    getLast(subjectId: string): { id: number; lastMessageId: number } | null {
        const stmt = db.prepare(
            'SELECT id, end_message_id FROM chat_memory_summary WHERE subject_id = ? ORDER BY id DESC LIMIT 1'
        );
        const row = stmt.get(subjectId) as { id: number; end_message_id: number } | undefined;
        if (!row) return null;
        return { id: row.id, lastMessageId: row.end_message_id ?? 0 };
    },
    getRecent(subjectId: string, limit = 5): Array<{ summary: string; important: string[] }> {
        const stmt = db.prepare(
            'SELECT summary_text, important_events FROM chat_memory_summary WHERE subject_id = ? ORDER BY id DESC LIMIT ?'
        );
        return stmt.all(subjectId, limit).map((row: any) => ({
            summary: row.summary_text,
            important: JSON.parse(row.important_events || '[]')
        }));
    },
    clear(subjectId: string) {
        db.prepare('DELETE FROM chat_memory_summary WHERE subject_id = ?').run(subjectId);
    }
};

export const memoryRepo = {
    save(record: {
        subjectId: string;
        text: string;
        embedding: number[];
        tags?: string[];
        relatedSubjects?: string[];
        type?: string;
        metadata?: Record<string, any>;
    }) {
        if (!record.text || !record.embedding || !record.embedding.length) {
            return;
        }
        const stmt = db.prepare(
            'INSERT INTO memory_embeddings (subject_id, text, tags, related_subjects, type, embedding, metadata) VALUES (?, ?, ?, ?, ?, ?, ?)'
        );
        stmt.run(
            record.subjectId,
            record.text,
            JSON.stringify(record.tags || []),
            JSON.stringify(record.relatedSubjects || []),
            record.type || 'interaction',
            JSON.stringify(record.embedding),
            JSON.stringify(record.metadata || {})
        );
    },
    findRelevant(subjectId: string, queryEmbedding: number[], limit = 5, tagFilter?: string[]): Array<{ text: string; score: number }> {
        if (!queryEmbedding || !queryEmbedding.length) return [];
        const rows = db
            .prepare(
                'SELECT id, text, embedding, tags FROM memory_embeddings WHERE subject_id = ? ORDER BY created_at DESC LIMIT 200'
            )
            .all(subjectId) as Array<{ id: number; text: string; embedding: string; tags: string }>;

        const normalizedQuery = normalizeVector(queryEmbedding);
        const scored: Array<{ text: string; score: number }> = [];
        for (const row of rows) {
            try {
                const emb = JSON.parse(row.embedding) as number[];
                if (!emb || !emb.length) continue;
                if (tagFilter && tagFilter.length) {
                    const tags = JSON.parse(row.tags || '[]') as string[];
                    if (!tags.some(tag => tagFilter.includes(tag))) {
                        continue;
                    }
                }
                const score = cosineSimilarity(normalizedQuery, normalizeVector(emb));
                scored.push({ text: row.text, score });
            } catch {
                continue;
            }
        }

        return scored
            .sort((a, b) => b.score - a.score)
            .slice(0, limit)
            .filter(entry => entry.score > 0);
    },
    listRecent(subjectId: string, limit = 5, type?: string): Array<{ text: string; type: string; metadata: Record<string, any> }> {
        const rows = type
            ? db.prepare('SELECT text, type, metadata FROM memory_embeddings WHERE subject_id = ? AND type = ? ORDER BY id DESC LIMIT ?').all(subjectId, type, limit)
            : db.prepare('SELECT text, type, metadata FROM memory_embeddings WHERE subject_id = ? ORDER BY id DESC LIMIT ?').all(subjectId, limit);
        return (rows as Array<{ text: string; type: string; metadata: string }>).map(row => {
            let metadata: Record<string, any> = {};
            try { metadata = JSON.parse(row.metadata || '{}'); } catch { }
            return { text: row.text, type: row.type, metadata };
        });
    },
    deleteEpisodesForScene(subjectId: string, sceneId: string) {
        db.prepare(
            `DELETE FROM memory_embeddings
             WHERE subject_id = ?
               AND type = 'episode_v2'
               AND json_extract(metadata, '$.sceneId') = ?`
        ).run(subjectId, sceneId);
    }
};

function normalizeVector(vec: number[]): number[] {
    const length = Math.sqrt(vec.reduce((sum, value) => sum + value * value, 0));
    if (!length || !Number.isFinite(length)) return vec;
    return vec.map(value => value / length);
}

function cosineSimilarity(a: number[], b: number[]): number {
    if (!a.length || a.length !== b.length) return 0;
    let dot = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
    }
    return dot;
}
