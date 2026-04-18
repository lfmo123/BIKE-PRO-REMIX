import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.resolve(process.cwd(), 'database.sqlite');
export const db = new Database(dbPath);

// Initialize database tables
export function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS vehicles (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      identifier TEXT NOT NULL,
      ownerName TEXT NOT NULL,
      cardNumber TEXT NOT NULL,
      checkInTime INTEGER NOT NULL,
      checkOutTime INTEGER,
      status TEXT NOT NULL,
      price REAL
    );

    CREATE TABLE IF NOT EXISTS pricing (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      bicycle REAL NOT NULL,
      ebike REAL NOT NULL,
      motorcycle REAL NOT NULL
    );
  `);

  // Insert default pricing if it doesn't exist
  const stmt = db.prepare('SELECT * FROM pricing WHERE id = 1');
  const pricing = stmt.get();
  
  if (!pricing) {
    db.prepare('INSERT INTO pricing (id, bicycle, ebike, motorcycle) VALUES (1, 5.0, 8.0, 12.0)').run();
  }
}
