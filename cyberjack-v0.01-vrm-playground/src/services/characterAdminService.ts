import { db } from '../infrastructure/db';
import { presetRepo } from '../infrastructure/repositories';
import { getBaseHumanAnatomy, type Gender } from '../domain/anatomy';
import { generateCharacterContext } from '../orchestration/characterGenerator/generator';
import { regenerateGeneratedProfile } from '../orchestration/characterGenerator/profileManager';

/**
 * Этап 8. Application service для администрирования персонажей.
 *
 * Выносит бизнес-логику создания/удаления персонажей из контроллера.
 * Контроллер валидирует транспортный ввод, вызывает один сервис и
 * отображает результат.
 */

export function deleteCharacterById(id: string): void {
  db.transaction(() => {
    db.prepare('DELETE FROM scene_characters WHERE character_id = ?').run(id);
    db.prepare('DELETE FROM character_resources WHERE character_id = ?').run(id);
    db.prepare('DELETE FROM subject_point_states WHERE subject_id = ?').run(id);
    db.prepare('DELETE FROM active_contexts WHERE subject_id = ?').run(id);
    db.prepare('DELETE FROM chat_memory WHERE subject_id = ?').run(id);
    db.prepare('DELETE FROM character_relations WHERE from_id = ? OR to_id = ?').run(id, id);
    db.prepare('DELETE FROM characters WHERE id = ?').run(id);
    db.prepare('DELETE FROM subjects WHERE id = ?').run(id);
  })();
}

export interface GenerateCharacterInput {
  subjectId: string;
  name?: string;
  age?: number;
  gender?: string;
  anatomy?: string;
  seed?: string;
}

export interface GenerateCharacterResult {
  subjectId: string;
  profile: unknown;
}

export function characterExists(subjectId: string): boolean {
  return Boolean(db.prepare('SELECT 1 FROM characters WHERE id = ? OR subject_id = ?').get(subjectId, subjectId));
}

export function generateCharacter(input: GenerateCharacterInput): GenerateCharacterResult {
  const { subjectId } = input;
  const seed = typeof input.seed === 'string' && input.seed.trim() ? input.seed.trim() : subjectId;
  const draft = generateCharacterContext({ seed });
  const identity = {
    name: input.name || draft.baseProfile!.name,
    age: Number(input.age ?? draft.baseProfile!.age),
    gender: input.gender || draft.baseProfile!.gender,
    anatomy: input.anatomy || draft.baseProfile!.anatomy,
    status: 'asset'
  };

  db.transaction(() => {
    db.prepare(`INSERT INTO characters (id, name, kind, subject_id, profile_json) VALUES (?, ?, 'subject', ?, ?)`)
      .run(subjectId, identity.name, subjectId, JSON.stringify({ base: identity }));
  })();

  const profile = regenerateGeneratedProfile(subjectId, { seed });
  const core = profile.mechanicalSeed.coreModifiers;
  const value = (key: string) => Math.max(0, Math.min(100, 50 + Number(core[key] || 0)));
  db.transaction(() => {
    db.prepare(`
      INSERT INTO subjects (id, name, sensitivity, capacity, openness, plasticity, attitude, preferences,
        baseline_sensitivity, baseline_capacity, baseline_openness, baseline_plasticity, baseline_attitude)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      subjectId, identity.name,
      value('sensitivity'), value('capacity'), value('openness'), value('plasticity'), value('attitude'),
      JSON.stringify(profile.mechanicalSeed.preferences),
      value('sensitivity'), value('capacity'), value('openness'), value('plasticity'), value('attitude')
    );
    const anatomyGender: Gender = identity.gender === 'other' ? 'androgynous' : (identity.gender as Gender);
    const points = getBaseHumanAnatomy(anatomyGender, identity.anatomy === 'none' ? 'none' : undefined);
    const stmt = db.prepare(`INSERT INTO subject_point_states (subject_id, point_id, local_sensitivity, local_attitude, familiarity, exposure_count, baseline_local_sensitivity, baseline_local_attitude) VALUES (?, ?, ?, ?, 0, 0, ?, ?)`);
    for (const point of points) stmt.run(subjectId, point.id, point.sens, point.att, point.sens, point.att);
  })();

  return { subjectId, profile };
}

export function listAllCharacters() {
  const rows = db.prepare('SELECT * FROM characters').all();
  return rows.map((r: any) => ({ ...r, profile: r.profile_json ? JSON.parse(r.profile_json) : null }));
}

export function getAllActionPresets() {
  return presetRepo.getAllActionPresets();
}
