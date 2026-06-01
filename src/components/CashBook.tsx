import React, { useState } from 'react';
import { Transaction, ParkedVehicle } from '../types';
import { Wallet, Plus, ArrowUpRight, ArrowDownRight, Trash2, Calendar } from 'lucide-react';

interface CashBookProps {
  transactions: Transaction[];
  vehicles: ParkedVehicle[];
  onAddTransaction: (transaction: Omit<Transaction, 'id'>) => Promise<void>;
  onDeleteTransaction: (id: string) => Promise<void>;
}

export function CashBook({ transactions, vehicles, onAddTransaction, onDeleteTransaction }: CashBookProps) {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // Derived today's timestamp bounds
  const [year, month, day] = selectedDate.split('-').map(Number);
  const startOfDay = new Date(year, month - 1, day, 0, 0, 0).getTime();
  const endOfDay = new Date(year, month - 1, day, 23, 59, 59, 999).getTime();

  // Combine manual transactions (expenses only) + vehicle checkouts for the selected day
  const dailyTransactions = transactions.filter(t => t.type === 'expense' && t.date >= startOfDay && t.date <= endOfDay);
  const dailyCheckouts = vehicles.filter(v => v.status === 'completed' && v.checkOutTime && v.checkOutTime >= startOfDay && v.checkOutTime <= endOfDay);

  const combinedEntries = [
    ...dailyTransactions.map(t => ({
      id: t.id,
      description: t.description,
      amount: t.amount,
      date: t.date,
      type: t.type,
      isManual: true
    })),
    ...dailyCheckouts.map(v => ({
      id: v.id,
      description: `Check-out: ${v.identifier} (${
        v.paymentMethod === 'machine' ? 'MÁQUINA' :
        v.paymentMethod === 'card' ? 'CARTÃO' : 
        v.paymentMethod === 'cash' ? 'DINHEIRO' : 
        v.paymentMethod === 'postpaid_card' ? 'PÓS-PAGO' : 
        v.paymentMethod === 'fiado' ? 'FIADO' : 
        v.paymentMethod?.toUpperCase() || 'N/A'
      })`,
      amount: v.price || 0,
      date: v.checkOutTime || 0,
      type: 'income' as const,
      isManual: false
    }))
  ].sort((a, b) => b.date - a.date);

  const totalIncome = combinedEntries.filter(e => e.type === 'income').reduce((acc, curr) => acc + curr.amount, 0);
  const totalExpense = combinedEntries.filter(e => e.type === 'expense').reduce((acc, curr) => acc + curr.amount, 0);
  const balance = totalIncome - totalExpense;

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description || !amount) return;
    
    // Use current time, but force it to the selected day
    const now = new Date();
    const transactionDate = new Date(year, month - 1, day, now.getHours(), now.getMinutes(), now.getSeconds()).getTime();

    await onAddTransaction({
      description,
      amount: parseFloat(amount),
      type: 'expense',
      date: transactionDate
    });

    setDescription('');
    setAmount('');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Livro Caixa</h1>
          <p className="text-slate-500">Controle financeiro diário do estacionamento</p>
        </div>
        <div className="flex items-center space-x-2 bg-white px-4 py-2 border border-slate-200 rounded-xl shadow-sm">
          <Calendar className="w-5 h-5 text-slate-400" />
          <input 
            type="date" 
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-transparent border-none focus:ring-0 text-slate-700 font-medium"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500 mb-1">Entradas (Dia)</p>
            <p className="text-2xl font-bold text-emerald-600">R$ {totalIncome.toFixed(2)}</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center">
            <ArrowUpRight className="w-6 h-6 text-emerald-500" />
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500 mb-1">Saídas (Dia)</p>
            <p className="text-2xl font-bold text-red-600">R$ {totalExpense.toFixed(2)}</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center">
            <ArrowDownRight className="w-6 h-6 text-red-500" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500 mb-1">Saldo (Dia)</p>
            <p className={`text-2xl font-bold ${balance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              R$ {balance.toFixed(2)}
            </p>
          </div>
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${balance >= 0 ? 'bg-emerald-50' : 'bg-red-50'}`}>
            <Wallet className={`w-6 h-6 ${balance >= 0 ? 'text-emerald-500' : 'text-red-500'}`} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Nova Despesa</h2>
            <form onSubmit={handleAddTransaction} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Descrição</label>
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
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden h-full flex flex-col">
            <div className="p-6 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900">Extrato do Dia</h2>
            </div>
            <div className="overflow-y-auto p-2" style={{ maxHeight: '600px' }}>
              {combinedEntries.length > 0 ? (
                <div className="space-y-2">
                  {combinedEntries.map((entry) => (
                    <div key={entry.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="flex items-center space-x-4">
                        <div className={`p-2 rounded-lg ${entry.type === 'income' ? 'bg-emerald-100' : 'bg-red-100'}`}>
                          {entry.type === 'income' ? (
                            <ArrowUpRight className="w-5 h-5 text-emerald-600" />
                          ) : (
                            <ArrowDownRight className="w-5 h-5 text-red-600" />
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">{entry.description}</p>
                          <p className="text-xs text-slate-500">
                            {new Date(entry.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            {!entry.isManual && ' • Automático'}
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
                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
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
                  <p className="text-slate-500">Não há movimentações para o dia selecionado.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
