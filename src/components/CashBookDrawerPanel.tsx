import React, { useState } from 'react';
import { Banknote, Calculator, CheckCircle2, CreditCard, AlertTriangle, TrendingUp, ChevronDown, ChevronUp } from 'lucide-react';
import { PeriodFinancialMetrics } from '../lib/cashbookUtils';
import { Shift, Transaction } from '../types';

interface CashBookDrawerPanelProps {
  metrics: PeriodFinancialMetrics;
  activeShift?: Shift;
  canManageCashbook: boolean;
  onRegisterAdjustment?: (transaction: Omit<Transaction, 'id'>) => Promise<void>;
  operatorName: string;
}

export function CashBookDrawerPanel({
  metrics,
  activeShift,
  canManageCashbook,
  onRegisterAdjustment,
  operatorName
}: CashBookDrawerPanelProps) {
  const [includeInitialChange, setIncludeInitialChange] = useState(Boolean(activeShift && activeShift.initialChange > 0));
  const [showReconcile, setShowReconcile] = useState(false);
  const [countedCashInput, setCountedCashInput] = useState('');
  const [isSavingAdjust, setIsSavingAdjust] = useState(false);

  const initialChange = includeInitialChange && activeShift ? Number(activeShift.initialChange) || 0 : 0;
  const expectedDrawerCash = initialChange + metrics.drawerCashNet;

  const parsedCounted = parseFloat(countedCashInput.replace(',', '.'));
  const hasCountedValue = countedCashInput.trim() !== '' && !isNaN(parsedCounted) && parsedCounted >= 0;
  const difference = hasCountedValue ? parsedCounted - expectedDrawerCash : 0;
  const isMatched = hasCountedValue && Math.abs(difference) < 0.01;
  const isSurplus = hasCountedValue && difference >= 0.01;
  const isShortage = hasCountedValue && difference <= -0.01;

  const handleApplyAdjustment = async () => {
    if (!onRegisterAdjustment || !hasCountedValue || isMatched) return;
    setIsSavingAdjust(true);
    try {
      const absDiff = Number(Math.abs(difference).toFixed(2));
      await onRegisterAdjustment({
        description: isSurplus
          ? `Ajuste de Conferência de Gaveta (Sobra)`
          : `Ajuste de Conferência de Gaveta (Falta)`,
        amount: absDiff,
        type: isSurplus ? 'income' : 'expense',
        category: 'Ajuste de Caixa',
        paymentMethod: 'cash',
        date: Date.now(),
        operator: operatorName
      });
      setCountedCashInput('');
      setShowReconcile(false);
    } finally {
      setIsSavingAdjust(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
      <div className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1">
          {/* Dinheiro Físico na Gaveta */}
          <div className="flex items-start justify-between gap-3 pr-0 sm:pr-4 sm:border-r border-slate-100 dark:border-slate-800">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                <Banknote className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>Dinheiro na Gaveta (Espécie)</span>
              </div>
              <p className={`text-xl font-bold tabular-nums ${expectedDrawerCash >= 0 ? 'text-slate-900 dark:text-slate-100' : 'text-red-600 dark:text-red-400'}`}>
                R$ {expectedDrawerCash.toFixed(2)}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                <span>Entradas: <strong className="text-emerald-700 dark:text-emerald-400">+R$ {metrics.incomeCash.toFixed(2)}</strong></span>
                <span aria-hidden="true">·</span>
                <span>Saídas: <strong className="text-red-600 dark:text-red-400">-R$ {metrics.expenseCash.toFixed(2)}</strong></span>
                {initialChange > 0 && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>Troco: <strong className="text-slate-700 dark:text-slate-300">R$ {initialChange.toFixed(2)}</strong></span>
                  </>
                )}
              </div>
              {activeShift && Number(activeShift.initialChange) > 0 && (
                <label className="mt-2 inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={includeInitialChange}
                    onChange={(e) => setIncludeInitialChange(e.target.checked)}
                    className="w-3.5 h-3.5 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                  <span>Somar troco inicial do turno aberto (R$ {Number(activeShift.initialChange).toFixed(2)})</span>
                </label>
              )}
            </div>
          </div>

          {/* Digital (PIX + Máquina) */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                <CreditCard className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                <span>Saldo Digital (PIX + Máquina)</span>
              </div>
              <p className={`text-xl font-bold tabular-nums ${metrics.digitalNet >= 0 ? 'text-slate-900 dark:text-slate-100' : 'text-red-600 dark:text-red-400'}`}>
                R$ {metrics.digitalNet.toFixed(2)}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                <span>PIX líq.: <strong className="text-slate-700 dark:text-slate-200">R$ {(metrics.incomePix - metrics.expensePix).toFixed(2)}</strong></span>
                <span aria-hidden="true">·</span>
                <span>Máquina líq.: <strong className="text-slate-700 dark:text-slate-200">R$ {(metrics.incomeMachine - metrics.expenseMachine).toFixed(2)}</strong></span>
                {(metrics.expensePix + metrics.expenseMachine) > 0 && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>Gastos digitais: <strong className="text-red-600 dark:text-red-400">-R$ {(metrics.expensePix + metrics.expenseMachine).toFixed(2)}</strong></span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Toggle Conferência */}
        <div className="shrink-0 print:hidden">
          <button
            type="button"
            onClick={() => setShowReconcile(!showReconcile)}
            className="w-full lg:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 text-slate-700 dark:text-slate-200 hover:text-emerald-700 dark:hover:text-emerald-300 border border-slate-200 dark:border-slate-700 transition-colors whitespace-nowrap shrink-0"
          >
            <Calculator className="w-4 h-4" />
            <span>Conferir Gaveta</span>
            {showReconcile ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Área de Conferência Rápida de Gaveta */}
      {showReconcile && (
        <div className="px-4 sm:px-5 py-4 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800 print:hidden">
          <div className="flex flex-col md:flex-row md:items-end gap-4">
            <div className="flex-1 max-w-xs">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Valor contado na gaveta (notas + moedas)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">R$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={countedCashInput}
                  onChange={(e) => setCountedCashInput(e.target.value)}
                  placeholder={expectedDrawerCash.toFixed(2)}
                  className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-slate-100 tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
              </div>
            </div>

            {hasCountedValue ? (
              <div className="flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-2.5">
                  {isMatched && <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />}
                  {isSurplus && <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" />}
                  {isShortage && <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0" />}
                  <div>
                    <p className={`text-sm font-bold tabular-nums ${
                      isMatched
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : isSurplus
                          ? 'text-blue-700 dark:text-blue-400'
                          : 'text-red-700 dark:text-red-400'
                    }`}>
                      {isMatched && 'Caixa bateu perfeitamente (R$ 0,00)'}
                      {isSurplus && `Sobrou +R$ ${difference.toFixed(2)} na gaveta`}
                      {isShortage && `Faltou -R$ ${Math.abs(difference).toFixed(2)} na gaveta`}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                      Esperado: R$ {expectedDrawerCash.toFixed(2)} · Contado: R$ {parsedCounted.toFixed(2)}
                    </p>
                  </div>
                </div>

                {canManageCashbook && onRegisterAdjustment && !isMatched && (
                  <button
                    type="button"
                    disabled={isSavingAdjust}
                    onClick={handleApplyAdjustment}
                    className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-500 text-white transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
                  >
                    {isSavingAdjust ? 'Salvando...' : 'Lançar Ajuste de Caixa'}
                  </button>
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-400 pb-2">
                Digite quanto dinheiro físico há na gaveta para comparar automaticamente com o esperado (R$ {expectedDrawerCash.toFixed(2)}).
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
