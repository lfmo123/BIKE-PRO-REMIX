import { CustomerCard, ParkedVehicle, SpotRental, Transaction } from '../types';
import { getTransactionPaymentMethod, getTransactionRemainingFiado, isFiadoTransaction, extractCardNumberFromTransaction } from './transactionUtils';
import { isRentalTransaction } from './rentalUtils';

export type CashMethod = 'cash' | 'machine' | 'pix';

export interface UnifiedFiadoItem {
  kind: 'vehicle' | 'transaction';
  key: string;
  id: string;
  title: string;
  clientName: string;
  subtitle: string;
  originTag: 'vehicle' | 'card' | 'rental';
  phone?: string;
  date: number;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  vehicle?: ParkedVehicle;
  transaction?: Transaction;
}

export interface GroupedClientFiado {
  clientKey: string;
  clientName: string;
  phone?: string;
  totalRemaining: number;
  totalOriginal: number;
  totalPaid: number;
  count: number;
  oldestDate: number;
  items: UnifiedFiadoItem[];
}

export interface PeriodFinancialMetrics {
  incomeCash: number;
  incomeMachine: number;
  incomePix: number;
  incomeFiado: number;
  rentalPaidIncome: number;
  rentalFiadoIncome: number;
  rentalCheckoutsCount: number;
  expenseCash: number;
  expenseMachine: number;
  expensePix: number;
  totalIncome: number;
  totalExpense: number;
  balance: number;
  drawerCashNet: number;
  digitalNet: number;
  expensesByCategory: { category: string; amount: number; percent: number }[];
  incomeDistribution: {
    cash: { amount: number; percent: number };
    pix: { amount: number; percent: number };
    machine: { amount: number; percent: number };
  };
}

export interface PeriodComparisonDelta {
  deltaPercent: number | null;
  direction: 'up' | 'down' | 'flat';
  previousValue: number;
}

export function getExpensePaymentMethod(t: Transaction): CashMethod {
  if (t.paymentMethod === 'pix') return 'pix';
  if (t.paymentMethod === 'machine' || t.paymentMethod === 'card') return 'machine';
  if (t.paymentMethod === 'cash') return 'cash';
  const desc = (t.description || '').toUpperCase();
  if (desc.includes('(PIX)')) return 'pix';
  if (desc.includes('(MÁQUINA)') || desc.includes('(MAQUINA)') || desc.includes('(CARTÃO)') || desc.includes('(CARTAO)')) return 'machine';
  return 'cash';
}

