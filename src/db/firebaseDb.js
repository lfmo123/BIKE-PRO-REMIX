import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  query,
  where,
  writeBatch,
  runTransaction
} from 'firebase/firestore';
import fs from 'fs';
import path from 'path';

// Firebase configuration from AI Studio
const firebaseConfigPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
let app, db;

try {
  const configContent = fs.readFileSync(firebaseConfigPath, 'utf8');
  const firebaseConfig = JSON.parse(configContent);
  app = initializeApp(firebaseConfig);
  db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
} catch (error) {
  console.error("Failed to initialize Firebase:", error);
}

function getSafeCardLockId(cardNumber) {
  return encodeURIComponent(String(cardNumber || '').trim().toUpperCase()).replace(/\./g, '%2E') || 'EMPTY';
}

function removeUndefinedFields(obj) {
  const clean = {};
  Object.entries(obj || {}).forEach(([k, v]) => {
    if (v !== undefined) clean[k] = v;
  });
  return clean;
}

// ------------------------------------
// Vehicles
// ------------------------------------
export async function getVehicles() {
  const q = query(collection(db, 'vehicles'));
  const snapshot = await getDocs(q);
  let vehicles = [];

  const thirtyDaysAgo = Date.now() - 2592000000;
  const activeSpotMap = new Map();

  snapshot.forEach(docSnap => {
    const v = docSnap.data();
    if (v.status === 'active' && v.checkInTime <= thirtyDaysAgo) {
      v.status = 'stored';
      updateDoc(docSnap.ref, { status: 'stored' }).catch(console.error);
    }

    if ((v.status === 'active' || v.status === 'stored') && v.cardNumber) {
      const existing = activeSpotMap.get(v.cardNumber);
      if (existing) {
        if (v.checkInTime > existing.checkInTime) {
          deleteDoc(doc(db, 'vehicles', existing.id)).catch(console.error);
          activeSpotMap.set(v.cardNumber, v);
        } else {
          deleteDoc(doc(db, 'vehicles', v.id)).catch(console.error);
          return;
        }
      } else {
        activeSpotMap.set(v.cardNumber, v);
      }
    }
    vehicles.push(v);
  });

  vehicles = vehicles.filter(v => {
    if ((v.status === 'active' || v.status === 'stored') && v.cardNumber) {
      return activeSpotMap.get(v.cardNumber).id === v.id;
    }
    return true;
  });

  return vehicles.sort((a, b) => b.checkInTime - a.checkInTime);
}

export async function checkSpotTaken(cardNumber) {
  const q = query(collection(db, 'vehicles'), where('cardNumber', '==', cardNumber));
  const snapshot = await getDocs(q);
  let isTaken = false;
  snapshot.forEach(docSnap => {
    const v = docSnap.data();
    if (v.status === 'active' || v.status === 'stored') isTaken = true;
  });
  return isTaken;
}

export async function checkInVehicle(vehicle) {
  const cleanVehicle = removeUndefinedFields(vehicle);
  const lockId = getSafeCardLockId(cleanVehicle.cardNumber);
  const lockRef = doc(db, 'spotLocks', lockId);
  const vehicleRef = doc(db, 'vehicles', cleanVehicle.id);

  // Primeiro verifica veículos legados sem lock
  const legacyTaken = await checkSpotTaken(cleanVehicle.cardNumber);
  if (legacyTaken) {
    const err = new Error('Esta vaga/cartão já está ocupada por outro veículo.');
    err.statusCode = 409;
    throw err;
  }

  await runTransaction(db, async (tx) => {
    const lockSnap = await tx.get(lockRef);
    let existingVehSnap = null;
    if (lockSnap.exists() && lockSnap.data().active && lockSnap.data().vehicleId) {
      existingVehSnap = await tx.get(doc(db, 'vehicles', lockSnap.data().vehicleId));
    }

    if (
      existingVehSnap &&
      existingVehSnap.exists() &&
      (existingVehSnap.data().status === 'active' || existingVehSnap.data().status === 'stored')
    ) {
      const err = new Error('Esta vaga/cartão acabou de ser ocupada em outro aparelho.');
      err.statusCode = 409;
      throw err;
    }

    tx.set(vehicleRef, cleanVehicle);
    tx.set(lockRef, {
      cardNumber: cleanVehicle.cardNumber,
      vehicleId: cleanVehicle.id,
      active: true,
      updatedAt: Date.now()
    });
  });

  return cleanVehicle;
}

