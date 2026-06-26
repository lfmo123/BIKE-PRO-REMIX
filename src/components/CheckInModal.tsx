import React, { useState } from 'react';
import { X, Bike, Zap, Motorbike } from 'lucide-react';
import { VehicleType, ParkedVehicle } from '../types';

interface CheckInModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCheckIn: (vehicle: Omit<ParkedVehicle, 'id' | 'status'>) => Promise<void | { success: boolean, error?: string }>;
  initialCardNumber?: string;
}

export function CheckInModal({ isOpen, onClose, onCheckIn, initialCardNumber }: CheckInModalProps) {
  const [type, setType] = useState<VehicleType>('bicycle');
  const [cardNumber, setCardNumber] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [customDate, setCustomDate] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const isSpecialGrid = initialCardNumber?.includes('MT/BE');
  const isVipGrid = initialCardNumber?.startsWith('VIP');
  const isTraditionalGrid = initialCardNumber && !initialCardNumber.includes('MT/BE') && !initialCardNumber.startsWith('VIP');

  React.useEffect(() => {
    if (isOpen) {
      if (initialCardNumber) {
        setCardNumber(initialCardNumber);
        if (initialCardNumber.includes('MT/BE')) {
          setType('motorcycle');
        } else {
          setType('bicycle');
        }
      } else {
        setType('bicycle');
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
    
    if (!cardNumber || !customDate) return;
    if (isVipGrid && !ownerName.trim()) {
      setErrorMsg('Para vagas VIP, o nome do cliente é obrigatório!');
      return;
    }
    
    const res = await onCheckIn({
      type,
      identifier: 'Não informada',
      ownerName: ownerName.trim() || 'Não informado',
      cardNumber: cardNumber.trim().toUpperCase(),
      checkInTime: new Date(customDate).getTime(),
    });
    
    // Check if the parent returned an error
    if (res && res.success === false) {
      setErrorMsg(res.error || 'Este cartão já está sendo usado!');
      return;
    }
    
    onClose();
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
            <label className="block text-lg font-medium text-slate-700">Tipo de Veículo</label>
            <div className={`grid ${isSpecialGrid ? 'grid-cols-2' : (isTraditionalGrid ? 'grid-cols-1' : 'grid-cols-3')} gap-3`}>
              {!isSpecialGrid && (
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
              )}
              
              {!isTraditionalGrid && (
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
              )}

              {!isTraditionalGrid && (
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
              )}
            </div>
          </div>
          
          <div className="space-y-4">
            <div>
              <label htmlFor="cardNumber" className="block text-lg font-medium text-slate-700 mb-2">
                {isVipGrid ? 'Vaga' : 'Número do Cartão'}
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

            {isVipGrid && (
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
              className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold text-2xl transition-colors shadow-lg shadow-emerald-500/30"
            >
              Confirmar Entrada
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
