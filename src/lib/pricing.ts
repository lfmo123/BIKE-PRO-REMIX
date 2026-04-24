import { ParkedVehicle, Pricing } from '../types';

export const calculatePrice = (vehicle: ParkedVehicle, pricing: Pricing, now: number) => {
  const diffMs = now - vehicle.checkInTime;
  // Cobre a cada 24 horas completadas (Mínimo 1 diária)
  const billedDays = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  const rate = pricing[vehicle.type] || 0;
  let price = billedDays * rate;
  if (vehicle.cardLost && pricing.lostCardFee) {
    price += pricing.lostCardFee;
  }
  return price;
};

export const getBilledBreakdown = (vehicle: ParkedVehicle, pricing: Pricing, now: number) => {
  const diffMs = now - vehicle.checkInTime;
  const billedDays = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  return { days: billedDays, hours: 0 };
};

export const formatDuration = (checkInTime: number, now: number) => {
  const diffMs = now - checkInTime;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHrs = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  
  const parts = [];
  if (diffDays > 0) {
    parts.push(`${diffDays}d`);
  }
  if (diffHrs > 0 || diffDays > 0) parts.push(`${diffHrs}h`);
  parts.push(`${diffMins}m`);
  
  return parts.join(' ');
};
