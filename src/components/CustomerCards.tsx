import React, { useState, useEffect } from 'react';
import { CustomerCard } from '../types';
import { Grid, Plus, Search, DollarSign, Edit, Trash2 } from 'lucide-react';

interface CustomerCardsProps {
  cards: CustomerCard[];
  onAddCard: (card: Omit<CustomerCard, 'id'>) => Promise<void>;
  onUpdateCard: (id: string, card: Partial<CustomerCard>) => Promise<void>;
  onDeleteCard: (id: string) => Promise<void>;
  onAddTransaction: (transaction: any) => Promise<void>;
}

export function CustomerCards({ cards, onAddCard, onUpdateCard, onDeleteCard, onAddTransaction }: CustomerCardsProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [cardNumber, setCardNumber] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('');
  const [type, setType] = useState<'prepaid' | 'postpaid'>('prepaid');
  const [balanceInput, setBalanceInput] = useState('');

  const [transactionCard, setTransactionCard] = useState<CustomerCard | null>(null);
  const [transactionAmount, setTransactionAmount] = useState('');
  const [transactionType, setTransactionType] = useState<'add' | 'refund'>('add');

  // Handle save
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await onAddCard({
      cardNumber,
      ownerName,
      phone,
      type,
      balance: parseFloat(balanceInput) || 0
    });
    setIsAdding(false);
    setCardNumber('');
    setOwnerName('');
    setPhone('');
    setType('prepaid');
    setBalanceInput('');
  };

  const filteredCards = cards.filter(c => 
    c.ownerName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.cardNumber.includes(searchTerm)
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div className="flex items-center space-x-4">
          <div className="bg-blue-100 p-3 rounded-xl">
            <Grid className="w-8 h-8 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Cartões Cadastrados</h1>
            <p className="text-slate-500 font-medium">Controle de clientes Mensalistas/Credenciados</p>
          </div>
        </div>
        
        <div className="flex gap-3">
          <div className="relative">
            <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar cliente ou cartão..."
              className="pl-10 pr-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 w-full sm:w-64"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl transition-all shadow-md shadow-blue-500/20 font-bold"
          >
            <Plus className="w-5 h-5" />
            <span className="hidden sm:inline">Novo Cartão</span>
          </button>
        </div>
      </div>

      {isAdding && (
        <form onSubmit={handleSave} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-4">
          <h2 className="text-lg font-bold text-slate-900">Cadastrar Novo Cartão</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="col-span-1 lg:col-span-1">
              <label className="block text-sm font-medium text-slate-700 mb-1">Nº do Cartão</label>
              <input required type="text" className="w-full px-3 py-2 border rounded-xl" value={cardNumber} onChange={e=>setCardNumber(e.target.value)} />
            </div>
            <div className="col-span-1 lg:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Nome do Cliente</label>
              <input required type="text" className="w-full px-3 py-2 border rounded-xl" value={ownerName} onChange={e=>setOwnerName(e.target.value)} />
            </div>
            <div className="col-span-1 lg:col-span-1">
              <label className="block text-sm font-medium text-slate-700 mb-1">Telefone</label>
              <input type="text" className="w-full px-3 py-2 border rounded-xl" value={phone} onChange={e=>setPhone(e.target.value)} />
            </div>
            <div className="col-span-1 lg:col-span-1">
              <label className="block text-sm font-medium text-slate-700 mb-1">Modalidade</label>
              <select className="w-full px-3 py-2 border rounded-xl" value={type} onChange={e=>setType(e.target.value as any)}>
                <option value="prepaid">Pré-pago (Crédito)</option>
                <option value="postpaid">Pós-pago (Conta)</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setIsAdding(false)} className="px-4 py-2 border rounded-xl text-slate-600 font-medium hover:bg-slate-50">Cancelar</button>
            <button type="submit" className="px-4 py-2 bg-blue-600 rounded-xl text-white font-bold hover:bg-blue-700">Salvar Cartão</button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredCards.map(card => (
          <div key={card.id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col relative group">
            <button onClick={() => onDeleteCard(card.id)} className="absolute top-4 right-4 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
              <Trash2 className="w-4 h-4" />
            </button>
            
            <div className="flex items-center gap-3 mb-3">
              <div className={`p-2 rounded-lg ${card.type === 'prepaid' ? 'bg-emerald-100 text-emerald-600' : 'bg-purple-100 text-purple-600'}`}>
                <Grid className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 leading-tight">{card.ownerName}</h3>
                <p className="text-xs text-slate-500 font-medium">Cartão #{card.cardNumber}</p>
              </div>
            </div>
            
            <p className="text-sm text-slate-600 mb-3 flex-1">{card.phone || 'Sem telefone'}</p>
            
            <div className={`p-3 rounded-xl border flex items-center justify-between mb-3 ${card.type === 'prepaid' ? 'bg-emerald-50 border-emerald-100' : 'bg-purple-50 border-purple-100'}`}>
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{card.type === 'prepaid' ? 'Saldo (Pré-pago)' : 'Fatura (Pós-pago)'}</span>
                <span className={`text-lg font-bold ${card.type === 'prepaid' ? 'text-emerald-700' : 'text-purple-700'}`}>
                  R$ {card.balance.toFixed(2)}
                </span>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                 onClick={() => { setTransactionType('add'); setTransactionCard(card); }}
                 className="flex-1 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-sm transition-colors"
              >
                 {card.type === 'prepaid' ? 'Adicionar Crédito' : 'Pagar Fatura'}
              </button>
              <button
                 onClick={() => { setTransactionType('refund'); setTransactionCard(card); }}
                 className="flex-1 py-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-xl font-bold text-sm transition-colors"
              >
                 Estornar
              </button>
            </div>
          </div>
        ))}
      </div>

      {transactionCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200 p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-2">
              {transactionType === 'refund'
                ? (transactionCard.type === 'prepaid' ? 'Estornar Crédito (Devolução)' : 'Estornar Pagamento (Adicionar Dívida)')
                : (transactionCard.type === 'prepaid' ? 'Adicionar Crédito' : 'Pagar Fatura')}
            </h2>
            <p className="text-slate-500 text-sm mb-6">Cliente: <span className="font-bold text-slate-700">{transactionCard.ownerName}</span> (Cartão #{transactionCard.cardNumber})</p>
            
            <label className="block text-sm font-medium text-slate-700 mb-1">Valor (R$)</label>
            <input 
              type="number" 
              min="0"
              step="0.01"
              value={transactionAmount}
              onChange={e => setTransactionAmount(e.target.value)}
              className="w-full px-4 py-3 border rounded-xl mb-6 text-lg focus:ring-2 focus:ring-blue-500" 
              placeholder="0.00"
            />
            
            <div className="flex gap-2">
              <button 
                onClick={() => { setTransactionCard(null); setTransactionAmount(''); }}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={async () => {
                  const amt = parseFloat(transactionAmount);
                  if (isNaN(amt) || amt <= 0) return;
                  
                  let newBalance = transactionCard.balance;
                  if (transactionType === 'add') {
                    if (transactionCard.type === 'prepaid') newBalance += amt;
                    else newBalance = Math.max(0, newBalance - amt); // reduce debt
                  } else {
                    // refund
                    if (transactionCard.type === 'prepaid') newBalance = Math.max(0, newBalance - amt); // remove credit
                    else newBalance += amt; // increase debt
                  }
                  
                  await onUpdateCard(transactionCard.id, { balance: newBalance });
                  
                  await onAddTransaction({
                     description: transactionType === 'add'
                       ? `${transactionCard.type === 'prepaid' ? 'Recarga Pré-pago' : 'Pgto. Conta Pós-pago'}: Cartão ${transactionCard.cardNumber} (${transactionCard.ownerName})`
                       : `Estorno ${transactionCard.type === 'prepaid' ? 'Pré-pago' : 'Pós-pago'}: Cartão ${transactionCard.cardNumber} (${transactionCard.ownerName})`,
                     amount: amt,
                     date: Date.now(),
                     type: transactionType === 'add' ? 'income' : 'expense'
                  });
                  
                  setTransactionCard(null);
                  setTransactionAmount('');
                }}
                className={`flex-1 py-3 text-white font-bold rounded-xl transition-colors ${
                  transactionType === 'refund' ? 'bg-red-600 hover:bg-red-700' 
                  : (transactionCard.type === 'prepaid' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-purple-600 hover:bg-purple-700')
                }`}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
