import React, { useState } from 'react';
import { Bike, Zap, Motorbike, Search, Clock, LogOut, PackageOpen } from 'lucide-react';
import { ParkedVehicle, VehicleType, Pricing } from '../types';
import { calculatePrice, formatDuration } from '../lib/pricing';
import { DeviceFeaturesConfig } from '../lib/deviceModules';

interface StoredVehiclesProps {
  vehicles: ParkedVehicle[];
  pricing: Pricing;
  deviceConfig?: DeviceFeaturesConfig;
  onCheckOut: (vehicle: ParkedVehicle) => void;
}

export function StoredVehicles({ vehicles, pricing, deviceConfig, onCheckOut }: StoredVehiclesProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [nowTime, setNowTime] = useState(Date.now());

  const hourlyEnabled = Boolean(deviceConfig?.enableHourlyPricing);

  React.useEffect(() => {
    const interval = setInterval(() => setNowTime(Date.now()), 60000);
    return () => clearInterval(interval);
  }, []);

  const storedVehicles = vehicles.filter(v => v.status === 'stored');

  const filteredVehicles = storedVehicles.filter(v => {
    const matchesSearch =
      v.identifier.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.ownerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.cardNumber.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const getIcon = (type: VehicleType) => {
    switch (type) {
      case 'bicycle':
        return <Bike className="w-5 h-5 text-slate-600 dark:text-slate-300" />;
      case 'ebike':
        return <Zap className="w-5 h-5 text-slate-600 dark:text-slate-300" />;
      case 'motorcycle':
        return <Motorbike className="w-5 h-5 text-slate-600 dark:text-slate-300" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center">
            <PackageOpen className="w-6 h-6 mr-3 text-slate-600 dark:text-slate-300" />
            Em Depósito
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Veículos estacionados há mais de 30 dias que foram recolhidos para depósito.
          </p>
        </div>
        <div className="bg-slate-800 text-white px-3 py-1 rounded-full text-sm font-medium">
          {storedVehicles.length} no Depósito
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por placa, dono ou cartão..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all text-slate-900 dark:text-slate-100"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredVehicles.map((vehicle) => {
          return (
            <div
              key={vehicle.id}
              className="bg-white dark:bg-slate-900 p-5 rounded-2xl shadow-sm border border-slate-300 dark:border-slate-700 flex flex-col opacity-95"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="p-3 rounded-xl bg-slate-200 dark:bg-slate-800">{getIcon(vehicle.type)}</div>
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-slate-100">{vehicle.identifier}</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{vehicle.ownerName}</p>
                  </div>
                </div>
                <div className="flex flex-col items-end space-y-2">
                  <div className="bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold px-3 py-1 rounded-lg text-sm border border-slate-300 dark:border-slate-700 flex items-center">
                    Cartão {vehicle.cardNumber}
                  </div>
                  <div className="bg-yellow-100 dark:bg-yellow-950/60 text-yellow-700 dark:text-yellow-300 font-bold px-2 py-1 rounded-md text-xs flex items-center uppercase text-[10px] tracking-wider">
                    <PackageOpen className="w-3 h-3 mr-1" />
                    Depósito
                  </div>
                </div>
              </div>

              <div className="mt-auto space-y-4">
                <div className="flex items-center justify-between text-sm bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3 rounded-xl">
                  <div className="flex items-center text-slate-600 dark:text-slate-300">
                    <Clock className="w-4 h-4 mr-2" />
                    <span>
                      Entrada:{' '}
                      <span className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                        {new Date(vehicle.checkInTime).toLocaleDateString('pt-BR')}
                      </span>
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="font-medium text-slate-900 dark:text-slate-100 block tabular-nums">
                      {formatDuration(vehicle.checkInTime, nowTime)}
                    </span>
                    <span className="text-emerald-700 dark:text-emerald-400 font-bold text-sm block mt-0.5 tabular-nums">
                      Est. R$ {calculatePrice(vehicle, pricing, nowTime, hourlyEnabled).toFixed(2)}
                    </span>
                  </div>
                </div>

                {deviceConfig?.canCheckOut !== false && (
                  <button
                    onClick={() => onCheckOut(vehicle)}
                    className="w-full py-2.5 bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-700 text-white rounded-xl font-medium transition-colors flex items-center justify-center"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Registrar Saída do Depósito
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {filteredVehicles.length === 0 && (
          <div className="col-span-full py-12 text-center">
            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-200 dark:border-slate-700">
              <PackageOpen className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-1">Nenhum veículo em depósito</h3>
            <p className="text-slate-500 dark:text-slate-400">
              {searchTerm ? 'Nenhum veículo no depósito corresponde à sua busca.' : 'Não há veículos armazenados por mais de 30 dias.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
