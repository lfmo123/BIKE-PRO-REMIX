import React, { useState, useMemo } from 'react';
import {
  CalendarRange,
  Plus,
  Search,
  Bike,
  Zap,
  Motorbike,
  Lock,
  Repeat,
  RefreshCw,
  LogIn,
  Trash2,
  X,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Phone,
  MessageCircle,
  Ban,
  RotateCcw,
} from 'lucide-react';
import { ParkedVehicle, RentalMode, SpotRental, VehicleType } from '../types';
import { DeviceFeaturesConfig } from '../lib/deviceModules';
import { getLocalDateString } from '../lib/dateUtils';
import { addDaysToDateStr, formatDateBr, getRentalValidity, normalizeSpot } from '../lib/rentalUtils';
import { buildSpotRentalWhatsappText, openWhatsappMessage } from '../lib/whatsappUtils';

export interface SpotRentalsProps {
  rentals: SpotRental[];
  vehicles: ParkedVehicle[];
  deviceConfig?: DeviceFeaturesConfig;
  activeOperator?: string;
  onAddRental: (rental: Omit<SpotRental, 'id' | 'createdAt' | 'status'>) => Promise<{ ok: boolean; error?: string }>;
  onUpdateRental: (id: string, updates: Partial<SpotRental>) => Promise<{ ok: boolean; error?: string }>;
  onRenewRental: (
    id: string,
    payload: {
      startDate: string;
      endDate: string;
      price: number;
      paymentMethod: 'cash' | 'machine' | 'pix' | 'fiado';
      operatorName?: string;
    }
  ) => Promise<{ ok: boolean; error?: string }>;
  onDeleteRental: (id: string) => Promise<{ ok: boolean; error?: string }>;
  onQuickCheckIn: (rental: SpotRental) => void;
}

