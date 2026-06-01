import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import 'dotenv/config';

// Local JSON DB
import { readDb, writeDb } from './src/db/nodeDb.js';

// MySQL DB
import { initMySQL, getVehicles as mySqlGetVehicles, checkInVehicle as mySqlCheckInVehicle, checkOutVehicle as mySqlCheckOutVehicle, getPricing as mySqlGetPricing, updatePricing as mySqlUpdatePricing, checkSpotTaken as mySqlCheckSpotTaken } from './src/db/mysqlDb.js';

// Firebase DB
import * as firebaseDb from './src/db/firebaseDb.js';

import { initBackupService } from './src/db/backupService.js';

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  app.use(express.json());

  // Define qual banco de dados usar ('mysql', 'firebase' ou 'json')
  const envDbType = process.env.DB_TYPE;
  const dbType = ['mysql', 'json'].includes(envDbType) ? envDbType : 'firebase';
  console.log(`Usando banco de dados: ${dbType.toUpperCase()}`);

  if (dbType === 'mysql') {
    await initMySQL();
  } else if (dbType === 'firebase') {
    console.log("Firebase initialized");
  } else {
    // using local json db
  }
  
  // Start backup service for whatever database we are using 
  initBackupService(dbType);

  // --- API Routes ---

  // Get all vehicles
  app.get('/api/vehicles', async (req, res) => {
    try {
      if (dbType === 'firebase') {
        const vehicles = await firebaseDb.getVehicles();
        res.json(vehicles);
      } else if (dbType === 'mysql') {
        const vehicles = await mySqlGetVehicles();
        res.json(vehicles);
      } else {
        const db = readDb();
        let changed = false;
        const thirtyDaysAgo = Date.now() - 2592000000;
        
        db.vehicles.forEach(v => {
          if (v.status === 'active' && v.checkInTime <= thirtyDaysAgo) {
            v.status = 'stored';
            changed = true;
          }
        });
        
        if (changed) {
          writeDb(db);
        }
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

      if (dbType === 'firebase') {
        const isSpotTaken = await firebaseDb.checkSpotTaken(cardNumber);
        if (isSpotTaken) return res.status(400).json({ error: 'Spot is already occupied' });
        
        await firebaseDb.checkInVehicle(newVehicle);
        res.status(201).json(newVehicle);
      } else if (dbType === 'mysql') {
        const isSpotTaken = await mySqlCheckSpotTaken(cardNumber);
        if (isSpotTaken) return res.status(400).json({ error: 'Spot is already occupied' });
        
        await mySqlCheckInVehicle(newVehicle);
        res.status(201).json(newVehicle);
      } else {
        const db = readDb();
        const isSpotTaken = db.vehicles.some(v => v.cardNumber === cardNumber && (v.status === 'active' || v.status === 'stored'));
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

  // Get transactions
  app.get('/api/transactions', async (req, res) => {
    try {
      if (dbType === 'firebase') {
        const transactions = await firebaseDb.getTransactions();
        res.json(transactions);
      } else if (dbType === 'mysql') {
        const mysqlDb = await import('./src/db/mysqlDb.js');
        const transactions = await mysqlDb.getTransactions();
        res.json(transactions);
      } else {
        const db = readDb();
        res.json(db.transactions || []);
      }
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: error.message || 'Failed to fetch transactions' });
    }
  });

  // Add a transaction
  app.post('/api/transactions', async (req, res) => {
    try {
      const { description, amount, date, type } = req.body;
      const id = Math.random().toString(36).substring(2, 9);
      const newTransaction = { id, description, amount, date: date || Date.now(), type };
      
      if (dbType === 'firebase') {
        await firebaseDb.addTransaction(newTransaction);
      } else if (dbType === 'mysql') {
        const mysqlDb = await import('./src/db/mysqlDb.js');
        await mysqlDb.addTransaction(newTransaction);
      } else {
        const db = readDb();
        if (!db.transactions) db.transactions = [];
        db.transactions.push(newTransaction);
        writeDb(db);
      }
      res.status(201).json(newTransaction);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: error.message || 'Failed to add transaction' });
    }
  });

  // Delete a transaction
  app.delete('/api/transactions/:id', async (req, res) => {
    try {
      const { id } = req.params;
      
      if (dbType === 'firebase') {
        await firebaseDb.removeTransaction(id);
      } else if (dbType === 'mysql') {
        const mysqlDb = await import('./src/db/mysqlDb.js');
        await mysqlDb.removeTransaction(id);
      } else {
        const db = readDb();
        if (!db.transactions) db.transactions = [];
        db.transactions = db.transactions.filter(t => t.id !== id);
        writeDb(db);
      }
      res.status(200).json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: error.message || 'Failed to delete transaction' });
    }
  });

  // Check-out a vehicle
  app.put('/api/vehicles/:id/checkout', async (req, res) => {
    try {
      const { id } = req.params;
      const { price, paymentMethod } = req.body;
      const checkOutTime = Date.now();
      
      if (dbType === 'firebase') {
        const updatedVehicle = await firebaseDb.checkOutVehicle(id, price, paymentMethod, checkOutTime);
        if (!updatedVehicle) return res.status(404).json({ error: 'Vehicle not found' });
        res.json(updatedVehicle);
      } else if (dbType === 'mysql') {
        const updatedVehicle = await mySqlCheckOutVehicle(id, price, paymentMethod, checkOutTime);
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

  // Get lost cards
  app.get('/api/lost-cards', async (req, res) => {
    try {
      if (dbType === 'firebase') {
        const cards = await firebaseDb.getLostCards();
        res.json(cards);
      } else if (dbType === 'mysql') {
        const mysqlDb = await import('./src/db/mysqlDb.js');
        const cards = await mysqlDb.getLostCards();
        res.json(cards);
      } else {
        const db = readDb();
        const mappedCards = (db.lostCards || []).map(c => 
          typeof c === 'string' ? { cardNumber: c } : c
        );
        res.json(mappedCards);
      }
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: error.message || 'Failed to fetch lost cards' });
    }
  });

  // Report lost card
  app.put('/api/vehicles/:id/lost', async (req, res) => {
    try {
      const { id } = req.params;
      const { lostCardName, lostCardPhone } = req.body;
      
      let vehicle;
      if (dbType === 'firebase') {
        vehicle = await firebaseDb.reportLostCard(id, lostCardName, lostCardPhone);
        if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });
        await firebaseDb.addLostCard(vehicle.cardNumber, lostCardName, lostCardPhone);
      } else if (dbType === 'mysql') {
        const mysqlDb = await import('./src/db/mysqlDb.js');
        vehicle = await mysqlDb.reportLostCard(id, lostCardName, lostCardPhone);
        if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });
        await mysqlDb.addLostCard(vehicle.cardNumber, lostCardName, lostCardPhone);
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
        db.lostCards = db.lostCards || [];
        const existingIndex = db.lostCards.findIndex(c => typeof c === 'string' ? c === db.vehicles[vehicleIndex].cardNumber : c.cardNumber === db.vehicles[vehicleIndex].cardNumber);
        if (existingIndex === -1) {
          db.lostCards.push({
            cardNumber: db.vehicles[vehicleIndex].cardNumber,
            name: lostCardName,
            phone: lostCardPhone,
            date: Date.now()
          });
        }
        writeDb(db);
        vehicle = db.vehicles[vehicleIndex];
      }
      res.json(vehicle);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: error.message || 'Failed to report lost card' });
    }
  });

  // Remove lost card
  app.delete('/api/lost-cards/:cardNumber', async (req, res) => {
    try {
      const { cardNumber } = req.params;
      if (dbType === 'firebase') {
        await firebaseDb.removeLostCard(cardNumber);
      } else if (dbType === 'mysql') {
        const mysqlDb = await import('./src/db/mysqlDb.js');
        await mysqlDb.removeLostCard(cardNumber);
      } else {
        const db = readDb();
        db.lostCards = (db.lostCards || []).filter(c => {
          if (typeof c === 'string') return c !== cardNumber;
          return c.cardNumber !== cardNumber;
        });
        writeDb(db);
      }
      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: error.message || 'Failed to remove lost card' });
    }
  });

  // Get pricing
  app.get('/api/pricing', async (req, res) => {
    try {
      if (dbType === 'firebase') {
        const pricing = await firebaseDb.getPricing();
        res.json(pricing);
      } else if (dbType === 'mysql') {
        const pricing = await mySqlGetPricing();
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
      if (dbType === 'firebase') {
        const pricing = await firebaseDb.updatePricing(newPricing);
        res.json(pricing);
      } else if (dbType === 'mysql') {
        const pricing = await mySqlUpdatePricing(newPricing);
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

  // Store endpoints
  app.get('/api/products', async (req, res) => {
    try {
      if (dbType === 'firebase') {
        const products = await firebaseDb.getProducts();
        res.json(products);
      } else {
        const db = readDb();
        res.json(db.products || []);
      }
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: error.message || 'Failed to fetch products' });
    }
  });

  app.post('/api/products', async (req, res) => {
    try {
      const product = { ...req.body, id: Math.random().toString(36).substring(2, 9) };
      if (dbType === 'firebase') {
        const newProduct = await firebaseDb.addProduct(product);
        res.status(201).json(newProduct);
      } else {
        const db = readDb();
        db.products = db.products || [];
        db.products.push(product);
        writeDb(db);
        res.status(201).json(product);
      }
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: error.message || 'Failed to add product' });
    }
  });

  app.put('/api/products/:id', async (req, res) => {
    try {
      const product = req.body;
      if (dbType === 'firebase') {
        const updated = await firebaseDb.updateProduct(product);
        res.json(updated);
      } else {
        const db = readDb();
        db.products = db.products || [];
        db.products = db.products.map(p => p.id === product.id ? product : p);
        writeDb(db);
        res.json(product);
      }
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: error.message || 'Failed to update product' });
    }
  });

  app.delete('/api/products/:id', async (req, res) => {
    try {
      if (dbType === 'firebase') {
        await firebaseDb.removeProduct(req.params.id);
        res.status(204).send();
      } else {
        const db = readDb();
        db.products = db.products || [];
        db.products = db.products.filter(p => p.id !== req.params.id);
        writeDb(db);
        res.status(204).send();
      }
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: error.message || 'Failed to remove product' });
    }
  });

  app.get('/api/sales', async (req, res) => {
    try {
      if (dbType === 'firebase') {
        const sales = await firebaseDb.getSales();
        res.json(sales);
      } else {
        const db = readDb();
        res.json(db.sales || []);
      }
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: error.message || 'Failed to fetch sales' });
    }
  });

  app.post('/api/sales', async (req, res) => {
    try {
      const sale = { ...req.body, id: Math.random().toString(36).substring(2, 9) };
      if (dbType === 'firebase') {
        const newSale = await firebaseDb.addSale(sale);
        res.status(201).json(newSale);
      } else {
        const db = readDb();
        db.sales = db.sales || [];
        db.sales.push(sale);
        
        db.products = db.products || [];
        const index = db.products.findIndex(p => p.id === sale.productId);
        if (index !== -1) {
          db.products[index].stock = Math.max(0, db.products[index].stock - sale.quantity);
        }

        db.transactions = db.transactions || [];
        db.transactions.push({
          id: Math.random().toString(36).substring(2, 9),
          description: `Venda na Loja: ${sale.quantity}x ${sale.productName}`,
          amount: sale.totalPrice,
          date: sale.date,
          type: 'income'
        });

        writeDb(db);
        res.status(201).json(sale);
      }
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: error.message || 'Failed to add sale' });
    }
  });

  app.get('/api/system/db-status', async (req, res) => {
    try {
      if (dbType === 'firebase') {
        res.json({ status: 'ok', message: 'Usando banco de dados Firebase', dbType: 'firebase' });
      } else if (dbType === 'mysql') {
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

  app.delete('/api/system/reset', async (req, res) => {
    try {
      if (dbType === 'firebase') {
        await firebaseDb.resetDatabase();
        res.json({ success: true, message: 'Todos os registros apagados no Firebase.' });
      } else if (dbType === 'mysql') {
        const mysqlDb = await import('./src/db/mysqlDb.js');
        const pool = mysqlDb.getPool();
        await pool.query('TRUNCATE TABLE transactions;');
        await pool.query('TRUNCATE TABLE lost_cards;');
        await pool.query('TRUNCATE TABLE vehicles;');
        res.json({ success: true, message: 'Todos os registros apagados.' });
      } else {
        const db = readDb();
        db.vehicles = [];
        db.transactions = [];
        db.lostCards = [];
        writeDb(db);
        res.json({ success: true, message: 'Todos os registros apagados.' });
      }
    } catch (error) {
      console.error('Reset app error:', error);
      res.status(500).json({ error: error.message || 'Falha ao zerar app.' });
    }
  });

  app.get('/api/backup/export', async (req, res) => {
    try {
      let backupData = {};
      if (dbType === 'firebase') {
        const vehicles = await firebaseDb.getVehicles();
        const transactions = await firebaseDb.getTransactions();
        const lostCards = await firebaseDb.getLostCards();
        const pricing = await firebaseDb.getPricing();
        backupData = { version: 2, exportDate: new Date().toISOString(), pricing, vehicles, transactions, lostCards, dbType };
      } else if (dbType === 'mysql') {
        const { getVehicles, getTransactions, getLostCards, getPricing } = await import('./src/db/mysqlDb.js');
        const vehicles = await getVehicles();
        const transactions = await getTransactions();
        const lostCards = await getLostCards();
        const pricing = await getPricing();
        backupData = { version: 2, exportDate: new Date().toISOString(), pricing, vehicles, transactions, lostCards, dbType };
      } else {
        const db = readDb();
        backupData = { version: 2, exportDate: new Date().toISOString(), dbType, ...db };
      }
      res.json(backupData);
    } catch (error) {
      console.error("Backup export error:", error);
      res.status(500).json({ error: "Failed to export backup data." });
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
