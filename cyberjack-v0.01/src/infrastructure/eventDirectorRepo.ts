import { db } from './db';

const parse = <T>(value: string | null | undefined, fallback: T): T => {
    try { return JSON.parse(value || '') as T; } catch { return fallback; }
};

export type StoryThread = {
    id:string;
    type:string;
    title:string;
    status:string;
    stage:string;
    subjectId?:string;
    relatedCharacterIds:string[];
    facts:string[];
    tags:string[];
    tension:number;
    importance:number;
    visibility:string;
    sourceType:string;
    sourceId?:string;
    createdMinute:number;
    updatedMinute:number;
    metadata:Record<string, any>;
};

export type EventOpportunity = {
    id:string;
    templateId:string;
    status:string;
    channel:string;
    priority:number;
    urgency:number;
    subjectId?:string;
    actorIds:string[];
    threadIds:string[];
    locationId?:string;
    availableFrom:number;
    expiresAt?:number;
    payload:Record<string, any>;
    generatedContent?:Record<string, any>;
    offeredMinute?:number;
    resolvedMinute?:number;
    resolution?:string;
    sourceEventId?:number;
};

const mapThread = (row:any):StoryThread => ({
    id:row.id, type:row.type, title:row.title, status:row.status, stage:row.stage,
    subjectId:row.subject_id || undefined,
    relatedCharacterIds:parse(row.related_character_ids, []),
    facts:parse(row.facts, []), tags:parse(row.tags, []),
    tension:Number(row.tension), importance:Number(row.importance),
    visibility:row.visibility, sourceType:row.source_type,
    sourceId:row.source_id || undefined, createdMinute:Number(row.created_minute),
    updatedMinute:Number(row.updated_minute), metadata:parse(row.metadata, {}),
});

const mapOpportunity = (row:any):EventOpportunity => ({
    id:row.id, templateId:row.template_id, status:row.status, channel:row.channel,
    priority:Number(row.priority), urgency:Number(row.urgency),
    subjectId:row.subject_id || undefined, actorIds:parse(row.actor_ids, []),
    threadIds:parse(row.thread_ids, []), locationId:row.location_id || undefined,
    availableFrom:Number(row.available_from),
    expiresAt:row.expires_at == null ? undefined : Number(row.expires_at),
    payload:parse(row.payload, {}),
    generatedContent:row.generated_content ? parse(row.generated_content, {}) : undefined,
    offeredMinute:row.offered_minute == null ? undefined : Number(row.offered_minute),
    resolvedMinute:row.resolved_minute == null ? undefined : Number(row.resolved_minute),
    resolution:row.resolution || undefined,
    sourceEventId:row.source_event_id == null ? undefined : Number(row.source_event_id),
});

export const storyThreadRepo = {
    save(thread:StoryThread) {
        db.prepare(`
            INSERT INTO story_threads (
                id,type,title,status,stage,subject_id,related_character_ids,facts,tags,
                tension,importance,visibility,source_type,source_id,created_minute,updated_minute,metadata
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            ON CONFLICT(id) DO UPDATE SET
                title=excluded.title,status=excluded.status,stage=excluded.stage,
                related_character_ids=excluded.related_character_ids,facts=excluded.facts,
                tags=excluded.tags,tension=excluded.tension,importance=excluded.importance,
                visibility=excluded.visibility,updated_minute=excluded.updated_minute,
                metadata=excluded.metadata
        `).run(
            thread.id, thread.type, thread.title, thread.status, thread.stage,
            thread.subjectId || null, JSON.stringify(thread.relatedCharacterIds),
            JSON.stringify(thread.facts), JSON.stringify(thread.tags), thread.tension,
            thread.importance, thread.visibility, thread.sourceType, thread.sourceId || null,
            thread.createdMinute, thread.updatedMinute, JSON.stringify(thread.metadata)
        );
    },
    get(id:string) {
        const row = db.prepare(`SELECT * FROM story_threads WHERE id = ?`).get(id);
        return row ? mapThread(row) : null;
    },
    findBySource(sourceType:string, sourceId:string) {
        const row = db.prepare(`
            SELECT * FROM story_threads WHERE source_type = ? AND source_id = ?
            ORDER BY created_minute DESC LIMIT 1
        `).get(sourceType, sourceId);
        return row ? mapThread(row) : null;
    },
    listOpen(limit = 20) {
        return (db.prepare(`
            SELECT * FROM story_threads WHERE status IN ('open','dormant')
            ORDER BY importance DESC, updated_minute DESC LIMIT ?
        `).all(limit) as any[]).map(mapThread);
    },
};

