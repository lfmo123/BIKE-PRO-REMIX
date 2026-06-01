import React from 'react';
import { Bike, Zap, Motorbike, DollarSign, Clock, Users } from 'lucide-react';
import { ParkedVehicle, Pricing, LostCard } from '../types';

export interface DashboardProps {
  vehicles: ParkedVehicle[];
  pricing: Pricing;
  lostCards?: LostCard[];
  onSpotClick?: (spotNumber: number, occupiedVehicle?: ParkedVehicle) => void;
}

import { SpotsGrid } from './SpotsGrid';

export function Dashboard({ vehicles, pricing, lostCards, onSpotClick }: DashboardProps) {
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
    </div>
  );
}
