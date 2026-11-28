import React, { useMemo, useState } from 'react';
import {
  Building2,
  User,
  Plus,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Repeat,
  Search,
  Pencil,
  Trash2,
  Check,
  X,
  Calendar,
  Layers
} from 'lucide-react';
import {
  FinancialAccount,
  FinancialOwner,
  FinancialPayable,
  FinancialPaymentMethod,
  FinancialScope
} from '../types';
import {
  COMPANY_EXPENSE_CATEGORIES,
  PERSONAL_EXPENSE_CATEGORIES,
  PAYMENT_METHOD_LABELS,
  addMonthsToDateStr,
  formatDateBrShort,
  getPayableStatusInfo
} from '../lib/financeUtils';
import { getLocalDateString } from '../lib/dateUtils';
import { getOwnerColorClasses } from './FinanceAccountsOwnersTab';

export interface CreatePayablePayload {
  scope: FinancialScope;
  ownerId?: string;
  ownerName?: string;
  description: string;
  category: string;
  counterparty?: string;
  amount: number;
  dueDate: string;
  recurrence: 'none' | 'monthly';
  installments: number;
  notes?: string;
}

export interface PayPayablePayload {
  paidAmount: number;
  paidDate: number;
  accountId?: string;
  paymentMethod: FinancialPaymentMethod;
  notes?: string;
  operator?: string;
}

interface FinancePayablesTabProps {
  payables: FinancialPayable[];
  accounts: FinancialAccount[];
  owners: FinancialOwner[];
  scopeFilter: 'all' | FinancialScope;
  ownerFilter: string;
  activeOperator?: string;
  onAddPayable: (payload: CreatePayablePayload) => Promise<{ ok: boolean; error?: string }>;
  onUpdatePayable: (id: string, payload: Partial<FinancialPayable>) => Promise<{ ok: boolean; error?: string }>;
  onPayPayable: (id: string, payload: PayPayablePayload) => Promise<{ ok: boolean; error?: string }>;
  onDeletePayable: (id: string) => Promise<{ ok: boolean; error?: string }>;
}

