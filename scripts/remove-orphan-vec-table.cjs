const Database = require('better-sqlite3');
const sqliteVec = require('sqlite-vec');
const db = new Database('/Users/linzhihao/.vibe-research/vibe-research.db');
db.pragma('journal_mode = WAL');
sqliteVec.load(db);
try {
  db.exec(`
    PRAGMA writable_schema = ON;
    DELETE FROM sqlite_master WHERE type = 'table' AND name = 'vec_chunks';
    DELETE FROM sqlite_master WHERE type = 'table' AND name = 'vec_chunks_chunks';
    DELETE FROM sqlite_master WHERE type = 'table' AND name = 'vec_chunks_info';
    DELETE FROM sqlite_master WHERE type = 'table' AND name = 'vec_chunks_rowids';
    DELETE FROM sqlite_master WHERE type = 'table' AND name = 'vec_chunks_vector_chunks00';
    PRAGMA writable_schema = OFF;
  `);
  db.pragma('integrity_check');
  console.log('removed vec_chunks schema entries');
} finally {
  db.close();
}
process.exit(0);