export const eventOpportunityRepo = {
    save(event:EventOpportunity) {
        db.prepare(`
            INSERT INTO event_opportunities (
                id,template_id,status,channel,priority,urgency,subject_id,actor_ids,
                thread_ids,location_id,available_from,expires_at,payload,generated_content,
                offered_minute,resolved_minute,resolution,source_event_id
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            ON CONFLICT(id) DO UPDATE SET
                status=excluded.status,priority=excluded.priority,urgency=excluded.urgency,
                available_from=excluded.available_from,expires_at=excluded.expires_at,
                payload=excluded.payload,generated_content=excluded.generated_content,
                offered_minute=excluded.offered_minute,resolved_minute=excluded.resolved_minute,
                resolution=excluded.resolution
        `).run(
            event.id,event.templateId,event.status,event.channel,event.priority,event.urgency,
            event.subjectId || null,JSON.stringify(event.actorIds),JSON.stringify(event.threadIds),
            event.locationId || null,event.availableFrom,event.expiresAt ?? null,
            JSON.stringify(event.payload),event.generatedContent ? JSON.stringify(event.generatedContent) : null,
            event.offeredMinute ?? null,event.resolvedMinute ?? null,event.resolution || null,
            event.sourceEventId ?? null
        );
    },
    get(id:string) {
        const row = db.prepare(`SELECT * FROM event_opportunities WHERE id = ?`).get(id);
        return row ? mapOpportunity(row) : null;
    },
    findForSource(templateId:string, sourceEventId:number) {
        const row = db.prepare(`
            SELECT * FROM event_opportunities
            WHERE template_id = ? AND source_event_id = ? LIMIT 1
        `).get(templateId, sourceEventId);
        return row ? mapOpportunity(row) : null;
    },
    listAvailable(now:number, limit = 12) {
        db.prepare(`
            UPDATE event_opportunities SET status = 'expired', resolved_minute = ?
            WHERE status IN ('available','presented') AND expires_at IS NOT NULL AND expires_at <= ?
        `).run(now, now);
        const rows = db.prepare(`
            SELECT * FROM event_opportunities
            WHERE status IN ('available','presented') AND available_from <= ?
              AND (expires_at IS NULL OR expires_at > ?)
            ORDER BY urgency DESC, priority DESC, available_from, id LIMIT ?
        `).all(now, now, limit) as any[];
        return rows.map(mapOpportunity);
    },
};

export const directorSignalRepo = {
    claim(input:{ id:string; type:string; sourceType:string; sourceId:string; payload:Record<string,any>; worldMinute:number }) {
        const result = db.prepare(`
            INSERT OR IGNORE INTO director_signals
                (id,signal_type,source_type,source_id,payload,world_minute)
            VALUES (?,?,?,?,?,?)
        `).run(input.id,input.type,input.sourceType,input.sourceId,JSON.stringify(input.payload),input.worldMinute);
        return result.changes > 0;
    }
};

export const worldFactRepo = {
    save(input:{
        id:string; scope:string; scopeId?:string; predicate:string; value:any;
        confidence?:number; visibility?:string; status?:string; sourceType:string;
        sourceId:string; validFrom:number; validUntil?:number; tags?:string[];
        metadata?:Record<string,any>;
    }) {
        db.prepare(`
            INSERT OR REPLACE INTO world_facts (
                id,scope,scope_id,predicate,value,confidence,visibility,status,
                source_type,source_id,valid_from,valid_until,tags,metadata
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        `).run(
            input.id,input.scope,input.scopeId || null,input.predicate,JSON.stringify(input.value),
            input.confidence ?? 1,input.visibility || 'known',input.status || 'active',
            input.sourceType,input.sourceId,input.validFrom,input.validUntil ?? null,
            JSON.stringify(input.tags || []),JSON.stringify(input.metadata || {})
        );
    }
};
