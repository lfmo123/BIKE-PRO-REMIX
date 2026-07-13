const fs = require('fs');

let content = fs.readFileSync('src/App.tsx', 'utf-8');

const target = `    // Auto backup local check
    const performAutoBackup = async (forceInit = false) => {
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
    };
    
    // Check right when screen opens
    setTimeout(() => performAutoBackup(true), 1500);
    
    // Keep checking periodically
    const backupTimer = setInterval(() => performAutoBackup(false), 5 * 60 * 1000); // Check every 5 minutes
    return () => clearInterval(backupTimer);`;

const replacement = `    // Auto backup local check
    let interactionBackupDone = false;
    
    const performAutoBackup = async (reason = 'timer') => {
      const isEnabled = localStorage.getItem('autoBackupEnabled');
      if (isEnabled !== 'true') return;

      const lastBackupTime = parseInt(localStorage.getItem('lastAutoBackupTimestamp') || '0', 10);
      const now = Date.now();
      
      const ONE_HOUR = 1 * 60 * 60 * 1000;
      
      // Permitir backup de inicialização (startup) ou a cada hora
      const shouldBackup = (reason === 'startup') || (now - lastBackupTime >= ONE_HOUR);
      
      if (shouldBackup) { 
         try {
            console.log(\`Executando backup automático local (\${reason})...\`);
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
              downloadAnchorNode.click();
              downloadAnchorNode.remove();
              URL.revokeObjectURL(url);
              localStorage.setItem('lastAutoBackupTimestamp', now.toString());
            }
          } catch(e) { console.error('Auto backup failed', e); }
      }
    };
    
    // Vinculamos à primeira interação para evitar bloqueio de popup do navegador
    const onFirstInteraction = () => {
      if (!interactionBackupDone) {
        interactionBackupDone = true;
        document.removeEventListener('click', onFirstInteraction);
        document.removeEventListener('touchstart', onFirstInteraction);
        performAutoBackup('startup');
      }
    };
    
    document.addEventListener('click', onFirstInteraction);
    document.addEventListener('touchstart', onFirstInteraction);
    
    // Keep checking periodically
    const backupTimer = setInterval(() => performAutoBackup('timer'), 5 * 60 * 1000); // Check every 5 minutes
    
    return () => {
      clearInterval(backupTimer);
      document.removeEventListener('click', onFirstInteraction);
      document.removeEventListener('touchstart', onFirstInteraction);
    };`;

if (content.includes(target)) {
    fs.writeFileSync('src/App.tsx', content.replace(target, replacement));
    console.log('success App.tsx');
} else {
    console.log('fail App.tsx target not found');
}
