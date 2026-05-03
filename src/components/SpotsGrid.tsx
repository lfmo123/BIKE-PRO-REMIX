import React, { useState, useMemo } from 'react';
import { ParkedVehicle, Pricing, LostCard } from '../types';
import { Search, Bike, Zap, Motorbike, Plus, AlertTriangle, PackageOpen } from 'lucide-react';

interface SpotsGridProps {
  vehicles: ParkedVehicle[];
  pricing: Pricing;
  lostCards?: LostCard[];
  onSpotClick?: (spotNumber: number, occupiedVehicle?: ParkedVehicle) => void;
  hideTitle?: boolean;
}

export function SpotsGrid({ vehicles, pricing, lostCards = [], onSpotClick, hideTitle }: SpotsGridProps) {
  const totalSpots = pricing.totalSpots || 50; 
  const activeVehicles = vehicles.filter(v => v.status === 'active' || v.status === 'stored');
  
  // Creates an array of spot numbers
  const spots = Array.from({ length: totalSpots }, (_, i) => i + 1);

  const spotMap = useMemo(() => {
    const map = new Map<string, ParkedVehicle>();
    activeVehicles.forEach(v => {
      map.set(v.cardNumber.toString(), v);
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

  const filteredSpots = spots;

  return (
    <div className="space-y-6">
      {!hideTitle && (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Grade de Cartões</h1>
            <p className="text-slate-500">Visão geral do estacionamento</p>
          </div>
        </div>
      )}

      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 mb-6 flex flex-wrap gap-4 items-center justify-center md:justify-start">
        <div className="flex flex-wrap gap-4 text-sm font-medium justify-center">
          <div className="flex items-center">
            <span className="w-4 h-4 rounded-full bg-slate-100 border border-slate-200 mr-2"></span>
            <span className="text-slate-600">Livre</span>
          </div>
          <div className="flex items-center">
            <span className="w-4 h-4 rounded-full bg-blue-100 border border-blue-200 mr-2"></span>
            <span className="text-slate-600">Bicicleta</span>
          </div>
          <div className="flex items-center">
            <span className="w-4 h-4 rounded-full bg-emerald-100 border border-emerald-200 mr-2"></span>
            <span className="text-slate-600">E-Bike</span>
          </div>
          <div className="flex items-center">
            <span className="w-4 h-4 rounded-full bg-purple-100 border border-purple-200 mr-2"></span>
            <span className="text-slate-600">Moto</span>
          </div>
          <div className="flex items-center">
            <span className="w-4 h-4 rounded-full bg-red-100 border border-red-400 mr-2 flex items-center justify-center">
              <AlertTriangle className="w-3 h-3 text-red-500" />
            </span>
            <span className="text-slate-600">Perdido</span>
          </div>
          <div className="flex items-center">
            <span className="w-4 h-4 rounded-full bg-slate-200 border border-slate-400 mr-2 flex items-center justify-center">
              <PackageOpen className="w-3 h-3 text-slate-500" />
            </span>
            <span className="text-slate-600">Depósito</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {filteredSpots.map(spotNumStr => {
          const spotNum = spotNumStr.toString();
          const vehicle = spotMap.get(spotNum);
          const isOccupied = !!vehicle;
          const lostCardObj = lostCards?.find(c => c.cardNumber === spotNum);
          const isLostCard = !!lostCardObj || (isOccupied && vehicle?.cardLost);
          const isStored = isOccupied && vehicle && vehicle.status === 'stored';
          
          return (
            <button
              key={spotNum}
              onClick={() => {
                if (!(isLostCard && !isOccupied) && onSpotClick) {
                  onSpotClick(Number(spotNum), vehicle);
                }
              }}
              disabled={isLostCard && !isOccupied}
              className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all aspect-square relative ${
                isOccupied 
                  ? vehicle?.cardLost 
                    ? 'bg-red-100 border-red-500 hover:border-red-600 hover:shadow-md cursor-pointer text-red-900' // Perdido (ocupado, pra fechar checkout da taxa possivelmente)
                    : isStored
                      ? 'bg-slate-200 border-slate-400 hover:border-slate-500 hover:shadow-md cursor-pointer text-slate-800 opacity-90'
                      : `${getBgColor(vehicle.type)} hover:shadow-md cursor-pointer text-slate-800`
                  : isLostCard
                    ? 'bg-red-100 border-red-500 opacity-80 cursor-not-allowed text-red-900' // Perdido desocupado
                    : 'bg-white border-slate-200 border-dashed hover:border-emerald-400 hover:bg-emerald-50 hover:shadow-md cursor-pointer group'
              }`}
            >
              <span className={`absolute top-2 left-3 font-bold text-4xl ${isLostCard ? 'text-red-900/30' : 'text-black'}`}>
                {spotNum}
              </span>
              
              {isLostCard && (
                <div className="absolute top-2 right-2 text-red-500 bg-red-100 p-1 rounded-full" title="Cartão Perdido">
                  <AlertTriangle className="w-4 h-4" />
                </div>
              )}
              
              {isStored && !isLostCard && (
                <div className="absolute top-2 right-2 text-slate-600 bg-slate-300 p-1 rounded-full" title="Em Depósito">
                  <PackageOpen className="w-4 h-4" />
                </div>
              )}
              
              {isOccupied ? (
                <>
                  <div className="mt-2 text-slate-700">{getIcon(vehicle.type)}</div>
                  <span className="mt-2 font-medium text-slate-900 text-sm truncate w-full text-center">
                    {vehicle.identifier !== 'Não informada' ? vehicle.identifier : vehicle.ownerName.split(' ')[0]}
                  </span>
                  <span className="text-xs text-slate-500 mt-1 truncate w-full text-center">
                    {vehicle.ownerName}
                  </span>
                </>
              ) : isLostCard ? (
                 <div className="flex flex-col items-center justify-center">
                   <div className="text-red-400 font-bold text-sm mt-4 text-center px-1 leading-tight">PERDIDO</div>
                 </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-slate-400 group-hover:text-emerald-500 transition-colors mt-2">
                  <Plus className="w-8 h-8 mb-1 opacity-50" />
                  <span className="text-xs font-medium">Livre</span>
                </div>
              )}
            </button>
          );
        })}
      </div>
      
      {/* List vehicles that have non-numeric spot numbers (fallback) */}
      {activeVehicles.find(v => isNaN(parseInt(v.cardNumber, 10))) && (
        <div className="mt-8">
          <h2 className="text-lg font-bold text-slate-900 mb-4">Cartões Especiais / Extra</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {activeVehicles
              .filter(v => isNaN(parseInt(v.cardNumber, 10)))
              .map(vehicle => (
                <button
                  key={vehicle.id}
                  onClick={() => onSpotClick && onSpotClick(0, vehicle)}
                  className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all hover:shadow-md relative ${
                    vehicle.cardLost ? 'bg-red-100 border-red-500 hover:border-red-600 text-red-900' : getBgColor(vehicle.type)
                  }`}
                >
                  <span className="absolute top-2 left-3 font-bold text-sm text-slate-700 bg-white/50 px-2 py-0.5 rounded-md">
                    {vehicle.cardNumber}
                  </span>
                  {vehicle.cardLost && (
                    <div className="absolute top-2 right-2 text-red-500 bg-red-100 p-1 rounded-full" title="Cartão Perdido">
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                  )}
                  <div className="mt-2 text-slate-700">{getIcon(vehicle.type)}</div>
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
