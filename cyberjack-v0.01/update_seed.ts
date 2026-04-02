import fs from 'fs';
let content = fs.readFileSync('seed_expanded.ts', 'utf-8');

content = content.replace(
  "const insertPointStmt = db.prepare('INSERT INTO point_presets (id, label, values_json) VALUES (?, ?, ?)');",
  "const insertPointStmt = db.prepare('INSERT INTO point_presets (id, label, values_json, parent_id, provides_functions, tags) VALUES (?, ?, ?, ?, ?, ?)');"
);
content = content.replace(
  "insertPointStmt.run(p.id, p.label, JSON.stringify({ localSensitivity: p.sens, localAttitude: p.att }));",
  "insertPointStmt.run(p.id, p.label, JSON.stringify({ localSensitivity: p.sens, localAttitude: p.att }), (p as any).parentId || null, JSON.stringify((p as any).providesFunctions || []), JSON.stringify((p as any).tags || []));"
);

content = content.replace(
  "const insertContextStmt = db.prepare('INSERT INTO context_presets (id, label, point_id, modifiers_json) VALUES (?, ?, ?, ?)');",
  "const insertContextStmt = db.prepare('INSERT INTO context_presets (id, label, point_id, modifiers_json, type, slot, exclusive_within_slot, blocks_slots, affected_point_ids, blocked_functions, boosted_functions, required_functions, priority) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');"
);
content = content.replace(
  "insertContextStmt.run(c.id, c.label, c.point_id, JSON.stringify(c.modifiers));",
  "insertContextStmt.run(c.id, c.label, c.point_id, JSON.stringify(c.modifiers), (c as any).type || 'condition', (c as any).slot || 'general', (c as any).exclusiveWithinSlot ? 1 : 0, JSON.stringify((c as any).blocksSlots || []), JSON.stringify((c as any).affectedPointIds || []), JSON.stringify((c as any).blockedFunctions || []), JSON.stringify((c as any).boostedFunctions || []), JSON.stringify((c as any).requiredFunctions || []), (c as any).priority || 0);"
);

fs.writeFileSync('seed_expanded.ts', content);
