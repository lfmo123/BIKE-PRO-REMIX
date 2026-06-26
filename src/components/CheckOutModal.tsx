import React, { useState, useEffect } from 'react';
import { X, Clock, DollarSign, CreditCard, Banknote, Smartphone, AlertTriangle, Terminal, Search } from 'lucide-react';
import { ParkedVehicle, Pricing, CustomerCard } from '../types';
import { calculatePrice, formatDuration, getBilledBreakdown } from '../lib/pricing';

interface CheckOutModalProps {
  vehicle: ParkedVehicle | null;
  pricing: Pricing;
  customerCards?: CustomerCard[];
  onClose: () => void;
  onConfirm: (vehicleId: string, price: number, paymentMethod: 'card' | 'cash' | 'postpaid_card' | 'fiado' | 'machine', customerCardId?: string) => void;
  onReportLostCard?: (vehicleId: string, lostCardName: string, lostCardPhone: string) => void;
}

export function CheckOutModal({ vehicle, pricing, customerCards = [], onClose, onConfirm, onReportLostCard }: CheckOutModalProps) {
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'cash' | 'postpaid_card' | 'fiado' | 'machine'>('machine');
  const [now, setNow] = useState(Date.now());
  const [showLostForm, setShowLostForm] = useState(false);
  const [lostName, setLostName] = useState('');
  const [lostPhone, setLostPhone] = useState('');
  const [customPrice, setCustomPrice] = useState<string>('');
  const [customerCardId, setCustomerCardId] = useState<string>('');
  const [showCardSelector, setShowCardSelector] = useState<'prepaid' | 'postpaid' | null>(null);
  const [cardSearchTerm, setCardSearchTerm] = useState('');

  useEffect(() => {
    if (vehicle) {
      setNow(Date.now());
      setShowLostForm(false);
      setLostName(vehicle.lostCardName || '');
      setLostPhone(vehicle.lostCardPhone || '');
      const calcPrice = calculatePrice(vehicle, pricing, Date.now());
      setCustomPrice(calcPrice.toFixed(2));
      setCustomerCardId('');
    }
  }, [vehicle]);

  if (!vehicle) return null;

  const price = calculatePrice(vehicle, pricing, now);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between p-3 sm:p-4 border-b border-slate-100">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Finalizar Estacionamento</h2>
          <button 
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-100 transition-colors text-slate-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-3 sm:p-4 space-y-1.5">
          <div className="bg-slate-50 p-2 sm:p-3 rounded-xl border border-slate-100">
            <div className="flex justify-between items-start mb-1">
              <h3 className="font-bold text-slate-900 text-xl leading-none">{vehicle.identifier}</h3>
              <span className="bg-slate-200 text-slate-700 font-bold px-2.5 py-1 rounded text-xs sm:text-sm">
                {vehicle.cardNumber.startsWith('VIP') ? vehicle.cardNumber : `Cartão ${vehicle.cardNumber}`}
              </span>
            </div>
            <p className="text-base text-slate-500 mb-2">{vehicle.ownerName}</p>
            
            <div className="grid grid-cols-2 gap-1.5 mb-2 text-base bg-white p-2.5 rounded-lg border border-slate-100">
              <div>
                <span className="font-medium text-slate-500 block text-sm">Entrada</span>
                <span className="font-bold text-slate-900">{new Date(vehicle.checkInTime).toLocaleString('pt-BR')}</span>
              </div>
              <div>
                <span className="font-medium text-slate-500 block text-sm">Saída</span>
                <span className="font-bold text-slate-900">{new Date(now).toLocaleString('pt-BR')}</span>
              </div>
              <div className="col-span-2 pt-1 border-t border-slate-50 flex justify-between items-center mt-1">
                <span className="font-medium text-slate-500 text-sm">Tempo:</span>
                <span className="font-bold text-slate-900">{formatDuration(vehicle.checkInTime, now)}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              <div className="bg-white p-2.5 rounded-lg border border-slate-100 flex flex-col justify-center">
                <span className="text-sm font-medium text-slate-500 flex items-center mb-0.5">
                  <Clock className="w-4 h-4 mr-1" /> Cobrado
                </span>
                <span className="font-bold text-slate-900 text-lg">
                  {(() => {
                    const breakdown = getBilledBreakdown(vehicle, pricing, now);
                    return `${breakdown.days} diária${breakdown.days > 1 ? 's' : ''}`;
                  })()}
                </span>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-slate-100 flex flex-col justify-center">
                <span className="text-sm font-medium text-slate-500 flex items-center mb-0.5">
                  <DollarSign className="w-4 h-4 mr-1" /> Total (R$)
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={customPrice}
                  onChange={(e) => setCustomPrice(e.target.value)}
                  className="font-bold text-emerald-600 text-xl leading-none w-full bg-transparent outline-none p-0 border-b border-emerald-200 focus:border-emerald-500 transition-colors"
                />
                {vehicle.cardLost && pricing.lostCardFee && (
                  <span className="text-xs text-red-500 leading-tight mt-1 mb-0.5">
                    + {pricing.lostCardFee.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} (Cartão)
                  </span>
                )}
              </div>
            </div>
          </div>
          
          <div className="space-y-1">
            <label className="block text-base font-semibold text-slate-700 tracking-tight mb-1">Método de Pagamento</label>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => setPaymentMethod('cash')}
                className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl border-2 transition-all ${
                  paymentMethod === 'cash' 
                    ? 'border-amber-500 bg-amber-50 text-amber-700' 
                    : 'border-slate-100 hover:border-slate-200 text-slate-500'
                }`}
              >
                <Banknote className={`w-5 h-5 mb-1 ${paymentMethod === 'cash' ? 'text-amber-600' : ''}`} />
                <span className="text-xs sm:text-base font-medium">Dinheiro</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('machine')}
                className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl border-2 transition-all ${
                  paymentMethod === 'machine' 
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700' 
                    : 'border-slate-100 hover:border-slate-200 text-slate-500'
                }`}
              >
                <Terminal className={`w-5 h-5 mb-1 ${paymentMethod === 'machine' ? 'text-indigo-600' : ''}`} />
                <span className="text-xs sm:text-base font-medium">Máquina</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setPaymentMethod('card');
                  setShowCardSelector('prepaid');
                  setCardSearchTerm('');
                }}
                className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl border-2 transition-all ${
                  paymentMethod === 'card' 
                    ? 'border-blue-500 bg-blue-50 text-blue-700' 
                    : 'border-slate-100 hover:border-slate-200 text-slate-500'
                }`}
              >
                <CreditCard className={`w-5 h-5 mb-1 ${paymentMethod === 'card' ? 'text-blue-600' : ''}`} />
                <span className="text-xs sm:text-base font-medium">Pré Pago</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setPaymentMethod('postpaid_card');
                  setShowCardSelector('postpaid');
                  setCardSearchTerm('');
                }}
                className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl border-2 transition-all ${
                  paymentMethod === 'postpaid_card' 
                    ? 'border-purple-500 bg-purple-50 text-purple-700' 
                    : 'border-slate-100 hover:border-slate-200 text-slate-500'
                }`}
              >
                <CreditCard className={`w-5 h-5 mb-1 ${paymentMethod === 'postpaid_card' ? 'text-purple-600' : ''}`} />
                <span className="text-xs sm:text-base font-medium text-center leading-tight">Pós-Pago</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('fiado')}
                className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl border-2 transition-all ${
                  paymentMethod === 'fiado' 
                    ? 'border-red-500 bg-red-50 text-red-700' 
                    : 'border-slate-100 hover:border-slate-200 text-slate-500'
                }`}
              >
                <AlertTriangle className={`w-5 h-5 mb-1 ${paymentMethod === 'fiado' ? 'text-red-600' : ''}`} />
                <span className="text-xs sm:text-base font-medium text-center">Fiado</span>
              </button>

              {!vehicle.cardLost && !showLostForm && (
                <button
                  type="button"
                  onClick={() => setShowLostForm(true)}
                  className="flex flex-col items-center justify-center py-2 px-1 rounded-xl border-2 border-slate-100 hover:border-red-200 text-red-500 hover:bg-red-50 transition-all"
                >
                  <AlertTriangle className={`w-5 h-5 mb-1 text-red-500`} />
                  <span className="text-xs sm:text-base font-medium text-center leading-tight">Cartão Perdido</span>
                </button>
              )}
            </div>
          </div>
          
          {/* Lost Card Section (Form or Details) */}
          {(vehicle.cardLost || showLostForm) && (
            <div className="pt-1">
              {vehicle.cardLost ? (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex flex-col">
                  <div className="flex items-center text-red-600 font-bold text-base mb-1">
                    <AlertTriangle className="w-4 h-4 mr-1" />
                    Cartão Marcado como Perdido
                  </div>
                  <div className="text-sm text-red-700 leading-tight">
                    <span className="font-semibold">Nome:</span> {vehicle.lostCardName || 'Não informado'} <br/>
                    <span className="font-semibold">Telefone:</span> {vehicle.lostCardPhone || 'Não informado'}
                  </div>
                </div>
              ) : showLostForm && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 space-y-2 mt-2">
                  <div className="flex items-center justify-between text-red-600 font-bold text-base">
                    <div className="flex items-center">
                      <AlertTriangle className="w-4 h-4 mr-1" />
                      Registrar Cartão Perdido
                    </div>
                    <button onClick={() => setShowLostForm(false)} className="text-red-400 hover:text-red-700 p-1">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <input
                    type="text"
                    placeholder="Nome de quem perdeu"
                    className="w-full px-3 py-2 text-base bg-white border border-red-200 rounded-lg focus:outline-none focus:border-red-400"
                    value={lostName}
                    onChange={e => setLostName(e.target.value)}
                  />
                  <input
                    type="text"
                    placeholder="Telefone de contato"
                    className="w-full px-3 py-2 text-base bg-white border border-red-200 rounded-lg focus:outline-none focus:border-red-400"
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
                    className="w-full py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold text-base transition-colors"
                  >
                    Salvar Registro
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="pt-2">
            {(paymentMethod === 'card' || paymentMethod === 'postpaid_card') && customerCardId && (
              <div className="mb-4 bg-slate-50 p-3 rounded-lg border border-slate-200 flex justify-between items-center">
                <div>
                  <div className="text-xs text-slate-500 font-semibold uppercase">Cartão Selecionado</div>
                  <div className="font-bold text-slate-800">
                    {customerCards.find(c => c.id === customerCardId)?.cardNumber} - {customerCards.find(c => c.id === customerCardId)?.ownerName}
                  </div>
                  {paymentMethod === 'card' ? (
                    <div className="text-sm font-semibold text-emerald-600 mt-0.5">
                      Crédito Disponível: R$ {(customerCards.find(c => c.id === customerCardId)?.balance || 0).toFixed(2)}
                    </div>
                  ) : (
                    <div className="text-sm font-semibold text-purple-600 mt-0.5">
                      Fatura Atual: R$ {(customerCards.find(c => c.id === customerCardId)?.balance || 0).toFixed(2)}
                    </div>
                  )}
                </div>
                <button 
                  onClick={() => {
                    setShowCardSelector(paymentMethod === 'card' ? 'prepaid' : 'postpaid');
                    setCardSearchTerm('');
                  }}
                  className="text-indigo-600 hover:text-indigo-800 text-sm font-semibold px-2 py-1 bg-indigo-50 rounded h-fit"
                >
                  Trocar
                </button>
              </div>
            )}
            <button
              onClick={() => onConfirm(vehicle.id, parseFloat(customPrice) || 0, paymentMethod, customerCardId)}
              disabled={(paymentMethod === 'card' || paymentMethod === 'postpaid_card') && !customerCardId}
              className={`w-full py-3 sm:py-4 rounded-xl font-bold text-lg sm:text-xl transition-colors shadow-lg mt-1
                ${(paymentMethod === 'card' || paymentMethod === 'postpaid_card') && !customerCardId
                  ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
                  : 'bg-slate-900 hover:bg-slate-800 text-white shadow-slate-900/20'
                }`}
            >
              Confirmar Pagamento
            </button>
          </div>
        </div>
      </div>

      {/* Card Selector Modal */}
      {showCardSelector && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl flex flex-col max-h-[80vh]">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h2 className="text-lg font-bold text-slate-800 flex items-center">
                <CreditCard className="w-5 h-5 mr-2 text-indigo-500" />
                Selecione o Cartão {showCardSelector === 'prepaid' ? 'Pré-Pago' : 'Pós-Pago'}
              </h2>
              <button 
                onClick={() => setShowCardSelector(null)}
                className="text-slate-400 hover:text-slate-600 p-1 bg-slate-200 hover:bg-slate-300 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="px-4 pt-4 border-b border-slate-100 pb-4">
              <div className="relative">
                <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar cartão ou cliente..."
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  value={cardSearchTerm}
                  onChange={(e) => setCardSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <div className="p-4 overflow-y-auto flex-1 space-y-2">
              {customerCards.filter(c => c.type === showCardSelector && (c.cardNumber.toLowerCase().includes(cardSearchTerm.toLowerCase()) || c.ownerName.toLowerCase().includes(cardSearchTerm.toLowerCase()))).length === 0 ? (
                <div className="text-center py-6 text-slate-500">
                  Nenhum cartão {showCardSelector === 'prepaid' ? 'Pré-Pago' : 'Pós-Pago'} encontrado.
                </div>
              ) : (
                customerCards.filter(c => c.type === showCardSelector && (c.cardNumber.toLowerCase().includes(cardSearchTerm.toLowerCase()) || c.ownerName.toLowerCase().includes(cardSearchTerm.toLowerCase()))).map(c => (
                  <button
                    key={c.id}
                    onClick={() => {
                      setCustomerCardId(c.id);
                      setShowCardSelector(null);
                    }}
                    className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
                      customerCardId === c.id ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-bold text-slate-800">{c.cardNumber}</div>
                        <div className="text-sm text-slate-500">{c.ownerName}</div>
                      </div>
                      <div className={`text-sm font-bold text-right ${showCardSelector === 'prepaid' ? 'text-emerald-600' : 'text-purple-600'}`}>
                        {showCardSelector === 'prepaid' 
                          ? `Saldo: R$ ${(c.balance || 0).toFixed(2)}`
                          : `Fatura: R$ ${(c.balance || 0).toFixed(2)}`
                        }
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}