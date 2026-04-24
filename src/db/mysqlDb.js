import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

let pool;

export let isDbConnected = false;
export let dbConnectionError = "Não conectado.";

function getPool() {
  if (pool) return pool;
  
  if (!process.env.DB_HOST || !process.env.DB_PASSWORD) {
     throw new Error("Credenciais do banco de dados (DB_HOST, DB_PASSWORD) não estão configuradas. Configure-as no painel de Segredos/Settings.");
  }
  
  pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'estacionamento',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });
  return pool;
}

export async function initMySQL() {
  // Create tables if they don't exist
  const createVehiclesQuery = `
    CREATE TABLE IF NOT EXISTS vehicles (
      id VARCHAR(50) PRIMARY KEY,
      type VARCHAR(50) NOT NULL,
      identifier VARCHAR(255) NOT NULL,
      ownerName VARCHAR(255) NOT NULL,
      cardNumber VARCHAR(50) NOT NULL,
      checkInTime BIGINT NOT NULL,
      checkOutTime BIGINT,
      status VARCHAR(50) NOT NULL,
      price DECIMAL(10, 2),
      paymentMethod VARCHAR(50),
      cardLost BOOLEAN DEFAULT FALSE,
      lostCardName VARCHAR(255),
      lostCardPhone VARCHAR(50)
    )
  `;

  const createPricingQuery = `
    CREATE TABLE IF NOT EXISTS pricing (
      vehicle_type VARCHAR(50) PRIMARY KEY,
      rate DECIMAL(10, 2) NOT NULL
    )
  `;

  try {
    const currentPool = getPool();
    await currentPool.query('SELECT 1'); // Testa a conexão primeiro
    await currentPool.query(createVehiclesQuery);
    await currentPool.query(createPricingQuery);
    
    // Inserir preços padrão se a tabela estiver vazia
    const [rows] = await currentPool.query('SELECT COUNT(*) as count FROM pricing');
    if (rows[0].count === 0) {
      await currentPool.query('INSERT INTO pricing (vehicle_type, rate) VALUES ("car", 60), ("motorcycle", 30), ("bicycle", 15)');
    }
    
    // Migration: add lostCardFee se não existir
    try {
      const [pricingRows] = await currentPool.query('SELECT COUNT(*) as count FROM pricing WHERE vehicle_type = "lostCardFee"');
      if (pricingRows[0].count === 0) {
        await currentPool.query('INSERT INTO pricing (vehicle_type, rate) VALUES ("lostCardFee", 50)');
      }
    } catch (e) {
      // ignore
    }

    // Migration: add new columns if they do not exist
    try {
      await currentPool.query('ALTER TABLE vehicles ADD COLUMN cardLost BOOLEAN DEFAULT FALSE');
      await currentPool.query('ALTER TABLE vehicles ADD COLUMN lostCardName VARCHAR(255)');
      await currentPool.query('ALTER TABLE vehicles ADD COLUMN lostCardPhone VARCHAR(50)');
    } catch (e) {
      // Ignorar se as colunas já existirem
    }

    console.log('Tabelas do MySQL verificadas/criadas com sucesso.');
    isDbConnected = true;
    dbConnectionError = null;
  } catch (error) {
    console.error('Erro ao inicializar o banco de dados MySQL:', error.message);
    isDbConnected = false;
    dbConnectionError = error.message;
  }
}

export async function getVehicles() {
  if (!isDbConnected) throw new Error("A conexão com o banco de dados falhou: " + dbConnectionError);
  const [rows] = await getPool().query('SELECT * FROM vehicles ORDER BY checkInTime DESC');
  // Converter os tipos
  return rows.map(r => ({
    ...r,
    price: r.price ? parseFloat(r.price) : undefined,
    cardLost: !!r.cardLost,
  }));
}

export async function checkInVehicle(vehicle) {
  if (!isDbConnected) throw new Error("A conexão com o banco de dados falhou: " + dbConnectionError);
  const query = `
    INSERT INTO vehicles (id, type, identifier, ownerName, cardNumber, checkInTime, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;
  await getPool().query(query, [
    vehicle.id, vehicle.type, vehicle.identifier, vehicle.ownerName, vehicle.cardNumber, vehicle.checkInTime, vehicle.status
  ]);
}

export async function checkOutVehicle(id, price, paymentMethod, checkOutTime) {
  if (!isDbConnected) throw new Error("A conexão com o banco de dados falhou: " + dbConnectionError);
  const query = `
    UPDATE vehicles 
    SET status = 'completed', checkOutTime = ?, price = ?, paymentMethod = ?
    WHERE id = ?
  `;
  await getPool().query(query, [checkOutTime, price, paymentMethod, id]);
  
  const [rows] = await getPool().query('SELECT * FROM vehicles WHERE id = ?', [id]);
  if (!rows || rows.length === 0) return null;
  return { ...rows[0], price: rows[0].price ? parseFloat(rows[0].price) : undefined, cardLost: !!rows[0].cardLost };
}

export async function reportLostCard(id, lostCardName, lostCardPhone) {
  if (!isDbConnected) throw new Error("A conexão com o banco de dados falhou: " + dbConnectionError);
  const query = `
    UPDATE vehicles 
    SET cardLost = TRUE, lostCardName = ?, lostCardPhone = ?
    WHERE id = ?
  `;
  await getPool().query(query, [lostCardName, lostCardPhone, id]);
  
  const [rows] = await getPool().query('SELECT * FROM vehicles WHERE id = ?', [id]);
  if (!rows || rows.length === 0) return null;
  return { ...rows[0], price: rows[0].price ? parseFloat(rows[0].price) : undefined, cardLost: !!rows[0].cardLost };
}

export async function getPricing() {
  if (!isDbConnected) throw new Error("A conexão com o banco de dados falhou: " + dbConnectionError);
  const [rows] = await getPool().query('SELECT vehicle_type, rate FROM pricing');
  const pricing = {};
  rows.forEach(r => {
    pricing[r.vehicle_type] = parseFloat(r.rate);
  });
  return pricing;
}

export async function updatePricing(pricingObj) {
  if (!isDbConnected) throw new Error("A conexão com o banco de dados falhou: " + dbConnectionError);
  const queries = Object.entries(pricingObj).map(([type, rate]) => {
    return getPool().query('INSERT INTO pricing (vehicle_type, rate) VALUES (?, ?) ON DUPLICATE KEY UPDATE rate = ?', [type, rate, rate]);
  });
  await Promise.all(queries);
  return getPricing();
}

export async function checkSpotTaken(cardNumber) {
  if (!isDbConnected) throw new Error("A conexão com o banco de dados falhou: " + dbConnectionError);
  const [rows] = await getPool().query('SELECT COUNT(*) as count FROM vehicles WHERE cardNumber = ? AND status = "active"', [cardNumber]);
  return rows[0].count > 0;
}
