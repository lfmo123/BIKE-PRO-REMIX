const fs = require('fs');
let content = fs.readFileSync('src/components/Settings.tsx', 'utf-8');
content = content.replace('a cada 4 horas.', 'a cada hora.');
fs.writeFileSync('src/components/Settings.tsx', content);
console.log('success Settings.tsx');
