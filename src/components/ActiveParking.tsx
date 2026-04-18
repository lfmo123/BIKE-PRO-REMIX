import React, { useState } from 'react';
import { Bike, Zap, Motorbike, Search, Clock, LogOut, AlertTriangle } from 'lucide-react';
import { ParkedVehicle, VehicleType, Pricing } from '../types';
import { calculatePrice, formatDuration } from '../lib/pricing';

interface ActiveParkingProps {
  vehicles: ParkedVehicle[];
  pricing: Pricing;
  onCheckOut: (vehicle: ParkedVehicle) => void;
}

export function ActiveParking({ vehicles, pricing, onCheckOut }: ActiveParkingProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<VehicleType | 'all'>('all');

  const [nowTime, setNowTime] = useState(Date.now());

  React.useEffect(() => {
    const interval = setInterval(() => setNowTime(Date.now()), 60000);
    return () => clearInterval(interval);
  }, []);

  const activeVehicles = vehicles.filter(v => v.status === 'active');
  
  const now = new Date(nowTime);
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  
  const overnightVehicles = activeVehicles.filter(v => v.checkInTime < midnight);
  
  const filteredVehicles = activeVehicles.filter(v => {
    const matchesSearch = v.identifier.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          v.ownerName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || v.type === filterType;
    return matchesSearch && matchesType;
  });

  const getIcon = (type: VehicleType) => {
    switch (type) {
      case 'bicycle': return <Bike className="w-5 h-5 text-blue-600" />;
      case 'ebike': return <Zap className="w-5 h-5 text-emerald-600" />;
      case 'motorcycle': return <Motorbike className="w-5 h-5 text-purple-600" />;
    }
  };

  const getBgColor = (type: VehicleType) => {
    switch (type) {
      case 'bicycle': return 'bg-blue-100';
      case 'ebike': return 'bg-emerald-100';
      case 'motorcycle': return 'bg-purple-100';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Veículos Estacionados</h1>
        <div className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-sm font-medium">
          {activeVehicles.length} Ativos
        </div>
      </div>

      {overnightVehicles.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start space-x-3">
          <div className="bg-amber-100 p-2 rounded-xl shrink-0">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h3 className="font-bold text-amber-900">Alerta de Pernoite</h3>
            <p className="text-amber-700 text-sm mt-1">
              Há {overnightVehicles.length} veículo{overnightVehicles.length > 1 ? 's' : ''} estacionado{overnightVehicles.length > 1 ? 's' : ''} desde o dia anterior.
            </p>
          </div>
        </div>
      )}

      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input 
            type="text" 
            placeholder="Buscar por placa, modelo ou dono..." 
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredVehicles.map((vehicle) => {
          const isOvernight = vehicle.checkInTime < midnight;
          return (
          <div key={vehicle.id} className={`bg-white p-5 rounded-2xl shadow-sm border flex flex-col ${isOvernight ? 'border-amber-300 shadow-amber-100' : 'border-slate-100'}`}>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className={`p-3 rounded-xl ${getBgColor(vehicle.type)}`}>
                  {getIcon(vehicle.type)}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">{vehicle.identifier}</h3>
                  <p className="text-sm text-slate-500">{vehicle.ownerName}</p>
                </div>
              </div>
              <div className="flex flex-col items-end space-y-2">
                <div className="bg-slate-100 text-slate-700 font-bold px-3 py-1 rounded-lg text-sm">
                  Baia {vehicle.cardNumber}
                </div>
                {isOvernight && (
                  <div className="bg-amber-100 text-amber-700 font-bold px-2 py-1 rounded-md text-xs flex items-center">
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    Pernoite
                  </div>
                )}
              </div>
            </div>
            
            <div className="mt-auto space-y-4">
              <div className="flex items-center justify-between text-sm bg-slate-50 p-3 rounded-xl">
                <div className="flex items-center text-slate-600">
                  <Clock className="w-4 h-4 mr-2" />
                  <span>Entrada: {new Date(vehicle.checkInTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  {isOvernight && <span className="block text-xs text-amber-600 mt-0.5">{new Date(vehicle.checkInTime).toLocaleDateString('pt-BR')}</span>}
                  </span>
                </div>
                <div className="text-right">
                  <span className="font-medium text-slate-900 block">{formatDuration(vehicle.checkInTime, nowTime)}</span>
                  <span className="text-emerald-600 font-bold text-sm block mt-0.5">
                    Est. R$ {calculatePrice(vehicle, pricing, nowTime).toFixed(2)}
                  </span>
                </div>
              </div>
              
              <button 
                onClick={() => onCheckOut(vehicle)}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-medium transition-colors flex items-center justify-center"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Finalizar (Check-out)
              </button>
            </div>
          </div>
        )})}

        {filteredVehicles.length === 0 && (
          <div className="col-span-full py-12 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-medium text-slate-900 mb-1">Nenhum veículo encontrado</h3>
            <p className="text-slate-500">Não há veículos estacionados correspondentes à sua busca.</p>
          </div>
        )}
      </div>
    </div>
  );
}
