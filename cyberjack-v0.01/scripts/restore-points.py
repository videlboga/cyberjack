import sqlite3, os, json

base = '/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01'
db_path = os.path.join(base, 'cyberjack.sqlite')
db = sqlite3.connect(db_path)

# NPC characters (exclude PL-1)
npc_ids = [r[0] for r in db.execute("SELECT id FROM characters WHERE id != 'PL-1'").fetchall()]

# Get gender + openness for each NPC
def get_gender(cid):
    row = db.execute("SELECT profile_json FROM characters WHERE id=?", (cid,)).fetchone()
    if not row: return 'female'
    try:
        p = json.loads(row[0] or '{}')
        return p.get('base', {}).get('gender', 'female')
    except: return 'female'

def get_openness(cid):
    row = db.execute("SELECT openness FROM subjects WHERE id=?", (cid,)).fetchone()
    return row[0] if row else 50

# Base anatomy points (mirror of getBaseHumanAnatomy)
def base_anatomy(gender):
    return [
        ('posture', 0, 50), ('mind_state', 0, 50),
        ('head', 30, 70), ('hair', 25, 65), ('face', 60, 40), ('lips', 85, 20), ('neck', 80, 30),
        ('shoulders', 30, 80), ('chest', 85 if gender=='female' else 60, 30), ('nipples', 95, 10),
        ('belly', 50, 40), ('back', 40, 60), ('waist', 65, 45),
        ('arms', 20, 90), ('hands', 70, 85),
        ('inner_thighs', 85, 10), ('legs', 25, 75), ('feet', 75, 50),
        ('buttocks', 50, 15), ('anus', 100, 5),
        ('penis', 100, 5) if gender=='male' else ('vagina', 100, 5),
        ('testicles', 100, 5) if gender=='male' else ('clitoris', 100, 5),
        ('prostate', 100, 5) if gender=='male' else ('breasts', 85, 10),
        ('slot_room', 50, 50), ('slot_social', 50, 50), ('systemic', 50, 50),
    ]

for cid in npc_ids:
    gender = get_gender(cid)
    openness = get_openness(cid)
    # Delete existing (should be none) and insert fresh
    db.execute("DELETE FROM subject_point_states WHERE subject_id=?", (cid,))
    for pid, sens, att in base_anatomy(gender):
        db.execute("""
            INSERT INTO subject_point_states 
            (subject_id, point_id, local_sensitivity, local_attitude, local_openness, familiarity, exposure_count,
             baseline_local_sensitivity, baseline_local_attitude, baseline_local_openness)
            VALUES (?,?,?,?,?,0,0,?,?,?)
        """, (cid, pid, sens, att, openness, sens, att, openness))
    print(f"  {cid} ({gender}): {len(base_anatomy(gender))} points restored")

db.commit()
print("Done. Body points restored for all NPCs.")
