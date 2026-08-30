import sqlite3, os, json

base = '/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01'
db_path = os.path.join(base, 'cyberjack.sqlite')
db = sqlite3.connect(db_path)

# NPC characters to reset (exclude player PL-1)
npc_ids = [r[0] for r in db.execute("SELECT id FROM characters WHERE id != 'PL-1'").fetchall()]
print("Resetting NPCs:", npc_ids)

# 1. Reset subjects to baseline params, clear preferences, tension=0
for cid in npc_ids:
    db.execute("""
        UPDATE subjects SET
            sensitivity = COALESCE(baseline_sensitivity, sensitivity),
            capacity = COALESCE(baseline_capacity, capacity),
            openness = COALESCE(baseline_openness, openness),
            plasticity = COALESCE(baseline_plasticity, plasticity),
            attitude = COALESCE(baseline_attitude, attitude),
            tension = 0,
            preferences = '{}'
        WHERE id = ?
    """, (cid,))

# 2. Clear memory & state tables for these characters
memory_tables = {
    'chat_memory': 'subject_id',
    'memory_embeddings': 'subject_id',
    'chat_memory_summary': 'subject_id',
    'social_memories': 'subject_id',
    'subjective_memory_episodes': 'subject_id',
    'subjective_associations': 'subject_id',
    'subjective_memory_revisions': 'subject_id',
    'memory_association_effects': 'subject_id',
    'subject_point_states': 'subject_id',
    'subject_edge_states': 'subject_id',
    'interaction_stances': 'subject_id',
    'relationship_dynamics': 'subject_id',
    'social_pair_states': 'from_id',
    'pending_social_turns': 'speaker_id',
    'social_threads': 'from_id',
    'transactional_games': 'player_id',
    'dossier_narratives': 'subject_id',
    'character_seed_flags': 'character_id',
    'character_resources': 'character_id',
    'character_items': 'character_id',
    'character_relations': 'from_id',
    'story_threads': 'subject_id',
}

for table, col in memory_tables.items():
    try:
        # Check if table exists
        has = db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?", (table,)).fetchone()
        if not has:
            continue
        # Check if column exists
        cols = [r[1] for r in db.execute(f"PRAGMA table_info({table})").fetchall()]
        if col not in cols:
            # try alternate column
            alt = 'subject_id' if col != 'subject_id' else 'from_id'
            if alt in cols:
                col = alt
            else:
                continue
        placeholders = ','.join(['?']*len(npc_ids))
        db.execute(f"DELETE FROM {table} WHERE {col} IN ({placeholders})", npc_ids)
    except Exception as e:
        print(f"  ! {table}: {e}")

db.commit()
print("Done. NPCs reset to baseline, memory cleared.")
