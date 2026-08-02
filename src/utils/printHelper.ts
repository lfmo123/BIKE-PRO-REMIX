export const getThermalPrinterStyle = () => `
  <style>
    body { 
      font-family: 'Courier New', Courier, monospace; 
      padding: 10px; 
      color: #000; 
      font-size: 11pt; 
      max-width: 100%; 
      margin: 0 auto; 
      background: #fff; 
      line-height: 1.3; 
    }
    h1 { font-size: 14pt; font-weight: 900; margin-bottom: 10px; text-align: center; text-transform: uppercase; color: #000; border-bottom: 2px dashed #000; padding-bottom: 5px; }
    h2 { font-size: 12pt; font-weight: 900; margin: 0 0 10px 0; text-transform: uppercase; color: #000; text-align: center; }
    
    .subtitle { text-align: center; font-size: 11pt; margin-bottom: 15px; font-weight: 900; }
    .section { margin-bottom: 15px; border-bottom: 2px dashed #000; padding-bottom: 10px; page-break-inside: avoid; }
    
    .row { display: flex; justify-content: space-between; margin-bottom: 5px; font-size: 11pt; font-weight: bold; }
    .row:last-child { margin-bottom: 0; }
    .label { font-weight: 900; }
    .value { font-weight: 900; font-size: 11pt; text-align: right; }
    
    .header-info { display: flex; flex-direction: column; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 2px dashed #000; }
    .header-row { display: flex; justify-content: space-between; margin-bottom: 5px; font-size: 11pt; font-weight: bold; }
    
    .total-row { display: flex; justify-content: space-between; margin-top: 10px; padding-top: 5px; border-top: 2px dashed #000; font-size: 12pt; font-weight: 900; }
    
    .print-item { margin-bottom: 10px; border-bottom: 1px dotted #000; padding-bottom: 5px; }
    .print-item-header { font-size: 11pt; font-weight: 900; margin-bottom: 2px; }
    .print-item-row { display: flex; justify-content: space-between; font-size: 10pt; font-weight: normal; }
    .print-item-total { font-weight: 900; font-size: 11pt; text-align: right; }

    .summary-card { margin-bottom: 8px; border-bottom: 1px dashed #ccc; padding-bottom: 4px; display: flex; flex-direction: column; }
    .summary-card:last-child { border-bottom: none; }
    .summary-card .card-title { font-size: 11pt; text-transform: uppercase; font-weight: 900; }
    .summary-card .card-value { font-size: 12pt; font-weight: 900; text-align: right; }

    .text-center { text-align: center; }
    .footer { text-align: center; margin-top: 30px; font-size: 11pt; color: #000; font-weight: bold; padding-bottom: 20px; }

    @media print { 
      body { padding: 0; width: 100%; max-width: 100%; margin: 0; } 
    }
  </style>
`;

export const generateThermalPrintHtml = (title: string, bodyContent: string) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>${title}</title>
      ${getThermalPrinterStyle()}
    </head>
    <body>
      ${bodyContent}
    </body>
    </html>
  `;
};

export const printHtml = (html: string) => {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '100vw';
  iframe.style.height = '100vh';
  iframe.style.visibility = 'hidden';
  iframe.style.pointerEvents = 'none';
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
};
