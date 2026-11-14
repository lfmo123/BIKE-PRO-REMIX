import { ParkedVehicle, Pricing } from '../types';

export const calculatePrice = (
  vehicle: ParkedVehicle,
  pricing: Pricing,
  now: number,
  hourlyEnabled = false
) => {
  const diffMs = Math.max(0, now - vehicle.checkInTime);
  const dailyRate = pricing[vehicle.type] || 0;

  let price = 0;

  if (hourlyEnabled) {
    const diffMins = Math.floor(diffMs / 60000);
    const graceMinutes = pricing.graceMinutes ?? 15;
    const firstHourRate =
      pricing.firstHourRate && pricing.firstHourRate > 0
        ? pricing.firstHourRate
        : Math.max(1, Math.round(dailyRate * 0.5));
    const fractionMins = pricing.additionalFractionMinutes && pricing.additionalFractionMinutes > 0
      ? pricing.additionalFractionMinutes
      : 30;
    const fractionRate = pricing.additionalFractionRate ?? 2;
    const dailyCapHours = pricing.dailyCapHours && pricing.dailyCapHours > 0 ? pricing.dailyCapHours : 6;

    if (diffMins <= graceMinutes) {
      price = 0;
    } else if (diffMins <= 60) {
      price = firstHourRate;
    } else {
      const fullDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const remMs = diffMs % (1000 * 60 * 60 * 24);
      const remMins = Math.ceil(remMs / 60000);

      let remCharge = 0;
      if (remMins > 0) {
        if (remMins <= 60) {
          remCharge = firstHourRate;
        } else {
          const extraMins = remMins - 60;
          const extraFractions = Math.ceil(extraMins / fractionMins);
          const calculatedRem = firstHourRate + extraFractions * fractionRate;
          if (remMins >= dailyCapHours * 60 || calculatedRem >= dailyRate) {
            remCharge = dailyRate;
          } else {
            remCharge = calculatedRem;
          }
        }
      }

      if (fullDays === 0) {
        price = Math.min(dailyRate, remCharge);
      } else {
        price = fullDays * dailyRate + remCharge;
      }
    }
  } else {
    // Cálculo padrão original: cobra a cada 24 horas completadas (mínimo 1 diária)
    const billedDays = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    price = billedDays * dailyRate;
  }

  if (vehicle.cardLost && pricing.lostCardFee) {
    price += pricing.lostCardFee;
  }
  return price;
};

export const getBilledBreakdown = (
  vehicle: ParkedVehicle,
  pricing: Pricing,
  now: number,
  hourlyEnabled = false
) => {
  const diffMs = Math.max(0, now - vehicle.checkInTime);
  if (!hourlyEnabled) {
    const billedDays = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    return { days: billedDays, hours: 0, label: `${billedDays} diária${billedDays > 1 ? 's' : ''}` };
  }

  const diffMins = Math.floor(diffMs / 60000);
  const graceMinutes = pricing.graceMinutes ?? 15;
  if (diffMins <= graceMinutes) {
    return { days: 0, hours: 0, label: `Tolerância (${graceMinutes} min)` };
  }

  const totalHours = Math.ceil(diffMs / (1000 * 60 * 60));
  const fullDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const remHours = Math.ceil((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  if (fullDays === 0) {
    return { days: 0, hours: totalHours, label: `${totalHours} hora${totalHours > 1 ? 's' : ''}` };
  }
  return {
    days: fullDays,
    hours: remHours,
    label: `${fullDays} dia${fullDays > 1 ? 's' : ''}${remHours > 0 ? ` + ${remHours}h` : ''}`
  };
};

export const formatDuration = (checkInTime: number, now: number) => {
  const diffMs = Math.max(0, now - checkInTime);
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
