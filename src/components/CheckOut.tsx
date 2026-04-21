import React, { useState, useEffect } from 'react';
import { Search, Bike, Zap, Motorbike, Clock, DollarSign, CreditCard, Banknote, Smartphone, ChevronRight, LogOut, ArrowLeft } from 'lucide-react';
import { ParkedVehicle, Pricing, VehicleType } from '../types';
import { calculatePrice, formatDuration, getBilledBreakdown } from '../lib/pricing';

interface CheckOutProps {
  vehicles: ParkedVehicle[];
  pricing: Pricing;
  onCheckOut: (vehicleId: string, price: number, paymentMethod: 'pix' | 'card' | 'cash') => void;
}

export function CheckOut({ vehicles, pricing, onCheckOut }: CheckOutProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedVehicle, setSelectedVehicle] = useState<ParkedVehicle | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'card' | 'cash'>('pix');
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(interval);
  }, []);

  // Update selected vehicle if it gets checked out (it will be removed from active)
  useEffect(() => {
    if (selectedVehicle) {
      const stillActive = vehicles.find(v => v.id === selectedVehicle.id && v.status === 'active');
      if (!stillActive) {
        setSelectedVehicle(null);
      }
    }
  }, [vehicles, selectedVehicle]);

  const activeVehicles = vehicles.filter(v => v.status === 'active');
  
  const filteredVehicles = activeVehicles.filter(v => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return v.identifier.toLowerCase().includes(term) || 
           v.ownerName.toLowerCase().includes(term) ||
           v.cardNumber.toLowerCase().includes(term);
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

  const handleConfirm = () => {
    if (selectedVehicle) {
      const price = calculatePrice(selectedVehicle, pricing, now);
      onCheckOut(selectedVehicle.id, price, paymentMethod);
      setSelectedVehicle(null);
      setSearchTerm('');
    }
  };

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex items-center justify-between shrink-0">
        <h1 className="text-2xl font-bold text-slate-900">Realizar Check-out</h1>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-0">
        {/* Left Column: Search and List */}
        <div className={`w-full lg:w-1/2 flex-col bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden ${selectedVehicle ? 'hidden lg:flex' : 'flex'}`}>
          <div className="p-4 border-b border-slate-100 shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input 
                type="text" 
                placeholder="Buscar por placa, dono ou baia..." 
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-2">
            {filteredVehicles.length > 0 ? (
              <div className="space-y-2">
                {filteredVehicles.map(vehicle => (
                  <button
                    key={vehicle.id}
                    onClick={() => setSelectedVehicle(vehicle)}
                    className={`w-full text-left p-4 rounded-xl border transition-all flex items-center justify-between ${
                      selectedVehicle?.id === vehicle.id 
                        ? 'bg-emerald-50 border-emerald-200 ring-1 ring-emerald-500' 
                        : 'bg-white border-slate-100 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center space-x-4">
                      <div className={`p-3 rounded-xl ${getBgColor(vehicle.type)}`}>
                        {getIcon(vehicle.type)}
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900">{vehicle.identifier}</h3>
                        <p className="text-sm text-slate-500">{vehicle.ownerName}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <div className="bg-slate-100 text-slate-700 font-bold px-2 py-1 rounded-lg text-xs inline-block mb-1">
                          Baia {vehicle.cardNumber}
                        </div>
                        <div className="text-xs text-slate-500 flex items-center justify-end">
                          <Clock className="w-3 h-3 mr-1" />
                          {formatDuration(vehicle.checkInTime, now)}
                        </div>
                      </div>
                      <ChevronRight className={`w-5 h-5 ${selectedVehicle?.id === vehicle.id ? 'text-emerald-500' : 'text-slate-300'}`} />
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 p-8 text-center">
                <Search className="w-12 h-12 text-slate-300 mb-4" />
                <p className="font-medium text-slate-900">Nenhum veículo encontrado</p>
                <p className="text-sm mt-1">Tente buscar por outro termo ou verifique se o veículo já fez check-out.</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Checkout Details */}
        <div className={`w-full lg:w-1/2 flex-col ${selectedVehicle ? 'flex' : 'hidden lg:flex'}`}>
          {selectedVehicle ? (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col h-full animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="flex items-center mb-6">
                <button 
                  onClick={() => setSelectedVehicle(null)}
                  className="mr-4 p-2 -ml-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg lg:hidden"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <h2 className="text-xl font-bold text-slate-900">Detalhes do Pagamento</h2>
              </div>
              
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 mb-6">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-bold text-slate-900 text-xl">{selectedVehicle.identifier}</h3>
                    <p className="text-slate-500">{selectedVehicle.ownerName}</p>
                  </div>
                  <span className="bg-slate-200 text-slate-700 font-bold px-3 py-1.5 rounded-lg text-sm">
                    Baia {selectedVehicle.cardNumber}
                  </span>
                </div>
                
                <div className="grid grid-cols-2 gap-4 mt-6">
                  <div className="bg-white p-4 rounded-xl border border-slate-100 flex flex-col">
                    <span className="text-sm font-medium text-slate-500 mb-1 flex items-center">
                      <Clock className="w-4 h-4 mr-1.5" /> Tempo Cobrado
                    </span>
                    <span className="font-bold text-slate-900 text-lg">
                      {(() => {
                        const breakdown = getBilledBreakdown(selectedVehicle, pricing, now);
                        return `${breakdown.days} diária${breakdown.days > 1 ? 's' : ''}`;
                      })()}
                    </span>
                    <span className="text-xs text-slate-500 mt-1">
                      Duração: {formatDuration(selectedVehicle.checkInTime, now)}
                    </span>
                    <span className="text-xs text-slate-400 mt-0.5">
                      Entrada: {new Date(selectedVehicle.checkInTime).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="bg-white p-4 rounded-xl border border-slate-100 flex flex-col">
                    <span className="text-sm font-medium text-slate-500 mb-1 flex items-center">
                      <DollarSign className="w-4 h-4 mr-1.5" /> Valor a Pagar
                    </span>
                    <span className="font-bold text-emerald-600 text-2xl">R$ {calculatePrice(selectedVehicle, pricing, now).toFixed(2)}</span>
                  </div>
                </div>
              </div>
              
              <div className="space-y-4 mb-8">
                <label className="block text-sm font-medium text-slate-700">Selecione o Método de Pagamento</label>
                <div className="grid grid-cols-3 gap-4">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('pix')}
                    className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${
                      paymentMethod === 'pix' 
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700' 
                        : 'border-slate-100 hover:border-slate-200 text-slate-500'
                    }`}
                  >
                    <Smartphone className={`w-6 h-6 mb-2 ${paymentMethod === 'pix' ? 'text-emerald-600' : ''}`} />
                    <span className="text-sm font-medium">PIX</span>
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('card')}
                    className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${
                      paymentMethod === 'card' 
                        ? 'border-blue-500 bg-blue-50 text-blue-700' 
                        : 'border-slate-100 hover:border-slate-200 text-slate-500'
                    }`}
                  >
                    <CreditCard className={`w-6 h-6 mb-2 ${paymentMethod === 'card' ? 'text-blue-600' : ''}`} />
                    <span className="text-sm font-medium">Cartão</span>
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('cash')}
                    className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${
                      paymentMethod === 'cash' 
                        ? 'border-amber-500 bg-amber-50 text-amber-700' 
                        : 'border-slate-100 hover:border-slate-200 text-slate-500'
                    }`}
                  >
                    <Banknote className={`w-6 h-6 mb-2 ${paymentMethod === 'cash' ? 'text-amber-600' : ''}`} />
                    <span className="text-sm font-medium">Dinheiro</span>
                  </button>
                </div>
              </div>
              
              <div className="mt-auto">
                <button
                  onClick={handleConfirm}
                  className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-lg transition-colors shadow-lg shadow-slate-900/20 flex items-center justify-center"
                >
                  <LogOut className="w-5 h-5 mr-2" />
                  Confirmar Check-out
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 rounded-2xl border border-slate-100 border-dashed flex flex-col items-center justify-center h-full text-slate-400 p-8 text-center">
              <LogOut className="w-16 h-16 mb-4 text-slate-300" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">Nenhum veículo selecionado</h3>
              <p>Selecione um veículo na lista ao lado para visualizar os detalhes e realizar o check-out.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
