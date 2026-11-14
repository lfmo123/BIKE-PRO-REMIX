import React, { useState, useEffect } from 'react';
import {
  X,
  Clock,
  DollarSign,
  CreditCard,
  Banknote,
  AlertTriangle,
  Terminal,
  Search,
  QrCode,
  Copy,
  Check,
  MessageCircle,
  Camera
} from 'lucide-react';
import { ParkedVehicle, Pricing, CustomerCard } from '../types';
import { calculatePrice, formatDuration, getBilledBreakdown } from '../lib/pricing';
import { DeviceFeaturesConfig } from '../lib/deviceModules';
import { generatePixPayload, generateQrDataUrl } from '../lib/pixUtils';
import { buildCheckOutWhatsappText, openWhatsappMessage } from '../lib/whatsappUtils';

interface CheckOutModalProps {
  vehicle: ParkedVehicle | null;
  pricing: Pricing;
  customerCards?: CustomerCard[];
  deviceConfig?: DeviceFeaturesConfig;
  onClose: () => void;
  onConfirm: (
    vehicleId: string,
    price: number,
    paymentMethod: 'card' | 'cash' | 'postpaid_card' | 'fiado' | 'machine' | 'pix',
    customerCardId?: string,
    checkInTime?: number,
    checkOutTime?: number
  ) => void;
  onReportLostCard?: (vehicleId: string, lostCardName: string, lostCardPhone: string) => void;
  onRevertCheckin?: (vehicleId: string) => void;
}