export async function revertCheckOut(id) {
  const vehicleRef = doc(db, 'vehicles', id);
  const vehicleSnap = await getDoc(vehicleRef);
  if (!vehicleSnap.exists()) return null;
  const data = vehicleSnap.data();

  await updateDoc(vehicleRef, {
    status: 'active',
    checkOutTime: null,
    price: null,
    paymentMethod: null
  });

  if (data.cardNumber) {
    const lockRef = doc(db, 'spotLocks', getSafeCardLockId(data.cardNumber));
    await setDoc(lockRef, {
      cardNumber: data.cardNumber,
      vehicleId: id,
      active: true,
      updatedAt: Date.now()
    }).catch(console.error);
  }

  return { ...data, status: 'active', checkOutTime: null, price: null, paymentMethod: null };
}

export async function revertCheckIn(id) {
  const vehicleRef = doc(db, 'vehicles', id);
  const snap = await getDoc(vehicleRef);
  const cardNumber = snap.exists() ? snap.data().cardNumber : null;
  await deleteDoc(vehicleRef);
  if (cardNumber) {
    const lockRef = doc(db, 'spotLocks', getSafeCardLockId(cardNumber));
    await setDoc(lockRef, { active: false, updatedAt: Date.now() }, { merge: true }).catch(console.error);
  }
  return true;
}

export async function checkOutVehicle(
  id,
  price,
  paymentMethod,
  checkOutTime,
  customerCardId,
  checkInTime,
  checkOutOperatorName
) {
  const vehicleRef = doc(db, 'vehicles', id);

  // Resolve customerCardId caso não tenha sido passado explicitamente mas seja pagamento de cartão
  let resolvedCardId = customerCardId;
  if (!resolvedCardId && (paymentMethod === 'card' || paymentMethod === 'postpaid_card')) {
    const vPreSnap = await getDoc(vehicleRef);
    if (vPreSnap.exists()) {
      const vData = vPreSnap.data();
      const cardsSnap = await getDocs(query(collection(db, 'customerCards'), where('cardNumber', '==', vData.cardNumber)));
      if (!cardsSnap.empty) {
        resolvedCardId = cardsSnap.docs[0].id;
      }
    }
  }

  const cardRef =
    (paymentMethod === 'card' || paymentMethod === 'postpaid_card') && resolvedCardId
      ? doc(db, 'customerCards', resolvedCardId)
      : null;

  const result = await runTransaction(db, async (tx) => {
    const vehicleSnap = await tx.get(vehicleRef);
    if (!vehicleSnap.exists()) return null;

    const currentData = vehicleSnap.data();
    if (currentData.status === 'completed') {
      const err = new Error('Este veículo já foi finalizado em outro dispositivo.');
      err.statusCode = 409;
      throw err;
    }

    let cardSnap = null;
    if (cardRef) {
      cardSnap = await tx.get(cardRef);
    }

    const updatedData = removeUndefinedFields({
      status: 'completed',
      price,
      paymentMethod,
      checkOutTime,
      checkInTime: checkInTime || undefined,
      customerCardId: resolvedCardId || undefined,
      checkOutOperatorName: checkOutOperatorName || undefined
    });

    tx.update(vehicleRef, updatedData);

    if (currentData.cardNumber) {
      const lockRef = doc(db, 'spotLocks', getSafeCardLockId(currentData.cardNumber));
      tx.set(lockRef, { active: false, updatedAt: Date.now() }, { merge: true });
    }

    if (cardSnap && cardSnap.exists()) {
      const cardData = cardSnap.data();
      const prevBalance = Number(cardData.balance) || 0;
      const numPrice = Number(price) || 0;
      const newBalance = paymentMethod === 'card' ? prevBalance - numPrice : prevBalance + numPrice;
      tx.update(cardRef, { balance: newBalance });
    }

    return { ...currentData, ...updatedData };
  });

  return result;
}

