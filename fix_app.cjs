const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

// Find the performAutoBackup block
const match = code.match(/const performAutoBackup = async.*?URL\.revokeObjectURL\(url\);\s*localStorage\.setItem\('lastAutoBackupTimestamp', now\.toString\(\)\);\s*sessionStorage\.setItem\('backupDoneThisSession', 'true'\);\s*}\s*}\s*catch\(e\)\s*{\s*console\.error\('Auto backup failed', e\);\s*}\s*}\s*};/s);

if (match) {
    const newBlock = `const performAutoBackup = async (forceInit = false) => {
      const isEnabled = localStorage.getItem('autoBackupEnabled');
      if (isEnabled !== 'true') return;

      const lastBackupTime = parseInt(localStorage.getItem('lastAutoBackupTimestamp') || '0', 10);
      const now = Date.now();
      
      const ONE_HOUR = 1 * 60 * 60 * 1000;
      
      const alreadyDoneThisSession = sessionStorage.getItem('backupDoneThisSession') === 'true';
      const shouldBackup = (forceInit && !alreadyDoneThisSession) || (now - lastBackupTime >= ONE_HOUR);
      
      if (shouldBackup) { 
         try {
            console.log('Executando backup automático local...');
            const res = await fetch('/api/backup/export');
            if (res.ok) {
              const backupData = await res.json();
              const dateStr = getLocalDateString();
              const timeStr = new Date().toLocaleTimeString('pt-BR').replace(/:/g, '-');
              const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const downloadAnchorNode = document.createElement('a');
              downloadAnchorNode.setAttribute("href", url);
              downloadAnchorNode.setAttribute("download", \`bikepark_backup_auto_\${dateStr}_\${timeStr}.json\`);
              document.body.appendChild(downloadAnchorNode);
              setTimeout(() => {
                downloadAnchorNode.click();
                downloadAnchorNode.remove();
                URL.revokeObjectURL(url);
              }, 100);
              localStorage.setItem('lastAutoBackupTimestamp', now.toString());
              sessionStorage.setItem('backupDoneThisSession', 'true');
            }
          } catch(e) { console.error('Auto backup failed', e); }
      }
    };`;
    
    code = code.replace(match[0], newBlock);
    
    // Check right when screen opens -> setTimeout
    code = code.replace('performAutoBackup(true);', 'setTimeout(() => performAutoBackup(true), 1500);');
    
    fs.writeFileSync('src/App.tsx', code);
    console.log("App.tsx fixed");
} else {
    console.log("Could not find performAutoBackup block");
}
