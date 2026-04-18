import React, { useState } from 'react';
import { X, Bike, Zap, Motorbike } from 'lucide-react';
import { VehicleType, ParkedVehicle } from '../types';

interface CheckInModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCheckIn: (vehicle: Omit<ParkedVehicle, 'id' | 'checkInTime' | 'status'>) => void;
  initialCardNumber?: string;
}

export function CheckInModal({ isOpen, onClose, onCheckIn, initialCardNumber }: CheckInModalProps) {
  const [type, setType] = useState<VehicleType>('bicycle');
  const [identifier, setIdentifier] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [cardNumber, setCardNumber] = useState('');

  React.useEffect(() => {
    if (isOpen) {
      if (initialCardNumber) {
        setCardNumber(initialCardNumber);
      } else {
        setCardNumber('');
      }
      setType('bicycle');
      setIdentifier('');
      setOwnerName('');
    }
  }, [isOpen, initialCardNumber]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!cardNumber) return;
    
    onCheckIn({
      type,
      identifier: identifier || 'Não informada',
      ownerName: ownerName || 'Não informado',
      cardNumber,
    });
    
    // Reset form
    setType('bicycle');
    setIdentifier('');
    setOwnerName('');
    setCardNumber('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h2 className="text-xl font-bold text-slate-900">Novo Check-in</h2>
          <button 
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-100 transition-colors text-slate-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="space-y-3">
            <label className="block text-sm font-medium text-slate-700">Tipo de Veículo</label>
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
                <Bike className={`w-6 h-6 mb-2 ${type === 'bicycle' ? 'text-blue-600' : ''}`} />
                <span className="text-xs font-medium">Bicicleta</span>
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
                <Zap className={`w-6 h-6 mb-2 ${type === 'ebike' ? 'text-emerald-600' : ''}`} />
                <span className="text-xs font-medium">E-Bike</span>
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
                <Motorbike className={`w-6 h-6 mb-2 ${type === 'motorcycle' ? 'text-purple-600' : ''}`} />
                <span className="text-xs font-medium">Moto</span>
              </button>
            </div>
          </div>
          
          <div className="space-y-4">
            <div>
              <label htmlFor="identifier" className="block text-sm font-medium text-slate-700 mb-1">
                {type === 'motorcycle' ? 'Placa' : 'Identificação (Cor, Modelo, etc)'}
                <span className="text-slate-400 font-normal ml-1">(Opcional)</span>
              </label>
              <input
                id="identifier"
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
                placeholder={type === 'motorcycle' ? 'ABC-1234' : 'Caloi Vermelha'}
              />
            </div>
            
            <div>
              <label htmlFor="ownerName" className="block text-sm font-medium text-slate-700 mb-1">
                Nome do Proprietário
                <span className="text-slate-400 font-normal ml-1">(Opcional)</span>
              </label>
              <input
                id="ownerName"
                type="text"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
                placeholder="João Silva"
              />
            </div>

            <div>
              <label htmlFor="cardNumber" className="block text-sm font-medium text-slate-700 mb-1">
                Número do Cartão (Baia)
              </label>
              <input
                id="cardNumber"
                type="text"
                required
                value={cardNumber}
                onChange={(e) => setCardNumber(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
                placeholder="Ex: 12"
              />
            </div>
          </div>
          
          <div className="pt-4">
            <button
              type="submit"
              className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold text-lg transition-colors shadow-lg shadow-emerald-500/30"
            >
              Confirmar Check-in
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