export async function payFiado(id, paymentMethod, paymentDate, amountToPay) {
  const vehicleRef = doc(db, 'vehicles', id);
  return runTransaction(db, async (tx) => {
    const vehicleSnap = await tx.get(vehicleRef);
    if (!vehicleSnap.exists()) return null;

    const currentData = vehicleSnap.data();
    const currentPaid = Number(currentData.fiadoPaidAmount) || 0;
    const newPaid = currentPaid + Number(amountToPay || 0);
    const isFullyPaid = newPaid >= (Number(currentData.price) || 0);

    const updatedData = {
      fiadoPaidAmount: newPaid,
      fiadoPaymentDate: paymentDate,
      fiadoPaymentMethod: paymentMethod,
      ...(isFullyPaid ? { isFiadoPaid: true } : {})
    };

    tx.update(vehicleRef, updatedData);
    return { ...currentData, ...updatedData };
  });
}

// ------------------------------------
// Transactions
// ------------------------------------
export async function getTransactions() {
  const snapshot = await getDocs(collection(db, 'transactions'));
  const transactions = [];
  snapshot.forEach(docSnap => transactions.push(docSnap.data()));
  return transactions;
}

export async function addTransaction(transaction) {
  const clean = removeUndefinedFields(transaction);
  await setDoc(doc(db, 'transactions', clean.id), clean);
  return clean;
}

export async function removeTransaction(id) {
  await deleteDoc(doc(db, 'transactions', id));
}

// ------------------------------------
// Customer Cards
// ------------------------------------
export async function getCustomerCards() {
  const snapshot = await getDocs(collection(db, 'customerCards'));
  const cards = [];
  snapshot.forEach(docSnap => cards.push(docSnap.data()));
  return cards;
}

export async function addCustomerCard(card) {
  const clean = removeUndefinedFields(card);
  await setDoc(doc(db, 'customerCards', clean.id), clean);
  return clean;
}

export async function updateCustomerCard(id, data) {
  const cardRef = doc(db, 'customerCards', id);
  return runTransaction(db, async (tx) => {
    const cardSnap = await tx.get(cardRef);
    if (!cardSnap.exists()) return null;
    const updatedData = removeUndefinedFields({ ...cardSnap.data(), ...data });
    tx.update(cardRef, updatedData);
    return updatedData;
  });
}

export async function removeCustomerCard(id) {
  await deleteDoc(doc(db, 'customerCards', id));
}

// ------------------------------------
// Operators
// ------------------------------------
export async function getOperators() {
  const snapshot = await getDocs(collection(db, 'operators'));
  const operators = [];
  snapshot.forEach(docSnap => operators.push(docSnap.data()));
  return operators;
}

export async function addOperator(operator) {
  const clean = removeUndefinedFields(operator);
  await setDoc(doc(db, 'operators', clean.id), clean);
  return clean;
}

export async function removeOperator(id) {
  await deleteDoc(doc(db, 'operators', id));
}

// ------------------------------------
// Shifts
// ------------------------------------
export async function getShifts() {
  const snapshot = await getDocs(collection(db, 'shifts'));
  const shifts = [];
  snapshot.forEach(docSnap => shifts.push(docSnap.data()));
  return shifts;
}

export async function addShift(shift) {
  const clean = removeUndefinedFields(shift);
  await setDoc(doc(db, 'shifts', clean.id), clean);
  return clean;
}

export async function updateShift(id, data) {
  const shiftRef = doc(db, 'shifts', id);
  return runTransaction(db, async (tx) => {
    const shiftSnap = await tx.get(shiftRef);
    if (!shiftSnap.exists()) return null;
    const updatedData = removeUndefinedFields({ ...shiftSnap.data(), ...data });
    tx.update(shiftRef, updatedData);
    return updatedData;
  });
}

// ------------------------------------
// Lost Cards
// ------------------------------------
export async function getLostCards() {
  const snapshot = await getDocs(collection(db, 'lostCards'));
  const cards = [];
  snapshot.forEach(docSnap => cards.push(docSnap.data()));
  return cards;
}

export async function addLostCard(cardNumber, name, phone) {
  const cardId = cardNumber.replace(/\W/g, '');
  const newCard = { cardNumber, name, phone, date: Date.now() };
  await setDoc(doc(db, 'lostCards', cardId), newCard);
  return newCard;
}

