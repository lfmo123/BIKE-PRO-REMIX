import {
  FinancialAccount,
  FinancialCategory,
  FinancialCategoryType,
  FinancialEntry,
  FinancialOwner,
  FinancialPayable,
  FinancialScope,
  ParkedVehicle,
  Transaction
} from '../types';
import { getLocalDateString } from './dateUtils';
import { calculatePeriodFinancialMetrics } from './cashbookUtils';

export const COMPANY_EXPENSE_CATEGORIES = [
  'Aluguel do Ponto',
  'Energia Elétrica',
  'Água / Saneamento',
  'Internet / Telefone',
  'Salários / Diárias',
  'Manutenção / Reformas',
  'Materiais / Suprimentos',
  'Impostos / Taxas',
  'Fornecedores / Estoque',
  'Marketing / Placas',
  'Outros (Empresa)'
];

export const COMPANY_INCOME_CATEGORIES = [
  'Receita Extra',
  'Sublocação / Parceria',
  'Aporte de Capital',
  'Reembolso / Estorno',
  'Rendimentos',
  'Outros (Empresa)'
];

export const PERSONAL_EXPENSE_CATEGORIES = [
  'Mercado / Alimentação',
  'Moradia / Casa',
  'Saúde / Farmácia',
  'Educação / Escola',
  'Transporte / Combustível',
  'Cartão de Crédito',
  'Lazer / Viagem',
  'Vestuário / Compras',
  'Retirada / Pró-labore',
  'Outros (Particular)'
];

export const PERSONAL_INCOME_CATEGORIES = [
  'Pró-labore / Retirada',
  'Renda Extra',
  'Reembolso',
  'Outros (Particular)'
];

export const DEFAULT_FINANCIAL_CATEGORIES: FinancialCategory[] = [
  ...COMPANY_EXPENSE_CATEGORIES.map((name, i) => ({
    id: `def_exp_company_${i}`,
    name,
    type: 'expense' as const,
    scope: 'company' as const,
    createdAt: i + 1
  })),
  ...COMPANY_INCOME_CATEGORIES.map((name, i) => ({
    id: `def_inc_company_${i}`,
    name,
    type: 'income' as const,
    scope: 'company' as const,
    createdAt: 100 + i + 1
  })),
  ...PERSONAL_EXPENSE_CATEGORIES.map((name, i) => ({
    id: `def_exp_personal_${i}`,
    name,
    type: 'expense' as const,
    scope: 'personal' as const,
    createdAt: 200 + i + 1
  })),
  ...PERSONAL_INCOME_CATEGORIES.map((name, i) => ({
    id: `def_inc_personal_${i}`,
    name,
    type: 'income' as const,
    scope: 'personal' as const,
    createdAt: 300 + i + 1
  }))
];

export function resolveEffectiveCategories(storedCategories: FinancialCategory[] = []): FinancialCategory[] {
  const byId = new Map<string, FinancialCategory>();
  DEFAULT_FINANCIAL_CATEGORIES.forEach(cat => byId.set(cat.id, { ...cat }));

  storedCategories.forEach(item => {
    if (!item || !item.id) return;
    if (item.deleted) {
      byId.delete(item.id);
    } else if (item.name && item.name.trim()) {
      byId.set(item.id, {
        ...item,
        name: item.name.trim(),
        type: item.type === 'income' ? 'income' : 'expense',
        scope: item.scope === 'personal' || item.scope === 'both' ? item.scope : 'company'
      });
    }
  });

  return Array.from(byId.values()).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
}

export function getCategoryNamesFor(
  categories: FinancialCategory[],
  type: FinancialCategoryType,
  scope: FinancialScope
): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  categories.forEach(cat => {
    if (cat.deleted) return;
    if (cat.type !== type) return;
    if (cat.scope !== scope && cat.scope !== 'both') return;
    const clean = cat.name.trim();
    const key = clean.toLowerCase();
    if (clean && !seen.has(key)) {
      seen.add(key);
      names.push(clean);
    }
  });
  return names.length > 0 ? names : ['Outros'];
}

export const ACCOUNT_TYPE_LABELS: Record<FinancialAccount['type'], string> = {
  cash_drawer: 'Caixa / Gaveta',
  safe: 'Cofre',
  bank: 'Conta Bancária',
  pix: 'Conta Digital / PIX',
  card_machine: 'Recebíveis Maquininha',
  other: 'Outra Carteira'
};

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'Dinheiro',
  pix: 'PIX',
  machine: 'Cartão / Máquina',
  bank_transfer: 'Transferência / TED',
  boleto: 'Boleto',
  other: 'Outro'
};

export function addMonthsToDateStr(dateStr: string, monthsToAdd: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const year = y || new Date().getFullYear();
  const monthIdx = (m || 1) - 1 + monthsToAdd;
  const targetYear = year + Math.floor(monthIdx / 12);
  const normalizedMonth = ((monthIdx % 12) + 12) % 12;
  const lastDayOfTargetMonth = new Date(targetYear, normalizedMonth + 1, 0).getDate();
  const clampedDay = Math.min(d || 1, lastDayOfTargetMonth);
  const result = new Date(targetYear, normalizedMonth, clampedDay);
  return getLocalDateString(result);
}

