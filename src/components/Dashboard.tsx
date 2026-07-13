import React, { useState } from 'react';
import { Bike, Zap, Motorbike, DollarSign, Clock, Users, ShoppingCart, Package, Printer } from 'lucide-react';
import { ParkedVehicle, Pricing, LostCard, Product, Sale } from '../types';
import { SaleModal } from './SaleModal';
import { generateThermalPrintHtml, printHtml } from '../utils/printHelper';

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
  const occupyingVehicles = vehicles.filter(v => v.status === 'active' || v.status === 'stored');
  
  const handlePrintConference = () => {
    const allActive = vehicles.filter(v => v.status === 'active' || v.status === 'stored');
    
    const activeVehicles = vehicles.filter(v => v.status === 'active');
    const storedVehicles = vehicles.filter(v => v.status === 'stored');
    
    const bikes = activeVehicles.filter(v => v.type === 'bicycle');
    const ebikes = activeVehicles.filter(v => v.type === 'ebike');
    const motos = activeVehicles.filter(v => v.type === 'motorcycle');
    
    const storedBikes = storedVehicles.filter(v => v.type === 'bicycle');
    const storedEbikes = storedVehicles.filter(v => v.type === 'ebike');
    const storedMotos = storedVehicles.filter(v => v.type === 'motorcycle');

    const renderCategory = (title: string, items: any[]) => {
      if (items.length === 0) return '';
      return `
        <div class="section" style="margin-bottom: 15px;">
          <h2 style="font-size: 11pt; margin-bottom: 8px;">${title} (${items.length})</h2>
          <div style="display: flex; flex-wrap: wrap; gap: 8px;">
            ${items.map(v => `
              <div style="border: 1px solid #000; padding: 4px 8px; border-radius: 4px; font-weight: bold; font-size: 11pt; display: flex; align-items: center; gap: 8px; ${v.status === 'stored' ? 'background-color: #000 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; color: #fff !important; border: 2px dashed #000;' : ''}">
                <span>${v.status === 'stored' ? 'DEPÓSITO #' : '#'}${v.cardNumber}</span>
                <span style="border: 1px solid #000; width: 14px; height: 14px; display: inline-block;"></span>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    };

    const bodyHtml = `
      <h1>Conferência de Pátio</h1>
      <div class="subtitle" style="margin-bottom: 15px;">${new Date().toLocaleString('pt-BR')}</div>
      ${renderCategory('Bikes', bikes)}
      ${renderCategory('E-Bikes', ebikes)}
      ${renderCategory('Motos', motos)}
      ${storedBikes.length > 0 ? renderCategory('Bikes em Depósito', storedBikes) : ''}
      ${storedEbikes.length > 0 ? renderCategory('E-Bikes em Depósito', storedEbikes) : ''}
      ${storedMotos.length > 0 ? renderCategory('Motos em Depósito', storedMotos) : ''}
      <div class="section" style="text-align: center; margin-top: 10px; border-top: 1px dashed #000; padding-top: 10px;">
        <h2>Total Geral: ${allActive.length}</h2>
      </div>
      <div class="footer">
        <p>Bikepark - Conferência</p>
      </div>
    `;
    
    const html = generateThermalPrintHtml('Conferência de Pátio', bodyHtml);
    printHtml(html);
  };
  
  const typeCount = {
    bicycle: activeVehicles.filter(v => v.type === 'bicycle').length,
    ebike: activeVehicles.filter(v => v.type === 'ebike').length,
    motorcycle: activeVehicles.filter(v => v.type === 'motorcycle').length,
  };

  const storedCount = {
    bicycle: storedVehicles.filter(v => v.type === 'bicycle').length,
    ebike: storedVehicles.filter(v => v.type === 'ebike').length,
    motorcycle: storedVehicles.filter(v => v.type === 'motorcycle').length,
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-2">
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-0 border-b-0 pb-0">Veículos no Pátio (Ativos)</h3>
                <button
                  onClick={handlePrintConference}
                  className="text-slate-500 hover:text-slate-700 p-1"
                  title="Imprimir Conferência de Pátio"
                >
                  <Printer className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                  <div className="flex items-center space-x-3">
                    <div className="bg-blue-100 p-2 rounded-lg">
                      <Bike className="w-5 h-5 text-blue-600" />
                    </div>
                    <span className="font-medium text-slate-700">Bicicletas</span>
                  </div>
                  <span className="text-xl font-bold text-slate-900">{typeCount.bicycle}</span>
                </div>
                
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                  <div className="flex items-center space-x-3">
                    <div className="bg-emerald-100 p-2 rounded-lg">
                      <Zap className="w-5 h-5 text-emerald-600" />
                    </div>
                    <span className="font-medium text-slate-700">Bikes Elétricas</span>
                  </div>
                  <span className="text-xl font-bold text-slate-900">{typeCount.ebike}</span>
                </div>
                
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
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

            {storedVehicles.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">Veículos em Depósito</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl opacity-80">
                    <div className="flex items-center space-x-3">
                      <div className="bg-slate-200 p-2 rounded-lg">
                        <Bike className="w-5 h-5 text-slate-500" />
                      </div>
                      <span className="font-medium text-slate-700">Bicicletas</span>
                    </div>
                    <span className="text-xl font-bold text-slate-700">{storedCount.bicycle}</span>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl opacity-80">
                    <div className="flex items-center space-x-3">
                      <div className="bg-slate-200 p-2 rounded-lg">
                        <Zap className="w-5 h-5 text-slate-500" />
                      </div>
                      <span className="font-medium text-slate-700">Bikes Elétricas</span>
                    </div>
                    <span className="text-xl font-bold text-slate-700">{storedCount.ebike}</span>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl opacity-80">
                    <div className="flex items-center space-x-3">
                      <div className="bg-slate-200 p-2 rounded-lg">
                        <Motorbike className="w-5 h-5 text-slate-500" />
                      </div>
                      <span className="font-medium text-slate-700">Motos</span>
                    </div>
                    <span className="text-xl font-bold text-slate-700">{storedCount.motorcycle}</span>
                  </div>
                </div>
              </div>
            )}
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
