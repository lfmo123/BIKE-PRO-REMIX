import React from 'react';
import { Bike, Zap, Motorbike, DollarSign, Clock, Users } from 'lucide-react';
import { ParkedVehicle, Pricing } from '../types';

export interface DashboardProps {
  vehicles: ParkedVehicle[];
  pricing: Pricing;
  onSpotClick?: (spotNumber: number, occupiedVehicle?: ParkedVehicle) => void;
}

import { SpotsGrid } from './SpotsGrid';

export function Dashboard({ vehicles, pricing, onSpotClick }: DashboardProps) {
  const activeVehicles = vehicles.filter(v => v.status === 'active');
  const completedVehicles = vehicles.filter(v => v.status === 'completed');
  
  const today = new Date().setHours(0, 0, 0, 0);
  const todaysCompleted = completedVehicles.filter(v => v.checkOutTime && v.checkOutTime > today);
  const todaysRevenue = todaysCompleted.reduce((acc, v) => acc + (v.price || 0), 0);

  const stats = [
    {
      title: 'Total Estacionados',
      value: activeVehicles.length,
      icon: Bike,
      color: 'bg-blue-500',
      textColor: 'text-blue-500',
      bgColor: 'bg-blue-500/10'
    },
    {
      title: 'Receita Hoje',
      value: `R$ ${todaysRevenue.toFixed(2)}`,
      icon: DollarSign,
      color: 'bg-emerald-500',
      textColor: 'text-emerald-500',
      bgColor: 'bg-emerald-500/10'
    },
    {
      title: 'Atendimentos Hoje',
      value: todaysCompleted.length,
      icon: Users,
      color: 'bg-purple-500',
      textColor: 'text-purple-500',
      bgColor: 'bg-purple-500/10'
    },
    {
      title: 'Tempo Médio',
      value: '2.5h', // Mocked for now
      icon: Clock,
      color: 'bg-amber-500',
      textColor: 'text-amber-500',
      bgColor: 'bg-amber-500/10'
    }
  ];

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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <div key={i} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500 mb-1">{stat.title}</p>
                  <p className="text-3xl font-bold text-slate-900">{stat.value}</p>
                </div>
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${stat.bgColor}`}>
                  <Icon className={`w-6 h-6 ${stat.textColor}`} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 lg:col-span-3">
          <SpotsGrid vehicles={vehicles} pricing={pricing} onSpotClick={onSpotClick} hideTitle={true} />
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
          <h2 className="text-lg font-bold text-slate-900 mb-4">Tabela de Preços (Valor Único / Pernoite)</h2>
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
