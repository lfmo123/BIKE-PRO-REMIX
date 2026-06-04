import React, { useState } from 'react';
import { X, ShoppingCart, Terminal, Smartphone, Banknote } from 'lucide-react';
import { Product } from '../types';

interface SaleModalProps {
  product: Product;
  onClose: () => void;
  onConfirm: (quantity: number, paymentMethod: 'machine' | 'cash') => void;
}

export function SaleModal({ product, onClose, onConfirm }: SaleModalProps) {
  const [quantity, setQuantity] = useState('1');
  const [paymentMethod, setPaymentMethod] = useState<'machine' | 'cash'>('machine');

  const handleConfirm = () => {
    const qty = parseInt(quantity, 10);
    if (qty > 0 && qty <= product.stock) {
      onConfirm(qty, paymentMethod);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden relative" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-6 pb-0">
          <div className="flex items-center space-x-3 mb-6">
            <div className="bg-blue-100 p-3 rounded-2xl">
              <ShoppingCart className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Vender Produto</h2>
              <p className="text-slate-500 text-sm">Confirme a quantidade e o pagamento</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex justify-between items-center">
            <div>
              <p className="font-bold text-slate-900 text-lg">{product.name}</p>
              <p className="text-sm text-slate-500">Estoque atual: <span className="font-bold text-slate-700">{product.stock}</span></p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500">Valor un.</p>
              <p className="font-bold text-emerald-600">R$ {product.price.toFixed(2)}</p>
            </div>
          </div>

          <div className="space-y-3">
            <label className="block text-sm font-medium text-slate-700">Quantidade</label>
            <input
              type="number"
              min="1"
              max={product.stock}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 font-medium text-lg"
              required
            />
          </div>

          <div className="space-y-3">
            <label className="block text-sm font-medium text-slate-700">Método de Pagamento</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPaymentMethod('machine')}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${
                  paymentMethod === 'machine' 
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700' 
                    : 'border-slate-100 hover:border-slate-200 text-slate-500'
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
                    ? 'border-amber-500 bg-amber-50 text-amber-700' 
                    : 'border-slate-100 hover:border-slate-200 text-slate-500'
                }`}
              >
                <Banknote className={`w-5 h-5 mb-1 ${paymentMethod === 'cash' ? 'text-amber-600' : ''}`} />
                <span className="text-xs font-medium">Dinheiro</span>
              </button>
            </div>
          </div>
          
          <div className="bg-slate-50 p-4 border-t border-slate-100 flex justify-between items-center rounded-2xl">
            <span className="text-slate-500 font-medium">Total da Venda</span>
            <span className="text-2xl font-black text-slate-900">
              R$ {((parseInt(quantity, 10) || 0) * product.price).toFixed(2)}
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
