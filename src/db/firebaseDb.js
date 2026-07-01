import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, setDoc, updateDoc, deleteDoc, getDoc, query, where, orderBy, writeBatch } from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';
import fs from 'fs';
import path from 'path';

// Firebase configuration from AI Studio
const firebaseConfigPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
let app, db, auth;

try {
  const configContent = fs.readFileSync(firebaseConfigPath, 'utf8');
  const firebaseConfig = JSON.parse(configContent);
  app = initializeApp(firebaseConfig);
  db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
  auth = getAuth(app);
  
  // Sign in anonymously so we can access Firestore behind some rules
  signInAnonymously(auth).catch((error) => {
    console.error("Firebase Auth Error:", error);
  });
} catch (error) {
  console.error("Failed to initialize Firebase:", error);
}

// ------------------------------------
// Vehicles
// ------------------------------------
export async function getVehicles() {
  const q = query(collection(db, 'vehicles')); // Optionally add orderBy('checkInTime', 'desc') if indexed
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

  // Filter out any we marked for deletion
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
  await setDoc(doc(db, 'vehicles', vehicle.id), vehicle);
  return vehicle;
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
  
  return { ...data, status: 'active', checkOutTime: null, price: null, paymentMethod: null };
}

export async function revertCheckIn(id) {
  const vehicleRef = doc(db, 'vehicles', id);
  await deleteDoc(vehicleRef);
  return true;
}

export async function checkOutVehicle(id, price, paymentMethod, checkOutTime, customerCardId) {
  const vehicleRef = doc(db, 'vehicles', id);
  const vehicleSnap = await getDoc(vehicleRef);
  if (!vehicleSnap.exists()) return null;
  
  const updatedData = {
    status: 'completed',
    price,
    paymentMethod,
    checkOutTime
  };
  
  if (customerCardId) {
    updatedData.customerCardId = customerCardId;
  }
  
  await updateDoc(vehicleRef, updatedData);
  return { ...vehicleSnap.data(), ...updatedData };
}

export async function payFiado(id, paymentMethod, paymentDate, amountToPay) {
  const vehicleRef = doc(db, 'vehicles', id);
  const vehicleSnap = await getDoc(vehicleRef);
  if (!vehicleSnap.exists()) return null;
  
  const currentData = vehicleSnap.data();
  const currentPaid = currentData.fiadoPaidAmount || 0;
  const newPaid = currentPaid + amountToPay;
  const isFullyPaid = newPaid >= currentData.price;
  
  const updatedData = {
    fiadoPaidAmount: newPaid,
    fiadoPaymentDate: paymentDate,
    fiadoPaymentMethod: paymentMethod
  };
  
  if (isFullyPaid) {
    updatedData.isFiadoPaid = true;
  }
  
  await updateDoc(vehicleRef, updatedData);
  return { ...currentData, ...updatedData };
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
  await setDoc(doc(db, 'transactions', transaction.id), transaction);
  return transaction;
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
  await setDoc(doc(db, 'customerCards', card.id), card);
  return card;
}

export async function updateCustomerCard(id, data) {
  const cardRef = doc(db, 'customerCards', id);
  const cardSnap = await getDoc(cardRef);
  if (!cardSnap.exists()) return null;
  const updatedData = { ...cardSnap.data(), ...data };
  await updateDoc(cardRef, updatedData);
  return updatedData;
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
  await setDoc(doc(db, 'operators', operator.id), operator);
  return operator;
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
  await setDoc(doc(db, 'shifts', shift.id), shift);
  return shift;
}

export async function updateShift(id, data) {
  const shiftRef = doc(db, 'shifts', id);
  const shiftSnap = await getDoc(shiftRef);
  if (!shiftSnap.exists()) return null;
  const updatedData = { ...shiftSnap.data(), ...data };
  await updateDoc(shiftRef, updatedData);
  return updatedData;
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
  const cardId = cardNumber.replace(/\W/g, ''); // alphanumeric only for id
  const newCard = { cardNumber, name, phone, date: Date.now() };
  await setDoc(doc(db, 'lostCards', cardId), newCard);
  return newCard;
}

export async function removeLostCard(cardNumber) {
  const cardId = cardNumber.replace(/\W/g, '');
  await deleteDoc(doc(db, 'lostCards', cardId));
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
    // Check if it's the old bad structure
    if (pricingData.bicycle && typeof pricingData.bicycle === 'object') {
       pricingData = null;
    }
  }
  if (pricingData) {
    return pricingData;
  }
  // Default pricing
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
  await updateDoc(doc(db, 'config', 'pricing'), newPricing);
  const updated = await getPricing();
  return updated;
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
  await setDoc(doc(db, 'products', product.id), product);
  return product;
}