export function calculatePeriodFinancialMetrics(
  transactions: Transaction[],
  vehicles: ParkedVehicle[],
  startMs: number,
  endMs: number
): PeriodFinancialMetrics {
  const periodTransactions = transactions.filter(t => t.date >= startMs && t.date <= endMs);
  const periodCheckouts = vehicles.filter(
    v =>
      v.status === 'completed' &&
      !['fiado', 'card', 'postpaid_card', 'rental'].includes(v.paymentMethod || '') &&
      v.checkOutTime &&
      v.checkOutTime >= startMs &&
      v.checkOutTime <= endMs
  );

  let incomeCash = 0;
  let incomeMachine = 0;
  let incomePix = 0;
  let incomeFiado = 0;
  let rentalPaidIncome = 0;
  let rentalFiadoIncome = 0;
  let expenseCash = 0;
  let expenseMachine = 0;
  let expensePix = 0;

  const categoryTotals: Record<string, number> = {};

  periodCheckouts.forEach(v => {
    const p = Number(v.price) || 0;
    if (v.paymentMethod === 'cash') incomeCash += p;
    else if (v.paymentMethod === 'machine') incomeMachine += p;
    else if (v.paymentMethod === 'pix') incomePix += p;
    else incomeCash += p;
  });

  const rentalCheckoutsCount = vehicles.filter(
    v =>
      v.status === 'completed' &&
      v.paymentMethod === 'rental' &&
      v.checkOutTime &&
      v.checkOutTime >= startMs &&
      v.checkOutTime <= endMs
  ).length;

  periodTransactions.forEach(t => {
    const amt = Number(t.amount) || 0;
    if (t.type === 'income') {
      const isRentalTx = isRentalTransaction(t);
      if (isFiadoTransaction(t)) {
        incomeFiado += amt;
        if (isRentalTx) rentalFiadoIncome += amt;
        return;
      }
      if (isRentalTx) rentalPaidIncome += amt;
      const method = getTransactionPaymentMethod(t);
      if (method === 'machine') incomeMachine += amt;
      else if (method === 'pix') incomePix += amt;
      else incomeCash += amt;
    } else if (t.type === 'expense') {
      const method = getExpensePaymentMethod(t);
      if (method === 'pix') expensePix += amt;
      else if (method === 'machine') expenseMachine += amt;
      else expenseCash += amt;

      const cat = (t.category || 'Outros').trim() || 'Outros';
      categoryTotals[cat] = (categoryTotals[cat] || 0) + amt;
    }
  });

  vehicles.forEach(v => {
    if (
      v.status === 'completed' &&
      v.paymentMethod === 'fiado' &&
      v.checkOutTime &&
      v.checkOutTime >= startMs &&
      v.checkOutTime <= endMs
    ) {
      incomeFiado += Number(v.price) || 0;
    }
  });

  const totalIncome = incomeCash + incomeMachine + incomePix;
  const totalExpense = expenseCash + expenseMachine + expensePix;
  const balance = totalIncome - totalExpense;
  const drawerCashNet = incomeCash - expenseCash;
  const digitalNet = incomePix + incomeMachine - (expensePix + expenseMachine);

  const expensesByCategory = Object.entries(categoryTotals)
    .map(([category, amount]) => ({
      category,
      amount,
      percent: totalExpense > 0 ? (amount / totalExpense) * 100 : 0
    }))
    .sort((a, b) => b.amount - a.amount);

  const incomeDistribution = {
    cash: { amount: incomeCash, percent: totalIncome > 0 ? (incomeCash / totalIncome) * 100 : 0 },
    pix: { amount: incomePix, percent: totalIncome > 0 ? (incomePix / totalIncome) * 100 : 0 },
    machine: { amount: incomeMachine, percent: totalIncome > 0 ? (incomeMachine / totalIncome) * 100 : 0 }
  };

  return {
    incomeCash,
    incomeMachine,
    incomePix,
    incomeFiado,
    rentalPaidIncome,
    rentalFiadoIncome,
    rentalCheckoutsCount,
    expenseCash,
    expenseMachine,
    expensePix,
    totalIncome,
    totalExpense,
    balance,
    drawerCashNet,
    digitalNet,
    expensesByCategory,
    incomeDistribution
  };
}

export function calculatePeriodComparison(currentValue: number, previousValue: number): PeriodComparisonDelta {
  if (Math.abs(previousValue) < 0.005) {
    if (Math.abs(currentValue) < 0.005) {
      return { deltaPercent: 0, direction: 'flat', previousValue };
    }
    return {
      deltaPercent: null,
      direction: currentValue > 0 ? 'up' : 'down',
      previousValue
    };
  }
  const delta = ((currentValue - previousValue) / Math.abs(previousValue)) * 100;
  const rounded = Math.round(delta);
  return {
    deltaPercent: rounded,
    direction: rounded > 0 ? 'up' : rounded < 0 ? 'down' : 'flat',
    previousValue
  };
}

export function getDaysPending(timestamp: number, nowMs = Date.now()): number {
  if (!timestamp || timestamp <= 0) return 0;
  const diff = nowMs - timestamp;
  if (diff <= 0) return 0;
  return Math.floor(diff / (24 * 60 * 60 * 1000));
}

