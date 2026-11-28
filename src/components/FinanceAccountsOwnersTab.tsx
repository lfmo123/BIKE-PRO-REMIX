import React, { useState } from 'react';
import {
  Building2,
  User,
  Landmark,
  Wallet,
  Vault,
  Smartphone,
  CreditCard,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  ArrowLeftRight,
  Users
} from 'lucide-react';
import {
  FinancialAccount,
  FinancialAccountType,
  FinancialOwner,
  FinancialScope
} from '../types';
import {
  ACCOUNT_TYPE_LABELS,
  ComputedAccountBalance,
  OwnerSpendingSummary
} from '../lib/financeUtils';

export const OWNER_COLORS: { id: NonNullable<FinancialOwner['color']>; label: string; dot: string; ring: string; text: string }[] = [
  { id: 'indigo', label: 'Índigo', dot: 'bg-indigo-500', ring: 'ring-indigo-400', text: 'text-indigo-700 dark:text-indigo-300' },
  { id: 'rose', label: 'Rosa', dot: 'bg-rose-500', ring: 'ring-rose-400', text: 'text-rose-700 dark:text-rose-300' },
  { id: 'amber', label: 'Âmbar', dot: 'bg-amber-500', ring: 'ring-amber-400', text: 'text-amber-700 dark:text-amber-300' },
  { id: 'teal', label: 'Verde-água', dot: 'bg-teal-500', ring: 'ring-teal-400', text: 'text-teal-700 dark:text-teal-300' },
  { id: 'violet', label: 'Violeta', dot: 'bg-violet-500', ring: 'ring-violet-400', text: 'text-violet-700 dark:text-violet-300' },
  { id: 'slate', label: 'Grafite', dot: 'bg-slate-500', ring: 'ring-slate-400', text: 'text-slate-700 dark:text-slate-300' }
];

export function getOwnerColorClasses(color?: FinancialOwner['color']) {
  return OWNER_COLORS.find(c => c.id === color) || OWNER_COLORS[0];
}

function getAccountIcon(type: FinancialAccountType) {
  switch (type) {
    case 'cash_drawer':
      return Wallet;
    case 'safe':
      return Vault;
    case 'bank':
      return Landmark;
    case 'pix':
      return Smartphone;
    case 'card_machine':
      return CreditCard;
    default:
      return Wallet;
  }
}

interface FinanceAccountsSectionProps {
  accountBalances: ComputedAccountBalance[];
  onAddAccount: (payload: Omit<FinancialAccount, 'id' | 'createdAt'>) => Promise<{ ok: boolean; error?: string }>;
  onUpdateAccount: (id: string, payload: Partial<FinancialAccount>) => Promise<{ ok: boolean; error?: string }>;
  onDeleteAccount: (id: string) => Promise<{ ok: boolean; error?: string }>;
  onQuickTransferFrom: (accountId: string) => void;
}

const STARTER_ACCOUNT_TEMPLATES: {
  name: string;
  type: FinancialAccountType;
  scope: FinancialScope;
}[] = [
  { name: 'Caixa / Gaveta', type: 'cash_drawer', scope: 'company' },
  { name: 'Conta Bancária / PIX (Empresa)', type: 'bank', scope: 'company' },
  { name: 'Cofre (Empresa)', type: 'safe', scope: 'company' },
  { name: 'Conta Particular', type: 'pix', scope: 'personal' }
];

