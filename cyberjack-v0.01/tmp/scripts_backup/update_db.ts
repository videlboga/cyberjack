import Database from 'better-sqlite3';

const db = new Database('cyberjack.sqlite', { verbose: console.log });

db.exec(`
  ALTER TABLE point_presets ADD COLUMN parent_id TEXT;
  ALTER TABLE point_presets ADD COLUMN provides_functions TEXT DEFAULT '[]';
  ALTER TABLE point_presets ADD COLUMN tags TEXT DEFAULT '[]';

  ALTER TABLE context_presets ADD COLUMN type TEXT DEFAULT 'condition';
  -- Note: slot might already be used, but since the previous request had point_id acting as slot, we'll keep slot separate.
  ALTER TABLE context_presets ADD COLUMN slot TEXT DEFAULT 'general';
  ALTER TABLE context_presets ADD COLUMN exclusive_within_slot INTEGER DEFAULT 0;
  ALTER TABLE context_presets ADD COLUMN blocks_slots TEXT DEFAULT '[]';
  ALTER TABLE context_presets ADD COLUMN affected_point_ids TEXT DEFAULT '[]';
  ALTER TABLE context_presets ADD COLUMN blocked_functions TEXT DEFAULT '[]';
  ALTER TABLE context_presets ADD COLUMN boosted_functions TEXT DEFAULT '[]';
  ALTER TABLE context_presets ADD COLUMN required_functions TEXT DEFAULT '[]';
  ALTER TABLE context_presets ADD COLUMN priority INTEGER DEFAULT 0;
`);
