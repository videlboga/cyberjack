import { db } from '../src/infrastructure/db.ts';
import { getBaseHumanAnatomy } from '../src/domain/anatomy.ts';
import { ensureStarterClothing, STARTER_CLOTHING } from '../src/infrastructure/starterClothing.ts';

const PLAYER_ID = 'PL-1';
const LAB_SCENE_ID = 'scene_lab_calibrator';

const roster = [
  { id: 'S-AV-01', name: 'Мира', sensitivity: 60, capacity: 50, openness: 100, plasticity: 100, attitude: 100, tension: 0, room: 'room_cell_a', role: 'asset', slug: 'mira' },
  { id: 'NPC-LAB-01', name: 'Иона', sensitivity: 50, capacity: 68, openness: 42, plasticity: 45, attitude: 58, tension: 0, room: 'room_control', role: 'assistant', slug: 'iona' },
  { id: 'NPC-CAND-01', name: 'Ника', sensitivity: 48, capacity: 64, openness: 38, plasticity: 52, attitude: 45, tension: 5, room: 'room_cell_b', role: 'asset', slug: 'nika' },
  { id: 'NPC-CAND-SUMI', name: 'Суми', sensitivity: 55, capacity: 60, openness: 60, plasticity: 60, attitude: 55, tension: 0, room: 'room_calibration', role: 'asset', slug: 'sumi' },
  { id: 'NPC-CAND-GEN-02', name: 'Эли', sensitivity: 65, capacity: 30, openness: 25, plasticity: 40, attitude: 30, tension: 0, room: 'room_calibration', role: 'asset', slug: 'eli' },
] as const;

const updateSubject = db.prepare(`
  UPDATE subjects SET
    sensitivity=@sensitivity, capacity=@capacity, openness=@openness,
    plasticity=@plasticity, attitude=@attitude, tension=@tension,
    baseline_sensitivity=@sensitivity, baseline_capacity=@capacity,
    baseline_openness=@openness, baseline_plasticity=@plasticity,
    baseline_attitude=@attitude
  WHERE id=@id
`);
const insertPoint = db.prepare(`
  INSERT INTO subject_point_states (
    subject_id, point_id, local_sensitivity, local_attitude, local_openness,
    familiarity, exposure_count, baseline_local_sensitivity,
    baseline_local_attitude, baseline_local_openness
  ) VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?, ?)
`);

db.transaction(() => {
  for (const character of roster) {
    if (!db.prepare('SELECT 1 FROM characters WHERE id=?').get(character.id)) {
      throw new Error(`Missing character ${character.id}`);
    }
    updateSubject.run(character);
    db.prepare('DELETE FROM subject_point_states WHERE subject_id=?').run(character.id);
    for (const point of getBaseHumanAnatomy('female', 'none')) {
      insertPoint.run(character.id, point.id, point.sens, point.att, character.openness, point.sens, point.att, character.openness);
    }

    db.prepare('DELETE FROM active_contexts WHERE subject_id=?').run(character.id);
    db.prepare('DELETE FROM state_triggers WHERE subject_id=?').run(character.id);
    db.prepare(`DELETE FROM character_seed_flags WHERE character_id=? AND flag='starter-clothing-v1'`).run(character.id);

    const stored = db.prepare('SELECT profile_json FROM characters WHERE id=?').get(character.id) as { profile_json?: string };
    const profile = JSON.parse(stored.profile_json || '{}');
    profile.base = { ...(profile.base || {}), status: character.role === 'assistant' ? 'staff' : 'asset' };
    profile.title = character.role === 'assistant' ? (profile.title || 'Лабораторный ассистент') : 'Актив';
    profile.visual = { ...(profile.visual || {}), slug: character.slug };
    db.prepare(`UPDATE characters SET current_scene_id=?, profile_json=? WHERE id=?`)
      .run(LAB_SCENE_ID, JSON.stringify(profile), character.id);

    db.prepare('DELETE FROM scene_characters WHERE character_id=?').run(character.id);
    db.prepare(`INSERT INTO scene_characters (scene_id,character_id,role,can_act,presence_state,slot_id)
      VALUES (?, ?, ?, 1, 'present', ?)`)
      .run(LAB_SCENE_ID, character.id, character.role, `room:${character.room}`);
    db.prepare(`INSERT INTO laboratory_room_assignments (player_id,room_id,character_id,status)
      VALUES (?, ?, ?, 'resident')
      ON CONFLICT(player_id,character_id) DO UPDATE SET room_id=excluded.room_id,status='resident'`)
      .run(PLAYER_ID, character.room, character.id);

    db.prepare(`INSERT INTO character_relations (
      from_id,to_id,knows,present,can_interact,attitude,openness,plasticity,
      baseline_attitude,baseline_openness,baseline_plasticity,familiarity_level,general_opinion,recent_memories
    ) VALUES (?, ?, 1, 1, 1, ?, ?, ?, ?, ?, ?, 0, '', '[]')
    ON CONFLICT(from_id,to_id) DO UPDATE SET
      knows=1,present=1,can_interact=1,attitude=excluded.attitude,
      openness=excluded.openness,plasticity=excluded.plasticity,
      baseline_attitude=excluded.baseline_attitude,
      baseline_openness=excluded.baseline_openness,
      baseline_plasticity=excluded.baseline_plasticity,familiarity_level=0`)
      .run(character.id, PLAYER_ID, character.attitude, character.openness, character.plasticity,
        character.attitude, character.openness, character.plasticity);
  }

  db.prepare(`UPDATE laboratory_assets SET metadata=json_remove(metadata,'$.subjectId','$.startedAt','$.previousRoomId') WHERE player_id=?`).run(PLAYER_ID);
})();

for (const character of roster) {
  ensureStarterClothing(character.id, STARTER_CLOTHING[character.id] || ['eq_clothe_underwear']);
}
db.prepare(`DELETE FROM active_contexts WHERE subject_id IN (${roster.map(() => '?').join(',')}) AND point_id='groin'`)
  .run(...roster.map(character => character.id));

console.log(`Reset complete: ${roster.map(character => character.name).join(', ')}`);
