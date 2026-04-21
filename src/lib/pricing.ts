import { ParkedVehicle, Pricing } from '../types';

function getBilledDays(checkInMs: number, nowMs: number): number {
  const checkInDate = new Date(checkInMs);
  const checkOutDate = new Date(nowMs);

  // Reseta as horas para a meia-noite (00:00:00) na data local em ambos
  const startOfDayCheckIn = new Date(checkInDate.getFullYear(), checkInDate.getMonth(), checkInDate.getDate());
  const startOfDayCheckOut = new Date(checkOutDate.getFullYear(), checkOutDate.getMonth(), checkOutDate.getDate());

  const diffMs = startOfDayCheckOut.getTime() - startOfDayCheckIn.getTime();
  const diffCalendarDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  
  // Uma diária base garantida + 1 para cada meia-noite cruzada
  return diffCalendarDays + 1;
}

export const calculatePrice = (vehicle: ParkedVehicle, pricing: Pricing, now: number) => {
  const billedDays = getBilledDays(vehicle.checkInTime, now);
  const rate = pricing[vehicle.type];
  return billedDays * rate;
};

export const getBilledBreakdown = (vehicle: ParkedVehicle, pricing: Pricing, now: number) => {
  const billedDays = getBilledDays(vehicle.checkInTime, now);
  return { days: billedDays, hours: 0 };
};

export const formatDuration = (checkInTime: number, now: number) => {
  const billedDays = getBilledDays(checkInTime, now);
  const diffMs = now - checkInTime;
  const diffHrs = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  
  const parts = [];
  // Use billedDays - 1 as calendar crossed days visually or just show total billed days
  // User perceives 1 diária as no 'd' typically, but in total days it's better to show explicitly
  if (billedDays > 1) parts.push(`${billedDays} diárias`);
  if (diffHrs > 0 && billedDays === 1) parts.push(`${diffHrs}h`);
  if (billedDays === 1) parts.push(`${diffMins}m`);
  
  return parts.join(' ');
};
