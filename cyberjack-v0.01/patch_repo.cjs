const fs = require('fs');
let file = fs.readFileSync('src/infrastructure/repositories.ts', 'utf8');

// Patch mapRelation
file = file.replace(/plasticity: row.plasticity \?\? 0,/, `plasticity: row.plasticity ?? 0,
    familiarityLevel: row.familiarity_level ?? 0,
    generalOpinion: row.general_opinion,
    recentMemories: row.recent_memories ? JSON.parse(row.recent_memories) : [],`);

// Patch ensure insert
file = file.replace(/INSERT INTO character_relations \(from_id, to_id, knows, present, can_interact, attitude, openness, plasticity, baseline_attitude, baseline_openness, baseline_plasticity\).*?VALUES \(\?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?\)/s, 
`INSERT INTO character_relations (from_id, to_id, knows, present, can_interact, attitude, openness, plasticity, baseline_attitude, baseline_openness, baseline_plasticity, familiarity_level, general_opinion, recent_memories)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, '', '[]')`);


// Add an updateFamiliarity method to characterRelationRepo
const updateAttitudeMatch = `updateAttitude(fromId: string, toId: string, attitude: number, options?: { baselineAttitude?: number, openness?: number, plasticity?: number }) {`;
const newMethod = `
    updateSocialStats(fromId: string, toId: string, stats: { familiarityDelta: number, generalOpinion?: string, newMemory?: string }) {
        const existing = this.ensure(fromId, toId);
        
        const newFam = existing.familiarityLevel !== undefined ? Math.min(1.0, existing.familiarityLevel + stats.familiarityDelta) : stats.familiarityDelta;
        let opinion = stats.generalOpinion || existing.generalOpinion || '';
        
        let mems = existing.recentMemories || [];
        if (stats.newMemory) {
             mems.push(stats.newMemory);
             if (mems.length > 5) mems.shift(); // Keep only last 5 
        }
        
        const stmt = db.prepare(\`
            UPDATE character_relations 
            SET familiarity_level = ?,
                general_opinion = ?,
                recent_memories = ?
            WHERE from_id = ? AND to_id = ?
        \`);
        stmt.run(newFam, opinion, JSON.stringify(mems), fromId, toId);
    },
    updateAttitude(fromId: string, toId: string, attitude: number, options?: { baselineAttitude?: number, openness?: number, plasticity?: number }) {`;

file = file.replace(updateAttitudeMatch, newMethod);

fs.writeFileSync('src/infrastructure/repositories.ts', file);