export function buildUnifiedUnpaidFiados(
  vehicles: ParkedVehicle[],
  transactions: Transaction[],
  customerCards: CustomerCard[] = [],
  spotRentals: SpotRental[] = []
): UnifiedFiadoItem[] {
  const unpaidVehicleFiados = vehicles.filter(
    v => v.status === 'completed' && v.paymentMethod === 'fiado' && !v.isFiadoPaid
  );
  const unpaidTxFiados = transactions.filter(
    t => isFiadoTransaction(t) && !t.isFiadoPaid && getTransactionRemainingFiado(t) > 0.001
  );

  const vehicleItems: UnifiedFiadoItem[] = unpaidVehicleFiados.map(v => {
    const total = Number(v.price) || 0;
    const paid = Number(v.fiadoPaidAmount) || 0;
    const owner = (v.ownerName || '').trim();
    const matchedCard = customerCards.find(
      c =>
        (v.customerCardId && c.id === v.customerCardId) ||
        (v.cardNumber && c.cardNumber.toLowerCase() === v.cardNumber.toLowerCase())
    );
    return {
      kind: 'vehicle',
      key: `v_${v.id}`,
      id: v.id,
      title: v.identifier || 'Veículo',
      clientName: owner || v.identifier || 'Cliente não identificado',
      subtitle: `${new Date(v.checkOutTime || v.checkInTime || 0).toLocaleDateString('pt-BR')} · ${owner || 'Sem nome'}`,
      originTag: 'vehicle',
      phone: v.lostCardPhone || matchedCard?.phone || undefined,
      date: v.checkOutTime || v.checkInTime || 0,
      totalAmount: total,
      paidAmount: paid,
      remainingAmount: Math.max(0, total - paid),
      vehicle: v
    };
  });

  const txItems: UnifiedFiadoItem[] = unpaidTxFiados.map(t => {
    const total = Number(t.amount) || 0;
    const paid = Number(t.fiadoPaidAmount) || 0;
    const isPostpaid = (t.description || '').toLowerCase().includes('pós-pago');
    const isRentalTx = isRentalTransaction(t);
    const cleanTitle = t.description.replace(/\s*\(FIADO\)\s*/gi, '').trim();

    let resolvedPhone: string | undefined;
    let resolvedOwner = (t.ownerName || '').trim();

    if (isRentalTx) {
      const rental = t.rentalId
        ? spotRentals.find(r => r.id === t.rentalId)
        : spotRentals.find(r => cleanTitle.toLowerCase().includes(r.ownerName.toLowerCase()));
      if (rental) {
        resolvedPhone = rental.phone || undefined;
        if (!resolvedOwner) resolvedOwner = rental.ownerName;
      }
    } else {
      const cardNum = extractCardNumberFromTransaction(t);
      const card = t.cardId
        ? customerCards.find(c => c.id === t.cardId)
        : cardNum
          ? customerCards.find(c => c.cardNumber.toLowerCase() === cardNum.toLowerCase())
          : undefined;
      if (card) {
        resolvedPhone = card.phone || undefined;
        if (!resolvedOwner) resolvedOwner = card.ownerName;
      }
    }

    if (!resolvedOwner) {
      const dashParts = cleanTitle.split(' - ');
      resolvedOwner = dashParts.length > 1 ? dashParts[dashParts.length - 1].trim() : cleanTitle;
    }

    return {
      kind: 'transaction',
      key: `t_${t.id}`,
      id: t.id,
      title: cleanTitle,
      clientName: resolvedOwner || cleanTitle || 'Cliente',
      subtitle: `${new Date(t.date).toLocaleDateString('pt-BR')} · ${
        isRentalTx ? 'Vaga Alugada' : isPostpaid ? 'Cartão Pós-Pago' : 'Cartão Pré-Pago'
      }`,
      originTag: isRentalTx ? 'rental' : 'card',
      phone: resolvedPhone,
      date: t.date,
      totalAmount: total,
      paidAmount: paid,
      remainingAmount: Math.max(0, total - paid),
      transaction: t
    };
  });

  return [...vehicleItems, ...txItems].sort((a, b) => b.date - a.date);
}

export function groupFiadosByClient(items: UnifiedFiadoItem[]): GroupedClientFiado[] {
  const map = new Map<string, GroupedClientFiado>();
  items.forEach(item => {
    const rawName = (item.clientName || 'Sem nome').trim();
    const clientKey = rawName.toLowerCase();
    const existing = map.get(clientKey);
    if (!existing) {
      map.set(clientKey, {
        clientKey,
        clientName: rawName,
        phone: item.phone,
        totalRemaining: item.remainingAmount,
        totalOriginal: item.totalAmount,
        totalPaid: item.paidAmount,
        count: 1,
        oldestDate: item.date,
        items: [item]
      });
    } else {
      existing.totalRemaining += item.remainingAmount;
      existing.totalOriginal += item.totalAmount;
      existing.totalPaid += item.paidAmount;
      existing.count += 1;
      existing.oldestDate = Math.min(existing.oldestDate, item.date);
      if (!existing.phone && item.phone) existing.phone = item.phone;
      existing.items.push(item);
    }
  });
  return Array.from(map.values()).sort((a, b) => b.totalRemaining - a.totalRemaining);
}
