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
  paymentMethod?: 'pix' | 'card' | 'cash' | 'postpaid_card';
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
