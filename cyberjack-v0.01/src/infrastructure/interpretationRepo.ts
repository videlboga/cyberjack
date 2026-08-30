import { db } from './db';

/**
 * Репозиторий графа интерпретаций (майнд-мэп внутреннего мира персонажа).
 * Ноды — interpretation_nodes, кросс-линки — interpretation_links.
 * Факты (неизменяемые) — world_facts.
 */

export type InterpretationKind =
    | 'worldview'
    | 'biography'
    | 'world_knowledge'
    | 'accumulated'
    | 'self'
    | 'others'
    | 'world'
    | 'relationships'
    | 'station'
    | 'trait'
    | 'episode';

export interface InterpretationNode {
    id: string;
    subjectId: string;
    kind: InterpretationKind;
    parentId: string | null;
    label: string;
    content: string | null;
    sourceText: string | null;
    valence: number;
    strength: number;
    fingerprint: string | null;
    status: 'ready' | 'dirty' | 'generating';
}

export interface InterpretationLink {
    id: string;
    subjectId: string;
    fromId: string;
    toId: string;
    kind: 'cross' | 'evidence';
    weight: number;
}

export const interpretationRepo = {
    get(subjectId: string, id: string): InterpretationNode | null {
        const row = db.prepare('SELECT * FROM interpretation_nodes WHERE subject_id = ? AND id = ?').get(subjectId, id) as any;
        if (!row) return null;
        return mapNode(row);
    },
    listForSubject(subjectId: string): InterpretationNode[] {
        const rows = db.prepare('SELECT * FROM interpretation_nodes WHERE subject_id = ? ORDER BY id').all(subjectId) as any[];
        return rows.map(mapNode);
    },
    children(subjectId: string, parentId: string): InterpretationNode[] {
        const rows = db.prepare('SELECT * FROM interpretation_nodes WHERE subject_id = ? AND parent_id = ? ORDER BY id').all(subjectId, parentId) as any[];
        return rows.map(mapNode);
    },
    upsert(node: Omit<InterpretationNode, 'status'> & { status?: InterpretationNode['status'] }) {
        db.prepare(`INSERT INTO interpretation_nodes
            (id, subject_id, kind, parent_id, label, content, source_text, valence, strength, fingerprint, status, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(subject_id, id) DO UPDATE SET
              kind = excluded.kind,
              parent_id = excluded.parent_id,
              label = excluded.label,
              content = excluded.content,
              source_text = excluded.source_text,
              valence = excluded.valence,
              strength = excluded.strength,
              fingerprint = excluded.fingerprint,
              status = excluded.status,
              updated_at = CURRENT_TIMESTAMP`)
            .run(node.id, node.subjectId, node.kind, node.parentId, node.label, node.content, node.sourceText, node.valence, node.strength, node.fingerprint, node.status || 'ready');
    },
    markDirty(subjectId: string, id: string) {
        db.prepare('UPDATE interpretation_nodes SET status = ? WHERE subject_id = ? AND id = ?').run('dirty', subjectId, id);
    },
    setStatus(subjectId: string, id: string, status: InterpretationNode['status']) {
        db.prepare('UPDATE interpretation_nodes SET status = ? WHERE subject_id = ? AND id = ?').run(status, subjectId, id);
    },
    remove(subjectId: string, id: string) {
        db.prepare('DELETE FROM interpretation_nodes WHERE subject_id = ? AND id = ?').run(subjectId, id);
    },
    // --- links ---
    listLinks(subjectId: string): InterpretationLink[] {
        const rows = db.prepare('SELECT * FROM interpretation_links WHERE subject_id = ?').all(subjectId) as any[];
        return rows.map(mapLink);
    },
    linksFrom(subjectId: string, fromId: string): InterpretationLink[] {
        const rows = db.prepare('SELECT * FROM interpretation_links WHERE subject_id = ? AND from_id = ?').all(subjectId, fromId) as any[];
        return rows.map(mapLink);
    },
    upsertLink(link: InterpretationLink) {
        db.prepare(`INSERT INTO interpretation_links (id, subject_id, from_id, to_id, kind, weight)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(subject_id, id) DO UPDATE SET
              from_id = excluded.from_id, to_id = excluded.to_id, kind = excluded.kind, weight = excluded.weight`)
            .run(link.id, link.subjectId, link.fromId, link.toId, link.kind, link.weight);
    },
    removeLink(subjectId: string, id: string) {
        db.prepare('DELETE FROM interpretation_links WHERE subject_id = ? AND id = ?').run(subjectId, id);
    },
    // --- world glossary facts ---
    listFacts(): Array<{ id: string; term: string; fact: string }> {
        const rows = db.prepare('SELECT * FROM world_glossary_facts ORDER BY sort_order').all() as any[];
        return rows.map(row => ({ id: row.id, term: row.term, fact: row.fact }));
    },
    upsertFact(fact: { id: string; term: string; fact: string; sortOrder?: number }) {
        db.prepare(`INSERT INTO world_glossary_facts (id, term, fact, sort_order) VALUES (?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET term = excluded.term, fact = excluded.fact, sort_order = excluded.sort_order`)
            .run(fact.id, fact.term, fact.fact, fact.sortOrder ?? 0);
    },
    // --- subject facts (персональные атомы-факты: биография) ---
    listSubjectFacts(subjectId: string): Array<{ id: string; term: string; fact: string }> {
        const rows = db.prepare('SELECT * FROM subject_facts WHERE subject_id = ? ORDER BY sort_order').all(subjectId) as any[];
        return rows.map(row => ({ id: row.id, term: row.term, fact: row.fact }));
    },
    upsertSubjectFact(fact: { id: string; subjectId: string; term: string; fact: string; sortOrder?: number }) {
        db.prepare(`INSERT INTO subject_facts (id, subject_id, term, fact, sort_order) VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(subject_id, id) DO UPDATE SET term = excluded.term, fact = excluded.fact, sort_order = excluded.sort_order`)
            .run(fact.id, fact.subjectId, fact.term, fact.fact, fact.sortOrder ?? 0);
    },
};

function mapNode(row: any): InterpretationNode {
    return {
        id: row.id,
        subjectId: row.subject_id,
        kind: row.kind,
        parentId: row.parent_id ?? null,
        label: row.label,
        content: row.content ?? null,
        sourceText: row.source_text ?? null,
        valence: Number(row.valence) || 0,
        strength: Number(row.strength) || 0,
        fingerprint: row.fingerprint ?? null,
        status: row.status,
    };
}

function mapLink(row: any): InterpretationLink {
    return {
        id: row.id,
        subjectId: row.subject_id,
        fromId: row.from_id,
        toId: row.to_id,
        kind: row.kind,
        weight: Number(row.weight) || 1,
    };
}
