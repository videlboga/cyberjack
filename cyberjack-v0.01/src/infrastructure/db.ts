import Database from 'better-sqlite3';

// Use an in-memory database when running tests to avoid file locks and make tests hermetic.
const isTest = process.env.NODE_ENV === 'test' || process.env.VITEST === '1';
const databasePath = isTest ? ':memory:' : (process.env.CYBERJACK_DB_PATH || 'cyberjack.sqlite');
const verbose = process.env.CYBERJACK_SQL_DEBUG === '1' ? console.log : undefined;
export const db = new Database(databasePath, { verbose });

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS character_resources (
    character_id TEXT NOT NULL,
    resource_key TEXT NOT NULL,
    amount REAL NOT NULL,
    max_amount REAL,
    regen_rate REAL,
    metadata TEXT DEFAULT '{}',
    PRIMARY KEY (character_id, resource_key),
    FOREIGN KEY (character_id) REFERENCES characters(id)
  );

  CREATE TABLE IF NOT EXISTS characters (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    kind TEXT NOT NULL,
    subject_id TEXT,
    player_id TEXT,
    current_scene_id TEXT,
    profile_json TEXT
  );

  CREATE TABLE IF NOT EXISTS character_items (
    character_id TEXT NOT NULL,
    item_id TEXT NOT NULL,
    state TEXT DEFAULT 'active',
    charges INTEGER DEFAULT -1,
    metadata TEXT DEFAULT '{}',
    PRIMARY KEY (character_id, item_id),
    FOREIGN KEY (character_id) REFERENCES characters(id)
  );

  CREATE TABLE IF NOT EXISTS items (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    tags TEXT DEFAULT '[]',
    description TEXT DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS scene_objects (
    id TEXT PRIMARY KEY,
    scene_id TEXT NOT NULL,
    node_id TEXT,
    item_id TEXT NOT NULL,
    owner_id TEXT,
    state TEXT DEFAULT 'active',
    metadata TEXT DEFAULT '{}',
    FOREIGN KEY (scene_id) REFERENCES scenes(id)
  );

  CREATE TABLE IF NOT EXISTS traits (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    rules_json TEXT DEFAULT '{}'
  );

  CREATE TABLE IF NOT EXISTS scene_layouts (
    scene_id TEXT PRIMARY KEY,
    layout_json TEXT NOT NULL,
    FOREIGN KEY (scene_id) REFERENCES scenes(id)
  );

  CREATE TABLE IF NOT EXISTS character_relations (
    from_id TEXT NOT NULL,
    to_id TEXT NOT NULL,
    knows INTEGER DEFAULT 1,
    present INTEGER DEFAULT 1,
    can_interact INTEGER DEFAULT 1,
    attitude REAL NOT NULL DEFAULT 50,
    openness REAL DEFAULT 0,
    plasticity REAL DEFAULT 0,
    baseline_attitude REAL,
    baseline_openness REAL,
    baseline_plasticity REAL,
    PRIMARY KEY (from_id, to_id),
    FOREIGN KEY (from_id) REFERENCES characters(id),
    FOREIGN KEY (to_id) REFERENCES characters(id)
  );
  
  CREATE INDEX IF NOT EXISTS idx_character_relations_from ON character_relations(from_id);

  CREATE TABLE IF NOT EXISTS subjects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    sensitivity REAL NOT NULL,
    capacity REAL NOT NULL,
    openness REAL NOT NULL,
    plasticity REAL NOT NULL,
    attitude REAL NOT NULL,
    tension REAL DEFAULT 0,
    preferences TEXT DEFAULT '{}',
    baseline_sensitivity REAL,
    baseline_capacity REAL,
    baseline_openness REAL,
    baseline_plasticity REAL,
    baseline_attitude REAL
  );

  CREATE TABLE IF NOT EXISTS subject_point_states (
    subject_id TEXT NOT NULL,
    point_id TEXT NOT NULL,
    local_sensitivity REAL NOT NULL,
    local_attitude REAL NOT NULL,
    local_openness REAL DEFAULT 50,
    familiarity REAL DEFAULT 0,
    exposure_count REAL DEFAULT 0,
    baseline_local_sensitivity REAL,
    baseline_local_attitude REAL,
    baseline_local_openness REAL,
    PRIMARY KEY (subject_id, point_id)
  );

  CREATE TABLE IF NOT EXISTS factions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    description TEXT,
    meta TEXT DEFAULT '{}'
  );

  CREATE TABLE IF NOT EXISTS player_faction_states (
    player_id TEXT NOT NULL,
    faction_id TEXT NOT NULL,
    relation REAL DEFAULT 0,
    trust REAL DEFAULT 0,
    access_level INTEGER DEFAULT 1,
    flags TEXT DEFAULT '[]',
    PRIMARY KEY (player_id, faction_id)
  );

  CREATE TABLE IF NOT EXISTS asset_contracts (
    id TEXT PRIMARY KEY,
    issuer_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    state TEXT DEFAULT 'available',
    accepted_by_player_id TEXT,
    attached_subject_id TEXT,
    deadline_tick INTEGER,
    conditions TEXT DEFAULT '[]',
    rewards TEXT DEFAULT '{}',
    penalties TEXT DEFAULT '{}',
    FOREIGN KEY (issuer_id) REFERENCES factions(id)
  );

  CREATE TABLE IF NOT EXISTS world_state (
    id TEXT PRIMARY KEY,
    total_minutes INTEGER NOT NULL DEFAULT 480,
    day INTEGER NOT NULL DEFAULT 1,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS shop_offers (
    id TEXT PRIMARY KEY,
    item_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    category TEXT NOT NULL DEFAULT 'item',
    price INTEGER NOT NULL,
    stock INTEGER NOT NULL DEFAULT -1,
    required_trust INTEGER NOT NULL DEFAULT 0,
    metadata TEXT NOT NULL DEFAULT '{}',
    available_from INTEGER,
    expires_at INTEGER,
    source_event_id TEXT
  );

  CREATE TABLE IF NOT EXISTS laboratory_assets (
    player_id TEXT NOT NULL,
    asset_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    state TEXT NOT NULL DEFAULT 'installed',
    metadata TEXT DEFAULT '{}',
    PRIMARY KEY (player_id, asset_id)
  );

  CREATE TABLE IF NOT EXISTS laboratory_rooms (
    player_id TEXT NOT NULL,
    room_id TEXT NOT NULL,
    name TEXT NOT NULL,
    room_type TEXT NOT NULL,
    description TEXT DEFAULT '',
    capacity INTEGER NOT NULL DEFAULT 1,
    state TEXT NOT NULL DEFAULT 'ready',
    metadata TEXT DEFAULT '{}',
    PRIMARY KEY (player_id, room_id)
  );

  CREATE TABLE IF NOT EXISTS laboratory_room_assignments (
    player_id TEXT NOT NULL,
    room_id TEXT NOT NULL,
    character_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'resident',
    PRIMARY KEY (player_id, character_id)
  );

  CREATE TABLE IF NOT EXISTS scenario_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    world_minute INTEGER NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    metadata TEXT DEFAULT '{}'
  );

  CREATE TABLE IF NOT EXISTS event_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subject_id TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    action_type TEXT NOT NULL,
    action_payload TEXT NOT NULL, -- JSON
    result_payload TEXT NOT NULL  -- JSON
  );

  CREATE TABLE IF NOT EXISTS scenes (
    id TEXT PRIMARY KEY,
    available_actions TEXT NOT NULL, -- JSON
    action_costs TEXT DEFAULT '{}',
    transitions TEXT DEFAULT '[]'
  );

  CREATE TABLE IF NOT EXISTS players (
    id TEXT PRIMARY KEY,
    resources TEXT DEFAULT '{}',
    profile_json TEXT DEFAULT '{}'
  );

  CREATE TABLE IF NOT EXISTS scene_characters (
    scene_id TEXT NOT NULL,
    character_id TEXT NOT NULL,
    role TEXT DEFAULT 'participant',
    can_act INTEGER DEFAULT 1,
    presence_state TEXT DEFAULT 'present',
    PRIMARY KEY (scene_id, character_id),
    FOREIGN KEY (scene_id) REFERENCES scenes(id),
    FOREIGN KEY (character_id) REFERENCES characters(id)
  );

  CREATE TABLE IF NOT EXISTS action_presets (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    values_json TEXT NOT NULL,
    type TEXT DEFAULT "physical",
    tags TEXT DEFAULT "[]",
    context_config_json TEXT,
    requires_item TEXT
  );

  CREATE TABLE IF NOT EXISTS point_presets (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    values_json TEXT NOT NULL, -- JSON: { localSensitivity, localAttitude }
    parent_id TEXT,
    provides_functions TEXT DEFAULT '[]',
    tags TEXT DEFAULT '[]'
  );

  CREATE TABLE IF NOT EXISTS active_contexts (
    id TEXT PRIMARY KEY,
    subject_id TEXT NOT NULL,
    action_id TEXT NOT NULL,
    duration INTEGER DEFAULT -1,
    ticks_active REAL DEFAULT 0,
    FOREIGN KEY(subject_id) REFERENCES characters(id),
    FOREIGN KEY(action_id) REFERENCES action_presets(id)
  );

  CREATE TABLE IF NOT EXISTS state_triggers (
    id TEXT PRIMARY KEY,
    subject_id TEXT NOT NULL,
    trigger_code TEXT NOT NULL,
    active_ticks INTEGER DEFAULT 0,
    UNIQUE(subject_id, trigger_code)
  );

  CREATE TABLE IF NOT EXISTS chat_memory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subject_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    world_minute INTEGER
  );

  CREATE TABLE IF NOT EXISTS memory_embeddings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subject_id TEXT NOT NULL,
    text TEXT NOT NULL,
    tags TEXT DEFAULT '[]',
    related_subjects TEXT DEFAULT '[]',
    type TEXT DEFAULT 'interaction',
    embedding TEXT NOT NULL,
    metadata TEXT DEFAULT '{}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  
  CREATE INDEX IF NOT EXISTS idx_memory_subject ON memory_embeddings(subject_id, created_at DESC);

  CREATE TABLE IF NOT EXISTS subjective_memory_episodes (
    subject_id TEXT NOT NULL,
    source_key TEXT NOT NULL,
    source_atom_ids TEXT NOT NULL,
    summary_json TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'ready',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(subject_id, source_key)
  );
  CREATE INDEX IF NOT EXISTS idx_subjective_episode_subject ON subjective_memory_episodes(subject_id, updated_at DESC);
  CREATE TABLE IF NOT EXISTS memory_association_effects (
    subject_id TEXT NOT NULL, source_key TEXT NOT NULL, tag TEXT NOT NULL,
    weight REAL NOT NULL, expectation TEXT NOT NULL, PRIMARY KEY(subject_id, source_key, tag)
  );
  CREATE INDEX IF NOT EXISTS idx_memory_association_subject_tag ON memory_association_effects(subject_id, tag);
  CREATE TABLE IF NOT EXISTS subjective_associations (
    subject_id TEXT NOT NULL, source_key TEXT NOT NULL, target_type TEXT NOT NULL,
    target_key TEXT NOT NULL, target_label TEXT NOT NULL, tag_links TEXT NOT NULL DEFAULT '[]',
    valence REAL NOT NULL, strength REAL NOT NULL, expectation TEXT NOT NULL,
    PRIMARY KEY(subject_id, source_key, target_type, target_key)
  );
  CREATE INDEX IF NOT EXISTS idx_subjective_association_target ON subjective_associations(subject_id, target_type, target_key);
  CREATE TABLE IF NOT EXISTS subjective_memory_revisions (
    id INTEGER PRIMARY KEY AUTOINCREMENT, subject_id TEXT NOT NULL, source_key TEXT NOT NULL,
    target_label TEXT NOT NULL, intervention TEXT NOT NULL, operation TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS social_pair_states (
    from_id TEXT NOT NULL,
    to_id TEXT NOT NULL,
    trust REAL NOT NULL DEFAULT 50,
    safety REAL NOT NULL DEFAULT 50,
    last_ego_state TEXT,
    last_need TEXT,
    last_intent TEXT,
    last_world_minute INTEGER,
    PRIMARY KEY (from_id, to_id)
  );

  CREATE TABLE IF NOT EXISTS pending_social_turns (
    id TEXT PRIMARY KEY,
    speaker_id TEXT NOT NULL,
    recipient_id TEXT NOT NULL,
    plan_json TEXT NOT NULL,
    speech TEXT,
    semantics_json TEXT,
    status TEXT NOT NULL DEFAULT 'planned',
    error TEXT,
    created_world_minute INTEGER NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_pending_social_turns_status ON pending_social_turns(status, created_world_minute);

  CREATE TABLE IF NOT EXISTS social_threads (
    id TEXT PRIMARY KEY,
    from_id TEXT NOT NULL,
    to_id TEXT NOT NULL,
    topic TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    salience REAL NOT NULL DEFAULT 0.5,
    source_json TEXT NOT NULL DEFAULT '{}',
    last_touched_minute INTEGER NOT NULL,
    cooldown_until_minute INTEGER,
    UNIQUE(from_id, to_id, topic)
  );
  CREATE INDEX IF NOT EXISTS idx_social_threads_pair ON social_threads(from_id,to_id,status,cooldown_until_minute);

  CREATE TABLE IF NOT EXISTS social_memories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subject_id TEXT NOT NULL,
    related_subject_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    owner TEXT NOT NULL,
    content TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    importance REAL NOT NULL DEFAULT 0.5,
    confidence REAL NOT NULL DEFAULT 0.7,
    source_message_id INTEGER,
    resolved_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    resolved_at DATETIME
  );

  CREATE INDEX IF NOT EXISTS idx_social_memory_active
    ON social_memories(subject_id, related_subject_id, status, created_at DESC);

  CREATE TABLE IF NOT EXISTS story_threads (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    stage TEXT NOT NULL DEFAULT 'seed',
    subject_id TEXT,
    related_character_ids TEXT NOT NULL DEFAULT '[]',
    faction_id TEXT,
    location_id TEXT,
    facts TEXT NOT NULL DEFAULT '[]',
    tags TEXT NOT NULL DEFAULT '[]',
    tension REAL NOT NULL DEFAULT 0.2,
    importance REAL NOT NULL DEFAULT 0.5,
    visibility TEXT NOT NULL DEFAULT 'known',
    source_type TEXT NOT NULL,
    source_id TEXT,
    last_event_minute INTEGER,
    cooldown_until INTEGER,
    created_minute INTEGER NOT NULL,
    updated_minute INTEGER NOT NULL,
    metadata TEXT NOT NULL DEFAULT '{}'
  );

  CREATE INDEX IF NOT EXISTS idx_story_threads_active
    ON story_threads(status, subject_id, importance DESC, updated_minute DESC);

  CREATE TABLE IF NOT EXISTS event_opportunities (
    id TEXT PRIMARY KEY,
    template_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'available',
    channel TEXT NOT NULL,
    priority REAL NOT NULL DEFAULT 0.5,
    urgency REAL NOT NULL DEFAULT 0,
    subject_id TEXT,
    actor_ids TEXT NOT NULL DEFAULT '[]',
    thread_ids TEXT NOT NULL DEFAULT '[]',
    location_id TEXT,
    available_from INTEGER NOT NULL,
    expires_at INTEGER,
    payload TEXT NOT NULL DEFAULT '{}',
    generated_content TEXT,
    offered_minute INTEGER,
    resolved_minute INTEGER,
    resolution TEXT,
    source_event_id INTEGER
  );

  CREATE INDEX IF NOT EXISTS idx_event_opportunities_available
    ON event_opportunities(status, available_from, priority DESC);

  CREATE TABLE IF NOT EXISTS event_instances (
    id TEXT PRIMARY KEY,
    opportunity_id TEXT,
    template_id TEXT NOT NULL,
    phase TEXT NOT NULL,
    world_minute INTEGER NOT NULL,
    participants TEXT NOT NULL DEFAULT '[]',
    presented_content TEXT NOT NULL DEFAULT '{}',
    selected_choice TEXT,
    outcome TEXT NOT NULL DEFAULT '{}',
    created_fact_ids TEXT NOT NULL DEFAULT '[]',
    created_thread_ids TEXT NOT NULL DEFAULT '[]',
    scenario_event_id INTEGER,
    metadata TEXT NOT NULL DEFAULT '{}'
  );

  CREATE TABLE IF NOT EXISTS world_facts (
    id TEXT PRIMARY KEY,
    scope TEXT NOT NULL,
    scope_id TEXT,
    predicate TEXT NOT NULL,
    value TEXT NOT NULL,
    confidence REAL NOT NULL DEFAULT 1,
    visibility TEXT NOT NULL DEFAULT 'known',
    status TEXT NOT NULL DEFAULT 'active',
    source_type TEXT NOT NULL,
    source_id TEXT NOT NULL,
    valid_from INTEGER NOT NULL,
    valid_until INTEGER,
    supersedes_fact_id TEXT,
    tags TEXT NOT NULL DEFAULT '[]',
    metadata TEXT NOT NULL DEFAULT '{}'
  );

  CREATE INDEX IF NOT EXISTS idx_world_facts_scope
    ON world_facts(scope, scope_id, predicate, status);

  CREATE TABLE IF NOT EXISTS director_signals (
    id TEXT PRIMARY KEY,
    signal_type TEXT NOT NULL,
    source_type TEXT NOT NULL,
    source_id TEXT NOT NULL,
    payload TEXT NOT NULL DEFAULT '{}',
    world_minute INTEGER NOT NULL,
    processed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(signal_type, source_type, source_id)
  );
`);

const safeAddColumn = (table: string, column: string, definition: string) => {
    try {
        db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    } catch (error: any) {
        if (!error.message.includes('duplicate column name')) {
            throw error;
        }
    }
};

safeAddColumn('subject_point_states', 'familiarity', 'REAL DEFAULT 0');
safeAddColumn('subject_point_states', 'exposure_count', 'REAL DEFAULT 0');
safeAddColumn('subject_point_states', 'baseline_local_sensitivity', 'REAL');
safeAddColumn('subject_point_states', 'baseline_local_attitude', 'REAL');
safeAddColumn('subject_point_states', 'local_openness', 'REAL DEFAULT 50');
safeAddColumn('subject_point_states', 'baseline_local_openness', 'REAL');
// These columns are referenced by cleanup migrations below, so a fresh
// database must receive them before those queries run.
safeAddColumn('active_contexts', 'point_id', 'TEXT');
safeAddColumn('active_contexts', 'initiator_id', 'TEXT');
safeAddColumn('shop_offers', 'metadata', "TEXT NOT NULL DEFAULT '{}'");
safeAddColumn('shop_offers', 'available_from', 'INTEGER');
safeAddColumn('shop_offers', 'expires_at', 'INTEGER');
safeAddColumn('shop_offers', 'source_event_id', 'TEXT');

// Speech generated for a character is a remembered self-report, not authored
// canon. Reclassify records written by older builds so they cannot silently
// turn an improvised line into a confirmed biographical fact.
db.prepare(`
  UPDATE social_memories
  SET kind = 'subjective_report'
  WHERE owner = 'character' AND kind = 'personal_fact'
`).run();

// A pose is a single scene-level context. Before this migration every entry in
// occupiesPoints produced another row, so e.g. pose_all_fours was stored four
// times. Keep one row per pose and use global_pose as its canonical slot.
db.prepare(`
  DELETE FROM active_contexts
  WHERE rowid NOT IN (
    SELECT MIN(ac.rowid)
    FROM active_contexts ac
    JOIN action_presets ap ON ap.id = ac.action_id
    WHERE COALESCE(json_extract(ap.context_config_json, '$.type'), ap.type, '') = 'pose'
    GROUP BY ac.subject_id, ac.action_id
  )
    AND action_id IN (
      SELECT id FROM action_presets
      WHERE COALESCE(json_extract(context_config_json, '$.type'), type, '') = 'pose'
    )
`).run();
db.prepare(`
  UPDATE active_contexts
  SET point_id = 'global_pose'
  WHERE action_id IN (
    SELECT id FROM action_presets
    WHERE COALESCE(json_extract(context_config_json, '$.type'), type, '') = 'pose'
  )
`).run();

// Keep the engine id stable while presenting it as a human-readable target.
// The old generic groin node is superseded by concrete anatomy points.
db.prepare(`UPDATE point_presets SET label = 'Всё тело' WHERE id = 'systemic'`).run();
db.prepare(`UPDATE point_presets SET label = 'Грудь' WHERE id = 'chest'`).run();
db.prepare(`DELETE FROM active_contexts WHERE point_id = 'groin'`).run();
db.prepare(`DELETE FROM subject_point_states WHERE point_id = 'groin'`).run();
db.prepare(`DELETE FROM point_presets WHERE id = 'groin'`).run();
// Knees are not a selectable anatomy target.  Poses can still describe
// kneeling through their scene-level global_pose context.
db.prepare(`DELETE FROM active_contexts WHERE point_id = 'knees'`).run();
db.prepare(`DELETE FROM subject_point_states WHERE point_id = 'knees'`).run();
db.prepare(`DELETE FROM point_presets WHERE id = 'knees'`).run();

// Older builds treated naturally sensitive anatomy (85+) as hyperesthesia.
// Preserve only contexts whose sensitivity is genuinely elevated above baseline.
db.prepare(`
  DELETE FROM active_contexts
  WHERE action_id = 'effect_local_hyperesthesia'
    AND NOT EXISTS (
      SELECT 1 FROM subject_point_states point
      WHERE point.subject_id = active_contexts.subject_id
        AND point.point_id = active_contexts.point_id
        AND point.local_sensitivity >= COALESCE(point.baseline_local_sensitivity, point.local_sensitivity) + 15
    )
`).run();
db.prepare(`DELETE FROM state_triggers WHERE trigger_code LIKE 'local_hyperesthesia_%'`).run();

safeAddColumn('scenes', 'action_costs', "TEXT DEFAULT '{}'");
safeAddColumn('scenes', 'transitions', "TEXT DEFAULT '[]'");
safeAddColumn('scenes', 'description', "TEXT DEFAULT ''");
safeAddColumn('scenes', 'slots', "TEXT DEFAULT '[]'");
safeAddColumn('scenes', 'is_global_map', "INTEGER DEFAULT 0");

safeAddColumn('characters', 'current_scene_id', 'TEXT');
safeAddColumn('action_presets', 'requires_item', 'TEXT');
// Allow presets to include an optional model URL for avatar/VRM selection
safeAddColumn('action_presets', 'model_url', 'TEXT');

safeAddColumn('subjects', 'baseline_sensitivity', 'REAL');
safeAddColumn('subjects', 'baseline_capacity', 'REAL');
safeAddColumn('subjects', 'baseline_openness', 'REAL');
safeAddColumn('subjects', 'baseline_plasticity', 'REAL');
safeAddColumn('subjects', 'baseline_attitude', 'REAL');
safeAddColumn('subjects', 'preferences', "TEXT DEFAULT '{}'");

safeAddColumn('character_relations', 'openness', 'REAL DEFAULT 0');
safeAddColumn('character_relations', 'plasticity', 'REAL DEFAULT 0');
safeAddColumn('character_relations', 'baseline_attitude', 'REAL');
safeAddColumn('character_relations', 'baseline_openness', 'REAL');
safeAddColumn('character_relations', 'baseline_plasticity', 'REAL');
// Ensure newer columns exist for character_relations used by repositories
safeAddColumn('character_relations', 'familiarity_level', 'REAL DEFAULT 0');
safeAddColumn('character_relations', 'general_opinion', "TEXT DEFAULT ''");
safeAddColumn('character_relations', 'recent_memories', "TEXT DEFAULT '[]'");
safeAddColumn('scene_characters', 'slot_id', 'TEXT');
safeAddColumn('chat_memory', 'context_label', 'TEXT');
safeAddColumn('chat_memory', 'portrait_emotion', 'TEXT');
safeAddColumn('chat_memory', 'portrait_emotion_source', 'TEXT');
safeAddColumn('chat_memory', 'portrait_emotion_confidence', 'REAL');
safeAddColumn('chat_memory', 'world_minute', 'INTEGER');
// A chat line can be delivered into more than one participant's transcript.
// Keep its actual author and a shared identity with the line itself.
safeAddColumn('chat_memory', 'speaker_id', 'TEXT');
safeAddColumn('chat_memory', 'message_id', 'TEXT');
safeAddColumn('chat_memory', 'origin_chat_id', 'INTEGER');

// Repair social turns created before chat delivery was participant-owned.
// The source of truth remains pending_social_turns; this only fills the
// recipient's ordinary chat transcript with the same authored message.
db.exec(`
  UPDATE chat_memory
  SET speaker_id = (
        SELECT speaker_id FROM pending_social_turns turn
        WHERE turn.status = 'applied'
          AND turn.speaker_id = chat_memory.subject_id
          AND turn.speech = chat_memory.content
        ORDER BY turn.created_world_minute DESC
        LIMIT 1
      ),
      message_id = (
        SELECT id FROM pending_social_turns turn
        WHERE turn.status = 'applied'
          AND turn.speaker_id = chat_memory.subject_id
          AND turn.speech = chat_memory.content
        ORDER BY turn.created_world_minute DESC
        LIMIT 1
      )
  WHERE context_label = 'Социальная транзакция'
    AND message_id IS NULL
    AND EXISTS (
      SELECT 1 FROM pending_social_turns turn
      WHERE turn.status = 'applied'
        AND turn.speaker_id = chat_memory.subject_id
        AND turn.speech = chat_memory.content
    );

  UPDATE chat_memory
  SET origin_chat_id = id
  WHERE context_label = 'Социальная транзакция'
    AND origin_chat_id IS NULL
    AND subject_id = speaker_id;

  INSERT INTO chat_memory (
    subject_id, role, content, context_label, portrait_emotion, created_at,
    world_minute, speaker_id, message_id, origin_chat_id
  )
  SELECT
    turn.recipient_id, 'assistant', turn.speech, 'Социальная транзакция',
    source.portrait_emotion, source.created_at, source.world_minute,
    turn.speaker_id, turn.id, source.origin_chat_id
  FROM pending_social_turns turn
  JOIN chat_memory source ON source.message_id = turn.id
    AND source.subject_id = turn.speaker_id
  WHERE turn.status = 'applied'
    AND turn.speech IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM chat_memory delivered
      WHERE delivered.subject_id = turn.recipient_id
        AND delivered.message_id = turn.id
    );

  UPDATE chat_memory
  SET origin_chat_id = (
    SELECT source.origin_chat_id
    FROM chat_memory source
    WHERE source.context_label = 'Социальная транзакция'
      AND source.message_id = chat_memory.message_id
      AND source.subject_id = source.speaker_id
      AND source.origin_chat_id IS NOT NULL
    LIMIT 1
  )
  WHERE context_label = 'Социальная транзакция'
    AND origin_chat_id IS NULL
    AND EXISTS (
      SELECT 1
      FROM chat_memory source
      WHERE source.context_label = 'Социальная транзакция'
        AND source.message_id = chat_memory.message_id
        AND source.subject_id = source.speaker_id
        AND source.origin_chat_id IS NOT NULL
    );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS subject_edge_states (
    subject_id TEXT PRIMARY KEY,
    entered_at_minute INTEGER NOT NULL,
    cycles INTEGER NOT NULL DEFAULT 0,
    valence TEXT NOT NULL DEFAULT 'mixed',
    source_action_id TEXT,
    source_point_id TEXT,
    last_expression_minute INTEGER,
    updated_at_minute INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS interaction_stances (
    subject_id TEXT NOT NULL,
    actor_id TEXT NOT NULL,
    request TEXT NOT NULL DEFAULT 'none',
    scope_points TEXT NOT NULL DEFAULT '[]',
    scope_tags TEXT NOT NULL DEFAULT '[]',
    intensity REAL NOT NULL DEFAULT 0,
    source_action_id TEXT,
    ignored_count INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (subject_id, actor_id)
  );
  CREATE TABLE IF NOT EXISTS relationship_dynamics (
    subject_id TEXT NOT NULL,
    actor_id TEXT NOT NULL,
    resistance REAL NOT NULL DEFAULT 0,
    learned_compliance REAL NOT NULL DEFAULT 0,
    dependency REAL NOT NULL DEFAULT 0,
    dissociation REAL NOT NULL DEFAULT 0,
    fear REAL NOT NULL DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (subject_id, actor_id)
  );
  CREATE TABLE IF NOT EXISTS pending_command_focus (
    subject_id TEXT NOT NULL,
    player_id TEXT NOT NULL,
    scene_id TEXT NOT NULL,
    source_text TEXT NOT NULL,
    description TEXT NOT NULL,
    intent_json TEXT NOT NULL,
    routing_json TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (subject_id, player_id)
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS visual_asset_reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    asset_path TEXT NOT NULL,
    character_id TEXT NOT NULL,
    decision TEXT NOT NULL,
    issues_json TEXT NOT NULL DEFAULT '[]',
    note TEXT DEFAULT '',
    metadata_json TEXT NOT NULL DEFAULT '{}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(asset_path, character_id)
  );
  CREATE INDEX IF NOT EXISTS idx_visual_reviews_decision ON visual_asset_reviews(decision, updated_at DESC);
`);

// Earlier builds converted negative dialogue into an unscoped physical
// boundary. Those rows make every later touch look like a violation forever.
db.exec(`
  UPDATE interaction_stances
  SET status='resolved', updated_at=CURRENT_TIMESTAMP
  WHERE status='active'
    AND scope_points='[]'
    AND source_action_id IN ('verbal_pressure', 'conversation')
`);

// Reconcile live stop requests that were verbally confirmed before the
// acknowledgement-aware lifecycle existed. This closes only the immediate
// command; relationship and episodic memory of an earlier violation remain.
db.exec(`
  UPDATE interaction_stances AS stance
  SET status='resolved', intensity=0, updated_at=CURRENT_TIMESTAMP
  WHERE status='active'
    AND EXISTS (
      SELECT 1 FROM chat_memory AS message
      WHERE message.subject_id=stance.subject_id
        AND message.role='user'
        AND message.created_at >= stance.updated_at
        AND (
          message.content LIKE '%остановил%'
          OR message.content LIKE '%перестал%'
          OR message.content LIKE '%прекратил%'
          OR message.content LIKE '%больше не буду%'
          OR message.content LIKE '%не повторится%'
        )
    )
`);

db.exec(`
  UPDATE subjects
  SET baseline_sensitivity = COALESCE(baseline_sensitivity, sensitivity),
      baseline_capacity = COALESCE(baseline_capacity, capacity),
      baseline_openness = COALESCE(baseline_openness, openness),
      baseline_plasticity = COALESCE(baseline_plasticity, plasticity),
      baseline_attitude = COALESCE(baseline_attitude, attitude)
`);

db.exec(`
  UPDATE subject_point_states
  SET baseline_local_sensitivity = COALESCE(baseline_local_sensitivity, local_sensitivity),
      baseline_local_attitude = COALESCE(baseline_local_attitude, local_attitude),
      baseline_local_openness = COALESCE(baseline_local_openness, local_openness)
`);

db.exec(`
  UPDATE character_relations
  SET baseline_attitude = COALESCE(baseline_attitude, attitude),
      baseline_openness = COALESCE(baseline_openness, openness),
      baseline_plasticity = COALESCE(baseline_plasticity, plasticity)
`);

try {
  db.exec(`ALTER TABLE active_contexts ADD COLUMN point_id TEXT`);
} catch (e) {
  // Ignore if column already exists
}

try {
  db.exec(`ALTER TABLE active_contexts ADD COLUMN initiator_id TEXT`);
} catch (e) {
  // Ignore if column already exists
}

try {
  db.exec(`ALTER TABLE subject_edge_states ADD COLUMN last_expression_minute INTEGER`);
} catch (e) {
  // New installations receive it from CREATE TABLE; existing saves migrate here.
}
