import React, { useState } from 'react';
import { Bike, Zap, Motorbike, Search, Clock, LogOut, AlertTriangle, Undo2, X, Printer } from 'lucide-react';
import { ParkedVehicle, VehicleType, Pricing } from '../types';
import { calculatePrice, formatDuration } from '../lib/pricing';
import { generateThermalPrintHtml, printHtml } from '../utils/printHelper';

interface ActiveParkingProps {
  vehicles: ParkedVehicle[];
  pricing: Pricing;
  onCheckOut: (vehicle: ParkedVehicle) => void;
  onRevertCheckin?: (vehicleId: string) => void;
}

export function ActiveParking({ vehicles, pricing, onCheckOut, onRevertCheckin }: ActiveParkingProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<VehicleType | 'all'>('all');
  const [revertIntent, setRevertIntent] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const [nowTime, setNowTime] = useState(Date.now());

  React.useEffect(() => {
    const interval = setInterval(() => setNowTime(Date.now()), 60000);
    return () => clearInterval(interval);
  }, []);

  const activeVehicles = vehicles.filter(v => v.status === 'active');
  
  const now = new Date(nowTime);
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  
  const overnightVehicles = activeVehicles.filter(v => {
    return (now.getTime() - v.checkInTime) >= ONE_DAY_MS;
  });
  
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

  const handlePrintConference = () => {
    const bikes = activeVehicles.filter(v => v.type === 'bicycle');
    const ebikes = activeVehicles.filter(v => v.type === 'ebike');
    const motos = activeVehicles.filter(v => v.type === 'motorcycle');

    const renderCategory = (title: string, items: any[]) => {
      if (items.length === 0) return '';
      return `
        <div class="section" style="margin-bottom: 15px;">
          <h2 style="font-size: 11pt; margin-bottom: 8px;">${title} (${items.length})</h2>
          <div style="display: flex; flex-wrap: wrap; gap: 8px;">
            ${items.map(v => `
              <div style="border: 1px solid #000; padding: 4px 8px; border-radius: 4px; font-weight: bold; font-size: 11pt; display: flex; align-items: center; gap: 8px;">
                <span>#${v.cardNumber}</span>
                <span style="border: 1px solid #000; width: 14px; height: 14px; display: inline-block;"></span>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    };

    const bodyHtml = `
      <h1>Conferência de Pátio</h1>
      <div class="subtitle" style="margin-bottom: 15px;">${new Date().toLocaleString('pt-BR')}</div>
      ${renderCategory('Bikes', bikes)}
      ${renderCategory('E-Bikes', ebikes)}
      ${renderCategory('Motos', motos)}
      <div class="section" style="text-align: center; margin-top: 10px; border-top: 1px dashed #000; padding-top: 10px;">
        <h2>Total Geral: ${activeVehicles.length}</h2>
      </div>
      <div class="footer">
        <p>Bikepark - Conferência</p>
      </div>
    `;
    
    const html = generateThermalPrintHtml('Conferência de Pátio', bodyHtml);
    printHtml(html);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Veículos Estacionados</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={handlePrintConference}
            className="hidden sm:flex bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors items-center"
          >
            <Printer className="w-4 h-4 mr-2" />
            Imprimir Conferência
          </button>
          <button
            onClick={handlePrintConference}
            className="sm:hidden bg-white border border-slate-200 text-slate-700 p-2 rounded-xl hover:bg-slate-50 transition-colors"
            title="Imprimir Conferência"
          >
            <Printer className="w-5 h-5" />
          </button>
          <div className="bg-emerald-100 text-emerald-700 px-3 py-2 sm:py-1 rounded-xl sm:rounded-full text-sm font-medium">
            {activeVehicles.length} Ativos
          </div>
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
          const isOvernight = (now.getTime() - vehicle.checkInTime) >= ONE_DAY_MS;
          
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
                  {vehicle.cardNumber.startsWith('SN') ? vehicle.cardNumber : `Cartão ${vehicle.cardNumber}`}
                </div>
                {isOvernight && (
                  <div className="bg-amber-100 text-amber-700 font-bold px-2 py-1 rounded-md text-xs flex items-center">
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    +1 Diária
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
                Registrar Saída
              </button>
              
              {onRevertCheckin && (
                <button 
                  onClick={() => setRevertIntent(vehicle.id)}
                  className="w-full py-2.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl font-medium transition-colors flex items-center justify-center border border-red-200"
                >
                  <Undo2 className="w-4 h-4 mr-2" />
                  Estornar Entrada
                </button>
              )}
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

      {revertIntent && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-red-50">
              <h2 className="text-lg font-bold text-red-900">Estornar Entrada</h2>
              <button onClick={() => { setRevertIntent(null); setPassword(''); setPasswordError(''); }} className="p-1 hover:bg-red-100 rounded-full">
                <X className="w-5 h-5 text-red-500" />
              </button>
            </div>
            <div className="p-6">
              <p className="text-sm text-slate-600 mb-4">
                Tem certeza que deseja estornar esta entrada? Esta operação requer senha de administrador.
              </p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Senha</label>
                  <input 
                    type="password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500"
                    placeholder="Digite a senha"
                  />
                  {passwordError && <p className="text-red-500 text-xs mt-1">{passwordError}</p>}
                </div>
                <button 
                  onClick={() => {
                    if (password === 'Admin') {
                      onRevertCheckin?.(revertIntent);
                      setRevertIntent(null);
                      setPassword('');
                      setPasswordError('');
                    } else {
                      setPasswordError('Senha incorreta');
                    }
                  }}
                  className="w-full py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
                >
                  Confirmar Estorno
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
