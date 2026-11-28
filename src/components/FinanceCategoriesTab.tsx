import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  Building2,
  User,
  Layers,
  Plus,
  Search,
  Pencil,
  Trash2,
  Check,
  X,
  RotateCcw,
  Tag
} from 'lucide-react';
import {
  FinancialCategory,
  FinancialCategoryScope,
  FinancialCategoryType,
  FinancialEntry,
  FinancialPayable
} from '../types';

export interface UpdateCategoryPayload {
  name: string;
  type: FinancialCategoryType;
  scope: FinancialCategoryScope;
  oldName?: string;
  renameExisting?: boolean;
  createdAt?: number;
}

interface FinanceCategoriesTabProps {
  categories: FinancialCategory[];
  entries: FinancialEntry[];
  payables: FinancialPayable[];
  hasDeletedDefaults: boolean;
  initialType?: FinancialCategoryType;
  initialScope?: FinancialCategoryScope;
  onAddCategory: (payload: {
    name: string;
    type: FinancialCategoryType;
    scope: FinancialCategoryScope;
  }) => Promise<{ ok: boolean; error?: string }>;
  onUpdateCategory: (
    id: string,
    payload: UpdateCategoryPayload
  ) => Promise<{ ok: boolean; error?: string }>;
  onDeleteCategory: (id: string) => Promise<{ ok: boolean; error?: string }>;
  onRestoreDefaults: () => Promise<{ ok: boolean; error?: string }>;
}

const SCOPE_LABELS: Record<FinancialCategoryScope, string> = {
  company: 'Empresa',
  personal: 'Particular',
  both: 'Empresa e Particular'
};

