import React, { useState, useMemo } from 'react';
import { ParkedVehicle, Pricing, LostCard } from '../types';
import { Search, Bike, Zap, Motorbike, Plus, AlertTriangle, PackageOpen } from 'lucide-react';

interface SpotsGridProps {
  vehicles: ParkedVehicle[];
  pricing: Pricing;
  lostCards?: LostCard[];
  onSpotClick?: (spotNumber: string, occupiedVehicle?: ParkedVehicle) => void;
  hideTitle?: boolean;
}

export function SpotsGrid({ vehicles, pricing, lostCards = [], onSpotClick, hideTitle }: SpotsGridProps) {
  const activeVehicles = vehicles.filter(v => v.status === 'active' || v.status === 'stored');
  const normalSpots = Array.from({ length: 300 }, (_, i) => (i + 1).toString());
  const specialSpots = Array.from({ length: 50 }, (_, i) => `MT/BE ${i + 1}`);

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

  const renderGrid = (spotsToRender: string[], title: string) => (
    <div className="mb-8">
      <h2 className="text-xl font-bold text-slate-800 mb-4">{title}</h2>
      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 gap-3">
        {spotsToRender.map(spotNumStr => {
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
                  onSpotClick(spotNum, vehicle);
                }
              }}
              disabled={isLostCard && !isOccupied}
              className={`flex flex-col items-center justify-center p-2 rounded-xl border transition-all aspect-square relative ${
                isOccupied 
                  ? vehicle?.cardLost 
                    ? `${getBgColor(vehicle.type)} hover:shadow-md cursor-pointer text-slate-800 border-red-400 border-2` 
                    : isStored
                      ? 'bg-yellow-100 border-yellow-300 hover:border-yellow-400 hover:shadow-sm cursor-pointer text-yellow-900'
                      : `${getBgColor(vehicle.type)} hover:shadow-md cursor-pointer text-slate-800 border-transparent`
                  : isLostCard
                    ? 'bg-red-100 border-red-400 opacity-80 cursor-not-allowed text-red-900' 
                    : 'bg-white border-slate-200 border-dashed hover:border-emerald-400 hover:bg-emerald-50 hover:shadow-sm cursor-pointer group'
              }`}
            >
              <span className={`absolute top-1 left-2 font-bold text-2xl ${spotNum.includes('MT/BE') ? 'text-lg' : ''} ${isLostCard ? 'text-red-900/30' : 'text-black'}`}>
                {spotNum.replace('MT/BE ', '')}
              </span>
              {spotNum.includes('MT/BE') && (
                <span className={`absolute top-6 left-2 font-bold text-[10px] ${isLostCard ? 'text-red-900/30' : 'text-slate-500'}`}>
                  MT/BE
                </span>
              )}
              
              {isLostCard && (
                <div className="absolute top-1 right-1 text-red-500 bg-red-100 p-0.5 rounded-full" title="Cartão Perdido">
                  <AlertTriangle className="w-3 h-3" />
                </div>
              )}
              
              {isStored && !isLostCard && (
                <div className="absolute top-1 right-1 text-yellow-700 bg-yellow-300 p-0.5 rounded-full" title="Em Depósito">
                  <PackageOpen className="w-3 h-3" />
                </div>
              )}
              
              {isOccupied ? (
                isStored ? (
                  <div className="flex flex-col items-center justify-center mt-3">
                    <div className="text-yellow-700 font-bold text-[10px] text-center px-1 leading-tight uppercase">DEPÓSITO</div>
                  </div>
                ) : (
                  <>
                    <div className="mt-4 text-slate-700 transform scale-75">{getIcon(vehicle.type)}</div>
                    <span className="mt-0 font-medium text-slate-900 text-[10px] truncate w-full text-center px-1">
                      {vehicle.identifier !== 'Não informada' ? vehicle.identifier : vehicle.ownerName.split(' ')[0]}
                    </span>
                  </>
                )
              ) : isLostCard ? (
                 <div className="flex flex-col items-center justify-center mt-3">
                   <div className="text-red-400 font-bold text-[10px] text-center px-1 leading-tight">PERDIDO</div>
                 </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-slate-300 group-hover:text-emerald-500 transition-colors mt-3">
                  <Plus className="w-5 h-5 mb-0.5 opacity-50" />
                  <span className="text-[10px] font-medium">Livre</span>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );

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

      {renderGrid(normalSpots, "Bicicletas Tradicionais")}
      
      {renderGrid(specialSpots, "E-Bikes e Motos (MT/BE)")}
      
      {/* List vehicles that have non-numeric spot numbers (fallback) */}
      {activeVehicles.find(v => !normalSpots.includes(v.cardNumber) && !specialSpots.includes(v.cardNumber)) && (
        <div className="mt-8">
          <h2 className="text-lg font-bold text-slate-900 mb-4">Cartões Especiais / Extra</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {activeVehicles
              .filter(v => !normalSpots.includes(v.cardNumber) && !specialSpots.includes(v.cardNumber))
              .map(vehicle => (
                <button
                  key={vehicle.id}
                  onClick={() => onSpotClick && onSpotClick('', vehicle)}
                  className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all hover:shadow-md relative ${
                    vehicle.cardLost ? `${getBgColor(vehicle.type)} border-red-500` : vehicle.status === 'stored' ? 'bg-yellow-100 border-yellow-300 text-yellow-900' : getBgColor(vehicle.type)
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
                  {vehicle.status === 'stored' ? (
                    <div className="flex flex-col items-center justify-center mt-3">
                      <div className="text-yellow-700 font-bold text-[10px] text-center px-1 leading-tight uppercase">DEPÓSITO</div>
                    </div>
                  ) : (
                    <>
                      <div className="mt-2 text-slate-700">{getIcon(vehicle.type)}</div>
                      <span className="mt-2 font-medium text-slate-900 text-sm truncate w-full text-center">
                        {vehicle.identifier !== 'Não informada' ? vehicle.identifier : vehicle.ownerName.split(' ')[0]}
                      </span>
                      <span className="text-xs text-slate-500 mt-1 truncate w-full text-center">
                        {vehicle.ownerName}
                      </span>
                    </>
                  )}
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
