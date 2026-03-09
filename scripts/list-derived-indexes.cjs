const Database = require('better-sqlite3');
const sqliteVec = require('sqlite-vec');
const db = new Database('/Users/linzhihao/.vibe-research/vibe-research.db');
db.pragma('journal_mode = WAL');
sqliteVec.load(db);
const rows = db
  .prepare(
    "SELECT name, type, sql FROM sqlite_master WHERE name LIKE 'vec_%' OR name LIKE 'paper_search_units_fts%' ORDER BY name",
  )
  .all();
for (const row of rows) {
  console.log('---');
  console.log(row.type, row.name);
  console.log(row.sql);
}
db.close();
process.exit(0);