export function SpotRentals({
  rentals,
  vehicles,
  deviceConfig,
  activeOperator,
  onAddRental,
  onUpdateRental,
  onRenewRental,
  onDeleteRental,
  onQuickCheckIn,
}: SpotRentalsProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'expiring' | 'expired' | 'cancelled'>('all');
  const [modeFilter, setModeFilter] = useState<'all' | RentalMode>('all');

  // Create modal state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('');
  const [vehicleType, setVehicleType] = useState<VehicleType>('bicycle');
  const [vehicleIdentifier, setVehicleIdentifier] = useState('');
  const [mode, setMode] = useState<RentalMode>('fixed');
  const [spotNumber, setSpotNumber] = useState('');
  const [startDate, setStartDate] = useState(getLocalDateString());
  const [endDate, setEndDate] = useState(addDaysToDateStr(getLocalDateString(), 30));
  const [price, setPrice] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'machine' | 'pix' | 'fiado'>('cash');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Renew modal state
  const [renewTarget, setRenewTarget] = useState<SpotRental | null>(null);
  const [renewStartDate, setRenewStartDate] = useState(getLocalDateString());
  const [renewEndDate, setRenewEndDate] = useState(addDaysToDateStr(getLocalDateString(), 30));
  const [renewPrice, setRenewPrice] = useState('');
  const [renewPaymentMethod, setRenewPaymentMethod] = useState<'cash' | 'machine' | 'pix' | 'fiado'>('cash');
  const [renewError, setRenewError] = useState('');

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<SpotRental | null>(null);

  const activeVehicles = useMemo(
    () => vehicles.filter(v => v.status === 'active' || v.status === 'stored'),
    [vehicles]
  );

  const stats = useMemo(() => {
    let valid = 0;
    let expiring = 0;
    let expired = 0;
    let fixedCount = 0;
    let floatingCount = 0;

    rentals.forEach(r => {
      if (r.status === 'cancelled') return;
      const val = getRentalValidity(r);
      if (val.isValidToday) {
        valid += 1;
        if (val.state === 'expiring_soon') expiring += 1;
      } else if (val.state === 'expired') {
        expired += 1;
      }
      if (r.mode === 'fixed') fixedCount += 1;
      else floatingCount += 1;
    });

    return { valid, expiring, expired, fixedCount, floatingCount };
  }, [rentals]);

  const filteredRentals = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    return rentals.filter(r => {
      const val = getRentalValidity(r);
      if (statusFilter === 'active' && !val.isValidToday) return false;
      if (statusFilter === 'expiring' && val.state !== 'expiring_soon') return false;
      if (statusFilter === 'expired' && val.state !== 'expired') return false;
      if (statusFilter === 'cancelled' && r.status !== 'cancelled') return false;

      if (modeFilter !== 'all' && r.mode !== modeFilter) return false;

      if (!term) return true;
      return (
        r.ownerName.toLowerCase().includes(term) ||
        (r.phone || '').toLowerCase().includes(term) ||
        (r.spotNumber || '').toLowerCase().includes(term) ||
        (r.vehicleIdentifier || '').toLowerCase().includes(term)
      );
    });
  }, [rentals, searchTerm, statusFilter, modeFilter]);

  const spotConflictWarning = useMemo(() => {
    if (mode !== 'fixed' || !spotNumber.trim()) return null;
    const norm = normalizeSpot(spotNumber);
    const rentalConflict = rentals.find(
      r => r.status === 'active' && r.mode === 'fixed' && normalizeSpot(r.spotNumber) === norm
    );
    if (rentalConflict) {
      return `A vaga #${norm} já possui aluguel ativo para ${rentalConflict.ownerName}.`;
    }
    const parkedHere = activeVehicles.find(v => normalizeSpot(v.cardNumber) === norm);
    if (parkedHere) {
      return `Atenção: há um veículo estacionado agora na vaga #${norm} (${parkedHere.ownerName}).`;
    }
    return null;
  }, [mode, spotNumber, rentals, activeVehicles]);

  const resetCreateForm = () => {
    const today = getLocalDateString();
    setOwnerName('');
    setPhone('');
    setVehicleType('bicycle');
    setVehicleIdentifier('');
    setMode('fixed');
    setSpotNumber('');
    setStartDate(today);
    setEndDate(addDaysToDateStr(today, 30));
    setPrice('');
    setPaymentMethod('cash');
    setNotes('');
    setFormError('');
  };

  const applyCreatePreset = (days: number) => {
    const base = startDate || getLocalDateString();
    setEndDate(addDaysToDateStr(base, days));
  };

  const applyRenewPreset = (days: number) => {
    const base = renewStartDate || getLocalDateString();
    setRenewEndDate(addDaysToDateStr(base, days));
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!ownerName.trim()) {
      setFormError('Informe o nome do cliente.');
      return;
    }
    if (mode === 'fixed' && !spotNumber.trim()) {
      setFormError('Informe o número ou código da vaga fixa.');
      return;
    }
    if (!startDate || !endDate || endDate < startDate) {
      setFormError('A data final deve ser igual ou posterior à data inicial.');
      return;
    }

    setIsSubmitting(true);
    const res = await onAddRental({
      ownerName: ownerName.trim(),
      phone: phone.trim(),
      vehicleType,
      vehicleIdentifier: vehicleIdentifier.trim(),
      mode,
      spotNumber: mode === 'fixed' ? normalizeSpot(spotNumber) : undefined,
      startDate,
      endDate,
      price: parseFloat(price) || 0,
      paymentMethod,
      notes: notes.trim() || undefined,
      operatorName: deviceConfig?.enableOperatorLogin ? activeOperator : undefined,
    });
    setIsSubmitting(false);

    if (!res.ok) {
      setFormError(res.error || 'Erro ao cadastrar aluguel.');
      return;
    }

    setIsCreateOpen(false);
    resetCreateForm();
  };

  const openRenewModal = (rental: SpotRental) => {
    const today = getLocalDateString();
    const baseStart = rental.endDate >= today ? addDaysToDateStr(rental.endDate, 1) : today;
    setRenewTarget(rental);
    setRenewStartDate(baseStart);
    setRenewEndDate(addDaysToDateStr(baseStart, 30));
    setRenewPrice((Number(rental.price) || 0).toFixed(2));
    setRenewPaymentMethod(rental.paymentMethod === 'fiado' ? 'cash' : rental.paymentMethod);
    setRenewError('');
  };

  const handleRenewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renewTarget) return;
    if (!renewStartDate || !renewEndDate || renewEndDate < renewStartDate) {
      setRenewError('A data final deve ser igual ou posterior à data inicial.');
      return;
    }

    setIsSubmitting(true);
    const res = await onRenewRental(renewTarget.id, {
      startDate: renewStartDate,
      endDate: renewEndDate,
      price: parseFloat(renewPrice) || 0,
      paymentMethod: renewPaymentMethod,
      operatorName: deviceConfig?.enableOperatorLogin ? activeOperator : undefined,
    });
    setIsSubmitting(false);

    if (!res.ok) {
      setRenewError(res.error || 'Erro ao renovar aluguel.');
      return;
    }
    setRenewTarget(null);
  };

  const getVehicleIcon = (t: VehicleType) => {
    if (t === 'ebike') return <Zap className="w-4 h-4 text-emerald-600" />;
    if (t === 'motorcycle') return <Motorbike className="w-4 h-4 text-purple-600" />;
    return <Bike className="w-4 h-4 text-blue-600" />;
  };

  const getVehicleLabel = (t: VehicleType) => {
    if (t === 'ebike') return 'E-Bike';
    if (t === 'motorcycle') return 'Moto';
    return 'Bicicleta';
  };

  const canManage = deviceConfig?.canManageCards !== false;

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
            <CalendarRange className="w-7 h-7 text-teal-600" />
            Vagas Alugadas & Direito de Estacionar
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Contratos mensais ou por período com vaga fixa reservada ou direito rotativo de estacionar
          </p>
        </div>

        {canManage && (
          <button
            type="button"
            onClick={() => {
              resetCreateForm();
              setIsCreateOpen(true);
            }}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold text-sm shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            Novo Aluguel / Período
          </button>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
          <span className="text-xs font-bold uppercase text-slate-500 block">Vigentes Hoje</span>
          <span className="text-2xl font-black text-emerald-600 mt-1 block tabular-nums">{stats.valid}</span>
          <span className="text-[11px] text-slate-400">Cobertura ativa para entrada/saída</span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
          <span className="text-xs font-bold uppercase text-slate-500 block">A Vencer (≤ 5 dias)</span>
          <span className="text-2xl font-black text-amber-600 mt-1 block tabular-nums">{stats.expiring}</span>
          <span className="text-[11px] text-slate-400">Prontos para renovação</span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
          <span className="text-xs font-bold uppercase text-slate-500 block">Vencidos</span>
          <span className="text-2xl font-black text-red-600 mt-1 block tabular-nums">{stats.expired}</span>
          <span className="text-[11px] text-slate-400">Aguardando renovação ou baixa</span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
          <span className="text-xs font-bold uppercase text-slate-500 block">Modalidade Ativa</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-lg font-black text-teal-700 dark:text-teal-400 tabular-nums">{stats.fixedCount} Fixas</span>
            <span className="text-slate-300">•</span>
            <span className="text-lg font-black text-indigo-700 dark:text-indigo-400 tabular-nums">{stats.floatingCount} Rotativas</span>
          </div>
          <span className="text-[11px] text-slate-400">Contratos não cancelados</span>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por cliente, telefone, vaga ou veículo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>

        <select
          value={modeFilter}
          onChange={(e) => setModeFilter(e.target.value as any)}
          className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-200"
        >
          <option value="all">Todas as Modalidades</option>
          <option value="fixed">Vaga Fixa Reservada</option>
          <option value="floating">Direito Rotativo</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-200"
        >
          <option value="all">Todos os Status</option>
          <option value="active">Vigentes Hoje</option>
          <option value="expiring">A Vencer (≤ 5d)</option>
          <option value="expired">Vencidos</option>
          <option value="cancelled">Cancelados</option>
        </select>
      </div>

      {/* Rentals Grid */}
      {filteredRentals.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-12 text-center">
          <CalendarRange className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Nenhum aluguel encontrado</h3>
          <p className="text-sm text-slate-500 mt-1">
            Cadastre um contrato de vaga fixa ou direito rotativo para começar a controlar entradas por período.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredRentals.map(rental => {
            const validity = getRentalValidity(rental);
            const parkedOnSpot =
              rental.mode === 'fixed' && rental.spotNumber
                ? activeVehicles.find(v => normalizeSpot(v.cardNumber) === normalizeSpot(rental.spotNumber))
                : activeVehicles.find(v => v.rentalId === rental.id);

            const badgeClass =
              validity.state === 'active'
                ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                : validity.state === 'expiring_soon'
                ? 'bg-amber-100 text-amber-800 border-amber-200'
                : validity.state === 'expired'
                ? 'bg-red-100 text-red-800 border-red-200'
                : validity.state === 'upcoming'
                ? 'bg-blue-100 text-blue-800 border-blue-200'
                : 'bg-slate-100 text-slate-500 border-slate-200';

            return (
              <div
                key={rental.id}
                className={`bg-white dark:bg-slate-900 rounded-2xl border p-5 shadow-sm flex flex-col justify-between gap-4 transition-all ${
                  rental.status === 'cancelled'
                    ? 'opacity-65 border-slate-200 dark:border-slate-800'
                    : validity.state === 'expired'
                    ? 'border-red-200 dark:border-red-900/60'
                    : 'border-slate-100 dark:border-slate-800 hover:border-teal-300'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5 mb-1">
                        {rental.mode === 'fixed' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-teal-100 text-teal-800 border border-teal-200">
                            <Lock className="w-3 h-3" />
                            Vaga Fixa #{rental.spotNumber}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                            <Repeat className="w-3 h-3" />
                            Direito Rotativo
                          </span>
                        )}
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${badgeClass}`}>
                          {validity.label}
                        </span>
                      </div>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 truncate">
                        {rental.ownerName}
                      </h3>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-lg font-black text-teal-700 dark:text-teal-400 tabular-nums block">
                        R$ {(Number(rental.price) || 0).toFixed(2)}
                      </span>
                      <span className="text-[11px] uppercase font-bold text-slate-400">
                        {rental.paymentMethod === 'cash'
                          ? 'Dinheiro'
                          : rental.paymentMethod === 'machine'
                          ? 'Máquina'
                          : rental.paymentMethod === 'pix'
                          ? 'PIX'
                          : 'Fiado'}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                      {getVehicleIcon(rental.vehicleType)}
                      <span className="font-semibold">
                        {getVehicleLabel(rental.vehicleType)}
                        {rental.vehicleIdentifier ? ` • ${rental.vehicleIdentifier}` : ''}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 justify-end">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span className="font-semibold">
                        {formatDateBr(rental.startDate)} → {formatDateBr(rental.endDate)}
                      </span>
                    </div>
                    {rental.phone && (
                      <div className="flex items-center gap-1.5 text-slate-500 col-span-2">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        <span>{rental.phone}</span>
                      </div>
                    )}
                    {rental.notes && (
                      <div className="col-span-2 text-slate-500 italic border-t border-slate-200/60 dark:border-slate-700 pt-1.5 mt-0.5">
                        {rental.notes}
                      </div>
                    )}
                  </div>

                  {parkedOnSpot && (
                    <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-2 rounded-xl border border-emerald-200 dark:border-emerald-800">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>
                        Veículo no pátio agora (Cartão/Vaga #{parkedOnSpot.cardNumber})
                      </span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                  {rental.status === 'active' && deviceConfig?.canCheckIn !== false && (
                    <button
                      type="button"
                      disabled={Boolean(parkedOnSpot)}
                      onClick={() => onQuickCheckIn(rental)}
                      className={`flex-1 min-w-[120px] py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
                        parkedOnSpot
                          ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                          : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      }`}
                      title={parkedOnSpot ? 'Já está no pátio' : 'Abrir entrada preenchida para este cliente'}
                    >
                      <LogIn className="w-3.5 h-3.5" />
                      {parkedOnSpot ? 'No Pátio' : 'Entrada Rápida'}
                    </button>
                  )}

                  {canManage && rental.status === 'active' && (
                    <button
                      type="button"
                      onClick={() => openRenewModal(rental)}
                      className="py-2 px-3 rounded-xl text-xs font-bold bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 flex items-center gap-1.5 transition-colors"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Renovar
                    </button>
                  )}

                  {deviceConfig?.enableWhatsappReceipts && (
                    <button
                      type="button"
                      onClick={() => openWhatsappMessage(buildSpotRentalWhatsappText(rental), rental.phone)}
                      className="py-2 px-3 rounded-xl text-xs font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 flex items-center gap-1 transition-colors"
                      title="Enviar comprovante no WhatsApp"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      Zap
                    </button>
                  )}

                  {canManage && (
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateRental(rental.id, {
                          status: rental.status === 'active' ? 'cancelled' : 'active',
                        })
                      }
                      className="py-2 px-2.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center gap-1 transition-colors"
                      title={rental.status === 'active' ? 'Cancelar contrato' : 'Reativar contrato'}
                    >
                      {rental.status === 'active' ? <Ban className="w-3.5 h-3.5" /> : <RotateCcw className="w-3.5 h-3.5" />}
                    </button>
                  )}

                  {canManage && (
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(rental)}
                      className="py-2 px-2.5 rounded-xl text-xs font-semibold bg-red-50 hover:bg-red-100 text-red-600 flex items-center gap-1 transition-colors"
                      title="Excluir registro"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Rental Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl w-full max-w-lg max-h-[92vh] overflow-y-auto border border-slate-200 dark:border-slate-800">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Novo Aluguel de Vaga / Período</h2>
              <button onClick={() => setIsCreateOpen(false)} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-5 space-y-4">
              {/* Modalidade */}
              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-2">Modalidade de Direito</label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setMode('fixed')}
                    className={`p-3 rounded-xl border-2 text-left transition-all ${
                      mode === 'fixed'
                        ? 'border-teal-500 bg-teal-50 dark:bg-teal-950/40 text-teal-900 dark:text-teal-200'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-sm">
                      <Lock className="w-4 h-4 text-teal-600" />
                      Vaga Fixa
                    </div>
                    <p className="text-[11px] opacity-80 mt-0.5">Reserva uma vaga específica para o cliente</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMode('floating')}
                    className={`p-3 rounded-xl border-2 text-left transition-all ${
                      mode === 'floating'
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-sm">
                      <Repeat className="w-4 h-4 text-indigo-600" />
                      Direito Rotativo
                    </div>
                    <p className="text-[11px] opacity-80 mt-0.5">Pode estacionar em qualquer vaga livre</p>
                  </button>
                </div>
              </div>

              {mode === 'fixed' && (
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">
                    Número / Código da Vaga Fixa *
                  </label>
                  <input
                    type="text"
                    required
                    value={spotNumber}
                    onChange={(e) => setSpotNumber(e.target.value)}
                    placeholder="Ex: 15, MT/BE 3 ou ALUG 1"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold uppercase"
                  />
                  {spotConflictWarning && (
                    <div className="mt-2 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2 font-medium">
                      <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                      <span>{spotConflictWarning}</span>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Nome do Cliente *</label>
                  <input
                    type="text"
                    required
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    placeholder="Ex: Carlos Eduardo"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Telefone / WhatsApp</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(11) 99999-9999"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Tipo de Veículo</label>
                  <select
                    value={vehicleType}
                    onChange={(e) => setVehicleType(e.target.value as VehicleType)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm"
                  >
                    <option value="bicycle">Bicicleta</option>
                    <option value="ebike">E-Bike</option>
                    <option value="motorcycle">Moto</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Placa / Modelo / Cor</label>
                  <input
                    type="text"
                    value={vehicleIdentifier}
                    onChange={(e) => setVehicleIdentifier(e.target.value)}
                    placeholder="Ex: Caloi Preta / ABC1D23"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm"
                  />
                </div>
              </div>

              {/* Período */}
              <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold uppercase text-slate-600 dark:text-slate-300">Período Contratado</span>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { label: '7d', days: 7 },
                      { label: '15d', days: 15 },
                      { label: '30d', days: 30 },
                      { label: '90d', days: 90 },
                    ].map(p => (
                      <button
                        key={p.days}
                        type="button"
                        onClick={() => applyCreatePreset(p.days)}
                        className="px-2.5 py-1 text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-teal-400 rounded-lg text-slate-700 dark:text-slate-200"
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Data Início</label>
                    <input
                      type="date"
                      required
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Data Término</label>
                    <input
                      type="date"
                      required
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Valor do Período (R$)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Forma de Pagamento</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm"
                  >
                    <option value="cash">Dinheiro</option>
                    <option value="machine">Máquina (Crédito/Débito)</option>
                    <option value="pix">PIX</option>
                    <option value="fiado">Fiado (Pendente)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Observações (opcional)</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ex: Acesso liberado 24h, vaga coberta..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm"
                />
              </div>

              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="flex-1 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm disabled:opacity-50"
                >
                  {isSubmitting ? 'Salvando...' : 'Salvar e Lançar no Caixa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Renew Modal */}
      {renewTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl w-full max-w-md border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Renovar Aluguel</h2>
                <p className="text-xs text-slate-500">
                  {renewTarget.ownerName} •{' '}
                  {renewTarget.mode === 'fixed' ? `Vaga Fixa #${renewTarget.spotNumber}` : 'Direito Rotativo'}
                </p>
              </div>
              <button onClick={() => setRenewTarget(null)} className="p-2 rounded-full hover:bg-slate-100">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <form onSubmit={handleRenewSubmit} className="p-5 space-y-4">
              <div className="flex flex-wrap gap-1.5">
                {[
                  { label: '+7 dias', days: 7 },
                  { label: '+15 dias', days: 15 },
                  { label: '+30 dias', days: 30 },
                  { label: '+90 dias', days: 90 },
                ].map(p => (
                  <button
                    key={p.days}
                    type="button"
                    onClick={() => applyRenewPreset(p.days)}
                    className="px-3 py-1.5 text-xs font-bold bg-teal-50 border border-teal-200 hover:bg-teal-100 text-teal-800 rounded-lg"
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Novo Início</label>
                  <input
                    type="date"
                    required
                    value={renewStartDate}
                    onChange={(e) => setRenewStartDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Novo Vencimento</label>
                  <input
                    type="date"
                    required
                    value={renewEndDate}
                    onChange={(e) => setRenewEndDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Valor (R$)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={renewPrice}
                    onChange={(e) => setRenewPrice(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Pagamento</label>
                  <select
                    value={renewPaymentMethod}
                    onChange={(e) => setRenewPaymentMethod(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                  >
                    <option value="cash">Dinheiro</option>
                    <option value="machine">Máquina</option>
                    <option value="pix">PIX</option>
                    <option value="fiado">Fiado</option>
                  </select>
                </div>
              </div>

              {renewError && (
                <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-semibold">
                  {renewError}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRenewTarget(null)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm disabled:opacity-50"
                >
                  {isSubmitting ? 'Renovando...' : 'Confirmar Renovação'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-sm p-6 border border-slate-200 dark:border-slate-800 space-y-4">
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Excluir Contrato</h3>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Deseja realmente excluir o aluguel de <strong>{deleteTarget.ownerName}</strong>? Os lançamentos financeiros já gravados no Livro Caixa serão mantidos.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  const id = deleteTarget.id;
                  setDeleteTarget(null);
                  await onDeleteRental(id);
                }}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
