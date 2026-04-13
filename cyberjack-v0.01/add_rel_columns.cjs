const Database = require('better-sqlite3');
const db = new Database('database.sqlite');
try { db.exec("ALTER TABLE character_relations ADD COLUMN familiarity_level REAL DEFAULT 0"); } catch (e) {}
try { db.exec("ALTER TABLE character_relations ADD COLUMN general_opinion TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE character_relations ADD COLUMN recent_memories TEXT"); } catch (e) {}
console.log("Columns added or already exist");
