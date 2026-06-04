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
  paymentMethod?: 'card' | 'cash' | 'postpaid_card' | 'fiado' | 'machine';
  cardLost?: boolean;
  lostCardName?: string;
  lostCardPhone?: string;
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
}

export interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
}

export interface Sale {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  totalPrice: number;
  date: number;
  paymentMethod?: 'card' | 'cash' | 'postpaid_card' | 'fiado' | 'machine';
}
