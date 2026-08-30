import { randomUUID } from 'crypto';
import { db } from '../infrastructure/db';
import { ensureGeneratedProfile } from '../orchestration/characterGenerator/profileManager';
import { applyCharacterStartingTraits } from './characterStartingTraits';
import { getBaseHumanAnatomy, applyPointModifiers, type Gender } from '../domain/anatomy';

/**
 * Единый механизм приведения персонажа к каноническому стартовому состоянию.
 *
 * Раньше сидирование было разбросано по 6 точкам (authoredProfiles,
 * generatedCandidates, characterStartingTraits, seedBiography,
 * characterStorySeeds, starterClothing) и НЕ применяло стартовые трейты к
 * существующим персонажам (guard `if character exists return false` в
 * seedOneCandidate оставлял их с устаревшими/пустыми preferences), не
 * выставляло стартовую позу и не обнуляло накопленную статистику точек.
 *
 * Эта функция идемпотентно приводит конкретного субъекта к канону:
 *   1. берёт компилируемый профиль (authoredProfiles или процедурный),
 *   2. применяет стартовые трейты (characterStartingTraits),
 *   3. пишет параметры + preferences в `subjects`,
 *   4. пересоздаёт subject_point_states с baseline (обнуляет familiarity,
 *      exposure_count и локальные чувствительности/открытость),
 *   5. выставляет стартовую позу и одежду в `active_contexts`.
 *
 * ПРЕДНАЗНАЧЕНА только для стартового сидирования/реконсиляции, НЕ для
 * обычного рантайма (не должна затирать прогресс активного персонажа).
 */
export interface CharacterReconcileOptions {
  /** Стартовая поза (id action_preset вида pose_*). По умолчанию — стоит. */
  pose?: string;
  /** Стартовая одежда (id action_presets). По умолчанию — нижнее бельё. */
  clothing?: string[];
  /** Пересоздать subject_point_states (обнулить статистику). По умолчанию true. */
  resetPoints?: boolean;
}

const DEFAULT_CLOTHING = ['eq_clothe_underwear'];

function readPreferences(profile: { mechanicalSeed?: { preferences?: any } }): Record<string, any> {
  return profile.mechanicalSeed?.preferences || { actions: {}, points: {}, contexts: {}, tags: {} };
}

/** Записывает параметры и preferences субъекта из компилированного профиля. */
function writeSubject(
  subjectId: string,
  name: string,
  profile: { mechanicalSeed?: { coreModifiers?: Record<string, number> } },
): void {
  const core = profile.mechanicalSeed?.coreModifiers || {};
  const metric = (key: string) => Math.max(0, Math.min(100, 50 + Number(core[key] || 0)));
  const preferences = JSON.stringify(readPreferences(profile));

  db.prepare(`
    INSERT INTO subjects (id, name, sensitivity, capacity, openness, plasticity, attitude, tension, preferences,
      baseline_sensitivity, baseline_capacity, baseline_openness, baseline_plasticity, baseline_attitude)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      sensitivity = excluded.sensitivity,
      capacity = excluded.capacity,
      openness = excluded.openness,
      plasticity = excluded.plasticity,
      attitude = excluded.attitude,
      tension = 0,
      preferences = excluded.preferences,
      baseline_sensitivity = excluded.baseline_sensitivity,
      baseline_capacity = excluded.baseline_capacity,
      baseline_openness = excluded.baseline_openness,
      baseline_plasticity = excluded.baseline_plasticity,
      baseline_attitude = excluded.baseline_attitude
  `).run(
    subjectId, name,
    metric('sensitivity'), metric('capacity'), metric('openness'), metric('plasticity'), metric('attitude'),
    preferences,
    metric('sensitivity'), metric('capacity'), metric('openness'), metric('plasticity'), metric('attitude'),
  );
}

/** Обнуляет subject_point_states к baseline и пересоздаёт, если отсутствуют. */
function resetPoints(subjectId: string, gender: string, openness: number, pointModifiers?: Record<string, { sens?: number; att?: number }>): void {
  db.prepare('DELETE FROM subject_point_states WHERE subject_id = ?').run(subjectId);
  const anatomyGender: Gender = gender === 'male' ? 'male' : gender === 'other' ? 'androgynous' : 'female';
  const insertPoint = db.prepare(`
    INSERT INTO subject_point_states (
      subject_id, point_id, local_sensitivity, local_attitude, local_openness, familiarity, exposure_count,
      baseline_local_sensitivity, baseline_local_attitude, baseline_local_openness
    ) VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?, ?)
  `);
  const points = applyPointModifiers(getBaseHumanAnatomy(anatomyGender, 'none'), pointModifiers);
  for (const point of points) {
    insertPoint.run(subjectId, point.id, point.sens, point.att, openness, point.sens, point.att, openness);
  }
}

