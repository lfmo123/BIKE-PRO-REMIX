const fs = require('fs');
let content = fs.readFileSync('src/utils/printHelper.ts', 'utf-8');

const target = `  const iframe = document.createElement('iframe');
  iframe.style.position = 'absolute';
  iframe.style.top = '0';
  iframe.style.left = '0';
  iframe.style.width = '100%';
  iframe.style.height = '100vh'; // Will be overridden or ignored by print
  iframe.style.zIndex = '-1';
  iframe.style.opacity = '0';
  iframe.style.pointerEvents = 'none';
  iframe.style.border = 'none';`;

const replacement = `  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';`;

content = content.replace(target, replacement);

fs.writeFileSync('src/utils/printHelper.ts', content);
