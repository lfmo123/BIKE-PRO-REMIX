import React, { useState } from 'react';
import { Shift, Transaction, ParkedVehicle, Sale } from '../types';
import { CheckSquare, LockIcon, Loader2, ArrowUpRight, ArrowDownRight, Clock, User, Banknote } from 'lucide-react';

interface ShiftControlProps {
  shifts: Shift[];
  transactions: Transaction[];
  vehicles: ParkedVehicle[];
  sales: Sale[];
  activeShift: Shift | undefined;
  user: { email: string; displayName: string };
  onOpenShift: (operatorName: string, initialChange: number) => Promise<void>;
  onCloseShift: (shift: Shift) => Promise<void>;
}

export function ShiftControl({ shifts, transactions, vehicles, sales, activeShift, user, onOpenShift, onCloseShift }: ShiftControlProps) {
  const [operatorName, setOperatorName] = useState(user?.displayName || 'Operador');
  const [initialChange, setInitialChange] = useState('');
  const [finalChange, setFinalChange] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Calculate potential summary if shift is open
  const calculateCurrentSummary = () => {
    if (!activeShift) return null;
    
    const shiftTransactions = transactions.filter(t => t.date >= activeShift.startTime && (!activeShift.endTime || t.date <= activeShift.endTime));
    
    // Vehicles checked in during this shift
    const checkedInVehicles = vehicles.filter(v => v.checkInTime >= activeShift.startTime && (!activeShift.endTime || v.checkInTime <= activeShift.endTime));
    // Vehicles checked out during this shift
    const checkedOutVehicles = vehicles.filter(v => v.status === 'completed' && v.checkOutTime && v.checkOutTime >= activeShift.startTime && (!activeShift.endTime || v.checkOutTime <= activeShift.endTime));

    const overnightCount = vehicles.filter(v => 
        v.status === 'completed' && 
        v.checkOutTime && 
        v.checkOutTime >= activeShift.startTime && 
        v.checkOutTime - v.checkInTime > 24 * 60 * 60 * 1000
    ).length;

    let totalIncome = 0;
    let totalExpense = 0;
    let totalCash = 0;
    let totalCard = 0;
    let totalPix = 0;
    let totalMachine = 0;

    // manual transactions
    shiftTransactions.forEach(t => {
      if (t.type === 'income') {
         totalIncome += t.amount;
         // Assume manual transactions are diverse, but default to cash. For simplicity, just add to totals.
      } else {
         totalExpense += t.amount;
      }
    });

    // Sales during shift
    const shiftSales = sales.filter(s => s.date >= activeShift.startTime && (!activeShift.endTime || s.date <= activeShift.endTime));
    
    const addPayment = (amount: number, method?: string) => {
        if (method === 'cash') totalCash += amount;
        else if (method === 'card') totalCard += amount;
        else if (method === 'pix') totalPix += amount;
        else if (method === 'machine') totalMachine += amount;
        else totalCash += amount; // fallback to cash for old records without method
    };

    checkedOutVehicles.forEach(v => {
        if (v.price && !['fiado', 'postpaid_card'].includes(v.paymentMethod || '')) {
            totalIncome += v.price;
            addPayment(v.price, v.paymentMethod);
        }
    });

    shiftSales.forEach(s => {
       if (!['fiado', 'postpaid_card'].includes(s.paymentMethod || '')) {
           totalIncome += s.totalPrice;
           addPayment(s.totalPrice, s.paymentMethod);
       }
    });

    return { totalIncome, totalExpense, totalCash, totalCard, totalPix, totalMachine, overnightCount, checkIns: checkedInVehicles.length, checkOuts: checkedOutVehicles.length };
  };

  const currentSummary = calculateCurrentSummary();

  const handleOpenShift = async (e: React.FormEvent) => {
    e.preventDefault();
    const change = parseFloat(initialChange);
    if (isNaN(change)) return;
    setIsProcessing(true);
    await onOpenShift(operatorName, change);
    setInitialChange('');
    setIsProcessing(false);
  };

  const handleCloseShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeShift || !currentSummary) return;
    const finalAmt = parseFloat(finalChange);
    
    setIsProcessing(true);
    await onCloseShift({
      ...activeShift,
      endTime: Date.now(),
      finalChange: isNaN(finalAmt) ? 0 : finalAmt,
      status: 'closed',
      summary: currentSummary
    });
    setFinalChange('');
    setIsProcessing(false);
  };

  // Sort history shifts to display
  const shiftHistory = [...shifts].filter(s => s.status === 'closed').sort((a,b) => b.startTime - a.startTime).slice(0, 5);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div className="flex items-center space-x-4">
          <div className="bg-orange-100 p-3 rounded-xl">
            <LockIcon className="w-8 h-8 text-orange-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Fechamento de Caixa</h1>
            <p className="text-slate-500 font-medium">Controle de turno financeiro e prestação de contas</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Active Shift Area */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center">
                  {activeShift ? "Turno Atual" : "Iniciar Novo Turno"}
              </h2>

              {!activeShift ? (
                  <form onSubmit={handleOpenShift} className="space-y-4">
                      <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Operador Responsável</label>
                          <div className="relative">
                              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
                              <input 
                                  type="text" 
                                  required 
                                  className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500" 
                                  value={operatorName} 
                                  onChange={e => setOperatorName(e.target.value)} 
                              />
                          </div>
                      </div>
                      <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Troco Inicial (Reserva de Caixa)</label>
                          <div className="relative">
                              <Banknote className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
                              <input 
                                  type="number" 
                                  step="0.01"
                                  min="0"
                                  required 
                                  className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500" 
                                  value={initialChange} 
                                  onChange={e => setInitialChange(e.target.value)} 
                                  placeholder="Ex: 50.00"
                              />
                          </div>
                      </div>
                      <button 
                          disabled={isProcessing}
                          type="submit" 
                          className="w-full py-4 mt-4 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold text-lg transition-colors flex items-center justify-center gap-2 disabled:bg-slate-300"
                      >
                          {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckSquare className="w-5 h-5" />}
                          Abrir Caixa
                      </button>
                  </form>
              ) : (
                  <form onSubmit={handleCloseShift} className="space-y-6">
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-center justify-between">
                          <div>
                              <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">Operador Ativo</p>
                              <p className="text-lg font-bold text-slate-900">{activeShift.operatorName}</p>
                              <div className="text-xs text-slate-500 flex items-center mt-1">
                                  <Clock className="w-3 h-3 mr-1" />
                                  Aberto em {new Date(activeShift.startTime).toLocaleString('pt-BR')}
                              </div>
                          </div>
                          <div className="text-right">
                              <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">Troco Inicial</p>
                              <p className="text-lg font-bold text-orange-600">R$ {activeShift.initialChange.toFixed(2)}</p>
                          </div>
                      </div>

                      {currentSummary && (
                          <div className="grid grid-cols-2 gap-3">
                              <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                                  <span className="text-xs font-semibold text-emerald-800 uppercase flex items-center"><ArrowUpRight className="w-3 h-3 mr-1"/> Entradas</span>
                                  <p className="text-xl font-bold text-emerald-700">R$ {currentSummary.totalIncome.toFixed(2)}</p>
                              </div>
                              <div className="bg-red-50 p-4 rounded-xl border border-red-100">
                                  <span className="text-xs font-semibold text-red-800 uppercase flex items-center"><ArrowDownRight className="w-3 h-3 mr-1"/> Saídas</span>
                                  <p className="text-xl font-bold text-red-700">R$ {currentSummary.totalExpense.toFixed(2)}</p>
                              </div>
                              <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 col-span-2 flex justify-between items-center">
                                  <span className="text-sm font-bold text-blue-800">Saldo Parcial do Turno</span>
                                  <p className="text-2xl font-bold text-blue-900">R$ {(activeShift.initialChange + currentSummary.totalIncome - currentSummary.totalExpense).toFixed(2)}</p>
                              </div>
                          </div>
                      )}

                      <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Troco Final Repassado / Retirado</label>
                          <div className="relative">
                              <Banknote className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
                              <input 
                                  type="number" 
                                  step="0.01"
                                  min="0"
                                  required 
                                  className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-500 text-lg font-bold" 
                                  value={finalChange} 
                                  onChange={e => setFinalChange(e.target.value)} 
                                  placeholder="Ex: 50.00"
                              />
                          </div>
                          <p className="text-xs text-slate-500 mt-1">Insira o valor em dinheiro que ficará no caixa para o próximo turno.</p>
                      </div>

                      <button 
                          disabled={isProcessing}
                          type="submit" 
                          className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-lg transition-colors flex items-center justify-center gap-2 disabled:bg-slate-500"
                      >
                          {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <LockIcon className="w-5 h-5" />}
                          Conferir e Fechar Turno
                      </button>
                  </form>
              )}
          </div>

          {/* Shift History & Reports Area */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col h-full">
               <h2 className="text-xl font-bold text-slate-900 mb-6 border-b border-slate-100 pb-2">Últimos Fechamentos</h2>
               <div className="space-y-4 flex-1 overflow-y-auto pr-2">
                   {shiftHistory.length === 0 ? (
                       <p className="text-slate-500 text-center py-8">Nenhum turno fechado ainda.</p>
                   ) : (
                       shiftHistory.map(shift => (
                           <div key={shift.id} className="bg-slate-50 p-4 rounded-xl border border-slate-100 group">
                               <div className="flex justify-between items-start mb-2">
                                   <div>
                                       <h3 className="font-bold text-slate-900">{shift.operatorName}</h3>
                                       <p className="text-xs text-slate-500">
                                           {new Date(shift.startTime).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })} - {shift.endTime ? new Date(shift.endTime).toLocaleString('pt-BR', { timeStyle: 'short' }) : 'N/A'}
                                       </p>
                                   </div>
                                    <button 
                                        className="text-xs font-bold text-blue-600 bg-white border border-blue-200 px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-blue-50"
                                        onClick={() => {
                                           // We could launch a print view here
                                           window.print();
                                        }}
                                    >
                                        Imprimir
                                    </button>
                               </div>
                               
                               <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-200/60">
                                   <div>
                                       <p className="text-[10px] uppercase font-bold text-slate-400">Total Entradas</p>
                                       <p className="font-bold text-emerald-600">R$ {shift.summary?.totalIncome?.toFixed(2) || '0.00'}</p>
                                   </div>
                                   <div>
                                        <p className="text-[10px] uppercase font-bold text-slate-400">Veículos (Pernoites)</p>
                                        <p className="font-bold text-slate-700">{shift.summary?.checkOuts || 0} ({shift.summary?.overnightCount || 0})</p>
                                   </div>
                               </div>
                           </div>
                       ))
                   )}
               </div>
          </div>
      </div>
    </div>
  );
}
