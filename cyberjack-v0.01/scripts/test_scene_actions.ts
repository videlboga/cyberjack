(async ()=>{
  try {
    const { subjectRepo, characterRepo, subjectPreferencesRepo, characterRelationRepo } = await import('../src/infrastructure/repositories');
    const db = await import('../src/infrastructure/db');

    const targetSubject = 'S-GEN-1';
    const otherSubject = 'S-OTHER-1';

    console.log('Ensuring other subject exists...');
    subjectRepo.save(otherSubject, 'Актор', { sensitivity:50, capacity:50, openness:50, plasticity:50, attitude:50, preferences: JSON.stringify({actions:{},points:{},contexts:{}}) });
    characterRepo.ensureSubject(otherSubject, 'Актор');

    const lira = subjectRepo.get(targetSubject);
    if (!lira) throw new Error('Subject S-GEN-1 not found; run create_test_char first');

    console.log('\n--- BEFORE ---');
    console.log('Prefs:', JSON.stringify(subjectPreferencesRepo.get(targetSubject), null, 2));
    console.log('Baselines:', JSON.stringify(subjectPreferencesRepo.getBaselines(targetSubject), null, 2));

    // create a simple scene and add both characters
    const sceneId = 'SCENE-TEST-1';
    db.db.prepare("INSERT INTO scenes (id, available_actions, action_costs, transitions) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO NOTHING").run(sceneId, JSON.stringify([]), JSON.stringify({}), JSON.stringify([]));
    db.db.prepare('INSERT OR IGNORE INTO characters (id, name, kind, subject_id) VALUES (?, ?, ?, ?)').run('C-LIRA-1', lira.name, 'subject', targetSubject);
    db.db.prepare('INSERT OR IGNORE INTO characters (id, name, kind, subject_id) VALUES (?, ?, ?, ?)').run('C-ACTOR-1', 'Актор', 'subject', otherSubject);
    db.db.prepare('INSERT OR IGNORE INTO scene_characters (scene_id, character_id) VALUES (?, ?)').run(sceneId, 'C-LIRA-1');
    db.db.prepare('INSERT OR IGNORE INTO scene_characters (scene_id, character_id) VALUES (?, ?)').run(sceneId, 'C-ACTOR-1');
    console.log('\nScene created with Lira and Actor (ids C-LIRA-1, C-ACTOR-1)');

    // Ensure relations
    characterRelationRepo.ensure('C-LIRA-1','C-ACTOR-1',{attitude:50});
    characterRelationRepo.ensure('C-ACTOR-1','C-LIRA-1',{attitude:50});

    // Actor performs aggressive action on Lira -> reduces Lira's action pref about Actor
    const attackKey = 'attacked_by_C-ACTOR-1';
    console.log('\nSimulating Actor -> Lira aggressive action: adjust', attackKey, '-3');
    subjectPreferencesRepo.adjust(targetSubject, 'actions', attackKey, -3);
    console.log('Prefs after attack:', JSON.stringify(subjectPreferencesRepo.get(targetSubject), null, 2));

    // Now order Lira to help Actor (command)
    const orderKey = 'ordered_to_help_C-ACTOR-1';
    console.log('\nSimulating ordering Lira to help Actor: adjust', orderKey, '+2');
    subjectPreferencesRepo.adjust(targetSubject, 'actions', orderKey, 2);
    console.log('Prefs after order:', JSON.stringify(subjectPreferencesRepo.get(targetSubject), null, 2));

    // Run decay to exercise damping+baseline adaptation
    console.log('\nRunning decay(subjectId, 0.02) to exercise baseline damping/adaptation...');
    subjectPreferencesRepo.decay(targetSubject, 0.02);

    console.log('\n--- AFTER DECAY ---');
    console.log('Prefs after decay:', JSON.stringify(subjectPreferencesRepo.get(targetSubject), null, 2));
    console.log('Baselines after decay:', JSON.stringify(subjectPreferencesRepo.getBaselines(targetSubject), null, 2));

    // Also dump raw DB fields for verification
    const row = db.db.prepare('SELECT preferences, preference_baselines FROM subjects WHERE id = ?').get(targetSubject);
    console.log('\nRaw DB subjects.preferences:', row ? row.preferences : null);
    console.log('Raw DB subjects.preference_baselines:', row ? row.preference_baselines : null);

    console.log('\nDone.');
  } catch (e) {
    console.error('Error in test script:', e);
    process.exit(1);
  }
})();
