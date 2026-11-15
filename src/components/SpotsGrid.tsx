import React, { useState, useMemo } from 'react';
import { ParkedVehicle, Pricing, LostCard, SpotRental } from '../types';
import { Search, Bike, Zap, Motorbike, Plus, AlertTriangle, PackageOpen, CalendarRange, Lock } from 'lucide-react';

import { DeviceFeaturesConfig } from '../lib/deviceModules';
import { findFixedRentalForSpot, getRentalValidity, normalizeSpot } from '../lib/rentalUtils';

interface SpotsGridProps {
  vehicles: ParkedVehicle[];
  pricing: Pricing;
  lostCards?: LostCard[];
  spotRentals?: SpotRental[];
  deviceConfig?: DeviceFeaturesConfig;
  onSpotClick?: (spotNumber: string, occupiedVehicle?: ParkedVehicle) => void;
  onRentedSpotClick?: (spotNumber: string, rental: SpotRental, occupiedVehicle?: ParkedVehicle) => void;
  hideTitle?: boolean;
}

export function SpotsGrid({
  vehicles,
  pricing,
  lostCards = [],
  spotRentals = [],
  deviceConfig,
  onSpotClick,
  onRentedSpotClick,
  hideTitle
}: SpotsGridProps) {
  const activeVehicles = vehicles.filter(v => v.status === 'active' || v.status === 'stored');
  const [searchQuery, setSearchQuery] = useState('');
  const normalSpots = Array.from({ length: 300 }, (_, i) => (i + 1).toString());
  const specialSpots = Array.from({ length: 50 }, (_, i) => `MT/BE ${i + 1}`);
  const vipSpots = Array.from({ length: 20 }, (_, i) => `SN ${i + 1}`);

  const rentalsEnabled = Boolean(deviceConfig?.enableSpotRentals);

  const spotMap = useMemo(() => {
    const map = new Map<string, ParkedVehicle>();
    activeVehicles.forEach(v => {
      map.set(v.cardNumber.toString(), v);
    });
    return map;
  }, [activeVehicles]);

  const customFixedRentals = useMemo(() => {
    if (!rentalsEnabled) return [];
    const standardSet = new Set([...normalSpots, ...specialSpots, ...vipSpots].map(normalizeSpot));
    return spotRentals.filter(
      r => r.status === 'active' && r.mode === 'fixed' && r.spotNumber && !standardSet.has(normalizeSpot(r.spotNumber))
    );
  }, [rentalsEnabled, spotRentals]);

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

  const renderGrid = (spotsToRender: string[], title: string, hasSearch?: boolean) => {
    const filteredSpots = hasSearch && searchQuery
      ? spotsToRender.filter(s => s.includes(searchQuery))
      : spotsToRender;

    return (
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">{title}</h2>
          {hasSearch && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="Buscar número..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none w-full sm:w-96"
              />
            </div>
          )}
        </div>
        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 gap-3">
          {filteredSpots.map(spotNumStr => {
            const spotNum = spotNumStr.toString();
            const vehicle = spotMap.get(spotNum);
            const isOccupied = !!vehicle;
            const lostCardObj = lostCards?.find(c => c.cardNumber === spotNum);
            const isLostCard = !!lostCardObj || (isOccupied && vehicle?.cardLost);
            const isStored = isOccupied && vehicle && vehicle.status === 'stored';
            const fixedRental = rentalsEnabled ? findFixedRentalForSpot(spotRentals, spotNum) : undefined;
            const rentalValidity = fixedRental ? getRentalValidity(fixedRental) : undefined;
            const isRentedEmpty = !isOccupied && !isLostCard && !!fixedRental;

            const canInteract = isOccupied
              ? deviceConfig?.canCheckOut !== false
              : !isLostCard && deviceConfig?.canCheckIn !== false;

            const handleButtonClick = () => {
              if (!canInteract) return;
              if (fixedRental && !isOccupied && onRentedSpotClick) {
                onRentedSpotClick(spotNum, fixedRental, vehicle);
                return;
              }
              if (onSpotClick) {
                onSpotClick(spotNum, vehicle);
              }
            };

            return (
              <button
                key={spotNum}
                onClick={handleButtonClick}
                disabled={(isLostCard && !isOccupied) || !canInteract}
                title={
                  fixedRental
                    ? `Vaga Alugada: ${fixedRental.ownerName} (${rentalValidity?.label || 'Ativo'})`
                    : undefined
                }
                className={`flex flex-col items-center justify-center p-2 rounded-xl border transition-all aspect-square relative ${
                  isOccupied
                    ? vehicle?.cardLost
                      ? `${getBgColor(vehicle.type)} hover:shadow-md cursor-pointer text-slate-800 border-red-400 border-2`
                      : isStored
                        ? 'bg-yellow-100 border-yellow-300 hover:border-yellow-400 hover:shadow-sm cursor-pointer text-yellow-900'
                        : fixedRental
                          ? `${getBgColor(vehicle.type)} hover:shadow-md cursor-pointer text-slate-800 border-teal-500 border-2`
                          : `${getBgColor(vehicle.type)} hover:shadow-md cursor-pointer text-slate-800 border-transparent`
                    : isLostCard
                      ? 'bg-red-100 border-red-400 opacity-80 cursor-not-allowed text-red-900'
                      : isRentedEmpty
                        ? rentalValidity && !rentalValidity.isValidToday
                          ? 'bg-red-50 border-red-300 hover:border-red-400 hover:shadow-sm cursor-pointer text-red-900'
                          : 'bg-teal-50 dark:bg-teal-950/40 border-teal-400 hover:border-teal-500 hover:bg-teal-100/70 hover:shadow-sm cursor-pointer text-teal-900 dark:text-teal-200'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 border-dashed hover:border-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 hover:shadow-sm cursor-pointer group'
                }`}
              >
                <span className={`absolute top-1 left-2 font-bold text-2xl ${spotNum.includes('MT/BE') || spotNum.includes('SN') ? 'text-lg' : ''} ${isLostCard ? 'text-red-900/30' : isOccupied ? 'text-black' : isRentedEmpty ? 'text-teal-900 dark:text-teal-200' : 'text-black dark:text-slate-100'}`}>
                  {spotNum.replace('MT/BE ', '').replace('SN ', '')}
                </span>
                {spotNum.includes('MT/BE') && (
                  <span className={`absolute top-6 left-2 font-bold text-[10px] ${isLostCard ? 'text-red-900/30' : 'text-slate-500'}`}>
                    MT/BE
                  </span>
                )}
                {spotNum.includes('SN') && (
                  <span className={`absolute top-6 left-2 font-bold text-[10px] ${isLostCard ? 'text-red-900/30' : 'text-slate-500'}`}>
                    SN
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

                {!isLostCard && !isStored && fixedRental && (
                  <div
                    className={`absolute top-1 right-1 p-0.5 rounded-full ${
                      rentalValidity && !rentalValidity.isValidToday
                        ? 'text-red-700 bg-red-200'
                        : 'text-teal-700 bg-teal-200'
                    }`}
                    title={`Aluguel: ${fixedRental.ownerName}`}
                  >
                    <Lock className="w-3 h-3" />
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
                ) : isRentedEmpty && fixedRental ? (
                  <div className="flex flex-col items-center justify-center mt-4 w-full px-1">
                    <span className={`font-black text-[9px] uppercase leading-tight ${rentalValidity && !rentalValidity.isValidToday ? 'text-red-600' : 'text-teal-700 dark:text-teal-300'}`}>
                      {rentalValidity && !rentalValidity.isValidToday ? 'VENCIDA' : 'ALUGADA'}
                    </span>
                    <span className="text-[10px] font-semibold truncate w-full text-center">
                      {fixedRental.ownerName.split(' ')[0]}
                    </span>
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
  };

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
            <span className="w-4 h-4 rounded-full bg-white border border-slate-300 border-dashed mr-2"></span>
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
          {rentalsEnabled && (
            <div className="flex items-center">
              <span className="w-4 h-4 rounded-full bg-teal-100 border border-teal-400 mr-2 flex items-center justify-center">
                <Lock className="w-2.5 h-2.5 text-teal-700" />
              </span>
              <span className="text-slate-600">Alugada</span>
            </div>
          )}
          <div className="flex items-center">
            <span className="w-4 h-4 rounded-full bg-red-100 border border-red-400 mr-2 flex items-center justify-center">
              <AlertTriangle className="w-3 h-3 text-red-500" />
            </span>
            <span className="text-slate-600">Perdido</span>
          </div>
          <div className="flex items-center">
            <span className="w-4 h-4 rounded-full bg-yellow-100 border border-yellow-300 mr-2 flex items-center justify-center">
              <PackageOpen className="w-3 h-3 text-yellow-700" />
            </span>
            <span className="text-slate-600">Depósito</span>
          </div>
        </div>
      </div>

      {rentalsEnabled && customFixedRentals.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
            <CalendarRange className="w-5 h-5 text-teal-600" />
            Vagas Fixas Alugadas (Personalizadas)
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
            {customFixedRentals.map(rental => {
              const spotKey = normalizeSpot(rental.spotNumber);
              const vehicle = spotMap.get(spotKey) || activeVehicles.find(v => normalizeSpot(v.cardNumber) === spotKey);
              const validity = getRentalValidity(rental);
              const canInteract = vehicle ? deviceConfig?.canCheckOut !== false : deviceConfig?.canCheckIn !== false;
              return (
                <button
                  key={rental.id}
                  type="button"
                  disabled={!canInteract}
                  onClick={() => {
                    if (!canInteract) return;
                    if (!vehicle && onRentedSpotClick) {
                      onRentedSpotClick(spotKey, rental);
                    } else if (onSpotClick) {
                      onSpotClick(spotKey, vehicle);
                    }
                  }}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all relative ${
                    vehicle
                      ? `${getBgColor(vehicle.type)} border-teal-500 hover:shadow-md`
                      : validity.isValidToday
                        ? 'bg-teal-50 border-teal-400 hover:bg-teal-100/70 text-teal-900'
                        : 'bg-red-50 border-red-300 hover:bg-red-100/70 text-red-900'
                  }`}
                >
                  <span className="font-black text-sm">{spotKey}</span>
                  <span className="text-[10px] font-bold uppercase mt-1">
                    {vehicle ? 'No Pátio' : validity.isValidToday ? 'Alugada' : 'Vencida'}
                  </span>
                  <span className="text-xs font-medium truncate w-full text-center mt-0.5">{rental.ownerName}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {renderGrid(normalSpots, "Bicicletas Tradicionais", true)}

      {renderGrid(specialSpots, "E-Bikes e Motos (MT/BE)")}

      {renderGrid(vipSpots, "Vagas Sem Número")}

      {/* List vehicles that have non-numeric spot numbers (fallback) */}
      {activeVehicles.find(v => !normalSpots.includes(v.cardNumber) && !specialSpots.includes(v.cardNumber) && !vipSpots.includes(v.cardNumber)) && (
        <div className="mt-8">
          <h2 className="text-lg font-bold text-slate-900 mb-4">Cartões Especiais / Extra</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {activeVehicles
              .filter(v => !normalSpots.includes(v.cardNumber) && !specialSpots.includes(v.cardNumber) && !vipSpots.includes(v.cardNumber))
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