export async function removeLostCard(cardNumber) {
  const cardId = cardNumber.replace(/\W/g, '');
  await deleteDoc(doc(db, 'lostCards', cardId));
}

export async function recoverVehicleCardLost(cardNumber) {
  const vehiclesCol = collection(db, 'vehicles');
  const q = query(vehiclesCol, where('cardNumber', '==', cardNumber), where('cardLost', '==', true));
  const snap = await getDocs(q);
  const updatePromises = snap.docs.map(docSnap =>
    updateDoc(doc(db, 'vehicles', docSnap.id), { cardLost: false })
  );
  await Promise.all(updatePromises);
}

export async function updateVehicleCard(id, newCardNumber) {
  const vehicleRef = doc(db, 'vehicles', id);
  const vehicleSnap = await getDoc(vehicleRef);
  if (!vehicleSnap.exists()) return null;
  await updateDoc(vehicleRef, { cardNumber: newCardNumber });
  return { ...vehicleSnap.data(), cardNumber: newCardNumber };
}

export async function reportLostCard(vehicleId, lostCardName, lostCardPhone) {
  const vehicleRef = doc(db, 'vehicles', vehicleId);
  const vehicleSnap = await getDoc(vehicleRef);
  if (!vehicleSnap.exists()) return null;

  const updatedData = { cardLost: true, lostCardName, lostCardPhone };
  await updateDoc(vehicleRef, updatedData);

  return { ...vehicleSnap.data(), ...updatedData };
}

// ------------------------------------
// Pricing
// ------------------------------------
export async function getPricing() {
  const docSnap = await getDoc(doc(db, 'config', 'pricing'));
  let pricingData;
  if (docSnap.exists()) {
    pricingData = docSnap.data();
    if (pricingData.bicycle && typeof pricingData.bicycle === 'object') {
      pricingData = null;
    }
  }
  if (pricingData) {
    return pricingData;
  }
  const defaultPricing = {
    bicycle: 15,
    ebike: 20,
    motorcycle: 30,
    car: 60,
    lostCardFee: 50,
    totalSpots: 300
  };
  await setDoc(doc(db, 'config', 'pricing'), defaultPricing);
  return defaultPricing;
}

export async function updatePricing(newPricing) {
  const clean = removeUndefinedFields(newPricing);
  await setDoc(doc(db, 'config', 'pricing'), clean, { merge: true });
  return getPricing();
}

// ------------------------------------
// Store (Products & Sales)
// ------------------------------------
export async function getProducts() {
  const snapshot = await getDocs(collection(db, 'products'));
  const products = [];
  snapshot.forEach(docSnap => products.push(docSnap.data()));
  return products;
}

export async function addProduct(product) {
  const clean = removeUndefinedFields(product);
  await setDoc(doc(db, 'products', clean.id), clean);
  return clean;
}

export async function updateProduct(product) {
  const clean = removeUndefinedFields(product);
  await updateDoc(doc(db, 'products', clean.id), clean);
  return clean;
}

export async function removeProduct(id) {
  await deleteDoc(doc(db, 'products', id));
}

export async function getSales() {
  const snapshot = await getDocs(collection(db, 'sales'));
  const sales = [];
  snapshot.forEach(docSnap => sales.push(docSnap.data()));
  return sales;
}

export async function addSale(sale) {
  const cleanSale = removeUndefinedFields(sale);
  const saleRef = doc(db, 'sales', cleanSale.id);
  const productRef = doc(db, 'products', cleanSale.productId);
  const transId = Math.random().toString(36).substring(2, 9);
  const transRef = doc(db, 'transactions', transId);

  const paymentText = cleanSale.paymentMethod === 'machine' ? 'MÁQUINA' :
                      cleanSale.paymentMethod === 'card' ? 'CARTÃO' :
                      cleanSale.paymentMethod === 'cash' ? 'DINHEIRO' :
                      cleanSale.paymentMethod === 'pix' ? 'PIX' :
                      cleanSale.paymentMethod ? cleanSale.paymentMethod.toUpperCase() : 'N/A';

  await runTransaction(db, async (tx) => {
    const productSnap = await tx.get(productRef);
    tx.set(saleRef, cleanSale);

    if (productSnap.exists()) {
      const product = productSnap.data();
      const newStock = Math.max(0, (Number(product.stock) || 0) - (Number(cleanSale.quantity) || 0));
      tx.update(productRef, { stock: newStock });
    }

    tx.set(transRef, removeUndefinedFields({
      id: transId,
      description: `Venda na Loja: ${cleanSale.quantity}x ${cleanSale.productName} (${paymentText})`,
      amount: cleanSale.totalPrice,
      date: cleanSale.date,
      type: 'income',
      operator: cleanSale.operatorName || undefined
    }));
  });

  return cleanSale;
}

