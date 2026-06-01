import React, { useState } from 'react';
import { Bike, Zap, Motorbike, Search, Calendar, Clock, DollarSign, CreditCard, Banknote, Smartphone, X } from 'lucide-react';
import { ParkedVehicle, VehicleType } from '../types';

interface HistoryProps {
  vehicles: ParkedVehicle[];
}

export function History({ vehicles }: HistoryProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<VehicleType | 'all'>('all');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedCardForHistory, setSelectedCardForHistory] = useState<string | null>(null);

  const reportDate = new Date(selectedDate + 'T00:00:00');
  const startOfDay = reportDate.setHours(0, 0, 0, 0);
  const endOfDay = reportDate.setHours(23, 59, 59, 999);

  const completedVehicles = vehicles
    .filter(v => v.status === 'completed' && v.checkOutTime)
    .sort((a, b) => (b.checkOutTime || 0) - (a.checkOutTime || 0));

  const filteredVehicles = completedVehicles.filter(v => {
    const matchesSearch = v.identifier.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          v.ownerName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || v.type.toLowerCase() === filterType.toLowerCase();
    const matchesDate = (v.checkOutTime || 0) >= startOfDay && (v.checkOutTime || 0) <= endOfDay;
    return matchesSearch && matchesType && matchesDate;
  });

  // Create grouped list for the main table
  const groupedVehicles = filteredVehicles.reduce((acc: any, v) => {
    const key = `${v.cardNumber}-${v.type}`;
    if (!acc[key]) {
      acc[key] = {
        cardNumber: v.cardNumber,
        type: v.type,
        totalPrice: 0,
        count: 0,
      };
    }
    acc[key].totalPrice += (v.price || 0);
    acc[key].count += 1;
    return acc;
  }, {});

  const groupedList = Object.values(groupedVehicles);

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

  const getPaymentIcon = (method?: 'pix' | 'card' | 'cash' | 'postpaid_card' | 'fiado') => {
    switch (method) {
      case 'pix': return <div className="flex items-center text-emerald-600"><Smartphone className="w-4 h-4 mr-1" /> PIX</div>;
      case 'card': return <div className="flex items-center text-blue-600"><CreditCard className="w-4 h-4 mr-1" /> Cartão</div>;
      case 'cash': return <div className="flex items-center text-amber-600"><Banknote className="w-4 h-4 mr-1" /> Dinheiro</div>;
      case 'postpaid_card': return <div className="flex items-center text-purple-600"><CreditCard className="w-4 h-4 mr-1" /> Pós-Pago</div>;
      case 'fiado': return <div className="flex items-center text-red-600"><Clock className="w-4 h-4 mr-1" /> Aguardando Pagamento</div>;
      default: return <span className="text-slate-400">-</span>;
    }
  };

  const selectedCardHistory = selectedCardForHistory 
    ? completedVehicles.filter(v => v.cardNumber === selectedCardForHistory && (v.checkOutTime || 0) >= startOfDay && (v.checkOutTime || 0) <= endOfDay)
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Histórico de Estacionamento</h1>
        <div className="flex items-center space-x-2 bg-white rounded-xl shadow-sm border border-slate-200 p-1 pl-3 transition-shadow hover:shadow-md">
          <Calendar className="w-5 h-5 text-emerald-500" />
          <input 
            type="date" 
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-transparent border-0 focus:ring-0 text-slate-700 font-bold p-2 outline-none cursor-pointer"
          />
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
                <th className="p-4">Cartão</th>
                <th className="p-4">Tipo</th>
                <th className="p-4">Usos</th>
                <th className="p-4 text-right">Total Pago</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {groupedList.map((group: any, idx) => (
                <tr key={`${group.cardNumber}-${group.type}`} className="hover:bg-slate-50/50 transition-colors">
                  <td className="p-4 text-emerald-600 font-bold hover:underline cursor-pointer" onClick={() => setSelectedCardForHistory(group.cardNumber)}>{group.cardNumber}</td>
                  <td className="p-4">
                      <div className="flex items-center space-x-2">
                        {getIcon(group.type)}
                        <span className="text-slate-700 capitalize">{group.type === 'bicycle' ? 'Bicicleta' : group.type === 'ebike' ? 'E-Bike' : 'Moto'}</span>
                      </div>
                  </td>
                  <td className="p-4 text-slate-600 font-medium">{group.count}</td>
                  <td className="p-4 text-right text-emerald-800 font-bold">R$ {group.totalPrice.toFixed(2)}</td>
                </tr>
              ))}
              {groupedList.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-slate-500">
                    Nenhum registro encontrado para este dia.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedCardForHistory && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">Histórico do Cartão #{selectedCardForHistory}</h2>
              <button onClick={() => setSelectedCardForHistory(null)} className="p-2 hover:bg-slate-100 rounded-full">
                <X className="w-6 h-6 text-slate-500" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto">
              {(() => {
                const groupedSelectedCardHistory = selectedCardHistory.reduce((acc: any, v) => {
                  const key = `${v.identifier}-${v.type}`;
                  if (!acc[key]) {
                    acc[key] = {
                      identifier: v.identifier,
                      type: v.type,
                      totalPrice: 0,
                      totalDurationMs: 0,
                      count: 0
                    };
                  }
                  acc[key].totalPrice += (v.price || 0);
                  acc[key].totalDurationMs += (v.checkOutTime || 0) - (v.checkInTime || 0);
                  acc[key].count += 1;
                  return acc;
                }, {});

                const groupedHistoryRows = Object.values(groupedSelectedCardHistory);

                return (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b text-sm font-medium text-slate-500">
                        <th className="p-2">Veículo</th>
                        <th className="p-2">Tipo</th>
                        <th className="p-2">Usos</th>
                        <th className="p-2">Duração Total</th>
                        <th className="p-2 text-right">Valor Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {groupedHistoryRows.map((v: any, index: number) => (
                        <tr key={index}>
                          <td className="p-2 font-medium">{v.identifier}</td>
                          <td className="p-2 capitalize">{v.type === 'bicycle' ? 'Bicicleta' : v.type === 'ebike' ? 'E-Bike' : 'Moto'}</td>
                          <td className="p-2">{v.count}</td>
                          <td className="p-2 text-xs">
                            {(() => {
                              const diffHours = Math.floor(v.totalDurationMs / (1000 * 60 * 60));
                              if (diffHours >= 24) {
                                return `${Math.ceil(diffHours / 24)} diária(s)`;
                              }
                              return `${diffHours}h ${Math.floor((v.totalDurationMs % (1000 * 60 * 60)) / (1000 * 60))}m`;
                            })()}
                          </td>
                          <td className="p-2 text-right">R$ {v.totalPrice.toFixed(2)}</td>
                        </tr>
                      ))}
                      {groupedHistoryRows.length === 0 && <tr><td colSpan={5} className="p-4 text-center">Nenhum uso para este cartão no dia.</td></tr>}
                    </tbody>
                  </table>
                );
              })()}
              <div className="mt-4 pt-4 border-t font-bold text-lg text-right">
                Total do dia: R$ {selectedCardHistory.reduce((s, v) => s + (v.price || 0), 0).toFixed(2)}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