export async function updateProduct(product) {
  await updateDoc(doc(db, 'products', product.id), product);
  return product;
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
  await setDoc(doc(db, 'sales', sale.id), sale);
  
  // Also update product stock
  const productRef = doc(db, 'products', sale.productId);
  const productSnap = await getDoc(productRef);
  if (productSnap.exists()) {
    const product = productSnap.data();
    await updateDoc(productRef, { stock: Math.max(0, product.stock - sale.quantity) });
  }

  // And add to cashbook transactions
  const transId = Math.random().toString(36).substring(2, 9);
  const paymentText = sale.paymentMethod === 'machine' ? 'MÁQUINA' :
                      sale.paymentMethod === 'card' ? 'CARTÃO' :
                      sale.paymentMethod === 'cash' ? 'DINHEIRO' :
                      sale.paymentMethod === 'pix' ? 'PIX' :
                      sale.paymentMethod ? sale.paymentMethod.toUpperCase() : 'N/A';
  await addTransaction({
    id: transId,
    description: `Venda na Loja: ${sale.quantity}x ${sale.productName} (${paymentText})`,
    amount: sale.totalPrice,
    date: sale.date,
    type: 'income'
  });

  return sale;
}

export async function updateSale(id, data) {
  const saleRef = doc(db, 'sales', id);
  const saleSnap = await getDoc(saleRef);
  if (!saleSnap.exists()) return null;
  const oldSale = saleSnap.data();
  const updatedData = { ...oldSale, ...data };
  await updateDoc(saleRef, updatedData);

  // If quantity or product changed, adjust stock
  if (data.quantity !== undefined || data.productId !== undefined) {
    const oldQty = Number(oldSale.quantity) || 0;
    const newQty = Number(data.quantity ?? oldSale.quantity) || 0;
    const qtyDiff = newQty - oldQty;
    const prodId = data.productId ?? oldSale.productId;
    const productRef = doc(db, 'products', prodId);
    const productSnap = await getDoc(productRef);
    if (productSnap.exists()) {
      const product = productSnap.data();
      await updateDoc(productRef, { stock: Math.max(0, (Number(product.stock) || 0) - qtyDiff) });
    }
  }

  // Update associated transaction
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
    // Restore stock
    const productRef = doc(db, 'products', sale.productId);
    const productSnap = await getDoc(productRef);
    if (productSnap.exists()) {
      const product = productSnap.data();
      await updateDoc(productRef, { stock: (Number(product.stock) || 0) + (Number(sale.quantity) || 0) });
    }
    // Delete associated transaction
    const transSnap = await getDocs(query(collection(db, 'transactions'), where('date', '==', sale.date)));
    transSnap.forEach((docSnap) => {
      deleteDoc(docSnap.ref).catch(console.error);
    });
    // Delete sale
    await deleteDoc(saleRef);
  }
}

export async function updateVehicle(id, data) {
  const vehicleRef = doc(db, 'vehicles', id);
  const vehicleSnap = await getDoc(vehicleRef);
  if (!vehicleSnap.exists()) return null;
  const updatedData = { ...vehicleSnap.data(), ...data };
  await updateDoc(vehicleRef, updatedData);
  return updatedData;
}

export async function removeVehicle(id) {
  await deleteDoc(doc(db, 'vehicles', id));
}

export async function updateTransaction(id, data) {
  const transRef = doc(db, 'transactions', id);
  const transSnap = await getDoc(transRef);
  if (!transSnap.exists()) return null;
  const updatedData = { ...transSnap.data(), ...data };
  await updateDoc(transRef, updatedData);
  return updatedData;
}

export async function resetDatabase() {
  const batch = writeBatch(db);
  
  // Get and delete all vehicles
  const vehiclesSnapshot = await getDocs(collection(db, 'vehicles'));
  vehiclesSnapshot.forEach((document) => {
    batch.delete(doc(db, 'vehicles', document.id));
  });

  // Get and delete all transactions
  const transactionsSnapshot = await getDocs(collection(db, 'transactions'));
  transactionsSnapshot.forEach((document) => {
    batch.delete(doc(db, 'transactions', document.id));
  });

  // Get and delete all lost cards
  const lostCardsSnapshot = await getDocs(collection(db, 'lostCards'));
  lostCardsSnapshot.forEach((document) => {
    batch.delete(doc(db, 'lostCards', document.id));
  });

  await batch.commit();
}
