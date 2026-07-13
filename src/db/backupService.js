import fs from 'fs';
import path from 'path';
import cron from 'node-cron';
import 'dotenv/config';

// Firebase imports
import * as firebaseDb from './firebaseDb.js';
import * as mysqlDb from './mysqlDb.js';
import { readDb } from './nodeDb.js';

const backupsDir = path.resolve(process.cwd(), 'backups');

export function initBackupService(dbType) {
  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true });
  }

  const performBackup = async () => {
    console.log(`Iniciando rotina de backups automáticos para banco: ${dbType}...`);
    try {
      const dateStr = new Date().toISOString().replace(/:/g, '-').split('.')[0]; 
      const localBackupPath = path.join(backupsDir, `backup_${dbType}_${dateStr}.json`);
      
      let backupData = {};
      if (dbType === 'firebase') {
        backupData = {
          vehicles: await firebaseDb.getVehicles(),
          transactions: await firebaseDb.getTransactions(),
          lostCards: await firebaseDb.getLostCards(),
          pricing: await firebaseDb.getPricing(),
        };
      } else if (dbType === 'mysql') {
        backupData = {
          vehicles: await mysqlDb.getVehicles(),
          transactions: await mysqlDb.getTransactions(),
          lostCards: await mysqlDb.getLostCards(),
          pricing: await mysqlDb.getPricing(),
        };
      } else {
        backupData = readDb();
      }

      fs.writeFileSync(localBackupPath, JSON.stringify(backupData, null, 2), 'utf-8');
      console.log(`[Backup Local] Salvo com sucesso em: ${localBackupPath}`);
    } catch (err) {
      console.error('[Erro Backup] Falha durante o processo de backup:', err);
    }
  };

  // Run on startup
  performBackup();

  // Run every hour
  cron.schedule('0 * * * *', performBackup);
}
