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
  const vehicles = [];
  
  const thirtyDaysAgo = Date.now() - 2592000000;
  let hasUpdates = false;

  snapshot.forEach(docSnap => {
    const v = docSnap.data();
    if (v.status === 'active' && v.checkInTime <= thirtyDaysAgo) {
      v.status = 'stored';
      hasUpdates = true;
      // We could update it in Firestore here
      updateDoc(docSnap.ref, { status: 'stored' }).catch(console.error);
    }
    vehicles.push(v);
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

export async function checkOutVehicle(id, price, paymentMethod, checkOutTime) {
  const vehicleRef = doc(db, 'vehicles', id);
  const vehicleSnap = await getDoc(vehicleRef);
  if (!vehicleSnap.exists()) return null;
  
  const updatedData = {
    status: 'completed',
    price,
    paymentMethod,
    checkOutTime
  };
  
  await updateDoc(vehicleRef, updatedData);
  return { ...vehicleSnap.data(), ...updatedData };
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
  await addTransaction({
    id: transId,
    description: `Venda na Loja: ${sale.quantity}x ${sale.productName}`,
    amount: sale.totalPrice,
    date: sale.date,
    type: 'income'
  });

  return sale;
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
