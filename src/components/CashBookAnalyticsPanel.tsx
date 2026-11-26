import React, { useState } from 'react';
import { BarChart3, ChevronDown, ChevronUp } from 'lucide-react';
import { PeriodFinancialMetrics } from '../lib/cashbookUtils';

interface CashBookAnalyticsPanelProps {
  metrics: PeriodFinancialMetrics;
}

const CATEGORY_COLORS = [
  'bg-red-500',
  'bg-amber-500',
  'bg-indigo-500',
  'bg-teal-500',
  'bg-slate-500'
];

export function CashBookAnalyticsPanel({ metrics }: CashBookAnalyticsPanelProps) {
  const [expanded, setExpanded] = useState(true);

  const { cash, pix, machine } = metrics.incomeDistribution;
  const hasIncome = metrics.totalIncome > 0;
  const hasExpense = metrics.totalExpense > 0;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 sm:px-5 py-3.5 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
            Painel Analítico do Período
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400 hidden sm:inline">
            · Composição das receitas e despesas por categoria
          </span>
        </div>
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1 whitespace-nowrap shrink-0">
          {expanded ? 'Recolher' : 'Expandir'}
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </span>
      </button>

      {expanded && (
        <div className="px-4 sm:px-5 pb-5 pt-2 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Composição de Entradas */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Distribuição das Entradas
              </h3>
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
                Total: R$ {metrics.totalIncome.toFixed(2)}
              </span>
            </div>

            {hasIncome ? (
              <>
                <div className="h-3 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden flex">
                  {cash.percent > 0 && (
                    <div
                      style={{ width: `${cash.percent}%` }}
                      className="bg-emerald-500 h-full transition-all"
                      title={`Dinheiro: R$ ${cash.amount.toFixed(2)} (${cash.percent.toFixed(1)}%)`}
                    />
                  )}
                  {pix.percent > 0 && (
                    <div
                      style={{ width: `${pix.percent}%` }}
                      className="bg-teal-500 h-full transition-all"
                      title={`PIX: R$ ${pix.amount.toFixed(2)} (${pix.percent.toFixed(1)}%)`}
                    />
                  )}
                  {machine.percent > 0 && (
                    <div
                      style={{ width: `${machine.percent}%` }}
                      className="bg-indigo-500 h-full transition-all"
                      title={`Máquina: R$ ${machine.amount.toFixed(2)} (${machine.percent.toFixed(1)}%)`}
                    />
                  )}
                </div>

                <div className="mt-3 grid grid-cols-3 gap-3">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                      <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500 shrink-0" />
                      <span>Dinheiro</span>
                    </div>
                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                      R$ {cash.amount.toFixed(2)}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                      {cash.percent.toFixed(1)}%
                    </p>
                  </div>

                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                      <span className="w-2.5 h-2.5 rounded-xs bg-teal-500 shrink-0" />
                      <span>PIX</span>
                    </div>
                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                      R$ {pix.amount.toFixed(2)}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                      {pix.percent.toFixed(1)}%
                    </p>
                  </div>

                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                      <span className="w-2.5 h-2.5 rounded-xs bg-indigo-500 shrink-0" />
                      <span>Máquina</span>
                    </div>
                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                      R$ {machine.amount.toFixed(2)}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                      {machine.percent.toFixed(1)}%
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-400 py-4">
                Nenhuma entrada paga registrada no período selecionado.
              </p>
            )}
          </div>

          {/* Despesas por Categoria */}
          <div className="lg:border-l lg:pl-6 border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between mb-2.5">
              <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Despesas por Categoria
              </h3>
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
                Total: R$ {metrics.totalExpense.toFixed(2)}
              </span>
            </div>

            {hasExpense && metrics.expensesByCategory.length > 0 ? (
              <div className="space-y-2.5">
                {metrics.expensesByCategory.map((item, idx) => (
                  <div key={item.category} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-700 dark:text-slate-300 truncate pr-2">
                        {item.category}
                      </span>
                      <span className="font-semibold text-slate-900 dark:text-slate-100 tabular-nums shrink-0">
                        R$ {item.amount.toFixed(2)}{' '}
                        <span className="font-normal text-slate-500 dark:text-slate-400">
                          ({item.percent.toFixed(0)}%)
                        </span>
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        style={{ width: `${Math.max(item.percent, 2)}%` }}
                        className={`h-full rounded-full ${CATEGORY_COLORS[idx % CATEGORY_COLORS.length]}`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-400 py-4">
                Nenhuma despesa registrada no período selecionado.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