/** Выставляет стартовую позу и одежду в active_contexts (без дублей и без
 *  затирания уже установленной специальной позы на global_pose). */
function applyInitialContexts(subjectId: string, pose: string, clothing: string[]): void {
  const getPreset = db.prepare('SELECT context_config_json FROM action_presets WHERE id = ?');
  const insertCtx = db.prepare(`INSERT INTO active_contexts (id, subject_id, action_id, duration, point_id) VALUES (?, ?, ?, ?, ?)`);
  const hasCtx = db.prepare(`SELECT 1 FROM active_contexts WHERE subject_id = ? AND action_id = ? AND COALESCE(point_id, '') = ?`);
  const hasPose = db.prepare(`SELECT 1 FROM active_contexts WHERE subject_id = ? AND point_id = 'global_pose'`);

  const applyAction = (actionId: string, skipIfPosePresent = false) => {
    const row = getPreset.get(actionId) as { context_config_json?: string | null } | undefined;
    if (!row) return;
    let config: { duration?: number; occupiesPoints?: string[] } = {};
    try { config = JSON.parse(row.context_config_json || '{}'); } catch { config = {}; }
    const points = config.occupiesPoints?.length ? config.occupiesPoints : [null];
    for (const pointId of points) {
      const normalized = pointId || '';
      if (skipIfPosePresent && pointId === 'global_pose' && hasPose.get(subjectId)) {
        // У персонажа уже есть поза (например act_present_feet, pose_lying_down) —
        // не добавляем дефолтную стойку поверх, иначе конфликт двух global_pose.
        continue;
      }
      if (!hasCtx.get(subjectId, actionId, normalized)) {
        insertCtx.run(randomUUID(), subjectId, actionId, config.duration ?? -1, pointId);
      }
    }
  };

  for (const actionId of clothing) applyAction(actionId);
  if (pose) applyAction(pose, true);
}

/**
 * Приводит персонажа к каноническому стартовому состоянию. Идемпотентно.
 * Возвращает false, если персонаж/профиль недоступен.
 */
export function reconcileCharacterState(subjectId: string, options: CharacterReconcileOptions = {}): boolean {
  const character = db.prepare('SELECT id, name, subject_id, profile_json FROM characters WHERE id = ? OR subject_id = ? LIMIT 1')
    .get(subjectId, subjectId) as any;
  if (!character) return false;

  let gender: string = 'female';
  try {
    const canonical = JSON.parse(character.profile_json || '{}');
    gender = canonical.base?.gender || canonical.identity?.gender || 'female';
  } catch { /* keep */ }

  const compiled = ensureGeneratedProfile(character.id);
  if (!compiled) return false;
  const profiled = applyCharacterStartingTraits(compiled);

  const openness = Math.max(0, Math.min(100, 50 + Number(profiled.mechanicalSeed?.coreModifiers?.openness || 0)));

  // Персонаж, находящийся в закрытом устройстве (секс-машина, капсула), уже
  // раздет устройством при помещении (worldService снимает одежду). Стартовое
  // сидирование не должно надевать бельё поверх — иначе оно снова блокирует
  // точки (vagina/anus/clitoris) и секс-машина перестаёт поднимать активацию.
  const inEnclosedDevice = Boolean(db.prepare(
    `SELECT 1 FROM laboratory_assets
     WHERE json_extract(metadata, '$.subjectId') IN (?, ?)
       AND asset_id IN ('lab_sex_machine_vaginal','lab_sex_machine_anal','lab_sex_machine_tickling','lab_sex_machine_circularsaw', 'lab_recovery_capsule')
     LIMIT 1`
  ).get(character.id, character.subject_id));

  db.transaction(() => {
    writeSubject(character.id, character.name || character.id, profiled);
    if (options.resetPoints !== false) {
      resetPoints(character.id, gender, openness, profiled.mechanicalSeed?.pointModifiers);
    }
    if (inEnclosedDevice) {
      // Снять надетую одежду (бельё блокирует точки устройства), не надевать новую.
      db.prepare(`
        DELETE FROM active_contexts
        WHERE subject_id = ?
          AND action_id IN (
            SELECT id FROM action_presets
            WHERE COALESCE(json_extract(context_config_json, '$.type'), '') = 'clothing'
               OR type = 'clothing'
          )
      `).run(character.id);
      applyInitialContexts(character.id, options.pose || 'pose_standing', []);
    } else {
      applyInitialContexts(character.id, options.pose || 'pose_standing', options.clothing || DEFAULT_CLOTHING);
    }
  })();

  return true;
}

/** Приводит список персонажей к канону. Возвращает число успешно обновлённых. */
export const reconcileAllCharacters = (ids: string[], options?: CharacterReconcileOptions) =>
  ids.map((id) => reconcileCharacterState(id, options)).filter(Boolean).length;
