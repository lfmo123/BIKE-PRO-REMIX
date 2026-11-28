import React, { useEffect, useMemo, useState } from 'react';
import { CustomerCard, ParkedVehicle, Shift, SpotRental, Transaction } from '../types';
import {
  Wallet,
  Landmark,
  ArrowUpRight,
  ArrowDownRight,
  Trash2,
  Calendar,
  AlertTriangle,
  FileText,
  Search,
  Clock,
  Filter,
  RotateCcw,
  Printer,
  Download,
  MessageCircle,
  Pencil,
  Check,
  X,
  TrendingUp,
  TrendingDown,
  Minus,
  Layers,
  UserCheck
} from 'lucide-react';
import { getLocalDateString } from '../lib/dateUtils';
import { DailyReportModal } from './DailyReportModal';
import { FiadoSearchModal } from './FiadoSearchModal';
import { CashBookDrawerPanel } from './CashBookDrawerPanel';
import { CashBookAnalyticsPanel } from './CashBookAnalyticsPanel';
import { CashBookFiadoCard } from './CashBookFiadoCard';
import { DeviceFeaturesConfig } from '../lib/deviceModules';
import { exportToCsv } from '../lib/csvExport';
import { buildCashbookSummaryWhatsappText, openWhatsappMessage } from '../lib/whatsappUtils';
import { isFiadoTransaction, getTransactionPaymentMethod } from '../lib/transactionUtils';
import { isRentalTransaction } from '../lib/rentalUtils';
import {
  buildUnifiedUnpaidFiados,
  calculatePeriodComparison,
  calculatePeriodFinancialMetrics,
  CashMethod,
  getExpensePaymentMethod,
  PeriodComparisonDelta
} from '../lib/cashbookUtils';

interface CashBookProps {
  transactions: Transaction[];
  vehicles: ParkedVehicle[];
  shifts?: Shift[];
  customerCards?: CustomerCard[];
  spotRentals?: SpotRental[];
  activeOperator?: string;
  deviceConfig?: DeviceFeaturesConfig;
  onAddTransaction: (transaction: Omit<Transaction, 'id'>) => Promise<void>;
  onUpdateTransaction?: (id: string, data: Partial<Transaction>) => Promise<void>;
  onDeleteTransaction: (id: string) => Promise<void>;
  onPayFiado: (id: string, paymentMethod: string, amount: number, observation?: string) => Promise<void>;
  onPayFiadoTransaction?: (id: string, paymentMethod: string, amount: number, observation?: string) => Promise<void>;
  onOpenFinance?: () => void;
}

const EXPENSE_CATEGORIES = ['Manutenção', 'Materiais', 'Pagamento', 'Retirada', 'Ajuste de Caixa', 'Outros'];
const INCOME_CATEGORIES = ['Suprimento (Troco)', 'Receita Extra', 'Ajuste de Caixa', 'Outros'];

