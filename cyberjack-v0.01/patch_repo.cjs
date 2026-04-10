const fs = require('fs');

const path = 'src/infrastructure/repositories.ts';
let code = fs.readFileSync(path, 'utf8');

const targetStr = `    get(subjectId: string, pointId: string): SubjectPointState | null {`;
const newStr = `    getAllForSubject(subjectId: string): SubjectPointState[] {
        const stmt = db.prepare('SELECT * FROM subject_point_states WHERE subject_id = ?');
        const rows = stmt.all(subjectId) as any[];
        return rows.map((row: any) => ({
            pointId: row.point_id,
            localSensitivity: row.local_sensitivity,
            localAttitude: row.local_attitude,
            localOpenness: row.local_openness ?? 50,
            familiarity: row.familiarity ?? 0,
            exposureCount: row.exposure_count ?? 0,
            baselineLocalSensitivity: row.baseline_local_sensitivity,
            baselineLocalAttitude: row.baseline_local_attitude,
            baselineLocalOpenness: row.baseline_local_openness
        }));
    },

    get(subjectId: string, pointId: string): SubjectPointState | null {`;

code = code.replace(targetStr, newStr);
fs.writeFileSync(path, code);
