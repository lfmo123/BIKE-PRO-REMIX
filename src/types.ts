export type VehicleType = 'bicycle' | 'ebike' | 'motorcycle';

export interface LostCard {
  cardNumber: string;
  name?: string;
  phone?: string;
  date?: number;
}

export interface ParkedVehicle {
  id: string;
  type: VehicleType;
  identifier: string; // e.g., license plate or bike description
  ownerName: string;
  cardNumber: string; // Card number corresponding to the parking bay
  checkInTime: number; // timestamp
  checkOutTime?: number;
  status: 'active' | 'completed';
  price?: number;
  paymentMethod?: 'card' | 'cash' | 'postpaid_card' | 'fiado' | 'machine' | 'pix';
  cardLost?: boolean;
  lostCardName?: string;
  lostCardPhone?: string;
  isFiadoPaid?: boolean;
  fiadoPaymentDate?: number;
  fiadoPaidAmount?: number;
  fiadoPaymentMethod?: string;
}

export interface Pricing {
  bicycle: number; // per day/overnight
  ebike: number; // per day/overnight
  motorcycle: number; // per day/overnight
  totalSpots?: number; // Total number of spots
  lostCardFee?: number;
}

export interface Transaction {
  id: string;
  description: string;
  amount: number;
  date: number;
  type: 'expense' | 'income';
  operator?: string;
  category?: string;
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
  balance: number; // Positive if prepaid has credits, negative if postpaid has debt
  lastPaymentMethod?: string;
}

export interface Sale {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  totalPrice: number;
  date: number;
  paymentMethod?: 'card' | 'cash' | 'postpaid_card' | 'fiado' | 'machine' | 'pix';
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
  };
}

export interface Operator {
  id: string;
  name: string;
}
