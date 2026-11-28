import React, { useEffect, useMemo, useState } from 'react';
import {
  Landmark,
  Building2,
  User,
  Users,
  ArrowUpRight,
  ArrowDownRight,
  ArrowLeftRight,
  CalendarClock,
  Wallet,
  Plus,
  Search,
  Pencil,
  Trash2,
  Check,
  X,
  Download,
  Printer,
  Calendar,
  AlertTriangle
} from 'lucide-react';
import {
  FinancialAccount,
  FinancialCategory,
  FinancialCategoryScope,
  FinancialCategoryType,
  FinancialEntry,
  FinancialEntryType,
  FinancialOwner,
  FinancialPayable,
  FinancialPaymentMethod,
  FinancialScope,
  ParkedVehicle,
  Transaction
} from '../types';
import { DeviceFeaturesConfig } from '../lib/deviceModules';
import { getLocalDateString } from '../lib/dateUtils';
import { exportToCsv } from '../lib/csvExport';
import {
  PAYMENT_METHOD_LABELS,
  computeAccountBalances,
  computeFinancePeriodSummary,
  getCategoryNamesFor,
  resolveEffectiveCategories
} from '../lib/financeUtils';
import {
  FinanceAccountsSection,
  FinanceOwnersSection,
  getOwnerColorClasses
} from './FinanceAccountsOwnersTab';
import {
  CreatePayablePayload,
  FinancePayablesTab,
  PayPayablePayload
} from './FinancePayablesTab';
import {
  FinanceCategoriesTab,
  UpdateCategoryPayload
} from './FinanceCategoriesTab';

interface FinanceManagerProps {
  accounts: FinancialAccount[];
  owners: FinancialOwner[];
  entries: FinancialEntry[];
  payables: FinancialPayable[];
  storedCategories: FinancialCategory[];
  transactions: Transaction[];
  vehicles: ParkedVehicle[];
  activeOperator?: string;
  deviceConfig?: DeviceFeaturesConfig;
  onAddAccount: (payload: Omit<FinancialAccount, 'id' | 'createdAt'>) => Promise<{ ok: boolean; error?: string }>;
  onUpdateAccount: (id: string, payload: Partial<FinancialAccount>) => Promise<{ ok: boolean; error?: string }>;
  onDeleteAccount: (id: string) => Promise<{ ok: boolean; error?: string }>;
  onAddOwner: (payload: Omit<FinancialOwner, 'id' | 'createdAt'>) => Promise<{ ok: boolean; error?: string }>;
  onUpdateOwner: (id: string, payload: Partial<FinancialOwner>) => Promise<{ ok: boolean; error?: string }>;
  onDeleteOwner: (id: string) => Promise<{ ok: boolean; error?: string }>;
  onAddEntry: (payload: Omit<FinancialEntry, 'id'>) => Promise<{ ok: boolean; error?: string }>;
  onUpdateEntry: (id: string, payload: Partial<FinancialEntry>) => Promise<{ ok: boolean; error?: string }>;
  onDeleteEntry: (id: string) => Promise<{ ok: boolean; error?: string }>;
  onAddPayable: (payload: CreatePayablePayload) => Promise<{ ok: boolean; error?: string }>;
  onUpdatePayable: (id: string, payload: Partial<FinancialPayable>) => Promise<{ ok: boolean; error?: string }>;
  onPayPayable: (id: string, payload: PayPayablePayload) => Promise<{ ok: boolean; error?: string }>;
  onDeletePayable: (id: string) => Promise<{ ok: boolean; error?: string }>;
  onAddCategory: (payload: {
    name: string;
    type: FinancialCategoryType;
    scope: FinancialCategoryScope;
  }) => Promise<{ ok: boolean; error?: string }>;
  onUpdateCategory: (id: string, payload: UpdateCategoryPayload) => Promise<{ ok: boolean; error?: string }>;
  onDeleteCategory: (id: string) => Promise<{ ok: boolean; error?: string }>;
  onRestoreDefaultCategories: () => Promise<{ ok: boolean; error?: string }>;
}

type FinanceTab = 'entries' | 'payables' | 'accounts' | 'owners' | 'categories';

