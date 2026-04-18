import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { db, initDb } from './src/db/index.js';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Initialize database
  initDb();

  // --- API Routes ---

  // Get all vehicles
  app.get('/api/vehicles', (req, res) => {
    try {
      const vehicles = db.prepare('SELECT * FROM vehicles ORDER BY checkInTime DESC').all();
      res.json(vehicles);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch vehicles' });
    }
  });

  // Check-in a new vehicle
  app.post('/api/vehicles', (req, res) => {
    try {
      const { type, identifier, ownerName, cardNumber } = req.body;
      const id = Math.random().toString(36).substring(2, 9);
      const checkInTime = Date.now();
      const status = 'active';

      const stmt = db.prepare(`
        INSERT INTO vehicles (id, type, identifier, ownerName, cardNumber, checkInTime, status)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run(id, type, identifier, ownerName, cardNumber, checkInTime, status);
      
      const newVehicle = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(id);
      res.status(201).json(newVehicle);
    } catch (error) {
      res.status(500).json({ error: 'Failed to check-in vehicle' });
    }
  });

  // Check-out a vehicle
  app.put('/api/vehicles/:id/checkout', (req, res) => {
    try {
      const { id } = req.params;
      const { price } = req.body;
      const checkOutTime = Date.now();
      const status = 'completed';

      const stmt = db.prepare(`
        UPDATE vehicles 
        SET checkOutTime = ?, status = ?, price = ?
        WHERE id = ?
      `);
      
      stmt.run(checkOutTime, status, price, id);
      
      const updatedVehicle = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(id);
      res.json(updatedVehicle);
    } catch (error) {
      res.status(500).json({ error: 'Failed to check-out vehicle' });
    }
  });

  // Get pricing
  app.get('/api/pricing', (req, res) => {
    try {
      const pricing = db.prepare('SELECT bicycle, ebike, motorcycle FROM pricing WHERE id = 1').get();
      res.json(pricing);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch pricing' });
    }
  });

  // Update pricing
  app.put('/api/pricing', (req, res) => {
    try {
      const { bicycle, ebike, motorcycle } = req.body;
      
      const stmt = db.prepare(`
        UPDATE pricing 
        SET bicycle = ?, ebike = ?, motorcycle = ?
        WHERE id = 1
      `);
      
      stmt.run(bicycle, ebike, motorcycle);
      
      const updatedPricing = db.prepare('SELECT bicycle, ebike, motorcycle FROM pricing WHERE id = 1').get();
      res.json(updatedPricing);
    } catch (error) {
      res.status(500).json({ error: 'Failed to update pricing' });
    }
  });

  // --- Vite Middleware ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(process.cwd(), 'dist/index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
