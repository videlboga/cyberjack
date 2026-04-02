// src/infrastructure/db.ts
import Database from 'better-sqlite3';

export const db = new Database('cyberjack.sqlite', { verbose: console.log });

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS players (
    id TEXT PRIMARY KEY,
    resources TEXT NOT NULL -- JSON string for resources map
  );

  CREATE TABLE IF NOT EXISTS subjects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    sensitivity REAL NOT NULL,
    capacity REAL NOT NULL,
    openness REAL NOT NULL,
    plasticity REAL NOT NULL,
    attitude REAL NOT NULL
  );

  CREATE TABLE IF NOT EXISTS subject_point_states (
    subject_id TEXT NOT NULL,
    point_id TEXT NOT NULL,
    local_sensitivity REAL NOT NULL,
    local_attitude REAL NOT NULL,
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
    available_actions TEXT NOT NULL -- JSON
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
    priority INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS active_contexts (
    event_id TEXT NOT NULL,     -- Optional, to bind it to a scene or global state 
    context_id TEXT NOT NULL,
    duration INTEGER DEFAULT -1, ticks_active REAL DEFAULT 0,
    PRIMARY KEY (event_id, context_id)
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
