const fs = require('fs');

function patchSeedFile(file) {
    if (!fs.existsSync(file)) return;
    let code = fs.readFileSync(file, 'utf8');
    
    code = code.replace(
        /db\.prepare\("INSERT OR REPLACE INTO active_contexts \(id, subject_id, action_id, duration\) VALUES \(\?, \?, \?, \?\)"\);/,
        'db.prepare("INSERT OR REPLACE INTO active_contexts (id, subject_id, action_id, duration, point_id) VALUES (?, ?, ?, ?, ?)");'
    );

    code = code.replace(/applyContextStmt\.run\('ctx_eli_panties',\s*'S-01',\s*'eq_clothe_panties',\s*-1\);/, "applyContextStmt.run('ctx_eli_panties', 'S-01', 'eq_clothe_panties', -1, 'vulva');");
    code = code.replace(/applyContextStmt\.run\('ctx_eli_bra',\s*'S-01',\s*'eq_clothe_bra',\s*-1\);/, "applyContextStmt.run('ctx_eli_bra', 'S-01', 'eq_clothe_bra', -1, 'chest');");
    code = code.replace(/applyContextStmt\.run\('ctx_eli_shirt',\s*'S-01',\s*'eq_clothe_shirt',\s*-1\);/, "applyContextStmt.run('ctx_eli_shirt', 'S-01', 'eq_clothe_shirt', -1, 'shoulders');");
    code = code.replace(/applyContextStmt\.run\('ctx_eli_pants',\s*'S-01',\s*'eq_clothe_pants',\s*-1\);/, "applyContextStmt.run('ctx_eli_pants', 'S-01', 'eq_clothe_pants', -1, 'hips');");
    code = code.replace(/applyContextStmt\.run\('ctx_eli_shoes',\s*'S-01',\s*'eq_clothe_shoes',\s*-1\);/, "applyContextStmt.run('ctx_eli_shoes', 'S-01', 'eq_clothe_shoes', -1, 'feet');");

    fs.writeFileSync(file, code);
}
patchSeedFile('scripts/run-seed.cjs');