export function CheckOutModal({
  vehicle,
  pricing,
  customerCards = [],
  deviceConfig,
  onClose,
  onConfirm,
  onReportLostCard,
  onRevertCheckin
}: CheckOutModalProps) {
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

  // Optional PIX & WhatsApp states
  const [pixQrUrl, setPixQrUrl] = useState<string>('');
  const [pixPayload, setPixPayload] = useState<string>('');
  const [pixCopied, setPixCopied] = useState(false);
  const [whatsappPhone, setWhatsappPhone] = useState('');

  const hourlyEnabled = Boolean(deviceConfig?.enableHourlyPricing);

  // Initialize modal state ONLY when the selected vehicle ID changes (prevents background sync from resetting edits)
  useEffect(() => {
    if (vehicle) {
      const nowTs = Date.now();
      setNow(nowTs);
      setShowLostForm(false);
      setLostName(vehicle.lostCardName || '');
      setLostPhone(vehicle.lostCardPhone || '');
      setRevertIntent(false);
      setPassword('');
      setPasswordError('');
      setPixCopied(false);

      const formatLocal = (t: number) => {
        const d = new Date(t);
        return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      };

      setEditedCheckIn(formatLocal(vehicle.checkInTime));
      setEditedCheckOut(formatLocal(nowTs));

      const calcPrice = calculatePrice(vehicle, pricing, nowTs, hourlyEnabled);
      setCustomPrice(calcPrice.toFixed(2));

      const matched = customerCards.find(
        c =>
          (vehicle.customerCardId && c.id === vehicle.customerCardId) ||
          (c.cardNumber && c.cardNumber.toLowerCase() === vehicle.cardNumber.toLowerCase())
      );
      if (matched) {
        setCustomerCardId(matched.id);
        setWhatsappPhone(matched.phone || vehicle.lostCardPhone || '');
      } else {
        setCustomerCardId('');
        setWhatsappPhone(vehicle.lostCardPhone || '');
      }
    }
  }, [vehicle?.id]);

  // Separate lightweight matcher if customerCards arrives asynchronously before user picks one
  useEffect(() => {
    if (!vehicle || customerCardId) return;
    const matched = customerCards.find(
      c =>
        (vehicle.customerCardId && c.id === vehicle.customerCardId) ||
        (c.cardNumber && c.cardNumber.toLowerCase() === vehicle.cardNumber.toLowerCase())
    );
    if (matched) {
      setCustomerCardId(matched.id);
      if (!whatsappPhone && matched.phone) {
        setWhatsappPhone(matched.phone);
      }
    }
  }, [customerCards, vehicle?.id, customerCardId]);

  const checkInMs = editedCheckIn ? new Date(editedCheckIn).getTime() : vehicle?.checkInTime || 0;
  const checkOutMs = editedCheckOut ? new Date(editedCheckOut).getTime() : now;
  const price = vehicle ? calculatePrice({ ...vehicle, checkInTime: checkInMs }, pricing, checkOutMs, hourlyEnabled) : 0;

  useEffect(() => {
    if (vehicle && (editedCheckIn || editedCheckOut)) {
      setCustomPrice(price.toFixed(2));
    }
  }, [editedCheckIn, editedCheckOut, hourlyEnabled]);

  // Generate PIX QR code when paymentMethod === 'pix' and enablePixQrCode is active
  useEffect(() => {
    let active = true;
    const buildPix = async () => {
      if (!vehicle || !deviceConfig?.enablePixQrCode || paymentMethod !== 'pix' || !pricing.pixKey) {
        setPixPayload('');
        setPixQrUrl('');
        return;
      }
      const amountNum = Math.max(0, parseFloat(customPrice) || 0);
      const payload = generatePixPayload({
        pixKey: pricing.pixKey,
        merchantName: pricing.pixMerchantName || 'BIKEPARK',
        merchantCity: pricing.pixMerchantCity || 'BRASIL',
        amount: amountNum,
        txid: `BP${vehicle.id}`
      });
      if (!active) return;
      setPixPayload(payload);
      if (payload) {
        const url = await generateQrDataUrl(payload, 200);
        if (active) setPixQrUrl(url);
      }
    };
    buildPix();
    return () => {
      active = false;
    };
  }, [vehicle?.id, paymentMethod, customPrice, pricing.pixKey, pricing.pixMerchantName, pricing.pixMerchantCity, deviceConfig?.enablePixQrCode]);

  if (!vehicle) return null;

  const selectedCard = customerCards.find(c => c.id === customerCardId);

  const getExpiryBadge = (card?: CustomerCard) => {
    if (!deviceConfig?.enableCardExpiryAlerts || !card?.expirationDate) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const exp = new Date(`${card.expirationDate}T00:00:00`);
    const diffDays = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) {
      return (
        <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-red-100 text-red-700 border border-red-200">
          Mensalidade vencida há {Math.abs(diffDays)}d
        </span>
      );
    }
    if (diffDays <= 7) {
      return (
        <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
          Vence em {diffDays === 0 ? 'hoje' : `${diffDays}d`}
        </span>
      );
    }
    return null;
  };

  const handleCopyPix = async () => {
    if (!pixPayload) return;
    try {
      await navigator.clipboard.writeText(pixPayload);
      setPixCopied(true);
      setTimeout(() => setPixCopied(false), 2000);
    } catch {
      // Fallback ignored
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl w-full max-w-md max-h-[92vh] overflow-y-auto animate-in fade-in zoom-in duration-200 border border-slate-100 dark:border-slate-800">
        <div className="flex items-center justify-between p-3 sm:p-4 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">Finalizar Estacionamento</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-500 dark:text-slate-400"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-3 sm:p-4 space-y-2">
          <div className="bg-slate-50 dark:bg-slate-800/70 p-2.5 sm:p-3 rounded-xl border border-slate-100 dark:border-slate-800">
            <div className="flex justify-between items-start mb-1">
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-xl leading-none">{vehicle.identifier}</h3>
              <span className="bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold px-2.5 py-1 rounded text-xs sm:text-sm">
                {vehicle.cardNumber.startsWith('SN') ? vehicle.cardNumber : `Cartão ${vehicle.cardNumber}`}
              </span>
            </div>
            <p className="text-base text-slate-500 dark:text-slate-400 mb-2">{vehicle.ownerName}</p>

            {/* Photo / Damage preview if present */}
            {(vehicle.photoData || vehicle.damageNotes) && (
              <div className="mb-2.5 p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 flex items-center gap-2.5">
                {vehicle.photoData && (
                  <img
                    src={vehicle.photoData}
                    alt="Foto entrada"
                    className="w-14 h-14 rounded-lg object-cover border border-amber-300 dark:border-amber-700 shrink-0"
                  />
                )}
                <div className="text-xs text-amber-900 dark:text-amber-200 min-w-0">
                  <div className="font-bold flex items-center gap-1">
                    <Camera className="w-3.5 h-3.5" /> Vistoria da Entrada
                  </div>
                  <p className="truncate">{vehicle.damageNotes || 'Foto registrada no check-in.'}</p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-1.5 mb-2 text-base bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
              <div>
                <span className="font-medium text-slate-500 dark:text-slate-400 block text-sm">Entrada</span>
                <input
                  type="datetime-local"
                  value={editedCheckIn}
                  disabled={deviceConfig?.canEditCheckoutTimes === false}
                  onChange={(e) => setEditedCheckIn(e.target.value)}
                  className={`font-bold text-slate-900 dark:text-slate-100 w-full outline-none bg-transparent border-b text-sm ${
                    deviceConfig?.canEditCheckoutTimes === false ? 'border-transparent cursor-not-allowed opacity-80' : 'border-transparent focus:border-indigo-300'
                  }`}
                />
              </div>
              <div>
                <span className="font-medium text-slate-500 dark:text-slate-400 block text-sm">Saída</span>
                <input
                  type="datetime-local"
                  value={editedCheckOut}
                  disabled={deviceConfig?.canEditCheckoutTimes === false}
                  onChange={(e) => setEditedCheckOut(e.target.value)}
                  className={`font-bold text-slate-900 dark:text-slate-100 w-full outline-none bg-transparent border-b text-sm ${
                    deviceConfig?.canEditCheckoutTimes === false ? 'border-transparent cursor-not-allowed opacity-80' : 'border-transparent focus:border-indigo-300'
                  }`}
                />
              </div>
              <div className="col-span-2 pt-1 border-t border-slate-50 dark:border-slate-800 flex justify-between items-center mt-1">
                <span className="font-medium text-slate-500 dark:text-slate-400 text-sm">Tempo:</span>
                <span className="font-bold text-slate-900 dark:text-slate-100 tabular-nums">{formatDuration(checkInMs, checkOutMs)}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              <div className="bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 flex flex-col justify-center">
                <span className="text-sm font-medium text-slate-500 dark:text-slate-400 flex items-center mb-0.5">
                  <Clock className="w-4 h-4 mr-1" /> Cobrado
                </span>
                <span className="font-bold text-slate-900 dark:text-slate-100 text-base sm:text-lg">
                  {getBilledBreakdown({ ...vehicle, checkInTime: checkInMs }, pricing, checkOutMs, hourlyEnabled).label}
                </span>
              </div>
              <div className="bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 flex flex-col justify-center">
                <span className="text-sm font-medium text-slate-500 dark:text-slate-400 flex items-center mb-0.5">
                  <DollarSign className="w-4 h-4 mr-1" /> Total (R$)
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  disabled={deviceConfig?.canEditCheckoutPrice === false}
                  value={customPrice}
                  onChange={(e) => setCustomPrice(e.target.value)}
                  className={`font-bold text-emerald-600 dark:text-emerald-400 text-xl leading-none w-full bg-transparent outline-none p-0 border-b transition-colors tabular-nums ${
                    deviceConfig?.canEditCheckoutPrice === false
                      ? 'border-transparent cursor-not-allowed select-none'
                      : 'border-emerald-200 dark:border-emerald-800 focus:border-emerald-500'
                  }`}
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
            <label className="block text-base font-semibold text-slate-700 dark:text-slate-200 tracking-tight">Método de Pagamento</label>
            <div className={`grid gap-1.5 ${deviceConfig?.enablePixQrCode ? 'grid-cols-3 sm:grid-cols-5' : 'grid-cols-2 sm:grid-cols-4'}`}>
              <button
                type="button"
                onClick={() => setPaymentMethod('cash')}
                className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl border-2 transition-all ${
                  paymentMethod === 'cash'
                    ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300'
                    : 'border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 text-slate-500 dark:text-slate-400'
                }`}
              >
                <Banknote className={`w-5 h-5 mb-1 ${paymentMethod === 'cash' ? 'text-amber-600 dark:text-amber-400' : ''}`} />
                <span className="text-xs font-medium">Dinheiro</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('machine')}
                className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl border-2 transition-all ${
                  paymentMethod === 'machine'
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300'
                    : 'border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 text-slate-500 dark:text-slate-400'
                }`}
              >
                <Terminal className={`w-5 h-5 mb-1 ${paymentMethod === 'machine' ? 'text-indigo-600 dark:text-indigo-400' : ''}`} />
                <span className="text-xs font-medium">Máquina</span>
              </button>

              {deviceConfig?.enablePixQrCode && (
                <button
                  type="button"
                  onClick={() => setPaymentMethod('pix')}
                  className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl border-2 transition-all ${
                    paymentMethod === 'pix'
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                      : 'border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 text-slate-500 dark:text-slate-400'
                  }`}
                >
                  <QrCode className={`w-5 h-5 mb-1 ${paymentMethod === 'pix' ? 'text-emerald-600 dark:text-emerald-400' : ''}`} />
                  <span className="text-xs font-medium">PIX</span>
                </button>
              )}

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
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300'
                    : 'border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 text-slate-500 dark:text-slate-400'
                }`}
              >
                <CreditCard className={`w-5 h-5 mb-1 ${paymentMethod === 'card' || paymentMethod === 'postpaid_card' ? 'text-indigo-600 dark:text-indigo-400' : ''}`} />
                <span className="text-xs font-medium text-center">Cartão</span>
              </button>

              {deviceConfig?.canAcceptFiado !== false && (
                <button
                  type="button"
                  onClick={() => setPaymentMethod('fiado')}
                  className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl border-2 transition-all ${
                    paymentMethod === 'fiado'
                      ? 'border-red-500 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300'
                      : 'border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 text-slate-500 dark:text-slate-400'
                  }`}
                >
                  <AlertTriangle className={`w-5 h-5 mb-1 ${paymentMethod === 'fiado' ? 'text-red-600 dark:text-red-400' : ''}`} />
                  <span className="text-xs font-medium text-center">Fiado</span>
                </button>
              )}
            </div>

            {deviceConfig?.canReportLostCard !== false && !vehicle.cardLost && !showLostForm && (
              <div className="pt-0.5 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowLostForm(true)}
                  className="text-xs text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40 py-1 px-2.5 rounded-lg border border-transparent hover:border-red-200 transition-all flex items-center gap-1 font-medium"
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Informar Cartão Físico Perdido
                </button>
              </div>
            )}
          </div>

          {/* Dynamic PIX QR Code Panel */}
          {deviceConfig?.enablePixQrCode && paymentMethod === 'pix' && (
            <div className="p-3.5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 space-y-2.5">
              {pricing.pixKey ? (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                      PIX Cobrança Instantânea
                    </span>
                    <span className="text-sm font-black text-emerald-700 dark:text-emerald-300 tabular-nums">
                      R$ {(parseFloat(customPrice) || 0).toFixed(2)}
                    </span>
                  </div>
                  {pixQrUrl && (
                    <div className="flex justify-center bg-white p-2.5 rounded-xl border border-emerald-100">
                      <img src={pixQrUrl} alt="QR Code PIX" className="w-40 h-40" />
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={handleCopyPix}
                    className="w-full py-2 px-3 bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-700 rounded-xl text-xs font-bold text-emerald-700 dark:text-emerald-300 flex items-center justify-center gap-1.5 hover:bg-emerald-50 transition-colors"
                  >
                    {pixCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {pixCopied ? 'Código PIX Copiado!' : 'Copiar PIX Copia e Cola'}
                  </button>
                </>
              ) : (
                <p className="text-xs text-amber-800 dark:text-amber-300 font-medium text-center py-1">
                  Cadastre sua Chave PIX em Configurações → Tarifas para gerar o QR Code dinâmico.
                </p>
              )}
            </div>
          )}

          {/* Lost Card Section */}
          {(vehicle.cardLost || showLostForm) && (
            <div className="pt-1">
              {vehicle.cardLost ? (
                <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl p-3 flex flex-col">
                  <div className="flex items-center text-red-600 dark:text-red-400 font-bold text-base mb-1">
                    <AlertTriangle className="w-4 h-4 mr-1" />
                    Cartão Marcado como Perdido
                  </div>
                  <div className="text-sm text-red-700 dark:text-red-300 leading-tight">
                    <span className="font-semibold">Nome:</span> {vehicle.lostCardName || 'Não informado'} <br />
                    <span className="font-semibold">Telefone:</span> {vehicle.lostCardPhone || 'Não informado'}
                  </div>
                </div>
              ) : (
                showLostForm && (
                  <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl p-3 space-y-2 mt-2">
                    <div className="flex items-center justify-between text-red-600 dark:text-red-400 font-bold text-base">
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
                      className="w-full px-3 py-2 text-base bg-white dark:bg-slate-900 border border-red-200 dark:border-red-800 rounded-lg focus:outline-none focus:border-red-400 text-slate-900 dark:text-slate-100"
                      value={lostName}
                      onChange={e => setLostName(e.target.value)}
                    />
                    <input
                      type="text"
                      placeholder="Telefone de contato"
                      className="w-full px-3 py-2 text-base bg-white dark:bg-slate-900 border border-red-200 dark:border-red-800 rounded-lg focus:outline-none focus:border-red-400 text-slate-900 dark:text-slate-100"
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
                )
              )}
            </div>
          )}

          <div className="pt-2">
            {(paymentMethod === 'card' || paymentMethod === 'postpaid_card') &&
              (selectedCard ? (
                <div className="mb-3 bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 flex justify-between items-center">
                  <div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase">Cartão Selecionado</span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          selectedCard.type === 'prepaid'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : 'bg-purple-100 text-purple-800 border border-purple-200'
                        }`}
                      >
                        {selectedCard.type === 'prepaid' ? 'Pré-Pago' : 'Pós-Pago'}
                      </span>
                      {getExpiryBadge(selectedCard)}
                    </div>
                    <div className="font-bold text-slate-900 dark:text-slate-100 text-base mt-0.5">
                      {selectedCard.cardNumber} - {selectedCard.ownerName}
                    </div>
                    {selectedCard.type === 'prepaid' ? (
                      <div className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5">
                        Crédito Disponível: R$ {(Number(selectedCard.balance) || 0).toFixed(2)}
                      </div>
                    ) : (
                      <div className="text-sm font-semibold text-purple-600 dark:text-purple-400 mt-0.5">
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
                    className="text-indigo-600 dark:text-indigo-300 hover:text-indigo-800 text-sm font-semibold px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 rounded-lg border border-indigo-200 dark:border-indigo-800 transition-colors"
                  >
                    Trocar
                  </button>
                </div>
              ) : (
                <div className="mb-3 bg-indigo-50/70 dark:bg-indigo-950/40 p-3 rounded-xl border border-indigo-200 dark:border-indigo-800 flex justify-between items-center">
                  <div className="text-xs text-indigo-900 dark:text-indigo-200 font-medium">
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
              ))}

            {/* Optional WhatsApp Receipt Bar */}
            {deviceConfig?.enableWhatsappReceipts && (
              <div className="mb-3 p-2.5 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/60 flex items-center gap-2">
                <input
                  type="tel"
                  value={whatsappPhone}
                  onChange={(e) => setWhatsappPhone(e.target.value)}
                  placeholder="WhatsApp (opcional)"
                  className="flex-1 min-w-0 px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100"
                />
                <button
                  type="button"
                  onClick={() => {
                    const text = buildCheckOutWhatsappText(
                      vehicle,
                      parseFloat(customPrice) || 0,
                      paymentMethod,
                      checkInMs,
                      checkOutMs
                    );
                    openWhatsappMessage(text, whatsappPhone);
                  }}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shrink-0 transition-colors"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  Enviar Recibo
                </button>
              </div>
            )}

            <button
              onClick={() =>
                onConfirm(vehicle.id, parseFloat(customPrice) || 0, paymentMethod, customerCardId, checkInMs, checkOutMs)
              }
              disabled={(paymentMethod === 'card' || paymentMethod === 'postpaid_card') && !customerCardId}
              className={`w-full py-3 sm:py-4 rounded-xl font-bold text-lg sm:text-xl transition-colors shadow-lg mt-1 ${
                (paymentMethod === 'card' || paymentMethod === 'postpaid_card') && !customerCardId
                  ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
                  : 'bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-700 text-white shadow-slate-900/20'
              }`}
            >
              Confirmar Pagamento
            </button>

            {deviceConfig?.canRevertCheckin !== false && onRevertCheckin && !revertIntent && (
              <button
                type="button"
                onClick={() => setRevertIntent(true)}
                className="w-full mt-3 py-2.5 bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-950/50 text-red-600 dark:text-red-400 rounded-xl font-medium transition-colors flex items-center justify-center border border-red-200 dark:border-red-900"
              >
                <AlertTriangle className="w-4 h-4 mr-2" />
                Estornar Entrada
              </button>
            )}

            {revertIntent && (
              <div className="mt-3 bg-red-50 dark:bg-red-950/30 p-3 rounded-xl border border-red-200 dark:border-red-900">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Senha do Admin para Estorno</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full p-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-red-500 mb-2"
                  placeholder="Digite a senha"
                />
                {passwordError && <p className="text-red-500 text-xs mb-2">{passwordError}</p>}
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      if (password === 'Admin') {
                        onRevertCheckin?.(vehicle.id);
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
                    className="flex-1 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-700 dark:text-slate-100 rounded-lg font-medium transition-colors"
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
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[85vh] animate-in fade-in zoom-in duration-150 border border-slate-200 dark:border-slate-800">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/60">
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center">
                <CreditCard className="w-5 h-5 mr-2 text-indigo-600 dark:text-indigo-400" />
                Selecionar Cartão Cliente
              </h2>
              <button
                onClick={() => setShowCardSelector(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 rounded-full transition-colors"
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

                const isExactCard =
                  cardNum === term || (termDigits.length > 0 && cardNum.replace(/^0+/, '') === termDigits.replace(/^0+/, ''));
                if (isExactCard) return true;
                if (owner.includes(term)) return true;
                if (termDigits.length >= 4 && phone.includes(termDigits)) return true;
                return false;
              });

              return (
                <>
                  <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
                    <div className="relative">
                      <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Digite o número exato do cartão ou nome..."
                        className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-base text-slate-900 dark:text-slate-100"
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

                  <div className="p-4 overflow-y-auto flex-1 space-y-2 bg-slate-50/50 dark:bg-slate-950/40">
                    {filtered.length === 0 ? (
                      <div className="text-center py-8 text-slate-500">
                        <CreditCard className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                        <p className="font-semibold text-slate-700 dark:text-slate-300">Nenhum cartão encontrado</p>
                        <p className="text-xs text-slate-400 mt-1">
                          Nenhum cartão com o número exato "{cardSearchTerm}" ou cliente correspondente.
                        </p>
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
                              if (c.phone) setWhatsappPhone(c.phone);
                              setShowCardSelector(false);
                            }}
                            className={`w-full text-left p-3.5 rounded-xl border-2 transition-all ${
                              isSelected
                                ? 'border-indigo-600 bg-indigo-50/80 dark:bg-indigo-950/50 shadow-sm'
                                : 'border-slate-200 dark:border-slate-800 hover:border-indigo-300 bg-white dark:bg-slate-900 shadow-xs'
                            }`}
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="font-bold text-slate-900 dark:text-slate-100 text-base">{c.cardNumber}</span>
                                  <span
                                    className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                                      isPrepaid
                                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                        : 'bg-purple-100 text-purple-800 border border-purple-200'
                                    }`}
                                  >
                                    {isPrepaid ? 'Pré-Pago' : 'Pós-Pago'}
                                  </span>
                                  {getExpiryBadge(c)}
                                </div>
                                <div className="text-sm font-semibold text-slate-700 dark:text-slate-300 mt-1">{c.ownerName}</div>
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