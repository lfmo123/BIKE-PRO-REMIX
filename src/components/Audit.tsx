import React, { useState, useMemo } from 'react';
import { 
  Search, Calendar, Edit3, Trash2, SlidersHorizontal, 
  Bike, ShoppingBag, Wallet, AlertCircle, X, ShieldAlert,
  Check, RefreshCw, FileSpreadsheet, CreditCard
} from 'lucide-react';
import { ParkedVehicle, Sale, Transaction, Product } from '../types';
import { getLocalDateString } from '../lib/dateUtils';

interface AuditProps {
  vehicles: ParkedVehicle[];
  sales: Sale[];
  transactions: Transaction[];
  products: Product[];
  onRefreshAll: () => Promise<void>;
}

type EntryType = 'all' | 'parking' | 'sale' | 'transaction';

interface AuditEntry {
  id: string;
  type: 'parking' | 'sale' | 'transaction';
  date: number;
  description: string;
  amount: number;
  paymentMethod: string;
  originalData: any;
}

export function Audit({ vehicles, sales, transactions, products, onRefreshAll }: AuditProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<EntryType>('all');
  const [selectedPayment, setSelectedPayment] = useState<string>('all');
  
  // Date filter
  const [dateFilterType, setDateFilterType] = useState<'today' | 'yesterday' | 'month' | 'custom' | 'all'>('today');
  const [startDate, setStartDate] = useState<string>(getLocalDateString());
  const [endDate, setEndDate] = useState<string>(getLocalDateString());

  // Editing state
  const [editingEntry, setEditingEntry] = useState<AuditEntry | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form fields for editing
  const [editAmount, setEditAmount] = useState('');
  const [editPaymentMethod, setEditPaymentMethod] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editDateStr, setEditDateStr] = useState('');
  const [editTimeStr, setEditTimeStr] = useState('');
  // Specific to sales
  const [editQuantity, setEditQuantity] = useState('');
  // Specific to vehicles
  const [editCardNumber, setEditCardNumber] = useState('');
  const [editIdentifier, setEditIdentifier] = useState('');
  const [editOwnerName, setEditOwnerName] = useState('');

  // Deleting state
  const [deletingEntry, setDeletingEntry] = useState<AuditEntry | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Status message
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Combine entries
  const allEntries = useMemo(() => {
    const list: AuditEntry[] = [];

    // 1. Parking completed checkouts
    vehicles.forEach(v => {
      if (v.status === 'completed' && v.checkOutTime) {
        list.push({
          id: v.id,
          type: 'parking',
          date: v.checkOutTime,
          description: `Saída: Vaga #${v.cardNumber} - ${v.identifier || v.ownerName || 'S/ Placa'} (${
            v.type === 'bicycle' ? 'Bike' : v.type === 'ebike' ? 'E-Bike' : 'Moto'
          })`,
          amount: v.price || 0,
          paymentMethod: v.paymentMethod || 'cash',
          originalData: v
        });
      }
    });

    // 2. Sales
    sales.forEach(s => {
      list.push({
        id: s.id,
        type: 'sale',
        date: s.date,
        description: `Venda na Loja: ${s.quantity}x ${s.productName}`,
        amount: s.totalPrice,
        paymentMethod: s.paymentMethod || 'cash',
        originalData: s
      });
    });

    // 3. Transactions
    transactions.forEach(t => {
      // Avoid adding sales duplicated if the transaction is from sales
      if (t.type === 'income' && t.description && t.description.startsWith('Venda na Loja:')) {
        return;
      }
      list.push({
        id: t.id,
        type: 'transaction',
        date: t.date,
        description: `${t.type === 'expense' ? 'Saída/Despesa' : 'Entrada'}: ${t.description}${t.operator ? ` (Op: ${t.operator})` : ''}${t.category ? ` [Cat: ${t.category}]` : ''}`,
        amount: t.type === 'expense' ? -t.amount : t.amount,
        paymentMethod: t.description?.toLowerCase().includes('cartão') ? 'card' :
                       t.description?.toLowerCase().includes('máquina') ? 'machine' :
                       t.description?.toLowerCase().includes('pix') ? 'pix' : 'cash',
        originalData: t
      });
    });

    return list.sort((a, b) => b.date - a.date);
  }, [vehicles, sales, transactions]);

  // Date range thresholds
  const dateBounds = useMemo(() => {
    const now = new Date();
    
    if (dateFilterType === 'today') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();
      return { start, end };
    }
    
    if (dateFilterType === 'yesterday') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0, 0).getTime();
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59, 999).getTime();
      return { start, end };
    }
    
    if (dateFilterType === 'month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0).getTime();
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).getTime();
      return { start, end };
    }
    
    if (dateFilterType === 'custom') {
      const [sYear, sMonth, sDay] = startDate.split('-').map(Number);
      const [eYear, eMonth, eDay] = endDate.split('-').map(Number);
      const start = new Date(sYear, sMonth - 1, sDay, 0, 0, 0, 0).getTime();
      const end = new Date(eYear, eMonth - 1, eDay, 23, 59, 59, 999).getTime();
      return { start, end };
    }

    return { start: 0, end: Infinity };
  }, [dateFilterType, startDate, endDate]);

  // Filter entries
  const filteredEntries = useMemo(() => {
    return allEntries.filter(entry => {
      // Type Filter
      if (selectedType !== 'all' && entry.type !== selectedType) return false;

      // Payment Filter
      if (selectedPayment !== 'all' && entry.paymentMethod !== selectedPayment) return false;

      // Date Filter
      if (entry.date < dateBounds.start || entry.date > dateBounds.end) return false;

      // Search Filter
      if (searchTerm.trim() !== '') {
        const term = searchTerm.toLowerCase();
        const matchesDesc = entry.description.toLowerCase().includes(term);
        const matchesMethod = entry.paymentMethod.toLowerCase().includes(term);
        const matchesAmount = entry.amount.toString().includes(term);
        const matchesCard = entry.type === 'parking' && entry.originalData.cardNumber?.toLowerCase().includes(term);
        const matchesPlate = entry.type === 'parking' && entry.originalData.identifier?.toLowerCase().includes(term);
        
        return matchesDesc || matchesMethod || matchesAmount || matchesCard || matchesPlate;
      }

      return true;
    });
  }, [allEntries, selectedType, selectedPayment, dateBounds, searchTerm]);

  // Totals of filtered
  const totals = useMemo(() => {
    let total = 0;
    let cash = 0;
    let pix = 0;
    let card = 0;
    let machine = 0;
    let fiado = 0;

    filteredEntries.forEach(e => {
      // Avoid double counting checkouts that are paid via distinct transactions (fiado/cards)
      if (e.type === 'parking' && ['fiado', 'card', 'postpaid_card'].includes(e.paymentMethod)) {
        if (e.paymentMethod === 'fiado') {
          const v = e.originalData as any;
          if (!v.isFiadoPaid) {
            fiado += (v.price || 0) - (v.fiadoPaidAmount || 0);
          }
        }
      } else {
        total += e.amount;
        if (e.paymentMethod === 'cash') cash += e.amount;
        else if (e.paymentMethod === 'pix') pix += e.amount;
        else if (e.paymentMethod === 'card' || e.paymentMethod === 'postpaid_card') card += e.amount;
        else if (e.paymentMethod === 'machine') machine += e.amount;
      }
    });

    return { total, cash, pix, card, machine, fiado };
  }, [filteredEntries]);

  // Handle click edit
  const handleEditClick = (entry: AuditEntry) => {
    setEditingEntry(entry);
    setEditAmount(entry.amount.toString());
    setEditPaymentMethod(entry.paymentMethod);
    setEditDescription(entry.type === 'transaction' ? entry.originalData.description : '');
    
    // Set up DateTime pickers
    const d = new Date(entry.date);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    setEditDateStr(`${yyyy}-${mm}-${dd}`);
    
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    setEditTimeStr(`${hh}:${min}`);

    if (entry.type === 'sale') {
      setEditQuantity(entry.originalData.quantity.toString());
    } else if (entry.type === 'parking') {
      setEditCardNumber(entry.originalData.cardNumber || '');
      setEditIdentifier(entry.originalData.identifier || '');
      setEditOwnerName(entry.originalData.ownerName || '');
    }
  };

  // Submit edit
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEntry) return;

    setIsSubmitting(true);
    setStatusMessage(null);

    try {
      // Reconstitute date timestamp
      const [year, month, day] = editDateStr.split('-').map(Number);
      const [hour, minute] = editTimeStr.split(':').map(Number);
      const updatedDateTimestamp = new Date(year, month - 1, day, hour, minute).getTime();

      let url = '';
      let payload: any = {};

      if (editingEntry.type === 'parking') {
        url = `/api/vehicles/${editingEntry.id}`;
        payload = {
          price: Number(editAmount),
          paymentMethod: editPaymentMethod,
          checkOutTime: updatedDateTimestamp,
          cardNumber: editCardNumber,
          identifier: editIdentifier,
          ownerName: editOwnerName
        };
      } else if (editingEntry.type === 'sale') {
        url = `/api/sales/${editingEntry.id}`;
        payload = {
          totalPrice: Number(editAmount),
          paymentMethod: editPaymentMethod,
          quantity: Number(editQuantity),
          date: updatedDateTimestamp
        };
      } else if (editingEntry.type === 'transaction') {
        url = `/api/transactions/${editingEntry.id}`;
        payload = {
          description: editDescription,
          amount: Number(editAmount),
          date: updatedDateTimestamp
        };
      }

      const res = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setStatusMessage({ type: 'success', text: 'Registro atualizado com sucesso!' });
        await onRefreshAll();
        setEditingEntry(null);
      } else {
        const err = await res.json();
        setStatusMessage({ type: 'error', text: err.error || 'Erro ao salvar alterações.' });
      }
    } catch (err: any) {
      console.error(err);
      setStatusMessage({ type: 'error', text: 'Falha na conexão com o servidor.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit delete
  const handleDeleteConfirm = async () => {
    if (!deletingEntry) return;

    setIsDeleting(true);
    setStatusMessage(null);

    try {
      let url = '';
      if (deletingEntry.type === 'parking') {
        url = `/api/vehicles/${deletingEntry.id}`;
      } else if (deletingEntry.type === 'sale') {
        url = `/api/sales/${deletingEntry.id}`;
      } else if (deletingEntry.type === 'transaction') {
        url = `/api/transactions/${deletingEntry.id}`;
      }

      const res = await fetch(url, { method: 'DELETE' });

      if (res.ok) {
        setStatusMessage({ type: 'success', text: 'Registro removido com sucesso!' });
        await onRefreshAll();
        setDeletingEntry(null);
      } else {
        const err = await res.json();
        setStatusMessage({ type: 'error', text: err.error || 'Erro ao excluir registro.' });
      }
    } catch (err: any) {
      console.error(err);
      setStatusMessage({ type: 'error', text: 'Falha na conexão com o servidor.' });
    } finally {
      setIsDeleting(false);
    }
  };

  const getMethodBadgeClass = (method: string) => {
    switch (method) {
      case 'cash': return 'bg-emerald-100 text-emerald-800 border border-emerald-200';
      case 'pix': return 'bg-teal-100 text-teal-800 border border-teal-200';
      case 'card':
      case 'postpaid_card': return 'bg-blue-100 text-blue-800 border border-blue-200';
      case 'machine': return 'bg-indigo-100 text-indigo-800 border border-indigo-200';
      case 'fiado': return 'bg-amber-100 text-amber-800 border border-amber-200';
      default: return 'bg-slate-100 text-slate-800 border border-slate-200';
    }
  };

  const getMethodLabel = (method: string) => {
    switch (method) {
      case 'cash': return 'Dinheiro';
      case 'pix': return 'PIX';
      case 'card': return 'Mensalista Prepago';
      case 'postpaid_card': return 'Mensalista Pós';
      case 'machine': return 'Cartão de Débito/Crédito';
      case 'fiado': return 'Fiado';
      default: return method.toUpperCase();
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 id="audit-title" className="text-2xl font-bold text-slate-900 tracking-tight">Painel de Auditoria</h1>
          <p className="text-slate-500 text-sm">Audite, edite e exclua todas as entradas de estacionamento, vendas avulsas e caixa.</p>
        </div>
        <button
          onClick={async () => {
            const btn = document.getElementById('refresh-audit-btn');
            if (btn) btn.classList.add('animate-spin');
            await onRefreshAll();
            if (btn) btn.classList.remove('animate-spin');
          }}
          className="flex items-center space-x-2 text-sm bg-white hover:bg-slate-50 text-slate-600 px-4 py-2 border border-slate-200 rounded-xl shadow-sm transition-all"
        >
          <RefreshCw id="refresh-audit-btn" className="w-4 h-4" />
          <span>Sincronizar Dados</span>
        </button>
      </div>

      {/* Toast Alert */}
      {statusMessage && (
        <div className={`p-4 rounded-xl flex items-center justify-between border ${
          statusMessage.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'
        }`}>
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span className="text-sm font-medium">{statusMessage.text}</span>
          </div>
          <button onClick={() => setStatusMessage(null)} className="p-1 hover:bg-black/5 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Cards de Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-slate-950 p-5 rounded-2xl text-white shadow-sm flex flex-col justify-between">
          <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Total Auditado</span>
          <h2 className="text-2xl font-black mt-2">R$ {totals.total.toFixed(2)}</h2>
          <span className="text-[10px] text-emerald-400 font-medium mt-1">Soma dos filtros aplicados</span>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Dinheiro (Cash)</span>
          <h2 className="text-2xl font-black mt-2 text-slate-900">R$ {totals.cash.toFixed(2)}</h2>
          <span className="text-[10px] text-slate-500 font-medium mt-1">Entradas em cédulas</span>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">PIX</span>
          <h2 className="text-2xl font-black mt-2 text-slate-900">R$ {totals.pix.toFixed(2)}</h2>
          <span className="text-[10px] text-slate-500 font-medium mt-1">Chaves PIX</span>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Cartão / Máquina</span>
          <h2 className="text-2xl font-black mt-2 text-slate-900">R$ {(totals.card + totals.machine).toFixed(2)}</h2>
          <span className="text-[10px] text-slate-500 font-medium mt-1">Crédito/Débito/Preparo</span>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Fiado Pendente</span>
          <h2 className="text-2xl font-black mt-2 text-amber-600">R$ {totals.fiado.toFixed(2)}</h2>
          <span className="text-[10px] text-slate-500 font-medium mt-1">Contas pendentes</span>
        </div>
      </div>

      {/* Filters & Control Bar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
        <div className="flex items-center space-x-2 pb-2 border-b border-slate-50">
          <SlidersHorizontal className="w-4 h-4 text-slate-500" />
          <h3 className="text-sm font-bold text-slate-700">Filtros e Parâmetros de Auditoria</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Busca por texto */}
          <div className="relative">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Buscar por termo</label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Placa, Vaga #, Produto, Valor..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Tipo de Entrada */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Origem da Entrada</label>
            <select
              value={selectedType}
              onChange={e => setSelectedType(e.target.value as EntryType)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            >
              <option value="all">Todas as Origens</option>
              <option value="parking">Saídas de Estacionamento</option>
              <option value="sale">Vendas da Loja (Avulsas)</option>
              <option value="transaction">Lançamentos de Caixa Avulsos</option>
            </select>
          </div>

          {/* Forma de Pagamento */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Forma de Pagamento</label>
            <select
              value={selectedPayment}
              onChange={e => setSelectedPayment(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            >
              <option value="all">Todas as Formas</option>
              <option value="cash">Dinheiro</option>
              <option value="pix">PIX</option>
              <option value="machine">Cartão / Máquina</option>
              <option value="card">Mensalista Prepago</option>
              <option value="postpaid_card">Mensalista Pós</option>
              <option value="fiado">Fiado</option>
            </select>
          </div>

          {/* Período Temporal */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Período Fiscal</label>
            <select
              value={dateFilterType}
              onChange={e => setDateFilterType(e.target.value as any)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            >
              <option value="today">Hoje</option>
              <option value="yesterday">Ontem</option>
              <option value="month">Este Mês</option>
              <option value="custom">Período Customizado</option>
              <option value="all">Todo o Histórico</option>
            </select>
          </div>
        </div>

        {/* Custom Dates inputs */}
        {dateFilterType === 'custom' && (
          <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-50">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Data de Início</label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Data de Término</label>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none"
              />
            </div>
          </div>
        )}
      </div>

      {/* Main Entries List */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <span className="text-sm font-bold text-slate-900">{filteredEntries.length} Entradas Encontradas</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold text-xs uppercase tracking-wider">
                <th className="px-6 py-4">Data / Hora</th>
                <th className="px-6 py-4">Origem</th>
                <th className="px-6 py-4">Descrição</th>
                <th className="px-6 py-4">Forma</th>
                <th className="px-6 py-4 text-right">Valor</th>
                <th className="px-6 py-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                    Nenhuma entrada de pagamento coincide com os filtros aplicados.
                  </td>
                </tr>
              ) : (
                filteredEntries.map((entry) => (
                  <tr key={`${entry.type}-${entry.id}`} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 text-slate-500 whitespace-nowrap">
                      {new Date(entry.date).toLocaleString('pt-BR')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        {entry.type === 'parking' && (
                          <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100">
                            <Bike className="w-4 h-4" />
                          </span>
                        )}
                        {entry.type === 'sale' && (
                          <span className="p-1.5 rounded-lg bg-pink-50 text-pink-600 border border-pink-100">
                            <ShoppingBag className="w-4 h-4" />
                          </span>
                        )}
                        {entry.type === 'transaction' && (
                          <span className="p-1.5 rounded-lg bg-teal-50 text-teal-600 border border-teal-100">
                            <Wallet className="w-4 h-4" />
                          </span>
                        )}
                        <span className="font-semibold text-xs text-slate-700">
                          {entry.type === 'parking' ? 'Pátio' : entry.type === 'sale' ? 'Venda' : 'Caixa'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-800">
                      {entry.description}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${getMethodBadgeClass(entry.paymentMethod)}`}>
                        {getMethodLabel(entry.paymentMethod)}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-black text-slate-900 text-right whitespace-nowrap">
                      R$ {entry.amount.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center space-x-2">
                        <button
                          onClick={() => handleEditClick(entry)}
                          className="p-1.5 bg-slate-100 text-slate-600 hover:bg-emerald-50 hover:text-emerald-600 rounded-lg transition-colors"
                          title="Editar Registro"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeletingEntry(entry)}
                          className="p-1.5 bg-slate-100 text-slate-600 hover:bg-rose-50 hover:text-rose-600 rounded-lg transition-colors"
                          title="Excluir Registro"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      {editingEntry && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 bg-slate-950 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <ShieldAlert className="w-5 h-5 text-emerald-400" />
                <h3 className="text-lg font-bold">Editar Lançamento (Auditoria)</h3>
              </div>
              <button 
                onClick={() => setEditingEntry(null)} 
                className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-6 space-y-4">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/60 text-xs text-slate-500 flex flex-col space-y-1">
                <span className="font-bold text-slate-700">Auditando registro:</span>
                <span>{editingEntry.description}</span>
                <span>ID Original: {editingEntry.id}</span>
              </div>

              {/* Data & Hora */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Data do Lançamento</label>
                  <input
                    type="date"
                    required
                    value={editDateStr}
                    onChange={e => setEditDateStr(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Hora do Lançamento</label>
                  <input
                    type="time"
                    required
                    value={editTimeStr}
                    onChange={e => setEditTimeStr(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none"
                  />
                </div>
              </div>

              {/* PARKING SPECIFIC FIELDS */}
              {editingEntry.type === 'parking' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Nº Vaga / Cartão</label>
                      <input
                        type="text"
                        required
                        value={editCardNumber}
                        onChange={e => setEditCardNumber(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Placa / Identificador</label>
                      <input
                        type="text"
                        value={editIdentifier}
                        onChange={e => setEditIdentifier(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Nome do Cliente</label>
                    <input
                      type="text"
                      value={editOwnerName}
                      onChange={e => setEditOwnerName(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none"
                    />
                  </div>
                </>
              )}

              {/* SALE SPECIFIC FIELDS */}
              {editingEntry.type === 'sale' && (
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Quantidade Vendida</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={editQuantity}
                    onChange={e => setEditQuantity(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none"
                  />
                </div>
              )}

              {/* TRANSACTION SPECIFIC FIELDS */}
              {editingEntry.type === 'transaction' && (
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Descrição do Caixa</label>
                  <input
                    type="text"
                    required
                    value={editDescription}
                    onChange={e => setEditDescription(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none"
                  />
                </div>
              )}

              {/* Valor / Total */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Valor Cobrado (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={editAmount}
                  onChange={e => setEditAmount(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none"
                />
              </div>

              {/* Forma de Pagamento (Excluding transaction, which relies on description word matching but can also specify a fallback) */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Forma de Pagamento</label>
                <select
                  value={editPaymentMethod}
                  onChange={e => setEditPaymentMethod(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                >
                  <option value="cash">Dinheiro</option>
                  <option value="pix">PIX</option>
                  <option value="machine">Cartão / Máquina</option>
                  <option value="card">Mensalista Prepago</option>
                  <option value="postpaid_card">Mensalista Pós</option>
                  <option value="fiado">Fiado</option>
                </select>
              </div>

              <div className="flex space-x-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingEntry(null)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 rounded-xl text-sm font-bold transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 bg-slate-950 hover:bg-slate-900 text-white py-2.5 rounded-xl text-sm font-bold shadow-md transition-all flex items-center justify-center space-x-2"
                >
                  {isSubmitting ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Salvar Edição</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingEntry && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 bg-rose-600 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <ShieldAlert className="w-5 h-5" />
                <h3 className="text-lg font-bold">Excluir Lançamento (Perigo)</h3>
              </div>
              <button 
                onClick={() => setDeletingEntry(null)} 
                className="text-white/80 hover:text-white p-1 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-slate-600 text-sm leading-relaxed">
                Você tem certeza absoluta de que deseja excluir este lançamento de auditoria? Esta ação é irreversível.
              </p>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-xs text-slate-500 space-y-2">
                <div>
                  <span className="font-bold text-slate-700 block">Tipo:</span>
                  <span>{deletingEntry.type === 'parking' ? 'Estacionamento / Saída' : deletingEntry.type === 'sale' ? 'Venda Loja (Avulso)' : 'Lançamento Caixa'}</span>
                </div>
                <div>
                  <span className="font-bold text-slate-700 block">Descrição:</span>
                  <span>{deletingEntry.description}</span>
                </div>
                <div>
                  <span className="font-bold text-slate-700 block">Valor e Pagamento:</span>
                  <span>R$ {deletingEntry.amount.toFixed(2)} ({getMethodLabel(deletingEntry.paymentMethod)})</span>
                </div>
              </div>

              {deletingEntry.type === 'sale' && (
                <div className="p-3 bg-amber-50 text-amber-800 rounded-xl border border-amber-200 text-xs flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    <strong>Impacto no estoque:</strong> Ao excluir esta venda, o estoque do produto será automaticamente restituído com {deletingEntry.originalData.quantity} unidade(s). O registro de caixa correspondente também será apagado.
                  </span>
                </div>
              )}

              {deletingEntry.type === 'parking' && (
                <div className="p-3 bg-amber-50 text-amber-800 rounded-xl border border-amber-200 text-xs flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    <strong>Dica de Operação:</strong> Se o objetivo era apenas corrigir uma saída errada, considere que isso excluirá o veículo totalmente do banco de dados. Para recolocá-lo no pátio ativo, você pode reverter o checkout na aba Histórico.
                  </span>
                </div>
              )}

              <div className="flex space-x-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setDeletingEntry(null)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 rounded-xl text-sm font-bold transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDeleteConfirm}
                  disabled={isDeleting}
                  className="flex-1 bg-rose-600 hover:bg-rose-700 text-white py-2.5 rounded-xl text-sm font-bold shadow-md transition-all flex items-center justify-center space-x-2"
                >
                  {isDeleting ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      <span>Excluir Definitivamente</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
