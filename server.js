import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';

// Local JSON DB
import { readDb, writeDb } from './src/db/nodeDb.js';

// MySQL DB
import { initMySQL, getVehicles, checkInVehicle, checkOutVehicle, getPricing, updatePricing, checkSpotTaken } from './src/db/mysqlDb.js';

import { initBackupService } from './src/db/backupService.js';

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  app.use(express.json());

  // Define qual banco de dados usar
  const dbType = process.env.DB_TYPE === 'mysql' ? 'mysql' : 'json';
  console.log(`Usando banco de dados: ${dbType.toUpperCase()}`);

  if (dbType === 'mysql') {
    await initMySQL();
  } else {
    initBackupService();
  }

  // --- API Routes ---

  // Get all vehicles
  app.get('/api/vehicles', async (req, res) => {
    try {
      if (dbType === 'mysql') {
        const vehicles = await getVehicles();
        res.json(vehicles);
      } else {
        const db = readDb();
        res.json(db.vehicles.sort((a, b) => b.checkInTime - a.checkInTime));
      }
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: error.message || 'Failed to fetch vehicles' });
    }
  });

  // Check-in a new vehicle
  app.post('/api/vehicles', async (req, res) => {
    try {
      const { type, identifier, ownerName, cardNumber, checkInTime: reqCheckInTime } = req.body;
      const id = Math.random().toString(36).substring(2, 9);
      const checkInTime = reqCheckInTime || Date.now();
      const status = 'active';
      const newVehicle = { id, type, identifier, ownerName, cardNumber, checkInTime, status };

      if (dbType === 'mysql') {
        const isSpotTaken = await checkSpotTaken(cardNumber);
        if (isSpotTaken) return res.status(400).json({ error: 'Spot is already occupied' });
        
        await checkInVehicle(newVehicle);
        res.status(201).json(newVehicle);
      } else {
        const db = readDb();
        const isSpotTaken = db.vehicles.some(v => v.cardNumber === cardNumber && v.status === 'active');
        if (isSpotTaken) return res.status(400).json({ error: 'Spot is already occupied' });
        
        db.vehicles.push(newVehicle);
        writeDb(db);
        res.status(201).json(newVehicle);
      }
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: error.message || 'Failed to check-in vehicle' });
    }
  });

  // Check-out a vehicle
  app.put('/api/vehicles/:id/checkout', async (req, res) => {
    try {
      const { id } = req.params;
      const { price, paymentMethod } = req.body;
      const checkOutTime = Date.now();
      
      if (dbType === 'mysql') {
        const updatedVehicle = await checkOutVehicle(id, price, paymentMethod, checkOutTime);
        if (!updatedVehicle) return res.status(404).json({ error: 'Vehicle not found' });
        res.json(updatedVehicle);
      } else {
        const db = readDb();
        const vehicleIndex = db.vehicles.findIndex(v => v.id === id);
        if (vehicleIndex === -1) return res.status(404).json({ error: 'Vehicle not found' });
        
        db.vehicles[vehicleIndex] = {
          ...db.vehicles[vehicleIndex],
          status: 'completed',
          checkOutTime,
          price,
          paymentMethod
        };
        writeDb(db);
        res.json(db.vehicles[vehicleIndex]);
      }
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: error.message || 'Failed to check-out vehicle' });
    }
  });

  // Report lost card
  app.put('/api/vehicles/:id/lost', async (req, res) => {
    try {
      const { id } = req.params;
      const { lostCardName, lostCardPhone } = req.body;
      
      if (dbType === 'mysql') {
        const mysqlDb = await import('./src/db/mysqlDb.js');
        const updatedVehicle = await mysqlDb.reportLostCard(id, lostCardName, lostCardPhone);
        if (!updatedVehicle) return res.status(404).json({ error: 'Vehicle not found' });
        res.json(updatedVehicle);
      } else {
        const db = readDb();
        const vehicleIndex = db.vehicles.findIndex(v => v.id === id);
        if (vehicleIndex === -1) return res.status(404).json({ error: 'Vehicle not found' });
        
        db.vehicles[vehicleIndex] = {
          ...db.vehicles[vehicleIndex],
          cardLost: true,
          lostCardName,
          lostCardPhone
        };
        writeDb(db);
        res.json(db.vehicles[vehicleIndex]);
      }
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: error.message || 'Failed to report lost card' });
    }
  });

  // Get pricing
  app.get('/api/pricing', async (req, res) => {
    try {
      if (dbType === 'mysql') {
        const pricing = await getPricing();
        res.json(pricing);
      } else {
        const db = readDb();
        res.json(db.pricing);
      }
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: error.message || 'Failed to fetch pricing' });
    }
  });

  // Update pricing
  app.put('/api/pricing', async (req, res) => {
    try {
        const newPricing = req.body;
      if (dbType === 'mysql') {
        const pricing = await updatePricing(newPricing);
        res.json(pricing);
      } else {
        const db = readDb();
        db.pricing = { ...db.pricing, ...newPricing };
        writeDb(db);
        res.json(db.pricing);
      }
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: error.message || 'Failed to update pricing' });
    }
  });

  app.get('/api/system/db-status', async (req, res) => {
    try {
      if (dbType === 'mysql') {
        const mysqlDb = await import('./src/db/mysqlDb.js');
        const pool = mysqlDb.getPool();
        await pool.query('SELECT 1');
        res.json({ status: 'ok', message: 'Conectado com sucesso ao MySQL!', dbType: 'mysql' });
      } else {
        res.json({ status: 'ok', message: 'Usando banco de dados local (JSON).', dbType: 'json' });
      }
    } catch (error) {
      console.error(error);
      res.status(500).json({ status: 'error', message: 'Falha na conexão com banco.', error: error.message || String(error) });
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
    // Para ambientes como a Hostinger, garantimos resolução limpa da pasta estática 'dist' 
    const staticPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(staticPath));
    app.use((req, res) => {
      res.sendFile(path.resolve(staticPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
