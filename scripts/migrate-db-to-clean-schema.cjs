const Database = require('better-sqlite3');
const sqliteVec = require('sqlite-vec');

const oldPath = '/Users/linzhihao/.vibe-research/vibe-research.db';
const newPath = '/tmp/vibe-research-db-fix/vibe-research.new.db';
const oldDb = new Database(oldPath, { readonly: true });
sqliteVec.load(oldDb);
const newDb = new Database(newPath);

const excluded = new Set([
  'vec_chunks',
  'vec_chunks_chunks',
  'vec_chunks_info',
  'vec_chunks_rowids',
  'vec_chunks_vector_chunks00',
  'vec_search_units',
  'paper_search_units_fts',
  'paper_search_units_fts_config',
  'paper_search_units_fts_content',
  'paper_search_units_fts_data',
  'paper_search_units_fts_docsize',
  'paper_search_units_fts_idx',
  'sqlite_sequence',
  '_prisma_migrations',
  'RecommendationCandidate',
  'RecommendationResult',
  'RecommendationFeedback',
]);

const tables = oldDb
  .prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  )
  .all()
  .map((row) => row.name)
  .filter((name) => !excluded.has(name));

function getColumns(db, table) {
  return db
    .prepare(`PRAGMA table_info(${table})`)
    .all()
    .map((row) => row.name);
}

newDb.pragma('foreign_keys = OFF');
const copyTable = newDb.transaction((table) => {
  const oldCols = getColumns(oldDb, table);
  const newCols = getColumns(newDb, table);
  const cols = oldCols.filter((col) => newCols.includes(col));
  if (cols.length === 0) return;
  const quoted = cols.map((col) => `"${col}"`).join(', ');
  const rows = oldDb.prepare(`SELECT ${quoted} FROM ${table}`).all();
  if (rows.length === 0) return;
  const placeholders = cols.map((col) => `@${col}`).join(', ');
  const stmt = newDb.prepare(`INSERT INTO ${table} (${quoted}) VALUES (${placeholders})`);
  for (const row of rows) stmt.run(row);
  console.log(`copied ${rows.length} rows -> ${table}`);
});

for (const table of tables) {
  copyTable(table);
}

newDb.pragma('foreign_keys = ON');
oldDb.close();
newDb.close();
console.log('done');
