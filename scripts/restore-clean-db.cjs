const fs = require('fs');
const path = '/Users/linzhihao/.vibe-research/vibe-research.db';
const source = '/tmp/vibe-research-db-fix/vibe-research.new.db';
for (const target of [path, `${path}-wal`, `${path}-shm`]) {
  try {
    fs.unlinkSync(target);
    console.log('removed', target);
  } catch (error) {
    if (!error || error.code !== 'ENOENT') throw error;
  }
}
fs.copyFileSync(source, path);
console.log('restored clean db');
