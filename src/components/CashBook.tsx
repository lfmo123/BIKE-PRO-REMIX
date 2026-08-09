import React, { useState } from 'react';
import { Transaction, ParkedVehicle, Shift } from '../types';
import { Wallet, Plus, ArrowUpRight, ArrowDownRight, Trash2, Calendar, AlertTriangle, CheckCircle, FileText, Search, Clock, Filter, RotateCcw, Printer } from 'lucide-react';
import { getLocalDateString } from '../lib/dateUtils';
import { DailyReportModal } from './DailyReportModal';
import { FiadoSearchModal } from './FiadoSearchModal';

interface CashBookProps {
  transactions: Transaction[];
  vehicles: ParkedVehicle[];
  shifts?: Shift[];
  onAddTransaction: (transaction: Omit<Transaction, 'id'>) => Promise<void>;
  onDeleteTransaction: (id: string) => Promise<void>;
  onPayFiado: (id: string, paymentMethod: string, amount: number, observation?: string) => Promise<void>;
}

export function CashBook({ transactions, vehicles, shifts = [], onAddTransaction, onDeleteTransaction, onPayFiado }: CashBookProps) {
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Outros');
  const [amount, setAmount] = useState('');

  // Date and Time Range State
  const todayStr = getLocalDateString();
  const [startDate, setStartDate] = useState<string>(todayStr);
  const [startTime, setStartTime] = useState<string>('00:00');
  const [endDate, setEndDate] = useState<string>(todayStr);
  const [endTime, setEndTime] = useState<string>('23:59');

  const [payingFiadoId, setPayingFiadoId] = useState<string | null>(null);
  const [fiadoPaymentMethod, setFiadoPaymentMethod] = useState<'cash'|'machine'|'card'|'pix'>('cash');
  const [fiadoPaymentAmount, setFiadoPaymentAmount] = useState<string>('');
  const [globalFiadoAmount, setGlobalFiadoAmount] = useState<string>('');
  const [globalFiadoMethod, setGlobalFiadoMethod] = useState<'cash'|'machine'|'card'|'pix'>('cash');
  const [globalFiadoObservation, setGlobalFiadoObservation] = useState<string>('');
  const [isDailyReportOpen, setIsDailyReportOpen] = useState(false);
  const [isFiadoSearchOpen, setIsFiadoSearchOpen] = useState(false);

  // Derive Period Timestamps
  const getStartTimestamp = () => {
    if (!startDate) return 0;
    const [y, m, d] = startDate.split('-').map(Number);
    const [h, min] = (startTime || '00:00').split(':').map(Number);
    return new Date(y, m - 1, d, h || 0, min || 0, 0, 0).getTime();
  };

  const getEndTimestamp = () => {
    if (!endDate) return Date.now();
    const [y, m, d] = endDate.split('-').map(Number);
    const [h, min] = (endTime || '23:59').split(':').map(Number);
    return new Date(y, m - 1, d, h || 23, min || 59, 59, 999).getTime();
  };

  const startOfPeriod = getStartTimestamp();
  const endOfPeriod = getEndTimestamp();

  // Preset Handlers
  const handlePreset = (preset: 'today' | 'yesterday' | 'last7' | 'thisMonth' | 'all') => {
    const now = new Date();
    const today = getLocalDateString(now);
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
    }
  };

  // Combine manual transactions + vehicle checkouts for the selected period
  const periodTransactions = transactions.filter(t => t.date >= startOfPeriod && t.date <= endOfPeriod);
  const periodCheckouts = vehicles.filter(v => 
    v.status === 'completed' && 
    !['fiado', 'card', 'postpaid_card'].includes(v.paymentMethod || '') && 
    v.checkOutTime && 
    v.checkOutTime >= startOfPeriod && 
    v.checkOutTime <= endOfPeriod
  );

  const combinedEntries = [
    ...periodTransactions.map(t => ({
      id: t.id,
      description: t.description,
      amount: t.amount,
      date: t.date,
      type: t.type,
      operator: t.operator,
      category: t.category,
      isManual: true
    })),
    ...periodCheckouts.map(v => ({
      id: v.id,
      description: `Check-out: ${v.identifier} (${
        v.paymentMethod === 'machine' ? 'MÁQUINA' :
        v.paymentMethod === 'card' ? 'PRÉ PAGO' : 
        v.paymentMethod === 'cash' ? 'DINHEIRO' : 
        v.paymentMethod === 'postpaid_card' ? 'PÓS-PAGO' : 
        v.paymentMethod?.toUpperCase() || 'N/A'
      })`,
      amount: v.price || 0,
      date: v.checkOutTime || 0,
      type: 'income' as const,
      isManual: false
    }))
  ].sort((a, b) => b.date - a.date);

  // Calculate breakdown
  let incomeCash = 0;
  let incomeMachine = 0;
  let incomePix = 0;
  let incomeFiado = 0; // Fiado generated in period

  periodCheckouts.forEach(v => {
      const p = v.price || 0;
      if (v.paymentMethod === 'cash') incomeCash += p;
      else if (v.paymentMethod === 'machine') incomeMachine += p;
      else if (v.paymentMethod === 'pix') incomePix += p;
      else incomeCash += p; // fallback
  });

  const manualIncomes = periodTransactions.filter(t => t.type === 'income');
  manualIncomes.forEach(t => {
      const amount = t.amount;
      const desc = (t.description || '').toUpperCase();
      if (desc.includes('MÁQUINA')) incomeMachine += amount;
      else if (desc.includes('PIX')) incomePix += amount;
      else if (desc.includes('CARTÃO')) incomeMachine += amount;
      else incomeCash += amount;
  });

  vehicles.forEach(v => {
      if (v.status === 'completed' && v.paymentMethod === 'fiado' && v.checkOutTime && v.checkOutTime >= startOfPeriod && v.checkOutTime <= endOfPeriod) {
          incomeFiado += (v.price || 0);
      }
  });

  const totalIncome = combinedEntries.filter(e => e.type === 'income').reduce((acc, curr) => acc + curr.amount, 0);
  const totalExpense = combinedEntries.filter(e => e.type === 'expense').reduce((acc, curr) => acc + curr.amount, 0);
  const balance = totalIncome - totalExpense;

  const unpaidFiados = vehicles.filter(v => v.status === 'completed' && v.paymentMethod === 'fiado' && !v.isFiadoPaid);
  
  const activeShift = shifts.find(s => s.status === 'open');

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description || !amount) return;
    
    // Use current time, but force it to the startDate
    const now = new Date();
    const [y, m, d] = (startDate || todayStr).split('-').map(Number);
    const transactionDate = new Date(y, m - 1, d, now.getHours(), now.getMinutes(), now.getSeconds()).getTime();

    await onAddTransaction({
      description,
      amount: parseFloat(amount),
      type: 'expense',
      date: transactionDate,
      category,
      operator: activeShift?.operatorName || 'Admin'
    });

    setDescription('');
    setAmount('');
    setCategory('Outros');
  };

  const handlePayGlobalFiado = async () => {
    let amountToDistribute = parseFloat(globalFiadoAmount);
    if (isNaN(amountToDistribute) || amountToDistribute <= 0) return;

    if (!window.confirm(`Confirma a baixa global de R$ ${amountToDistribute.toFixed(2)}?`)) return;

    const sortedFiados = [...unpaidFiados].sort((a, b) => (a.checkOutTime || 0) - (b.checkOutTime || 0));

    for (const v of sortedFiados) {
      if (amountToDistribute <= 0) break;
      const remainingOnVehicle = (v.price || 0) - (v.fiadoPaidAmount || 0);
      if (remainingOnVehicle <= 0) continue;

      const amountToPayHere = Math.min(amountToDistribute, remainingOnVehicle);
      await onPayFiado(v.id, globalFiadoMethod, amountToPayHere, globalFiadoObservation);
      amountToDistribute -= amountToPayHere;
    }

    setGlobalFiadoAmount('');
    setGlobalFiadoObservation('');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Livro Caixa</h1>
          <p className="text-slate-500">Controle financeiro e consulta por período do estacionamento</p>
        </div>
        
        <div className="flex flex-wrap gap-2 sm:gap-3 print:hidden">
          <button
            onClick={() => window.print()}
            className="flex items-center justify-center space-x-2 bg-slate-100 text-slate-700 hover:bg-slate-200 px-4 py-2 border border-slate-200 rounded-xl transition-colors font-medium shadow-sm"
          >
            <Printer className="w-5 h-5" />
            <span>Imprimir Filtro</span>
          </button>
          <button
            onClick={() => setIsFiadoSearchOpen(true)}
            className="flex items-center justify-center space-x-2 bg-orange-100 text-orange-800 hover:bg-orange-200 px-4 py-2 border border-orange-200 rounded-xl transition-colors font-medium shadow-sm"
          >
            <Search className="w-5 h-5" />
            <span>Pesquisar Fiados</span>
          </button>

          <button
            onClick={() => setIsDailyReportOpen(true)}
            className="flex items-center justify-center space-x-2 bg-emerald-100 text-emerald-700 hover:bg-emerald-200 px-4 py-2 border border-emerald-200 rounded-xl transition-colors font-medium shadow-sm"
          >
            <FileText className="w-5 h-5" />
            <span>Fechamento Detalhado</span>
          </button>
        </div>
      </div>

      {/* Print Only Header */}
      <div className="hidden print:block mb-6">
        <h2 className="text-xl font-bold text-slate-900 border-b border-slate-200 pb-2 mb-2">Relatório do Livro Caixa</h2>
        <p className="text-slate-600">
          Período: <strong>{startDate.split('-').reverse().join('/')} {startTime}</strong> até <strong>{endDate.split('-').reverse().join('/')} {endTime}</strong>
        </p>
      </div>

      {/* Date & Time Range Filter Card */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 print:hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3 border-b border-slate-100">
          <div className="flex items-center space-x-2">
            <Filter className="w-5 h-5 text-emerald-600" />
            <h2 className="font-bold text-slate-900 text-base">Filtro de Período e Horário</h2>
          </div>

          {/* Quick Presets */}
          <div className="flex flex-wrap gap-1.5 items-center">
            <span className="text-xs font-semibold text-slate-400 mr-1">Atalhos:</span>
            <button
              type="button"
              onClick={() => handlePreset('today')}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 transition-colors"
            >
              Hoje
            </button>
            <button
              type="button"
              onClick={() => handlePreset('yesterday')}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 transition-colors"
            >
              Ontem
            </button>
            <button
              type="button"
              onClick={() => handlePreset('last7')}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 transition-colors"
            >
              Últimos 7 dias
            </button>
            <button
              type="button"
              onClick={() => handlePreset('thisMonth')}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 transition-colors"
            >
              Este Mês
            </button>
            <button
              type="button"
              onClick={() => handlePreset('all')}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 transition-colors"
            >
              Tudo
            </button>
          </div>
        </div>

        {/* Inputs Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Start Date */}
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-emerald-600" /> Data Inicial
            </label>
            <input 
              type="date" 
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>

          {/* Start Time */}
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-emerald-600" /> Hora Inicial
            </label>
            <input 
              type="time" 
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>

          {/* End Date */}
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-emerald-600" /> Data Final
            </label>
            <input 
              type="date" 
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>

          {/* End Time */}
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-emerald-600" /> Hora Final
            </label>
            <input 
              type="time" 
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>
        </div>

        {/* Summary info banner */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100 gap-2">
          <span>
            Exibindo faturamento de <strong className="text-slate-800">{startDate.split('-').reverse().join('/')} às {startTime}</strong> até <strong className="text-slate-800">{endDate.split('-').reverse().join('/')} às {endTime}</strong>
          </span>

          {(startDate !== todayStr || startTime !== '00:00' || endDate !== todayStr || endTime !== '23:59') && (
            <button
              type="button"
              onClick={() => handlePreset('today')}
              className="flex items-center gap-1 text-emerald-600 hover:text-emerald-700 font-bold transition-colors"
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
          onClose={() => setIsDailyReportOpen(false)}
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-medium text-slate-500 mb-1">Entradas (Período)</p>
              <p className="text-2xl font-bold text-emerald-600">R$ {totalIncome.toFixed(2)}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
              <ArrowUpRight className="w-6 h-6 text-emerald-500" />
            </div>
          </div>
          <div className="mt-auto grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-slate-600 border-t border-slate-100 pt-3">
            <div className="flex justify-between"><span>Dinheiro:</span> <span className="font-semibold text-slate-800">R$ {incomeCash.toFixed(2)}</span></div>
            <div className="flex justify-between"><span>Máquina:</span> <span className="font-semibold text-slate-800">R$ {incomeMachine.toFixed(2)}</span></div>
            {incomePix > 0 && <div className="flex justify-between"><span>PIX:</span> <span className="font-semibold text-slate-800">R$ {incomePix.toFixed(2)}</span></div>}
            <div className="flex justify-between col-span-2 border-t border-slate-50 pt-1 mt-1 text-orange-600 text-[11px]">
              <span>Fiado Gerado no Período (Pendente):</span> <span className="font-bold">R$ {incomeFiado.toFixed(2)}</span>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500 mb-1">Saídas (Período)</p>
            <p className="text-2xl font-bold text-red-600">R$ {totalExpense.toFixed(2)}</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center">
            <ArrowDownRight className="w-6 h-6 text-red-500" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500 mb-1">Saldo (Período)</p>
            <p className={`text-2xl font-bold ${balance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              R$ {balance.toFixed(2)}
            </p>
          </div>
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${balance >= 0 ? 'bg-emerald-50' : 'bg-red-50'}`}>
            <Wallet className={`w-6 h-6 ${balance >= 0 ? 'text-emerald-500' : 'text-red-500'}`} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 print:block">
        <div className="lg:col-span-1 flex flex-col gap-6 print:hidden">
          {/* Caixa de Fiado Section */}
          <div className="bg-white rounded-2xl shadow-sm border border-orange-200 overflow-hidden">
             <div className="p-6 border-b border-orange-100 bg-orange-50/50">
               <div className="flex items-center justify-between gap-2">
                 <div className="flex items-center gap-2">
                   <AlertTriangle className="w-5 h-5 text-orange-500" />
                   <h2 className="text-lg font-bold text-orange-900">Caixa do Fiado</h2>
                 </div>
                 <button
                   onClick={() => setIsFiadoSearchOpen(true)}
                   className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
                 >
                   <Search className="w-3.5 h-3.5" />
                   Origem & Pesquisa
                 </button>
               </div>
               <p className="text-sm text-orange-700 mt-1 mb-4">
                 Total em haver: <span className="font-bold">R$ {unpaidFiados.reduce((acc, v) => acc + ((v.price || 0) - (v.fiadoPaidAmount || 0)), 0).toFixed(2)}</span> ({unpaidFiados.length})
               </p>
               {unpaidFiados.length > 0 && (
                 <div className="bg-white p-3 rounded-xl border border-orange-200">
                   <p className="text-xs font-bold text-orange-800 mb-2">ABATER DO TOTAL</p>
                   <div className="space-y-2">
                     <input 
                       type="number" 
                       step="0.01" 
                       min="0.01"
                       max={unpaidFiados.reduce((acc, v) => acc + ((v.price || 0) - (v.fiadoPaidAmount || 0)), 0).toFixed(2)}
                       value={globalFiadoAmount}
                       onChange={(e) => setGlobalFiadoAmount(e.target.value)}
                       className="w-full text-sm p-2 rounded-lg border border-slate-200"
                       placeholder="Ex: 50.00"
                     />
                     <input 
                       type="text"
                       value={globalFiadoObservation}
                       onChange={(e) => setGlobalFiadoObservation(e.target.value)}
                       className="w-full text-sm p-2 rounded-lg border border-slate-200"
                       placeholder="Observação (opcional)"
                     />
                     <div className="flex gap-2">
                       <select 
                         value={globalFiadoMethod}
                         onChange={(e) => setGlobalFiadoMethod(e.target.value as any)}
                         className="flex-1 text-sm p-2 rounded-lg border border-slate-200 bg-white"
                       >
                         <option value="cash">Dinheiro</option>
                         <option value="machine">Máquina</option>
                       </select>
                       <button
                         onClick={handlePayGlobalFiado}
                         className="px-3 py-2 text-xs font-bold text-white bg-orange-500 hover:bg-orange-600 rounded-lg transition-colors flex justify-center items-center gap-1"
                       >
                         <CheckCircle className="w-4 h-4" /> Abater
                       </button>
                     </div>
                   </div>
                 </div>
               )}
             </div>
             
             <div className="p-4 max-h-[300px] overflow-y-auto space-y-3 bg-white">
               {unpaidFiados.length === 0 ? (
                 <p className="text-sm text-slate-500 text-center py-4">Nenhum fiado pendente.</p>
               ) : (
                 unpaidFiados.map(v => (
                   <div key={v.id} className="p-3 border border-slate-100 rounded-xl bg-slate-50/50 hover:bg-slate-50 transition-colors">
                     <div className="flex justify-between items-start mb-2">
                       <div>
                         <p className="font-semibold text-slate-900 text-sm">{v.identifier}</p>
                         <p className="text-xs text-slate-500">{new Date(v.checkOutTime || 0).toLocaleDateString('pt-BR')} • {v.ownerName}</p>
                       </div>
                       <div className="text-right">
                         <span className="font-bold text-orange-600 block">R$ {((v.price || 0) - (v.fiadoPaidAmount || 0)).toFixed(2)}</span>
                         {v.fiadoPaidAmount ? <span className="text-xs text-slate-400 font-medium line-through">R$ {v.price?.toFixed(2)}</span> : null}
                       </div>
                     </div>
                     
                     {payingFiadoId === v.id ? (
                        <div className="mt-3 space-y-2">
                           <input 
                             type="number" 
                             step="0.01" 
                             min="0"
                             max={((v.price || 0) - (v.fiadoPaidAmount || 0)).toFixed(2)}
                             value={fiadoPaymentAmount}
                             onChange={(e) => setFiadoPaymentAmount(e.target.value)}
                             className="w-full text-sm p-2 rounded-lg border border-slate-200 bg-white"
                             placeholder="Valor a abater (Deixe vazio para o total)"
                           />
                           <select 
                             value={fiadoPaymentMethod}
                             onChange={(e) => setFiadoPaymentMethod(e.target.value as any)}
                             className="w-full text-sm p-2 rounded-lg border border-slate-200 bg-white"
                           >
                              <option value="cash">Dinheiro</option>
                              <option value="machine">Cartão D/C (Máquina)</option>
                           </select>
                           <div className="flex gap-2">
                             <button
                               onClick={() => setPayingFiadoId(null)}
                               className="flex-1 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                             >
                               Cancelar
                             </button>
                             <button
                               onClick={async () => {
                                 let amt = parseFloat(fiadoPaymentAmount);
                                 if (isNaN(amt) || amt <= 0) {
                                    // Default to full remaining if empty
                                    amt = (v.price || 0) - (v.fiadoPaidAmount || 0);
                                 }
                                 await onPayFiado(v.id, fiadoPaymentMethod, amt);
                                 setPayingFiadoId(null);
                               }}
                               className="flex-1 py-1.5 text-xs font-bold text-white bg-emerald-500 hover:bg-emerald-600 rounded-lg transition-colors flex justify-center items-center gap-1"
                             >
                               <CheckCircle className="w-3 h-3" /> Pagar
                             </button>
                           </div>
                        </div>
                     ) : (
                       <button 
                         onClick={() => {
                           setPayingFiadoId(v.id);
                           setFiadoPaymentMethod('cash');
                           setFiadoPaymentAmount(''); // empty defaults to remaining amount
                         }}
                         className="w-full mt-2 py-1.5 text-xs font-bold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors"
                       >
                         {v.fiadoPaidAmount ? 'Dar Baixa Restante' : 'Dar Baixa'}
                       </button>
                     )}
                   </div>
                 ))
               )}
             </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Nova Despesa</h2>
            <form onSubmit={handleAddTransaction} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Categoria da Despesa</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 mb-4"
                >
                  <option value="Manutenção">Manutenção</option>
                  <option value="Materiais">Materiais</option>
                  <option value="Pagamento">Pagamento</option>
                  <option value="Retirada">Retirada (Sangria)</option>
                  <option value="Outros">Outros</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Justificativa / Descrição</label>
                <input
                  type="text"
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ex: Pagamento de energia..."
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Valor (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-medium transition-colors flex items-center justify-center mt-2"
              >
                <Plus className="w-4 h-4 mr-2" />
                Adicionar Despesa
              </button>
            </form>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden h-full flex flex-col print:border-none print:shadow-none">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between print:px-0">
              <h2 className="text-lg font-bold text-slate-900">Extrato do Período</h2>
              <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full">
                {combinedEntries.length} {combinedEntries.length === 1 ? 'lançamento' : 'lançamentos'}
              </span>
            </div>
            <div className="overflow-y-auto print:overflow-visible p-2 print:p-0 max-h-[600px] print:max-h-none">
              {combinedEntries.length > 0 ? (
                <div className="space-y-2 print:space-y-1">
                  {combinedEntries.map((entry) => (
                    <div key={entry.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100 print:bg-transparent print:border-b print:border-slate-200 print:rounded-none print:px-0">
                      <div className="flex items-center space-x-4">
                        <div className={`p-2 rounded-lg print:hidden ${entry.type === 'income' ? 'bg-emerald-100' : 'bg-red-100'}`}>
                          {entry.type === 'income' ? (
                            <ArrowUpRight className="w-5 h-5 text-emerald-600" />
                          ) : (
                            <ArrowDownRight className="w-5 h-5 text-red-600" />
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">{entry.description}</p>
                          <p className="text-xs text-slate-500 flex flex-col sm:flex-row sm:items-center sm:gap-2">
                            <span>{new Date(entry.date).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                            {!entry.isManual && <span>• Automático</span>}
                            {entry.category && <span>• Cat: {entry.category}</span>}
                            {entry.operator && <span>• Op: {entry.operator}</span>}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-4">
                        <span className={`font-bold ${entry.type === 'income' ? 'text-emerald-600' : 'text-red-600'}`}>
                          {entry.type === 'income' ? '+' : '-'} R$ {entry.amount.toFixed(2)}
                        </span>
                        {entry.isManual && (
                          <button 
                            onClick={() => onDeleteTransaction(entry.id)}
                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors print:hidden"
                            title="Excluir"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center">
                  <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Wallet className="w-8 h-8 text-slate-400" />
                  </div>
                  <h3 className="text-lg font-medium text-slate-900 mb-1">Nenhum registro</h3>
                  <p className="text-slate-500">Não há movimentações para o período e horário selecionados.</p>
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
        onPayFiado={onPayFiado}
      />
    </div>
  );
}
