import express from 'express';
import compression from 'compression';
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
  const PORT = 3000;

  app.use(compression());
  app.use(express.json({ limit: '15mb' }));

  // Define qual banco de dados usar ('mysql', 'firebase' ou 'json')
  const envDbType = process.env.DB_TYPE;
  let dbType = ['mysql', 'json'].includes(envDbType) ? envDbType : 'firebase';

  if (dbType === 'firebase') {
    // Testa conectividade real com o Firebase (detecta PERMISSION_DENIED / Billing desabilitado / offline)
    try {
      const probePromise = firebaseDb.getPricing();
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout conectando ao Firebase")), 4000));
      await Promise.race([probePromise, timeoutPromise]);
      console.log("Firebase conectado e operacional.");
    } catch (firebaseErr) {
      console.warn("⚠️ Atenção: Firebase indisponível ou billing desativado no GCP (" + (firebaseErr.message || firebaseErr) + ").");
      console.warn("🔄 Alternando automaticamente para o banco de dados Local (JSON) para manter o sistema 100% funcional sem travamentos!");
      dbType = 'json';
    }
  }

  console.log(`Usando banco de dados: ${dbType.toUpperCase()}`);

  if (dbType === 'firebase') {
    setTimeout(async () => {
      try {
        console.log('Running cleanup for stuck cardLost vehicles...');
        const lostCards = await firebaseDb.getLostCards();
        const lostCardNumbers = new Set(lostCards.map(c => c.cardNumber));
        const vehicles = await firebaseDb.getSyncVehicles(48);
        
        const stuckCards = new Set();
        vehicles.forEach(v => {
          if (v.cardLost && !lostCardNumbers.has(v.cardNumber) && v.status !== 'completed') {
            stuckCards.add(v.cardNumber);
          }
        });
        
        for (const cardNumber of stuckCards) {
          console.log(`Fixing stuck vehicle with card ${cardNumber}`);
          await firebaseDb.recoverVehicleCardLost(cardNumber);
        }
      } catch(e) {
        console.error('Cleanup error:', e);
      }
    }, 3000);
  }

  if (dbType === 'mysql') {
    await initMySQL();
  } else if (dbType === 'firebase') {
    console.log("Firebase initialized");
  } else {
    console.log("Banco de dados local (JSON) inicializado com sucesso.");
  }
  
  // Start backup service for whatever database we are using 
  initBackupService(dbType);

  // --- API Routes ---

  // Get vehicles (supports ?scope=sync for lightweight polling)
  app.get('/api/vehicles', async (req, res) => {
    try {
      const isSyncScope = req.query.scope === 'sync';
      const recentCutoff = Date.now() - 48 * 60 * 60 * 1000;

      if (dbType === 'firebase') {
        const vehicles = isSyncScope
          ? await firebaseDb.getSyncVehicles(48)
          : await firebaseDb.getVehicles();
        res.json(vehicles);
      } else if (dbType === 'mysql') {
        const vehicles = await mySqlGetVehicles();
        res.json(
          isSyncScope
            ? vehicles.filter(v => v.status === 'active' || v.status === 'stored' || (v.checkOutTime && v.checkOutTime >= recentCutoff))
            : vehicles
        );
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
        const sorted = db.vehicles.sort((a, b) => b.checkInTime - a.checkInTime);
        res.json(
          isSyncScope
            ? sorted.filter(v => v.status === 'active' || v.status === 'stored' || (v.checkOutTime && v.checkOutTime >= recentCutoff))
            : sorted
        );
      }
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: error.message || 'Failed to fetch vehicles' });
    }
  });

  // Check-in a new vehicle
  app.post('/api/vehicles', async (req, res) => {
    try {
      let { type, identifier, ownerName, cardNumber, checkInTime: reqCheckInTime, damageNotes, photoData, operatorName, qrCode, rentalId } = req.body;
      cardNumber = (cardNumber || '').trim().toUpperCase();
      identifier = (identifier || '').trim().toUpperCase();
      
      const id = Math.random().toString(36).substring(2, 9);
      const checkInTime = reqCheckInTime || Date.now();
      const status = 'active';
      const newVehicle = {
        id,
        type,
        identifier,
        ownerName,
        cardNumber,
        checkInTime,
        status,
        ...(damageNotes ? { damageNotes } : {}),
        ...(photoData ? { photoData } : {}),
        ...(operatorName ? { operatorName } : {}),
        ...(qrCode ? { qrCode } : {}),
        ...(rentalId ? { rentalId } : {})
      };

      if (dbType === 'firebase') {
        await firebaseDb.checkInVehicle(newVehicle);
        res.status(201).json(newVehicle);
      } else if (dbType === 'mysql') {
        const isSpotTaken = await mySqlCheckSpotTaken(cardNumber);
        if (isSpotTaken) return res.status(409).json({ error: 'Esta vaga/cartão já está ocupada.' });
        
        await mySqlCheckInVehicle(newVehicle);
        res.status(201).json(newVehicle);
      } else {
        const db = readDb();
        const isSpotTaken = db.vehicles.some(v => v.cardNumber === cardNumber && (v.status === 'active' || v.status === 'stored'));
        if (isSpotTaken) return res.status(409).json({ error: 'Esta vaga/cartão já está ocupada.' });
        
        db.vehicles.push(newVehicle);
        writeDb(db);
        res.status(201).json(newVehicle);
      }
    } catch (error) {
      console.error(error);
      const statusCode = error.statusCode || 500;
      res.status(statusCode).json({ error: error.message || 'Failed to check-in vehicle' });
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
      const {
        description,
        amount,
        date,
        type,
        operator,
        category,
        paymentMethod,
        cardId,
        cardNumber,
        ownerName,
        rentalId,
        isFiadoPaid,
        fiadoPaidAmount
      } = req.body;
      const id = Math.random().toString(36).substring(2, 9);
      const newTransaction = {
        id,
        description,
        amount,
        date: date || Date.now(),
        type,
        operator,
        category,
        paymentMethod,
        cardId,
        cardNumber,
        ownerName,
        rentalId,
        isFiadoPaid,
        fiadoPaidAmount
      };
      
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
      const { price, paymentMethod, customerCardId, checkInTime, checkOutTime: providedCheckOutTime, checkOutOperatorName, rentalId } = req.body;
      const checkOutTime = providedCheckOutTime || Date.now();
      
      let updatedVehicle;
      
      if (dbType === 'firebase') {
        updatedVehicle = await firebaseDb.checkOutVehicle(
          id,
          price,
          paymentMethod,
          checkOutTime,
          customerCardId,
          checkInTime,
          checkOutOperatorName,
          rentalId
        );
      } else if (dbType === 'mysql') {
        const mysqlDb = await import('./src/db/mysqlDb.js');
        updatedVehicle = await mysqlDb.checkOutVehicle(id, price, paymentMethod, checkOutTime, customerCardId, checkInTime, rentalId);
      } else {
        const db = readDb();
        const vehicleIndex = db.vehicles.findIndex(v => v.id === id);
        if (vehicleIndex > -1) {
          if (db.vehicles[vehicleIndex].status === 'completed') {
            return res.status(409).json({ error: 'Este veículo já foi finalizado em outro dispositivo.' });
          }
          db.vehicles[vehicleIndex] = {
            ...db.vehicles[vehicleIndex],
            status: 'completed',
            checkOutTime,
            price,
            paymentMethod,
            customerCardId,
            ...(checkOutOperatorName ? { checkOutOperatorName } : {}),
            ...(rentalId ? { rentalId } : {})
          };
          
          if (checkInTime) {
            db.vehicles[vehicleIndex].checkInTime = checkInTime;
          }
          
          writeDb(db);
          updatedVehicle = db.vehicles[vehicleIndex];
        }
      }
      
      if (!updatedVehicle) return res.status(404).json({ error: 'Vehicle not found' });

      // Process Customer Card deduction for non-Firebase DBs (Firebase handles it inside runTransaction)
      if (dbType !== 'firebase' && (paymentMethod === 'card' || paymentMethod === 'postpaid_card')) {
        let cards = [];
        if (dbType === 'mysql') {
          const mysqlDb = await import('./src/db/mysqlDb.js');
          cards = await mysqlDb.getCustomerCards();
        } else {
          cards = readDb().customerCards || [];
        }

        let card;
        if (customerCardId) {
          card = cards.find(c => c.id === customerCardId);
        } else {
          card = cards.find(c => c.cardNumber === updatedVehicle.cardNumber);
        }

        if (card) {
          const prevBalance = Number(card.balance) || 0;
          const numPrice = Number(price) || 0;
          const newBalance = paymentMethod === 'card' 
            ? prevBalance - numPrice
            : prevBalance + numPrice;
          
          if (dbType === 'mysql') {
            const mysqlDb = await import('./src/db/mysqlDb.js');
            await mysqlDb.updateCustomerCard(card.id, { ...card, balance: newBalance });
          } else {
            const db = readDb();
            const cIndex = (db.customerCards || []).findIndex(c => c.id === card.id);
            if (cIndex > -1) {
              db.customerCards[cIndex].balance = newBalance;
              writeDb(db);
            }
          }
        }
      }

      res.json(updatedVehicle);
    } catch (error) {
      console.error(error);
      const statusCode = error.statusCode || 500;
      res.status(statusCode).json({ error: error.message || 'Failed to check-out vehicle' });
    }
  });

  // Pay fiado
  app.put('/api/vehicles/:id/pay-fiado', async (req, res) => {
    try {
      const { id } = req.params;
      const { paymentMethod, amount, observation } = req.body;
      const paymentDate = Date.now();
      
      let vehicle;
      
      if (dbType === 'firebase') {
        vehicle = await firebaseDb.payFiado(id, paymentMethod, paymentDate, amount);
      } else if (dbType === 'mysql') {
        const mysqlDb = await import('./src/db/mysqlDb.js');
        vehicle = await mysqlDb.payFiado(id, paymentMethod, paymentDate, amount);
      } else {
        const db = readDb();
        const vehicleIndex = db.vehicles.findIndex(v => v.id === id);
        if (vehicleIndex === -1) return res.status(404).json({ error: 'Vehicle not found' });
        
        const currentPaid = db.vehicles[vehicleIndex].fiadoPaidAmount || 0;
        const newPaid = currentPaid + amount;
        const isFullyPaid = newPaid >= db.vehicles[vehicleIndex].price;
        
        db.vehicles[vehicleIndex].fiadoPaidAmount = newPaid;
        db.vehicles[vehicleIndex].fiadoPaymentDate = paymentDate;
        db.vehicles[vehicleIndex].fiadoPaymentMethod = paymentMethod;
        if (isFullyPaid) {
          db.vehicles[vehicleIndex].isFiadoPaid = true;
        }
        writeDb(db);
        vehicle = db.vehicles[vehicleIndex];
      }
      
      if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });
      
      // Also add transaction
      const transId = Math.random().toString(36).substring(2, 9);
      const paymentText = paymentMethod === 'machine' ? 'MÁQUINA' :
                          paymentMethod === 'card' ? 'CARTÃO' :
                          paymentMethod === 'cash' ? 'DINHEIRO' :
                          paymentMethod === 'pix' ? 'PIX' :
                          paymentMethod ? paymentMethod.toUpperCase() : 'N/A';
                          
      let descriptionStr = `Baixa de Fiado: ${vehicle.identifier} (${paymentText})`;
      if (observation) {
        descriptionStr += ` - Obs: ${observation}`;
      }
                          
      const newTransaction = {
        id: transId,
        description: descriptionStr,
        amount: amount,
        date: paymentDate,
        type: 'income'
      };
      
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
      
      res.json(vehicle);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: error.message || 'Failed to pay fiado' });
    }
  });

  // Pay fiado for a card/manual transaction
  app.put('/api/transactions/:id/pay-fiado', async (req, res) => {
    try {
      const { id } = req.params;
      const { paymentMethod, amount, observation, operator } = req.body;
      const paymentDate = Date.now();
      const payAmount = Number(amount) || 0;

      let updatedTx;

      if (dbType === 'firebase') {
        updatedTx = await firebaseDb.payFiadoTransaction(id, paymentMethod, paymentDate, payAmount);
      } else if (dbType === 'mysql') {
        const mysqlDb = await import('./src/db/mysqlDb.js');
        updatedTx = await mysqlDb.payFiadoTransaction(id, paymentMethod, paymentDate, payAmount);
      } else {
        const db = readDb();
        if (!db.transactions) db.transactions = [];
        const txIndex = db.transactions.findIndex(t => t.id === id);
        if (txIndex === -1) return res.status(404).json({ error: 'Transaction not found' });

        const currentPaid = Number(db.transactions[txIndex].fiadoPaidAmount) || 0;
        const totalAmt = Number(db.transactions[txIndex].amount) || 0;
        const newPaid = Math.min(totalAmt, currentPaid + payAmount);
        const isFullyPaid = newPaid >= totalAmt - 0.001;

        db.transactions[txIndex].fiadoPaidAmount = newPaid;
        db.transactions[txIndex].fiadoPaymentDate = paymentDate;
        db.transactions[txIndex].fiadoPaymentMethod = paymentMethod;
        if (isFullyPaid) {
          db.transactions[txIndex].isFiadoPaid = true;
        }
        writeDb(db);
        updatedTx = db.transactions[txIndex];
      }

      if (!updatedTx) return res.status(404).json({ error: 'Transaction not found' });

      const transId = Math.random().toString(36).substring(2, 9);
      const paymentText = paymentMethod === 'machine' ? 'MÁQUINA' :
                          paymentMethod === 'card' ? 'CARTÃO' :
                          paymentMethod === 'cash' ? 'DINHEIRO' :
                          paymentMethod === 'pix' ? 'PIX' :
                          paymentMethod ? paymentMethod.toUpperCase() : 'N/A';

      const cleanOrigin = (updatedTx.description || 'Fiado de Cartão').replace(/\s*\(FIADO\)\s*/gi, ' ').trim();
      let descriptionStr = `Baixa de Fiado: ${cleanOrigin} (${paymentText})`;
      if (observation) {
        descriptionStr += ` - Obs: ${observation}`;
      }

      const settlementTransaction = {
        id: transId,
        description: descriptionStr,
        amount: payAmount,
        date: paymentDate,
        type: 'income',
        paymentMethod,
        ...(operator ? { operator } : {}),
        ...(updatedTx.cardId ? { cardId: updatedTx.cardId } : {}),
        ...(updatedTx.cardNumber ? { cardNumber: updatedTx.cardNumber } : {}),
        ...(updatedTx.ownerName ? { ownerName: updatedTx.ownerName } : {})
      };

      if (dbType === 'firebase') {
        await firebaseDb.addTransaction(settlementTransaction);
      } else if (dbType === 'mysql') {
        const mysqlDb = await import('./src/db/mysqlDb.js');
        await mysqlDb.addTransaction(settlementTransaction);
      } else {
        const db = readDb();
        if (!db.transactions) db.transactions = [];
        db.transactions.push(settlementTransaction);
        writeDb(db);
      }

      // If this fiado was for a CustomerCard and it's now fully paid, update card's lastPaymentMethod if no other unpaid fiados remain for that card
      if (updatedTx.isFiadoPaid) {
        try {
          const descMatch = (updatedTx.description || '').match(/Cartão\s+([^\s(]+)/i);
          const targetCardNum = updatedTx.cardNumber || (descMatch ? descMatch[1] : null);
          let cards = [];
          let allTxs = [];
          if (dbType === 'firebase') {
            [cards, allTxs] = await Promise.all([firebaseDb.getCustomerCards(), firebaseDb.getTransactions()]);
          } else if (dbType === 'mysql') {
            const mysqlDb = await import('./src/db/mysqlDb.js');
            [cards, allTxs] = await Promise.all([mysqlDb.getCustomerCards(), mysqlDb.getTransactions()]);
          } else {
            const db = readDb();
            cards = db.customerCards || [];
            allTxs = db.transactions || [];
          }

          const card = updatedTx.cardId
            ? cards.find(c => c.id === updatedTx.cardId)
            : targetCardNum
              ? cards.find(c => (c.cardNumber || '').toLowerCase() === targetCardNum.toLowerCase())
              : null;

          if (card && card.lastPaymentMethod === 'fiado') {
            const hasMoreUnpaid = allTxs.some(t => {
              if (t.id === updatedTx.id || t.type !== 'income' || t.isFiadoPaid) return false;
              const isFiado = t.paymentMethod === 'fiado' || (t.description || '').toUpperCase().includes('(FIADO)');
              if (!isFiado) return false;
              if (t.cardId && t.cardId === card.id) return true;
              const m = (t.description || '').match(/Cartão\s+([^\s(]+)/i);
              return m && m[1].toLowerCase() === (card.cardNumber || '').toLowerCase();
            });

            if (!hasMoreUnpaid) {
              if (dbType === 'firebase') {
                await firebaseDb.updateCustomerCard(card.id, { lastPaymentMethod: paymentMethod });
              } else if (dbType === 'mysql') {
                const mysqlDb = await import('./src/db/mysqlDb.js');
                await mysqlDb.updateCustomerCard(card.id, { lastPaymentMethod: paymentMethod });
              } else {
                const db = readDb();
                const cIdx = (db.customerCards || []).findIndex(c => c.id === card.id);
                if (cIdx > -1) {
                  db.customerCards[cIdx].lastPaymentMethod = paymentMethod;
                  writeDb(db);
                }
              }
            }
          }
        } catch (cardSyncErr) {
          console.warn('Could not sync card lastPaymentMethod after fiado payoff:', cardSyncErr);
        }
      }

      res.json(updatedTx);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: error.message || 'Failed to pay fiado transaction' });
    }
  });

  // Revert checkout
  app.put('/api/vehicles/:id/revert-checkout', async (req, res) => {
    try {
      const { id } = req.params;
      if (dbType === 'firebase') {
        const updatedVehicle = await firebaseDb.revertCheckOut(id);
        if (!updatedVehicle) return res.status(404).json({ error: 'Vehicle not found' });
        res.json(updatedVehicle);
      } else if (dbType === 'mysql') {
        const { revertCheckOut } = await import('./src/db/mysqlDb.js');
        const updatedVehicle = await revertCheckOut(id);
        if (!updatedVehicle) return res.status(404).json({ error: 'Vehicle not found' });
        res.json(updatedVehicle);
      } else {
        const db = readDb();
        const vehicleIndex = db.vehicles.findIndex(v => v.id === id);
        if (vehicleIndex === -1) return res.status(404).json({ error: 'Vehicle not found' });
        
        delete db.vehicles[vehicleIndex].checkOutTime;
        delete db.vehicles[vehicleIndex].price;
        delete db.vehicles[vehicleIndex].paymentMethod;
        db.vehicles[vehicleIndex].status = 'active';
        
        writeDb(db);
        res.json(db.vehicles[vehicleIndex]);
      }
    } catch (error) {
      console.error('Error reverting checkout:', error);
      res.status(500).json({ error: error.message || 'Failed to revert checkout' });
    }
  });

  // Revert checkin
  app.delete('/api/vehicles/:id/revert-checkin', async (req, res) => {
    try {
      const { id } = req.params;
      if (dbType === 'firebase') {
        await firebaseDb.revertCheckIn(id);
        res.json({ success: true });
      } else if (dbType === 'mysql') {
        const { revertCheckIn } = await import('./src/db/mysqlDb.js');
        await revertCheckIn(id);
        res.json({ success: true });
      } else {
        const db = readDb();
        const vehicleIndex = db.vehicles.findIndex(v => v.id === id);
        if (vehicleIndex === -1) return res.status(404).json({ error: 'Vehicle not found' });
        
        db.vehicles.splice(vehicleIndex, 1);
        writeDb(db);
        res.json({ success: true });
      }
    } catch (error) {
      console.error('Error reverting checkin:', error);
      res.status(500).json({ error: error.message || 'Failed to revert checkin' });
    }
  });

  // Customer Cards endpoints
  app.get('/api/customer-cards', async (req, res) => {
    try {
      if (dbType === 'firebase') {
        res.json(await firebaseDb.getCustomerCards());
      } else if (dbType === 'mysql') {
        const mysqlDb = await import('./src/db/mysqlDb.js');
        res.json(await mysqlDb.getCustomerCards());
      } else {
        const db = readDb();
        res.json(db.customerCards || []);
      }
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: error.message || 'Failed to fetch customer cards' });
    }
  });

  app.post('/api/customer-cards', async (req, res) => {
    try {
      const card = req.body;
      let newCard;
      if (dbType === 'firebase') {
        newCard = await firebaseDb.addCustomerCard(card);
      } else if (dbType === 'mysql') {
        const mysqlDb = await import('./src/db/mysqlDb.js');
        newCard = await mysqlDb.addCustomerCard(card);
      } else {
        const db = readDb();
        if (!db.customerCards) db.customerCards = [];
        db.customerCards.push(card);
        writeDb(db);
        newCard = card;
      }
      res.status(201).json(newCard);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: error.message || 'Failed to add customer card' });
    }
  });

  app.put('/api/customer-cards/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const data = req.body;
      let updatedCard;
      if (dbType === 'firebase') {
         updatedCard = await firebaseDb.updateCustomerCard(id, data);
      } else if (dbType === 'mysql') {
         const mysqlDb = await import('./src/db/mysqlDb.js');
         updatedCard = await mysqlDb.updateCustomerCard(id, data);
      } else {
         const db = readDb();
         const index = (db.customerCards || []).findIndex(c => c.id === id);
         if (index > -1) {
           db.customerCards[index] = { ...db.customerCards[index], ...data };
           writeDb(db);
           updatedCard = db.customerCards[index];
         }
      }
      res.json(updatedCard || {});
    } catch (error) {
       console.error(error);
       res.status(500).json({ error: error.message || 'Failed to update customer card' });
    }
  });

  app.delete('/api/customer-cards/:id', async (req, res) => {
    try {
       const { id } = req.params;
       if (dbType === 'firebase') {
         await firebaseDb.removeCustomerCard(id);
       } else if (dbType === 'mysql') {
         const mysqlDb = await import('./src/db/mysqlDb.js');
         await mysqlDb.removeCustomerCard(id);
       } else {
         const db = readDb();
         if (db.customerCards) {
           db.customerCards = db.customerCards.filter(c => c.id !== id);
           writeDb(db);
         }
       }
       res.status(204).send();
    } catch (error) {
       console.error(error);
       res.status(500).json({ error: error.message || 'Failed to remove customer card' });
    }
  });

  // Spot Rentals endpoints (Vagas Alugadas por Período)
  const formatBrDateServer = (dateStr) => {
    if (!dateStr || !String(dateStr).includes('-')) return String(dateStr || '');
    const [y, m, d] = String(dateStr).split('-');
    return `${d}/${m}/${y}`;
  };

  const getPaymentLabelServer = (method) => {
    if (method === 'machine') return 'MÁQUINA';
    if (method === 'pix') return 'PIX';
    if (method === 'fiado') return 'FIADO';
    return 'DINHEIRO';
  };

  const recordRentalTransaction = async (rental, isRenewal = false) => {
    const numPrice = Number(rental.price) || 0;
    if (numPrice <= 0) return null;
    const payLabel = getPaymentLabelServer(rental.paymentMethod);
    const modeLabel = rental.mode === 'fixed' ? `Vaga ${rental.spotNumber}` : 'Direito Rotativo';
    const periodLabel = `${formatBrDateServer(rental.startDate)} a ${formatBrDateServer(rental.endDate)}`;
    const prefix = isRenewal ? 'Renovação Aluguel' : 'Aluguel de Vaga';
    const tx = {
      id: Math.random().toString(36).substring(2, 9),
      description: `${prefix} (${modeLabel} • ${periodLabel}): ${rental.ownerName} (${payLabel})`,
      amount: numPrice,
      date: Date.now(),
      type: 'income',
      paymentMethod: rental.paymentMethod,
      ownerName: rental.ownerName,
      rentalId: rental.id,
      ...(rental.spotNumber ? { cardNumber: rental.spotNumber } : {}),
      ...(rental.operatorName ? { operator: rental.operatorName } : {}),
      ...(rental.paymentMethod === 'fiado' ? { isFiadoPaid: false, fiadoPaidAmount: 0 } : {})
    };
    if (dbType === 'firebase') {
      await firebaseDb.addTransaction(tx);
    } else if (dbType === 'mysql') {
      const mysqlDb = await import('./src/db/mysqlDb.js');
      await mysqlDb.addTransaction(tx);
    } else {
      const db = readDb();
      if (!db.transactions) db.transactions = [];
      db.transactions.push(tx);
      writeDb(db);
    }
    return tx;
  };

  app.get('/api/spot-rentals', async (req, res) => {
    try {
      if (dbType === 'firebase') {
        res.json(await firebaseDb.getSpotRentals());
      } else if (dbType === 'mysql') {
        const mysqlDb = await import('./src/db/mysqlDb.js');
        res.json(await mysqlDb.getSpotRentals());
      } else {
        const db = readDb();
        res.json((db.spotRentals || []).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)));
      }
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: error.message || 'Failed to fetch spot rentals' });
    }
  });

  app.post('/api/spot-rentals', async (req, res) => {
    try {
      const body = req.body || {};
      const mode = body.mode === 'floating' ? 'floating' : 'fixed';
      const spotNumber = mode === 'fixed' ? String(body.spotNumber || '').trim().toUpperCase() : undefined;
      if (!body.ownerName || !body.startDate || !body.endDate) {
        return res.status(400).json({ error: 'Cliente e período (início e fim) são obrigatórios.' });
      }
      if (mode === 'fixed' && !spotNumber) {
        return res.status(400).json({ error: 'Informe o número da vaga para aluguel fixo.' });
      }

      const newRental = {
        id: body.id || `${Date.now()}${Math.random().toString(36).substring(2, 6)}`,
        ownerName: String(body.ownerName).trim(),
        phone: body.phone ? String(body.phone).trim() : '',
        vehicleType: body.vehicleType || 'bicycle',
        vehicleIdentifier: body.vehicleIdentifier ? String(body.vehicleIdentifier).trim() : '',
        mode,
        ...(spotNumber ? { spotNumber } : {}),
        startDate: String(body.startDate),
        endDate: String(body.endDate),
        price: Number(body.price) || 0,
        paymentMethod: ['cash', 'machine', 'pix', 'fiado'].includes(body.paymentMethod) ? body.paymentMethod : 'cash',
        status: 'active',
        ...(body.notes ? { notes: String(body.notes).trim() } : {}),
        createdAt: Date.now(),
        ...(body.operatorName ? { operatorName: body.operatorName } : {})
      };

      let existingRentals = [];
      if (dbType === 'firebase') existingRentals = await firebaseDb.getSpotRentals();
      else if (dbType === 'mysql') existingRentals = await (await import('./src/db/mysqlDb.js')).getSpotRentals();
      else existingRentals = readDb().spotRentals || [];

      if (mode === 'fixed') {
        const conflict = existingRentals.find(
          r => r.status === 'active' && r.mode === 'fixed' && String(r.spotNumber || '').trim().toUpperCase() === spotNumber
        );
        if (conflict) {
          return res.status(409).json({
            error: `A vaga ${spotNumber} já possui um aluguel ativo para ${conflict.ownerName}.`
          });
        }
      }

      let saved;
      if (dbType === 'firebase') {
        saved = await firebaseDb.addSpotRental(newRental);
      } else if (dbType === 'mysql') {
        const mysqlDb = await import('./src/db/mysqlDb.js');
        saved = await mysqlDb.addSpotRental(newRental);
      } else {
        const db = readDb();
        if (!db.spotRentals) db.spotRentals = [];
        db.spotRentals.push(newRental);
        writeDb(db);
        saved = newRental;
      }

      if (body.recordTransaction !== false) {
        await recordRentalTransaction(saved, false);
      }

      res.status(201).json(saved);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: error.message || 'Failed to create spot rental' });
    }
  });

  app.put('/api/spot-rentals/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const data = { ...(req.body || {}) };
      if (data.spotNumber !== undefined) {
        data.spotNumber = String(data.spotNumber).trim().toUpperCase();
      }
      let updated;
      if (dbType === 'firebase') {
        updated = await firebaseDb.updateSpotRental(id, data);
      } else if (dbType === 'mysql') {
        const mysqlDb = await import('./src/db/mysqlDb.js');
        updated = await mysqlDb.updateSpotRental(id, data);
      } else {
        const db = readDb();
        const idx = (db.spotRentals || []).findIndex(r => r.id === id);
        if (idx > -1) {
          db.spotRentals[idx] = { ...db.spotRentals[idx], ...data };
          writeDb(db);
          updated = db.spotRentals[idx];
        }
      }
      if (!updated) return res.status(404).json({ error: 'Aluguel não encontrado.' });
      res.json(updated);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: error.message || 'Failed to update spot rental' });
    }
  });

  app.post('/api/spot-rentals/:id/renew', async (req, res) => {
    try {
      const { id } = req.params;
      const { startDate, endDate, price, paymentMethod, operatorName, recordTransaction } = req.body || {};
      if (!startDate || !endDate) {
        return res.status(400).json({ error: 'Informe a nova data inicial e final.' });
      }
      const patch = {
        startDate: String(startDate),
        endDate: String(endDate),
        price: Number(price) || 0,
        paymentMethod: ['cash', 'machine', 'pix', 'fiado'].includes(paymentMethod) ? paymentMethod : 'cash',
        status: 'active',
        ...(operatorName ? { operatorName } : {})
      };

      let updated;
      if (dbType === 'firebase') {
        updated = await firebaseDb.updateSpotRental(id, patch);
      } else if (dbType === 'mysql') {
        const mysqlDb = await import('./src/db/mysqlDb.js');
        updated = await mysqlDb.updateSpotRental(id, patch);
      } else {
        const db = readDb();
        const idx = (db.spotRentals || []).findIndex(r => r.id === id);
        if (idx > -1) {
          db.spotRentals[idx] = { ...db.spotRentals[idx], ...patch };
          writeDb(db);
          updated = db.spotRentals[idx];
        }
      }

      if (!updated) return res.status(404).json({ error: 'Aluguel não encontrado.' });

      if (recordTransaction !== false) {
        await recordRentalTransaction(updated, true);
      }
      res.json(updated);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: error.message || 'Failed to renew spot rental' });
    }
  });

  app.delete('/api/spot-rentals/:id', async (req, res) => {
    try {
      const { id } = req.params;
      if (dbType === 'firebase') {
        await firebaseDb.removeSpotRental(id);
      } else if (dbType === 'mysql') {
        const mysqlDb = await import('./src/db/mysqlDb.js');
        await mysqlDb.removeSpotRental(id);
      } else {
        const db = readDb();
        if (db.spotRentals) {
          db.spotRentals = db.spotRentals.filter(r => r.id !== id);
          writeDb(db);
        }
      }
      res.status(204).send();
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: error.message || 'Failed to delete spot rental' });
    }
  });

  // Shifts endpoints
  app.get('/api/shifts', async (req, res) => {
    try {
      if (dbType === 'firebase') {
        res.json(await firebaseDb.getShifts());
      } else if (dbType === 'mysql') {
        const mysqlDb = await import('./src/db/mysqlDb.js');
        res.json(await mysqlDb.getShifts());
      } else {
        const db = readDb();
        res.json(db.shifts || []);
      }
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: error.message || 'Failed to fetch shifts' });
    }
  });

  app.post('/api/shifts', async (req, res) => {
    try {
      const shift = req.body;
      let newShift;
      if (dbType === 'firebase') {
        newShift = await firebaseDb.addShift(shift);
      } else if (dbType === 'mysql') {
        const mysqlDb = await import('./src/db/mysqlDb.js');
        newShift = await mysqlDb.addShift(shift);
      } else {
        const db = readDb();
        if (!db.shifts) db.shifts = [];
        db.shifts.push(shift);
        writeDb(db);
        newShift = shift;
      }
      res.status(201).json(newShift);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: error.message || 'Failed to add shift' });
    }
  });

  app.put('/api/shifts/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const data = req.body;
      let updatedShift;
      if (dbType === 'firebase') {
         updatedShift = await firebaseDb.updateShift(id, data);
      } else if (dbType === 'mysql') {
         const mysqlDb = await import('./src/db/mysqlDb.js');
         updatedShift = await mysqlDb.updateShift(id, data);
      } else {
         const db = readDb();
         const index = (db.shifts || []).findIndex(s => s.id === id);
         if (index > -1) {
           db.shifts[index] = { ...db.shifts[index], ...data };
           writeDb(db);
           updatedShift = db.shifts[index];
         }
      }
      res.json(updatedShift || {});
    } catch (error) {
       console.error(error);
       res.status(500).json({ error: error.message || 'Failed to update shift' });
    }
  });

  // Operators endpoints
  app.get('/api/operators', async (req, res) => {
    try {
      if (dbType === 'firebase') {
        const firebaseDb = await import('./src/db/firebaseDb.js');
        res.json(await firebaseDb.getOperators());
      } else if (dbType === 'mysql') {
        const mysqlDb = await import('./src/db/mysqlDb.js');
        res.json(await mysqlDb.getOperators());
      } else {
        const db = readDb();
        res.json(db.operators || []);
      }
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: error.message || 'Failed to fetch operators' });
    }
  });

  app.post('/api/operators', async (req, res) => {
    try {
      const operator = req.body;
      let newOperator;
      if (dbType === 'firebase') {
        const firebaseDb = await import('./src/db/firebaseDb.js');
        newOperator = await firebaseDb.addOperator(operator);
      } else if (dbType === 'mysql') {
        const mysqlDb = await import('./src/db/mysqlDb.js');
        newOperator = await mysqlDb.addOperator(operator);
      } else {
        const db = readDb();
        if (!db.operators) db.operators = [];
        db.operators.push(operator);
        writeDb(db);
        newOperator = operator;
      }
      res.status(201).json(newOperator);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: error.message || 'Failed to add operator' });
    }
  });

  app.delete('/api/operators/:id', async (req, res) => {
    try {
      const { id } = req.params;
      if (dbType === 'firebase') {
        const firebaseDb = await import('./src/db/firebaseDb.js');
        await firebaseDb.removeOperator(id);
      } else if (dbType === 'mysql') {
        const mysqlDb = await import('./src/db/mysqlDb.js');
        await mysqlDb.removeOperator(id);
      } else {
        const db = readDb();
        if (db.operators) {
          db.operators = db.operators.filter(o => o.id !== id);
          writeDb(db);
        }
      }
      res.json({ success: true });
    } catch (error) {
       console.error(error);
       res.status(500).json({ error: error.message || 'Failed to delete operator' });
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
  app.delete('/api/lost-cards', async (req, res) => {
    try {
      const cardNumber = req.query.cardNumber;
      if (!cardNumber) {
        return res.status(400).json({ error: 'cardNumber query parameter is required' });
      }
      if (dbType === 'firebase') {
        await firebaseDb.removeLostCard(cardNumber);
        await firebaseDb.recoverVehicleCardLost(cardNumber);
      } else if (dbType === 'mysql') {
        const mysqlDb = await import('./src/db/mysqlDb.js');
        await mysqlDb.removeLostCard(cardNumber);
        if (mysqlDb.recoverVehicleCardLost) await mysqlDb.recoverVehicleCardLost(cardNumber);
      } else {
        const db = readDb();
        db.lostCards = (db.lostCards || []).filter(c => {
          if (typeof c === 'string') return c !== cardNumber;
          return c.cardNumber !== cardNumber;
        });
        db.vehicles = db.vehicles.map(v => {
          if (v.cardNumber === cardNumber && v.cardLost) {
            return { ...v, cardLost: false };
          }
          return v;
        });
        writeDb(db);
      }
      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: error.message || 'Failed to remove lost card' });
    }
  });
  
  // Keep original just in case
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
        const paymentText = sale.paymentMethod === 'machine' ? 'MÁQUINA' :
                            sale.paymentMethod === 'card' ? 'CARTÃO' :
                            sale.paymentMethod === 'cash' ? 'DINHEIRO' :
                            sale.paymentMethod === 'pix' ? 'PIX' :
                            sale.paymentMethod ? sale.paymentMethod.toUpperCase() : 'N/A';
        db.transactions.push({
          id: Math.random().toString(36).substring(2, 9),
          description: `Venda na Loja: ${sale.quantity}x ${sale.productName} (${paymentText})`,
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

  // Update a vehicle (general/completed editing)
  app.put('/api/vehicles/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const data = req.body;
      let updatedVehicle;

      if (dbType === 'firebase') {
        updatedVehicle = await firebaseDb.updateVehicle(id, data);
      } else {
        const db = readDb();
        const vehicleIndex = db.vehicles.findIndex(v => v.id === id);
        if (vehicleIndex > -1) {
          db.vehicles[vehicleIndex] = { ...db.vehicles[vehicleIndex], ...data };
          writeDb(db);
          updatedVehicle = db.vehicles[vehicleIndex];
        }
      }

      if (!updatedVehicle) return res.status(404).json({ error: 'Vehicle not found' });
      res.json(updatedVehicle);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: error.message || 'Failed to update vehicle' });
    }
  });

  // Delete a vehicle
  app.delete('/api/vehicles/:id', async (req, res) => {
    try {
      const { id } = req.params;
      if (dbType === 'firebase') {
        await firebaseDb.removeVehicle(id);
      } else {
        const db = readDb();
        db.vehicles = db.vehicles.filter(v => v.id !== id);
        writeDb(db);
      }
      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: error.message || 'Failed to delete vehicle' });
    }
  });

  // Update a sale
  app.put('/api/sales/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const data = req.body;
      let updatedSale;

      if (dbType === 'firebase') {
        updatedSale = await firebaseDb.updateSale(id, data);
      } else {
        const db = readDb();
        db.sales = db.sales || [];
        const saleIndex = db.sales.findIndex(s => s.id === id);
        if (saleIndex > -1) {
          const oldSale = db.sales[saleIndex];
          const oldQty = Number(oldSale.quantity) || 0;
          const newQty = Number(data.quantity ?? oldSale.quantity) || 0;
          const qtyDiff = newQty - oldQty;

          db.sales[saleIndex] = { ...oldSale, ...data };

          // Update stock
          db.products = db.products || [];
          const prodId = data.productId ?? oldSale.productId;
          const pIndex = db.products.findIndex(p => p.id === prodId);
          if (pIndex > -1) {
            db.products[pIndex].stock = Math.max(0, (Number(db.products[pIndex].stock) || 0) - qtyDiff);
          }

          // Update associated transaction in local db
          db.transactions = db.transactions || [];
          const paymentText = db.sales[saleIndex].paymentMethod === 'machine' ? 'MÁQUINA' :
                              db.sales[saleIndex].paymentMethod === 'card' ? 'CARTÃO' :
                              db.sales[saleIndex].paymentMethod === 'cash' ? 'DINHEIRO' :
                              db.sales[saleIndex].paymentMethod === 'pix' ? 'PIX' :
                              db.sales[saleIndex].paymentMethod ? db.sales[saleIndex].paymentMethod.toUpperCase() : 'N/A';
          
          const tIndex = db.transactions.findIndex(t => t.date === oldSale.date);
          if (tIndex > -1) {
            db.transactions[tIndex] = {
              ...db.transactions[tIndex],
              description: `Venda na Loja: ${db.sales[saleIndex].quantity}x ${db.sales[saleIndex].productName} (${paymentText})`,
              amount: db.sales[saleIndex].totalPrice,
              date: db.sales[saleIndex].date ?? oldSale.date
            };
          }

          writeDb(db);
          updatedSale = db.sales[saleIndex];
        }
      }

      if (!updatedSale) return res.status(404).json({ error: 'Sale not found' });
      res.json(updatedSale);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: error.message || 'Failed to update sale' });
    }
  });

  // Delete a sale
  app.delete('/api/sales/:id', async (req, res) => {
    try {
      const { id } = req.params;
      if (dbType === 'firebase') {
        await firebaseDb.removeSale(id);
      } else {
        const db = readDb();
        db.sales = db.sales || [];
        const sale = db.sales.find(s => s.id === id);
        if (sale) {
          // Restore stock
          db.products = db.products || [];
          const pIndex = db.products.findIndex(p => p.id === sale.productId);
          if (pIndex > -1) {
            db.products[pIndex].stock = (Number(db.products[pIndex].stock) || 0) + (Number(sale.quantity) || 0);
          }
          // Remove transaction
          db.transactions = db.transactions || [];
          db.transactions = db.transactions.filter(t => t.date !== sale.date);
          // Remove sale
          db.sales = db.sales.filter(s => s.id !== id);
          writeDb(db);
        }
      }
      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: error.message || 'Failed to delete sale' });
    }
  });

  // Update a transaction
  app.put('/api/transactions/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const body = req.body || {};
      const data = {};
      if (typeof body.description === 'string') data.description = body.description.trim();
      if (body.amount !== undefined) {
        const parsedAmt = Number(body.amount);
        if (!Number.isFinite(parsedAmt) || parsedAmt <= 0) {
          return res.status(400).json({ error: 'Valor inválido para o lançamento.' });
        }
        data.amount = parsedAmt;
      }
      if (body.type === 'income' || body.type === 'expense') data.type = body.type;
      if (typeof body.category === 'string') data.category = body.category.trim();
      if (typeof body.paymentMethod === 'string') data.paymentMethod = body.paymentMethod.trim();
      if (typeof body.operator === 'string') data.operator = body.operator.trim();
      if (typeof body.ownerName === 'string') data.ownerName = body.ownerName.trim();
      if (typeof body.date === 'number' && Number.isFinite(body.date)) data.date = body.date;
      if (typeof body.editedAt === 'number' && Number.isFinite(body.editedAt)) data.editedAt = body.editedAt;
      if (typeof body.editedBy === 'string') data.editedBy = body.editedBy.trim();

      let updatedTransaction;

      if (dbType === 'firebase') {
        updatedTransaction = await firebaseDb.updateTransaction(id, data);
      } else if (dbType === 'mysql') {
        const mysqlDb = await import('./src/db/mysqlDb.js');
        updatedTransaction = await mysqlDb.updateTransaction(id, data);
      } else {
        const db = readDb();
        db.transactions = db.transactions || [];
        const transIndex = db.transactions.findIndex(t => t.id === id);
        if (transIndex > -1) {
          db.transactions[transIndex] = { ...db.transactions[transIndex], ...data };
          writeDb(db);
          updatedTransaction = db.transactions[transIndex];
        }
      }

      if (!updatedTransaction) return res.status(404).json({ error: 'Transaction not found' });
      res.json(updatedTransaction);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: error.message || 'Failed to update transaction' });
    }
  });

  app.post('/api/system/migrate-ebikes', async (req, res) => {
    try {
      if (dbType === 'firebase') {
        const vehicles = await firebaseDb.getVehicles();
        let mtCount = 1;
        for (const v of vehicles) {
          if (v.status === 'active' || v.status === 'stored') {
            if (v.type === 'ebike' || v.type === 'motorcycle') {
               const newCard = `MT/BE ${mtCount++}`;
               await firebaseDb.updateVehicleCard(v.id, newCard);
            }
          }
        }
        res.json({ success: true, message: 'Veículos migrados com sucesso (Firebase).' });
      } else if (dbType === 'mysql') {
        // ... handled if necessary, but skipping for brevity if not heavily used
        res.status(501).json({ error: 'Migration for MySQL not full implemented.' });
      } else {
        const db = readDb();
        if (db.vehicles) {
          let mtCount = 1;
          for (const v of db.vehicles) {
            if ((v.status === 'active' || v.status === 'stored') && (v.type === 'ebike' || v.type === 'motorcycle')) {
               v.cardNumber = `MT/BE ${mtCount++}`;
            }
          }
          writeDb(db);
        }
        res.json({ success: true, message: 'Veículos migrados (Local).' });
      }
    } catch (err) {
      res.status(500).json({ error: err.message });
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
        const [
          vehicles,
          transactions,
          lostCards,
          pricing,
          customerCards,
          products,
          sales,
          shifts,
          operators,
          spotRentals,
          financialAccounts,
          financialOwners,
          financialEntries,
          financialPayables,
          financialCategories
        ] = await Promise.all([
          firebaseDb.getVehicles(),
          firebaseDb.getTransactions(),
          firebaseDb.getLostCards(),
          firebaseDb.getPricing(),
          firebaseDb.getCustomerCards(),
          firebaseDb.getProducts(),
          firebaseDb.getSales(),
          firebaseDb.getShifts(),
          firebaseDb.getOperators(),
          firebaseDb.getSpotRentals(),
          firebaseDb.getFinancialAccounts(),
          firebaseDb.getFinancialOwners(),
          firebaseDb.getFinancialEntries(),
          firebaseDb.getFinancialPayables(),
          firebaseDb.getFinancialCategories()
        ]);
        backupData = {
          version: 4,
          exportDate: new Date().toISOString(),
          pricing,
          vehicles,
          transactions,
          lostCards,
          customerCards,
          products,
          sales,
          shifts,
          operators,
          spotRentals,
          financialAccounts,
          financialOwners,
          financialEntries,
          financialPayables,
          financialCategories,
          dbType
        };
      } else if (dbType === 'mysql') {
        const { getVehicles, getTransactions, getLostCards, getPricing } = await import('./src/db/mysqlDb.js');
        const vehicles = await getVehicles();
        const transactions = await getTransactions();
        const lostCards = await getLostCards();
        const pricing = await getPricing();
        backupData = { version: 2, exportDate: new Date().toISOString(), pricing, vehicles, transactions, lostCards, dbType };
      } else {
        const db = readDb();
        backupData = { version: 4, exportDate: new Date().toISOString(), dbType, ...db };
      }
      res.json(backupData);
    } catch (error) {
      console.error("Backup export error:", error);
      res.status(500).json({ error: "Failed to export backup data." });
    }
  });

  app.post('/api/backup/restore', async (req, res) => {
    try {
      const data = req.body;
      if (!data || typeof data !== 'object') {
        return res.status(400).json({ error: 'Arquivo de backup inválido.' });
      }

      if (dbType === 'firebase') {
        const result = await firebaseDb.restoreBackup(data);
        return res.json({ success: true, message: `Backup restaurado com sucesso (${result.restoredCount} registros gravados na nuvem).`, ...result });
      } else if (dbType === 'mysql') {
        if (data.pricing) {
          await mySqlUpdatePricing(data.pricing);
        }
        return res.json({ success: true, message: 'Tarifas restauradas no MySQL. Demais coleções requerem importação SQL direta.' });
      } else {
        const db = readDb();
        const mergeById = (existing = [], incoming = []) => {
          const map = new Map();
          existing.forEach((item) => item && item.id && map.set(String(item.id), item));
          incoming.forEach((item) => item && item.id && map.set(String(item.id), item));
          return Array.from(map.values());
        };
        if (data.pricing && typeof data.pricing === 'object') db.pricing = { ...db.pricing, ...data.pricing };
        if (Array.isArray(data.vehicles)) db.vehicles = mergeById(db.vehicles, data.vehicles);
        if (Array.isArray(data.transactions)) db.transactions = mergeById(db.transactions, data.transactions);
        if (Array.isArray(data.customerCards)) db.customerCards = mergeById(db.customerCards, data.customerCards);
        if (Array.isArray(data.products)) db.products = mergeById(db.products, data.products);
        if (Array.isArray(data.sales)) db.sales = mergeById(db.sales, data.sales);
        if (Array.isArray(data.shifts)) db.shifts = mergeById(db.shifts, data.shifts);
        if (Array.isArray(data.operators)) db.operators = mergeById(db.operators, data.operators);
        if (Array.isArray(data.spotRentals)) db.spotRentals = mergeById(db.spotRentals, data.spotRentals);
        if (Array.isArray(data.financialAccounts)) db.financialAccounts = mergeById(db.financialAccounts, data.financialAccounts);
        if (Array.isArray(data.financialOwners)) db.financialOwners = mergeById(db.financialOwners, data.financialOwners);
        if (Array.isArray(data.financialEntries)) db.financialEntries = mergeById(db.financialEntries, data.financialEntries);
        if (Array.isArray(data.financialPayables)) db.financialPayables = mergeById(db.financialPayables, data.financialPayables);
        if (Array.isArray(data.financialCategories)) db.financialCategories = mergeById(db.financialCategories, data.financialCategories);
        if (Array.isArray(data.lostCards)) {
          const cardMap = new Map();
          (db.lostCards || []).forEach(c => {
            const key = typeof c === 'string' ? c : c?.cardNumber;
            if (key) cardMap.set(key, c);
          });
          data.lostCards.forEach(c => {
            const key = typeof c === 'string' ? c : c?.cardNumber;
            if (key) cardMap.set(key, c);
          });
          db.lostCards = Array.from(cardMap.values());
        }
        writeDb(db);
        return res.json({ success: true, message: 'Backup completo restaurado no banco de dados local.' });
      }
    } catch (error) {
      console.error('Backup restore error:', error);
      res.status(500).json({ error: error.message || 'Falha ao restaurar backup completo.' });
    }
  });

  // ------------------------------------
  // FINANCIAL MANAGEMENT ROUTES (Empresa x Particular)
  // ------------------------------------
  const addMonthsIso = (dateStr, months) => {
    const [y, m, d] = String(dateStr || '').split('-').map(Number);
    const year = y || new Date().getFullYear();
    const monthIdx = (m || 1) - 1 + months;
    const targetYear = year + Math.floor(monthIdx / 12);
    const normalizedMonth = ((monthIdx % 12) + 12) % 12;
    const lastDay = new Date(targetYear, normalizedMonth + 1, 0).getDate();
    const day = Math.min(d || 1, lastDay);
    return `${targetYear}-${String(normalizedMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };

  const financeStore = async (action, kind, arg1, arg2) => {
    const fbMap = {
      accounts: { get: firebaseDb.getFinancialAccounts, add: firebaseDb.addFinancialAccount, update: firebaseDb.updateFinancialAccount, remove: firebaseDb.removeFinancialAccount },
      owners: { get: firebaseDb.getFinancialOwners, add: firebaseDb.addFinancialOwner, update: firebaseDb.updateFinancialOwner, remove: firebaseDb.removeFinancialOwner },
      entries: { get: firebaseDb.getFinancialEntries, add: firebaseDb.addFinancialEntry, update: firebaseDb.updateFinancialEntry, remove: firebaseDb.removeFinancialEntry },
      payables: { get: firebaseDb.getFinancialPayables, add: firebaseDb.addFinancialPayable, update: firebaseDb.updateFinancialPayable, remove: firebaseDb.removeFinancialPayable },
      categories: { get: firebaseDb.getFinancialCategories, add: firebaseDb.addFinancialCategory, update: firebaseDb.updateFinancialCategory, remove: firebaseDb.removeFinancialCategory },
    };
    const jsonKeyMap = {
      accounts: 'financialAccounts',
      owners: 'financialOwners',
      entries: 'financialEntries',
      payables: 'financialPayables',
      categories: 'financialCategories'
    };

    if (dbType === 'firebase') {
      return fbMap[kind][action](arg1, arg2);
    }
    if (dbType === 'mysql') {
      const mysqlDb = await import('./src/db/mysqlDb.js');
      const myMap = {
        accounts: { get: mysqlDb.getFinancialAccounts, add: mysqlDb.addFinancialAccount, update: mysqlDb.updateFinancialAccount, remove: mysqlDb.removeFinancialAccount },
        owners: { get: mysqlDb.getFinancialOwners, add: mysqlDb.addFinancialOwner, update: mysqlDb.updateFinancialOwner, remove: mysqlDb.removeFinancialOwner },
        entries: { get: mysqlDb.getFinancialEntries, add: mysqlDb.addFinancialEntry, update: mysqlDb.updateFinancialEntry, remove: mysqlDb.removeFinancialEntry },
        payables: { get: mysqlDb.getFinancialPayables, add: mysqlDb.addFinancialPayable, update: mysqlDb.updateFinancialPayable, remove: mysqlDb.removeFinancialPayable },
        categories: { get: mysqlDb.getFinancialCategories, add: mysqlDb.addFinancialCategory, update: mysqlDb.updateFinancialCategory, remove: mysqlDb.removeFinancialCategory },
      };
      return myMap[kind][action](arg1, arg2);
    }

    const db = readDb();
    const jKey = jsonKeyMap[kind];
    db[jKey] = db[jKey] || [];
    if (action === 'get') return db[jKey];
    if (action === 'add') {
      const existingIdx = db[jKey].findIndex(i => i.id === arg1.id);
      if (existingIdx >= 0) db[jKey][existingIdx] = arg1;
      else db[jKey].push(arg1);
      writeDb(db);
      return arg1;
    }
    if (action === 'update') {
      const idx = db[jKey].findIndex(i => i.id === arg1);
      if (idx === -1) {
        if (kind === 'categories') {
          const created = { id: arg1, createdAt: Date.now(), ...arg2 };
          db[jKey].push(created);
          writeDb(db);
          return created;
        }
        return null;
      }
      db[jKey][idx] = { ...db[jKey][idx], ...arg2 };
      writeDb(db);
      return db[jKey][idx];
    }
    if (action === 'remove') {
      db[jKey] = db[jKey].filter(i => i.id !== arg1);
      writeDb(db);
      return true;
    }
    return null;
  };

  app.get('/api/finance/bootstrap', async (req, res) => {
    try {
      const [accounts, owners, entries, payables, categories] = await Promise.all([
        financeStore('get', 'accounts'),
        financeStore('get', 'owners'),
        financeStore('get', 'entries'),
        financeStore('get', 'payables'),
        financeStore('get', 'categories')
      ]);
      res.json({
        accounts: (accounts || []).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)),
        owners: (owners || []).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)),
        entries: (entries || []).sort((a, b) => (b.date || 0) - (a.date || 0)),
        payables: (payables || []).sort((a, b) => String(a.dueDate || '').localeCompare(String(b.dueDate || ''))),
        categories: (categories || []).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
      });
    } catch (error) {
      console.error('Finance bootstrap error:', error);
      res.status(500).json({ error: error.message || 'Falha ao carregar módulo financeiro.' });
    }
  });

  // Accounts CRUD
  app.post('/api/finance/accounts', async (req, res) => {
    try {
      const b = req.body || {};
      const name = String(b.name || '').trim();
      if (!name) return res.status(400).json({ error: 'Nome da conta é obrigatório.' });
      const item = {
        id: 'acc_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
        name,
        type: b.type || 'bank',
        scope: b.scope === 'personal' ? 'personal' : 'company',
        initialBalance: Number(b.initialBalance) || 0,
        notes: b.notes ? String(b.notes).trim() : undefined,
        createdAt: Date.now()
      };
      const saved = await financeStore('add', 'accounts', item);
      res.status(201).json(saved);
    } catch (error) {
      res.status(500).json({ error: error.message || 'Erro ao criar conta.' });
    }
  });

  app.put('/api/finance/accounts/:id', async (req, res) => {
    try {
      const b = req.body || {};
      const data = {};
      if (typeof b.name === 'string' && b.name.trim()) data.name = b.name.trim();
      if (typeof b.type === 'string') data.type = b.type;
      if (b.scope === 'company' || b.scope === 'personal') data.scope = b.scope;
      if (b.initialBalance !== undefined && Number.isFinite(Number(b.initialBalance))) {
        data.initialBalance = Number(b.initialBalance);
      }
      if (typeof b.notes === 'string') data.notes = b.notes.trim();
      const updated = await financeStore('update', 'accounts', req.params.id, data);
      if (!updated) return res.status(404).json({ error: 'Conta não encontrada.' });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: error.message || 'Erro ao atualizar conta.' });
    }
  });

  app.delete('/api/finance/accounts/:id', async (req, res) => {
    try {
      await financeStore('remove', 'accounts', req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message || 'Erro ao excluir conta.' });
    }
  });

  // Owners (Titulares Particulares) CRUD
  app.post('/api/finance/owners', async (req, res) => {
    try {
      const b = req.body || {};
      const name = String(b.name || '').trim();
      if (!name) return res.status(400).json({ error: 'Nome do titular é obrigatório.' });
      const item = {
        id: 'own_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
        name,
        color: b.color || 'indigo',
        createdAt: Date.now()
      };
      const saved = await financeStore('add', 'owners', item);
      res.status(201).json(saved);
    } catch (error) {
      res.status(500).json({ error: error.message || 'Erro ao cadastrar titular.' });
    }
  });

  app.put('/api/finance/owners/:id', async (req, res) => {
    try {
      const b = req.body || {};
      const data = {};
      if (typeof b.name === 'string' && b.name.trim()) data.name = b.name.trim();
      if (typeof b.color === 'string') data.color = b.color;
      const updated = await financeStore('update', 'owners', req.params.id, data);
      if (!updated) return res.status(404).json({ error: 'Titular não encontrado.' });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: error.message || 'Erro ao atualizar titular.' });
    }
  });

  app.delete('/api/finance/owners/:id', async (req, res) => {
    try {
      await financeStore('remove', 'owners', req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message || 'Erro ao excluir titular.' });
    }
  });

  // Entries (Receitas, Despesas, Depósitos/Transferências) CRUD
  app.post('/api/finance/entries', async (req, res) => {
    try {
      const b = req.body || {};
      const amount = Number(b.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        return res.status(400).json({ error: 'Informe um valor maior que zero.' });
      }
      const type = ['income', 'expense', 'transfer'].includes(b.type) ? b.type : 'expense';
      const description = String(b.description || '').trim();
      if (!description) return res.status(400).json({ error: 'Descrição é obrigatória.' });

      if (type === 'transfer' && (!b.accountId || !b.toAccountId || b.accountId === b.toAccountId)) {
        return res.status(400).json({ error: 'Selecione contas de origem e destino diferentes para depósito/transferência.' });
      }

      const item = {
        id: 'fin_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
        type,
        scope: b.scope === 'personal' ? 'personal' : 'company',
        ownerId: b.scope === 'personal' && b.ownerId ? String(b.ownerId) : undefined,
        ownerName: b.scope === 'personal' && b.ownerName ? String(b.ownerName).trim() : undefined,
        description,
        category: String(b.category || (type === 'transfer' ? 'Depósito / Transferência' : 'Outros')).trim(),
        amount,
        date: typeof b.date === 'number' && Number.isFinite(b.date) ? b.date : Date.now(),
        accountId: b.accountId ? String(b.accountId) : undefined,
        toAccountId: type === 'transfer' && b.toAccountId ? String(b.toAccountId) : undefined,
        paymentMethod: b.paymentMethod || 'cash',
        counterparty: b.counterparty ? String(b.counterparty).trim() : undefined,
        payableId: b.payableId ? String(b.payableId) : undefined,
        notes: b.notes ? String(b.notes).trim() : undefined,
        operator: b.operator ? String(b.operator).trim() : undefined
      };
      const saved = await financeStore('add', 'entries', item);
      res.status(201).json(saved);
    } catch (error) {
      res.status(500).json({ error: error.message || 'Erro ao salvar lançamento financeiro.' });
    }
  });

  app.put('/api/finance/entries/:id', async (req, res) => {
    try {
      const b = req.body || {};
      const data = {};
      if (['income', 'expense', 'transfer'].includes(b.type)) data.type = b.type;
      if (b.scope === 'company' || b.scope === 'personal') data.scope = b.scope;
      if (b.scope === 'company') {
        data.ownerId = '';
        data.ownerName = '';
      } else {
        if (typeof b.ownerId === 'string') data.ownerId = b.ownerId;
        if (typeof b.ownerName === 'string') data.ownerName = b.ownerName.trim();
      }
      if (typeof b.description === 'string' && b.description.trim()) data.description = b.description.trim();
      if (typeof b.category === 'string') data.category = b.category.trim();
      if (b.amount !== undefined) {
        const amt = Number(b.amount);
        if (!Number.isFinite(amt) || amt <= 0) return res.status(400).json({ error: 'Valor inválido.' });
        data.amount = amt;
      }
      if (typeof b.date === 'number' && Number.isFinite(b.date)) data.date = b.date;
      if (typeof b.accountId === 'string') data.accountId = b.accountId;
      if (typeof b.toAccountId === 'string') data.toAccountId = b.toAccountId;
      if (typeof b.paymentMethod === 'string') data.paymentMethod = b.paymentMethod;
      if (typeof b.counterparty === 'string') data.counterparty = b.counterparty.trim();
      if (typeof b.notes === 'string') data.notes = b.notes.trim();
      data.editedAt = Date.now();
      if (typeof b.editedBy === 'string') data.editedBy = b.editedBy.trim();

      const updated = await financeStore('update', 'entries', req.params.id, data);
      if (!updated) return res.status(404).json({ error: 'Lançamento não encontrado.' });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: error.message || 'Erro ao atualizar lançamento.' });
    }
  });

  app.delete('/api/finance/entries/:id', async (req, res) => {
    try {
      await financeStore('remove', 'entries', req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message || 'Erro ao excluir lançamento.' });
    }
  });

  // Payables (Contas a Pagar) CRUD + Pay action
  app.post('/api/finance/payables', async (req, res) => {
    try {
      const b = req.body || {};
      const amount = Number(b.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        return res.status(400).json({ error: 'Informe um valor maior que zero.' });
      }
      const description = String(b.description || '').trim();
      if (!description) return res.status(400).json({ error: 'Descrição da conta é obrigatória.' });
      const dueDate = String(b.dueDate || '').trim();
      if (!dueDate) return res.status(400).json({ error: 'Data de vencimento é obrigatória.' });

      const installments = Math.max(1, Math.min(36, parseInt(b.installments, 10) || 1));
      const recurrence = installments > 1 ? 'none' : (b.recurrence === 'monthly' ? 'monthly' : 'none');
      const groupId = installments > 1 || recurrence === 'monthly'
        ? 'grp_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 5)
        : undefined;

      const createdItems = [];
      for (let i = 0; i < installments; i++) {
        const item = {
          id: 'pay_' + Date.now().toString(36) + '_' + i + '_' + Math.random().toString(36).substring(2, 5),
          scope: b.scope === 'personal' ? 'personal' : 'company',
          ownerId: b.scope === 'personal' && b.ownerId ? String(b.ownerId) : undefined,
          ownerName: b.scope === 'personal' && b.ownerName ? String(b.ownerName).trim() : undefined,
          description: installments > 1 ? `${description} (${i + 1}/${installments})` : description,
          category: String(b.category || 'Outros').trim(),
          counterparty: b.counterparty ? String(b.counterparty).trim() : undefined,
          amount,
          dueDate: i === 0 ? dueDate : addMonthsIso(dueDate, i),
          status: 'pending',
          recurrence,
          installmentNumber: installments > 1 ? i + 1 : undefined,
          installmentTotal: installments > 1 ? installments : undefined,
          groupId,
          notes: b.notes ? String(b.notes).trim() : undefined,
          createdAt: Date.now() + i
        };
        const saved = await financeStore('add', 'payables', item);
        createdItems.push(saved);
      }

      res.status(201).json({ created: createdItems });
    } catch (error) {
      res.status(500).json({ error: error.message || 'Erro ao cadastrar conta a pagar.' });
    }
  });

  app.put('/api/finance/payables/:id', async (req, res) => {
    try {
      const b = req.body || {};
      const data = {};
      if (b.scope === 'company' || b.scope === 'personal') data.scope = b.scope;
      if (b.scope === 'company') {
        data.ownerId = '';
        data.ownerName = '';
      } else {
        if (typeof b.ownerId === 'string') data.ownerId = b.ownerId;
        if (typeof b.ownerName === 'string') data.ownerName = b.ownerName.trim();
      }
      if (typeof b.description === 'string' && b.description.trim()) data.description = b.description.trim();
      if (typeof b.category === 'string') data.category = b.category.trim();
      if (typeof b.counterparty === 'string') data.counterparty = b.counterparty.trim();
      if (b.amount !== undefined && Number.isFinite(Number(b.amount)) && Number(b.amount) > 0) {
        data.amount = Number(b.amount);
      }
      if (typeof b.dueDate === 'string' && b.dueDate.trim()) data.dueDate = b.dueDate.trim();
      if (b.recurrence === 'none' || b.recurrence === 'monthly') data.recurrence = b.recurrence;
      if (typeof b.notes === 'string') data.notes = b.notes.trim();

      const updated = await financeStore('update', 'payables', req.params.id, data);
      if (!updated) return res.status(404).json({ error: 'Conta não encontrada.' });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: error.message || 'Erro ao atualizar conta.' });
    }
  });

  app.post('/api/finance/payables/:id/pay', async (req, res) => {
    try {
      const b = req.body || {};
      const allPayables = await financeStore('get', 'payables');
      const existing = (allPayables || []).find(p => p.id === req.params.id);
      if (!existing) return res.status(404).json({ error: 'Conta a pagar não encontrada.' });
      if (existing.status === 'paid') return res.status(400).json({ error: 'Esta conta já foi paga.' });

      const paidAmount = Number(b.paidAmount) > 0 ? Number(b.paidAmount) : Number(existing.amount);
      const paidDate = typeof b.paidDate === 'number' && Number.isFinite(b.paidDate) ? b.paidDate : Date.now();
      const paidAccountId = b.accountId ? String(b.accountId) : undefined;
      const paidPaymentMethod = b.paymentMethod || 'pix';

      const updatedPayable = await financeStore('update', 'payables', req.params.id, {
        status: 'paid',
        paidDate,
        paidAmount,
        paidAccountId,
        paidPaymentMethod
      });

      const expenseEntry = {
        id: 'fin_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
        type: 'expense',
        scope: existing.scope || 'company',
        ownerId: existing.scope === 'personal' ? existing.ownerId : undefined,
        ownerName: existing.scope === 'personal' ? existing.ownerName : undefined,
        description: `Pagamento: ${existing.description}`,
        category: existing.category || 'Outros',
        amount: paidAmount,
        date: paidDate,
        accountId: paidAccountId,
        paymentMethod: paidPaymentMethod,
        counterparty: existing.counterparty,
        payableId: existing.id,
        notes: b.notes ? String(b.notes).trim() : existing.notes,
        operator: b.operator ? String(b.operator).trim() : undefined
      };
      const savedEntry = await financeStore('add', 'entries', expenseEntry);

      let nextRecurringPayable = null;
      if (existing.recurrence === 'monthly') {
        const nextItem = {
          id: 'pay_' + Date.now().toString(36) + '_rec_' + Math.random().toString(36).substring(2, 5),
          scope: existing.scope || 'company',
          ownerId: existing.scope === 'personal' ? existing.ownerId : undefined,
          ownerName: existing.scope === 'personal' ? existing.ownerName : undefined,
          description: existing.description,
          category: existing.category || 'Outros',
          counterparty: existing.counterparty,
          amount: Number(existing.amount) || paidAmount,
          dueDate: addMonthsIso(existing.dueDate, 1),
          status: 'pending',
          recurrence: 'monthly',
          groupId: existing.groupId,
          notes: existing.notes,
          createdAt: Date.now()
        };
        nextRecurringPayable = await financeStore('add', 'payables', nextItem);
      }

      res.json({
        payable: updatedPayable,
        entry: savedEntry,
        nextRecurringPayable
      });
    } catch (error) {
      console.error('Pay payable error:', error);
      res.status(500).json({ error: error.message || 'Erro ao dar baixa na conta a pagar.' });
    }
  });

  app.delete('/api/finance/payables/:id', async (req, res) => {
    try {
      await financeStore('remove', 'payables', req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message || 'Erro ao excluir conta.' });
    }
  });

  // Categories CRUD (supports custom categories + editing/deleting built-in defaults via deterministic IDs)
  app.post('/api/finance/categories', async (req, res) => {
    try {
      const b = req.body || {};
      const name = String(b.name || '').trim();
      if (!name) return res.status(400).json({ error: 'Nome da categoria é obrigatório.' });
      const type = b.type === 'income' ? 'income' : 'expense';
      const scope = ['company', 'personal', 'both'].includes(b.scope) ? b.scope : 'company';
      const item = {
        id: 'cat_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
        name,
        type,
        scope,
        deleted: false,
        createdAt: Date.now()
      };
      const saved = await financeStore('add', 'categories', item);
      res.status(201).json(saved);
    } catch (error) {
      res.status(500).json({ error: error.message || 'Erro ao criar categoria.' });
    }
  });

  app.put('/api/finance/categories/:id', async (req, res) => {
    try {
      const b = req.body || {};
      const name = String(b.name || '').trim();
      if (!name) return res.status(400).json({ error: 'Nome da categoria é obrigatório.' });
      const type = b.type === 'income' ? 'income' : 'expense';
      const scope = ['company', 'personal', 'both'].includes(b.scope) ? b.scope : 'company';
      const data = {
        name,
        type,
        scope,
        deleted: false,
        ...(typeof b.createdAt === 'number' && Number.isFinite(b.createdAt) ? { createdAt: b.createdAt } : {})
      };
      const updated = await financeStore('update', 'categories', req.params.id, data);

      let renamedEntriesCount = 0;
      let renamedPayablesCount = 0;
      const oldName = typeof b.oldName === 'string' ? b.oldName.trim() : '';
      if (b.renameExisting && oldName && oldName !== name) {
        const [allEntries, allPayables] = await Promise.all([
          financeStore('get', 'entries'),
          financeStore('get', 'payables')
        ]);
        for (const entry of (allEntries || [])) {
          if (entry && entry.category === oldName && entry.type === type) {
            await financeStore('update', 'entries', entry.id, { category: name });
            renamedEntriesCount++;
          }
        }
        if (type === 'expense') {
          for (const payable of (allPayables || [])) {
            if (payable && payable.category === oldName) {
              await financeStore('update', 'payables', payable.id, { category: name });
              renamedPayablesCount++;
            }
          }
        }
      }

      res.json({
        category: updated,
        renamedEntriesCount,
        renamedPayablesCount
      });
    } catch (error) {
      res.status(500).json({ error: error.message || 'Erro ao atualizar categoria.' });
    }
  });

  app.delete('/api/finance/categories/:id', async (req, res) => {
    try {
      const id = String(req.params.id || '');
      if (id.startsWith('def_')) {
        // Persist tombstone so built-in default stays deleted across reloads and devices
        const tombstone = await financeStore('update', 'categories', id, {
          name: '',
          type: id.includes('_inc_') ? 'income' : 'expense',
          scope: id.includes('_personal_') ? 'personal' : 'company',
          deleted: true,
          createdAt: Date.now()
        });
        return res.json({ success: true, tombstone });
      }
      await financeStore('remove', 'categories', id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message || 'Erro ao excluir categoria.' });
    }
  });

  app.post('/api/finance/categories/restore-defaults', async (req, res) => {
    try {
      const stored = await financeStore('get', 'categories');
      for (const item of (stored || [])) {
        if (item && String(item.id).startsWith('def_') && item.deleted) {
          await financeStore('remove', 'categories', item.id);
        }
      }
      const refreshed = await financeStore('get', 'categories');
      res.json({ success: true, categories: refreshed || [] });
    } catch (error) {
      res.status(500).json({ error: error.message || 'Erro ao restaurar categorias padrão.' });
    }
  });

  // Garante que nenhuma rota /api/* caia no fallback HTML do SPA
  app.use('/api', (req, res) => {
    res.status(404).json({ error: `Rota da API não encontrada: ${req.method} ${req.originalUrl}` });
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