export function FinanceAccountsSection({
  accountBalances,
  onAddAccount,
  onUpdateAccount,
  onDeleteAccount,
  onQuickTransferFrom
}: FinanceAccountsSectionProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<FinancialAccountType>('bank');
  const [scope, setScope] = useState<FinancialScope>('company');
  const [initialBalance, setInitialBalance] = useState('0');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState<FinancialAccountType>('bank');
  const [editScope, setEditScope] = useState<FinancialScope>('company');
  const [editInitialBalance, setEditInitialBalance] = useState('0');
  const [editNotes, setEditNotes] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const res = await onAddAccount({
        name: name.trim(),
        type,
        scope,
        initialBalance: parseFloat(initialBalance) || 0,
        notes: notes.trim() || undefined
      });
      if (res.ok) {
        setName('');
        setInitialBalance('0');
        setNotes('');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateStarter = async (tpl: (typeof STARTER_ACCOUNT_TEMPLATES)[number]) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onAddAccount({
        name: tpl.name,
        type: tpl.type,
        scope: tpl.scope,
        initialBalance: 0
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const startEdit = (acc: FinancialAccount) => {
    setEditingId(acc.id);
    setEditName(acc.name);
    setEditType(acc.type);
    setEditScope(acc.scope);
    setEditInitialBalance(String(Number(acc.initialBalance) || 0));
    setEditNotes(acc.notes || '');
    setConfirmDeleteId(null);
  };

  const handleSaveEdit = async (id: string) => {
    if (!editName.trim()) return;
    const res = await onUpdateAccount(id, {
      name: editName.trim(),
      type: editType,
      scope: editScope,
      initialBalance: parseFloat(editInitialBalance) || 0,
      notes: editNotes.trim()
    });
    if (res.ok) setEditingId(null);
  };

  const totalBalance = accountBalances.reduce((acc, item) => acc + item.currentBalance, 0);
  const companyBalance = accountBalances
    .filter(item => item.account.scope === 'company')
    .reduce((acc, item) => acc + item.currentBalance, 0);
  const personalBalance = accountBalances
    .filter(item => item.account.scope === 'personal')
    .reduce((acc, item) => acc + item.currentBalance, 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left: Form */}
      <div className="lg:col-span-1 space-y-5">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm p-5 sm:p-6">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-1">
            Nova Conta / Carteira
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
            Cadastre gaveta, cofre, bancos ou contas PIX para controlar saldos e depósitos.
          </p>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Pertence a
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setScope('company')}
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
                  onClick={() => setScope('personal')}
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

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Nome da Conta
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Ex: Itaú Empresa, Caixa, Nubank..."
                className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Tipo
                </label>
                <select
                  value={type}
                  onChange={e => setType(e.target.value as FinancialAccountType)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                >
                  {Object.entries(ACCOUNT_TYPE_LABELS).map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Saldo Inicial (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={initialBalance}
                  onChange={e => setInitialBalance(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Observação (opcional)
              </label>
              <input
                type="text"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Ex: Agência / Chave PIX / Final da conta"
                className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="w-full py-2.5 bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-700 text-white rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              <span>{isSubmitting ? 'Salvando...' : 'Adicionar Conta'}</span>
            </button>
          </form>
        </div>

        {/* Summary Split */}
        {accountBalances.length > 0 && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm p-5 space-y-2.5 text-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Consolidado de Saldos
            </p>
            <div className="flex justify-between items-center">
              <span className="text-slate-600 dark:text-slate-300">Contas Empresa</span>
              <span className="font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                R$ {companyBalance.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-600 dark:text-slate-300">Contas Particulares</span>
              <span className="font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                R$ {personalBalance.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-slate-100 dark:border-slate-800">
              <span className="font-semibold text-slate-900 dark:text-slate-100">Total Geral</span>
              <span
                className={`font-bold tabular-nums ${
                  totalBalance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                }`}
              >
                R$ {totalBalance.toFixed(2)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Right: Accounts List */}
      <div className="lg:col-span-2 space-y-4">
        {accountBalances.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm p-8 text-center space-y-5">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto">
              <Landmark className="w-6 h-6 text-slate-500 dark:text-slate-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Nenhuma conta cadastrada ainda
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
                Adicione suas contas ao lado ou use um dos modelos rápidos abaixo para começar a registrar depósitos e saldos:
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {STARTER_ACCOUNT_TEMPLATES.map(tpl => (
                <button
                  key={tpl.name}
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleCreateStarter(tpl)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-50 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 hover:text-emerald-700 dark:hover:text-emerald-300 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{tpl.name}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {accountBalances.map(item => {
              const { account } = item;
              const Icon = getAccountIcon(account.type);
              const isEditing = editingId === account.id;
              const isConfirmingDelete = confirmDeleteId === account.id;

              if (isEditing) {
                return (
                  <div
                    key={account.id}
                    className="bg-white dark:bg-slate-900 rounded-2xl border border-emerald-400 dark:border-emerald-700 p-4 space-y-3 shadow-sm"
                  >
                    <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
                      Editando conta
                    </p>
                    <input
                      type="text"
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={editType}
                        onChange={e => setEditType(e.target.value as FinancialAccountType)}
                        className="px-2.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                      >
                        {Object.entries(ACCOUNT_TYPE_LABELS).map(([k, label]) => (
                          <option key={k} value={k}>
                            {label}
                          </option>
                        ))}
                      </select>
                      <select
                        value={editScope}
                        onChange={e => setEditScope(e.target.value as FinancialScope)}
                        className="px-2.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                      >
                        <option value="company">Empresa</option>
                        <option value="personal">Particular</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="number"
                        step="0.01"
                        value={editInitialBalance}
                        onChange={e => setEditInitialBalance(e.target.value)}
                        placeholder="Saldo inicial"
                        className="px-2.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 tabular-nums"
                      />
                      <input
                        type="text"
                        value={editNotes}
                        onChange={e => setEditNotes(e.target.value)}
                        placeholder="Observação"
                        className="px-2.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                      />
                    </div>
                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center gap-1"
                      >
                        <X className="w-3.5 h-3.5" /> Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveEdit(account.id)}
                        className="px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg flex items-center gap-1"
                      >
                        <Check className="w-3.5 h-3.5" /> Salvar
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={account.id}
                  className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm p-5 flex flex-col justify-between gap-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                          account.scope === 'company'
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                            : 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400'
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate">
                          {account.name}
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                          <span>{ACCOUNT_TYPE_LABELS[account.type]}</span>
                          <span>·</span>
                          <span
                            className={
                              account.scope === 'company'
                                ? 'font-semibold text-emerald-700 dark:text-emerald-400'
                                : 'font-semibold text-indigo-600 dark:text-indigo-400'
                            }
                          >
                            {account.scope === 'company' ? 'Empresa' : 'Particular'}
                          </span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {!isConfirmingDelete && (
                        <button
                          type="button"
                          onClick={() => startEdit(account)}
                          className="p-1.5 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                          title="Editar conta"
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
                              await onDeleteAccount(account.id);
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
                            setConfirmDeleteId(account.id);
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

                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Saldo Atual</p>
                    <p
                      className={`text-2xl font-bold tabular-nums mt-0.5 ${
                        item.currentBalance >= 0
                          ? 'text-slate-900 dark:text-slate-100'
                          : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      R$ {item.currentBalance.toFixed(2)}
                    </p>
                    {account.notes && (
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 truncate">
                        {account.notes}
                      </p>
                    )}
                  </div>

                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 text-xs">
                    <div className="text-slate-500 dark:text-slate-400 tabular-nums space-x-2">
                      <span>Inicial: R$ {(Number(account.initialBalance) || 0).toFixed(2)}</span>
                      {item.transfersIn + item.transfersOut > 0 && (
                        <span>
                          · Mov: +{(item.inflows + item.transfersIn).toFixed(0)} / -
                          {(item.outflows + item.transfersOut).toFixed(0)}
                        </span>
                      )}
                    </div>
                    {accountBalances.length >= 2 && (
                      <button
                        type="button"
                        onClick={() => onQuickTransferFrom(account.id)}
                        className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 hover:underline font-semibold shrink-0"
                      >
                        <ArrowLeftRight className="w-3.5 h-3.5" />
                        <span>Depositar / Transferir</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

interface FinanceOwnersSectionProps {
  owners: FinancialOwner[];
  personalByOwner: OwnerSpendingSummary[];
  onAddOwner: (payload: Omit<FinancialOwner, 'id' | 'createdAt'>) => Promise<{ ok: boolean; error?: string }>;
  onUpdateOwner: (id: string, payload: Partial<FinancialOwner>) => Promise<{ ok: boolean; error?: string }>;
  onDeleteOwner: (id: string) => Promise<{ ok: boolean; error?: string }>;
  onFilterByOwner: (ownerId: string) => void;
}

const STARTER_OWNERS: { name: string; color: NonNullable<FinancialOwner['color']> }[] = [
  { name: 'Proprietário', color: 'indigo' },
  { name: 'Esposa', color: 'rose' },
  { name: 'Casa / Família', color: 'amber' }
];

export function FinanceOwnersSection({
  owners,
  personalByOwner,
  onAddOwner,
  onUpdateOwner,
  onDeleteOwner,
  onFilterByOwner
}: FinanceOwnersSectionProps) {
  const [name, setName] = useState('');
  const [color, setColor] = useState<NonNullable<FinancialOwner['color']>>('indigo');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState<NonNullable<FinancialOwner['color']>>('indigo');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const res = await onAddOwner({ name: name.trim(), color });
      if (res.ok) {
        setName('');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStarterOwner = async (tpl: (typeof STARTER_OWNERS)[number]) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onAddOwner({ name: tpl.name, color: tpl.color });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatsForOwner = (owner: FinancialOwner) => {
    return personalByOwner.find(
      s => s.ownerId === owner.id || s.ownerName.toLowerCase() === owner.name.toLowerCase()
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left: Form */}
      <div className="lg:col-span-1">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm p-5 sm:p-6">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-1">
            Novo Titular (Particular)
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
            Identifique quem fez cada despesa particular (ex.: Dono, Esposa, Casa) sem misturar com o caixa da empresa.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Nome / Identificação
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Ex: João (Dono), Maria (Esposa), Casa..."
                className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Cor de Identificação
              </label>
              <div className="flex flex-wrap gap-2">
                {OWNER_COLORS.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setColor(c.id)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      color === c.id
                        ? 'border-slate-900 dark:border-slate-200 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span className={`w-2.5 h-2.5 rounded-full ${c.dot}`} />
                    <span>{c.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              <span>{isSubmitting ? 'Cadastrando...' : 'Cadastrar Titular'}</span>
            </button>
          </form>
        </div>
      </div>

      {/* Right: Owners List */}
      <div className="lg:col-span-2">
        {owners.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm p-8 text-center space-y-5">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center mx-auto">
              <Users className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Nenhum titular cadastrado ainda
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
                Cadastre os responsáveis pelas despesas particulares ou adicione sugestões rápidas em um clique:
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {STARTER_OWNERS.map(tpl => {
                const col = getOwnerColorClasses(tpl.color);
                return (
                  <button
                    key={tpl.name}
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => handleStarterOwner(tpl)}
                    className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-50 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
                  >
                    <span className={`w-2.5 h-2.5 rounded-full ${col.dot}`} />
                    <span>+ {tpl.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {owners.map(owner => {
              const col = getOwnerColorClasses(owner.color);
              const stats = getStatsForOwner(owner);
              const isEditing = editingId === owner.id;
              const isConfirmingDelete = confirmDeleteId === owner.id;

              if (isEditing) {
                return (
                  <div
                    key={owner.id}
                    className="bg-white dark:bg-slate-900 rounded-2xl border border-indigo-400 dark:border-indigo-700 p-4 space-y-3 shadow-sm"
                  >
                    <p className="text-xs font-bold text-indigo-700 dark:text-indigo-300">
                      Editando titular
                    </p>
                    <input
                      type="text"
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                    />
                    <div className="flex flex-wrap gap-1.5">
                      {OWNER_COLORS.map(c => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setEditColor(c.id)}
                          className={`p-1.5 rounded-lg border ${
                            editColor === c.id
                              ? 'border-slate-900 dark:border-slate-100 bg-slate-100 dark:bg-slate-800'
                              : 'border-transparent'
                          }`}
                          title={c.label}
                        >
                          <span className={`block w-4 h-4 rounded-full ${c.dot}`} />
                        </button>
                      ))}
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center gap-1"
                      >
                        <X className="w-3.5 h-3.5" /> Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!editName.trim()) return;
                          const res = await onUpdateOwner(owner.id, {
                            name: editName.trim(),
                            color: editColor
                          });
                          if (res.ok) setEditingId(null);
                        }}
                        className="px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg flex items-center gap-1"
                      >
                        <Check className="w-3.5 h-3.5" /> Salvar
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={owner.id}
                  className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm p-5 flex flex-col justify-between gap-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                        <span className={`w-3.5 h-3.5 rounded-full ${col.dot}`} />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate">
                          {owner.name}
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Titular Particular
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {!isConfirmingDelete && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(owner.id);
                            setEditName(owner.name);
                            setEditColor(owner.color || 'indigo');
                            setConfirmDeleteId(null);
                          }}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                          title="Renomear titular"
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
                              await onDeleteOwner(owner.id);
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
                            setConfirmDeleteId(owner.id);
                            setEditingId(null);
                          }}
                          className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                          title="Excluir titular"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs tabular-nums">
                    <div>
                      <span className="text-slate-400 block">Gastos (Período)</span>
                      <span className="font-bold text-red-600 dark:text-red-400">
                        R$ {(stats?.spent || 0).toFixed(2)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Entradas</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">
                        R$ {(stats?.income || 0).toFixed(2)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">A Pagar</span>
                      <span className="font-bold text-amber-600 dark:text-amber-400">
                        R$ {(stats?.pendingPayables || 0).toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onFilterByOwner(owner.id)}
                    className="w-full py-2 text-xs font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50/70 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-950/70 rounded-xl transition-colors"
                  >
                    Ver lançamentos de {owner.name}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
