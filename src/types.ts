export type VehicleType = 'bicycle' | 'ebike' | 'motorcycle';

export interface LostCard {
  cardNumber: string;
  name?: string;
  phone?: string;
  date?: number;
}

export type RentalMode = 'fixed' | 'floating';
export type RentalStatus = 'active' | 'cancelled';

export interface SpotRental {
  id: string;
  ownerName: string;
  phone?: string;
  vehicleType: VehicleType;
  vehicleIdentifier?: string;
  mode: RentalMode;
  spotNumber?: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  price: number;
  paymentMethod: 'cash' | 'machine' | 'pix' | 'fiado';
  status: RentalStatus;
  notes?: string;
  createdAt: number;
  operatorName?: string;
}

export interface ParkedVehicle {
  id: string;
  type: VehicleType;
  identifier: string; // e.g., license plate or bike description
  ownerName: string;
  cardNumber: string; // Card number corresponding to the parking bay
  checkInTime: number; // timestamp
  checkOutTime?: number;
  status: 'active' | 'completed' | 'stored';
  price?: number;
  paymentMethod?: 'card' | 'cash' | 'postpaid_card' | 'fiado' | 'machine' | 'pix' | 'rental';
  customerCardId?: string;
  rentalId?: string;
  cardLost?: boolean;
  lostCardName?: string;
  lostCardPhone?: string;
  isFiadoPaid?: boolean;
  fiadoPaymentDate?: number;
  fiadoPaidAmount?: number;
  fiadoPaymentMethod?: string;
  // Optional modern fields (used when respective device features are enabled)
  damageNotes?: string;
  photoData?: string;
  operatorName?: string;
  checkOutOperatorName?: string;
  qrCode?: string;
}

export interface Pricing {
  bicycle: number; // per day/overnight
  ebike: number; // per day/overnight
  motorcycle: number; // per day/overnight
  totalSpots?: number; // Total number of spots
  lostCardFee?: number;
  // Optional PIX BRCode settings
  pixKey?: string;
  pixMerchantName?: string;
  pixMerchantCity?: string;
  // Optional Hourly / Fraction / Tolerance settings (active only when enableHourlyPricing is enabled)
  graceMinutes?: number;
  firstHourRate?: number;
  additionalFractionMinutes?: number;
  additionalFractionRate?: number;
  dailyCapHours?: number;
}

export interface Transaction {
  id: string;
  description: string;
  amount: number;
  date: number;
  type: 'expense' | 'income';
  operator?: string;
  category?: string;
  paymentMethod?: string;
  cardId?: string;
  cardNumber?: string;
  ownerName?: string;
  rentalId?: string;
  isFiadoPaid?: boolean;
  fiadoPaidAmount?: number;
  fiadoPaymentDate?: number;
  fiadoPaymentMethod?: string;
  editedAt?: number;
  editedBy?: string;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
}

export interface CustomerCard {
  id: string;
  cardNumber: string;
  ownerName: string;
  phone: string;
  type: 'prepaid' | 'postpaid';
  balance: number; // Positive if prepaid has credits, positive/debt if postpaid
  lastPaymentMethod?: string;
  expirationDate?: string; // YYYY-MM-DD (used when enableCardExpiryAlerts is enabled)
  monthlyFee?: number;
}

export interface Sale {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  totalPrice: number;
  date: number;
  paymentMethod?: 'card' | 'cash' | 'postpaid_card' | 'fiado' | 'machine' | 'pix';
  operatorName?: string;
}

export interface Shift {
  id: string;
  operatorName: string;
  startTime: number;
  endTime?: number;
  initialChange: number;
  finalChange?: number;
  status: 'open' | 'closed';
  summary?: {
    totalIncome: number;
    totalExpense: number;
    totalCash: number;
    totalCard: number;
    totalPix: number;
    totalMachine: number;
    overnightCount: number;
    checkIns?: number;
    checkOuts?: number;
    rentalCheckIns?: number;
    rentalCheckOuts?: number;
    rentalRevenuePaid?: number;
    rentalRevenueFiado?: number;
  };
}

export interface Operator {
  id: string;
  name: string;
  pin?: string; // Optional individual PIN (used when enableOperatorLogin is enabled)
}

export type FinancialScope = 'company' | 'personal';
export type FinancialAccountType = 'cash_drawer' | 'safe' | 'bank' | 'pix' | 'card_machine' | 'other';
export type FinancialEntryType = 'income' | 'expense' | 'transfer';
export type FinancialPaymentMethod = 'cash' | 'pix' | 'machine' | 'bank_transfer' | 'boleto' | 'other';

export interface FinancialAccount {
  id: string;
  name: string;
  type: FinancialAccountType;
  scope: FinancialScope;
  initialBalance: number;
  notes?: string;
  createdAt: number;
}

export interface FinancialOwner {
  id: string;
  name: string;
  color?: 'indigo' | 'rose' | 'amber' | 'teal' | 'violet' | 'slate';
  createdAt: number;
}

export interface FinancialEntry {
  id: string;
  type: FinancialEntryType;
  scope: FinancialScope;
  ownerId?: string;
  ownerName?: string;
  description: string;
  category: string;
  amount: number;
  date: number;
  accountId?: string;
  toAccountId?: string;
  paymentMethod?: FinancialPaymentMethod;
  counterparty?: string;
  payableId?: string;
  notes?: string;
  operator?: string;
  editedAt?: number;
  editedBy?: string;
}

export interface FinancialPayable {
  id: string;
  scope: FinancialScope;
  ownerId?: string;
  ownerName?: string;
  description: string;
  category: string;
  counterparty?: string;
  amount: number;
  dueDate: string; // YYYY-MM-DD
  status: 'pending' | 'paid';
  paidDate?: number;
  paidAmount?: number;
  paidAccountId?: string;
  paidPaymentMethod?: FinancialPaymentMethod;
  recurrence?: 'none' | 'monthly';
  installmentNumber?: number;
  installmentTotal?: number;
  groupId?: string;
  notes?: string;
  createdAt: number;
}

export type FinancialCategoryType = 'expense' | 'income';
export type FinancialCategoryScope = 'company' | 'personal' | 'both';

export interface FinancialCategory {
  id: string;
  name: string;
  type: FinancialCategoryType;
  scope: FinancialCategoryScope;
  deleted?: boolean;
  createdAt: number;
}


