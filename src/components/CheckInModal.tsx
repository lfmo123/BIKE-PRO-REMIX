import React, { useState, useMemo } from 'react';
import { X, Bike, Zap, Motorbike, Layers, Camera, Trash2, QrCode, CalendarRange, Lock, AlertTriangle } from 'lucide-react';
import { VehicleType, ParkedVehicle, SpotRental } from '../types';
import { DeviceFeaturesConfig } from '../lib/deviceModules';
import { generateQrSvg } from '../lib/pixUtils';
import { generateThermalPrintHtml, printHtml } from '../utils/printHelper';
import { findFixedRentalForSpot, formatDateBr, getRentalValidity } from '../lib/rentalUtils';

interface CheckInModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCheckIn: (vehicle: Omit<ParkedVehicle, 'id' | 'status'>) => Promise<void | { success: boolean; error?: string; vehicle?: ParkedVehicle }>;
  onCheckInBulk?: (vehicles: Omit<ParkedVehicle, 'id' | 'status'>[]) => Promise<void | { success: boolean; count?: number; error?: string }>;
  initialCardNumber?: string;
  initialOwnerName?: string;
  initialVehicleType?: VehicleType;
  initialRentalId?: string;
  initialIdentifier?: string;
  vehicles?: ParkedVehicle[];
  lostCards?: { cardNumber: string }[];
  spotRentals?: SpotRental[];
  deviceConfig?: DeviceFeaturesConfig;
  activeOperator?: string;
}

