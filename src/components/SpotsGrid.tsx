import React, { useState, useMemo } from 'react';
import { ParkedVehicle, Pricing } from '../types';
import { Search, Bike, Zap, Motorbike, Plus } from 'lucide-react';

interface SpotsGridProps {
  vehicles: ParkedVehicle[];
  pricing: Pricing;
  onSpotClick?: (spotNumber: number, occupiedVehicle?: ParkedVehicle) => void;
  hideTitle?: boolean;
}

export function SpotsGrid({ vehicles, pricing, onSpotClick, hideTitle }: SpotsGridProps) {
  const [searchTerm, setSearchTerm] = useState('');
  
  const totalSpots = pricing.totalSpots || 50; 
  const activeVehicles = vehicles.filter(v => v.status === 'active');
  
  // Creates an array of spot numbers
  const spots = Array.from({ length: totalSpots }, (_, i) => i + 1);

  const spotMap = useMemo(() => {
    const map = new Map<number, ParkedVehicle>();
    activeVehicles.forEach(v => {
      const spotNum = parseInt(v.cardNumber, 10);
      if (!isNaN(spotNum)) {
        map.set(spotNum, v);
      }
    });
    return map;
  }, [activeVehicles]);

  const getIcon = (type: string) => {
    switch (type) {
      case 'bicycle': return <Bike className="w-5 h-5 text-blue-600" />;
      case 'ebike': return <Zap className="w-5 h-5 text-emerald-600" />;
      case 'motorcycle': return <Motorbike className="w-5 h-5 text-purple-600" />;
      default: return <Bike className="w-5 h-5 text-slate-600" />;
    }
  };

  const getBgColor = (type: string) => {
    switch (type) {
      case 'bicycle': return 'bg-blue-100 border-blue-200 hover:border-blue-300';
      case 'ebike': return 'bg-emerald-100 border-emerald-200 hover:border-emerald-300';
      case 'motorcycle': return 'bg-purple-100 border-purple-200 hover:border-purple-300';
      default: return 'bg-slate-100 border-slate-200';
    }
  };

  const filteredSpots = spots.filter(spotNum => {
    if (!searchTerm) return true;
    
    // Check if the spot number matches
    if (spotNum.toString().includes(searchTerm)) return true;
    
    // Check if the vehicle in the spot matches
    const vehicle = spotMap.get(spotNum);
    if (!vehicle) return false;
    
    const term = searchTerm.toLowerCase();
    return (
      vehicle.identifier.toLowerCase().includes(term) ||
      vehicle.ownerName.toLowerCase().includes(term) ||
      vehicle.type.toLowerCase().includes(term) ||
      vehicle.cardNumber.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6">
      {!hideTitle && (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Grade de Vagas</h1>
            <p className="text-slate-500">Visão geral do estacionamento</p>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
        <div className="relative flex-1 max-w-md w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input 
            type="text" 
            placeholder="Buscar por vaga, placa ou dono..." 
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-4 text-sm font-medium">
          <div className="flex items-center">
            <span className="w-3 h-3 rounded-full bg-slate-100 border border-slate-200 mr-2"></span>
            <span className="text-slate-600">Livre</span>
          </div>
          <div className="flex items-center">
            <span className="w-3 h-3 rounded-full bg-blue-100 border border-blue-200 mr-2"></span>
            <span className="text-slate-600">Bicicleta</span>
          </div>
          <div className="flex items-center">
            <span className="w-3 h-3 rounded-full bg-emerald-100 border border-emerald-200 mr-2"></span>
            <span className="text-slate-600">E-Bike</span>
          </div>
          <div className="flex items-center">
            <span className="w-3 h-3 rounded-full bg-purple-100 border border-purple-200 mr-2"></span>
            <span className="text-slate-600">Moto</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {filteredSpots.map(spotNum => {
          const vehicle = spotMap.get(spotNum);
          const isOccupied = !!vehicle;
          
          return (
            <button
              key={spotNum}
              onClick={() => onSpotClick && onSpotClick(spotNum, vehicle)}
              className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all aspect-square relative hover:shadow-md ${
                isOccupied 
                  ? getBgColor(vehicle.type)
                  : 'bg-white border-slate-200 border-dashed hover:border-emerald-400 hover:bg-emerald-50'
              }`}
            >
              <span className={`absolute top-2 left-3 font-bold text-lg ${isOccupied ? 'text-slate-700' : 'text-slate-400'}`}>
                {spotNum}
              </span>
              
              {isOccupied ? (
                <>
                  {getIcon(vehicle.type)}
                  <span className="mt-2 font-medium text-slate-900 text-sm truncate w-full text-center">
                    {vehicle.identifier !== 'Não informada' ? vehicle.identifier : vehicle.ownerName.split(' ')[0]}
                  </span>
                  <span className="text-xs text-slate-500 mt-1 truncate w-full text-center">
                    {vehicle.ownerName}
                  </span>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center text-slate-400 group-hover:text-emerald-500 transition-colors">
                  <Plus className="w-8 h-8 mb-1 opacity-50" />
                  <span className="text-xs font-medium">Livre</span>
                </div>
              )}
            </button>
          );
        })}
        {filteredSpots.length === 0 && (
          <div className="col-span-full py-12 text-center text-slate-500 bg-white rounded-2xl border border-slate-100">
            Nenhuma vaga encontrada para "{searchTerm}".
          </div>
        )}
      </div>
      
      {/* List vehicles that have non-numeric spot numbers (fallback) */}
      {activeVehicles.find(v => isNaN(parseInt(v.cardNumber, 10))) && !searchTerm && (
        <div className="mt-8">
          <h2 className="text-lg font-bold text-slate-900 mb-4">Vagas Especiais / Extra</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {activeVehicles
              .filter(v => isNaN(parseInt(v.cardNumber, 10)))
              .map(vehicle => (
                <button
                  key={vehicle.id}
                  onClick={() => onSpotClick && onSpotClick(0, vehicle)}
                  className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all hover:shadow-md ${getBgColor(vehicle.type)}`}
                >
                  <span className="absolute top-2 left-3 font-bold text-sm text-slate-700 bg-white/50 px-2 py-0.5 rounded-md">
                    {vehicle.cardNumber}
                  </span>
                  <div className="mt-2">{getIcon(vehicle.type)}</div>
                  <span className="mt-2 font-medium text-slate-900 text-sm truncate w-full text-center">
                    {vehicle.identifier !== 'Não informada' ? vehicle.identifier : vehicle.ownerName.split(' ')[0]}
                  </span>
                  <span className="text-xs text-slate-500 mt-1 truncate w-full text-center">
                    {vehicle.ownerName}
                  </span>
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
