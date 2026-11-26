import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle, MessageCircle, Search, Users, List, CheckCheck, Clock } from 'lucide-react';
import { ParkedVehicle, Transaction } from '../types';
import { DeviceFeaturesConfig } from '../lib/deviceModules';
import {
  UnifiedFiadoItem,
  GroupedClientFiado,
  getDaysPending,
  groupFiadosByClient
} from '../lib/cashbookUtils';
import {
  buildClientFiadoSummaryWhatsappText,
  buildFiadoWhatsappText,
  buildTransactionFiadoWhatsappText,
  openWhatsappMessage
} from '../lib/whatsappUtils';
import { isFiadoTransaction } from '../lib/transactionUtils';
import { isRentalTransaction } from '../lib/rentalUtils';

interface CashBookFiadoCardProps {
  unpaidFiados: UnifiedFiadoItem[];
  vehicles: ParkedVehicle[];
  transactions: Transaction[];
  startOfPeriod: number;
  endOfPeriod: number;
  canManageCashbook: boolean;
  deviceConfig?: DeviceFeaturesConfig;
  onOpenSearch: () => void;
  onPayFiado: (id: string, paymentMethod: string, amount: number, observation?: string) => Promise<void>;
  onPayFiadoTransaction?: (id: string, paymentMethod: string, amount: number, observation?: string) => Promise<void>;
}

function formatMethodPt(method?: string): string {
  if (method === 'cash') return 'Dinheiro';
  if (method === 'pix') return 'PIX';
  if (method === 'machine' || method === 'card') return 'Máquina';
  return method || 'N/A';
}

