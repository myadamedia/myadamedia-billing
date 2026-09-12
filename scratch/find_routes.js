const fs = require('fs');
const c = fs.readFileSync('routes/adminPortal.js', 'utf8');
c.split('\n').forEach((l, i) => {
  if (l.includes('router.get(')) {
    console.log(`${i + 1}: ${l.trim()}`);
  }
});
