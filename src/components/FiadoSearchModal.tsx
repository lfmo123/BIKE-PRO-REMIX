import React, { useState, useMemo } from 'react';
import { Search, X, Calendar, Clock, DollarSign, CheckCircle, AlertTriangle, User, Tag, Bike, Zap, Motorbike, Printer, ArrowRight, Layers, FileText } from 'lucide-react';
import { ParkedVehicle, VehicleType } from '../types';

interface FiadoSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  vehicles: ParkedVehicle[];
  onPayFiado: (id: string, paymentMethod: string, amount: number, observation?: string) => Promise<void>;
}

export function FiadoSearchModal({ isOpen, onClose, vehicles, onPayFiado }: FiadoSearchModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'paid'>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'custom'>('all');
  const [customDate, setCustomDate] = useState<string>('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [printableVehicle, setPrintableVehicle] = useState<ParkedVehicle | null>(null);

  // Quick pay state
  const [payingId, setPayingId] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState<string>('');
  const [payMethod, setPayMethod] = useState<'cash' | 'machine' | 'card' | 'pix'>('cash');
  const [payObs, setPayObs] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter all vehicles that were checked out as 'fiado'
  const allFiadoVehicles = useMemo(() => {
    return vehicles
      .filter(v => v.status === 'completed' && v.paymentMethod === 'fiado')
      .sort((a, b) => (b.checkOutTime || 0) - (a.checkOutTime || 0));
  }, [vehicles]);

  // Apply search and status filters
  const filteredFiados = useMemo(() => {
    return allFiadoVehicles.filter(v => {
      // Text search in owner, identifier, card number
      const term = searchTerm.toLowerCase().trim();
      const matchesSearch = !term || 
        v.ownerName.toLowerCase().includes(term) ||
        v.identifier.toLowerCase().includes(term) ||
        v.cardNumber.toLowerCase().includes(term);

      // Status filter
      const isPaid = !!v.isFiadoPaid;
      const matchesStatus = 
        statusFilter === 'all' ||
        (statusFilter === 'pending' && !isPaid) ||
        (statusFilter === 'paid' && isPaid);

      // Date filter
      let matchesDate = true;
      if (dateFilter === 'custom' && customDate) {
        const [y, m, d] = customDate.split('-').map(Number);
        const start = new Date(y, m - 1, d, 0, 0, 0).getTime();
        const end = new Date(y, m - 1, d, 23, 59, 59, 999).getTime();
        const targetTime = v.checkOutTime || v.checkInTime;
        matchesDate = targetTime >= start && targetTime <= end;
      }

      return matchesSearch && matchesStatus && matchesDate;
    });
  }, [allFiadoVehicles, searchTerm, statusFilter, dateFilter, customDate]);

  // Financial statistics
  const stats = useMemo(() => {
    let totalOriginal = 0;
    let totalPaid = 0;
    let totalPending = 0;
    let countPending = 0;
    let countPaid = 0;

    filteredFiados.forEach(v => {
      const isPaid = !!v.isFiadoPaid;
      const price = v.price || 0;
      const paid = isPaid ? price : (v.fiadoPaidAmount || 0);
      const remaining = isPaid ? 0 : Math.max(0, price - paid);

      totalOriginal += price;
      totalPaid += Math.min(price, paid);
      totalPending += remaining;

      if (isPaid) {
        countPaid++;
      } else {
        countPending++;
      }
    });

    return { totalOriginal, totalPaid, totalPending, countPending, countPaid };
  }, [filteredFiados]);

  if (!isOpen) return null;

  const handlePay = async (v: ParkedVehicle) => {
    setIsSubmitting(true);
    try {
      const isPaid = !!v.isFiadoPaid;
      const remaining = isPaid ? 0 : Math.max(0, (v.price || 0) - (v.fiadoPaidAmount || 0));
      let amt = parseFloat(payAmount);
      if (isNaN(amt) || amt <= 0) {
        amt = remaining;
      }
      amt = Math.min(amt, remaining);

      await onPayFiado(v.id, payMethod, amt, payObs);
      setPayingId(null);
      setPayAmount('');
      setPayObs('');
    } catch (err) {
      console.error(err);
      alert('Erro ao processar baixa.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getVehicleIcon = (type: VehicleType) => {
    switch (type) {
      case 'bicycle': return <Bike className="w-5 h-5 text-blue-600" />;
      case 'ebike': return <Zap className="w-5 h-5 text-emerald-600" />;
      case 'motorcycle': return <Motorbike className="w-5 h-5 text-purple-600" />;
      default: return <Bike className="w-5 h-5 text-slate-600" />;
    }
  };

  const getVehicleTypeLabel = (type: VehicleType) => {
    switch (type) {
      case 'bicycle': return 'Bicicleta Tradicional';
      case 'ebike': return 'Bicicleta Elétrica';
      case 'motorcycle': return 'Motocicleta';
      default: return 'Veículo';
    }
  };

  const formatMethodLabel = (method?: string) => {
    switch (method) {
      case 'cash': return 'Dinheiro';
      case 'machine': return 'Cartão D/C (Máquina)';
      case 'card': return 'Pré-Pago';
      case 'pix': return 'Pix';
      default: return method || 'Não especificado';
    }
  };

  const formatDuration = (checkIn: number, checkOut?: number) => {
    if (!checkOut) return '-';
    const diffMs = checkOut - checkIn;
    const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${diffHrs}h ${diffMins}m`;
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden my-auto">
        
        {/* Header */}
        <div className="p-4 sm:p-6 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/20 border border-orange-500/40 flex items-center justify-center text-orange-400">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Origem e Histórico do Fiado</h2>
              <p className="text-xs text-slate-300">Pesquise, investigue e dê baixa nas contas fiado do estacionamento</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 space-y-3 shrink-0">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            {/* Search Input */}
            <div className="sm:col-span-6 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por Nome, Placa/Veículo ou Vaga/Cartão..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
                >
                  Limpar
                </button>
              )}
            </div>

            {/* Status Filter */}
            <div className="sm:col-span-3">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="w-full py-2 px-3 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50 text-slate-700 font-medium"
              >
                <option value="all">Todos os Status ({allFiadoVehicles.length})</option>
                <option value="pending">Apenas Pendentes</option>
                <option value="paid">Apenas Quitados</option>
              </select>
            </div>

            {/* Date Filter */}
            <div className="sm:col-span-3 flex items-center gap-2">
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value as any)}
                className="flex-1 py-2 px-3 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50 text-slate-700 font-medium"
              >
                <option value="all">Todas as Datas</option>
                <option value="custom">Filtrar p/ Data</option>
              </select>
              {dateFilter === 'custom' && (
                <input
                  type="date"
                  value={customDate}
                  onChange={(e) => setCustomDate(e.target.value)}
                  className="py-2 px-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-700 font-medium"
                />
              )}
            </div>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
            <div className="bg-white p-2.5 rounded-xl border border-slate-200">
              <span className="text-[11px] font-semibold text-slate-500 uppercase block">Total Registrado</span>
              <span className="text-base font-bold text-slate-800">R$ {stats.totalOriginal.toFixed(2)}</span>
            </div>
            <div className="bg-emerald-50 p-2.5 rounded-xl border border-emerald-200">
              <span className="text-[11px] font-semibold text-emerald-700 uppercase block">Total Recebido (Pago)</span>
              <span className="text-base font-bold text-emerald-700">R$ {stats.totalPaid.toFixed(2)}</span>
            </div>
            <div className="bg-orange-50 p-2.5 rounded-xl border border-orange-200">
              <span className="text-[11px] font-semibold text-orange-800 uppercase block">Total Em Haver (Pendente)</span>
              <span className="text-base font-bold text-orange-800">R$ {stats.totalPending.toFixed(2)}</span>
            </div>
            <div className="bg-slate-100 p-2.5 rounded-xl border border-slate-200 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-semibold text-slate-500 uppercase block">Ocorrências</span>
                <span className="text-xs text-slate-700 font-bold">{filteredFiados.length} no total</span>
              </div>
              <div className="text-right text-[11px]">
                <span className="text-orange-600 font-bold block">{stats.countPending} pendentes</span>
                <span className="text-emerald-600 font-bold block">{stats.countPaid} quitados</span>
              </div>
            </div>
          </div>
        </div>

        {/* Main List */}
        <div className="p-4 overflow-y-auto flex-1 space-y-3 bg-slate-100/60">
          {filteredFiados.length === 0 ? (
            <div className="py-12 text-center bg-white rounded-2xl border border-slate-200">
              <AlertTriangle className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-base font-bold text-slate-700">Nenhum fiado encontrado</p>
              <p className="text-xs text-slate-500 mt-1">Tente ajustar o termo de pesquisa ou os filtros de status/data.</p>
            </div>
          ) : (
            filteredFiados.map(v => {
              const isPaid = !!v.isFiadoPaid;
              const price = v.price || 0;
              const paid = isPaid ? price : (v.fiadoPaidAmount || 0);
              const remaining = isPaid ? 0 : Math.max(0, price - paid);
              const isExpanded = expandedId === v.id;
              const isPayingThis = payingId === v.id;

              return (
                <div
                  key={v.id}
                  className={`bg-white rounded-2xl border transition-all overflow-hidden ${
                    isPaid ? 'border-emerald-200 hover:border-emerald-300' : 'border-orange-200 hover:border-orange-300 shadow-sm'
                  }`}
                >
                  {/* Item Summary Bar */}
                  <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start space-x-3">
                      <div className={`p-2.5 rounded-xl shrink-0 ${isPaid ? 'bg-emerald-100' : 'bg-orange-100'}`}>
                        {getVehicleIcon(v.type)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-900 text-base">{v.ownerName || 'Cliente sem nome'}</span>
                          <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                            Vaga/Cartão {v.cardNumber}
                          </span>
                          <span className={`px-2 py-0.5 rounded-md text-xs font-bold ${
                            isPaid ? 'bg-emerald-100 text-emerald-800' : 'bg-orange-100 text-orange-800'
                          }`}>
                            {isPaid ? 'QUITADO' : paid > 0 ? 'PAGO PARCIAL' : 'PENDENTE'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1 flex items-center gap-2 flex-wrap">
                          <span>Veículo: <strong className="text-slate-700">{v.identifier || 'Não informada'}</strong></span>
                          <span>•</span>
                          <span>Saída/Fiado: <strong className="text-slate-700">{new Date(v.checkOutTime || v.checkInTime).toLocaleString('pt-BR')}</strong></span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                      <div className="text-left sm:text-right">
                        <div className="text-xs text-slate-500">Valor Total: <span className="font-semibold text-slate-800">R$ {price.toFixed(2)}</span></div>
                        {!isPaid && (
                          <div className="text-sm font-bold text-orange-600">Restante: R$ {remaining.toFixed(2)}</div>
                        )}
                        {isPaid && (
                          <div className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                            <CheckCircle className="w-3.5 h-3.5" /> Totalmente Quitado
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {!isPaid && (
                          <button
                            onClick={() => {
                              setPayingId(isPayingThis ? null : v.id);
                              setPayAmount(remaining.toFixed(2));
                              setPayMethod('cash');
                              setPayObs('');
                            }}
                            className="px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors shadow-sm flex items-center gap-1"
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                            Dar Baixa
                          </button>
                        )}

                        <button
                          onClick={() => setExpandedId(isExpanded ? null : v.id)}
                          className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                        >
                          {isExpanded ? 'Ocultar Origem' : 'Ver Origem Detalhada'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Inline Pay Box */}
                  {isPayingThis && (
                    <div className="p-4 bg-emerald-50 border-t border-emerald-200 space-y-3">
                      <p className="text-xs font-bold text-emerald-900 flex items-center gap-1">
                        <CheckCircle className="w-4 h-4 text-emerald-600" />
                        Registrar Pagamento do Fiado para {v.ownerName} (Cartão {v.cardNumber})
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1">Valor Abatido (R$)</label>
                          <input
                            type="number"
                            step="0.01"
                            max={remaining}
                            value={payAmount}
                            onChange={(e) => setPayAmount(e.target.value)}
                            className="w-full text-sm p-2 rounded-lg border border-slate-300 bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1">Forma de Pagamento</label>
                          <select
                            value={payMethod}
                            onChange={(e) => setPayMethod(e.target.value as any)}
                            className="w-full text-sm p-2 rounded-lg border border-slate-300 bg-white"
                          >
                            <option value="cash">Dinheiro</option>
                            <option value="machine">Cartão D/C (Máquina)</option>
                            <option value="pix">Pix</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1">Observação (Opcional)</label>
                          <input
                            type="text"
                            placeholder="Ex: Recebido pelo Caixa 1"
                            value={payObs}
                            onChange={(e) => setPayObs(e.target.value)}
                            className="w-full text-sm p-2 rounded-lg border border-slate-300 bg-white"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          onClick={() => setPayingId(null)}
                          disabled={isSubmitting}
                          className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-white hover:bg-slate-100 rounded-lg border border-slate-300"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={() => handlePay(v)}
                          disabled={isSubmitting}
                          className="px-4 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm"
                        >
                          {isSubmitting ? 'Gravando...' : 'Confirmar Pagamento'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Expanded Origin & Timeline Details */}
                  {isExpanded && (
                    <div className="p-4 bg-slate-50 border-t border-slate-200 space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                        <span className="text-xs font-bold uppercase text-slate-500 tracking-wider flex items-center gap-1">
                          <FileText className="w-4 h-4 text-slate-600" />
                          Ficha de Origem e Linha do Tempo
                        </span>
                        <button
                          onClick={() => setPrintableVehicle(v)}
                          className="flex items-center gap-1 px-3 py-1 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-200 border border-slate-300 rounded-lg shadow-xs"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          Imprimir Comprovante
                        </button>
                      </div>

                      {/* Origin Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1">
                          <span className="text-[11px] font-bold text-slate-400 uppercase block">1. Entrada no Estacionamento</span>
                          <div className="text-sm font-semibold text-slate-800 flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-blue-500" />
                            {new Date(v.checkInTime).toLocaleString('pt-BR')}
                          </div>
                          <div className="text-xs text-slate-600">
                            Vaga: <strong>{v.cardNumber}</strong> ({getVehicleTypeLabel(v.type)})
                          </div>
                        </div>

                        <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1">
                          <span className="text-[11px] font-bold text-slate-400 uppercase block">2. Saída & Registro do Fiado</span>
                          <div className="text-sm font-semibold text-slate-800 flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-orange-500" />
                            {v.checkOutTime ? new Date(v.checkOutTime).toLocaleString('pt-BR') : 'Não gravado'}
                          </div>
                          <div className="text-xs text-slate-600">
                            Permanência: <strong>{formatDuration(v.checkInTime, v.checkOutTime)}</strong>
                          </div>
                          <div className="text-xs text-slate-600">
                            Valor Original: <strong className="text-slate-900">R$ {price.toFixed(2)}</strong>
                          </div>
                        </div>

                        <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1">
                          <span className="text-[11px] font-bold text-slate-400 uppercase block">3. Situação do Pagamento</span>
                          <div className={`text-sm font-bold ${isPaid ? 'text-emerald-600' : 'text-orange-600'}`}>
                            {isPaid ? 'Totalmente Quitado' : `Pendente: R$ ${remaining.toFixed(2)}`}
                          </div>
                          {v.fiadoPaymentDate && (
                            <div className="text-xs text-slate-600">
                              Última Baixa: <strong>{new Date(v.fiadoPaymentDate).toLocaleString('pt-BR')}</strong>
                            </div>
                          )}
                          {v.fiadoPaymentMethod && (
                            <div className="text-xs text-slate-600">
                              Forma da Baixa: <strong>{formatMethodLabel(v.fiadoPaymentMethod)}</strong>
                            </div>
                          )}
                          {paid > 0 && (
                            <div className="text-xs text-slate-600">
                              Já Pago: <strong className="text-emerald-700">R$ {paid.toFixed(2)}</strong>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Vehicle & Customer Details */}
                      <div className="bg-white p-3 rounded-xl border border-slate-200">
                        <span className="text-[11px] font-bold text-slate-400 uppercase block mb-1">Dados Cadastrais do Veículo</span>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-slate-700">
                          <div>Proprietário: <strong className="text-slate-900">{v.ownerName || 'Não informado'}</strong></div>
                          <div>Identificação/Placa: <strong className="text-slate-900">{v.identifier || 'Não informada'}</strong></div>
                          <div>Número da Vaga: <strong className="text-slate-900">{v.cardNumber}</strong></div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-500 font-medium">
            Exibindo {filteredFiados.length} registro(s) de fiado
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-medium transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>

      {/* Printable Receipt Modal Overlay */}
      {printableVehicle && (
        <div className="fixed inset-0 bg-slate-900/80 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl text-slate-900 space-y-4">
            <div className="text-center border-b border-slate-200 pb-3">
              <h3 className="text-lg font-black uppercase tracking-wider">Comprovante de Origem do Fiado</h3>
              <p className="text-xs text-slate-500">Estacionamento • Ficha de Origem</p>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Cartão / Vaga:</span>
                <span className="font-bold text-slate-900">{printableVehicle.cardNumber}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Cliente:</span>
                <span className="font-bold text-slate-900">{printableVehicle.ownerName || 'Não informado'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Veículo/Placa:</span>
                <span className="font-bold text-slate-900">{printableVehicle.identifier || 'Não informada'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Tipo de Veículo:</span>
                <span className="font-bold text-slate-900">{getVehicleTypeLabel(printableVehicle.type)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Data de Entrada:</span>
                <span className="font-bold text-slate-900">{new Date(printableVehicle.checkInTime).toLocaleString('pt-BR')}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Data de Saída:</span>
                <span className="font-bold text-slate-900">
                  {printableVehicle.checkOutTime ? new Date(printableVehicle.checkOutTime).toLocaleString('pt-BR') : '-'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Valor Cobrado:</span>
                <span className="font-bold text-slate-900">R$ {(printableVehicle.price || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Valor Já Pago:</span>
                <span className="font-bold text-emerald-600">
                  R$ {(printableVehicle.isFiadoPaid ? (printableVehicle.price || 0) : (printableVehicle.fiadoPaidAmount || 0)).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Saldo Pendente:</span>
                <span className="font-bold text-orange-600">
                  R$ {(printableVehicle.isFiadoPaid ? 0 : Math.max(0, (printableVehicle.price || 0) - (printableVehicle.fiadoPaidAmount || 0))).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Situação:</span>
                <span className={`font-bold ${printableVehicle.isFiadoPaid ? 'text-emerald-600' : 'text-orange-600'}`}>
                  {printableVehicle.isFiadoPaid ? 'QUITADO' : 'EM ABERTO'}
                </span>
              </div>
              {printableVehicle.fiadoPaymentDate && (
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Data da Baixa:</span>
                  <span className="font-bold text-slate-900">
                    {new Date(printableVehicle.fiadoPaymentDate).toLocaleString('pt-BR')}
                  </span>
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setPrintableVehicle(null)}
                className="flex-1 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl"
              >
                Fechar
              </button>
              <button
                onClick={() => {
                  window.print();
                }}
                className="flex-1 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl flex items-center justify-center gap-1"
              >
                <Printer className="w-4 h-4" /> Imprimir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
