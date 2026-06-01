import React, { useState } from 'react';
import { Bike, Zap, Motorbike, DollarSign, Clock, Users, ShoppingCart, Package } from 'lucide-react';
import { ParkedVehicle, Pricing, LostCard, Product, Sale } from '../types';
import { SaleModal } from './SaleModal';

export interface DashboardProps {
  vehicles: ParkedVehicle[];
  pricing: Pricing;
  lostCards?: LostCard[];
  products?: Product[];
  onAddSale?: (sale: Omit<Sale, 'id'>) => void;
  onSpotClick?: (spotNumber: string, occupiedVehicle?: ParkedVehicle) => void;
}

import { SpotsGrid } from './SpotsGrid';

export function Dashboard({ vehicles, pricing, lostCards, products = [], onAddSale, onSpotClick }: DashboardProps) {
  const [saleProduct, setSaleProduct] = useState<Product | null>(null);

  const activeVehicles = vehicles.filter(v => v.status === 'active');
  const storedVehicles = vehicles.filter(v => v.status === 'stored');
  
  const typeCount = {
    bicycle: activeVehicles.filter(v => v.type === 'bicycle').length,
    ebike: activeVehicles.filter(v => v.type === 'ebike').length,
    motorcycle: activeVehicles.filter(v => v.type === 'motorcycle').length,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-slate-900">Visão Geral</h1>
        <div className="text-sm text-slate-500 capitalize">
          {new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 lg:col-span-3">
          <SpotsGrid vehicles={vehicles} pricing={pricing} lostCards={lostCards} onSpotClick={onSpotClick} hideTitle={true} />
        </div>
      </div>

      {products && products.length > 0 && (
        <div className="mb-0">
          <div className="flex items-center space-x-3 mb-6">
            <div className="bg-blue-100 p-2 rounded-xl">
              <ShoppingCart className="w-6 h-6 text-blue-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">Lojinha</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {products.map(product => (
              <button
                key={product.id}
                onClick={() => setSaleProduct(product)}
                disabled={product.stock === 0}
                className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all hover:shadow-md relative ${
                  product.stock === 0 ? 'bg-slate-50 border-slate-200 opacity-60 cursor-not-allowed' : 'bg-white border-blue-100 hover:border-blue-300'
                }`}
              >
                <div className="text-slate-700 mb-2">
                  <Package className={`w-8 h-8 ${product.stock === 0 ? 'text-slate-400' : 'text-blue-500'}`} />
                </div>
                <span className="font-medium text-slate-900 text-sm truncate w-full text-center">
                  {product.name}
                </span>
                <span className="text-xs font-bold text-emerald-600 mt-1 truncate w-full text-center">
                  R$ {product.price.toFixed(2)}
                </span>
                <div className={`absolute top-2 right-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  product.stock > 10 ? 'bg-emerald-100 text-emerald-700' :
                  product.stock > 0 ? 'bg-amber-100 text-amber-700' :
                  'bg-red-100 text-red-700'
                }`}>
                  {product.stock}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 lg:col-span-2">
          <h2 className="text-lg font-bold text-slate-900 mb-4">Ocupação por Tipo</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
              <div className="flex items-center space-x-3">
                <div className="bg-blue-100 p-2 rounded-lg">
                  <Bike className="w-5 h-5 text-blue-600" />
                </div>
                <span className="font-medium text-slate-700">Bicicletas</span>
              </div>
              <span className="text-xl font-bold text-slate-900">{typeCount.bicycle}</span>
            </div>
            
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
              <div className="flex items-center space-x-3">
                <div className="bg-emerald-100 p-2 rounded-lg">
                  <Zap className="w-5 h-5 text-emerald-600" />
                </div>
                <span className="font-medium text-slate-700">Bicicletas Elétricas</span>
              </div>
              <span className="text-xl font-bold text-slate-900">{typeCount.ebike}</span>
            </div>
            
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
              <div className="flex items-center space-x-3">
                <div className="bg-purple-100 p-2 rounded-lg">
                  <Motorbike className="w-5 h-5 text-purple-600" />
                </div>
                <span className="font-medium text-slate-700">Motos</span>
              </div>
              <span className="text-xl font-bold text-slate-900">{typeCount.motorcycle}</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h2 className="text-lg font-bold text-slate-900 mb-4">Tabela de Preços (Valor Único / Diária)</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="text-slate-600">Bicicleta</span>
              <span className="font-bold text-slate-900">R$ {pricing.bicycle.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="text-slate-600">Bicicleta Elétrica</span>
              <span className="font-bold text-slate-900">R$ {pricing.ebike.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between pb-3">
              <span className="text-slate-600">Moto</span>
              <span className="font-bold text-slate-900">R$ {pricing.motorcycle.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {saleProduct && onAddSale && (
        <SaleModal
          product={saleProduct}
          onClose={() => setSaleProduct(null)}
          onConfirm={(quantity, paymentMethod) => {
            onAddSale({
              productId: saleProduct.id,
              productName: saleProduct.name,
              quantity,
              totalPrice: quantity * saleProduct.price,
              date: Date.now(),
              paymentMethod
            });
            setSaleProduct(null);
          }}
        />
      )}
    </div>
  );
}
