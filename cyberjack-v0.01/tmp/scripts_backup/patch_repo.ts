import fs from 'fs';

let content = fs.readFileSync('src/infrastructure/repositories.ts', 'utf8');

content = content.replace(
    /getAllForEvent\(eventId: string\): string\[\] \{[\s\S]*?return rows\.map\(r => r\.context_id\);\s+\},/,
    `getAllForEvent(eventId: string): { id: string, ticks: number }[] {
        const stmt = db.prepare('SELECT context_id, coalesce(ticks_active, 0) as ticks_active FROM active_contexts WHERE event_id = ?');
        const rows = stmt.all(eventId) as any[];
        return rows.map(r => ({ id: r.context_id, ticks: r.ticks_active }));
    },
    incrementTicks(eventId: string) {
        const stmt = db.prepare('UPDATE active_contexts SET ticks_active = ticks_active + 1 WHERE event_id = ?');
        stmt.run(eventId);
    },`
);

fs.writeFileSync('src/infrastructure/repositories.ts', content);