export function FinancePayablesTab({
  payables,
  accounts,
  owners,
  scopeFilter,
  ownerFilter,
  activeOperator,
  onAddPayable,
  onUpdatePayable,
  onPayPayable,
  onDeletePayable
}: FinancePayablesTabProps) {
  const todayStr = getLocalDateString();

  // Create form state
  const [scope, setScope] = useState<FinancialScope>(scopeFilter === 'personal' ? 'personal' : 'company');
  const [ownerId, setOwnerId] = useState<string>(owners[0]?.id || '');
  const [customOwnerName, setCustomOwnerName] = useState('');
  const [description, setDescription] = useState('');
  const [counterparty, setCounterparty] = useState('');
  const [category, setCategory] = useState(COMPANY_EXPENSE_CATEGORIES[0]);
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState(todayStr);
  const [scheduleMode, setScheduleMode] = useState<'single' | 'monthly' | 'installments'>('single');
  const [installments, setInstallments] = useState('2');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState<'pending' | 'urgent' | 'paid' | 'all'>('pending');
  const [search, setSearch] = useState('');

  // Pay inline drawer state
  const [payingId, setPayingId] = useState<string | null>(null);
  const [payAccountId, setPayAccountId] = useState<string>('');
  const [payMethod, setPayMethod] = useState<FinancialPaymentMethod>('pix');
  const [payAmount, setPayAmount] = useState('');
  const [payDateStr, setPayDateStr] = useState(todayStr);
  const [payNotes, setPayNotes] = useState('');
  const [isPaying, setIsPaying] = useState(false);

  // Edit / delete state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDesc, setEditDesc] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editDueDate, setEditDueDate] = useState(todayStr);
  const [editCategory, setEditCategory] = useState('');
  const [editCounterparty, setEditCounterparty] = useState('');
  const [editScope, setEditScope] = useState<FinancialScope>('company');
  const [editOwnerId, setEditOwnerId] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const categoryOptions = scope === 'personal' ? PERSONAL_EXPENSE_CATEGORIES : COMPANY_EXPENSE_CATEGORIES;

  const handleSwitchScope = (next: FinancialScope) => {
    setScope(next);
    setCategory(next === 'personal' ? PERSONAL_EXPENSE_CATEGORIES[0] : COMPANY_EXPENSE_CATEGORIES[0]);
    if (next === 'personal' && !ownerId && owners.length > 0) {
      setOwnerId(owners[0].id);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (!description.trim() || !dueDate || isNaN(parsedAmount) || parsedAmount <= 0 || isSubmitting) return;

    const selectedOwner = owners.find(o => o.id === ownerId);
    const resolvedOwnerName =
      scope === 'personal'
        ? selectedOwner?.name || customOwnerName.trim() || 'Particular'
        : undefined;

    setIsSubmitting(true);
    try {
      const res = await onAddPayable({
        scope,
        ownerId: scope === 'personal' && selectedOwner ? selectedOwner.id : undefined,
        ownerName: resolvedOwnerName,
        description: description.trim(),
        category,
        counterparty: counterparty.trim() || undefined,
        amount: parsedAmount,
        dueDate,
        recurrence: scheduleMode === 'monthly' ? 'monthly' : 'none',
        installments: scheduleMode === 'installments' ? Math.max(2, Math.min(36, parseInt(installments, 10) || 2)) : 1,
        notes: notes.trim() || undefined
      });
      if (res.ok) {
        setDescription('');
        setCounterparty('');
        setAmount('');
        setNotes('');
        setScheduleMode('single');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const openPayDrawer = (payable: FinancialPayable) => {
    setPayingId(payable.id);
    setEditingId(null);
    setConfirmDeleteId(null);
    const matchingAccount =
      accounts.find(a => a.scope === payable.scope) || accounts[0];
    setPayAccountId(matchingAccount?.id || '');
    setPayMethod('pix');
    setPayAmount(Number(payable.amount).toFixed(2));
    setPayDateStr(todayStr);
    setPayNotes(payable.notes || '');
  };

  const handleConfirmPay = async (payable: FinancialPayable) => {
    const parsed = parseFloat(payAmount);
    if (isNaN(parsed) || parsed <= 0 || isPaying) return;
    setIsPaying(true);
    try {
      const [y, m, d] = (payDateStr || todayStr).split('-').map(Number);
      const now = new Date();
      const paidTs = new Date(y, (m || 1) - 1, d || 1, now.getHours(), now.getMinutes(), now.getSeconds()).getTime();
      const res = await onPayPayable(payable.id, {
        paidAmount: parsed,
        paidDate: paidTs,
        accountId: payAccountId || undefined,
        paymentMethod: payMethod,
        notes: payNotes.trim() || undefined,
        operator: activeOperator
      });
      if (res.ok) {
        setPayingId(null);
      }
    } finally {
      setIsPaying(false);
    }
  };

  const startEdit = (p: FinancialPayable) => {
    setEditingId(p.id);
    setPayingId(null);
    setConfirmDeleteId(null);
    setEditDesc(p.description);
    setEditAmount(Number(p.amount).toFixed(2));
    setEditDueDate(p.dueDate);
    setEditCategory(p.category);
    setEditCounterparty(p.counterparty || '');
    setEditScope(p.scope);
    setEditOwnerId(p.ownerId || '');
  };

  const handleSaveEdit = async (p: FinancialPayable) => {
    const parsed = parseFloat(editAmount);
    if (!editDesc.trim() || !editDueDate || isNaN(parsed) || parsed <= 0) return;
    const matchedOwner = owners.find(o => o.id === editOwnerId);
    const res = await onUpdatePayable(p.id, {
      description: editDesc.trim(),
      amount: parsed,
      dueDate: editDueDate,
      category: editCategory,
      counterparty: editCounterparty.trim(),
      scope: editScope,
      ownerId: editScope === 'personal' ? matchedOwner?.id || '' : '',
      ownerName: editScope === 'personal' ? matchedOwner?.name || p.ownerName || 'Particular' : ''
    });
    if (res.ok) setEditingId(null);
  };

  const filteredPayables = useMemo(() => {
    const q = search.trim().toLowerCase();
    return payables
      .filter(p => {
        if (scopeFilter !== 'all' && p.scope !== scopeFilter) return false;
        if (scopeFilter === 'personal' && ownerFilter !== 'all') {
          const matchesId = p.ownerId === ownerFilter;
          const matchesName = (p.ownerName || '').toLowerCase() === ownerFilter.toLowerCase();
          if (!matchesId && !matchesName) return false;
        }
        const info = getPayableStatusInfo(p, todayStr);
        if (statusFilter === 'pending' && p.status !== 'pending') return false;
        if (statusFilter === 'urgent' && !(p.status === 'pending' && (info.state === 'overdue' || info.state === 'due_today'))) {
          return false;
        }
        if (statusFilter === 'paid' && p.status !== 'paid') return false;
        if (q) {
          const hay = `${p.description} ${p.category} ${p.counterparty || ''} ${p.ownerName || ''} ${p.notes || ''}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (a.status !== b.status) return a.status === 'pending' ? -1 : 1;
        return String(a.dueDate || '').localeCompare(String(b.dueDate || ''));
      });
  }, [payables, scopeFilter, ownerFilter, statusFilter, search, todayStr]);

  const urgentCount = useMemo(
    () =>
      payables.filter(p => {
        if (p.status !== 'pending') return false;
        if (scopeFilter !== 'all' && p.scope !== scopeFilter) return false;
        const st = getPayableStatusInfo(p, todayStr).state;
        return st === 'overdue' || st === 'due_today';
      }).length,
    [payables, scopeFilter, todayStr]
  );

  const pendingTotalFiltered = useMemo(
    () =>
      filteredPayables
        .filter(p => p.status === 'pending')
        .reduce((acc, p) => acc + (Number(p.amount) || 0), 0),
    [filteredPayables]
  );

  const parsedInstallments = Math.max(2, Math.min(36, parseInt(installments, 10) || 2));
  const parsedAmountNum = parseFloat(amount) || 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left: Create Payable Form */}
      <div className="lg:col-span-1">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm p-5 sm:p-6">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-1">
            Nova Conta a Pagar
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
            Agende boletos, contas fixas mensais ou compras parceladas da empresa ou particulares.
          </p>

          <form onSubmit={handleCreateSubmit} className="space-y-3.5">
            {/* Scope Switch */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Classificação
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleSwitchScope('company')}
                  className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold border transition-colors ${
                    scope === 'company'
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 text-emerald-700 dark:text-emerald-300'
                      : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  <Building2 className="w-3.5 h-3.5" />
                  <span>Empresa</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSwitchScope('personal')}
                  className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold border transition-colors ${
                    scope === 'personal'
                      ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-500 text-indigo-700 dark:text-indigo-300'
                      : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  <User className="w-3.5 h-3.5" />
                  <span>Particular</span>
                </button>
              </div>
            </div>

            {/* Owner selector when Personal */}
            {scope === 'personal' && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Titular (Quem é o responsável?)
                </label>
                {owners.length > 0 ? (
                  <select
                    value={ownerId}
                    onChange={e => setOwnerId(e.target.value)}
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
                    value={customOwnerName}
                    onChange={e => setCustomOwnerName(e.target.value)}
                    placeholder="Ex: Dono, Esposa, Casa..."
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  />
                )}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Descrição da Conta
              </label>
              <input
                type="text"
                required
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder={scope === 'company' ? 'Ex: Energia elétrica, Aluguel...' : 'Ex: Fatura Cartão, Escola...'}
                className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Categoria
                </label>
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                >
                  {categoryOptions.map(c => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Fornecedor / Favorecido
                </label>
                <input
                  type="text"
                  value={counterparty}
                  onChange={e => setCounterparty(e.target.value)}
                  placeholder="Opcional"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {scheduleMode === 'installments' ? 'Valor por Parcela (R$)' : 'Valor (R$)'}
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {scheduleMode === 'installments' ? '1º Vencimento' : 'Vencimento'}
                </label>
                <input
                  type="date"
                  required
                  value={dueDate}
                  onChange={e => setDueDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
              </div>
            </div>

            {/* Schedule Mode */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Frequência
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { id: 'single', label: 'Única' },
                  { id: 'monthly', label: 'Mensal Fixa' },
                  { id: 'installments', label: 'Parcelada' }
                ].map(opt => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setScheduleMode(opt.id as any)}
                    className={`py-1.5 px-2 text-xs font-semibold rounded-xl border transition-colors ${
                      scheduleMode === opt.id
                        ? 'bg-slate-900 dark:bg-slate-100 border-slate-900 dark:border-slate-100 text-white dark:text-slate-900'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {scheduleMode === 'monthly' && (
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5">
                  Ao dar baixa nesta conta, o sistema gera automaticamente a do mês seguinte.
                </p>
              )}
              {scheduleMode === 'installments' && (
                <div className="mt-2 p-2.5 bg-slate-50 dark:bg-slate-800/70 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">Parcelas:</span>
                    <input
                      type="number"
                      min={2}
                      max={36}
                      value={installments}
                      onChange={e => setInstallments(e.target.value)}
                      className="w-16 px-2 py-1 text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 tabular-nums"
                    />
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 text-right tabular-nums">
                    {parsedAmountNum > 0 && (
                      <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                        Total: R$ {(parsedAmountNum * parsedInstallments).toFixed(2)}
                      </span>
                    )}
                    <span>Até {formatDateBrShort(addMonthsToDateStr(dueDate, parsedInstallments - 1))}</span>
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Observações (opcional)
              </label>
              <input
                type="text"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Ex: Código do boleto, referência..."
                className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !description.trim() || !amount}
              className="w-full py-2.5 bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-700 text-white rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              <span>
                {isSubmitting
                  ? 'Salvando...'
                  : scheduleMode === 'installments'
                    ? `Agendar ${parsedInstallments} Parcelas`
                    : 'Agendar Conta a Pagar'}
              </span>
            </button>
          </form>
        </div>
      </div>

      {/* Right: Payables List */}
      <div className="lg:col-span-2">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
          {/* Header + Filter Controls */}
          <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                  Contas a Pagar
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                  {filteredPayables.length} {filteredPayables.length === 1 ? 'conta listada' : 'contas listadas'}
                  {pendingTotalFiltered > 0 && ` · Em aberto na lista: R$ ${pendingTotalFiltered.toFixed(2)}`}
                </p>
              </div>

              <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl overflow-x-auto">
                {[
                  { id: 'pending', label: 'Pendentes' },
                  { id: 'urgent', label: urgentCount > 0 ? `Vencidas/Hoje (${urgentCount})` : 'Vencidas/Hoje' },
                  { id: 'paid', label: 'Pagas' },
                  { id: 'all', label: 'Todas' }
                ].map(tab => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setStatusFilter(tab.id as any)}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                      statusFilter === tab.id
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar por conta, fornecedor, categoria ou titular..."
                className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              />
            </div>
          </div>

          <div className="p-3 sm:p-4 space-y-2.5 max-h-[700px] overflow-y-auto">
            {filteredPayables.length === 0 ? (
              <div className="py-12 text-center">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-3">
                  <Calendar className="w-6 h-6 text-slate-400" />
                </div>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Nenhuma conta encontrada neste filtro
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Cadastre uma nova conta ao lado ou altere o filtro de status acima.
                </p>
              </div>
            ) : (
              filteredPayables.map(payable => {
                const statusInfo = getPayableStatusInfo(payable, todayStr);
                const ownerObj = owners.find(
                  o => o.id === payable.ownerId || o.name.toLowerCase() === (payable.ownerName || '').toLowerCase()
                );
                const ownerCol = ownerObj ? getOwnerColorClasses(ownerObj.color) : null;
                const isPayingThis = payingId === payable.id;
                const isEditingThis = editingId === payable.id;
                const isConfirmingDelete = confirmDeleteId === payable.id;

                const statusStyles =
                  statusInfo.state === 'paid'
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : statusInfo.state === 'overdue'
                      ? 'text-red-600 dark:text-red-400 font-bold'
                      : statusInfo.state === 'due_today'
                        ? 'text-amber-600 dark:text-amber-400 font-bold'
                        : statusInfo.state === 'due_soon'
                          ? 'text-amber-700 dark:text-amber-300 font-semibold'
                          : 'text-slate-500 dark:text-slate-400';

                const leftBorder =
                  statusInfo.state === 'overdue'
                    ? 'border-l-4 border-l-red-500'
                    : statusInfo.state === 'due_today'
                      ? 'border-l-4 border-l-amber-500'
                      : statusInfo.state === 'paid'
                        ? 'border-l-4 border-l-emerald-500'
                        : 'border-l-4 border-l-slate-300 dark:border-l-slate-700';

                if (isEditingThis) {
                  const editCats = editScope === 'personal' ? PERSONAL_EXPENSE_CATEGORIES : COMPANY_EXPENSE_CATEGORIES;
                  return (
                    <div
                      key={payable.id}
                      className="p-4 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-emerald-400 dark:border-emerald-700 space-y-3"
                    >
                      <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
                        Editando conta a pagar
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <input
                          type="text"
                          value={editDesc}
                          onChange={e => setEditDesc(e.target.value)}
                          className="sm:col-span-2 px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                        />
                        <select
                          value={editScope}
                          onChange={e => {
                            const next = e.target.value as FinancialScope;
                            setEditScope(next);
                            setEditCategory(
                              next === 'personal' ? PERSONAL_EXPENSE_CATEGORIES[0] : COMPANY_EXPENSE_CATEGORIES[0]
                            );
                          }}
                          className="px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                        >
                          <option value="company">Empresa</option>
                          <option value="personal">Particular</option>
                        </select>
                        {editScope === 'personal' && owners.length > 0 ? (
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
                        ) : (
                          <input
                            type="text"
                            value={editCounterparty}
                            onChange={e => setEditCounterparty(e.target.value)}
                            placeholder="Fornecedor"
                            className="px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                          />
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
                          {!editCats.includes(editCategory) && <option value={editCategory}>{editCategory}</option>}
                        </select>
                        <input
                          type="date"
                          value={editDueDate}
                          onChange={e => setEditDueDate(e.target.value)}
                          className="px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                        />
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={editAmount}
                          onChange={e => setEditAmount(e.target.value)}
                          className="px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 tabular-nums"
                        />
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg flex items-center gap-1"
                          >
                            <X className="w-3.5 h-3.5" /> Cancelar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(payable)}
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
                    key={payable.id}
                    className={`rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 overflow-hidden ${leftBorder}`}
                  >
                    <div className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p
                            className={`font-semibold text-sm ${
                              payable.status === 'paid'
                                ? 'text-slate-500 dark:text-slate-400 line-through'
                                : 'text-slate-900 dark:text-slate-100'
                            }`}
                          >
                            {payable.description}
                          </p>
                          {payable.recurrence === 'monthly' && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                              <Repeat className="w-3 h-3" /> Mensal
                            </span>
                          )}
                          {payable.installmentTotal && payable.installmentTotal > 1 && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                              <Layers className="w-3 h-3" /> {payable.installmentNumber}/{payable.installmentTotal}
                            </span>
                          )}
                        </div>

                        <div className="text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                          <span className="inline-flex items-center gap-1 font-semibold">
                            {payable.scope === 'company' ? (
                              <span className="text-emerald-700 dark:text-emerald-400">Empresa</span>
                            ) : (
                              <>
                                <span className={`w-2 h-2 rounded-full ${ownerCol ? ownerCol.dot : 'bg-indigo-500'}`} />
                                <span className="text-indigo-700 dark:text-indigo-300">
                                  Particular{payable.ownerName ? ` · ${payable.ownerName}` : ''}
                                </span>
                              </>
                            )}
                          </span>
                          <span>·</span>
                          <span className="tabular-nums">Venc: {formatDateBrShort(payable.dueDate)}</span>
                          <span>·</span>
                          <span className={`inline-flex items-center gap-1 ${statusStyles}`}>
                            {statusInfo.state === 'overdue' && <AlertTriangle className="w-3 h-3" />}
                            {statusInfo.state === 'due_today' && <Clock className="w-3 h-3" />}
                            {statusInfo.state === 'paid' && <CheckCircle2 className="w-3 h-3" />}
                            {statusInfo.label}
                          </span>
                          <span>·</span>
                          <span>{payable.category}</span>
                          {payable.counterparty && (
                            <>
                              <span>·</span>
                              <span>{payable.counterparty}</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-2.5 shrink-0">
                        <div className="text-left sm:text-right tabular-nums">
                          <span className="font-bold text-sm text-slate-900 dark:text-slate-100 block">
                            R$ {(Number(payable.paidAmount || payable.amount) || 0).toFixed(2)}
                          </span>
                          {payable.status === 'paid' && payable.paidDate && (
                            <span className="text-[11px] text-emerald-600 dark:text-emerald-400">
                              Pago em {new Date(payable.paidDate).toLocaleDateString('pt-BR')}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          {payable.status === 'pending' && (
                            <button
                              type="button"
                              onClick={() => (isPayingThis ? setPayingId(null) : openPayDrawer(payable))}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                                isPayingThis
                                  ? 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
                                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                              }`}
                            >
                              {isPayingThis ? 'Fechar' : 'Pagar'}
                            </button>
                          )}

                          {payable.status === 'pending' && !isConfirmingDelete && (
                            <button
                              type="button"
                              onClick={() => startEdit(payable)}
                              className="p-1.5 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                              title="Editar conta"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {isConfirmingDelete ? (
                            <div className="flex items-center gap-1 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 rounded-lg px-2 py-1">
                              <span className="text-[11px] font-semibold text-red-700 dark:text-red-300">Excluir?</span>
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
                                  await onDeletePayable(payable.id);
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
                                setConfirmDeleteId(payable.id);
                                setPayingId(null);
                                setEditingId(null);
                              }}
                              className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                              title="Excluir conta"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Inline Pay Drawer */}
                    {isPayingThis && (
                      <div className="px-4 pb-4 pt-3 border-t border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-900 space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                            Confirmar Pagamento (Baixa Automática)
                          </span>
                          {payable.recurrence === 'monthly' && (
                            <span className="text-[11px] text-slate-500 dark:text-slate-400">
                              Próximo mês ({formatDateBrShort(addMonthsToDateStr(payable.dueDate, 1))}) será criado automaticamente
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                              Conta de Saída
                            </label>
                            <select
                              value={payAccountId}
                              onChange={e => setPayAccountId(e.target.value)}
                              className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                            >
                              <option value="">Sem vincular conta</option>
                              {accounts.map(acc => (
                                <option key={acc.id} value={acc.id}>
                                  {acc.name} ({acc.scope === 'company' ? 'Empresa' : 'Part.'})
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                              Forma de Pagamento
                            </label>
                            <select
                              value={payMethod}
                              onChange={e => setPayMethod(e.target.value as FinancialPaymentMethod)}
                              className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                            >
                              {Object.entries(PAYMENT_METHOD_LABELS).map(([k, label]) => (
                                <option key={k} value={k}>
                                  {label}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                              Valor Pago (R$)
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              min="0.01"
                              value={payAmount}
                              onChange={e => setPayAmount(e.target.value)}
                              className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 tabular-nums"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                              Data do Pagamento
                            </label>
                            <input
                              type="date"
                              value={payDateStr}
                              onChange={e => setPayDateStr(e.target.value)}
                              className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                            />
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
                          <input
                            type="text"
                            value={payNotes}
                            onChange={e => setPayNotes(e.target.value)}
                            placeholder="Observação do pagamento (opcional)"
                            className="flex-1 px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                          />
                          <div className="flex items-center justify-end gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => setPayingId(null)}
                              className="px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-lg"
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              disabled={isPaying}
                              onClick={() => handleConfirmPay(payable)}
                              className="px-3.5 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg flex items-center gap-1.5 disabled:opacity-50"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>{isPaying ? 'Processando...' : 'Confirmar Pagamento'}</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
