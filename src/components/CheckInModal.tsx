import React, { useState } from 'react';
import { X, Bike, Zap, Motorbike, Layers } from 'lucide-react';
import { VehicleType, ParkedVehicle } from '../types';

interface CheckInModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCheckIn: (vehicle: Omit<ParkedVehicle, 'id' | 'status'>) => Promise<void | { success: boolean, error?: string }>;
  onCheckInBulk?: (vehicles: Omit<ParkedVehicle, 'id' | 'status'>[]) => Promise<void | { success: boolean, count?: number, error?: string }>;
  initialCardNumber?: string;
  vehicles?: ParkedVehicle[];
  lostCards?: { cardNumber: string }[];
}

export function CheckInModal({ isOpen, onClose, onCheckIn, onCheckInBulk, initialCardNumber, vehicles = [], lostCards = [] }: CheckInModalProps) {
  const [type, setType] = useState<VehicleType>('bicycle');
  const [cardNumber, setCardNumber] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [customDate, setCustomDate] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [bulkStart, setBulkStart] = useState('');
  const [bulkEnd, setBulkEnd] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const isSpecialGrid = initialCardNumber?.includes('MT/BE');
  const isVipGrid = initialCardNumber?.startsWith('SN');
  const isVip = isVipGrid || (!isBulkMode && cardNumber.trim().toUpperCase().startsWith('SN'));

  React.useEffect(() => {
    if (isOpen) {
      setIsBulkMode(false);
      setBulkStart(initialCardNumber && !initialCardNumber.startsWith('SN') && !initialCardNumber.includes('MT') ? initialCardNumber : '');
      setBulkEnd('');
      setIsProcessing(false);
      if (initialCardNumber) {
        setCardNumber(initialCardNumber);
        if (initialCardNumber.includes('MT/BE')) {
          setType('motorcycle');
        } else {
          setType('bicycle');
        }
      } else {
        setType('bicycle');
        setCardNumber('');
      }
      setOwnerName('');
      setErrorMsg('');
      
      if (!customDate) {
        const now = new Date();
        const offset = now.getTimezoneOffset() * 60000;
        setCustomDate(new Date(now.getTime() - offset).toISOString().slice(0, 16));
      }
    }
  }, [isOpen, initialCardNumber]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    
    if (isBulkMode) {
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
      
      for (let i = start; i <= end; i++) {
        const numStr = i.toString();
        const isTaken = vehicles.some(v => v.cardNumber === numStr && (v.status === 'active' || v.status === 'stored')) || lostCards.some(c => c.cardNumber === numStr);
        if (!isTaken) {
          newVehicles.push({
            type,
            identifier: 'Não informada',
            ownerName: 'Não informado',
            cardNumber: numStr,
            checkInTime,
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
        } else {
          // onClose handled by App.tsx
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
    const res = await onCheckIn({
      type,
      identifier: 'Não informada',
      ownerName: ownerName.trim() || 'Não informado',
      cardNumber: cardNumber.trim().toUpperCase(),
      checkInTime: new Date(customDate).getTime(),
    });
    
    setIsProcessing(false);
    if (res && res.success === false) {
      setErrorMsg(res.error || 'Este cartão já está sendo usado!');
      return;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h2 className="text-3xl font-bold text-slate-900">Nova Entrada</h2>
          <button 
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-100 transition-colors text-slate-500"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-lg font-medium text-slate-700">Tipo de Veículo</label>
              <button
                type="button"
                onClick={() => setIsBulkMode(!isBulkMode)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  isBulkMode ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Layers className="w-4 h-4" />
                {isBulkMode ? 'Em Massa (Ativo)' : 'Em Massa'}
              </button>
            </div>
            
            <div className="grid grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setType('bicycle')}
                  className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${
                    type === 'bicycle' 
                      ? 'border-blue-500 bg-blue-50 text-blue-700' 
                      : 'border-slate-100 hover:border-slate-200 text-slate-500'
                  }`}
                >
                  <Bike className={`w-8 h-8 mb-2 ${type === 'bicycle' ? 'text-blue-600' : ''}`} />
                  <span className="text-base font-medium">Bicicleta</span>
                </button>
                
                <button
                  type="button"
                  onClick={() => setType('motorcycle')}
                  className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${
                    type === 'motorcycle' 
                      ? 'border-purple-500 bg-purple-50 text-purple-700' 
                      : 'border-slate-100 hover:border-slate-200 text-slate-500'
                  }`}
                >
                  <Motorbike className={`w-8 h-8 mb-2 ${type === 'motorcycle' ? 'text-purple-600' : ''}`} />
                  <span className="text-base font-medium">Moto</span>
                </button>

                <button
                  type="button"
                  onClick={() => setType('ebike')}
                  className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${
                    type === 'ebike' 
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700' 
                      : 'border-slate-100 hover:border-slate-200 text-slate-500'
                  }`}
                >
                  <Zap className={`w-8 h-8 mb-2 ${type === 'ebike' ? 'text-emerald-600' : ''}`} />
                  <span className="text-base font-medium">E-Bike</span>
                </button>
            </div>
          </div>
          
          <div className="space-y-4">
            {isBulkMode ? (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="bulkStart" className="block text-lg font-medium text-slate-700 mb-2">
                    De (Número)
                  </label>
                  <input
                    id="bulkStart"
                    type="number"
                    min="1"
                    required
                    value={bulkStart}
                    onChange={(e) => setBulkStart(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all text-xl"
                    placeholder="Ex: 1"
                  />
                </div>
                <div>
                  <label htmlFor="bulkEnd" className="block text-lg font-medium text-slate-700 mb-2">
                    Até (Número)
                  </label>
                  <input
                    id="bulkEnd"
                    type="number"
                    min="1"
                    required
                    value={bulkEnd}
                    onChange={(e) => setBulkEnd(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all text-xl"
                    placeholder="Ex: 30"
                  />
                </div>
              </div>
            ) : (
              <div>
                <label htmlFor="cardNumber" className="block text-lg font-medium text-slate-700 mb-2">
                  {isVip ? 'Vaga' : 'Número do Cartão'}
                </label>
                <input
                  id="cardNumber"
                  type="text"
                  required
                  value={cardNumber}
                  onChange={(e) => setCardNumber(e.target.value)}
                  readOnly={isVipGrid}
                  className={`w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all text-xl ${isVipGrid ? 'opacity-70 cursor-not-allowed' : ''}`}
                  placeholder="Ex: 12"
                />
              </div>
            )}

            {!isBulkMode && isVip && (
              <div>
                <label htmlFor="ownerName" className="block text-lg font-medium text-slate-700 mb-2">
                  Nome do Cliente (Obrigatório)
                </label>
                <input
                  id="ownerName"
                  type="text"
                  required
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all text-xl"
                  placeholder="Ex: João Silva"
                />
              </div>
            )}
            <div>
              <label htmlFor="checkInDate" className="block text-lg font-medium text-slate-700 mb-2">
                Data e Hora de Entrada
              </label>
              <input
                id="checkInDate"
                type="datetime-local"
                required
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all text-slate-700 text-xl"
              />
            </div>
          </div>
          
          <div className="pt-4">
            {errorMsg && (
              <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-xl text-lg font-medium border border-red-100 flex items-center">
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
