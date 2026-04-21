import fs from 'fs';
import path from 'path';
import cron from 'node-cron';
import { google } from 'googleapis';
import 'dotenv/config';

const dbPath = path.resolve(process.cwd(), 'database.json');
const backupsDir = path.resolve(process.cwd(), 'backups');

export function initBackupService() {
  // Configura a pasta base de backups local na Hostinger
  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true });
  }

  // Executa o backup todo dia à meia noite ("0 0 * * *")
  // Para fins de teste você pode usar "* * * * *" para a cada minuto
  cron.schedule('0 0 * * *', async () => {
    console.log('Iniciando rotina de backups automáticos...');
    
    // 1. Backup Local (Hostinger)
    try {
      const dateStr = new Date().toISOString().replace(/:/g, '-').split('.')[0]; 
      const localBackupPath = path.join(backupsDir, `database_backup_${dateStr}.json`);
      
      if (fs.existsSync(dbPath)) {
        fs.copyFileSync(dbPath, localBackupPath);
        console.log(`[Backup Local] Salvo com sucesso em: ${localBackupPath}`);
      }
    } catch (err) {
      console.error('[Erro Backup Local] Falha ao criar arquivo:', err);
    }

    // 2. Backup Nuvem (Google Drive)
    await uploadToGoogleDrive();
  });
}

async function uploadToGoogleDrive() {
  const credentialsJson = process.env.GOOGLE_SERVICE_ACCOUNT_CREDENTIALS;
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

  if (!credentialsJson || !folderId) {
    console.log('[Backup Drive] Variáveis não encontradas (GOOGLE_SERVICE_ACCOUNT_CREDENTIALS ou GOOGLE_DRIVE_FOLDER_ID). Pulando envio para nuvem.');
    return;
  }

  try {
    const credentials = JSON.parse(credentialsJson);

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/drive.file'],
    });

    const drive = google.drive({ version: 'v3', auth });
    
    const dateStr = new Date().toISOString().replace(/:/g, '-').split('.')[0]; 
    const fileName = `database_backup_${dateStr}.json`;

    if (!fs.existsSync(dbPath)) return;

    const fileMetadata = {
      name: fileName,
      parents: [folderId],
    };
    
    const media = {
      mimeType: 'application/json',
      body: fs.createReadStream(dbPath),
    };

    const file = await drive.files.create({
      resource: fileMetadata,
      media: media,
      fields: 'id',
    });

    console.log(`[Backup Drive] Upload feito com sucesso! File ID: ${file.data.id}`);
  } catch (err) {
    console.error('[Erro Backup Drive] Falha ao realizar upload pro Google:', err);
  }
}
