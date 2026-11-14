import React, { useState } from 'react';
import {
  Bike,
  Zap,
  Motorbike,
  ShoppingCart,
  Package,
  Printer,
  AlertTriangle,
  TrendingUp,
  CreditCard,
  Clock
} from 'lucide-react';
import { ParkedVehicle, Pricing, LostCard, Product, Sale, CustomerCard } from '../types';
import { SaleModal } from './SaleModal';
import { generateThermalPrintHtml, printHtml } from '../utils/printHelper';
import { SpotsGrid } from './SpotsGrid';
import { DeviceFeaturesConfig } from '../lib/deviceModules';

export interface DashboardProps {
  vehicles: ParkedVehicle[];
  pricing: Pricing;
  lostCards?: LostCard[];
  products?: Product[];
  customerCards?: CustomerCard[];
  deviceConfig?: DeviceFeaturesConfig;
  activeOperator?: string;
  onAddSale?: (sale: Omit<Sale, 'id'>) => void;
  onSpotClick?: (spotNumber: string, occupiedVehicle?: ParkedVehicle) => void;
  onNavigate?: (tab: string) => void;
}

export function Dashboard({
  vehicles,
  pricing,
  lostCards,
  products = [],
  customerCards = [],
  deviceConfig,
  activeOperator,
  onAddSale,
  onSpotClick,
  onNavigate
}: DashboardProps) {
  const [saleProduct, setSaleProduct] = useState<Product | null>(null);

  const activeVehicles = vehicles.filter(v => v.status === 'active');
  const storedVehicles = vehicles.filter(v => v.status === 'stored');
  const totalOccupied = activeVehicles.length + storedVehicles.length;
  const totalSpots = pricing.totalSpots || 300;
  const occupancyPct = totalSpots > 0 ? Math.round((totalOccupied / totalSpots) * 100) : 0;

  const canSellProducts = deviceConfig?.canSellProducts !== false;

  // Smart Alerts calculations (only rendered when enableSmartAlerts === true)
  const lowStockProducts = products.filter(p => p.stock <= 3);
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  const overdueFiados = vehicles.filter(
    v =>
      v.status === 'completed' &&
      v.paymentMethod === 'fiado' &&
      !v.isFiadoPaid &&
      v.checkOutTime &&
      Date.now() - v.checkOutTime > sevenDaysMs
  );
  const expiredOrSoonCards = customerCards.filter(c => {
    if (!c.expirationDate) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const exp = new Date(`${c.expirationDate}T00:00:00`);
    const diffDays = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays <= 7;
  });

  const hasSmartAlerts =
    deviceConfig?.enableSmartAlerts &&
    (lowStockProducts.length > 0 ||
      overdueFiados.length > 0 ||
      occupancyPct >= 85 ||
      expiredOrSoonCards.length > 0);

  const handlePrintConference = () => {
    const allActive = vehicles.filter(v => v.status === 'active' || v.status === 'stored');
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
            ${items
              .map(
                v => `
              <div style="border: 1px solid #000; padding: 4px 8px; border-radius: 4px; font-weight: bold; font-size: 11pt; display: flex; align-items: center; gap: 8px; ${
                v.status === 'stored'
                  ? 'background-color: #000 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; color: #fff !important; border: 2px dashed #000;'
                  : ''
              }">
                <span>${v.status === 'stored' ? 'DEPÓSITO #' : '#'}${v.cardNumber}</span>
                <span style="border: 1px solid #000; width: 14px; height: 14px; display: inline-block;"></span>
              </div>
            `
              )
              .join('')}
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
    motorcycle: activeVehicles.filter(v => v.type === 'motorcycle').length
  };

  const storedCount = {
    bicycle: storedVehicles.filter(v => v.type === 'bicycle').length,
    ebike: storedVehicles.filter(v => v.type === 'ebike').length,
    motorcycle: storedVehicles.filter(v => v.type === 'motorcycle').length
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Visão Geral</h1>
        <div className="text-sm text-slate-500 dark:text-slate-400 capitalize">
          {new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </div>

      {hasSmartAlerts && (
        <div className="bg-amber-50/90 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-2xl p-4 space-y-2.5">
          <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200 font-bold text-sm">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span>Alertas Inteligentes do Pátio</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {occupancyPct >= 85 && (
              <div className="bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800/70 rounded-xl p-3 flex items-center gap-2.5">
                <TrendingUp className="w-4 h-4 text-red-500 shrink-0" />
                <div className="text-xs">
                  <p className="font-bold text-slate-900 dark:text-slate-100">Lotação em {occupancyPct}%</p>
                  <p className="text-slate-500 dark:text-slate-400">
                    {totalOccupied} de {totalSpots} vagas ocupadas
                  </p>
                </div>
              </div>
            )}
            {lowStockProducts.length > 0 && (
              <button
                type="button"
                onClick={() => onNavigate?.('store')}
                className="text-left bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800/70 hover:border-amber-400 rounded-xl p-3 flex items-center gap-2.5 transition-colors"
              >
                <Package className="w-4 h-4 text-amber-600 shrink-0" />
                <div className="text-xs">
                  <p className="font-bold text-slate-900 dark:text-slate-100">{lowStockProducts.length} item(ns) com estoque baixo</p>
                  <p className="text-slate-500 dark:text-slate-400 truncate max-w-[180px]">
                    {lowStockProducts.map(p => `${p.name} (${p.stock})`).join(', ')}
                  </p>
                </div>
              </button>
            )}
            {overdueFiados.length > 0 && (
              <button
                type="button"
                onClick={() => onNavigate?.('cashbook')}
                className="text-left bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800/70 hover:border-amber-400 rounded-xl p-3 flex items-center gap-2.5 transition-colors"
              >
                <Clock className="w-4 h-4 text-orange-600 shrink-0" />
                <div className="text-xs">
                  <p className="font-bold text-slate-900 dark:text-slate-100">{overdueFiados.length} fiado(s) +7 dias</p>
                  <p className="text-slate-500 dark:text-slate-400">Clique para abrir Livro Caixa</p>
                </div>
              </button>
            )}
            {expiredOrSoonCards.length > 0 && (
              <button
                type="button"
                onClick={() => onNavigate?.('cards')}
                className="text-left bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800/70 hover:border-amber-400 rounded-xl p-3 flex items-center gap-2.5 transition-colors"
              >
                <CreditCard className="w-4 h-4 text-blue-600 shrink-0" />
                <div className="text-xs">
                  <p className="font-bold text-slate-900 dark:text-slate-100">{expiredOrSoonCards.length} mensalista(s) vencendo</p>
                  <p className="text-slate-500 dark:text-slate-400">Clique para verificar cartões</p>
                </div>
              </button>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 lg:col-span-3">
          <SpotsGrid
            vehicles={vehicles}
            pricing={pricing}
            lostCards={lostCards}
            deviceConfig={deviceConfig}
            onSpotClick={onSpotClick}
            hideTitle={true}
          />
        </div>
      </div>

      {products && products.length > 0 && canSellProducts && (
        <div className="mb-0">
          <div className="flex items-center space-x-3 mb-6">
            <div className="bg-blue-100 dark:bg-blue-950/60 p-2 rounded-xl">
              <ShoppingCart className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Lojinha</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {products.map(product => (
              <button
                key={product.id}
                onClick={() => setSaleProduct(product)}
                disabled={product.stock === 0}
                className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all hover:shadow-md relative ${
                  product.stock === 0
                    ? 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 opacity-60 cursor-not-allowed'
                    : 'bg-white dark:bg-slate-900 border-blue-100 dark:border-slate-800 hover:border-blue-300'
                }`}
              >
                <div className="text-slate-700 dark:text-slate-200 mb-2">
                  <Package className={`w-8 h-8 ${product.stock === 0 ? 'text-slate-400' : 'text-blue-500'}`} />
                </div>
                <span className="font-medium text-slate-900 dark:text-slate-100 text-sm truncate w-full text-center">
                  {product.name}
                </span>
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-1 truncate w-full text-center tabular-nums">
                  R$ {product.price.toFixed(2)}
                </span>
                <div
                  className={`absolute top-2 right-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full tabular-nums ${
                    product.stock > 10
                      ? 'bg-emerald-100 text-emerald-700'
                      : product.stock > 0
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-red-100 text-red-700'
                  }`}
                >
                  {product.stock}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 lg:col-span-2">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">Ocupação por Tipo</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-slate-800 pb-2">
                <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-0 border-b-0 pb-0">
                  Veículos no Pátio (Ativos)
                </h3>
                <button
                  onClick={handlePrintConference}
                  className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 p-1"
                  title="Imprimir Conferência de Pátio"
                >
                  <Printer className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/70 rounded-xl">
                  <div className="flex items-center space-x-3">
                    <div className="bg-blue-100 dark:bg-blue-950/60 p-2 rounded-lg">
                      <Bike className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <span className="font-medium text-slate-700 dark:text-slate-200">Bicicletas</span>
                  </div>
                  <span className="text-xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">{typeCount.bicycle}</span>
                </div>

                <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/70 rounded-xl">
                  <div className="flex items-center space-x-3">
                    <div className="bg-emerald-100 dark:bg-emerald-950/60 p-2 rounded-lg">
                      <Zap className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <span className="font-medium text-slate-700 dark:text-slate-200">Bikes Elétricas</span>
                  </div>
                  <span className="text-xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">{typeCount.ebike}</span>
                </div>

                <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/70 rounded-xl">
                  <div className="flex items-center space-x-3">
                    <div className="bg-purple-100 dark:bg-purple-950/60 p-2 rounded-lg">
                      <Motorbike className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <span className="font-medium text-slate-700 dark:text-slate-200">Motos</span>
                  </div>
                  <span className="text-xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">{typeCount.motorcycle}</span>
                </div>
              </div>
            </div>

            {storedVehicles.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4 border-b border-slate-100 dark:border-slate-800 pb-2">
                  Veículos em Depósito
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/70 rounded-xl opacity-80">
                    <div className="flex items-center space-x-3">
                      <div className="bg-slate-200 dark:bg-slate-700 p-2 rounded-lg">
                        <Bike className="w-5 h-5 text-slate-500 dark:text-slate-300" />
                      </div>
                      <span className="font-medium text-slate-700 dark:text-slate-200">Bicicletas</span>
                    </div>
                    <span className="text-xl font-bold text-slate-700 dark:text-slate-200 tabular-nums">{storedCount.bicycle}</span>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/70 rounded-xl opacity-80">
                    <div className="flex items-center space-x-3">
                      <div className="bg-slate-200 dark:bg-slate-700 p-2 rounded-lg">
                        <Zap className="w-5 h-5 text-slate-500 dark:text-slate-300" />
                      </div>
                      <span className="font-medium text-slate-700 dark:text-slate-200">Bikes Elétricas</span>
                    </div>
                    <span className="text-xl font-bold text-slate-700 dark:text-slate-200 tabular-nums">{storedCount.ebike}</span>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/70 rounded-xl opacity-80">
                    <div className="flex items-center space-x-3">
                      <div className="bg-slate-200 dark:bg-slate-700 p-2 rounded-lg">
                        <Motorbike className="w-5 h-5 text-slate-500 dark:text-slate-300" />
                      </div>
                      <span className="font-medium text-slate-700 dark:text-slate-200">Motos</span>
                    </div>
                    <span className="text-xl font-bold text-slate-700 dark:text-slate-200 tabular-nums">{storedCount.motorcycle}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">Tabela de Preços (Valor Único / Diária)</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <span className="text-slate-600 dark:text-slate-400">Bicicleta</span>
              <span className="font-bold text-slate-900 dark:text-slate-100 tabular-nums">R$ {pricing.bicycle.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <span className="text-slate-600 dark:text-slate-400">Bicicleta Elétrica</span>
              <span className="font-bold text-slate-900 dark:text-slate-100 tabular-nums">R$ {pricing.ebike.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between pb-3">
              <span className="text-slate-600 dark:text-slate-400">Moto</span>
              <span className="font-bold text-slate-900 dark:text-slate-100 tabular-nums">R$ {pricing.motorcycle.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {saleProduct && onAddSale && (
        <SaleModal
          product={saleProduct}
          pricing={pricing}
          deviceConfig={deviceConfig}
          onClose={() => setSaleProduct(null)}
          onConfirm={(quantity, paymentMethod) => {
            onAddSale({
              productId: saleProduct.id,
              productName: saleProduct.name,
              quantity,
              totalPrice: quantity * saleProduct.price,
              date: Date.now(),
              paymentMethod,
              ...(deviceConfig?.enableOperatorLogin && activeOperator ? { operatorName: activeOperator } : {})
            });
            setSaleProduct(null);
          }}
        />
      )}
    </div>
  );
}
