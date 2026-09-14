const db = require('../config/database');
const tbls = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all().map(r => r.name);
console.log(JSON.stringify(tbls, null, 2));
process.exit(0);
