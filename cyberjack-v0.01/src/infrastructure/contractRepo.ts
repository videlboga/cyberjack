import { db } from './db';
import { AssetContract, AssetContractCondition } from '../domain/types';

export const contractRepo = {
    save(contract: AssetContract) {
        db.prepare(`
            INSERT INTO asset_contracts (
                id, issuer_id, title, description, state, accepted_by_player_id, 
                attached_subject_id, deadline_tick, conditions, rewards, penalties,
                format, duration_minutes, offer_deadline_minutes, return_profile, personal, unavailable_until, subject_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                state = excluded.state,
                accepted_by_player_id = excluded.accepted_by_player_id,
                attached_subject_id = excluded.attached_subject_id,
                deadline_tick = excluded.deadline_tick,
                conditions = excluded.conditions,
                rewards = excluded.rewards,
                penalties = excluded.penalties,
                format = excluded.format,
                duration_minutes = excluded.duration_minutes,
                offer_deadline_minutes = excluded.offer_deadline_minutes,
                return_profile = excluded.return_profile,
                personal = excluded.personal,
                unavailable_until = excluded.unavailable_until,
                subject_id = excluded.subject_id
        `).run(
            contract.id, contract.issuerId, contract.title, contract.description,
            contract.state, contract.acceptedByPlayerId || null, 
            contract.attachedSubjectId || null, contract.deadlineTick || null,
            JSON.stringify(contract.conditions), JSON.stringify(contract.rewards),
            JSON.stringify(contract.penalties || {}),
            contract.format || null, contract.durationMinutes || null,
            contract.offerDeadlineMinutes || null,
            contract.return_profile ? JSON.stringify(contract.return_profile) : null,
            contract.personal ? 1 : 0,
            contract.unavailableUntil ?? contract.unavailable_until ?? null,
            contract.subject_id || (contract as any).subjectId || null
        );
    },
    
    get(id: string): AssetContract | null {
        const row = db.prepare('SELECT * FROM asset_contracts WHERE id = ?').get(id) as any;
        if (!row) return null;
        return this._mapRow(row);
    },

    listForPlayer(playerId: string): AssetContract[] {
        const rows = db.prepare('SELECT * FROM asset_contracts WHERE accepted_by_player_id = ?').all(playerId) as any[];
        return rows.map(r => this._mapRow(r));
    },

    listAvailable(): AssetContract[] {
        const rows = db.prepare('SELECT * FROM asset_contracts WHERE state = ?').all('available') as any[];
        return rows.map(r => this._mapRow(r));
    },

    _mapRow(row: any): AssetContract {
        return {
            id: row.id,
            issuerId: row.issuer_id,
            title: row.title,
            description: row.description,
            state: row.state,
            acceptedByPlayerId: row.accepted_by_player_id,
            attachedSubjectId: row.attached_subject_id,
            deadlineTick: row.deadline_tick,
            conditions: JSON.parse(row.conditions || '[]'),
            rewards: JSON.parse(row.rewards || '{}'),
            penalties: JSON.parse(row.penalties || '{}'),
            format: row.format || undefined,
            durationMinutes: row.duration_minutes ?? undefined,
            offerDeadlineMinutes: row.offer_deadline_minutes ?? undefined,
            return_profile: row.return_profile ? JSON.parse(row.return_profile) : undefined,
            personal: row.personal ? true : undefined,
            unavailable_until: row.unavailable_until ?? undefined,
            unavailableUntil: row.unavailable_until ?? undefined,
            subject_id: row.subject_id || undefined,
        };
    }
};
