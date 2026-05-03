import Database from 'better-sqlite3';
const db = new Database('./cyberjack.sqlite');
const s = db.prepare('SELECT * FROM subjects LIMIT 1').get();
console.log(s);