export async function updateSale(id, data) {
  const saleRef = doc(db, 'sales', id);
  const saleSnap = await getDoc(saleRef);
  if (!saleSnap.exists()) return null;
  const oldSale = saleSnap.data();
  const updatedData = removeUndefinedFields({ ...oldSale, ...data });
  await updateDoc(saleRef, updatedData);

  if (data.quantity !== undefined || data.productId !== undefined) {
    const oldQty = Number(oldSale.quantity) || 0;
    const newQty = Number(data.quantity ?? oldSale.quantity) || 0;
    const qtyDiff = newQty - oldQty;
    const prodId = data.productId ?? oldSale.productId;
    const productRef = doc(db, 'products', prodId);

    await runTransaction(db, async (tx) => {
      const productSnap = await tx.get(productRef);
      if (productSnap.exists()) {
        const product = productSnap.data();
        tx.update(productRef, { stock: Math.max(0, (Number(product.stock) || 0) - qtyDiff) });
      }
    });
  }

  const transSnap = await getDocs(query(collection(db, 'transactions'), where('date', '==', oldSale.date)));
  const paymentText = updatedData.paymentMethod === 'machine' ? 'MÁQUINA' :
                      updatedData.paymentMethod === 'card' ? 'CARTÃO' :
                      updatedData.paymentMethod === 'cash' ? 'DINHEIRO' :
                      updatedData.paymentMethod === 'pix' ? 'PIX' :
                      updatedData.paymentMethod ? updatedData.paymentMethod.toUpperCase() : 'N/A';
  transSnap.forEach((docSnap) => {
    updateDoc(docSnap.ref, {
      description: `Venda na Loja: ${updatedData.quantity}x ${updatedData.productName} (${paymentText})`,
      amount: updatedData.totalPrice,
      date: updatedData.date ?? oldSale.date
    }).catch(console.error);
  });

  return updatedData;
}

export async function removeSale(id) {
  const saleRef = doc(db, 'sales', id);
  const saleSnap = await getDoc(saleRef);
  if (saleSnap.exists()) {
    const sale = saleSnap.data();
    const productRef = doc(db, 'products', sale.productId);
    await runTransaction(db, async (tx) => {
      const productSnap = await tx.get(productRef);
      if (productSnap.exists()) {
        const product = productSnap.data();
        tx.update(productRef, { stock: (Number(product.stock) || 0) + (Number(sale.quantity) || 0) });
      }
      tx.delete(saleRef);
    });

    const transSnap = await getDocs(query(collection(db, 'transactions'), where('date', '==', sale.date)));
    transSnap.forEach((docSnap) => {
      deleteDoc(docSnap.ref).catch(console.error);
    });
  }
}

export async function updateVehicle(id, data) {
  const vehicleRef = doc(db, 'vehicles', id);
  const vehicleSnap = await getDoc(vehicleRef);
  if (!vehicleSnap.exists()) return null;
  const updatedData = removeUndefinedFields({ ...vehicleSnap.data(), ...data });
  await updateDoc(vehicleRef, updatedData);
  return updatedData;
}

export async function removeVehicle(id) {
  const vehicleRef = doc(db, 'vehicles', id);
  const snap = await getDoc(vehicleRef);
  const cardNumber = snap.exists() ? snap.data().cardNumber : null;
  await deleteDoc(vehicleRef);
  if (cardNumber) {
    const lockRef = doc(db, 'spotLocks', getSafeCardLockId(cardNumber));
    await setDoc(lockRef, { active: false, updatedAt: Date.now() }, { merge: true }).catch(console.error);
  }
}

export async function updateTransaction(id, data) {
  const transRef = doc(db, 'transactions', id);
  const transSnap = await getDoc(transRef);
  if (!transSnap.exists()) return null;
  const updatedData = removeUndefinedFields({ ...transSnap.data(), ...data });
  await updateDoc(transRef, updatedData);
  return updatedData;
}