function formatTimeHM(timestamp: number): string {
  const dt = new Date(timestamp);
  const hh = String(dt.getHours()).padStart(2, '0');
  const mm = String(dt.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function getMethodLabel(method?: string): string {
  if (method === 'cash') return 'Dinheiro';
  if (method === 'pix') return 'PIX';
  if (method === 'machine' || method === 'card') return 'Máquina';
  if (method === 'rental') return 'Vaga Alugada';
  if (method === 'fiado') return 'Fiado';
  return 'Dinheiro';
}

interface CombinedLedgerEntry {
  id: string;
  description: string;
  amount: number;
  date: number;
  type: 'income' | 'expense';
  operator?: string;
  category?: string;
  paymentMethod: 'cash' | 'pix' | 'machine' | 'rental' | 'fiado';
  isManual: boolean;
  isFiadoEntry: boolean;
  isFiadoPaid: boolean;
  isRentalEntry: boolean;
  editedBy?: string;
  runningBalance?: number;
}

export function CashBook({
  transactions,
  vehicles,
  shifts = [],
  customerCards = [],
  spotRentals = [],
  activeOperator,
  deviceConfig,
  onAddTransaction,
  onUpdateTransaction,
  onDeleteTransaction,
  onPayFiado,
  onPayFiadoTransaction,
  onOpenFinance
}: CashBookProps) {
  const canManageCashbook = deviceConfig?.canManageCashbook !== false;
  const enableDrawer = Boolean(deviceConfig?.enableCashbookDrawer);
  const enableSmartLedger = Boolean(deviceConfig?.enableCashbookSmartLedger);
  const enableAnalytics = Boolean(deviceConfig?.enableCashbookAnalytics);
  const enableFinanceModule = Boolean(deviceConfig?.enableFinanceModule);

  // Date and Time Range State
  const todayStr = getLocalDateString();
  const [startDate, setStartDate] = useState<string>(todayStr);
  const [startTime, setStartTime] = useState<string>('00:00');
  const [endDate, setEndDate] = useState<string>(todayStr);
  const [endTime, setEndTime] = useState<string>('23:59');
  const [selectedShiftId, setSelectedShiftId] = useState<string>('');

  // Modals
  const [isDailyReportOpen, setIsDailyReportOpen] = useState(false);
  const [isFiadoSearchOpen, setIsFiadoSearchOpen] = useState(false);

  // Smart Ledger Filters State
  const [ledgerSearch, setLedgerSearch] = useState('');
  const [ledgerTypeFilter, setLedgerTypeFilter] = useState<'all' | 'income' | 'expense' | 'fiado'>('all');
  const [ledgerMethodFilter, setLedgerMethodFilter] = useState<'all' | 'cash' | 'pix' | 'machine' | 'rental'>('all');
  const [ledgerCategoryFilter, setLedgerCategoryFilter] = useState<string>('all');
  const [ledgerOperatorFilter, setLedgerOperatorFilter] = useState<string>('all');
  const [groupByDay, setGroupByDay] = useState<boolean>(false);

  // Inline Edit & Safe Delete State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDesc, setEditDesc] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editCategory, setEditCategory] = useState('Outros');
  const [editType, setEditType] = useState<'income' | 'expense'>('expense');
  const [editPaymentMethod, setEditPaymentMethod] = useState<CashMethod>('cash');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Auto toggle groupByDay when date range changes
  useEffect(() => {
    setGroupByDay(startDate !== endDate);
  }, [startDate, endDate]);

  // Derive Period Timestamps
  const startOfPeriod = useMemo(() => {
    if (!startDate) return 0;
    const [y, m, d] = startDate.split('-').map(Number);
    const [h, min] = (startTime || '00:00').split(':').map(Number);
    return new Date(y, m - 1, d, h || 0, min || 0, 0, 0).getTime();
  }, [startDate, startTime]);

  const endOfPeriod = useMemo(() => {
    if (!endDate) return Date.now();
    const [y, m, d] = endDate.split('-').map(Number);
    const [h, min] = (endTime || '23:59').split(':').map(Number);
    return new Date(y, m - 1, d, h || 23, min || 59, 59, 999).getTime();
  }, [endDate, endTime]);

  const activeShift = shifts.find(s => s.status === 'open');
  const currentOperatorName = activeOperator || activeShift?.operatorName || 'Admin';

  // Preset Handlers
  const handlePreset = (preset: 'today' | 'yesterday' | 'last7' | 'thisMonth' | 'all' | 'currentShift') => {
    const now = new Date();
    const today = getLocalDateString(now);
    setSelectedShiftId('');
    if (preset === 'today') {
      setStartDate(today);
      setStartTime('00:00');
      setEndDate(today);
      setEndTime('23:59');
    } else if (preset === 'yesterday') {
      const yest = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      const yestStr = getLocalDateString(yest);
      setStartDate(yestStr);
      setStartTime('00:00');
      setEndDate(yestStr);
      setEndTime('23:59');
    } else if (preset === 'last7') {
      const d7 = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
      setStartDate(getLocalDateString(d7));
      setStartTime('00:00');
      setEndDate(today);
      setEndTime('23:59');
    } else if (preset === 'thisMonth') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      setStartDate(getLocalDateString(firstDay));
      setStartTime('00:00');
      setEndDate(today);
      setEndTime('23:59');
    } else if (preset === 'all') {
      setStartDate('2020-01-01');
      setStartTime('00:00');
      setEndDate(today);
      setEndTime('23:59');
    } else if (preset === 'currentShift' && activeShift) {
      setSelectedShiftId(activeShift.id);
      setStartDate(getLocalDateString(new Date(activeShift.startTime)));
      setStartTime(formatTimeHM(activeShift.startTime));
      setEndDate(today);
      setEndTime('23:59');
    }
  };

  const handleSelectShift = (shiftId: string) => {
    setSelectedShiftId(shiftId);
    if (!shiftId) {
      handlePreset('today');
      return;
    }
    const shift = shifts.find(s => s.id === shiftId);
    if (!shift) return;
    const endMs = shift.endTime || Date.now();
    setStartDate(getLocalDateString(new Date(shift.startTime)));
    setStartTime(formatTimeHM(shift.startTime));
    setEndDate(getLocalDateString(new Date(endMs)));
    setEndTime(shift.endTime ? formatTimeHM(shift.endTime) : '23:59');
  };

  // Financial Metrics (current period)
  const metrics = useMemo(
    () => calculatePeriodFinancialMetrics(transactions, vehicles, startOfPeriod, endOfPeriod),
    [transactions, vehicles, startOfPeriod, endOfPeriod]
  );

  // Previous equivalent period comparison (for Analytics module)
  const comparison = useMemo(() => {
    if (!enableAnalytics || startDate === '2020-01-01') return null;
    const duration = Math.max(60 * 1000, endOfPeriod - startOfPeriod);
    const prevEnd = startOfPeriod - 1;
    const prevStart = prevEnd - duration;
    const prevMetrics = calculatePeriodFinancialMetrics(transactions, vehicles, prevStart, prevEnd);
    return {
      income: calculatePeriodComparison(metrics.totalIncome, prevMetrics.totalIncome),
      expense: calculatePeriodComparison(metrics.totalExpense, prevMetrics.totalExpense),
      balance: calculatePeriodComparison(metrics.balance, prevMetrics.balance)
    };
  }, [enableAnalytics, startDate, startOfPeriod, endOfPeriod, transactions, vehicles, metrics]);

  // Unified unpaid fiados
  const unpaidFiados = useMemo(
    () => buildUnifiedUnpaidFiados(vehicles, transactions, customerCards, spotRentals),
    [vehicles, transactions, customerCards, spotRentals]
  );

  const totalPendingFiado = useMemo(
    () => unpaidFiados.reduce((acc, item) => acc + item.remainingAmount, 0),
    [unpaidFiados]
  );

  // Build combined ledger entries
  const baseEntries: CombinedLedgerEntry[] = useMemo(() => {
    const periodTransactions = transactions.filter(t => t.date >= startOfPeriod && t.date <= endOfPeriod);
    const periodCheckouts = vehicles.filter(
      v =>
        v.status === 'completed' &&
        !['fiado', 'card', 'postpaid_card', 'rental'].includes(v.paymentMethod || '') &&
        v.checkOutTime &&
        v.checkOutTime >= startOfPeriod &&
        v.checkOutTime <= endOfPeriod
    );

    const rentalCheckouts =
      enableSmartLedger && ledgerMethodFilter === 'rental'
        ? vehicles.filter(
            v =>
              v.status === 'completed' &&
              v.paymentMethod === 'rental' &&
              v.checkOutTime &&
              v.checkOutTime >= startOfPeriod &&
              v.checkOutTime <= endOfPeriod
          )
        : [];

    const txEntries: CombinedLedgerEntry[] = periodTransactions.map(t => {
      const fiadoEntry = isFiadoTransaction(t);
      const method =
        t.type === 'expense'
          ? getExpensePaymentMethod(t)
          : fiadoEntry
            ? 'fiado'
            : getTransactionPaymentMethod(t);
      return {
        id: t.id,
        description: t.description,
        amount: Number(t.amount) || 0,
        date: t.date,
        type: t.type,
        operator: t.operator,
        category: t.category,
        paymentMethod: method,
        isManual: true,
        isFiadoEntry: fiadoEntry,
        isFiadoPaid: Boolean(t.isFiadoPaid),
        isRentalEntry: isRentalTransaction(t),
        editedBy: t.editedBy
      };
    });

    const checkoutEntries: CombinedLedgerEntry[] = [...periodCheckouts, ...rentalCheckouts].map(v => {
      const pm =
        v.paymentMethod === 'machine'
          ? 'machine'
          : v.paymentMethod === 'pix'
            ? 'pix'
            : v.paymentMethod === 'rental'
              ? 'rental'
              : 'cash';
      return {
        id: v.id,
        description: `Check-out: ${v.identifier} (${
          v.paymentMethod === 'machine'
            ? 'MÁQUINA'
            : v.paymentMethod === 'card'
              ? 'PRÉ PAGO'
              : v.paymentMethod === 'cash'
                ? 'DINHEIRO'
                : v.paymentMethod === 'postpaid_card'
                  ? 'PÓS-PAGO'
                  : v.paymentMethod === 'rental'
                    ? 'VAGA ALUGADA'
                    : v.paymentMethod?.toUpperCase() || 'N/A'
        })`,
        amount: Number(v.price) || 0,
        date: v.checkOutTime || 0,
        type: 'income',
        operator: v.checkOutOperatorName || v.operatorName,
        category: v.paymentMethod === 'rental' ? 'Vaga Alugada' : 'Estacionamento',
        paymentMethod: pm,
        isManual: false,
        isFiadoEntry: false,
        isFiadoPaid: false,
        isRentalEntry: v.paymentMethod === 'rental'
      };
    });

    return [...txEntries, ...checkoutEntries].sort((a, b) => b.date - a.date);
  }, [transactions, vehicles, startOfPeriod, endOfPeriod, enableSmartLedger, ledgerMethodFilter]);

  // Distinct categories and operators for Smart Ledger filters
  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    baseEntries.forEach(e => {
      if (e.category) set.add(e.category);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [baseEntries]);

  const availableOperators = useMemo(() => {
    const set = new Set<string>();
    baseEntries.forEach(e => {
      if (e.operator) set.add(e.operator);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [baseEntries]);

  // Apply Smart Ledger filters + compute running balance chronologically
  const displayEntries: CombinedLedgerEntry[] = useMemo(() => {
    let list = baseEntries;
    if (enableSmartLedger) {
      const q = ledgerSearch.trim().toLowerCase();
      list = baseEntries.filter(entry => {
        if (q) {
          const hay = `${entry.description} ${entry.category || ''} ${entry.operator || ''} ${getMethodLabel(entry.paymentMethod)}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        if (ledgerTypeFilter === 'income' && (entry.type !== 'income' || entry.isFiadoEntry)) return false;
        if (ledgerTypeFilter === 'expense' && entry.type !== 'expense') return false;
        if (ledgerTypeFilter === 'fiado' && !entry.isFiadoEntry) return false;

        if (ledgerMethodFilter !== 'all') {
          if (ledgerMethodFilter === 'rental') {
            if (!entry.isRentalEntry && entry.paymentMethod !== 'rental') return false;
          } else if (entry.paymentMethod !== ledgerMethodFilter) {
            return false;
          }
        }

        if (ledgerCategoryFilter !== 'all' && (entry.category || '') !== ledgerCategoryFilter) return false;
        if (ledgerOperatorFilter !== 'all' && (entry.operator || '') !== ledgerOperatorFilter) return false;

        return true;
      });

      // Running balance calculated oldest -> newest
      const asc = [...list].sort((a, b) => a.date - b.date);
      let running = 0;
      const balanceMap = new Map<string, number>();
      asc.forEach(entry => {
        if (!entry.isFiadoEntry) {
          running += entry.type === 'income' ? entry.amount : -entry.amount;
        }
        balanceMap.set(`${entry.id}_${entry.date}`, running);
      });

      return list.map(entry => ({
        ...entry,
        runningBalance: balanceMap.get(`${entry.id}_${entry.date}`) ?? 0
      }));
    }
    return list;
  }, [
    baseEntries,
    enableSmartLedger,
    ledgerSearch,
    ledgerTypeFilter,
    ledgerMethodFilter,
    ledgerCategoryFilter,
    ledgerOperatorFilter
  ]);

  // Group entries by calendar day when Smart Ledger + groupByDay active
  const groupedByDay = useMemo(() => {
    if (!enableSmartLedger || !groupByDay) return null;
    const groups: {
      dateKey: string;
      label: string;
      income: number;
      expense: number;
      entries: CombinedLedgerEntry[];
    }[] = [];
    const indexMap = new Map<string, number>();

    displayEntries.forEach(entry => {
      const dt = new Date(entry.date);
      const dateKey = getLocalDateString(dt);
      let idx = indexMap.get(dateKey);
      if (idx === undefined) {
        idx = groups.length;
        indexMap.set(dateKey, idx);
        const weekday = dt.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
        const formatted = dt.toLocaleDateString('pt-BR');
        groups.push({
          dateKey,
          label: `${weekday.charAt(0).toUpperCase() + weekday.slice(1)}, ${formatted}`,
          income: 0,
          expense: 0,
          entries: []
        });
      }
      const grp = groups[idx];
      grp.entries.push(entry);
      if (!entry.isFiadoEntry) {
        if (entry.type === 'income') grp.income += entry.amount;
        else grp.expense += entry.amount;
      }
    });

    return groups;
  }, [enableSmartLedger, groupByDay, displayEntries]);

  const hasActiveLedgerFilters =
    Boolean(ledgerSearch.trim()) ||
    ledgerTypeFilter !== 'all' ||
    ledgerMethodFilter !== 'all' ||
    ledgerCategoryFilter !== 'all' ||
    ledgerOperatorFilter !== 'all';

  const clearLedgerFilters = () => {
    setLedgerSearch('');
    setLedgerTypeFilter('all');
    setLedgerMethodFilter('all');
    setLedgerCategoryFilter('all');
    setLedgerOperatorFilter('all');
  };

  const showRentalBreakdown =
    Boolean(deviceConfig?.enableSpotRentals) ||
    metrics.rentalPaidIncome > 0 ||
    metrics.rentalFiadoIncome > 0 ||
    metrics.rentalCheckoutsCount > 0;

  // Handlers
  const startEditingEntry = (entry: CombinedLedgerEntry) => {
    setEditingId(entry.id);
    setEditDesc(entry.description);
    setEditAmount(entry.amount.toFixed(2));
    setEditCategory(entry.category || 'Outros');
    setEditType(entry.type);
    setEditPaymentMethod(
      entry.paymentMethod === 'pix' || entry.paymentMethod === 'machine' ? entry.paymentMethod : 'cash'
    );
    setConfirmDeleteId(null);
  };

  const handleSaveEdit = async (id: string) => {
    if (!onUpdateTransaction) return;
    const parsed = parseFloat(editAmount);
    if (!editDesc.trim() || isNaN(parsed) || parsed <= 0) return;
    setIsSavingEdit(true);
    try {
      await onUpdateTransaction(id, {
        description: editDesc.trim(),
        amount: parsed,
        category: editCategory,
        type: editType,
        paymentMethod: editPaymentMethod
      });
      setEditingId(null);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleExportCashbookCsv = () => {
    exportToCsv(
      `livro_caixa_${startDate}_a_${endDate}`,
      ['Data/Hora', 'Descrição', 'Categoria', 'Forma', 'Operador', 'Tipo', 'Valor (R$)'],
      displayEntries.map(entry => [
        new Date(entry.date).toLocaleString('pt-BR'),
        entry.description,
        entry.category || (entry.isManual ? 'Outros' : 'Estacionamento'),
        getMethodLabel(entry.paymentMethod),
        entry.operator || '',
        entry.type === 'income' ? 'Entrada' : 'Saída',
        (Number(entry.amount) || 0).toFixed(2).replace('.', ',')
      ])
    );
  };

  const handleShareWhatsappSummary = () => {
    const periodLabel = `${startDate.split('-').reverse().join('/')} ${startTime} até ${endDate.split('-').reverse().join('/')} ${endTime}`;
    const initialChange = activeShift ? Number(activeShift.initialChange) || 0 : 0;
    const text = buildCashbookSummaryWhatsappText({
      periodLabel,
      totalIncome: metrics.totalIncome,
      incomeCash: metrics.incomeCash,
      incomePix: metrics.incomePix,
      incomeMachine: metrics.incomeMachine,
      totalExpense: metrics.totalExpense,
      balance: metrics.balance,
      incomeFiado: metrics.incomeFiado,
      totalPendingFiado,
      drawerCash: enableDrawer ? initialChange + metrics.drawerCashNet : undefined,
      digitalNet: enableDrawer ? metrics.digitalNet : undefined,
      rentalPaidIncome: showRentalBreakdown ? metrics.rentalPaidIncome : undefined,
      rentalCheckoutsCount: showRentalBreakdown ? metrics.rentalCheckoutsCount : undefined
    });
    openWhatsappMessage(text);
  };

  const renderDeltaBadge = (delta: PeriodComparisonDelta | undefined, invertColors = false) => {
    if (!delta) return null;
    if (delta.deltaPercent === null) {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-1">
          <TrendingUp className="w-3 h-3" />
          Sem base anterior
        </span>
      );
    }
    const isUp = delta.direction === 'up';
    const isDown = delta.direction === 'down';
    const isPositiveSentiment = invertColors ? isDown : isUp;
    const isNegativeSentiment = invertColors ? isUp : isDown;

    return (
      <span
        className={`inline-flex items-center gap-1 text-[11px] font-semibold mt-1 tabular-nums ${
          isPositiveSentiment
            ? 'text-emerald-600 dark:text-emerald-400'
            : isNegativeSentiment
              ? 'text-red-600 dark:text-red-400'
              : 'text-slate-500 dark:text-slate-400'
        }`}
        title={`Período anterior: R$ ${delta.previousValue.toFixed(2)}`}
      >
        {isUp ? (
          <TrendingUp className="w-3 h-3 shrink-0" />
        ) : isDown ? (
          <TrendingDown className="w-3 h-3 shrink-0" />
        ) : (
          <Minus className="w-3 h-3 shrink-0" />
        )}
        {delta.deltaPercent > 0 ? `+${delta.deltaPercent}%` : `${delta.deltaPercent}%`} vs. período ant.
      </span>
    );
  };

  const renderLedgerRow = (entry: CombinedLedgerEntry) => {
    const isEditing = editingId === entry.id;
    const isConfirmingDelete = confirmDeleteId === entry.id;

    if (isEditing) {
      const editCatOptions = editType === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
      return (
        <div
          key={`${entry.id}_${entry.date}`}
          className="p-4 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-emerald-300 dark:border-emerald-700 space-y-3"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300">Editando lançamento</span>
            <div className="flex items-center gap-1 p-0.5 bg-slate-200/80 dark:bg-slate-900 rounded-lg">
              <button
                type="button"
                onClick={() => {
                  setEditType('expense');
                  if (!EXPENSE_CATEGORIES.includes(editCategory)) setEditCategory('Outros');
                }}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                  editType === 'expense'
                    ? 'bg-white dark:bg-slate-700 text-red-600 dark:text-red-300 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Saída
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditType('income');
                  if (!INCOME_CATEGORIES.includes(editCategory)) setEditCategory('Suprimento (Troco)');
                }}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                  editType === 'income'
                    ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-300 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Entrada
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <input
              type="text"
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              placeholder="Descrição"
              className="sm:col-span-2 px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
            />
            <select
              value={editCategory}
              onChange={(e) => setEditCategory(e.target.value)}
              className="px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
            >
              {editCatOptions.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
              {!editCatOptions.includes(editCategory) && <option value={editCategory}>{editCategory}</option>}
            </select>
            <select
              value={editPaymentMethod}
              onChange={(e) => setEditPaymentMethod(e.target.value as CashMethod)}
              className="px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
            >
              <option value="cash">Dinheiro</option>
              <option value="pix">PIX</option>
              <option value="machine">Máquina</option>
            </select>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={editAmount}
              onChange={(e) => setEditAmount(e.target.value)}
              className="px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 tabular-nums"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingId(null)}
                className="px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg flex items-center gap-1"
              >
                <X className="w-3.5 h-3.5" /> Cancelar
              </button>
              <button
                type="button"
                disabled={isSavingEdit}
                onClick={() => handleSaveEdit(entry.id)}
                className="px-3 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg flex items-center gap-1 disabled:opacity-50"
              >
                <Check className="w-3.5 h-3.5" /> {isSavingEdit ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div
        key={`${entry.id}_${entry.date}`}
        className="flex items-center justify-between gap-3 p-3.5 sm:p-4 bg-slate-50/80 dark:bg-slate-800/40 hover:bg-slate-100/70 dark:hover:bg-slate-800/70 rounded-xl border border-slate-200/70 dark:border-slate-800 transition-colors print:bg-transparent print:border-0 print:border-b print:border-slate-200 print:rounded-none print:px-0"
      >
        <div className="flex items-center space-x-3.5 min-w-0">
          <div
            className={`p-2 rounded-lg shrink-0 print:hidden ${
              entry.isFiadoEntry
                ? 'bg-orange-100 dark:bg-orange-950/60'
                : entry.type === 'income'
                  ? 'bg-emerald-100 dark:bg-emerald-950/60'
                  : 'bg-red-100 dark:bg-red-950/60'
            }`}
          >
            {entry.isFiadoEntry ? (
              <AlertTriangle className="w-4 h-4 text-orange-600 dark:text-orange-400" />
            ) : entry.type === 'income' ? (
              <ArrowUpRight className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <ArrowDownRight className="w-4 h-4 text-red-600 dark:text-red-400" />
            )}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm text-slate-900 dark:text-slate-100 print:text-sm truncate">
              {entry.description}
            </p>
            <div className="text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 mt-0.5">
              <span className="tabular-nums">
                {new Date(entry.date).toLocaleString('pt-BR', {
                  day: '2-digit',
                  month: '2-digit',
                  year: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </span>
              <span aria-hidden="true">·</span>
              <span>{getMethodLabel(entry.paymentMethod)}</span>
              {!entry.isManual && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>Automático</span>
                </>
              )}
              {entry.category && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{entry.category}</span>
                </>
              )}
              {entry.operator && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>Op: {entry.operator}</span>
                </>
              )}
              {entry.isFiadoEntry && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className={entry.isFiadoPaid ? 'font-semibold text-emerald-700 dark:text-emerald-400' : 'font-semibold text-orange-600 dark:text-orange-400'}>
                    {entry.isFiadoPaid ? 'Fiado Quitado' : 'Fiado Pendente'}
                  </span>
                </>
              )}
              {entry.editedBy && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="italic">Editado ({entry.editedBy})</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <div className="text-right tabular-nums">
            <span
              className={`font-bold text-sm block print:text-sm ${
                entry.isFiadoEntry
                  ? 'text-orange-600 dark:text-orange-400'
                  : entry.type === 'income'
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-red-600 dark:text-red-400'
              }`}
            >
              {entry.isFiadoEntry ? '' : entry.type === 'income' ? '+ ' : '- '}R$ {entry.amount.toFixed(2)}
            </span>
            {enableSmartLedger && typeof entry.runningBalance === 'number' && (
              <span className="text-[11px] text-slate-400 dark:text-slate-500 block print:hidden">
                Saldo: R$ {entry.runningBalance.toFixed(2)}
              </span>
            )}
          </div>

          {canManageCashbook && entry.isManual && (
            <div className="flex items-center gap-1 print:hidden">
              {enableSmartLedger && !entry.isFiadoEntry && onUpdateTransaction && !isConfirmingDelete && (
                <button
                  type="button"
                  onClick={() => startEditingEntry(entry)}
                  className="p-1.5 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 rounded-lg transition-colors"
                  title="Editar lançamento"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              )}

              {isConfirmingDelete ? (
                <div className="flex items-center gap-1 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 rounded-lg px-2 py-1">
                  <span className="text-[11px] font-semibold text-red-700 dark:text-red-300">Excluir?</span>
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteId(null)}
                    className="px-1.5 py-0.5 text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900"
                  >
                    Não
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await onDeleteTransaction(entry.id);
                      setConfirmDeleteId(null);
                    }}
                    className="px-1.5 py-0.5 text-[11px] font-bold text-white bg-red-600 hover:bg-red-700 rounded"
                  >
                    Sim
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setConfirmDeleteId(entry.id);
                    setEditingId(null);
                  }}
                  className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-lg transition-colors"
                  title="Excluir"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  const recentShifts = useMemo(
    () => [...shifts].sort((a, b) => b.startTime - a.startTime).slice(0, 20),
    [shifts]
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Livro Caixa</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            Controle financeiro e consulta por período do estacionamento
          </p>
        </div>

        <div className="flex flex-wrap gap-2 sm:gap-2.5 print:hidden">
          {enableFinanceModule && onOpenFinance && (
            <button
              type="button"
              onClick={onOpenFinance}
              className="flex items-center justify-center gap-2 bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-700 text-white px-3.5 py-2 rounded-xl transition-colors text-sm font-semibold shadow-sm whitespace-nowrap shrink-0"
            >
              <Landmark className="w-4 h-4" />
              <span>Financeiro</span>
            </button>
          )}
          {enableAnalytics && (
            <button
              type="button"
              onClick={handleShareWhatsappSummary}
              className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-xl transition-colors text-sm font-semibold shadow-sm whitespace-nowrap shrink-0"
            >
              <MessageCircle className="w-4 h-4" />
              <span>Resumo WhatsApp</span>
            </button>
          )}
          {deviceConfig?.enableCsvExport && (
            <button
              type="button"
              onClick={handleExportCashbookCsv}
              className="flex items-center justify-center gap-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 px-3.5 py-2 border border-slate-200 dark:border-slate-700 rounded-xl transition-colors text-sm font-medium whitespace-nowrap shrink-0"
            >
              <Download className="w-4 h-4" />
              <span>CSV</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center justify-center gap-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 px-3.5 py-2 border border-slate-200 dark:border-slate-700 rounded-xl transition-colors text-sm font-medium whitespace-nowrap shrink-0"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir Filtro</span>
          </button>
          <button
            type="button"
            onClick={() => setIsFiadoSearchOpen(true)}
            className="flex items-center justify-center gap-2 bg-orange-100 dark:bg-orange-950/60 text-orange-800 dark:text-orange-200 hover:bg-orange-200 dark:hover:bg-orange-900/60 px-3.5 py-2 border border-orange-200 dark:border-orange-800 rounded-xl transition-colors text-sm font-medium whitespace-nowrap shrink-0"
          >
            <Search className="w-4 h-4" />
            <span>Pesquisar Fiados</span>
          </button>
          <button
            type="button"
            onClick={() => setIsDailyReportOpen(true)}
            className="flex items-center justify-center gap-2 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 hover:bg-emerald-200 dark:hover:bg-emerald-900/60 px-3.5 py-2 border border-emerald-200 dark:border-emerald-800 rounded-xl transition-colors text-sm font-medium whitespace-nowrap shrink-0"
          >
            <FileText className="w-4 h-4" />
            <span>Fechamento Detalhado</span>
          </button>
        </div>
      </div>

      {/* Print Only Header */}
      <div className="hidden print:block mb-6">
        <h2 className="text-xl print:text-lg font-bold text-slate-900 border-b border-slate-200 pb-2 mb-2">
          Relatório do Livro Caixa
        </h2>
        <p className="text-slate-600 print:text-sm">
          Período: <strong>{startDate.split('-').reverse().join('/')} {startTime}</strong> até{' '}
          <strong>{endDate.split('-').reverse().join('/')} {endTime}</strong>
        </p>
      </div>

      {/* Date & Time Range Filter Card */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 print:hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <h2 className="font-bold text-slate-900 dark:text-slate-100 text-sm sm:text-base">
              Filtro de Período e Horário
            </h2>
          </div>

          {/* Quick Presets */}
          <div className="flex flex-wrap gap-1.5 items-center">
            <span className="text-xs font-semibold text-slate-400 mr-1">Atalhos:</span>
            {enableSmartLedger && activeShift && (
              <button
                type="button"
                onClick={() => handlePreset('currentShift')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 flex items-center gap-1 ${
                  selectedShiftId === activeShift.id
                    ? 'bg-emerald-600 text-white'
                    : 'bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>Turno Atual</span>
              </button>
            )}
            {[
              { id: 'today', label: 'Hoje' },
              { id: 'yesterday', label: 'Ontem' },
              { id: 'last7', label: 'Últimos 7 dias' },
              { id: 'thisMonth', label: 'Este Mês' },
              { id: 'all', label: 'Tudo' }
            ].map(preset => (
              <button
                key={preset.id}
                type="button"
                onClick={() => handlePreset(preset.id as any)}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 hover:text-emerald-700 dark:hover:text-emerald-300 text-slate-700 dark:text-slate-300 transition-colors whitespace-nowrap shrink-0"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Inputs Grid */}
        <div className={`grid grid-cols-1 sm:grid-cols-2 ${enableSmartLedger && recentShifts.length > 0 ? 'lg:grid-cols-5' : 'lg:grid-cols-4'} gap-3`}>
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> Data Inicial
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setSelectedShiftId('');
                setStartDate(e.target.value);
              }}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-slate-100 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> Hora Inicial
            </label>
            <input
              type="time"
              value={startTime}
              onChange={(e) => {
                setSelectedShiftId('');
                setStartTime(e.target.value);
              }}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-slate-100 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> Data Final
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setSelectedShiftId('');
                setEndDate(e.target.value);
              }}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-slate-100 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> Hora Final
            </label>
            <input
              type="time"
              value={endTime}
              onChange={(e) => {
                setSelectedShiftId('');
                setEndTime(e.target.value);
              }}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-slate-100 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>

          {enableSmartLedger && recentShifts.length > 0 && (
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1 flex items-center gap-1">
                <UserCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> Filtrar por Turno
              </label>
              <select
                value={selectedShiftId}
                onChange={(e) => handleSelectShift(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-slate-100 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              >
                <option value="">Período manual</option>
                {recentShifts.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.status === 'open' ? '● Aberto' : 'Encerrado'} · {s.operatorName} ({new Date(s.startTime).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} {formatTimeHM(s.startTime)})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Summary info banner */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800 gap-2">
          <span>
            Exibindo faturamento de{' '}
            <strong className="text-slate-800 dark:text-slate-200">
              {startDate.split('-').reverse().join('/')} às {startTime}
            </strong>{' '}
            até{' '}
            <strong className="text-slate-800 dark:text-slate-200">
              {endDate.split('-').reverse().join('/')} às {endTime}
            </strong>
          </span>

          {(startDate !== todayStr || startTime !== '00:00' || endDate !== todayStr || endTime !== '23:59') && (
            <button
              type="button"
              onClick={() => handlePreset('today')}
              className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 font-bold transition-colors whitespace-nowrap shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Voltar para Hoje
            </button>
          )}
        </div>
      </div>

      {isDailyReportOpen && (
        <DailyReportModal
          date={startDate}
          vehicles={vehicles}
          transactions={transactions}
          shifts={shifts}
          deviceConfig={deviceConfig}
          onClose={() => setIsDailyReportOpen(false)}
        />
      )}

      {/* Top KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-800 flex flex-col">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Entradas (Período)</p>
              <p className="text-2xl print:text-lg font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                R$ {metrics.totalIncome.toFixed(2)}
              </p>
              {comparison && renderDeltaBadge(comparison.income, false)}
            </div>
            <div className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center shrink-0">
              <ArrowUpRight className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
          </div>
          <div className="mt-auto grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-slate-600 dark:text-slate-300 border-t border-slate-100 dark:border-slate-800 pt-3">
            <div className="flex justify-between">
              <span>Dinheiro:</span>
              <span className="font-semibold text-slate-800 dark:text-slate-100 tabular-nums">R$ {metrics.incomeCash.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Máquina:</span>
              <span className="font-semibold text-slate-800 dark:text-slate-100 tabular-nums">R$ {metrics.incomeMachine.toFixed(2)}</span>
            </div>
            {metrics.incomePix > 0 && (
              <div className="flex justify-between">
                <span>PIX:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-100 tabular-nums">R$ {metrics.incomePix.toFixed(2)}</span>
              </div>
            )}
            {showRentalBreakdown && (
              <div className="col-span-2 border-t border-slate-100 dark:border-slate-800 pt-1.5 mt-0.5 space-y-0.5 text-[11px] text-teal-800 dark:text-teal-300">
                <div className="flex justify-between">
                  <span>Vagas Alugadas (Contratos, incluso acima):</span>
                  <span className="font-bold tabular-nums">R$ {metrics.rentalPaidIncome.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-teal-700/80 dark:text-teal-400/80">
                  <span>Saídas cobertas por Aluguel:</span>
                  <span className="font-semibold tabular-nums">
                    {metrics.rentalCheckoutsCount} saída(s)
                    {metrics.rentalFiadoIncome > 0 ? ` · Fiado R$ ${metrics.rentalFiadoIncome.toFixed(2)}` : ''}
                  </span>
                </div>
              </div>
            )}
            <div className="flex justify-between col-span-2 border-t border-slate-100 dark:border-slate-800 pt-1.5 mt-0.5 text-orange-600 dark:text-orange-400 text-[11px]">
              <span>Fiado Gerado no Período (Pendente):</span>
              <span className="font-bold tabular-nums">R$ {metrics.incomeFiado.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Saídas (Período)</p>
              <p className="text-2xl print:text-lg font-bold text-red-600 dark:text-red-400 tabular-nums">
                R$ {metrics.totalExpense.toFixed(2)}
              </p>
              {comparison && renderDeltaBadge(comparison.expense, true)}
            </div>
            <div className="w-11 h-11 rounded-xl bg-red-50 dark:bg-red-950/60 flex items-center justify-center shrink-0">
              <ArrowDownRight className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
          </div>
          {enableDrawer && metrics.totalExpense > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              <span>Dinheiro: <strong className="text-slate-800 dark:text-slate-200">R$ {metrics.expenseCash.toFixed(2)}</strong></span>
              {metrics.expensePix > 0 && (
                <span>PIX: <strong className="text-slate-800 dark:text-slate-200">R$ {metrics.expensePix.toFixed(2)}</strong></span>
              )}
              {metrics.expenseMachine > 0 && (
                <span>Máquina: <strong className="text-slate-800 dark:text-slate-200">R$ {metrics.expenseMachine.toFixed(2)}</strong></span>
              )}
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Saldo (Período)</p>
              <p className={`text-2xl print:text-lg font-bold tabular-nums ${metrics.balance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                R$ {metrics.balance.toFixed(2)}
              </p>
              {comparison && renderDeltaBadge(comparison.balance, false)}
            </div>
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${metrics.balance >= 0 ? 'bg-emerald-50 dark:bg-emerald-950/60' : 'bg-red-50 dark:bg-red-950/60'}`}>
              <Wallet className={`w-5 h-5 ${metrics.balance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`} />
            </div>
          </div>
          {enableDrawer && (
            <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              <span>Espécie líq.: <strong className="text-slate-800 dark:text-slate-200">R$ {metrics.drawerCashNet.toFixed(2)}</strong></span>
              <span>Digital líq.: <strong className="text-slate-800 dark:text-slate-200">R$ {metrics.digitalNet.toFixed(2)}</strong></span>
            </div>
          )}
        </div>
      </div>

      {/* Optional Module 1: Controle de Gaveta e Suprimentos */}
      {enableDrawer && (
        <CashBookDrawerPanel
          metrics={metrics}
          activeShift={activeShift}
          canManageCashbook={canManageCashbook}
          onRegisterAdjustment={onAddTransaction}
          operatorName={currentOperatorName}
        />
      )}

      {/* Optional Module 4: Painel Analítico do Caixa */}
      {enableAnalytics && <CashBookAnalyticsPanel metrics={metrics} />}

      {/* Main Two-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 print:block">
        <div className="lg:col-span-1 flex flex-col gap-6 print:hidden">
          {/* Caixa do Fiado (Classic or Advanced Module 3) */}
          <CashBookFiadoCard
            unpaidFiados={unpaidFiados}
            vehicles={vehicles}
            transactions={transactions}
            startOfPeriod={startOfPeriod}
            endOfPeriod={endOfPeriod}
            canManageCashbook={canManageCashbook}
            deviceConfig={deviceConfig}
            onOpenSearch={() => setIsFiadoSearchOpen(true)}
            onPayFiado={onPayFiado}
            onPayFiadoTransaction={onPayFiadoTransaction}
          />
        </div>

        {/* Right Column: Extrato do Período */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-800 overflow-hidden h-full flex flex-col print:border-none print:shadow-none">
            <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800 space-y-3 print:px-0">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-base sm:text-lg print:text-base font-bold text-slate-900 dark:text-slate-100">
                    Extrato do Período
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                    {displayEntries.length} {displayEntries.length === 1 ? 'lançamento' : 'lançamentos'}
                    {enableSmartLedger && hasActiveLedgerFilters ? ` (filtrado de ${baseEntries.length})` : ''}
                  </p>
                </div>

                {enableSmartLedger && (
                  <button
                    type="button"
                    onClick={() => setGroupByDay(!groupByDay)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border transition-colors whitespace-nowrap shrink-0 print:hidden ${
                      groupByDay
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>Agrupar por dia</span>
                  </button>
                )}
              </div>

              {/* Optional Module 2: Smart Ledger Search & Filters */}
              {enableSmartLedger && (
                <div className="space-y-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 print:hidden">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={ledgerSearch}
                        onChange={(e) => setLedgerSearch(e.target.value)}
                        placeholder="Buscar por placa, descrição, operador..."
                        className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                      />
                    </div>

                    <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl shrink-0 overflow-x-auto">
                      {[
                        { id: 'all', label: 'Todos' },
                        { id: 'income', label: 'Entradas' },
                        { id: 'expense', label: 'Saídas' },
                        { id: 'fiado', label: 'Fiados' }
                      ].map(tab => (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setLedgerTypeFilter(tab.id as any)}
                          className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                            ledgerTypeFilter === tab.id
                              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={ledgerMethodFilter}
                      onChange={(e) => setLedgerMethodFilter(e.target.value as any)}
                      className="px-2.5 py-1.5 text-xs font-medium bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200"
                    >
                      <option value="all">Todas as formas</option>
                      <option value="cash">Dinheiro</option>
                      <option value="pix">PIX</option>
                      <option value="machine">Máquina</option>
                      <option value="rental">Vaga Alugada</option>
                    </select>

                    {availableCategories.length > 0 && (
                      <select
                        value={ledgerCategoryFilter}
                        onChange={(e) => setLedgerCategoryFilter(e.target.value)}
                        className="px-2.5 py-1.5 text-xs font-medium bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200"
                      >
                        <option value="all">Todas as categorias</option>
                        {availableCategories.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    )}

                    {availableOperators.length > 0 && (
                      <select
                        value={ledgerOperatorFilter}
                        onChange={(e) => setLedgerOperatorFilter(e.target.value)}
                        className="px-2.5 py-1.5 text-xs font-medium bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200"
                      >
                        <option value="all">Todos operadores</option>
                        {availableOperators.map(op => (
                          <option key={op} value={op}>{op}</option>
                        ))}
                      </select>
                    )}

                    {hasActiveLedgerFilters && (
                      <button
                        type="button"
                        onClick={clearLedgerFilters}
                        className="px-2.5 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline whitespace-nowrap"
                      >
                        Limpar filtros
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="overflow-y-auto print:overflow-visible p-3 sm:p-4 print:p-0 max-h-[680px] print:max-h-none">
              {displayEntries.length > 0 ? (
                groupedByDay ? (
                  <div className="space-y-5">
                    {groupedByDay.map(dayGroup => {
                      const dayNet = dayGroup.income - dayGroup.expense;
                      return (
                        <div key={dayGroup.dateKey} className="space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2 px-2 py-1.5 border-b border-slate-200 dark:border-slate-800">
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                              {dayGroup.label}
                            </span>
                            <div className="flex items-center gap-2.5 text-xs tabular-nums">
                              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                                +R$ {dayGroup.income.toFixed(2)}
                              </span>
                              <span className="text-red-600 dark:text-red-400 font-semibold">
                                -R$ {dayGroup.expense.toFixed(2)}
                              </span>
                              <span className={`font-bold ${dayNet >= 0 ? 'text-slate-800 dark:text-slate-100' : 'text-red-600 dark:text-red-400'}`}>
                                Líq: R$ {dayNet.toFixed(2)}
                              </span>
                            </div>
                          </div>
                          <div className="space-y-2 print:space-y-1">
                            {dayGroup.entries.map(renderLedgerRow)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="space-y-2 print:space-y-1">
                    {displayEntries.map(renderLedgerRow)}
                  </div>
                )
              ) : (
                <div className="py-12 text-center">
                  <div className="w-14 h-14 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Wallet className="w-7 h-7 text-slate-400" />
                  </div>
                  <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-1">
                    Nenhum registro encontrado
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {enableSmartLedger && hasActiveLedgerFilters
                      ? 'Nenhum lançamento corresponde aos filtros aplicados.'
                      : 'Não há movimentações para o período e horário selecionados.'}
                  </p>
                  {enableSmartLedger && hasActiveLedgerFilters && (
                    <button
                      type="button"
                      onClick={clearLedgerFilters}
                      className="mt-3 px-4 py-2 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
                    >
                      Limpar filtros do extrato
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <FiadoSearchModal
        isOpen={isFiadoSearchOpen}
        onClose={() => setIsFiadoSearchOpen(false)}
        vehicles={vehicles}
        transactions={transactions}
        deviceConfig={deviceConfig}
        onPayFiado={onPayFiado}
        onPayFiadoTransaction={onPayFiadoTransaction}
      />
    </div>
  );
}
