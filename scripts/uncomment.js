const fs = require('fs');
function uncomment(file, endLine) {
  const txt = fs.readFileSync(file, 'utf8');
  const lines = txt.split('\n');
  const newLines = lines.slice(0, endLine).map(l => {
    if (l.startsWith('// ')) return l.substring(3);
    if (l.startsWith('//')) return l.substring(2);
    return l;
  });
  fs.writeFileSync(file, newLines.join('\n'));
}

uncomment('src/modules/settlement/settlement.routes.ts', 168);
uncomment('src/modules/settlement/settlement.service.ts', 348);
