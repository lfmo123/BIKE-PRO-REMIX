import React, { useState } from 'react';
import { Bike, Zap, Motorbike, Search, Calendar, Clock, DollarSign, CreditCard, Banknote, Smartphone } from 'lucide-react';
import { ParkedVehicle, VehicleType } from '../types';

interface HistoryProps {
  vehicles: ParkedVehicle[];
}

export function History({ vehicles }: HistoryProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<VehicleType | 'all'>('all');

  const completedVehicles = vehicles.filter(v => v.status === 'completed').sort((a, b) => (b.checkOutTime || 0) - (a.checkOutTime || 0));
  
  const filteredVehicles = completedVehicles.filter(v => {
    const matchesSearch = v.identifier.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          v.ownerName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || v.type === filterType;
    return matchesSearch && matchesType;
  });

  const getIcon = (type: VehicleType) => {
    switch (type) {
      case 'bicycle': return <Bike className="w-4 h-4 text-blue-600" />;
      case 'ebike': return <Zap className="w-4 h-4 text-emerald-600" />;
      case 'motorcycle': return <Motorbike className="w-4 h-4 text-purple-600" />;
    }
  };

  const formatDuration = (checkInTime: number, checkOutTime?: number) => {
    if (!checkOutTime) return '-';
    const diffMs = checkOutTime - checkInTime;
    const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${diffHrs}h ${diffMins}m`;
  };

  const getPaymentIcon = (method?: 'pix' | 'card' | 'cash') => {
    switch (method) {
      case 'pix': return <div className="flex items-center text-emerald-600"><Smartphone className="w-4 h-4 mr-1" /> PIX</div>;
      case 'card': return <div className="flex items-center text-blue-600"><CreditCard className="w-4 h-4 mr-1" /> Cartão</div>;
      case 'cash': return <div className="flex items-center text-amber-600"><Banknote className="w-4 h-4 mr-1" /> Dinheiro</div>;
      default: return <span className="text-slate-400">-</span>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Histórico de Estacionamento</h1>
        <div className="bg-slate-100 text-slate-700 px-3 py-1 rounded-full text-sm font-medium">
          {completedVehicles.length} Registros
        </div>
      </div>

      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input 
            type="text" 
            placeholder="Buscar no histórico..." 
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button 
            onClick={() => setFilterType('all')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${filterType === 'all' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            Todos
          </button>
          <button 
            onClick={() => setFilterType('bicycle')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${filterType === 'bicycle' ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}
          >
            Bikes
          </button>
          <button 
            onClick={() => setFilterType('ebike')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${filterType === 'ebike' ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}
          >
            E-Bikes
          </button>
          <button 
            onClick={() => setFilterType('motorcycle')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${filterType === 'motorcycle' ? 'bg-purple-600 text-white' : 'bg-purple-50 text-purple-600 hover:bg-purple-100'}`}
          >
            Motos
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-sm font-medium text-slate-500">
                <th className="p-4">Veículo</th>
                <th className="p-4">Baia</th>
                <th className="p-4">Proprietário</th>
                <th className="p-4">Entrada</th>
                <th className="p-4">Saída</th>
                <th className="p-4">Duração</th>
                <th className="p-4">Pagamento</th>
                <th className="p-4 text-right">Valor Pago</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredVehicles.map((vehicle) => (
                <tr key={vehicle.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center space-x-3">
                      <div className={`p-2 rounded-lg bg-slate-100`}>
                        {getIcon(vehicle.type)}
                      </div>
                      <span className="font-medium text-slate-900">{vehicle.identifier}</span>
                    </div>
                  </td>
                  <td className="p-4 text-slate-600 font-medium">{vehicle.cardNumber}</td>
                  <td className="p-4 text-slate-600">{vehicle.ownerName}</td>
                  <td className="p-4 text-slate-600">
                    <div className="flex items-center">
                      <Calendar className="w-4 h-4 mr-2 text-slate-400" />
                      {new Date(vehicle.checkInTime).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </td>
                  <td className="p-4 text-slate-600">
                    <div className="flex items-center">
                      <Clock className="w-4 h-4 mr-2 text-slate-400" />
                      {vehicle.checkOutTime ? new Date(vehicle.checkOutTime).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'}
                    </div>
                  </td>
                  <td className="p-4 text-slate-600 font-medium">
                    {formatDuration(vehicle.checkInTime, vehicle.checkOutTime)}
                  </td>
                  <td className="p-4 text-sm font-medium">
                    {getPaymentIcon(vehicle.paymentMethod)}
                  </td>
                  <td className="p-4 text-right">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-sm font-medium bg-emerald-100 text-emerald-800">
                      R$ {vehicle.price?.toFixed(2) || '0.00'}
                    </span>
                  </td>
                </tr>
              ))}
              {filteredVehicles.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-500">
                    Nenhum registro encontrado no histórico.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
