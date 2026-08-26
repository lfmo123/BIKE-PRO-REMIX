import React, { useState, useEffect } from 'react';
import { X, Clock, DollarSign, CreditCard, Banknote, Smartphone, AlertTriangle, Terminal, Search } from 'lucide-react';
import { ParkedVehicle, Pricing, CustomerCard } from '../types';
import { calculatePrice, formatDuration, getBilledBreakdown } from '../lib/pricing';

interface CheckOutModalProps {
  vehicle: ParkedVehicle | null;
  pricing: Pricing;
  customerCards?: CustomerCard[];
  onClose: () => void;
  onConfirm: (vehicleId: string, price: number, paymentMethod: 'card' | 'cash' | 'postpaid_card' | 'fiado' | 'machine' | 'pix', customerCardId?: string, checkInTime?: number, checkOutTime?: number) => void;
  onReportLostCard?: (vehicleId: string, lostCardName: string, lostCardPhone: string) => void;
  onRevertCheckin?: (vehicleId: string) => void;
}

export function CheckOutModal({ vehicle, pricing, customerCards = [], onClose, onConfirm, onReportLostCard, onRevertCheckin }: CheckOutModalProps) {
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'cash' | 'postpaid_card' | 'fiado' | 'machine' | 'pix'>('machine');
  const [now, setNow] = useState(Date.now());
  const [showLostForm, setShowLostForm] = useState(false);
  const [lostName, setLostName] = useState('');
  const [lostPhone, setLostPhone] = useState('');
  const [customPrice, setCustomPrice] = useState<string>('');
  const [customerCardId, setCustomerCardId] = useState<string>('');
  const [showCardSelector, setShowCardSelector] = useState<boolean>(false);
  const [cardSearchTerm, setCardSearchTerm] = useState('');
  const [revertIntent, setRevertIntent] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  
  const [editedCheckIn, setEditedCheckIn] = useState('');
  const [editedCheckOut, setEditedCheckOut] = useState('');

  useEffect(() => {
    if (vehicle) {
      const nowTs = Date.now();
      setNow(nowTs);
      setShowLostForm(false);
      setLostName(vehicle.lostCardName || '');
      setLostPhone(vehicle.lostCardPhone || '');
      
      const formatLocal = (t: number) => {
        const d = new Date(t);
        return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0,16);
      };
      
      setEditedCheckIn(formatLocal(vehicle.checkInTime));
      setEditedCheckOut(formatLocal(nowTs));

      const calcPrice = calculatePrice(vehicle, pricing, nowTs);
      setCustomPrice(calcPrice.toFixed(2));
      
      // Try to auto-match a customer card if vehicle already had one or if cardNumber matches
      const matched = customerCards.find(c => 
        (vehicle.customerCardId && c.id === vehicle.customerCardId) ||
        (c.cardNumber && c.cardNumber.toLowerCase() === vehicle.cardNumber.toLowerCase())
      );
      if (matched) {
        setCustomerCardId(matched.id);
        if (paymentMethod === 'card' || paymentMethod === 'postpaid_card') {
          setPaymentMethod(matched.type === 'postpaid' ? 'postpaid_card' : 'card');
        }
      } else {
        setCustomerCardId('');
      }
    }
  }, [vehicle, customerCards]);

  if (!vehicle) return null;

  const checkInMs = editedCheckIn ? new Date(editedCheckIn).getTime() : vehicle.checkInTime;
  const checkOutMs = editedCheckOut ? new Date(editedCheckOut).getTime() : now;
  const price = calculatePrice({ ...vehicle, checkInTime: checkInMs }, pricing, checkOutMs);
  
  useEffect(() => {
    if (editedCheckIn || editedCheckOut) {
      setCustomPrice(price.toFixed(2));
    }
  }, [editedCheckIn, editedCheckOut]); // purposefully omitting price since we want to trigger specifically on time edit

  const selectedCard = customerCards.find(c => c.id === customerCardId);

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
                {vehicle.cardNumber.startsWith('SN') ? vehicle.cardNumber : `Cartão ${vehicle.cardNumber}`}
              </span>
            </div>
            <p className="text-base text-slate-500 mb-2">{vehicle.ownerName}</p>
            
            <div className="grid grid-cols-2 gap-1.5 mb-2 text-base bg-white p-2.5 rounded-lg border border-slate-100">
              <div>
                <span className="font-medium text-slate-500 block text-sm">Entrada</span>
                <input 
                  type="datetime-local" 
                  value={editedCheckIn}
                  onChange={(e) => setEditedCheckIn(e.target.value)}
                  className="font-bold text-slate-900 w-full outline-none bg-transparent border-b border-transparent focus:border-indigo-300 text-sm"
                />
              </div>
              <div>
                <span className="font-medium text-slate-500 block text-sm">Saída</span>
                <input 
                  type="datetime-local" 
                  value={editedCheckOut}
                  onChange={(e) => setEditedCheckOut(e.target.value)}
                  className="font-bold text-slate-900 w-full outline-none bg-transparent border-b border-transparent focus:border-indigo-300 text-sm"
                />
              </div>
              <div className="col-span-2 pt-1 border-t border-slate-50 flex justify-between items-center mt-1">
                <span className="font-medium text-slate-500 text-sm">Tempo:</span>
                <span className="font-bold text-slate-900">{formatDuration(checkInMs, checkOutMs)}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              <div className="bg-white p-2.5 rounded-lg border border-slate-100 flex flex-col justify-center">
                <span className="text-sm font-medium text-slate-500 flex items-center mb-0.5">
                  <Clock className="w-4 h-4 mr-1" /> Cobrado
                </span>
                <span className="font-bold text-slate-900 text-lg">
                  {(() => {
                    const breakdown = getBilledBreakdown({ ...vehicle, checkInTime: checkInMs }, pricing, checkOutMs);
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
          
          <div className="space-y-1.5">
            <label className="block text-base font-semibold text-slate-700 tracking-tight">Método de Pagamento</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
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
                <span className="text-xs sm:text-sm font-medium">Dinheiro</span>
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
                <span className="text-xs sm:text-sm font-medium">Máquina</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (selectedCard) {
                    setPaymentMethod(selectedCard.type === 'postpaid' ? 'postpaid_card' : 'card');
                  } else {
                    setPaymentMethod('card');
                  }
                  setShowCardSelector(true);
                  setCardSearchTerm('');
                }}
                className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl border-2 transition-all ${
                  paymentMethod === 'card' || paymentMethod === 'postpaid_card'
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700' 
                    : 'border-slate-100 hover:border-slate-200 text-slate-500'
                }`}
              >
                <CreditCard className={`w-5 h-5 mb-1 ${paymentMethod === 'card' || paymentMethod === 'postpaid_card' ? 'text-indigo-600' : ''}`} />
                <span className="text-xs sm:text-sm font-medium text-center">Cartão</span>
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
                <span className="text-xs sm:text-sm font-medium text-center">Fiado</span>
              </button>
            </div>

            {!vehicle.cardLost && !showLostForm && (
              <div className="pt-0.5 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowLostForm(true)}
                  className="text-xs text-red-500 hover:text-red-700 hover:bg-red-50 py-1 px-2.5 rounded-lg border border-transparent hover:border-red-200 transition-all flex items-center gap-1 font-medium"
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Informar Cartão Físico Perdido
                </button>
              </div>
            )}
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
            {(paymentMethod === 'card' || paymentMethod === 'postpaid_card') && (
              selectedCard ? (
                <div className="mb-3 bg-slate-50 p-3 rounded-xl border border-slate-200 flex justify-between items-center">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500 font-semibold uppercase">Cartão Selecionado</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        selectedCard.type === 'prepaid' 
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                          : 'bg-purple-100 text-purple-800 border border-purple-200'
                      }`}>
                        {selectedCard.type === 'prepaid' ? 'Pré-Pago' : 'Pós-Pago'}
                      </span>
                    </div>
                    <div className="font-bold text-slate-900 text-base mt-0.5">
                      {selectedCard.cardNumber} - {selectedCard.ownerName}
                    </div>
                    {selectedCard.type === 'prepaid' ? (
                      <div className="text-sm font-semibold text-emerald-600 mt-0.5">
                        Crédito Disponível: R$ {(Number(selectedCard.balance) || 0).toFixed(2)}
                      </div>
                    ) : (
                      <div className="text-sm font-semibold text-purple-600 mt-0.5">
                        Fatura Atual: R$ {(Number(selectedCard.balance) || 0).toFixed(2)}
                      </div>
                    )}
                  </div>
                  <button 
                    type="button"
                    onClick={() => {
                      setShowCardSelector(true);
                      setCardSearchTerm('');
                    }}
                    className="text-indigo-600 hover:text-indigo-800 text-sm font-semibold px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-200 transition-colors"
                  >
                    Trocar
                  </button>
                </div>
              ) : (
                <div className="mb-3 bg-indigo-50/70 p-3 rounded-xl border border-indigo-200 flex justify-between items-center">
                  <div className="text-xs text-indigo-900 font-medium">
                    Nenhum cartão selecionado. Clique ao lado para buscar por número ou cliente.
                  </div>
                  <button 
                    type="button"
                    onClick={() => {
                      setShowCardSelector(true);
                      setCardSearchTerm('');
                    }}
                    className="text-white bg-indigo-600 hover:bg-indigo-700 text-xs font-bold px-3 py-2 rounded-lg shadow-sm transition-colors whitespace-nowrap ml-2 flex items-center gap-1"
                  >
                    <Search className="w-3.5 h-3.5" />
                    Buscar Cartão
                  </button>
                </div>
              )
            )}

            <button
              onClick={() => onConfirm(vehicle.id, parseFloat(customPrice) || 0, paymentMethod, customerCardId, checkInMs, checkOutMs)}
              disabled={(paymentMethod === 'card' || paymentMethod === 'postpaid_card') && !customerCardId}
              className={`w-full py-3 sm:py-4 rounded-xl font-bold text-lg sm:text-xl transition-colors shadow-lg mt-1
                ${(paymentMethod === 'card' || paymentMethod === 'postpaid_card') && !customerCardId
                  ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
                  : 'bg-slate-900 hover:bg-slate-800 text-white shadow-slate-900/20'
                }`}
            >
              Confirmar Pagamento
            </button>
            
            {onRevertCheckin && !revertIntent && (
              <button
                type="button"
                onClick={() => setRevertIntent(true)}
                className="w-full mt-3 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl font-medium transition-colors flex items-center justify-center border border-red-200"
              >
                <AlertTriangle className="w-4 h-4 mr-2" />
                Estornar Entrada
              </button>
            )}

            {revertIntent && (
              <div className="mt-3 bg-red-50 p-3 rounded-xl border border-red-200">
                <label className="block text-sm font-medium text-slate-700 mb-1">Senha do Admin para Estorno</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 mb-2"
                  placeholder="Digite a senha"
                />
                {passwordError && <p className="text-red-500 text-xs mb-2">{passwordError}</p>}
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      if (password === 'Admin') {
                        onRevertCheckin(vehicle.id);
                        onClose();
                      } else {
                        setPasswordError('Senha incorreta');
                      }
                    }}
                    className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
                  >
                    Confirmar
                  </button>
                  <button
                    onClick={() => {
                      setRevertIntent(false);
                      setPassword('');
                      setPasswordError('');
                    }}
                    className="flex-1 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg font-medium transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Card Selector Modal */}
      {showCardSelector && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[85vh] animate-in fade-in zoom-in duration-150">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h2 className="text-lg font-bold text-slate-800 flex items-center">
                <CreditCard className="w-5 h-5 mr-2 text-indigo-600" />
                Selecionar Cartão Cliente
              </h2>
              <button 
                onClick={() => setShowCardSelector(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 bg-slate-200 hover:bg-slate-300 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {(() => {
              const term = cardSearchTerm.toLowerCase().trim();
              const termDigits = term.replace(/\D/g, '');

              const filtered = customerCards.filter(c => {
                if (!term) return true;
                const cardNum = (c.cardNumber || '').toLowerCase().trim();
                const owner = (c.ownerName || '').toLowerCase().trim();
                const phone = (c.phone || '').toLowerCase().replace(/\D/g, '');

                // 1. Exact match on card number (e.g. typing "10" matches "10" or "010", but NOT "1000")
                const isExactCard = cardNum === term || (termDigits.length > 0 && cardNum.replace(/^0+/, '') === termDigits.replace(/^0+/, ''));
                if (isExactCard) return true;

                // 2. Match on owner name (partial or full client name)
                if (owner.includes(term)) return true;

                // 3. Match on phone only if search has at least 4 digits
                if (termDigits.length >= 4 && phone.includes(termDigits)) return true;

                return false;
              });

              return (
                <>
                  <div className="p-4 border-b border-slate-100 bg-white">
                    <div className="relative">
                      <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Digite o número exato do cartão ou nome..."
                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-base"
                        value={cardSearchTerm}
                        onChange={(e) => setCardSearchTerm(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && filtered.length === 1) {
                            const c = filtered[0];
                            setCustomerCardId(c.id);
                            setPaymentMethod(c.type === 'prepaid' ? 'card' : 'postpaid_card');
                            setShowCardSelector(false);
                          }
                        }}
                        autoFocus
                      />
                    </div>
                    <div className="flex justify-between items-center text-xs text-slate-400 mt-2">
                      <span>Busca exata por número do cartão ou nome do cliente</span>
                      {cardSearchTerm && <span>{filtered.length} encontrado(s)</span>}
                    </div>
                  </div>

                  <div className="p-4 overflow-y-auto flex-1 space-y-2 bg-slate-50/50">
                    {filtered.length === 0 ? (
                      <div className="text-center py-8 text-slate-500">
                        <CreditCard className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                        <p className="font-semibold text-slate-700">Nenhum cartão encontrado</p>
                        <p className="text-xs text-slate-400 mt-1">Nenhum cartão com o número exato "{cardSearchTerm}" ou cliente correspondente.</p>
                      </div>
                    ) : (
                      filtered.map(c => {
                        const isPrepaid = c.type === 'prepaid';
                        const isSelected = customerCardId === c.id;
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => {
                              setCustomerCardId(c.id);
                              setPaymentMethod(isPrepaid ? 'card' : 'postpaid_card');
                              setShowCardSelector(false);
                            }}
                            className={`w-full text-left p-3.5 rounded-xl border-2 transition-all ${
                              isSelected 
                                ? 'border-indigo-600 bg-indigo-50/80 shadow-sm' 
                                : 'border-slate-200 hover:border-indigo-300 bg-white shadow-xs'
                            }`}
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-slate-900 text-base">{c.cardNumber}</span>
                                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                                    isPrepaid 
                                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                                      : 'bg-purple-100 text-purple-800 border border-purple-200'
                                  }`}>
                                    {isPrepaid ? 'Pré-Pago' : 'Pós-Pago'}
                                  </span>
                                </div>
                                <div className="text-sm font-semibold text-slate-700 mt-1">{c.ownerName}</div>
                                {c.phone && <div className="text-xs text-slate-400 mt-0.5">{c.phone}</div>}
                              </div>
                              <div className={`text-sm font-bold text-right ${isPrepaid ? 'text-emerald-600' : 'text-purple-600'}`}>
                                <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                                  {isPrepaid ? 'Saldo Atual' : 'Fatura Atual'}
                                </span>
                                R$ {(Number(c.balance) || 0).toFixed(2)}
                              </div>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}