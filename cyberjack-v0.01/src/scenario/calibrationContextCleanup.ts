import { db } from '../infrastructure/db';

/**
 * Physical setup belongs to the calibration table, not to the character.
 * Clothing and persistent status effects survive relocation; poses, attached
 * equipment and running interactions do not.
 */
export function clearCalibrationSetupContexts(subjectId: string): number {
    const result = db.prepare(`
        DELETE FROM active_contexts
        WHERE subject_id = ?
          AND action_id IN (
              SELECT id FROM action_presets
              WHERE COALESCE(json_extract(context_config_json, '$.type'), '')
                    IN ('pose', 'equipment', 'interaction', 'interaction_level')
          )
    `).run(subjectId);
    return result.changes;
}
