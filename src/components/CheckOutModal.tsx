import React, { useState, useEffect } from 'react';
import { X, Clock, DollarSign, CreditCard, Banknote, Smartphone, AlertTriangle } from 'lucide-react';
import { ParkedVehicle, Pricing } from '../types';
import { calculatePrice, formatDuration, getBilledBreakdown } from '../lib/pricing';

interface CheckOutModalProps {
  vehicle: ParkedVehicle | null;
  pricing: Pricing;
  onClose: () => void;
  onConfirm: (vehicleId: string, price: number, paymentMethod: 'pix' | 'card' | 'cash' | 'postpaid_card') => void;
  onReportLostCard?: (vehicleId: string, lostCardName: string, lostCardPhone: string) => void;
}

export function CheckOutModal({ vehicle, pricing, onClose, onConfirm, onReportLostCard }: CheckOutModalProps) {
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'card' | 'cash' | 'postpaid_card'>('pix');
  const [now, setNow] = useState(Date.now());
  const [showLostForm, setShowLostForm] = useState(false);
  const [lostName, setLostName] = useState('');
  const [lostPhone, setLostPhone] = useState('');

  useEffect(() => {
    if (vehicle) {
      setNow(Date.now());
      setShowLostForm(false);
      setLostName(vehicle.lostCardName || '');
      setLostPhone(vehicle.lostCardPhone || '');
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
                Cartão {vehicle.cardNumber}
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
                    return `${breakdown.days} diária${breakdown.days > 1 ? 's' : ''}`;
                  })()}
                </span>
              </div>
              <div className="bg-white p-3 rounded-xl border border-slate-100 flex flex-col">
                <span className="text-xs font-medium text-slate-500 mb-1 flex items-center">
                  <DollarSign className="w-3 h-3 mr-1" /> Total
                </span>
                <span className="font-bold text-emerald-600 text-lg">R$ {price.toFixed(2)}</span>
                {vehicle.cardLost && pricing.lostCardFee && (
                  <span className="text-[10px] text-red-500 mt-1 leading-tight">
                    + {pricing.lostCardFee.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} taxa
                  </span>
                )}
              </div>
            </div>
          </div>
          
          <div className="space-y-3">
            <label className="block text-sm font-medium text-slate-700">Método de Pagamento</label>
            <div className="grid grid-cols-4 gap-3">
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

              <button
                type="button"
                onClick={() => setPaymentMethod('postpaid_card')}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${
                  paymentMethod === 'postpaid_card' 
                    ? 'border-purple-500 bg-purple-50 text-purple-700' 
                    : 'border-slate-100 hover:border-slate-200 text-slate-500'
                }`}
              >
                <CreditCard className={`w-5 h-5 mb-1 ${paymentMethod === 'postpaid_card' ? 'text-purple-600' : ''}`} />
                <span className="text-xs font-medium text-center">Pós-Pago</span>
              </button>
            </div>
          </div>
          
          {/* Lost Card Section */}
          <div className="pt-2 border-t border-slate-100">
            {vehicle.cardLost ? (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex flex-col">
                <div className="flex items-center text-red-600 font-bold text-sm mb-1">
                  <AlertTriangle className="w-4 h-4 mr-1" />
                  Cartão Marcado como Perdido
                </div>
                <div className="text-xs text-red-700">
                  <span className="font-semibold">Nome:</span> {vehicle.lostCardName || 'Não informado'} <br/>
                  <span className="font-semibold">Telefone:</span> {vehicle.lostCardPhone || 'Não informado'}
                </div>
              </div>
            ) : showLostForm ? (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between text-red-600 font-bold text-sm mb-1">
                  <div className="flex items-center">
                    <AlertTriangle className="w-4 h-4 mr-1" />
                    Registrar Cartão Perdido
                  </div>
                  <button onClick={() => setShowLostForm(false)} className="text-red-400 hover:text-red-700">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="Nome de quem perdeu"
                  className="w-full px-3 py-2 text-sm bg-white border border-red-200 rounded-lg focus:outline-none focus:border-red-400"
                  value={lostName}
                  onChange={e => setLostName(e.target.value)}
                />
                <input
                  type="text"
                  placeholder="Telefone de contato"
                  className="w-full px-3 py-2 text-sm bg-white border border-red-200 rounded-lg focus:outline-none focus:border-red-400"
                  value={lostPhone}
                  onChange={e => setLostPhone(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => {
                    if (onReportLostCard) {
                      onReportLostCard(vehicle.id, lostName, lostPhone);
                      setShowLostForm(false);
                    }
                  }}
                  className="w-full py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold text-sm transition-colors"
                >
                  Salvar Registro de Perda
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowLostForm(true)}
                className="w-full flex items-center justify-center py-2 text-sm text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
              >
                <AlertTriangle className="w-4 h-4 mr-2" />
                Cliente perdeu o cartão?
              </button>
            )}
          </div>

          <div className="pt-2">
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