async function compressImageFile(file: File, maxWidth = 400, quality = 0.6): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = img.width > maxWidth ? maxWidth / img.width : 1;
        const width = Math.round(img.width * scale);
        const height = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(String(reader.result || ''));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = String(reader.result || '');
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function CheckInModal({
  isOpen,
  onClose,
  onCheckIn,
  onCheckInBulk,
  initialCardNumber,
  initialOwnerName,
  initialVehicleType,
  initialRentalId,
  initialIdentifier,
  vehicles = [],
  lostCards = [],
  spotRentals = [],
  deviceConfig,
  activeOperator,
}: CheckInModalProps) {
  const [type, setType] = useState<VehicleType>('bicycle');
  const [cardNumber, setCardNumber] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [selectedRentalId, setSelectedRentalId] = useState('');
  const [customDate, setCustomDate] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const [isBulkMode, setIsBulkMode] = useState(false);
  const [bulkStart, setBulkStart] = useState('');
  const [bulkEnd, setBulkEnd] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Optional modern check-in fields (active only when deviceConfig enables them)
  const [damageNotes, setDamageNotes] = useState('');
  const [photoData, setPhotoData] = useState<string>('');
  const [printTicketOnSave, setPrintTicketOnSave] = useState(false);

  const isSpecialGrid = initialCardNumber?.includes('MT/BE');
  const isVipGrid = initialCardNumber?.startsWith('SN');
  const isVip = isVipGrid || (!isBulkMode && cardNumber.trim().toUpperCase().startsWith('SN'));

  const canCheckInBulk = deviceConfig?.canCheckInBulk !== false;
  const showPhotoChecklist = Boolean(deviceConfig?.enableCheckInPhoto);
  const showQrPrintOption = Boolean(deviceConfig?.enableQrTicketScanner && deviceConfig?.canPrintTicket !== false);
  const rentalsEnabled = Boolean(deviceConfig?.enableSpotRentals);

  const activeFloatingRentals = useMemo(() => {
    if (!rentalsEnabled) return [];
    return spotRentals.filter(r => r.status === 'active' && r.mode === 'floating' && getRentalValidity(r).isValidToday);
  }, [rentalsEnabled, spotRentals]);

  const fixedSpotRental = useMemo(() => {
    if (!rentalsEnabled || isBulkMode || !cardNumber.trim()) return undefined;
    return findFixedRentalForSpot(spotRentals, cardNumber);
  }, [rentalsEnabled, isBulkMode, cardNumber, spotRentals]);

  const activeRental = useMemo(() => {
    if (!rentalsEnabled) return undefined;
    if (fixedSpotRental) return fixedSpotRental;
    if (selectedRentalId) return spotRentals.find(r => r.id === selectedRentalId);
    return undefined;
  }, [rentalsEnabled, fixedSpotRental, selectedRentalId, spotRentals]);

  React.useEffect(() => {
    if (isOpen) {
      setIsBulkMode(false);
      setBulkStart(initialCardNumber && !initialCardNumber.startsWith('SN') && !initialCardNumber.includes('MT') ? initialCardNumber : '');
      setBulkEnd('');
      setIsProcessing(false);
      setDamageNotes('');
      setPhotoData('');
      setPrintTicketOnSave(false);

      if (initialCardNumber) {
        setCardNumber(initialCardNumber);
        if (initialVehicleType) {
          setType(initialVehicleType);
        } else if (initialCardNumber.includes('MT/BE')) {
          setType('motorcycle');
        } else {
          setType('bicycle');
        }
      } else {
        setType(initialVehicleType || 'bicycle');
        setCardNumber('');
      }
      setOwnerName(initialOwnerName || '');
      setIdentifier(initialIdentifier || '');
      setSelectedRentalId(initialRentalId || '');
      setErrorMsg('');

      const now = new Date();
      const offset = now.getTimezoneOffset() * 60000;
      setCustomDate(new Date(now.getTime() - offset).toISOString().slice(0, 16));
    }
  }, [isOpen, initialCardNumber, initialOwnerName, initialVehicleType, initialRentalId, initialIdentifier]);

  // Auto-populate when user types a cardNumber that belongs to an active fixed spot rental
  React.useEffect(() => {
    if (!isOpen || !fixedSpotRental) return;
    setSelectedRentalId(fixedSpotRental.id);
    if (!ownerName.trim()) {
      setOwnerName(fixedSpotRental.ownerName);
    }
    if (!identifier.trim() && fixedSpotRental.vehicleIdentifier) {
      setIdentifier(fixedSpotRental.vehicleIdentifier);
    }
    setType(fixedSpotRental.vehicleType);
  }, [fixedSpotRental?.id, isOpen]);

  if (!isOpen) return null;

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageFile(file, 400, 0.6);
      setPhotoData(compressed);
    } catch {
      setErrorMsg('Não foi possível processar a imagem selecionada.');
    }
  };

  const printQrEntryTicket = async (v: { cardNumber: string; type: VehicleType; ownerName: string; checkInTime: number; damageNotes?: string; id?: string }) => {
    try {
      const qrContent = `BIKEPARK:CARD:${v.cardNumber}${v.id ? `:ID:${v.id}` : ''}`;
      const qrSvg = await generateQrSvg(qrContent);
      const typeLabel = v.type === 'bicycle' ? 'Bicicleta' : v.type === 'ebike' ? 'E-Bike' : 'Moto';
      const content = `
        <h1>TICKET DE ENTRADA</h1>
        <div class="subtitle">BIKEPARK GESTÃO</div>
        <div class="section">
          <div class="row"><span class="label">CARTÃO/VAGA:</span><span class="value">#${v.cardNumber}</span></div>
          <div class="row"><span class="label">TIPO:</span><span class="value">${typeLabel}</span></div>
          <div class="row"><span class="label">CLIENTE:</span><span class="value">${v.ownerName || 'Não informado'}</span></div>
          <div class="row"><span class="label">ENTRADA:</span><span class="value">${new Date(v.checkInTime).toLocaleString('pt-BR')}</span></div>
          ${v.damageNotes ? `<div class="row"><span class="label">OBS:</span><span class="value">${v.damageNotes}</span></div>` : ''}
        </div>
        <div class="text-center" style="margin: 12px 0;">
          ${qrSvg}
          <div style="font-size: 9pt; font-weight: bold; margin-top: 4px;">${qrContent}</div>
        </div>
        <div class="footer">Guarde este ticket para agilizar sua saída.</div>
      `;
      printHtml(generateThermalPrintHtml(`Ticket #${v.cardNumber}`, content));
    } catch (err) {
      console.error('Erro ao imprimir ticket QR:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const operatorToSave = deviceConfig?.enableOperatorLogin && activeOperator ? activeOperator : undefined;

    if (isBulkMode && canCheckInBulk) {
      if (!bulkStart || !bulkEnd || !customDate) return;

      const start = parseInt(bulkStart, 10);
      const end = parseInt(bulkEnd, 10);

      if (isNaN(start) || isNaN(end) || start > end || start <= 0 || end <= 0) {
        setErrorMsg('Intervalo inválido. Verifique os números inicial e final.');
        return;
      }
      if (end - start > 150) {
        setErrorMsg('O intervalo máximo é de 150 vagas por vez.');
        return;
      }

      setIsProcessing(true);

      const newVehicles: Omit<ParkedVehicle, 'id' | 'status'>[] = [];
      const checkInTime = new Date(customDate).getTime();

      let prefix = '';
      if (isSpecialGrid) {
        prefix = 'MT/BE ';
      } else if (isVipGrid) {
        prefix = 'SN ';
      } else if (type === 'motorcycle' || type === 'ebike') {
        prefix = 'MT/BE ';
      }

      for (let i = start; i <= end; i++) {
        const numStr = `${prefix}${i}`;
        const isTaken =
          vehicles.some(v => v.cardNumber === numStr && (v.status === 'active' || v.status === 'stored')) ||
          lostCards.some(c => c.cardNumber === numStr);
        if (!isTaken) {
          newVehicles.push({
            type,
            identifier: 'Não informada',
            ownerName: 'Não informado',
            cardNumber: numStr,
            checkInTime,
            ...(operatorToSave ? { operatorName: operatorToSave } : {}),
          });
        }
      }

      if (newVehicles.length === 0) {
        setErrorMsg('Todas as vagas neste intervalo já estão ocupadas (ou com cartão perdido).');
        setIsProcessing(false);
        return;
      }

      if (onCheckInBulk) {
        const res = await onCheckInBulk(newVehicles);
        if (res && res.success === false) {
          setErrorMsg(res.error || 'Erro ao registrar entradas em massa.');
        }
      } else {
        setErrorMsg('Entrada em massa não suportada.');
      }

      setIsProcessing(false);
      return;
    }

    if (!cardNumber || !customDate) return;
    if (isVip && !ownerName.trim()) {
      setErrorMsg('Para vagas sem número, o nome do cliente é obrigatório!');
      return;
    }

    setIsProcessing(true);
    const checkInTimestamp = new Date(customDate).getTime();
    const cleanCard = cardNumber.trim().toUpperCase();
    const rentalToSave = fixedSpotRental?.id || (rentalsEnabled && selectedRentalId ? selectedRentalId : undefined);
    const payload: Omit<ParkedVehicle, 'id' | 'status'> = {
      type,
      identifier: identifier.trim() || 'Não informada',
      ownerName: ownerName.trim() || 'Não informado',
      cardNumber: cleanCard,
      checkInTime: checkInTimestamp,
      ...(rentalToSave ? { rentalId: rentalToSave } : {}),
      ...(showPhotoChecklist && damageNotes.trim() ? { damageNotes: damageNotes.trim() } : {}),
      ...(showPhotoChecklist && photoData ? { photoData } : {}),
      ...(operatorToSave ? { operatorName: operatorToSave } : {}),
      ...(showQrPrintOption ? { qrCode: `BIKEPARK:CARD:${cleanCard}` } : {}),
    };

    const res = await onCheckIn(payload);

    setIsProcessing(false);
    if (res && res.success === false) {
      setErrorMsg(res.error || 'Este cartão já está sendo usado!');
      return;
    }

    if (showQrPrintOption && printTicketOnSave) {
      await printQrEntryTicket({
        cardNumber: cleanCard,
        type,
        ownerName: payload.ownerName,
        checkInTime: checkInTimestamp,
        damageNotes: payload.damageNotes,
        id: res && 'vehicle' in res ? res.vehicle?.id : undefined,
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl w-full max-w-md max-h-[92vh] overflow-y-auto animate-in fade-in zoom-in duration-200 border border-slate-100 dark:border-slate-800">
        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Nova Entrada</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-500 dark:text-slate-400"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-lg font-medium text-slate-700 dark:text-slate-200">Tipo de Veículo</label>
              {canCheckInBulk && (
                <button
                  type="button"
                  onClick={() => setIsBulkMode(!isBulkMode)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    isBulkMode
                      ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  <Layers className="w-4 h-4" />
                  {isBulkMode ? 'Em Massa (Ativo)' : 'Em Massa'}
                </button>
              )}
            </div>

            <div className="grid grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setType('bicycle')}
                className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${
                  type === 'bicycle'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'
                    : 'border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 text-slate-500 dark:text-slate-400'
                }`}
              >
                <Bike className={`w-8 h-8 mb-2 ${type === 'bicycle' ? 'text-blue-600 dark:text-blue-400' : ''}`} />
                <span className="text-base font-medium">Bicicleta</span>
              </button>

              <button
                type="button"
                onClick={() => setType('motorcycle')}
                className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${
                  type === 'motorcycle'
                    ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300'
                    : 'border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 text-slate-500 dark:text-slate-400'
                }`}
              >
                <Motorbike className={`w-8 h-8 mb-2 ${type === 'motorcycle' ? 'text-purple-600 dark:text-purple-400' : ''}`} />
                <span className="text-base font-medium">Moto</span>
              </button>

              <button
                type="button"
                onClick={() => setType('ebike')}
                className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${
                  type === 'ebike'
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                    : 'border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 text-slate-500 dark:text-slate-400'
                }`}
              >
                <Zap className={`w-8 h-8 mb-2 ${type === 'ebike' ? 'text-emerald-600 dark:text-emerald-400' : ''}`} />
                <span className="text-base font-medium">E-Bike</span>
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {isBulkMode && canCheckInBulk ? (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="bulkStart" className="block text-lg font-medium text-slate-700 dark:text-slate-200 mb-2">
                    De (Número)
                  </label>
                  <input
                    id="bulkStart"
                    type="number"
                    min="1"
                    required
                    value={bulkStart}
                    onChange={(e) => setBulkStart(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all text-xl text-slate-900 dark:text-slate-100"
                    placeholder="Ex: 1"
                  />
                </div>
                <div>
                  <label htmlFor="bulkEnd" className="block text-lg font-medium text-slate-700 dark:text-slate-200 mb-2">
                    Até (Número)
                  </label>
                  <input
                    id="bulkEnd"
                    type="number"
                    min="1"
                    required
                    value={bulkEnd}
                    onChange={(e) => setBulkEnd(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all text-xl text-slate-900 dark:text-slate-100"
                    placeholder="Ex: 30"
                  />
                </div>
              </div>
            ) : (
              <div>
                <label htmlFor="cardNumber" className="block text-lg font-medium text-slate-700 dark:text-slate-200 mb-2">
                  {isVip ? 'Vaga' : 'Número do Cartão'}
                </label>
                <input
                  id="cardNumber"
                  type="text"
                  required
                  value={cardNumber}
                  onChange={(e) => setCardNumber(e.target.value)}
                  readOnly={isVipGrid}
                  className={`w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all text-xl text-slate-900 dark:text-slate-100 ${isVipGrid ? 'opacity-70 cursor-not-allowed' : ''}`}
                  placeholder="Ex: 12"
                />
              </div>
            )}

            {!isBulkMode && rentalsEnabled && fixedSpotRental && (() => {
              const validity = getRentalValidity(fixedSpotRental);
              const nameDiverges =
                Boolean(ownerName.trim()) &&
                ownerName.trim().toLowerCase() !== fixedSpotRental.ownerName.trim().toLowerCase();
              return (
                <div className="p-3.5 rounded-2xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-teal-800 dark:text-teal-300">
                      <Lock className="w-3.5 h-3.5" />
                      Vaga Reservada (Aluguel Fixo)
                    </span>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-teal-100 dark:bg-teal-900/60 text-teal-800 dark:text-teal-200">
                      {validity.label}
                    </span>
                  </div>
                  <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Titular: {fixedSpotRental.ownerName}
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    Período: {formatDateBr(fixedSpotRental.startDate)} até {formatDateBr(fixedSpotRental.endDate)}
                  </p>
                  {nameDiverges && (
                    <div className="mt-1.5 flex items-start gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-lg p-2">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>O nome informado diverge do locatário reservado ({fixedSpotRental.ownerName}).</span>
                    </div>
                  )}
                </div>
              );
            })()}

            {!isBulkMode && rentalsEnabled && !fixedSpotRental && activeFloatingRentals.length > 0 && (
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 space-y-2">
                <label htmlFor="floatingRental" className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-teal-700 dark:text-teal-300">
                  <CalendarRange className="w-4 h-4" />
                  Vincular Direito Rotativo Vigente (Opcional)
                </label>
                <select
                  id="floatingRental"
                  value={selectedRentalId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setSelectedRentalId(id);
                    const picked = activeFloatingRentals.find(r => r.id === id);
                    if (picked) {
                      setOwnerName(picked.ownerName);
                      setType(picked.vehicleType);
                      if (picked.vehicleIdentifier) setIdentifier(picked.vehicleIdentifier);
                    }
                  }}
                  className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="">Entrada avulsa normal (sem contrato)</option>
                  {activeFloatingRentals.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.ownerName} • até {formatDateBr(r.endDate)} ({r.vehicleType === 'bicycle' ? 'Bicicleta' : r.vehicleType === 'ebike' ? 'E-Bike' : 'Moto'})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {!isBulkMode && (isVip || Boolean(activeRental)) && (
              <div className="space-y-3">
                <div>
                  <label htmlFor="ownerName" className="block text-lg font-medium text-slate-700 dark:text-slate-200 mb-2">
                    {isVip ? 'Nome do Cliente (Obrigatório)' : 'Nome do Locatário / Cliente'}
                  </label>
                  <input
                    id="ownerName"
                    type="text"
                    required={isVip}
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all text-xl text-slate-900 dark:text-slate-100"
                    placeholder="Ex: João Silva"
                  />
                </div>
                {Boolean(activeRental) && (
                  <div>
                    <label htmlFor="vehicleIdentifier" className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">
                      Identificação / Placa / Modelo (Opcional)
                    </label>
                    <input
                      id="vehicleIdentifier"
                      type="text"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/50 text-base text-slate-900 dark:text-slate-100"
                      placeholder="Ex: Caloi Preta ou ABC-1234"
                    />
                  </div>
                )}
              </div>
            )}

            <div>
              <label htmlFor="checkInDate" className="block text-lg font-medium text-slate-700 dark:text-slate-200 mb-2">
                Data e Hora de Entrada
              </label>
              <input
                id="checkInDate"
                type="datetime-local"
                required
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all text-slate-700 dark:text-slate-100 text-xl"
              />
            </div>

            {!isBulkMode && showPhotoChecklist && (
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                    Vistoria de Entrada (Opcional)
                  </span>
                  <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors">
                    <Camera className="w-3.5 h-3.5" />
                    {photoData ? 'Trocar Foto' : 'Tirar / Anexar Foto'}
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handlePhotoChange}
                      className="hidden"
                    />
                  </label>
                </div>

                {photoData && (
                  <div className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
                    <img src={photoData} alt="Vistoria do veículo" className="w-full h-36 object-cover" />
                    <button
                      type="button"
                      onClick={() => setPhotoData('')}
                      className="absolute top-2 right-2 p-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700 shadow"
                      title="Remover foto"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}

                <input
                  type="text"
                  value={damageNotes}
                  onChange={(e) => setDamageNotes(e.target.value)}
                  placeholder="Observações / avarias prévias (ex: guidão riscado, com capacete)"
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            )}

            {!isBulkMode && showQrPrintOption && (
              <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={printTicketOnSave}
                  onChange={(e) => setPrintTicketOnSave(e.target.checked)}
                  className="w-4 h-4 accent-emerald-600 rounded"
                />
                <QrCode className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  Imprimir Ticket com QR Code ao confirmar
                </span>
              </label>
            )}
          </div>

          <div className="pt-2">
            {errorMsg && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-300 rounded-xl text-base font-medium border border-red-100 dark:border-red-900 flex items-center">
                <span className="mr-2">⚠️</span>
                {errorMsg}
              </div>
            )}
            <button
              type="submit"
              disabled={isProcessing}
              className={`w-full py-4 text-white rounded-xl font-bold text-2xl transition-colors shadow-lg ${
                isProcessing
                  ? 'bg-slate-400 cursor-not-allowed shadow-none'
                  : isBulkMode
                    ? 'bg-indigo-500 hover:bg-indigo-600 shadow-indigo-500/30'
                    : 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/30'
              }`}
            >
              {isProcessing ? 'Processando...' : isBulkMode ? 'Entrada em Massa' : 'Confirmar Entrada'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
