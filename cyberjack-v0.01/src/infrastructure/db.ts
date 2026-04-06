import Database from 'better-sqlite3';

export const db = new Database('cyberjack.sqlite', { verbose: console.log });

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS players (
    id TEXT PRIMARY KEY,
    resources TEXT NOT NULL -- JSON string for resources map
  );

  CREATE TABLE IF NOT EXISTS characters (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    kind TEXT NOT NULL,
    subject_id TEXT,
    player_id TEXT,
    current_scene_id TEXT
  );

  CREATE TABLE IF NOT EXISTS character_relations (
    from_id TEXT NOT NULL,
    to_id TEXT NOT NULL,
    knows INTEGER DEFAULT 1,
    present INTEGER DEFAULT 1,
    can_interact INTEGER DEFAULT 1,
    attitude REAL NOT NULL DEFAULT 50,
    baseline_attitude REAL,
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
    familiarity REAL DEFAULT 0,
    exposure_count REAL DEFAULT 0,
    baseline_local_sensitivity REAL,
    baseline_local_attitude REAL,
    PRIMARY KEY (subject_id, point_id)
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
    values_json TEXT NOT NULL -- JSON: { intensity, valence, contact, sharpness, novelty }
  );

  CREATE TABLE IF NOT EXISTS point_presets (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    values_json TEXT NOT NULL, -- JSON: { localSensitivity, localAttitude }
    parent_id TEXT,
    provides_functions TEXT DEFAULT '[]',
    tags TEXT DEFAULT '[]'
  );

  CREATE TABLE IF NOT EXISTS context_presets (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    point_id TEXT DEFAULT 'general',
    modifiers_json TEXT NOT NULL, -- JSON: Partial<CompiledAction>
    type TEXT DEFAULT 'condition',
    slot TEXT DEFAULT 'general',
    exclusive_within_slot INTEGER DEFAULT 0,
    blocks_slots TEXT DEFAULT '[]',
    affected_point_ids TEXT DEFAULT '[]',
    blocked_functions TEXT DEFAULT '[]',
    boosted_functions TEXT DEFAULT '[]',
    required_functions TEXT DEFAULT '[]',
    priority INTEGER DEFAULT 0,
    self_applicable INTEGER DEFAULT 0,
    self_text TEXT,
    forced_text TEXT,
    removal_text TEXT
  );

  CREATE TABLE IF NOT EXISTS active_contexts (
    event_id TEXT NOT NULL,     -- Optional, to bind it to a scene or global state
    context_id TEXT NOT NULL,
    duration INTEGER DEFAULT -1,
    ticks_active REAL DEFAULT 0,
    PRIMARY KEY (event_id, context_id)
  );

  CREATE TABLE IF NOT EXISTS chat_memory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subject_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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

  CREATE TABLE IF NOT EXISTS chat_memory_summary (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subject_id TEXT NOT NULL,
    summary_text TEXT NOT NULL,
    important_events TEXT DEFAULT '[]',
    start_message_id INTEGER,
    end_message_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  
  CREATE INDEX IF NOT EXISTS idx_chat_summary_subject ON chat_memory_summary(subject_id, created_at DESC);
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
safeAddColumn('scenes', 'action_costs', "TEXT DEFAULT '{}'");
safeAddColumn('scenes', 'transitions', "TEXT DEFAULT '[]'");
safeAddColumn('characters', 'current_scene_id', 'TEXT');
safeAddColumn('subjects', 'baseline_sensitivity', 'REAL');
safeAddColumn('subjects', 'baseline_capacity', 'REAL');
safeAddColumn('subjects', 'baseline_openness', 'REAL');
safeAddColumn('subjects', 'baseline_plasticity', 'REAL');
safeAddColumn('subjects', 'baseline_attitude', 'REAL');
safeAddColumn('character_relations', 'baseline_attitude', 'REAL');
safeAddColumn('context_presets', 'self_applicable', 'INTEGER DEFAULT 0');
safeAddColumn('context_presets', 'self_text', 'TEXT');
safeAddColumn('context_presets', 'forced_text', 'TEXT');
safeAddColumn('context_presets', 'removal_text', 'TEXT');

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
      baseline_local_attitude = COALESCE(baseline_local_attitude, local_attitude)
`);

db.exec(`
  UPDATE character_relations
  SET baseline_attitude = COALESCE(baseline_attitude, attitude)
`);
