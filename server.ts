import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { readDb, writeDb } from './src/db/nodeDb.js';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // --- API Routes ---

  // Get all vehicles
  app.get('/api/vehicles', (req, res) => {
    try {
      const db = readDb();
      res.json(db.vehicles.sort((a, b) => b.checkInTime - a.checkInTime));
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

      const db = readDb();
      const newVehicle = { id, type, identifier, ownerName, cardNumber, checkInTime, status };
      db.vehicles.push(newVehicle);
      writeDb(db);
      
      res.status(201).json(newVehicle);
    } catch (error) {
      res.status(500).json({ error: 'Failed to check-in vehicle' });
    }
  });

  // Check-out a vehicle
  app.put('/api/vehicles/:id/checkout', (req, res) => {
    try {
      const { id } = req.params;
      const { price, paymentMethod } = req.body;
      const checkOutTime = Date.now();
      
      const db = readDb();
      const vehicleIndex = db.vehicles.findIndex(v => v.id === id);
      
      if (vehicleIndex === -1) {
        return res.status(404).json({ error: 'Vehicle not found' });
      }

      db.vehicles[vehicleIndex] = {
        ...db.vehicles[vehicleIndex],
        status: 'completed',
        checkOutTime,
        price,
        paymentMethod
      };
      
      writeDb(db);
      res.json(db.vehicles[vehicleIndex]);
    } catch (error) {
      res.status(500).json({ error: 'Failed to check-out vehicle' });
    }
  });

  // Get pricing
  app.get('/api/pricing', (req, res) => {
    try {
      const db = readDb();
      res.json(db.pricing);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch pricing' });
    }
  });

  // Update pricing
  app.put('/api/pricing', (req, res) => {
    try {
      const newPricing = req.body;
      const db = readDb();
      db.pricing = { ...db.pricing, ...newPricing };
      writeDb(db);
      res.json(db.pricing);
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