export function CashBookFiadoCard({
  unpaidFiados,
  vehicles,
  transactions,
  startOfPeriod,
  endOfPeriod,
  canManageCashbook,
  deviceConfig,
  onOpenSearch,
  onPayFiado,
  onPayFiadoTransaction
}: CashBookFiadoCardProps) {
  const enableAdvanced = Boolean(deviceConfig?.enableCashbookAdvancedFiado);
  const enableZap = Boolean(deviceConfig?.enableWhatsappReceipts) || enableAdvanced;

  const [viewMode, setViewMode] = useState<'items' | 'clients' | 'settled'>('items');

  // Individual item payoff state
  const [payingFiadoId, setPayingFiadoId] = useState<string | null>(null);
  const [fiadoPaymentMethod, setFiadoPaymentMethod] = useState<'cash' | 'machine' | 'pix'>('cash');
  const [fiadoPaymentAmount, setFiadoPaymentAmount] = useState<string>('');

  // Client grouped payoff state
  const [payingClientKey, setPayingClientKey] = useState<string | null>(null);
  const [clientPayAmount, setClientPayAmount] = useState<string>('');
  const [clientPayMethod, setClientPayMethod] = useState<'cash' | 'machine' | 'pix'>('cash');
  const [clientPayObs, setClientPayObs] = useState<string>('');

  // Global payoff state (inline confirm instead of window.confirm)
  const [globalFiadoAmount, setGlobalFiadoAmount] = useState<string>('');
  const [globalFiadoMethod, setGlobalFiadoMethod] = useState<'cash' | 'machine' | 'pix'>('cash');
  const [globalFiadoObservation, setGlobalFiadoObservation] = useState<string>('');
  const [confirmGlobalPay, setConfirmGlobalPay] = useState(false);
  const [isProcessingPay, setIsProcessingPay] = useState(false);

  const totalPending = useMemo(
    () => unpaidFiados.reduce((acc, item) => acc + item.remainingAmount, 0),
    [unpaidFiados]
  );

  const groupedClients = useMemo(
    () => (enableAdvanced ? groupFiadosByClient(unpaidFiados) : []),
    [enableAdvanced, unpaidFiados]
  );

  const settledInPeriod = useMemo(() => {
    if (!enableAdvanced) return [];
    const settledVehicles = vehicles
      .filter(
        v =>
          v.status === 'completed' &&
          v.paymentMethod === 'fiado' &&
          v.isFiadoPaid &&
          v.fiadoPaymentDate &&
          v.fiadoPaymentDate >= startOfPeriod &&
          v.fiadoPaymentDate <= endOfPeriod
      )
      .map(v => ({
        key: `sv_${v.id}`,
        title: v.ownerName ? `${v.ownerName} (${v.identifier})` : v.identifier || 'Veículo',
        origin: 'Veículo',
        amount: Number(v.fiadoPaidAmount || v.price) || 0,
        method: formatMethodPt(v.fiadoPaymentMethod),
        date: v.fiadoPaymentDate || 0
      }));

    const settledTxs = transactions
      .filter(
        t =>
          isFiadoTransaction(t) &&
          t.isFiadoPaid &&
          t.fiadoPaymentDate &&
          t.fiadoPaymentDate >= startOfPeriod &&
          t.fiadoPaymentDate <= endOfPeriod
      )
      .map(t => ({
        key: `st_${t.id}`,
        title: t.description.replace(/\s*\(FIADO\)\s*/gi, '').trim(),
        origin: isRentalTransaction(t) ? 'Vaga Alugada' : 'Cartão',
        amount: Number(t.fiadoPaidAmount || t.amount) || 0,
        method: formatMethodPt(t.fiadoPaymentMethod),
        date: t.fiadoPaymentDate || 0
      }));

    return [...settledVehicles, ...settledTxs].sort((a, b) => b.date - a.date);
  }, [enableAdvanced, vehicles, transactions, startOfPeriod, endOfPeriod]);

  const distributePaymentAcrossItems = async (
    items: UnifiedFiadoItem[],
    totalAmountToDistribute: number,
    method: 'cash' | 'machine' | 'pix',
    observation?: string
  ) => {
    let remaining = totalAmountToDistribute;
    const sorted = [...items].sort((a, b) => a.date - b.date);
    for (const item of sorted) {
      if (remaining <= 0.001) break;
      const due = item.remainingAmount;
      if (due <= 0.001) continue;
      const payHere = Number(Math.min(remaining, due).toFixed(2));
      if (item.kind === 'vehicle') {
        await onPayFiado(item.id, method, payHere, observation);
      } else if (onPayFiadoTransaction) {
        await onPayFiadoTransaction(item.id, method, payHere, observation);
      }
      remaining -= payHere;
    }
  };

  const handleConfirmGlobalPay = async () => {
    const amountToDistribute = parseFloat(globalFiadoAmount);
    if (isNaN(amountToDistribute) || amountToDistribute <= 0) return;
    setIsProcessingPay(true);
    try {
      await distributePaymentAcrossItems(unpaidFiados, amountToDistribute, globalFiadoMethod, globalFiadoObservation);
      setGlobalFiadoAmount('');
      setGlobalFiadoObservation('');
      setConfirmGlobalPay(false);
    } finally {
      setIsProcessingPay(false);
    }
  };

  const handlePayClientGroup = async (group: GroupedClientFiado) => {
    let amt = parseFloat(clientPayAmount);
    if (isNaN(amt) || amt <= 0) amt = group.totalRemaining;
    amt = Math.min(amt, group.totalRemaining);
    setIsProcessingPay(true);
    try {
      await distributePaymentAcrossItems(group.items, amt, clientPayMethod, clientPayObs || `Baixa cliente: ${group.clientName}`);
      setPayingClientKey(null);
      setClientPayAmount('');
      setClientPayObs('');
    } finally {
      setIsProcessingPay(false);
    }
  };

  const renderAgingBadge = (timestamp: number) => {
    if (!enableAdvanced) return null;
    const days = getDaysPending(timestamp);
    if (days <= 0) {
      return (
        <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
          Hoje
        </span>
      );
    }
    if (days <= 7) {
      return (
        <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
          há {days}d
        </span>
      );
    }
    if (days <= 30) {
      return (
        <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-400">
          <Clock className="w-3 h-3" />
          há {days}d
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-red-600 dark:text-red-400">
        <Clock className="w-3 h-3" />
        há {days}d (atrasado)
      </span>
    );
  };

  const handleOpenItemWhatsapp = (item: UnifiedFiadoItem) => {
    if (item.kind === 'vehicle' && item.vehicle) {
      openWhatsappMessage(buildFiadoWhatsappText(item.vehicle), item.phone);
      return;
    }
    const originLabel = item.originTag === 'rental' ? 'Vaga Alugada' : 'Cartão';
    openWhatsappMessage(
      buildTransactionFiadoWhatsappText({
        clientName: item.clientName,
        title: item.title,
        date: item.date,
        remainingAmount: item.remainingAmount,
        originLabel
      }),
      item.phone
    );
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-orange-200 dark:border-orange-900/60 overflow-hidden">
      <div className="p-5 border-b border-orange-100 dark:border-orange-900/50 bg-orange-50/50 dark:bg-orange-950/20">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <AlertTriangle className="w-5 h-5 text-orange-500 shrink-0" />
            <h2 className="text-base font-bold text-orange-900 dark:text-orange-200 truncate">Caixa do Fiado</h2>
          </div>
          <button
            type="button"
            onClick={onOpenSearch}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
          >
            <Search className="w-3.5 h-3.5" />
            <span>Origem & Pesquisa</span>
          </button>
        </div>

        <p className="text-sm text-orange-800 dark:text-orange-300 mt-1.5 mb-3 tabular-nums">
          Total em haver: <span className="font-bold">R$ {totalPending.toFixed(2)}</span> ({unpaidFiados.length})
        </p>

        {/* Advanced View Switcher */}
        {enableAdvanced && (
          <div className="grid grid-cols-3 gap-1 p-1 bg-orange-100/80 dark:bg-slate-800 rounded-xl mb-3">
            <button
              type="button"
              onClick={() => setViewMode('items')}
              className={`flex items-center justify-center gap-1 py-1.5 px-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                viewMode === 'items'
                  ? 'bg-white dark:bg-slate-900 text-orange-900 dark:text-orange-200 shadow-xs'
                  : 'text-orange-800/75 dark:text-slate-400 hover:text-orange-900 dark:hover:text-slate-200'
              }`}
            >
              <List className="w-3.5 h-3.5 shrink-0" />
              <span>Itens ({unpaidFiados.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('clients')}
              className={`flex items-center justify-center gap-1 py-1.5 px-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                viewMode === 'clients'
                  ? 'bg-white dark:bg-slate-900 text-orange-900 dark:text-orange-200 shadow-xs'
                  : 'text-orange-800/75 dark:text-slate-400 hover:text-orange-900 dark:hover:text-slate-200'
              }`}
            >
              <Users className="w-3.5 h-3.5 shrink-0" />
              <span>Clientes ({groupedClients.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('settled')}
              className={`flex items-center justify-center gap-1 py-1.5 px-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                viewMode === 'settled'
                  ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-300 shadow-xs'
                  : 'text-orange-800/75 dark:text-slate-400 hover:text-orange-900 dark:hover:text-slate-200'
              }`}
            >
              <CheckCheck className="w-3.5 h-3.5 shrink-0" />
              <span>Quitados ({settledInPeriod.length})</span>
            </button>
          </div>
        )}

        {/* Abater do Total */}
        {canManageCashbook && unpaidFiados.length > 0 && (!enableAdvanced || viewMode === 'items') && (
          <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-orange-200 dark:border-orange-900/60">
            <p className="text-xs font-bold text-orange-800 dark:text-orange-300 mb-2">Abater do total geral (por ordem de data)</p>
            <div className="space-y-2">
              <input
                type="number"
                step="0.01"
                min="0.01"
                max={totalPending.toFixed(2)}
                value={globalFiadoAmount}
                onChange={(e) => {
                  setGlobalFiadoAmount(e.target.value);
                  setConfirmGlobalPay(false);
                }}
                className="w-full text-sm p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 tabular-nums"
                placeholder="Ex: 50.00"
              />
              <input
                type="text"
                value={globalFiadoObservation}
                onChange={(e) => setGlobalFiadoObservation(e.target.value)}
                className="w-full text-sm p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                placeholder="Observação (opcional)"
              />
              {!confirmGlobalPay ? (
                <div className="flex gap-2">
                  <select
                    value={globalFiadoMethod}
                    onChange={(e) => setGlobalFiadoMethod(e.target.value as 'cash' | 'machine' | 'pix')}
                    className="flex-1 text-sm p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  >
                    <option value="cash">Dinheiro</option>
                    <option value="machine">Máquina</option>
                    <option value="pix">PIX</option>
                  </select>
                  <button
                    type="button"
                    disabled={!globalFiadoAmount || parseFloat(globalFiadoAmount) <= 0}
                    onClick={() => setConfirmGlobalPay(true)}
                    className="px-3 py-2 text-xs font-bold text-white bg-orange-600 hover:bg-orange-700 disabled:opacity-50 rounded-lg transition-colors flex justify-center items-center gap-1 whitespace-nowrap shrink-0"
                  >
                    <CheckCircle className="w-4 h-4" /> Abater
                  </button>
                </div>
              ) : (
                <div className="p-2.5 rounded-lg bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-800 flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-orange-900 dark:text-orange-200 tabular-nums">
                    Confirmar R$ {parseFloat(globalFiadoAmount || '0').toFixed(2)} ({formatMethodPt(globalFiadoMethod)})?
                  </span>
                  <div className="flex gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setConfirmGlobalPay(false)}
                      className="px-2.5 py-1 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md"
                    >
                      Não
                    </button>
                    <button
                      type="button"
                      disabled={isProcessingPay}
                      onClick={handleConfirmGlobalPay}
                      className="px-2.5 py-1 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-md disabled:opacity-50"
                    >
                      {isProcessingPay ? '...' : 'Sim'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Content List */}
      <div className="p-4 max-h-[360px] overflow-y-auto space-y-2.5 bg-white dark:bg-slate-900">
        {/* VIEW 1: Individual Items */}
        {(!enableAdvanced || viewMode === 'items') && (
          unpaidFiados.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-6">Nenhum fiado pendente.</p>
          ) : (
            unpaidFiados.map(item => (
              <div
                key={item.key}
                className="p-3 border border-slate-200/80 dark:border-slate-800 rounded-xl bg-slate-50/70 dark:bg-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                <div className="flex justify-between items-start mb-1.5 gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm truncate">{item.title}</p>
                    <div className="flex items-center flex-wrap gap-x-1.5 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      <span>{item.subtitle}</span>
                      {item.originTag === 'rental' && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-semibold text-teal-700 dark:text-teal-400">Vaga Alugada</span>
                        </>
                      )}
                      {item.originTag === 'card' && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-semibold text-purple-700 dark:text-purple-400">Cartão</span>
                        </>
                      )}
                      {enableAdvanced && (
                        <>
                          <span aria-hidden="true">·</span>
                          {renderAgingBadge(item.date)}
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0 tabular-nums">
                    <span className="font-bold text-orange-600 dark:text-orange-400 block text-sm">
                      R$ {item.remainingAmount.toFixed(2)}
                    </span>
                    {item.paidAmount > 0 && (
                      <span className="text-xs text-slate-400 font-medium line-through">
                        R$ {item.totalAmount.toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>

                {payingFiadoId === item.key ? (
                  <div className="mt-2.5 space-y-2">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max={item.remainingAmount.toFixed(2)}
                      value={fiadoPaymentAmount}
                      onChange={(e) => setFiadoPaymentAmount(e.target.value)}
                      className="w-full text-sm p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 tabular-nums"
                      placeholder="Valor a abater (vazio = total)"
                    />
                    <select
                      value={fiadoPaymentMethod}
                      onChange={(e) => setFiadoPaymentMethod(e.target.value as 'cash' | 'machine' | 'pix')}
                      className="w-full text-sm p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                    >
                      <option value="cash">Dinheiro</option>
                      <option value="machine">Cartão D/C (Máquina)</option>
                      <option value="pix">PIX</option>
                    </select>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setPayingFiadoId(null)}
                        className="flex-1 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        disabled={isProcessingPay}
                        onClick={async () => {
                          let amt = parseFloat(fiadoPaymentAmount);
                          if (isNaN(amt) || amt <= 0) amt = item.remainingAmount;
                          amt = Math.min(amt, item.remainingAmount);
                          setIsProcessingPay(true);
                          try {
                            if (item.kind === 'vehicle') {
                              await onPayFiado(item.id, fiadoPaymentMethod, amt);
                            } else if (onPayFiadoTransaction) {
                              await onPayFiadoTransaction(item.id, fiadoPaymentMethod, amt);
                            }
                            setPayingFiadoId(null);
                          } finally {
                            setIsProcessingPay(false);
                          }
                        }}
                        className="flex-1 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors flex justify-center items-center gap-1 disabled:opacity-50"
                      >
                        <CheckCircle className="w-3.5 h-3.5" /> Pagar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2 mt-2">
                    {canManageCashbook && (
                      <button
                        type="button"
                        onClick={() => {
                          setPayingFiadoId(item.key);
                          setFiadoPaymentMethod('cash');
                          setFiadoPaymentAmount('');
                        }}
                        className="flex-1 py-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 rounded-lg transition-colors"
                      >
                        {item.paidAmount > 0 ? 'Dar Baixa Restante' : 'Dar Baixa'}
                      </button>
                    )}
                    {((item.kind === 'vehicle' && deviceConfig?.enableWhatsappReceipts) || enableZap) && (
                      <button
                        type="button"
                        onClick={() => handleOpenItemWhatsapp(item)}
                        className="px-2.5 py-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-800 rounded-lg transition-colors flex items-center gap-1 whitespace-nowrap shrink-0"
                        title={item.phone ? `Cobrar via WhatsApp (${item.phone})` : 'Cobrar via WhatsApp'}
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span>Zap</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))
          )
        )}

        {/* VIEW 2: Grouped By Client (Advanced) */}
        {enableAdvanced && viewMode === 'clients' && (
          groupedClients.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-6">Nenhum cliente com fiado pendente.</p>
          ) : (
            groupedClients.map(group => (
              <div
                key={group.clientKey}
                className="p-3.5 border border-slate-200/80 dark:border-slate-800 rounded-xl bg-slate-50/70 dark:bg-slate-800/50"
              >
                <div className="flex justify-between items-start gap-2 mb-2">
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 dark:text-slate-100 text-sm truncate">{group.clientName}</p>
                    <div className="flex items-center flex-wrap gap-x-1.5 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      <span>{group.count} {group.count === 1 ? 'lançamento' : 'lançamentos'}</span>
                      <span aria-hidden="true">·</span>
                      <span>Desde {new Date(group.oldestDate).toLocaleDateString('pt-BR')}</span>
                      <span aria-hidden="true">·</span>
                      {renderAgingBadge(group.oldestDate)}
                    </div>
                  </div>
                  <span className="font-bold text-orange-600 dark:text-orange-400 text-sm tabular-nums shrink-0">
                    R$ {group.totalRemaining.toFixed(2)}
                  </span>
                </div>

                {payingClientKey === group.clientKey ? (
                  <div className="mt-2.5 space-y-2 pt-2 border-t border-slate-200/70 dark:border-slate-700">
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      max={group.totalRemaining.toFixed(2)}
                      value={clientPayAmount}
                      onChange={(e) => setClientPayAmount(e.target.value)}
                      className="w-full text-sm p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 tabular-nums"
                      placeholder={`Valor a abater (vazio = R$ ${group.totalRemaining.toFixed(2)})`}
                    />
                    <input
                      type="text"
                      value={clientPayObs}
                      onChange={(e) => setClientPayObs(e.target.value)}
                      className="w-full text-sm p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                      placeholder="Observação (opcional)"
                    />
                    <select
                      value={clientPayMethod}
                      onChange={(e) => setClientPayMethod(e.target.value as 'cash' | 'machine' | 'pix')}
                      className="w-full text-sm p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                    >
                      <option value="cash">Dinheiro</option>
                      <option value="machine">Máquina</option>
                      <option value="pix">PIX</option>
                    </select>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setPayingClientKey(null)}
                        className="flex-1 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-lg"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        disabled={isProcessingPay}
                        onClick={() => handlePayClientGroup(group)}
                        className="flex-1 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-50"
                      >
                        {isProcessingPay ? 'Salvando...' : 'Confirmar Baixa'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2 mt-2">
                    {canManageCashbook && (
                      <button
                        type="button"
                        onClick={() => {
                          setPayingClientKey(group.clientKey);
                          setClientPayAmount('');
                          setClientPayObs('');
                          setClientPayMethod('cash');
                        }}
                        className="flex-1 py-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 rounded-lg transition-colors"
                      >
                        Baixar deste Cliente
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        openWhatsappMessage(
                          buildClientFiadoSummaryWhatsappText({
                            clientName: group.clientName,
                            count: group.count,
                            totalRemaining: group.totalRemaining,
                            oldestDate: group.oldestDate
                          }),
                          group.phone
                        )
                      }
                      className="px-2.5 py-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-800 rounded-lg transition-colors flex items-center gap-1 whitespace-nowrap shrink-0"
                      title={group.phone ? `Cobrar no WhatsApp (${group.phone})` : 'Enviar resumo de cobrança no WhatsApp'}
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>Zap</span>
                    </button>
                  </div>
                )}
              </div>
            ))
          )
        )}

        {/* VIEW 3: Settled in Period (Advanced) */}
        {enableAdvanced && viewMode === 'settled' && (
          settledInPeriod.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-6">
              Nenhum fiado quitado no período selecionado.
            </p>
          ) : (
            settledInPeriod.map(item => (
              <div
                key={item.key}
                className="p-3 border border-emerald-200/70 dark:border-emerald-900/50 rounded-xl bg-emerald-50/40 dark:bg-emerald-950/20 flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm truncate">{item.title}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {new Date(item.date).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} · {item.origin} · Pago em {item.method}
                  </p>
                </div>
                <span className="font-bold text-emerald-700 dark:text-emerald-400 text-sm tabular-nums shrink-0">
                  R$ {item.amount.toFixed(2)}
                </span>
              </div>
            ))
          )
        )}
      </div>
    </div>
  );
}
