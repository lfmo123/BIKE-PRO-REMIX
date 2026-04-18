import fs from 'fs';
import path from 'path';

// Define the schema for our local JSON database
export interface NodeDB {
  vehicles: any[];
  pricing: any;
}

const dbPath = path.resolve(process.cwd(), 'database.json');

const defaultDbState: NodeDB = {
  vehicles: [],
  pricing: {
    bicycle: 5,
    ebike: 8,
    motorcycle: 12,
    totalSpots: 50
  }
};

// Initialize DB file if it doesn't exist
function initDb() {
  if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, JSON.stringify(defaultDbState, null, 2));
  }
}

// Read database
export function readDb(): NodeDB {
  initDb();
  try {
    const data = fs.readFileSync(dbPath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    return defaultDbState;
  }
}

// Write database
export function writeDb(data: NodeDB) {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}
