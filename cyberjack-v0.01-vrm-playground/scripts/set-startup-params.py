import sqlite3, os, json

base = '/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01'
db_path = os.path.join(base, 'cyberjack.sqlite')
db = sqlite3.connect(db_path)

# Startup params per character
# Candidates (generatedCandidates): 50 + coreModifiers
# Nika/Iona (worldService): fixed
# Mira (seed): fixed
startup = {
    'NPC-CAND-01': {'sensitivity': 48, 'capacity': 64, 'openness': 38, 'plasticity': 52, 'attitude': 45},  # worldService
    'NPC-LAB-01': {'sensitivity': 50, 'capacity': 68, 'openness': 42, 'plasticity': 45, 'attitude': 58},  # worldService
    'S-AV-01': {'sensitivity': 60, 'capacity': 50, 'openness': 100, 'plasticity': 100, 'attitude': 100},  # seed
}

# Candidates from generatedCandidates: 50 + coreModifiers
cand_ids = ['NPC-CAND-SUMI', 'NPC-CAND-GEN-02', 'NPC-CAND-GEN-03', 'NPC-CAND-GEN-04', 'NPC-CAND-GEN-05']
for cid in cand_ids:
    row = db.execute("SELECT profile_json FROM characters WHERE id=?", (cid,)).fetchone()
    if not row: continue
    d = json.loads(row[0] or '{}')
    cm = d.get('generatedProfile', {}).get('mechanicalSeed', {}).get('coreModifiers', {})
    startup[cid] = {k: 50 + v for k, v in cm.items()}

# Apply startup params (set both current and baseline to startup)
for cid, params in startup.items():
    db.execute("""
        UPDATE subjects SET
            sensitivity = ?, capacity = ?, openness = ?, plasticity = ?, attitude = ?,
            baseline_sensitivity = ?, baseline_capacity = ?, baseline_openness = ?, baseline_plasticity = ?, baseline_attitude = ?,
            tension = 0, preferences = '{}'
        WHERE id = ?
    """, (params['sensitivity'], params['capacity'], params['openness'], params['plasticity'], params['attitude'],
          params['sensitivity'], params['capacity'], params['openness'], params['plasticity'], params['attitude'], cid))
    print(f"  {cid}: {json.dumps(params, ensure_ascii=False)}")

db.commit()
print("Done. Startup params applied.")