export function formatDateBrShort(dateStr?: string): string {
  if (!dateStr || !dateStr.includes('-')) return dateStr || '-';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

export interface PayableStatusInfo {
  state: 'paid' | 'overdue' | 'due_today' | 'due_soon' | 'upcoming';
  daysDiff: number;
  label: string;
}

export function getPayableStatusInfo(payable: FinancialPayable, todayStr = getLocalDateString()): PayableStatusInfo {
  if (payable.status === 'paid') {
    return { state: 'paid', daysDiff: 0, label: 'Paga' };
  }
  const [ty, tm, td] = todayStr.split('-').map(Number);
  const [dy, dm, dd] = (payable.dueDate || todayStr).split('-').map(Number);
  const todayMs = new Date(ty, (tm || 1) - 1, td || 1).getTime();
  const dueMs = new Date(dy, (dm || 1) - 1, dd || 1).getTime();
  const diffDays = Math.round((dueMs - todayMs) / (24 * 60 * 60 * 1000));

  if (diffDays < 0) {
    const overdue = Math.abs(diffDays);
    return { state: 'overdue', daysDiff: diffDays, label: `Vencida há ${overdue}d` };
  }
  if (diffDays === 0) {
    return { state: 'due_today', daysDiff: 0, label: 'Vence hoje' };
  }
  if (diffDays <= 5) {
    return { state: 'due_soon', daysDiff: diffDays, label: `Vence em ${diffDays}d` };
  }
  return { state: 'upcoming', daysDiff: diffDays, label: `Em ${diffDays}d` };
}

export interface ComputedAccountBalance {
  account: FinancialAccount;
  inflows: number;
  outflows: number;
  transfersIn: number;
  transfersOut: number;
  currentBalance: number;
}

export function computeAccountBalances(
  accounts: FinancialAccount[],
  entries: FinancialEntry[]
): ComputedAccountBalance[] {
  const map = new Map<string, ComputedAccountBalance>();
  accounts.forEach(acc => {
    map.set(acc.id, {
      account: acc,
      inflows: 0,
      outflows: 0,
      transfersIn: 0,
      transfersOut: 0,
      currentBalance: Number(acc.initialBalance) || 0
    });
  });

  entries.forEach(entry => {
    const amt = Number(entry.amount) || 0;
    if (amt <= 0) return;
    if (entry.type === 'income' && entry.accountId) {
      const target = map.get(entry.accountId);
      if (target) {
        target.inflows += amt;
        target.currentBalance += amt;
      }
    } else if (entry.type === 'expense' && entry.accountId) {
      const target = map.get(entry.accountId);
      if (target) {
        target.outflows += amt;
        target.currentBalance -= amt;
      }
    } else if (entry.type === 'transfer') {
      if (entry.accountId) {
        const from = map.get(entry.accountId);
        if (from) {
          from.transfersOut += amt;
          from.currentBalance -= amt;
        }
      }
      if (entry.toAccountId) {
        const to = map.get(entry.toAccountId);
        if (to) {
          to.transfersIn += amt;
          to.currentBalance += amt;
        }
      }
    }
  });

  return Array.from(map.values());
}

export interface OwnerSpendingSummary {
  ownerKey: string;
  ownerId?: string;
  ownerName: string;
  spent: number;
  income: number;
  pendingPayables: number;
}

export interface FinancePeriodSummary {
  companyParkingRevenue: number;
  companyManualIncome: number;
  companyTotalIncome: number;
  companyExpenses: number;
  companyOperationalProfit: number;
  personalIncome: number;
  personalExpenses: number;
  personalByOwner: OwnerSpendingSummary[];
  transfersTotal: number;
  pendingPayablesCompany: number;
  pendingPayablesPersonal: number;
  pendingPayablesTotal: number;
  overduePayablesCount: number;
  dueTodayPayablesCount: number;
  totalAccountsBalance: number;
  projectedBalanceAfterPayables: number;
  expensesByCategory: { category: string; amount: number; percent: number }[];
}

export function computeFinancePeriodSummary(params: {
  accounts: FinancialAccount[];
  owners: FinancialOwner[];
  entries: FinancialEntry[];
  payables: FinancialPayable[];
  transactions: Transaction[];
  vehicles: ParkedVehicle[];
  startMs: number;
  endMs: number;
  startDateStr: string;
  endDateStr: string;
  includeParkingRevenue: boolean;
  scopeFilter: 'all' | FinancialScope;
  ownerFilter: string; // 'all' or ownerId/name
  todayStr?: string;
}): FinancePeriodSummary {
  const todayStr = params.todayStr || getLocalDateString();
  const periodEntries = params.entries.filter(e => e.date >= params.startMs && e.date <= params.endMs);

  // Operational revenue from parking/store/rentals (strictly paid incomes, zero expense duplication)
  const parkingMetrics = params.includeParkingRevenue
    ? calculatePeriodFinancialMetrics(params.transactions, params.vehicles, params.startMs, params.endMs)
    : null;
  const companyParkingRevenue = parkingMetrics ? parkingMetrics.totalIncome : 0;

  let companyManualIncome = 0;
  let companyExpenses = 0;
  let personalIncome = 0;
  let personalExpenses = 0;
  let transfersTotal = 0;

  const ownerMap = new Map<string, OwnerSpendingSummary>();
  params.owners.forEach(o => {
    ownerMap.set(o.id, {
      ownerKey: o.id,
      ownerId: o.id,
      ownerName: o.name,
      spent: 0,
      income: 0,
      pendingPayables: 0
    });
  });

  const ensureOwnerBucket = (ownerId?: string, ownerName?: string): OwnerSpendingSummary => {
    const cleanName = (ownerName || 'Sem titular').trim() || 'Sem titular';
    const key = ownerId && ownerMap.has(ownerId) ? ownerId : `name_${cleanName.toLowerCase()}`;
    let bucket = ownerMap.get(key);
    if (!bucket) {
      bucket = {
        ownerKey: key,
        ownerId,
        ownerName: cleanName,
        spent: 0,
        income: 0,
        pendingPayables: 0
      };
      ownerMap.set(key, bucket);
    }
    return bucket;
  };

  const categoryTotals: Record<string, number> = {};
  let filteredExpensesTotal = 0;

  periodEntries.forEach(entry => {
    const amt = Number(entry.amount) || 0;
    if (entry.type === 'transfer') {
      transfersTotal += amt;
      return;
    }

    if (entry.scope === 'company') {
      if (entry.type === 'income') companyManualIncome += amt;
      else if (entry.type === 'expense') companyExpenses += amt;
    } else {
      const bucket = ensureOwnerBucket(entry.ownerId, entry.ownerName);
      if (entry.type === 'income') {
        personalIncome += amt;
        bucket.income += amt;
      } else if (entry.type === 'expense') {
        personalExpenses += amt;
        bucket.spent += amt;
      }
    }

    // Category chart respects active scope/owner filter
    if (entry.type === 'expense') {
      const matchesScope = params.scopeFilter === 'all' || entry.scope === params.scopeFilter;
      const matchesOwner =
        params.scopeFilter !== 'personal' ||
        params.ownerFilter === 'all' ||
        entry.ownerId === params.ownerFilter ||
        (entry.ownerName || '').toLowerCase() === params.ownerFilter.toLowerCase();

      if (matchesScope && matchesOwner) {
        const cat = (entry.category || 'Outros').trim() || 'Outros';
        categoryTotals[cat] = (categoryTotals[cat] || 0) + amt;
        filteredExpensesTotal += amt;
      }
    }
  });

  let pendingPayablesCompany = 0;
  let pendingPayablesPersonal = 0;
  let overduePayablesCount = 0;
  let dueTodayPayablesCount = 0;

  params.payables.forEach(p => {
    if (p.status !== 'pending') return;
    const amt = Number(p.amount) || 0;
    const info = getPayableStatusInfo(p, todayStr);
    if (info.state === 'overdue') overduePayablesCount += 1;
    if (info.state === 'due_today') dueTodayPayablesCount += 1;

    // Count in period if dueDate <= endDateStr (includes overdue + due within period)
    if (!p.dueDate || p.dueDate <= params.endDateStr) {
      if (p.scope === 'company') {
        pendingPayablesCompany += amt;
      } else {
        pendingPayablesPersonal += amt;
        const bucket = ensureOwnerBucket(p.ownerId, p.ownerName);
        bucket.pendingPayables += amt;
      }
    }
  });

  const accountBalances = computeAccountBalances(params.accounts, params.entries);
  const totalAccountsBalance = accountBalances.reduce((acc, item) => acc + item.currentBalance, 0);
  const pendingPayablesTotal = pendingPayablesCompany + pendingPayablesPersonal;
  const companyTotalIncome = companyParkingRevenue + companyManualIncome;
  const companyOperationalProfit = companyTotalIncome - companyExpenses;

  const personalByOwner = Array.from(ownerMap.values())
    .filter(o => o.spent > 0 || o.income > 0 || o.pendingPayables > 0 || Boolean(o.ownerId))
    .sort((a, b) => b.spent - a.spent);

  const expensesByCategory = Object.entries(categoryTotals)
    .map(([category, amount]) => ({
      category,
      amount,
      percent: filteredExpensesTotal > 0 ? (amount / filteredExpensesTotal) * 100 : 0
    }))
    .sort((a, b) => b.amount - a.amount);

  return {
    companyParkingRevenue,
    companyManualIncome,
    companyTotalIncome,
    companyExpenses,
    companyOperationalProfit,
    personalIncome,
    personalExpenses,
    personalByOwner,
    transfersTotal,
    pendingPayablesCompany,
    pendingPayablesPersonal,
    pendingPayablesTotal,
    overduePayablesCount,
    dueTodayPayablesCount,
    totalAccountsBalance,
    projectedBalanceAfterPayables: totalAccountsBalance - pendingPayablesTotal,
    expensesByCategory
  };
}
