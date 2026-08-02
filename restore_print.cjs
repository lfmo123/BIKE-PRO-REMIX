const fs = require('fs');
let content = fs.readFileSync('src/utils/printHelper.ts', 'utf-8');

const replacement = `export const printHtml = (html: string) => {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);
  
  const doc = iframe.contentWindow?.document || iframe.contentDocument;
  if (doc) {
    doc.open();
    doc.write(html);
    doc.close();
  }
  
  setTimeout(() => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch (e) {
      console.error("Erro ao imprimir:", e);
    }
    setTimeout(() => {
      if (document.body.contains(iframe)) {
        document.body.removeChild(iframe);
      }
    }, 3000);
  }, 500);
};`;

content = content.replace(/export const printHtml = \([\s\S]+/, replacement);

content = content.replace('@media print { html, body { height: auto !important; min-height: 100% !important; overflow: visible !important; } ', '@media print { ');

fs.writeFileSync('src/utils/printHelper.ts', content);
