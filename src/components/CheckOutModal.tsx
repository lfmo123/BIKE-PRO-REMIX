import React, { useState, useEffect } from 'react';
import { X, Clock, DollarSign, CreditCard, Banknote, Smartphone, AlertTriangle, Terminal } from 'lucide-react';
import { ParkedVehicle, Pricing } from '../types';
import { calculatePrice, formatDuration, getBilledBreakdown } from '../lib/pricing';

interface CheckOutModalProps {
  vehicle: ParkedVehicle | null;
  pricing: Pricing;
  onClose: () => void;
  onConfirm: (vehicleId: string, price: number, paymentMethod: 'card' | 'cash' | 'postpaid_card' | 'fiado' | 'machine') => void;
  onReportLostCard?: (vehicleId: string, lostCardName: string, lostCardPhone: string) => void;
}

export function CheckOutModal({ vehicle, pricing, onClose, onConfirm, onReportLostCard }: CheckOutModalProps) {
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'cash' | 'postpaid_card' | 'fiado' | 'machine'>('machine');
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
        <div className="flex items-center justify-between p-3 sm:p-4 border-b border-slate-100">
          <h2 className="text-base sm:text-lg font-bold text-slate-900">Finalizar Estacionamento</h2>
          <button 
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-100 transition-colors text-slate-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-3 sm:p-4 space-y-1.5">
          <div className="bg-slate-50 p-2 sm:p-3 rounded-xl border border-slate-100">
            <div className="flex justify-between items-start mb-0.5">
              <h3 className="font-bold text-slate-900 text-base leading-none">{vehicle.identifier}</h3>
              <span className="bg-slate-200 text-slate-700 font-bold px-2 py-0.5 rounded text-[10px]">
                Cartão {vehicle.cardNumber}
              </span>
            </div>
            <p className="text-xs text-slate-500 mb-1.5">{vehicle.ownerName}</p>
            
            <div className="grid grid-cols-2 gap-1.5 mb-1.5 text-xs bg-white p-2 rounded-lg border border-slate-100">
              <div>
                <span className="font-medium text-slate-500 block">Entrada</span>
                <span className="font-bold text-slate-900">{new Date(vehicle.checkInTime).toLocaleString('pt-BR')}</span>
              </div>
              <div>
                <span className="font-medium text-slate-500 block">Saída</span>
                <span className="font-bold text-slate-900">{new Date(now).toLocaleString('pt-BR')}</span>
              </div>
              <div className="col-span-2 pt-1 border-t border-slate-50 flex justify-between items-center">
                <span className="font-medium text-slate-500">Tempo:</span>
                <span className="font-bold text-slate-900">{formatDuration(vehicle.checkInTime, now)}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              <div className="bg-white p-2 rounded-lg border border-slate-100 flex flex-col justify-center">
                <span className="text-[10px] font-medium text-slate-500 flex items-center mb-0.5">
                  <Clock className="w-3 h-3 mr-1" /> Cobrado
                </span>
                <span className="font-bold text-slate-900 text-sm">
                  {(() => {
                    const breakdown = getBilledBreakdown(vehicle, pricing, now);
                    return `${breakdown.days} diária${breakdown.days > 1 ? 's' : ''}`;
                  })()}
                </span>
              </div>
              <div className="bg-white p-2 rounded-lg border border-slate-100 flex flex-col justify-center">
                <span className="text-[10px] font-medium text-slate-500 flex items-center mb-0.5">
                  <DollarSign className="w-3 h-3 mr-1" /> Total
                </span>
                <span className="font-bold text-emerald-600 text-base leading-none">R$ {price.toFixed(2)}</span>
                {vehicle.cardLost && pricing.lostCardFee && (
                  <span className="text-[9px] text-red-500 leading-tight mt-0.5">
                    + {pricing.lostCardFee.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                )}
              </div>
            </div>
          </div>
          
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-700 tracking-tight">Método de Pagamento</label>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => setPaymentMethod('cash')}
                className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-xl border-2 transition-all ${
                  paymentMethod === 'cash' 
                    ? 'border-amber-500 bg-amber-50 text-amber-700' 
                    : 'border-slate-100 hover:border-slate-200 text-slate-500'
                }`}
              >
                <Banknote className={`w-4 h-4 mb-0.5 ${paymentMethod === 'cash' ? 'text-amber-600' : ''}`} />
                <span className="text-[10px] sm:text-xs font-medium">Dinheiro</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('machine')}
                className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-xl border-2 transition-all ${
                  paymentMethod === 'machine' 
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700' 
                    : 'border-slate-100 hover:border-slate-200 text-slate-500'
                }`}
              >
                <Terminal className={`w-4 h-4 mb-0.5 ${paymentMethod === 'machine' ? 'text-indigo-600' : ''}`} />
                <span className="text-[10px] sm:text-xs font-medium">Máquina</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('card')}
                className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-xl border-2 transition-all ${
                  paymentMethod === 'card' 
                    ? 'border-blue-500 bg-blue-50 text-blue-700' 
                    : 'border-slate-100 hover:border-slate-200 text-slate-500'
                }`}
              >
                <CreditCard className={`w-4 h-4 mb-0.5 ${paymentMethod === 'card' ? 'text-blue-600' : ''}`} />
                <span className="text-[10px] sm:text-xs font-medium">Pré Pago</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('postpaid_card')}
                className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-xl border-2 transition-all ${
                  paymentMethod === 'postpaid_card' 
                    ? 'border-purple-500 bg-purple-50 text-purple-700' 
                    : 'border-slate-100 hover:border-slate-200 text-slate-500'
                }`}
              >
                <CreditCard className={`w-4 h-4 mb-0.5 ${paymentMethod === 'postpaid_card' ? 'text-purple-600' : ''}`} />
                <span className="text-[10px] sm:text-xs font-medium text-center leading-tight">Pós-Pago</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('fiado')}
                className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-xl border-2 transition-all ${
                  paymentMethod === 'fiado' 
                    ? 'border-red-500 bg-red-50 text-red-700' 
                    : 'border-slate-100 hover:border-slate-200 text-slate-500'
                }`}
              >
                <AlertTriangle className={`w-4 h-4 mb-0.5 ${paymentMethod === 'fiado' ? 'text-red-600' : ''}`} />
                <span className="text-[10px] sm:text-xs font-medium text-center">Fiado</span>
              </button>

              {!vehicle.cardLost && !showLostForm && (
                <button
                  type="button"
                  onClick={() => setShowLostForm(true)}
                  className="flex flex-col items-center justify-center py-1.5 px-1 rounded-xl border-2 border-slate-100 hover:border-red-200 text-red-500 hover:bg-red-50 transition-all"
                >
                  <AlertTriangle className="w-4 h-4 mb-0.5 text-red-500" />
                  <span className="text-[10px] sm:text-xs font-medium text-center leading-tight">Cartão Perdido</span>
                </button>
              )}
            </div>
          </div>
          
          {/* Lost Card Section (Form or Details) */}
          {(vehicle.cardLost || showLostForm) && (
            <div className="pt-1">
              {vehicle.cardLost ? (
                <div className="bg-red-50 border border-red-200 rounded-xl p-2 flex flex-col">
                  <div className="flex items-center text-red-600 font-bold text-xs mb-1">
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    Cartão Marcado como Perdido
                  </div>
                  <div className="text-[10px] text-red-700 leading-tight">
                    <span className="font-semibold">Nome:</span> {vehicle.lostCardName || 'Não informado'} <br/>
                    <span className="font-semibold">Telefone:</span> {vehicle.lostCardPhone || 'Não informado'}
                  </div>
                </div>
              ) : showLostForm && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between text-red-600 font-bold text-xs">
                    <div className="flex items-center">
                      <AlertTriangle className="w-3 h-3 mr-1" />
                      Registrar Cartão Perdido
                    </div>
                    <button onClick={() => setShowLostForm(false)} className="text-red-400 hover:text-red-700 p-1">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                  <input
                    type="text"
                    placeholder="Nome de quem perdeu"
                    className="w-full px-2 py-1.5 text-xs bg-white border border-red-200 rounded-lg focus:outline-none focus:border-red-400"
                    value={lostName}
                    onChange={e => setLostName(e.target.value)}
                  />
                  <input
                    type="text"
                    placeholder="Telefone de contato"
                    className="w-full px-2 py-1.5 text-xs bg-white border border-red-200 rounded-lg focus:outline-none focus:border-red-400"
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
                    className="w-full py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold text-xs transition-colors"
                  >
                    Salvar Registro
                  </button>
                </div>
              )}
            </div>
          )}

          <div>
            <button
              onClick={() => onConfirm(vehicle.id, price, paymentMethod)}
              className="w-full py-2.5 sm:py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-sm sm:text-base transition-colors shadow-lg shadow-slate-900/20"
            >
              Confirmar Pagamento
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
