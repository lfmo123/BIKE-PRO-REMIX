import React, { useState } from 'react';
import { CustomerCard, ParkedVehicle, Transaction } from '../types';
import { Grid, Plus, Search, Edit, Trash2, MessageCircle, Download, CalendarClock } from 'lucide-react';
import { getLocalDateString } from '../lib/dateUtils';
import { DeviceFeaturesConfig } from '../lib/deviceModules';
import { buildCardWhatsappText, openWhatsappMessage } from '../lib/whatsappUtils';
import { exportToCsv } from '../lib/csvExport';

interface CustomerCardsProps {
  cards: CustomerCard[];
  vehicles?: ParkedVehicle[];
  transactions?: Transaction[];
  deviceConfig?: DeviceFeaturesConfig;
  onAddCard: (card: Omit<CustomerCard, 'id'>) => Promise<void>;
  onUpdateCard: (id: string, card: Partial<CustomerCard>) => Promise<void>;
  onDeleteCard: (id: string) => Promise<void>;
  onAddTransaction: (transaction: any) => Promise<void>;
}

export function CustomerCards({
  cards,
  vehicles = [],
  transactions = [],
  deviceConfig,
  onAddCard,
  onUpdateCard,
  onDeleteCard,
  onAddTransaction
}: CustomerCardsProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [cardNumber, setCardNumber] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('');
  const [type, setType] = useState<'prepaid' | 'postpaid'>('prepaid');
  const [balanceInput, setBalanceInput] = useState('');
  const [expirationDate, setExpirationDate] = useState('');
  const [monthlyFee, setMonthlyFee] = useState('');

  const [transactionCard, setTransactionCard] = useState<CustomerCard | null>(null);
  const [transactionAmount, setTransactionAmount] = useState('');
  const [transactionDiscount, setTransactionDiscount] = useState('');
  const [transactionType, setTransactionType] = useState<'add' | 'refund'>('add');
  const [transactionPaymentMethod, setTransactionPaymentMethod] = useState<'cash' | 'machine' | 'fiado'>('cash');
  const [deletingCardId, setDeletingCardId] = useState<string | null>(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [editCardNumber, setEditCardNumber] = useState('');
  const [editOwnerName, setEditOwnerName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editExpirationDate, setEditExpirationDate] = useState('');
  const [editMonthlyFee, setEditMonthlyFee] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editError, setEditError] = useState('');

  const canManageCards = deviceConfig?.canManageCards !== false;
  const expiryEnabled = Boolean(deviceConfig?.enableCardExpiryAlerts);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await onAddCard({
      cardNumber,
      ownerName,
      phone,
      type,
      balance: parseFloat(balanceInput) || 0,
      ...(expiryEnabled && expirationDate ? { expirationDate } : {}),
      ...(expiryEnabled && monthlyFee ? { monthlyFee: parseFloat(monthlyFee) || 0 } : {})
    });
    setIsAdding(false);
    setCardNumber('');
    setOwnerName('');
    setPhone('');
    setType('prepaid');
    setBalanceInput('');
    setExpirationDate('');
    setMonthlyFee('');
  };

  const filteredCards = (cards || []).filter(
    c =>
      (c.ownerName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.cardNumber || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getExpiryInfo = (expStr?: string) => {
    if (!expiryEnabled || !expStr) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const exp = new Date(`${expStr}T00:00:00`);
    const diffDays = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) {
      return { status: 'expired' as const, label: `Vencido há ${Math.abs(diffDays)}d` };
    }
    if (diffDays <= 7) {
      return { status: 'warning' as const, label: diffDays === 0 ? 'Vence hoje' : `Vence em ${diffDays}d` };
    }
    return { status: 'ok' as const, label: `Vence ${expStr.split('-').reverse().join('/')}` };
  };

  const handleExportCsv = () => {
    exportToCsv(
      `cartoes_mensalistas_${getLocalDateString()}`,
      ['Cartão', 'Cliente', 'Telefone', 'Modalidade', 'Saldo / Fatura (R$)', 'Vencimento', 'Mensalidade (R$)'],
      filteredCards.map(c => [
        c.cardNumber,
        c.ownerName,
        c.phone || '',
        c.type === 'prepaid' ? 'Pré-pago' : 'Pós-pago',
        (Number(c.balance) || 0).toFixed(2).replace('.', ','),
        c.expirationDate || '',
        c.monthlyFee ? Number(c.monthlyFee).toFixed(2).replace('.', ',') : ''
      ])
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
        <div className="flex items-center space-x-4">
          <div className="bg-blue-100 dark:bg-blue-950/60 p-3 rounded-xl">
            <Grid className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Cartões Cadastrados</h1>
            <p className="text-slate-500 dark:text-slate-400 font-medium">Controle de clientes Mensalistas/Credenciados</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="relative">
            <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar cliente ou cartão..."
              className="pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 w-full sm:w-64"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          {deviceConfig?.enableCsvExport && (
            <button
              onClick={handleExportCsv}
              className="flex items-center space-x-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 px-3.5 py-2 rounded-xl transition-colors font-semibold text-sm"
            >
              <Download className="w-4 h-4" />
              <span>CSV</span>
            </button>
          )}
          {canManageCards && (
            <button
              onClick={() => setIsAdding(true)}
              className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl transition-all shadow-md shadow-blue-500/20 font-bold"
            >
              <Plus className="w-5 h-5" />
              <span className="hidden sm:inline">Novo Cartão</span>
            </button>
          )}
        </div>
      </div>

      {canManageCards && isAdding && (
        <form onSubmit={handleSave} className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 space-y-4">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Cadastrar Novo Cartão</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="col-span-1">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nº do Cartão</label>
              <input
                required
                type="text"
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl"
                value={cardNumber}
                onChange={e => setCardNumber(e.target.value)}
              />
            </div>
            <div className="col-span-1 lg:col-span-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nome do Cliente</label>
              <input
                required
                type="text"
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl"
                value={ownerName}
                onChange={e => setOwnerName(e.target.value)}
              />
            </div>
            <div className="col-span-1">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Telefone</label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl"
                value={phone}
                onChange={e => setPhone(e.target.value)}
              />
            </div>
            <div className="col-span-1">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Modalidade</label>
              <select
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl"
                value={type}
                onChange={e => setType(e.target.value as any)}
              >
                <option value="prepaid">Pré-pago (Crédito)</option>
                <option value="postpaid">Pós-pago (Conta)</option>
              </select>
            </div>
            {expiryEnabled && (
              <>
                <div className="col-span-1">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Vencimento</label>
                  <input
                    type="date"
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl"
                    value={expirationDate}
                    onChange={e => setExpirationDate(e.target.value)}
                  />
                </div>
                <div className="col-span-1">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Mensalidade (R$)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Opcional"
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl"
                    value={monthlyFee}
                    onChange={e => setMonthlyFee(e.target.value)}
                  />
                </div>
              </>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Cancelar
            </button>
            <button type="submit" className="px-4 py-2 bg-blue-600 rounded-xl text-white font-bold hover:bg-blue-700">
              Salvar Cartão
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredCards.map(card => {
          const isFiado = card.lastPaymentMethod === 'fiado';
          const cardBg = isFiado
            ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-700 shadow-amber-100'
            : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 shadow-sm';
          const paymentMethodText =
            card.lastPaymentMethod === 'cash'
              ? 'Dinheiro'
              : card.lastPaymentMethod === 'machine'
                ? 'Máquina'
                : card.lastPaymentMethod === 'fiado'
                  ? 'Fiado'
                  : '';
          const expiryInfo = getExpiryInfo(card.expirationDate);

          return (
            <div key={card.id} className={`${cardBg} p-5 rounded-2xl border flex flex-col relative group transition-colors`}>
              {canManageCards && (
                <div className="absolute top-4 right-4 flex items-center gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => {
                      setEditingCardId(card.id);
                      setEditCardNumber(card.cardNumber);
                      setEditOwnerName(card.ownerName);
                      setEditPhone(card.phone || '');
                      setEditExpirationDate(card.expirationDate || '');
                      setEditMonthlyFee(card.monthlyFee ? String(card.monthlyFee) : '');
                      setEditPassword('');
                      setEditError('');
                    }}
                    className="text-slate-400 hover:text-blue-500"
                    title="Editar Cartão"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      setDeletingCardId(card.id);
                      setDeletePassword('');
                      setDeleteError('');
                    }}
                    className="text-slate-400 hover:text-red-500"
                    title="Excluir Cartão"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}

              <div className="flex items-center gap-3 mb-3 mt-1">
                <div
                  className={`p-2 rounded-lg ${
                    card.type === 'prepaid'
                      ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400'
                      : 'bg-purple-100 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400'
                  }`}
                >
                  <Grid className="w-5 h-5" />
                </div>
                <div className="flex-1 pr-6 min-w-0">
                  <h3 className="font-bold text-slate-900 dark:text-slate-100 leading-tight truncate">{card.ownerName}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Cartão #{card.cardNumber}</p>
                </div>
              </div>

              <p className="text-sm text-slate-600 dark:text-slate-400 mb-2 flex-1">{card.phone || 'Sem telefone'}</p>

              {(paymentMethodText || expiryInfo) && (
                <div className="mb-3 flex flex-wrap items-center gap-1.5">
                  {paymentMethodText && (
                    <span
                      className={`text-xs font-bold px-2 py-1 rounded-md ${
                        isFiado ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      Último pgto: {paymentMethodText}
                    </span>
                  )}
                  {expiryInfo && (
                    <span
                      className={`text-xs font-bold px-2 py-1 rounded-md inline-flex items-center gap-1 ${
                        expiryInfo.status === 'expired'
                          ? 'bg-red-100 text-red-700'
                          : expiryInfo.status === 'warning'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      <CalendarClock className="w-3 h-3" />
                      {expiryInfo.label}
                    </span>
                  )}
                </div>
              )}

              {(() => {
                const cardTx = transactions
                  .filter(t => t.description.includes(`Cartão ${card.cardNumber} (`))
                  .sort((a, b) => b.date - a.date)
                  .slice(0, 2);

                if (cardTx.length === 0) return null;

                return (
                  <div className="mb-3 flex flex-col gap-1.5">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Últimas Movimentações</span>
                    {cardTx.map(t => {
                      const isEstorno = t.description.includes('Estorno');
                      return (
                        <div
                          key={t.id}
                          className="flex justify-between items-center text-xs bg-slate-50 dark:bg-slate-800/60 p-2 rounded-lg border border-slate-100 dark:border-slate-800"
                        >
                          <span className="text-slate-600 dark:text-slate-300 truncate mr-2 flex-1" title={t.description}>
                            {new Date(t.date).toLocaleString('pt-BR', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}{' '}
                            - {isEstorno ? 'Estorno' : card.type === 'prepaid' ? 'Crédito' : 'Pgto'}
                          </span>
                          <span className={`font-bold tabular-nums ${isEstorno ? 'text-red-600' : 'text-emerald-600'}`}>
                            {isEstorno ? '-' : '+'}R$ {t.amount.toFixed(2)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              <div
                className={`p-3 rounded-xl border flex items-center justify-between mb-3 ${
                  card.type === 'prepaid'
                    ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-100 dark:border-emerald-900'
                    : 'bg-purple-50 dark:bg-purple-950/30 border-purple-100 dark:border-purple-900'
                }`}
              >
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {card.type === 'prepaid' ? 'Saldo (Pré-pago)' : 'Fatura (Pós-pago)'}
                  </span>
                  <span
                    className={`text-lg font-bold tabular-nums ${
                      card.type === 'prepaid' ? 'text-emerald-700 dark:text-emerald-400' : 'text-purple-700 dark:text-purple-400'
                    }`}
                  >
                    R$ {Number(card.balance || 0).toFixed(2)}
                  </span>
                </div>
                {deviceConfig?.enableWhatsappReceipts && (
                  <button
                    type="button"
                    onClick={() => openWhatsappMessage(buildCardWhatsappText(card), card.phone)}
                    className="p-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
                    title="Enviar extrato/cobrança via WhatsApp"
                  >
                    <MessageCircle className="w-4 h-4" />
                  </button>
                )}
              </div>

              {canManageCards && (
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setTransactionType('add');
                      setTransactionCard(card);
                    }}
                    className="flex-1 py-2 bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 text-white rounded-xl font-bold text-sm transition-colors"
                  >
                    {card.type === 'prepaid' ? 'Adicionar Crédito' : 'Pagar Fatura'}
                  </button>
                  <button
                    onClick={() => {
                      setTransactionType('refund');
                      setTransactionCard(card);
                    }}
                    className="flex-1 py-2 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900 rounded-xl font-bold text-sm transition-colors"
                  >
                    Estornar
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {transactionCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-200 p-6 border border-slate-100 dark:border-slate-800">
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">
              {transactionType === 'refund'
                ? transactionCard.type === 'prepaid'
                  ? 'Estornar Crédito (Devolução)'
                  : 'Estornar Pagamento (Adicionar Dívida)'
                : transactionCard.type === 'prepaid'
                  ? 'Adicionar Crédito'
                  : 'Pagar Fatura'}
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">
              Cliente: <span className="font-bold text-slate-700 dark:text-slate-200">{transactionCard.ownerName}</span> (Cartão #
              {transactionCard.cardNumber})
            </p>

            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Valor (R$)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={transactionAmount}
              onChange={e => setTransactionAmount(e.target.value)}
              className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl mb-4 text-lg focus:ring-2 focus:ring-blue-500"
              placeholder="0.00"
            />

            {transactionType === 'add' && transactionCard.type === 'postpaid' && (
              <>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Desconto (R$)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={transactionDiscount}
                  onChange={e => setTransactionDiscount(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl mb-4 text-lg focus:ring-2 focus:ring-emerald-500"
                  placeholder="0.00"
                />
              </>
            )}

            {transactionType === 'add' && transactionCard.type === 'postpaid' && (
              <div className="mb-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3">
                <div className="font-semibold text-slate-800 dark:text-slate-100 mb-2">Resumo da Fatura Atual</div>
                <div className="text-slate-600 dark:text-slate-300 mb-2 font-bold text-lg">
                  Total Devido: R$ {(transactionCard.balance || 0).toFixed(2)}
                </div>
                <div className="text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wider">Usos Recentes</div>
                <div className="max-h-52 overflow-y-auto space-y-2 border-t border-slate-200 dark:border-slate-700 pt-2 pr-1">
                  {vehicles
                    .filter(v => v.customerCardId === transactionCard.id && v.status === 'completed' && v.paymentMethod === 'postpaid_card')
                    .sort((a, b) => (b.checkOutTime || 0) - (a.checkOutTime || 0))
                    .slice(0, 50)
                    .map(v => (
                      <div
                        key={v.id}
                        className="flex flex-col text-sm bg-white dark:bg-slate-900 p-2.5 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm"
                      >
                        <div className="flex justify-between items-center mb-1.5">
                          <span className="font-bold text-slate-800 dark:text-slate-100">{v.identifier || 'Veículo'}</span>
                          <span className="font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                            R$ {(v.price || 0).toFixed(2)}
                          </span>
                        </div>
                        <div className="flex flex-col space-y-0.5 text-xs text-slate-500 dark:text-slate-400">
                          <div>
                            <span className="font-semibold">Entrada:</span> {getLocalDateString(v.checkInTime)}
                          </div>
                          <div>
                            <span className="font-semibold">Saída:</span> {getLocalDateString(v.checkOutTime || 0)}
                          </div>
                        </div>
                      </div>
                    ))}
                  {vehicles.filter(
                    v => v.customerCardId === transactionCard.id && v.status === 'completed' && v.paymentMethod === 'postpaid_card'
                  ).length === 0 && <div className="text-slate-500 text-xs text-center py-2">Nenhum uso registrado no cartão.</div>}
                </div>
              </div>
            )}

            {transactionType === 'add' && transactionCard.type === 'prepaid' && (
              <div className="mb-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 flex justify-between items-center">
                <div className="font-semibold text-slate-800 dark:text-slate-100">Restante de Crédito</div>
                <div className="font-bold text-emerald-600 text-xl">R$ {(transactionCard.balance || 0).toFixed(2)}</div>
              </div>
            )}

            {transactionType === 'add' && (
              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Forma de Pagamento</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setTransactionPaymentMethod('cash')}
                    className={`py-2 px-3 border rounded-xl font-bold text-sm transition-colors ${
                      transactionPaymentMethod === 'cash'
                        ? 'bg-blue-50 border-blue-200 text-blue-700'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    Dinheiro
                  </button>
                  <button
                    onClick={() => setTransactionPaymentMethod('machine')}
                    className={`py-2 px-3 border rounded-xl font-bold text-sm transition-colors ${
                      transactionPaymentMethod === 'machine'
                        ? 'bg-blue-50 border-blue-200 text-blue-700'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    Máquina
                  </button>
                  <button
                    onClick={() => setTransactionPaymentMethod('fiado')}
                    className={`py-2 px-3 border rounded-xl font-bold text-sm transition-colors ${
                      transactionPaymentMethod === 'fiado'
                        ? 'bg-blue-50 border-blue-200 text-blue-700'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    Fiado
                  </button>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setTransactionCard(null);
                  setTransactionAmount('');
                  setTransactionDiscount('');
                  setTransactionPaymentMethod('cash');
                }}
                className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 font-bold rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  const amt = parseFloat(transactionAmount);
                  if (isNaN(amt) || amt <= 0) return;
                  const discount = parseFloat(transactionDiscount) || 0;

                  let newBalance = Number(transactionCard.balance) || 0;
                  let updateData: Partial<CustomerCard> = { balance: newBalance };

                  if (transactionType === 'add') {
                    if (transactionCard.type === 'prepaid') newBalance += amt;
                    else newBalance = Math.max(0, newBalance - amt - discount);

                    updateData.balance = newBalance;
                    updateData.lastPaymentMethod = transactionPaymentMethod;
                  } else {
                    if (transactionCard.type === 'prepaid') newBalance = Math.max(0, newBalance - amt);
                    else newBalance += amt;

                    updateData.balance = newBalance;
                  }

                  await onUpdateCard(transactionCard.id, updateData);

                  const paymentStr =
                    transactionPaymentMethod === 'cash'
                      ? 'DINHEIRO'
                      : transactionPaymentMethod === 'machine'
                        ? 'MÁQUINA'
                        : 'FIADO';

                  await onAddTransaction({
                    description:
                      transactionType === 'add'
                        ? `${transactionCard.type === 'prepaid' ? 'Recarga Pré-pago' : 'Pgto. Conta Pós-pago'}: Cartão ${transactionCard.cardNumber} (${transactionCard.ownerName}) (${paymentStr})${
                            transactionCard.type === 'postpaid' && discount > 0 ? ` (Desc. R$${discount.toFixed(2)})` : ''
                          }`
                        : `Estorno ${transactionCard.type === 'prepaid' ? 'Pré-pago' : 'Pós-pago'}: Cartão ${transactionCard.cardNumber} (${transactionCard.ownerName})`,
                    amount: amt,
                    date: Date.now(),
                    type: transactionType === 'add' ? 'income' : 'expense'
                  });

                  setTransactionCard(null);
                  setTransactionAmount('');
                  setTransactionDiscount('');
                  setTransactionPaymentMethod('cash');
                }}
                className={`flex-1 py-3 text-white font-bold rounded-xl transition-colors ${
                  transactionType === 'refund'
                    ? 'bg-red-600 hover:bg-red-700'
                    : transactionCard.type === 'prepaid'
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : 'bg-purple-600 hover:bg-purple-700'
                }`}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {deletingCardId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200 p-6 border border-slate-100 dark:border-slate-800">
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">Excluir Cartão</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
              Para excluir este cartão, por favor, insira a senha de autorização.
            </p>

            {deleteError && (
              <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm font-semibold rounded-xl border border-red-200">
                {deleteError}
              </div>
            )}

            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Senha</label>
              <input
                type="password"
                value={deletePassword}
                onChange={e => setDeletePassword(e.target.value)}
                className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl mb-4 text-lg focus:ring-2 focus:ring-red-500"
                placeholder="Digite a senha"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setDeletingCardId(null);
                  setDeletePassword('');
                  setDeleteError('');
                }}
                className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 font-bold rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  if (deletePassword === 'Admin') {
                    await onDeleteCard(deletingCardId);
                    setDeletingCardId(null);
                    setDeletePassword('');
                    setDeleteError('');
                  } else {
                    setDeleteError('Senha incorreta!');
                  }
                }}
                className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-colors"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {editingCardId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200 p-6 border border-slate-100 dark:border-slate-800">
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-6">Editar Cartão</h2>

            {editError && (
              <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm font-semibold rounded-xl border border-red-200">
                {editError}
              </div>
            )}

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nome do Cliente</label>
                <input
                  type="text"
                  value={editOwnerName}
                  onChange={e => setEditOwnerName(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500"
                  placeholder="Nome completo"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nº do Cartão</label>
                <input
                  type="text"
                  value={editCardNumber}
                  onChange={e => setEditCardNumber(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500"
                  placeholder="Número ou identificador"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Telefone (opcional)</label>
                <input
                  type="tel"
                  value={editPhone}
                  onChange={e => setEditPhone(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500"
                  placeholder="(00) 00000-0000"
                />
              </div>
              {expiryEnabled && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Vencimento</label>
                    <input
                      type="date"
                      value={editExpirationDate}
                      onChange={e => setEditExpirationDate(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Mensalidade</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={editMonthlyFee}
                      onChange={e => setEditMonthlyFee(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl"
                    />
                  </div>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Senha de Autorização (Admin)
                </label>
                <input
                  type="password"
                  value={editPassword}
                  onChange={e => setEditPassword(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl focus:ring-2 focus:ring-red-500"
                  placeholder="Digite a senha para salvar"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setEditingCardId(null);
                  setEditPassword('');
                  setEditError('');
                }}
                className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 font-bold rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  if (editPassword === 'Admin') {
                    if (!editOwnerName.trim() || !editCardNumber.trim()) {
                      setEditError('Nome e número do cartão são obrigatórios!');
                      return;
                    }
                    await onUpdateCard(editingCardId, {
                      ownerName: editOwnerName,
                      cardNumber: editCardNumber,
                      phone: editPhone,
                      ...(expiryEnabled ? { expirationDate: editExpirationDate || undefined } : {}),
                      ...(expiryEnabled && editMonthlyFee ? { monthlyFee: parseFloat(editMonthlyFee) || 0 } : {})
                    });
                    setEditingCardId(null);
                    setEditPassword('');
                    setEditError('');
                  } else {
                    setEditError('Senha incorreta!');
                  }
                }}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors"
              >
                Salvar Alterações
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