export function FinanceCategoriesTab({
  categories,
  entries,
  payables,
  hasDeletedDefaults,
  initialType,
  initialScope,
  onAddCategory,
  onUpdateCategory,
  onDeleteCategory,
  onRestoreDefaults
}: FinanceCategoriesTabProps) {
  // Create form state
  const [name, setName] = useState('');
  const [type, setType] = useState<FinancialCategoryType>(initialType || 'expense');
  const [scope, setScope] = useState<FinancialCategoryScope>(initialScope || 'company');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync when user jumps from a specific form (e.g. Receita or Despesa)
  useEffect(() => {
    if (initialType) setType(initialType);
  }, [initialType]);

  useEffect(() => {
    if (initialScope) setScope(initialScope);
  }, [initialScope]);

  // Filter state
  const [typeFilter, setTypeFilter] = useState<'all' | FinancialCategoryType>('all');
  const [scopeFilter, setScopeFilter] = useState<'all' | FinancialCategoryScope>('all');
  const [search, setSearch] = useState('');

  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState<FinancialCategoryType>('expense');
  const [editScope, setEditScope] = useState<FinancialCategoryScope>('company');
  const [editRenameExisting, setEditRenameExisting] = useState(true);
  const [editError, setEditError] = useState<string | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Inline delete confirm state
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  // Usage counter per category (entries + payables)
  const usageMap = useMemo(() => {
    const map = new Map<string, number>();
    const bump = (t: 'expense' | 'income', catName: string) => {
      const key = `${t}::${catName.trim().toLowerCase()}`;
      map.set(key, (map.get(key) || 0) + 1);
    };
    entries.forEach(e => {
      if (e.type === 'expense' || e.type === 'income') {
        bump(e.type, e.category || '');
      }
    });
    payables.forEach(p => {
      bump('expense', p.category || '');
    });
    return map;
  }, [entries, payables]);

  const getUsageCount = (cat: FinancialCategory) => {
    return usageMap.get(`${cat.type}::${cat.name.trim().toLowerCase()}`) || 0;
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const clean = name.trim();
    if (!clean) {
      setFormError('Digite o nome da categoria.');
      return;
    }

    const duplicate = categories.find(
      c =>
        c.type === type &&
        c.name.trim().toLowerCase() === clean.toLowerCase() &&
        (c.scope === scope || c.scope === 'both' || scope === 'both')
    );
    if (duplicate) {
      setFormError(`Já existe uma categoria "${duplicate.name}" para ${type === 'income' ? 'Receitas' : 'Despesas'}.`);
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await onAddCategory({ name: clean, type, scope });
      if (res.ok) {
        setName('');
      } else if (res.error) {
        setFormError(res.error);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const startEdit = (cat: FinancialCategory) => {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditType(cat.type);
    setEditScope(cat.scope);
    setEditRenameExisting(true);
    setEditError(null);
    setConfirmDeleteId(null);
  };

  const handleSaveEdit = async (original: FinancialCategory) => {
    setEditError(null);
    const clean = editName.trim();
    if (!clean) {
      setEditError('O nome da categoria não pode ficar vazio.');
      return;
    }

    const duplicate = categories.find(
      c =>
        c.id !== original.id &&
        c.type === editType &&
        c.name.trim().toLowerCase() === clean.toLowerCase() &&
        (c.scope === editScope || c.scope === 'both' || editScope === 'both')
    );
    if (duplicate) {
      setEditError(`Já existe outra categoria com o nome "${duplicate.name}".`);
      return;
    }

    setIsSavingEdit(true);
    try {
      const res = await onUpdateCategory(original.id, {
        name: clean,
        type: editType,
        scope: editScope,
        oldName: original.name,
        renameExisting: editRenameExisting && clean !== original.name,
        createdAt: original.createdAt
      });
      if (res.ok) {
        setEditingId(null);
      } else if (res.error) {
        setEditError(res.error);
      }
    } finally {
      setIsSavingEdit(false);
    }
  };

  const filteredCategories = useMemo(() => {
    const q = search.trim().toLowerCase();
    return categories.filter(cat => {
      if (typeFilter !== 'all' && cat.type !== typeFilter) return false;
      if (scopeFilter !== 'all') {
        if (scopeFilter === 'both') {
          if (cat.scope !== 'both') return false;
        } else if (cat.scope !== scopeFilter && cat.scope !== 'both') {
          return false;
        }
      }
      if (q && !cat.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [categories, typeFilter, scopeFilter, search]);

  const expenseCount = useMemo(() => categories.filter(c => c.type === 'expense').length, [categories]);
  const incomeCount = useMemo(() => categories.filter(c => c.type === 'income').length, [categories]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left: Create Category Form */}
      <div className="lg:col-span-1 space-y-5">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm p-5 sm:p-6">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-1">
            Nova Categoria
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
            Crie categorias personalizadas para organizar despesas, receitas e contas a pagar.
          </p>

          {formError && (
            <div className="mb-3.5 p-2.5 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-xs font-semibold text-red-700 dark:text-red-300">
              {formError}
            </div>
          )}

          <form onSubmit={handleCreate} className="space-y-4">
            {/* Type: Expense vs Income */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Tipo de Movimentação
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setType('expense');
                    setFormError(null);
                  }}
                  className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold border transition-colors whitespace-nowrap ${
                    type === 'expense'
                      ? 'bg-red-50 dark:bg-red-950/60 border-red-400 dark:border-red-700 text-red-700 dark:text-red-300'
                      : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  <ArrowDownRight className="w-3.5 h-3.5" />
                  <span>Despesa</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setType('income');
                    setFormError(null);
                  }}
                  className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold border transition-colors whitespace-nowrap ${
                    type === 'income'
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 text-emerald-700 dark:text-emerald-300'
                      : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  <span>Receita</span>
                </button>
              </div>
            </div>

            {/* Scope: Company / Personal / Both */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Onde aparece
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { id: 'company', label: 'Empresa', icon: Building2 },
                  { id: 'personal', label: 'Particular', icon: User },
                  { id: 'both', label: 'Ambos', icon: Layers }
                ].map(opt => {
                  const Icon = opt.icon;
                  const active = scope === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        setScope(opt.id as FinancialCategoryScope);
                        setFormError(null);
                      }}
                      className={`flex items-center justify-center gap-1 py-2 px-2 rounded-xl text-xs font-semibold border transition-colors whitespace-nowrap ${
                        active
                          ? opt.id === 'personal'
                            ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-500 text-indigo-700 dark:text-indigo-300'
                            : opt.id === 'company'
                              ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 text-emerald-700 dark:text-emerald-300'
                              : 'bg-slate-900 dark:bg-slate-100 border-slate-900 dark:border-slate-100 text-white dark:text-slate-900'
                          : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5 shrink-0" />
                      <span>{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Nome da Categoria
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={e => {
                  setName(e.target.value);
                  if (formError) setFormError(null);
                }}
                placeholder={
                  type === 'expense'
                    ? 'Ex: Segurança / Câmeras, Limpeza, Academia...'
                    : 'Ex: Lavagem, Comissões, Aluguel Extra...'
                }
                className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="w-full py-2.5 bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-700 text-white rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              <span>{isSubmitting ? 'Salvando...' : 'Adicionar Categoria'}</span>
            </button>
          </form>
        </div>

        {/* Summary card */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm p-5 space-y-2.5 text-sm">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Resumo das Categorias
          </p>
          <div className="flex justify-between items-center">
            <span className="text-slate-600 dark:text-slate-300">Despesas</span>
            <span className="font-bold text-red-600 dark:text-red-400 tabular-nums">{expenseCount}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-600 dark:text-slate-300">Receitas</span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{incomeCount}</span>
          </div>
          <div className="flex justify-between items-center pt-2 border-t border-slate-100 dark:border-slate-800">
            <span className="font-semibold text-slate-900 dark:text-slate-100">Total Ativas</span>
            <span className="font-bold text-slate-900 dark:text-slate-100 tabular-nums">{categories.length}</span>
          </div>
        </div>
      </div>

      {/* Right: Categories List */}
      <div className="lg:col-span-2">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
          <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                  Categorias de Despesas e Receitas
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                  {filteredCategories.length}{' '}
                  {filteredCategories.length === 1 ? 'categoria exibida' : 'categorias exibidas'}
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {hasDeletedDefaults && (
                  <button
                    type="button"
                    disabled={isRestoring}
                    onClick={async () => {
                      setIsRestoring(true);
                      try {
                        await onRestoreDefaults();
                      } finally {
                        setIsRestoring(false);
                      }
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors whitespace-nowrap"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>{isRestoring ? 'Restaurando...' : 'Restaurar padrões'}</span>
                  </button>
                )}

                <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                  {[
                    { id: 'all', label: 'Todas' },
                    { id: 'expense', label: 'Despesas' },
                    { id: 'income', label: 'Receitas' }
                  ].map(t => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTypeFilter(t.id as any)}
                      className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                        typeFilter === t.id
                          ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar categoria..."
                  className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
              </div>

              <select
                value={scopeFilter}
                onChange={e => setScopeFilter(e.target.value as any)}
                className="px-3 py-2 text-xs font-medium bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-200"
              >
                <option value="all">Todas classificações</option>
                <option value="company">Empresa</option>
                <option value="personal">Particular</option>
                <option value="both">Somente "Ambos"</option>
              </select>
            </div>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[680px] overflow-y-auto">
            {filteredCategories.length === 0 ? (
              <div className="py-12 px-4 text-center">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-3">
                  <Tag className="w-6 h-6 text-slate-400" />
                </div>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Nenhuma categoria encontrada
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Cadastre uma nova categoria ao lado ou limpe os filtros acima.
                </p>
              </div>
            ) : (
              filteredCategories.map(cat => {
                const isEditing = editingId === cat.id;
                const isConfirmingDelete = confirmDeleteId === cat.id;
                const usageCount = getUsageCount(cat);

                if (isEditing) {
                  return (
                    <div
                      key={cat.id}
                      className="p-4 bg-slate-50 dark:bg-slate-800/70 space-y-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                          Editando categoria
                        </span>
                        {editError && (
                          <span className="text-xs font-semibold text-red-600 dark:text-red-400">
                            {editError}
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        <input
                          type="text"
                          value={editName}
                          onChange={e => {
                            setEditName(e.target.value);
                            if (editError) setEditError(null);
                          }}
                          className="sm:col-span-3 px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                        />

                        <select
                          value={editType}
                          onChange={e => setEditType(e.target.value as FinancialCategoryType)}
                          className="px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                        >
                          <option value="expense">Despesa</option>
                          <option value="income">Receita</option>
                        </select>

                        <select
                          value={editScope}
                          onChange={e => setEditScope(e.target.value as FinancialCategoryScope)}
                          className="px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                        >
                          <option value="company">Empresa</option>
                          <option value="personal">Particular</option>
                          <option value="both">Empresa e Particular</option>
                        </select>

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
                            onClick={() => handleSaveEdit(cat)}
                            className="px-3 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg flex items-center gap-1 disabled:opacity-50"
                          >
                            <Check className="w-3.5 h-3.5" /> {isSavingEdit ? 'Salvando...' : 'Salvar'}
                          </button>
                        </div>
                      </div>

                      {usageCount > 0 && editName.trim() && editName.trim() !== cat.name && (
                        <label className="inline-flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={editRenameExisting}
                            onChange={e => setEditRenameExisting(e.target.checked)}
                            className="w-3.5 h-3.5 rounded accent-emerald-600"
                          />
                          <span>
                            Atualizar também os {usageCount}{' '}
                            {usageCount === 1 ? 'registro existente' : 'registros existentes'} com o novo nome
                          </span>
                        </label>
                      )}
                    </div>
                  );
                }

                return (
                  <div
                    key={cat.id}
                    className="px-4 sm:px-5 py-3.5 flex items-center justify-between gap-3 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`p-2 rounded-lg shrink-0 ${
                          cat.type === 'income'
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                            : 'bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400'
                        }`}
                      >
                        {cat.type === 'income' ? (
                          <ArrowUpRight className="w-4 h-4" />
                        ) : (
                          <ArrowDownRight className="w-4 h-4" />
                        )}
                      </div>

                      <div className="min-w-0">
                        <p className="font-semibold text-sm text-slate-900 dark:text-slate-100 truncate">
                          {cat.name}
                        </p>
                        <div className="text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 mt-0.5">
                          <span
                            className={
                              cat.type === 'income'
                                ? 'font-medium text-emerald-700 dark:text-emerald-400'
                                : 'font-medium text-red-600 dark:text-red-400'
                            }
                          >
                            {cat.type === 'income' ? 'Receita' : 'Despesa'}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{SCOPE_LABELS[cat.scope]}</span>
                          {usageCount > 0 && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="tabular-nums">
                                {usageCount} {usageCount === 1 ? 'registro' : 'registros'}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {!isConfirmingDelete && (
                        <button
                          type="button"
                          onClick={() => startEdit(cat)}
                          className="p-1.5 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                          title="Editar categoria"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                      )}

                      {isConfirmingDelete ? (
                        <div className="flex items-center gap-1.5 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 rounded-lg px-2 py-1">
                          <span className="text-[11px] font-semibold text-red-700 dark:text-red-300 whitespace-nowrap">
                            Apagar?
                          </span>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-1.5 py-0.5 text-[11px] text-slate-600 dark:text-slate-300 hover:text-slate-900"
                          >
                            Não
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              await onDeleteCategory(cat.id);
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
                            setConfirmDeleteId(cat.id);
                            setEditingId(null);
                          }}
                          className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                          title="Apagar categoria"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
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