export function FinanceManager({
  accounts,
  owners,
  entries,
  payables,
  storedCategories,
  transactions,
  vehicles,
  activeOperator,
  deviceConfig,
  onAddAccount,
  onUpdateAccount,
  onDeleteAccount,
  onAddOwner,
  onUpdateOwner,
  onDeleteOwner,
  onAddEntry,
  onUpdateEntry,
  onDeleteEntry,
  onAddPayable,
  onUpdatePayable,
  onPayPayable,
  onDeletePayable,
  onAddCategory,
  onUpdateCategory,
  onDeleteCategory,
  onRestoreDefaultCategories
}: FinanceManagerProps) {
  const todayStr = getLocalDateString();
  const firstOfMonthStr = useMemo(() => {
    const now = new Date();
    return getLocalDateString(new Date(now.getFullYear(), now.getMonth(), 1));
  }, []);

  const effectiveCategories = useMemo(
    () => resolveEffectiveCategories(storedCategories),
    [storedCategories]
  );

  const hasDeletedDefaults = useMemo(
    () => storedCategories.some(c => c && c.id.startsWith('def_') && Boolean(c.deleted)),
    [storedCategories]
  );

  // Navigation & Global Filters
  const [activeTab, setActiveTab] = useState<FinanceTab>('entries');
  const [categoryShortcutPreset, setCategoryShortcutPreset] = useState<{
    type?: FinancialCategoryType;
    scope?: FinancialCategoryScope;
  }>({});
  const [scopeFilter, setScopeFilter] = useState<'all' | FinancialScope>('all');
  const [ownerFilter, setOwnerFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>(firstOfMonthStr);
  const [endDate, setEndDate] = useState<string>(todayStr);
  const [includeParkingRevenue, setIncludeParkingRevenue] = useState<boolean>(true);

  // Entry Form State
  const [formType, setFormType] = useState<FinancialEntryType>('expense');
  const [formScope, setFormScope] = useState<FinancialScope>('company');
  const [formOwnerId, setFormOwnerId] = useState<string>('');
  const [formCustomOwnerName, setFormCustomOwnerName] = useState<string>('');
  const [formCategory, setFormCategory] = useState<string>(
    () => getCategoryNamesFor(effectiveCategories, 'expense', 'company')[0] || 'Outros'
  );
  const [formAccountId, setFormAccountId] = useState<string>('');
  const [formToAccountId, setFormToAccountId] = useState<string>('');
  const [formMethod, setFormMethod] = useState<FinancialPaymentMethod>('pix');
  const [formDescription, setFormDescription] = useState<string>('');
  const [formCounterparty, setFormCounterparty] = useState<string>('');
  const [formDate, setFormDate] = useState<string>(todayStr);
  const [formAmount, setFormAmount] = useState<string>('');
  const [formNotes, setFormNotes] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSavingEntry, setIsSavingEntry] = useState<boolean>(false);

  // Ledger Local Filters
  const [search, setSearch] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<'all' | FinancialEntryType>('all');
  const [accountFilter, setAccountFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Inline Edit & Safe Delete for Entries
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDesc, setEditDesc] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editScope, setEditScope] = useState<FinancialScope>('company');
  const [editOwnerId, setEditOwnerId] = useState('');
  const [editAccountId, setEditAccountId] = useState('');
  const [editMethod, setEditMethod] = useState<FinancialPaymentMethod>('pix');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const startMs = useMemo(() => {
    const [y, m, d] = (startDate || '2020-01-01').split('-').map(Number);
    return new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0).getTime();
  }, [startDate]);

  const endMs = useMemo(() => {
    const [y, m, d] = (endDate || todayStr).split('-').map(Number);
    return new Date(y, (m || 1) - 1, d || 1, 23, 59, 59, 999).getTime();
  }, [endDate, todayStr]);

  const accountMap = useMemo(() => {
    const m = new Map<string, FinancialAccount>();
    accounts.forEach(a => m.set(a.id, a));
    return m;
  }, [accounts]);

  const ownerMap = useMemo(() => {
    const m = new Map<string, FinancialOwner>();
    owners.forEach(o => m.set(o.id, o));
    return m;
  }, [owners]);

  const accountBalances = useMemo(
    () => computeAccountBalances(accounts, entries),
    [accounts, entries]
  );

  const summary = useMemo(
    () =>
      computeFinancePeriodSummary({
        accounts,
        owners,
        entries,
        payables,
        transactions,
        vehicles,
        startMs,
        endMs,
        startDateStr: startDate,
        endDateStr: endDate,
        includeParkingRevenue,
        scopeFilter,
        ownerFilter,
        todayStr
      }),
    [
      accounts,
      owners,
      entries,
      payables,
      transactions,
      vehicles,
      startMs,
      endMs,
      startDate,
      endDate,
      includeParkingRevenue,
      scopeFilter,
      ownerFilter,
      todayStr
    ]
  );

  const handlePeriodPreset = (preset: 'today' | 'last7' | 'thisMonth' | 'lastMonth' | 'thisYear' | 'all') => {
    const now = new Date();
    const today = getLocalDateString(now);
    if (preset === 'today') {
      setStartDate(today);
      setEndDate(today);
    } else if (preset === 'last7') {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
      setStartDate(getLocalDateString(d));
      setEndDate(today);
    } else if (preset === 'thisMonth') {
      setStartDate(getLocalDateString(new Date(now.getFullYear(), now.getMonth(), 1)));
      setEndDate(today);
    } else if (preset === 'lastMonth') {
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const last = new Date(now.getFullYear(), now.getMonth(), 0);
      setStartDate(getLocalDateString(first));
      setEndDate(getLocalDateString(last));
    } else if (preset === 'thisYear') {
      setStartDate(getLocalDateString(new Date(now.getFullYear(), 0, 1)));
      setEndDate(today);
    } else if (preset === 'all') {
      setStartDate('2020-01-01');
      setEndDate(today);
    }
  };

  const formCategoryOptions = useMemo(() => {
    const catType: FinancialCategoryType = formType === 'income' ? 'income' : 'expense';
    return getCategoryNamesFor(effectiveCategories, catType, formScope);
  }, [effectiveCategories, formType, formScope]);

  useEffect(() => {
    if (formType !== 'transfer' && formCategoryOptions.length > 0 && !formCategoryOptions.includes(formCategory)) {
      setFormCategory(formCategoryOptions[0]);
    }
  }, [formType, formCategoryOptions, formCategory]);

  const handleOpenCategoriesShortcut = (targetType: FinancialCategoryType, targetScope: FinancialScope) => {
    setCategoryShortcutPreset({ type: targetType, scope: targetScope });
    setActiveTab('categories');
  };

  const handleSwitchFormType = (nextType: FinancialEntryType) => {
    setFormType(nextType);
    setFormError(null);
    if (nextType === 'transfer') {
      setFormCategory('Depósito / Transferência');
      if (!formAccountId && accounts.length > 0) setFormAccountId(accounts[0].id);
      if (!formToAccountId && accounts.length > 1) setFormToAccountId(accounts[1].id);
    } else if (nextType === 'income') {
      setFormCategory(getCategoryNamesFor(effectiveCategories, 'income', formScope)[0] || 'Outros');
    } else {
      setFormCategory(getCategoryNamesFor(effectiveCategories, 'expense', formScope)[0] || 'Outros');
    }
  };

  const handleSwitchFormScope = (nextScope: FinancialScope) => {
    setFormScope(nextScope);
    if (formType === 'income') {
      setFormCategory(getCategoryNamesFor(effectiveCategories, 'income', nextScope)[0] || 'Outros');
    } else if (formType === 'expense') {
      setFormCategory(getCategoryNamesFor(effectiveCategories, 'expense', nextScope)[0] || 'Outros');
    }
    if (nextScope === 'personal' && !formOwnerId && owners.length > 0) {
      setFormOwnerId(owners[0].id);
    }
  };

  const handleSubmitEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const parsedAmount = parseFloat(formAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setFormError('Informe um valor válido maior que zero.');
      return;
    }
    const cleanDesc = formDescription.trim();
    if (!cleanDesc) {
      setFormError('Informe uma descrição para o lançamento.');
      return;
    }

    if (formType === 'transfer') {
      if (!formAccountId || !formToAccountId || formAccountId === formToAccountId) {
        setFormError('Escolha contas de origem e destino diferentes.');
        return;
      }
    }

    const [y, m, d] = (formDate || todayStr).split('-').map(Number);
    const now = new Date();
    const entryDateMs = new Date(
      y,
      (m || 1) - 1,
      d || 1,
      now.getHours(),
      now.getMinutes(),
      now.getSeconds()
    ).getTime();

    const effectiveScope: FinancialScope = formType === 'transfer' ? 'company' : formScope;
    const selectedOwner = owners.find(o => o.id === formOwnerId);
    const resolvedOwnerName =
      effectiveScope === 'personal'
        ? selectedOwner?.name || formCustomOwnerName.trim() || 'Particular'
        : undefined;

    setIsSavingEntry(true);
    try {
      const res = await onAddEntry({
        type: formType,
        scope: effectiveScope,
        ownerId: effectiveScope === 'personal' && selectedOwner ? selectedOwner.id : undefined,
        ownerName: resolvedOwnerName,
        description: cleanDesc,
        category: formType === 'transfer' ? 'Depósito / Transferência' : formCategory,
        amount: parsedAmount,
        date: entryDateMs,
        accountId: formAccountId || undefined,
        toAccountId: formType === 'transfer' ? formToAccountId || undefined : undefined,
        paymentMethod: formType === 'transfer' ? 'bank_transfer' : formMethod,
        counterparty: formCounterparty.trim() || undefined,
        notes: formNotes.trim() || undefined,
        operator: activeOperator
      });
      if (res.ok) {
        setFormDescription('');
        setFormAmount('');
        setFormCounterparty('');
        setFormNotes('');
      } else if (res.error) {
        setFormError(res.error);
      }
    } finally {
      setIsSavingEntry(false);
    }
  };

  const handleQuickTransferFrom = (sourceAccountId: string) => {
    setActiveTab('entries');
    setFormType('transfer');
    setFormAccountId(sourceAccountId);
    const other = accounts.find(a => a.id !== sourceAccountId);
    if (other) setFormToAccountId(other.id);
    setFormDescription('Depósito / Transferência entre contas');
    setFormError(null);
  };

  // Filtered entries for the ledger
  const filteredEntries = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries
      .filter(entry => {
        if (entry.date < startMs || entry.date > endMs) return false;
        if (scopeFilter !== 'all') {
          if (entry.type === 'transfer') {
            const fromAcc = entry.accountId ? accountMap.get(entry.accountId) : undefined;
            const toAcc = entry.toAccountId ? accountMap.get(entry.toAccountId) : undefined;
            if (fromAcc?.scope !== scopeFilter && toAcc?.scope !== scopeFilter) return false;
          } else if (entry.scope !== scopeFilter) {
            return false;
          }
        }
        if (scopeFilter === 'personal' && ownerFilter !== 'all') {
          if (entry.type === 'transfer') return false;
          const matchesId = entry.ownerId === ownerFilter;
          const matchesName = (entry.ownerName || '').toLowerCase() === ownerFilter.toLowerCase();
          if (!matchesId && !matchesName) return false;
        }
        if (typeFilter !== 'all' && entry.type !== typeFilter) return false;
        if (accountFilter !== 'all' && entry.accountId !== accountFilter && entry.toAccountId !== accountFilter) {
          return false;
        }
        if (categoryFilter !== 'all' && entry.category !== categoryFilter) return false;
        if (q) {
          const fromName = entry.accountId ? accountMap.get(entry.accountId)?.name || '' : '';
          const toName = entry.toAccountId ? accountMap.get(entry.toAccountId)?.name || '' : '';
          const hay = `${entry.description} ${entry.category} ${entry.counterparty || ''} ${entry.ownerName || ''} ${fromName} ${toName} ${entry.notes || ''}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => b.date - a.date);
  }, [
    entries,
    startMs,
    endMs,
    scopeFilter,
    ownerFilter,
    typeFilter,
    accountFilter,
    categoryFilter,
    search,
    accountMap
  ]);

  const distinctCategories = useMemo(() => {
    const s = new Set<string>();
    entries.forEach(e => {
      if (e.category) s.add(e.category);
    });
    return Array.from(s).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [entries]);

  const startEditEntry = (entry: FinancialEntry) => {
    setEditingId(entry.id);
    setConfirmDeleteId(null);
    setEditDesc(entry.description);
    setEditAmount(Number(entry.amount).toFixed(2));
    setEditCategory(entry.category || 'Outros');
    setEditScope(entry.scope);
    setEditOwnerId(entry.ownerId || '');
    setEditAccountId(entry.accountId || '');
    setEditMethod(entry.paymentMethod || 'pix');
  };

  const handleSaveEditEntry = async (entry: FinancialEntry) => {
    const parsed = parseFloat(editAmount);
    if (!editDesc.trim() || isNaN(parsed) || parsed <= 0) return;
    const matchedOwner = owners.find(o => o.id === editOwnerId);
    const res = await onUpdateEntry(entry.id, {
      description: editDesc.trim(),
      amount: parsed,
      category: editCategory,
      scope: entry.type === 'transfer' ? 'company' : editScope,
      ownerId: editScope === 'personal' ? matchedOwner?.id || '' : '',
      ownerName: editScope === 'personal' ? matchedOwner?.name || entry.ownerName || 'Particular' : '',
      accountId: editAccountId,
      paymentMethod: editMethod,
      editedBy: activeOperator || 'Admin'
    });
    if (res.ok) setEditingId(null);
  };

  const handleExportCsv = () => {
    exportToCsv(
      `financeiro_${startDate}_a_${endDate}`,
      ['Data', 'Tipo', 'Classificação', 'Titular', 'Descrição', 'Categoria', 'Conta Origem', 'Conta Destino', 'Forma', 'Valor (R$)'],
      filteredEntries.map(e => [
        new Date(e.date).toLocaleString('pt-BR'),
        e.type === 'income' ? 'Receita' : e.type === 'expense' ? 'Despesa' : 'Depósito/Transferência',
        e.scope === 'company' ? 'Empresa' : 'Particular',
        e.ownerName || '',
        e.description,
        e.category,
        e.accountId ? accountMap.get(e.accountId)?.name || '' : '',
        e.toAccountId ? accountMap.get(e.toAccountId)?.name || '' : '',
        PAYMENT_METHOD_LABELS[e.paymentMethod || ''] || e.paymentMethod || '',
        (Number(e.amount) || 0).toFixed(2).replace('.', ',')
      ])
    );
  };

  const pendingPayablesCount = useMemo(
    () => payables.filter(p => p.status === 'pending').length,
    [payables]
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
            <Landmark className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            <span>Gestão Financeira</span>
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            Receitas, despesas, depósitos em contas e contas a pagar com separação Empresa × Particular
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 print:hidden">
          {deviceConfig?.enableCsvExport && (
            <button
              type="button"
              onClick={handleExportCsv}
              className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 px-3.5 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>CSV</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 px-3.5 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium transition-colors"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir</span>
          </button>
        </div>
      </div>

      {/* Global Scope & Period Filter Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm p-4 sm:p-5 space-y-4 print:hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Scope Segmented Switcher */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
              {[
                { id: 'all', label: 'Tudo', icon: Landmark },
                { id: 'company', label: 'Empresa', icon: Building2 },
                { id: 'personal', label: 'Particular', icon: User }
              ].map(opt => {
                const Icon = opt.icon;
                const active = scopeFilter === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setScopeFilter(opt.id as any);
                      if (opt.id !== 'personal') setOwnerFilter('all');
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                      active
                        ? opt.id === 'personal'
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : opt.id === 'company'
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Owner Filter when Particular is active */}
            {scopeFilter === 'personal' && owners.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setOwnerFilter('all')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                    ownerFilter === 'all'
                      ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-400 text-indigo-700 dark:text-indigo-300'
                      : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  Todos os titulares
                </button>
                {owners.map(o => {
                  const col = getOwnerColorClasses(o.color);
                  const active = ownerFilter === o.id;
                  return (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => setOwnerFilter(o.id)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                        active
                          ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-500 text-indigo-700 dark:text-indigo-200'
                          : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${col.dot}`} />
                      <span>{o.name}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Period Presets */}
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: 'thisMonth', label: 'Este Mês' },
              { id: 'lastMonth', label: 'Mês Ant.' },
              { id: 'last7', label: '7 dias' },
              { id: 'today', label: 'Hoje' },
              { id: 'thisYear', label: 'Ano' },
              { id: 'all', label: 'Tudo' }
            ].map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => handlePeriodPreset(p.id as any)}
                className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 hover:text-emerald-700 dark:hover:text-emerald-300 text-slate-700 dark:text-slate-300 transition-colors"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <div className="flex flex-wrap items-center gap-2.5 text-xs">
            <label className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 font-medium">
              <Calendar className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>De:</span>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 font-medium"
              />
            </label>
            <label className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 font-medium">
              <span>Até:</span>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 font-medium"
              />
            </label>
          </div>

          <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includeParkingRevenue}
              onChange={e => setIncludeParkingRevenue(e.target.checked)}
              className="w-4 h-4 rounded accent-emerald-600"
            />
            <span>Incluir faturamento do Estacionamento na Empresa</span>
          </label>
        </div>
      </div>

      {/* 4-KPI Executive Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* KPI 1: Lucro Operacional Empresa */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between gap-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Lucro Operacional (Empresa)
              </p>
              <p
                className={`text-2xl font-bold tabular-nums mt-1 ${
                  summary.companyOperationalProfit >= 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-red-600 dark:text-red-400'
                }`}
              >
                R$ {summary.companyOperationalProfit.toFixed(2)}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
          </div>
          <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 space-y-1 text-xs tabular-nums">
            <div className="flex justify-between text-slate-600 dark:text-slate-300">
              <span>Receitas Empresa:</span>
              <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                +R$ {summary.companyTotalIncome.toFixed(2)}
              </span>
            </div>
            {includeParkingRevenue && (
              <div className="flex justify-between text-[11px] text-slate-400 dark:text-slate-500">
                <span>Estacionamento / Avulsas:</span>
                <span>
                  R$ {summary.companyParkingRevenue.toFixed(0)} / R$ {summary.companyManualIncome.toFixed(0)}
                </span>
              </div>
            )}
            <div className="flex justify-between text-slate-600 dark:text-slate-300">
              <span>Despesas Empresa:</span>
              <span className="font-semibold text-red-600 dark:text-red-400">
                -R$ {summary.companyExpenses.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* KPI 2: Despesas Particulares */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between gap-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Despesas Particulares
              </p>
              <p className="text-2xl font-bold text-indigo-700 dark:text-indigo-300 tabular-nums mt-1">
                R$ {summary.personalExpenses.toFixed(2)}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
          </div>
          <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 space-y-1 text-xs tabular-nums">
            {summary.personalByOwner.filter(o => o.spent > 0).length > 0 ? (
              summary.personalByOwner
                .filter(o => o.spent > 0)
                .slice(0, 3)
                .map(o => {
                  const found = o.ownerId ? ownerMap.get(o.ownerId) : undefined;
                  const col = getOwnerColorClasses(found?.color);
                  return (
                    <div key={o.ownerKey} className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                      <span className="flex items-center gap-1.5 truncate">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${col.dot}`} />
                        <span className="truncate">{o.ownerName}</span>
                      </span>
                      <span className="font-semibold text-slate-900 dark:text-slate-100 shrink-0">
                        R$ {o.spent.toFixed(2)}
                      </span>
                    </div>
                  );
                })
            ) : (
              <p className="text-slate-400 dark:text-slate-500 text-[11px]">
                Nenhum gasto particular registrado no período.
              </p>
            )}
          </div>
        </div>

        {/* KPI 3: Contas a Pagar */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between gap-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Contas a Pagar (Até {endDate.split('-').reverse().join('/')})
              </p>
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 tabular-nums mt-1">
                R$ {summary.pendingPayablesTotal.toFixed(2)}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 flex items-center justify-center shrink-0">
              <CalendarClock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
          </div>
          <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 space-y-1 text-xs tabular-nums">
            <div className="flex justify-between text-slate-600 dark:text-slate-300">
              <span>Empresa / Particular:</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                R$ {summary.pendingPayablesCompany.toFixed(0)} / R$ {summary.pendingPayablesPersonal.toFixed(0)}
              </span>
            </div>
            {summary.overduePayablesCount > 0 || summary.dueTodayPayablesCount > 0 ? (
              <button
                type="button"
                onClick={() => setActiveTab('payables')}
                className="flex items-center gap-1 text-[11px] font-bold text-red-600 dark:text-red-400 hover:underline"
              >
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>
                  {summary.overduePayablesCount > 0 && `${summary.overduePayablesCount} vencida(s)`}
                  {summary.overduePayablesCount > 0 && summary.dueTodayPayablesCount > 0 && ' · '}
                  {summary.dueTodayPayablesCount > 0 && `${summary.dueTodayPayablesCount} vence(m) hoje`}
                </span>
              </button>
            ) : (
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                Nenhuma conta vencida no momento
              </p>
            )}
          </div>
        </div>

        {/* KPI 4: Saldo Total nas Contas */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between gap-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Saldo em Contas & Bancos
              </p>
              <p
                className={`text-2xl font-bold tabular-nums mt-1 ${
                  summary.totalAccountsBalance >= 0
                    ? 'text-slate-900 dark:text-slate-100'
                    : 'text-red-600 dark:text-red-400'
                }`}
              >
                R$ {summary.totalAccountsBalance.toFixed(2)}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
              <Wallet className="w-5 h-5 text-slate-700 dark:text-slate-300" />
            </div>
          </div>
          <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 space-y-1 text-xs tabular-nums">
            <div className="flex justify-between text-slate-600 dark:text-slate-300">
              <span>Previsto após contas:</span>
              <span
                className={`font-bold ${
                  summary.projectedBalanceAfterPayables >= 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-red-600 dark:text-red-400'
                }`}
              >
                R$ {summary.projectedBalanceAfterPayables.toFixed(2)}
              </span>
            </div>
            {accounts.length === 0 ? (
              <button
                type="button"
                onClick={() => setActiveTab('accounts')}
                className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 hover:underline"
              >
                + Cadastrar bancos / caixa
              </button>
            ) : (
              <p className="text-[11px] text-slate-400 dark:text-slate-500">
                {accounts.length} {accounts.length === 1 ? 'conta cadastrada' : 'contas cadastradas'}
                {summary.transfersTotal > 0 ? ` · Depósitos: R$ ${summary.transfersTotal.toFixed(0)}` : ''}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Primary Section Tabs */}
      <div className="flex items-center gap-1.5 border-b border-slate-200 dark:border-slate-800 overflow-x-auto print:hidden">
        {[
          { id: 'entries', label: 'Lançamentos', count: filteredEntries.length },
          { id: 'payables', label: 'Contas a Pagar', count: pendingPayablesCount, alert: summary.overduePayablesCount > 0 },
          { id: 'accounts', label: 'Contas & Bancos', count: accounts.length },
          { id: 'owners', label: 'Titulares (Particular)', count: owners.length },
          { id: 'categories', label: 'Categorias', count: effectiveCategories.length }
        ].map(tab => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as FinanceTab)}
              className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap shrink-0 flex items-center gap-2 ${
                active
                  ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`text-xs px-1.5 py-0.5 rounded-md tabular-nums ${
                  tab.alert
                    ? 'bg-red-100 dark:bg-red-950/70 text-red-700 dark:text-red-300 font-bold'
                    : active
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: LANÇAMENTOS (Entradas, Saídas e Depósitos/Transferências) */}
      {activeTab === 'entries' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: New Entry Form */}
          <div className="lg:col-span-1 print:hidden">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm p-5 sm:p-6 space-y-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Novo Lançamento
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Registre receitas, despesas ou depósitos entre contas.
                </p>
              </div>

              {/* Type Switcher */}
              <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                <button
                  type="button"
                  onClick={() => handleSwitchFormType('expense')}
                  className={`py-2 px-2 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1 ${
                    formType === 'expense'
                      ? 'bg-white dark:bg-slate-900 text-red-600 dark:text-red-400 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <ArrowDownRight className="w-3.5 h-3.5" />
                  <span>Despesa</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSwitchFormType('income')}
                  className={`py-2 px-2 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1 ${
                    formType === 'income'
                      ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  <span>Receita</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSwitchFormType('transfer')}
                  className={`py-2 px-2 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1 ${
                    formType === 'transfer'
                      ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <ArrowLeftRight className="w-3.5 h-3.5" />
                  <span>Depósito</span>
                </button>
              </div>

              {formError && (
                <div className="p-2.5 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-xs font-semibold text-red-700 dark:text-red-300">
                  {formError}
                </div>
              )}

              <form onSubmit={handleSubmitEntry} className="space-y-3.5">
                {formType !== 'transfer' ? (
                  <>
                    {/* Scope: Empresa x Particular */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Classificação
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => handleSwitchFormScope('company')}
                          className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold border transition-colors ${
                            formScope === 'company'
                              ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 text-emerald-700 dark:text-emerald-300'
                              : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          <Building2 className="w-3.5 h-3.5" />
                          <span>Empresa</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSwitchFormScope('personal')}
                          className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold border transition-colors ${
                            formScope === 'personal'
                              ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-500 text-indigo-700 dark:text-indigo-300'
                              : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          <User className="w-3.5 h-3.5" />
                          <span>Particular</span>
                        </button>
                      </div>
                    </div>

                    {/* Owner selector when Particular */}
                    {formScope === 'personal' && (
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                            Titular (Quem realizou?)
                          </label>
                          <button
                            type="button"
                            onClick={() => setActiveTab('owners')}
                            className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                          >
                            Gerenciar titulares
                          </button>
                        </div>
                        {owners.length > 0 ? (
                          <select
                            value={formOwnerId}
                            onChange={e => setFormOwnerId(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                          >
                            {owners.map(o => (
                              <option key={o.id} value={o.id}>
                                {o.name}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="text"
                            value={formCustomOwnerName}
                            onChange={e => setFormCustomOwnerName(e.target.value)}
                            placeholder="Ex: Dono, Esposa, Casa..."
                            className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                          />
                        )}
                      </div>
                    )}

                    {/* Category */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                          Categoria
                        </label>
                        <button
                          type="button"
                          onClick={() =>
                            handleOpenCategoriesShortcut(
                              formType === 'income' ? 'income' : 'expense',
                              formScope
                            )
                          }
                          className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 hover:underline"
                        >
                          Gerenciar categorias
                        </button>
                      </div>
                      <select
                        value={formCategory}
                        onChange={e => setFormCategory(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                      >
                        {formCategoryOptions.map(cat => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Account & Payment Method */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Conta / Banco
                        </label>
                        <select
                          value={formAccountId}
                          onChange={e => setFormAccountId(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                        >
                          <option value="">Sem conta vinculada</option>
                          {accounts.map(acc => (
                            <option key={acc.id} value={acc.id}>
                              {acc.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Forma
                        </label>
                        <select
                          value={formMethod}
                          onChange={e => setFormMethod(e.target.value as FinancialPaymentMethod)}
                          className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                        >
                          {Object.entries(PAYMENT_METHOD_LABELS).map(([k, label]) => (
                            <option key={k} value={k}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </>
                ) : (
                  /* Transfer / Deposit Fields */
                  <div className="space-y-3">
                    {accounts.length < 2 ? (
                      <div className="p-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 space-y-2 text-xs text-blue-800 dark:text-blue-200">
                        <p className="font-semibold">
                          Cadastre pelo menos 2 contas (ex: Caixa e Banco) para fazer depósitos ou transferências.
                        </p>
                        <button
                          type="button"
                          onClick={() => setActiveTab('accounts')}
                          className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold"
                        >
                          Ir para Contas & Bancos
                        </button>
                      </div>
                    ) : (
                      <>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          Move saldo de uma conta para outra sem contar como despesa nem duplicar receita.
                        </p>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Sai de (Conta Origem)
                          </label>
                          <select
                            value={formAccountId}
                            onChange={e => setFormAccountId(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100"
                          >
                            <option value="">Selecione a origem</option>
                            {accounts.map(a => (
                              <option key={a.id} value={a.id}>
                                {a.name} ({a.scope === 'company' ? 'Empresa' : 'Part.'})
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Entra em (Conta Destino)
                          </label>
                          <select
                            value={formToAccountId}
                            onChange={e => setFormToAccountId(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100"
                          >
                            <option value="">Selecione o destino</option>
                            {accounts.map(a => (
                              <option key={a.id} value={a.id}>
                                {a.name} ({a.scope === 'company' ? 'Empresa' : 'Part.'})
                              </option>
                            ))}
                          </select>
                        </div>
                      </>
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Descrição
                  </label>
                  <input
                    type="text"
                    required
                    value={formDescription}
                    onChange={e => setFormDescription(e.target.value)}
                    placeholder={
                      formType === 'transfer'
                        ? 'Ex: Depósito do caixa no banco'
                        : formType === 'income'
                          ? 'Ex: Receita extra, reembolso...'
                          : formScope === 'personal'
                            ? 'Ex: Supermercado, farmácia...'
                            : 'Ex: Compra de materiais, energia...'
                    }
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Valor (R$)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      value={formAmount}
                      onChange={e => setFormAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Data
                    </label>
                    <input
                      type="date"
                      required
                      value={formDate}
                      onChange={e => setFormDate(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                    />
                  </div>
                </div>

                {formType !== 'transfer' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Fornecedor / Origem (opcional)
                    </label>
                    <input
                      type="text"
                      value={formCounterparty}
                      onChange={e => setFormCounterparty(e.target.value)}
                      placeholder="Opcional"
                      className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                    />
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSavingEntry || (formType === 'transfer' && accounts.length < 2)}
                  className={`w-full py-2.5 text-white rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50 ${
                    formType === 'income'
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : formType === 'transfer'
                        ? 'bg-blue-600 hover:bg-blue-700'
                        : 'bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 dark:hover:bg-slate-600'
                  }`}
                >
                  <Plus className="w-4 h-4" />
                  <span>
                    {isSavingEntry
                      ? 'Salvando...'
                      : formType === 'income'
                        ? 'Registrar Receita'
                        : formType === 'transfer'
                          ? 'Registrar Depósito / Transferência'
                          : 'Registrar Despesa'}
                  </span>
                </button>
              </form>
            </div>
          </div>

          {/* Right: Breakdown + Ledger */}
          <div className="lg:col-span-2 space-y-5">
            {/* Compact Breakdown Row (only when data exists) */}
            {(summary.expensesByCategory.length > 0 || summary.personalByOwner.some(o => o.spent > 0)) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {summary.expensesByCategory.length > 0 && (
                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm p-4 sm:p-5 space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Despesas por Categoria
                    </h3>
                    <div className="space-y-2.5">
                      {summary.expensesByCategory.slice(0, 5).map(cat => (
                        <div key={cat.category} className="space-y-1">
                          <div className="flex justify-between text-xs tabular-nums">
                            <span className="font-medium text-slate-700 dark:text-slate-200 truncate pr-2">
                              {cat.category}
                            </span>
                            <span className="font-bold text-slate-900 dark:text-slate-100 shrink-0">
                              R$ {cat.amount.toFixed(2)}{' '}
                              <span className="text-slate-400 font-normal">({cat.percent.toFixed(0)}%)</span>
                            </span>
                          </div>
                          <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-slate-800 dark:bg-emerald-500 rounded-full"
                              style={{ width: `${Math.max(4, Math.min(100, cat.percent))}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {summary.personalByOwner.some(o => o.spent > 0 || o.pendingPayables > 0) && (
                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm p-4 sm:p-5 space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Particular por Titular
                    </h3>
                    <div className="space-y-2.5">
                      {summary.personalByOwner
                        .filter(o => o.spent > 0 || o.pendingPayables > 0)
                        .map(item => {
                          const found = item.ownerId ? ownerMap.get(item.ownerId) : undefined;
                          const col = getOwnerColorClasses(found?.color);
                          const pct =
                            summary.personalExpenses > 0
                              ? (item.spent / summary.personalExpenses) * 100
                              : 0;
                          return (
                            <button
                              key={item.ownerKey}
                              type="button"
                              onClick={() => {
                                setScopeFilter('personal');
                                setOwnerFilter(item.ownerId || item.ownerName);
                              }}
                              className="w-full text-left space-y-1 hover:opacity-80 transition-opacity"
                            >
                              <div className="flex justify-between text-xs tabular-nums">
                                <span className="flex items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-200 truncate">
                                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${col.dot}`} />
                                  <span className="truncate">{item.ownerName}</span>
                                </span>
                                <span className="font-bold text-slate-900 dark:text-slate-100 shrink-0">
                                  R$ {item.spent.toFixed(2)}
                                  {item.pendingPayables > 0 && (
                                    <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400 ml-1">
                                      (+R$ {item.pendingPayables.toFixed(0)} a pagar)
                                    </span>
                                  )}
                                </span>
                              </div>
                              <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${col.dot}`}
                                  style={{ width: `${Math.max(item.spent > 0 ? 5 : 0, Math.min(100, pct))}%` }}
                                />
                              </div>
                            </button>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Financial Entries Ledger */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
              <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                      Extrato Financeiro
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                      {filteredEntries.length} {filteredEntries.length === 1 ? 'lançamento' : 'lançamentos'} no período
                    </p>
                  </div>

                  <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl overflow-x-auto print:hidden">
                    {[
                      { id: 'all', label: 'Todos' },
                      { id: 'income', label: 'Receitas' },
                      { id: 'expense', label: 'Despesas' },
                      { id: 'transfer', label: 'Depósitos' }
                    ].map(t => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setTypeFilter(t.id as any)}
                        className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                          typeFilter === t.id
                            ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                            : 'text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 print:hidden">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      placeholder="Buscar por descrição, categoria, titular, conta..."
                      className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                    />
                  </div>
                  {accounts.length > 0 && (
                    <select
                      value={accountFilter}
                      onChange={e => setAccountFilter(e.target.value)}
                      className="px-3 py-2 text-xs font-medium bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-200"
                    >
                      <option value="all">Todas as contas</option>
                      {accounts.map(a => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  )}
                  {distinctCategories.length > 0 && (
                    <select
                      value={categoryFilter}
                      onChange={e => setCategoryFilter(e.target.value)}
                      className="px-3 py-2 text-xs font-medium bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-200"
                    >
                      <option value="all">Todas categorias</option>
                      {distinctCategories.map(c => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              <div className="p-3 sm:p-4 space-y-2 max-h-[650px] overflow-y-auto print:max-h-none">
                {filteredEntries.length === 0 ? (
                  <div className="py-12 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-3">
                      <Landmark className="w-6 h-6 text-slate-400" />
                    </div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      Nenhum lançamento financeiro encontrado
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Cadastre receitas, despesas ou depósitos no formulário ao lado.
                    </p>
                  </div>
                ) : (
                  filteredEntries.map(entry => {
                    const isEditing = editingId === entry.id;
                    const isConfirmingDelete = confirmDeleteId === entry.id;
                    const fromAcc = entry.accountId ? accountMap.get(entry.accountId) : undefined;
                    const toAcc = entry.toAccountId ? accountMap.get(entry.toAccountId) : undefined;
                    const ownerObj = entry.ownerId
                      ? ownerMap.get(entry.ownerId)
                      : owners.find(o => o.name.toLowerCase() === (entry.ownerName || '').toLowerCase());
                    const ownerCol = ownerObj ? getOwnerColorClasses(ownerObj.color) : null;

                    if (isEditing) {
                      const editCats = getCategoryNamesFor(
                        effectiveCategories,
                        entry.type === 'income' ? 'income' : 'expense',
                        editScope
                      );

                      return (
                        <div
                          key={entry.id}
                          className="p-4 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-emerald-400 dark:border-emerald-700 space-y-3"
                        >
                          <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
                            Editando lançamento financeiro
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            <input
                              type="text"
                              value={editDesc}
                              onChange={e => setEditDesc(e.target.value)}
                              className="sm:col-span-2 px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                            />
                            {entry.type !== 'transfer' && (
                              <>
                                <select
                                  value={editScope}
                                  onChange={e => setEditScope(e.target.value as FinancialScope)}
                                  className="px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                                >
                                  <option value="company">Empresa</option>
                                  <option value="personal">Particular</option>
                                </select>
                                {editScope === 'personal' && owners.length > 0 && (
                                  <select
                                    value={editOwnerId}
                                    onChange={e => setEditOwnerId(e.target.value)}
                                    className="px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                                  >
                                    <option value="">Sem titular</option>
                                    {owners.map(o => (
                                      <option key={o.id} value={o.id}>
                                        {o.name}
                                      </option>
                                    ))}
                                  </select>
                                )}
                                <select
                                  value={editCategory}
                                  onChange={e => setEditCategory(e.target.value)}
                                  className="px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                                >
                                  {editCats.map(c => (
                                    <option key={c} value={c}>
                                      {c}
                                    </option>
                                  ))}
                                  {!editCats.includes(editCategory) && (
                                    <option value={editCategory}>{editCategory}</option>
                                  )}
                                </select>
                                <select
                                  value={editMethod}
                                  onChange={e => setEditMethod(e.target.value as FinancialPaymentMethod)}
                                  className="px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                                >
                                  {Object.entries(PAYMENT_METHOD_LABELS).map(([k, label]) => (
                                    <option key={k} value={k}>
                                      {label}
                                    </option>
                                  ))}
                                </select>
                              </>
                            )}
                            <select
                              value={editAccountId}
                              onChange={e => setEditAccountId(e.target.value)}
                              className="px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                            >
                              <option value="">Sem conta</option>
                              {accounts.map(a => (
                                <option key={a.id} value={a.id}>
                                  {a.name}
                                </option>
                              ))}
                            </select>
                            <input
                              type="number"
                              step="0.01"
                              min="0.01"
                              value={editAmount}
                              onChange={e => setEditAmount(e.target.value)}
                              className="px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 tabular-nums"
                            />
                            <div className="sm:col-span-2 flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => setEditingId(null)}
                                className="px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg flex items-center gap-1"
                              >
                                <X className="w-3.5 h-3.5" /> Cancelar
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSaveEditEntry(entry)}
                                className="px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg flex items-center gap-1"
                              >
                                <Check className="w-3.5 h-3.5" /> Salvar
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={entry.id}
                        className="flex items-center justify-between gap-3 p-3.5 sm:p-4 bg-slate-50/80 dark:bg-slate-800/40 hover:bg-slate-100/70 dark:hover:bg-slate-800/70 rounded-xl border border-slate-200/70 dark:border-slate-800 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`p-2 rounded-lg shrink-0 ${
                              entry.type === 'income'
                                ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                                : entry.type === 'transfer'
                                  ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400'
                                  : 'bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400'
                            }`}
                          >
                            {entry.type === 'income' ? (
                              <ArrowUpRight className="w-4 h-4" />
                            ) : entry.type === 'transfer' ? (
                              <ArrowLeftRight className="w-4 h-4" />
                            ) : (
                              <ArrowDownRight className="w-4 h-4" />
                            )}
                          </div>

                          <div className="min-w-0">
                            <p className="font-semibold text-sm text-slate-900 dark:text-slate-100 truncate">
                              {entry.description}
                            </p>
                            <div className="text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 mt-0.5">
                              <span className="tabular-nums">
                                {new Date(entry.date).toLocaleDateString('pt-BR')}
                              </span>
                              <span>·</span>
                              {entry.type === 'transfer' ? (
                                <span className="font-semibold text-blue-700 dark:text-blue-300">
                                  {fromAcc?.name || 'Origem'} → {toAcc?.name || 'Destino'}
                                </span>
                              ) : (
                                <>
                                  <span className="inline-flex items-center gap-1 font-semibold">
                                    {entry.scope === 'company' ? (
                                      <span className="text-emerald-700 dark:text-emerald-400">Empresa</span>
                                    ) : (
                                      <>
                                        <span
                                          className={`w-2 h-2 rounded-full ${
                                            ownerCol ? ownerCol.dot : 'bg-indigo-500'
                                          }`}
                                        />
                                        <span className="text-indigo-700 dark:text-indigo-300">
                                          Particular{entry.ownerName ? ` · ${entry.ownerName}` : ''}
                                        </span>
                                      </>
                                    )}
                                  </span>
                                  <span>·</span>
                                  <span>{entry.category}</span>
                                  {fromAcc && (
                                    <>
                                      <span>·</span>
                                      <span>{fromAcc.name}</span>
                                    </>
                                  )}
                                  {entry.paymentMethod && (
                                    <>
                                      <span>·</span>
                                      <span>{PAYMENT_METHOD_LABELS[entry.paymentMethod] || entry.paymentMethod}</span>
                                    </>
                                  )}
                                </>
                              )}
                              {entry.counterparty && (
                                <>
                                  <span>·</span>
                                  <span>{entry.counterparty}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span
                            className={`font-bold text-sm tabular-nums ${
                              entry.type === 'income'
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : entry.type === 'transfer'
                                  ? 'text-blue-600 dark:text-blue-400'
                                  : 'text-red-600 dark:text-red-400'
                            }`}
                          >
                            {entry.type === 'income' ? '+ ' : entry.type === 'expense' ? '- ' : '⇄ '}
                            R$ {(Number(entry.amount) || 0).toFixed(2)}
                          </span>

                          <div className="flex items-center gap-1 print:hidden">
                            {!isConfirmingDelete && (
                              <button
                                type="button"
                                onClick={() => startEditEntry(entry)}
                                className="p-1.5 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                                title="Editar"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {isConfirmingDelete ? (
                              <div className="flex items-center gap-1 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 rounded-lg px-2 py-1">
                                <span className="text-[11px] font-semibold text-red-700 dark:text-red-300">
                                  Excluir?
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(null)}
                                  className="px-1.5 py-0.5 text-[11px] text-slate-600 dark:text-slate-300"
                                >
                                  Não
                                </button>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    await onDeleteEntry(entry.id);
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
                                className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                                title="Excluir"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CONTAS A PAGAR */}
      {activeTab === 'payables' && (
        <FinancePayablesTab
          payables={payables}
          accounts={accounts}
          owners={owners}
          categories={effectiveCategories}
          scopeFilter={scopeFilter}
          ownerFilter={ownerFilter}
          activeOperator={activeOperator}
          onAddPayable={onAddPayable}
          onUpdatePayable={onUpdatePayable}
          onPayPayable={onPayPayable}
          onDeletePayable={onDeletePayable}
          onOpenCategories={(t, s) => handleOpenCategoriesShortcut(t, s)}
        />
      )}

      {/* TAB 3: CONTAS & BANCOS */}
      {activeTab === 'accounts' && (
        <FinanceAccountsSection
          accountBalances={accountBalances}
          onAddAccount={onAddAccount}
          onUpdateAccount={onUpdateAccount}
          onDeleteAccount={onDeleteAccount}
          onQuickTransferFrom={handleQuickTransferFrom}
        />
      )}

      {/* TAB 4: TITULARES (PARTICULAR) */}
      {activeTab === 'owners' && (
        <FinanceOwnersSection
          owners={owners}
          personalByOwner={summary.personalByOwner}
          onAddOwner={onAddOwner}
          onUpdateOwner={onUpdateOwner}
          onDeleteOwner={onDeleteOwner}
          onFilterByOwner={ownerId => {
            setScopeFilter('personal');
            setOwnerFilter(ownerId);
            setActiveTab('entries');
          }}
        />
      )}

      {/* TAB 5: CATEGORIAS (DESPESAS E RECEITAS) */}
      {activeTab === 'categories' && (
        <FinanceCategoriesTab
          categories={effectiveCategories}
          entries={entries}
          payables={payables}
          hasDeletedDefaults={hasDeletedDefaults}
          initialType={categoryShortcutPreset.type}
          initialScope={categoryShortcutPreset.scope}
          onAddCategory={onAddCategory}
          onUpdateCategory={onUpdateCategory}
          onDeleteCategory={onDeleteCategory}
          onRestoreDefaults={onRestoreDefaultCategories}
        />
      )}
    </div>
  );
}
