import React, { useState, useEffect } from 'react';
import { X, ShoppingCart, Terminal, Banknote, QrCode, Copy, Check } from 'lucide-react';
import { Product, Pricing } from '../types';
import { DeviceFeaturesConfig } from '../lib/deviceModules';
import { generatePixPayload, generateQrDataUrl } from '../lib/pixUtils';

interface SaleModalProps {
  product: Product;
  pricing?: Pricing;
  deviceConfig?: DeviceFeaturesConfig;
  onClose: () => void;
  onConfirm: (quantity: number, paymentMethod: 'machine' | 'cash' | 'pix') => void;
}

export function SaleModal({ product, pricing, deviceConfig, onClose, onConfirm }: SaleModalProps) {
  const [quantity, setQuantity] = useState('1');
  const [paymentMethod, setPaymentMethod] = useState<'machine' | 'cash' | 'pix'>('machine');
  const [pixQrUrl, setPixQrUrl] = useState('');
  const [pixPayload, setPixPayload] = useState('');
  const [pixCopied, setPixCopied] = useState(false);

  const qtyNum = parseInt(quantity, 10) || 0;
  const totalSale = qtyNum * product.price;
  const pixEnabled = Boolean(deviceConfig?.enablePixQrCode);

  useEffect(() => {
    let active = true;
    const buildPix = async () => {
      if (!pixEnabled || paymentMethod !== 'pix' || !pricing?.pixKey || totalSale <= 0) {
        setPixPayload('');
        setPixQrUrl('');
        return;
      }
      const payload = generatePixPayload({
        pixKey: pricing.pixKey,
        merchantName: pricing.pixMerchantName || 'BIKEPARK',
        merchantCity: pricing.pixMerchantCity || 'BRASIL',
        amount: totalSale,
        txid: `LOJA${product.id}`
      });
      if (!active) return;
      setPixPayload(payload);
      if (payload) {
        const url = await generateQrDataUrl(payload, 170);
        if (active) setPixQrUrl(url);
      }
    };
    buildPix();
    return () => {
      active = false;
    };
  }, [pixEnabled, paymentMethod, totalSale, pricing?.pixKey, pricing?.pixMerchantName, pricing?.pixMerchantCity, product.id]);

  const handleConfirm = () => {
    const qty = parseInt(quantity, 10);
    if (qty > 0 && qty <= product.stock) {
      onConfirm(qty, paymentMethod);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div
        className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md max-h-[92vh] overflow-y-auto relative border border-slate-100 dark:border-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-6 pb-0">
          <div className="flex items-center space-x-3 mb-6">
            <div className="bg-blue-100 dark:bg-blue-900/40 p-3 rounded-2xl">
              <ShoppingCart className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Vender Produto</h2>
              <p className="text-slate-500 dark:text-slate-400 text-sm">Confirme a quantidade e o pagamento</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-5">
          <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 flex justify-between items-center">
            <div>
              <p className="font-bold text-slate-900 dark:text-slate-100 text-lg">{product.name}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Estoque atual: <span className="font-bold text-slate-700 dark:text-slate-200">{product.stock}</span>
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500 dark:text-slate-400">Valor un.</p>
              <p className="font-bold text-emerald-600 dark:text-emerald-400">R$ {product.price.toFixed(2)}</p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Quantidade</label>
            <input
              type="number"
              min="1"
              max={product.stock}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 font-medium text-lg text-slate-900 dark:text-slate-100"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Método de Pagamento</label>
            <div className={`grid gap-2 ${pixEnabled ? 'grid-cols-3' : 'grid-cols-2'}`}>
              <button
                type="button"
                onClick={() => setPaymentMethod('machine')}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${
                  paymentMethod === 'machine'
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300'
                    : 'border-slate-100 dark:border-slate-800 hover:border-slate-200 text-slate-500 dark:text-slate-400'
                }`}
              >
                <Terminal className={`w-5 h-5 mb-1 ${paymentMethod === 'machine' ? 'text-indigo-600' : ''}`} />
                <span className="text-xs font-medium">Máquina</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('cash')}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${
                  paymentMethod === 'cash'
                    ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300'
                    : 'border-slate-100 dark:border-slate-800 hover:border-slate-200 text-slate-500 dark:text-slate-400'
                }`}
              >
                <Banknote className={`w-5 h-5 mb-1 ${paymentMethod === 'cash' ? 'text-amber-600' : ''}`} />
                <span className="text-xs font-medium">Dinheiro</span>
              </button>

              {pixEnabled && (
                <button
                  type="button"
                  onClick={() => setPaymentMethod('pix')}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${
                    paymentMethod === 'pix'
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                      : 'border-slate-100 dark:border-slate-800 hover:border-slate-200 text-slate-500 dark:text-slate-400'
                  }`}
                >
                  <QrCode className={`w-5 h-5 mb-1 ${paymentMethod === 'pix' ? 'text-emerald-600' : ''}`} />
                  <span className="text-xs font-medium">PIX</span>
                </button>
              )}
            </div>
          </div>

          {pixEnabled && paymentMethod === 'pix' && (
            <div className="p-3 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 space-y-2">
              {pricing?.pixKey ? (
                <>
                  {pixQrUrl && (
                    <div className="flex justify-center bg-white p-2 rounded-xl border border-emerald-100">
                      <img src={pixQrUrl} alt="QR Code PIX" className="w-36 h-36" />
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={async () => {
                      if (!pixPayload) return;
                      await navigator.clipboard.writeText(pixPayload).catch(() => {});
                      setPixCopied(true);
                      setTimeout(() => setPixCopied(false), 2000);
                    }}
                    className="w-full py-2 bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-700 rounded-xl text-xs font-bold text-emerald-700 dark:text-emerald-300 flex items-center justify-center gap-1.5"
                  >
                    {pixCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {pixCopied ? 'Copiado!' : 'Copiar PIX Copia e Cola'}
                  </button>
                </>
              ) : (
                <p className="text-xs text-amber-700 dark:text-amber-300 font-medium text-center">
                  Configure sua Chave PIX em Configurações → Tarifas para gerar o QR Code.
                </p>
              )}
            </div>
          )}

          <div className="bg-slate-50 dark:bg-slate-800 p-4 border-t border-slate-100 dark:border-slate-700 flex justify-between items-center rounded-2xl">
            <span className="text-slate-500 dark:text-slate-400 font-medium">Total da Venda</span>
            <span className="text-2xl font-black text-slate-900 dark:text-slate-100 tabular-nums">
              R$ {totalSale.toFixed(2)}
            </span>
          </div>
        </div>

        <div className="p-6 pt-0">
          <button
            onClick={handleConfirm}
            disabled={!quantity || parseInt(quantity, 10) < 1 || parseInt(quantity, 10) > product.stock}
            className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-lg transition-colors shadow-lg shadow-blue-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Confirmar Venda
          </button>
        </div>
      </div>
    </div>
  );
}
