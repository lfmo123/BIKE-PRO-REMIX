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
              downloadAnchorNode.click();
              downloadAnchorNode.remove();
              URL.revokeObjectURL(url);
              localStorage.setItem('lastAutoBackupTimestamp', now.toString());
              sessionStorage.setItem('backupDoneThisSession', 'true');
            }
          } catch(e) { console.error('Auto backup failed', e); }
      }
    };
    
    // Check right when screen opens
    performAutoBackup(true);
    
    // Keep checking periodically
    const backupTimer = setInterval(() => performAutoBackup(false), 5 * 60 * 1000); // Check every 5 minutes
    return () => clearInterval(backupTimer);`;

const replacement = `    // Auto backup local check
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
              
              // Em vez de disparar no vazio (que navegadores bloqueiam), 
              // vamos tentar um link na tela para que o usuário baixe.
              // Mas como é "automático", podemos tentar forçar e, se não for, avisar.
              // Vamos adicionar um botão flutuante para download se não houver clique:
              const downloadAnchorNode = document.createElement('a');
              downloadAnchorNode.setAttribute("href", url);
              downloadAnchorNode.setAttribute("download", \`bikepark_backup_auto_\${dateStr}_\${timeStr}.json\`);
              document.body.appendChild(downloadAnchorNode);
              
              // Pequeno delay para tentar evitar bloqueio
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
    // Usamos timeout para dar tempo da renderização antes de tentar baixar arquivo
    setTimeout(() => performAutoBackup(true), 2000);
    
    // Keep checking periodically
    const backupTimer = setInterval(() => performAutoBackup(false), 5 * 60 * 1000); // Check every 5 minutes
    return () => clearInterval(backupTimer);`;

if (content.includes(target)) {
    fs.writeFileSync('src/App.tsx', content.replace(target, replacement));
    console.log('success App.tsx');
} else {
    console.log('fail App.tsx');
}