async function commitInChunks(operations) {
  const CHUNK_SIZE = 400;
  for (let i = 0; i < operations.length; i += CHUNK_SIZE) {
    const chunk = operations.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);
    chunk.forEach(op => op(batch));
    await batch.commit();
  }
}

export async function resetDatabase() {
  const ops = [];
  const vehiclesSnapshot = await getDocs(collection(db, 'vehicles'));
  vehiclesSnapshot.forEach((document) => ops.push((b) => b.delete(doc(db, 'vehicles', document.id))));

  const transactionsSnapshot = await getDocs(collection(db, 'transactions'));
  transactionsSnapshot.forEach((document) => ops.push((b) => b.delete(doc(db, 'transactions', document.id))));

  const lostCardsSnapshot = await getDocs(collection(db, 'lostCards'));
  lostCardsSnapshot.forEach((document) => ops.push((b) => b.delete(doc(db, 'lostCards', document.id))));

  const locksSnapshot = await getDocs(collection(db, 'spotLocks'));
  locksSnapshot.forEach((document) => ops.push((b) => b.delete(doc(db, 'spotLocks', document.id))));

  await commitInChunks(ops);
}

export async function restoreBackup(data) {
  const ops = [];

  if (data.pricing && typeof data.pricing === 'object') {
    ops.push((b) => b.set(doc(db, 'config', 'pricing'), removeUndefinedFields(data.pricing), { merge: true }));
  }

  if (Array.isArray(data.vehicles)) {
    data.vehicles.forEach((v) => {
      if (v && v.id) {
        const clean = removeUndefinedFields(v);
        ops.push((b) => b.set(doc(db, 'vehicles', String(clean.id)), clean));
        if ((clean.status === 'active' || clean.status === 'stored') && clean.cardNumber) {
          ops.push((b) => b.set(doc(db, 'spotLocks', getSafeCardLockId(clean.cardNumber)), {
            cardNumber: clean.cardNumber,
            vehicleId: String(clean.id),
            active: true,
            updatedAt: Date.now()
          }));
        }
      }
    });
  }

  if (Array.isArray(data.transactions)) {
    data.transactions.forEach((t) => {
      if (t && t.id) {
        ops.push((b) => b.set(doc(db, 'transactions', String(t.id)), removeUndefinedFields(t)));
      }
    });
  }

  if (Array.isArray(data.lostCards)) {
    data.lostCards.forEach((lc) => {
      const cardObj = typeof lc === 'string' ? { cardNumber: lc } : lc;
      if (cardObj && cardObj.cardNumber) {
        const cardId = String(cardObj.cardNumber).replace(/\W/g, '');
        if (cardId) {
          ops.push((b) => b.set(doc(db, 'lostCards', cardId), removeUndefinedFields(cardObj)));
        }
      }
    });
  }

  if (Array.isArray(data.customerCards)) {
    data.customerCards.forEach((cc) => {
      if (cc && cc.id) {
        ops.push((b) => b.set(doc(db, 'customerCards', String(cc.id)), removeUndefinedFields(cc)));
      }
    });
  }

  if (Array.isArray(data.products)) {
    data.products.forEach((p) => {
      if (p && p.id) {
        ops.push((b) => b.set(doc(db, 'products', String(p.id)), removeUndefinedFields(p)));
      }
    });
  }

  if (Array.isArray(data.sales)) {
    data.sales.forEach((s) => {
      if (s && s.id) {
        ops.push((b) => b.set(doc(db, 'sales', String(s.id)), removeUndefinedFields(s)));
      }
    });
  }

  if (Array.isArray(data.shifts)) {
    data.shifts.forEach((sh) => {
      if (sh && sh.id) {
        ops.push((b) => b.set(doc(db, 'shifts', String(sh.id)), removeUndefinedFields(sh)));
      }
    });
  }

  if (Array.isArray(data.operators)) {
    data.operators.forEach((op) => {
      if (op && op.id) {
        ops.push((b) => b.set(doc(db, 'operators', String(op.id)), removeUndefinedFields(op)));
      }
    });
  }

  await commitInChunks(ops);
  return { restoredCount: ops.length };
}
