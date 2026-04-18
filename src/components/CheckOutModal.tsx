import React, { useState, useEffect } from 'react';
import { X, Clock, DollarSign, CreditCard, Banknote, Smartphone } from 'lucide-react';
import { ParkedVehicle, Pricing } from '../types';
import { calculatePrice, formatDuration, getBilledBreakdown } from '../lib/pricing';

interface CheckOutModalProps {
  vehicle: ParkedVehicle | null;
  pricing: Pricing;
  onClose: () => void;
  onConfirm: (vehicleId: string, price: number, paymentMethod: 'pix' | 'card' | 'cash') => void;
}

export function CheckOutModal({ vehicle, pricing, onClose, onConfirm }: CheckOutModalProps) {
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'card' | 'cash'>('pix');
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (vehicle) {
      setNow(Date.now());
    }
  }, [vehicle]);

  if (!vehicle) return null;

  const price = calculatePrice(vehicle, pricing, now);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h2 className="text-xl font-bold text-slate-900">Finalizar Estacionamento</h2>
          <button 
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-100 transition-colors text-slate-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 space-y-6">
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
            <div className="flex justify-between items-start mb-1">
              <h3 className="font-bold text-slate-900 text-lg">{vehicle.identifier}</h3>
              <span className="bg-slate-200 text-slate-700 font-bold px-2 py-1 rounded text-xs">
                Baia {vehicle.cardNumber}
              </span>
            </div>
            <p className="text-sm text-slate-500 mb-4">{vehicle.ownerName}</p>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white p-3 rounded-xl border border-slate-100 flex flex-col">
                <span className="text-xs font-medium text-slate-500 mb-1 flex items-center">
                  <Clock className="w-3 h-3 mr-1" /> Tempo Cobrado
                </span>
                <span className="font-bold text-slate-900">
                  {(() => {
                    const breakdown = getBilledBreakdown(vehicle, pricing, now);
                    return `${breakdown.days} pernoite${breakdown.days > 1 ? 's' : ''}`;
                  })()}
                </span>
              </div>
              <div className="bg-white p-3 rounded-xl border border-slate-100 flex flex-col">
                <span className="text-xs font-medium text-slate-500 mb-1 flex items-center">
                  <DollarSign className="w-3 h-3 mr-1" /> Total
                </span>
                <span className="font-bold text-emerald-600 text-lg">R$ {price.toFixed(2)}</span>
              </div>
            </div>
          </div>
          
          <div className="space-y-3">
            <label className="block text-sm font-medium text-slate-700">Método de Pagamento</label>
            <div className="grid grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setPaymentMethod('pix')}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${
                  paymentMethod === 'pix' 
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700' 
                    : 'border-slate-100 hover:border-slate-200 text-slate-500'
                }`}
              >
                <Smartphone className={`w-5 h-5 mb-1 ${paymentMethod === 'pix' ? 'text-emerald-600' : ''}`} />
                <span className="text-xs font-medium">PIX</span>
              </button>
              
              <button
                type="button"
                onClick={() => setPaymentMethod('card')}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${
                  paymentMethod === 'card' 
                    ? 'border-blue-500 bg-blue-50 text-blue-700' 
                    : 'border-slate-100 hover:border-slate-200 text-slate-500'
                }`}
              >
                <CreditCard className={`w-5 h-5 mb-1 ${paymentMethod === 'card' ? 'text-blue-600' : ''}`} />
                <span className="text-xs font-medium">Cartão</span>
              </button>
              
              <button
                type="button"
                onClick={() => setPaymentMethod('cash')}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${
                  paymentMethod === 'cash' 
                    ? 'border-amber-500 bg-amber-50 text-amber-700' 
                    : 'border-slate-100 hover:border-slate-200 text-slate-500'
                }`}
              >
                <Banknote className={`w-5 h-5 mb-1 ${paymentMethod === 'cash' ? 'text-amber-600' : ''}`} />
                <span className="text-xs font-medium">Dinheiro</span>
              </button>
            </div>
          </div>
          
          <div className="pt-4">
            <button
              onClick={() => onConfirm(vehicle.id, price, paymentMethod)}
              className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-lg transition-colors shadow-lg shadow-slate-900/20"
            >
              Confirmar Pagamento
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
