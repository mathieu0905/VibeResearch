const Database = require('better-sqlite3');
const sqliteVec = require('sqlite-vec');
const dbPath = '/Users/linzhihao/.vibe-research/vibe-research.db';
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
sqliteVec.load(db);
const tables = [
  'vec_search_units',
  'vec_chunks',
  'vec_chunks_chunks',
  'vec_chunks_info',
  'vec_chunks_rowids',
  'vec_chunks_vector_chunks00',
  'paper_search_units_fts',
  'paper_search_units_fts_config',
  'paper_search_units_fts_content',
  'paper_search_units_fts_data',
  'paper_search_units_fts_docsize',
  'paper_search_units_fts_idx',
];
for (const table of tables) {
  try {
    db.prepare(`DROP TABLE IF EXISTS ${table}`).run();
    console.log('dropped', table);
  } catch (error) {
    console.error('failed', table, error && error.message ? error.message : String(error));
  }
}
db.close();
process.exit(0);
