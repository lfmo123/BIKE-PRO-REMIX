import { ParkedVehicle, SpotRental } from '../types';
import { getLocalDateString } from './dateUtils';

export type RentalValidityState = 'active' | 'expiring_soon' | 'expired' | 'upcoming' | 'cancelled';

export interface RentalValidityInfo {
  state: RentalValidityState;
  isValidToday: boolean;
  daysRemaining: number;
  daysOverdue: number;
  label: string;
}

function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y || 1970, (m || 1) - 1, d || 1, 0, 0, 0, 0);
}

export function addDaysToDateStr(dateStr: string, days: number): string {
  const dt = parseLocalDate(dateStr);
  dt.setDate(dt.getDate() + days);
  return getLocalDateString(dt);
}

export function formatDateBr(dateStr?: string): string {
  if (!dateStr || !dateStr.includes('-')) return dateStr || '-';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

export function getRentalValidity(rental: SpotRental, refDateStr = getLocalDateString()): RentalValidityInfo {
  if (rental.status === 'cancelled') {
    return {
      state: 'cancelled',
      isValidToday: false,
      daysRemaining: 0,
      daysOverdue: 0,
      label: 'Cancelado'
    };
  }

  const today = parseLocalDate(refDateStr);
  const start = parseLocalDate(rental.startDate);
  const end = parseLocalDate(rental.endDate);
  const MS_PER_DAY = 24 * 60 * 60 * 1000;

  if (today.getTime() < start.getTime()) {
    const daysUntilStart = Math.ceil((start.getTime() - today.getTime()) / MS_PER_DAY);
    return {
      state: 'upcoming',
      isValidToday: false,
      daysRemaining: Math.ceil((end.getTime() - start.getTime()) / MS_PER_DAY) + 1,
      daysOverdue: 0,
      label: `Inicia em ${daysUntilStart}d`
    };
  }

  if (today.getTime() > end.getTime()) {
    const overdue = Math.ceil((today.getTime() - end.getTime()) / MS_PER_DAY);
    return {
      state: 'expired',
      isValidToday: false,
      daysRemaining: 0,
      daysOverdue: overdue,
      label: `Vencido há ${overdue}d`
    };
  }

  const daysLeft = Math.ceil((end.getTime() - today.getTime()) / MS_PER_DAY);
  if (daysLeft <= 5) {
    return {
      state: 'expiring_soon',
      isValidToday: true,
      daysRemaining: daysLeft,
      daysOverdue: 0,
      label: daysLeft === 0 ? 'Vence hoje' : `Vence em ${daysLeft}d`
    };
  }

  return {
    state: 'active',
    isValidToday: true,
    daysRemaining: daysLeft,
    daysOverdue: 0,
    label: `Vigente (${daysLeft}d)`
  };
}

export function normalizeSpot(spot?: string): string {
  return (spot || '').trim().toUpperCase();
}

export function findFixedRentalForSpot(rentals: SpotRental[], spotNumber: string): SpotRental | undefined {
  const target = normalizeSpot(spotNumber);
  if (!target) return undefined;
  const matches = rentals.filter(
    r => r.status === 'active' && r.mode === 'fixed' && normalizeSpot(r.spotNumber) === target
  );
  if (matches.length === 0) return undefined;
  return matches.sort((a, b) => b.endDate.localeCompare(a.endDate))[0];
}

export function findMatchingRentalForVehicle(
  rentals: SpotRental[],
  vehicle: ParkedVehicle
): SpotRental | undefined {
  if (vehicle.rentalId) {
    const byId = rentals.find(r => r.id === vehicle.rentalId);
    if (byId) return byId;
  }
  return findFixedRentalForSpot(rentals, vehicle.cardNumber);
}
