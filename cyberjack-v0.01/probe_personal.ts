
import { db } from "./src/infrastructure/db";
import "./src/infrastructure/seed";
import "./src/infrastructure/seedContracts";
const rows = db.prepare("SELECT id, state, format, personal, subject_id FROM asset_contracts").all();
const personal = rows.filter(r => r.personal);
console.log("total:", rows.length, "personal:", personal.length);
console.log("personal ids:", personal.map(r => r.id).join(", "));
