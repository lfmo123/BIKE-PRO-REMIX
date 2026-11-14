import React, { useState } from 'react';
import {
  Bike,
  Zap,
  Motorbike,
  Search,
  Clock,
  LogOut,
  AlertTriangle,
  Printer,
  QrCode,
  MessageCircle,
  Camera
} from 'lucide-react';
import { ParkedVehicle, VehicleType, Pricing } from '../types';
import { calculatePrice, formatDuration } from '../lib/pricing';
import { generateThermalPrintHtml, printHtml } from '../utils/printHelper';
import { DeviceFeaturesConfig } from '../lib/deviceModules';
import { generateQrSvg } from '../lib/pixUtils';
import { buildCheckInWhatsappText, openWhatsappMessage } from '../lib/whatsappUtils';

interface ActiveParkingProps {
  vehicles: ParkedVehicle[];
  pricing: Pricing;
  deviceConfig?: DeviceFeaturesConfig;
  onCheckOut: (vehicle: ParkedVehicle) => void;
  onRevertCheckin?: (vehicleId: string) => void;
  onOpenScanner?: () => void;
}

export function ActiveParking({
  vehicles,
  pricing,
  deviceConfig,
  onCheckOut,
  onOpenScanner
}: ActiveParkingProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<VehicleType | 'all'>('all');
  const [nowTime, setNowTime] = useState(Date.now());

  const hourlyEnabled = Boolean(deviceConfig?.enableHourlyPricing);

  React.useEffect(() => {
    const interval = setInterval(() => setNowTime(Date.now()), 60000);
    return () => clearInterval(interval);
  }, []);

  const activeVehicles = vehicles.filter(v => v.status === 'active');

  const now = new Date(nowTime);
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;

  const overnightVehicles = activeVehicles.filter(v => now.getTime() - v.checkInTime >= ONE_DAY_MS);

  const filteredVehicles = activeVehicles.filter(v => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      v.identifier.toLowerCase().includes(term) ||
      v.ownerName.toLowerCase().includes(term) ||
      v.cardNumber.toLowerCase().includes(term);
    const matchesType = filterType === 'all' || v.type === filterType;
    return matchesSearch && matchesType;
  });

  const getIcon = (type: VehicleType) => {
    switch (type) {
      case 'bicycle':
        return <Bike className="w-5 h-5 text-blue-600" />;
      case 'ebike':
        return <Zap className="w-5 h-5 text-emerald-600" />;
      case 'motorcycle':
        return <Motorbike className="w-5 h-5 text-purple-600" />;
    }
  };

  const getBgColor = (type: VehicleType) => {
    switch (type) {
      case 'bicycle':
        return 'bg-blue-100';
      case 'ebike':
        return 'bg-emerald-100';
      case 'motorcycle':
        return 'bg-purple-100';
    }
  };

  const handlePrintTicket = async (vehicle: ParkedVehicle) => {
    try {
      const qrContent = `BIKEPARK:CARD:${vehicle.cardNumber}:ID:${vehicle.id}`;
      const qrSvg = deviceConfig?.enableQrTicketScanner ? await generateQrSvg(qrContent) : '';
      const typeLabel = vehicle.type === 'bicycle' ? 'Bicicleta' : vehicle.type === 'ebike' ? 'E-Bike' : 'Moto';
      const content = `
        <h1>TICKET DE ENTRADA</h1>
        <div class="subtitle">BIKEPARK GESTÃO</div>
        <div class="section">
          <div class="row"><span class="label">CARTÃO/VAGA:</span><span class="value">#${vehicle.cardNumber}</span></div>
          <div class="row"><span class="label">TIPO:</span><span class="value">${typeLabel}</span></div>
          <div class="row"><span class="label">CLIENTE:</span><span class="value">${vehicle.ownerName || 'Não informado'}</span></div>
          <div class="row"><span class="label">ENTRADA:</span><span class="value">${new Date(vehicle.checkInTime).toLocaleString('pt-BR')}</span></div>
          ${vehicle.damageNotes ? `<div class="row"><span class="label">OBS:</span><span class="value">${vehicle.damageNotes}</span></div>` : ''}
        </div>
        ${
          qrSvg
            ? `<div class="text-center" style="margin: 12px 0;">
                 ${qrSvg}
                 <div style="font-size: 9pt; font-weight: bold; margin-top: 4px;">${qrContent}</div>
               </div>`
            : ''
        }
        <div class="footer">Guarde este comprovante para retirada do veículo.</div>
      `;
      printHtml(generateThermalPrintHtml(`Ticket #${vehicle.cardNumber}`, content));
    } catch (e) {
      console.error('Erro ao imprimir ticket:', e);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Veículos Estacionados</h1>
        <div className="flex items-center gap-3">
          {deviceConfig?.enableQrTicketScanner && onOpenScanner && (
            <button
              onClick={onOpenScanner}
              className="flex items-center gap-2 px-3.5 py-2 bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition-colors"
            >
              <QrCode className="w-4 h-4" />
              Escanear Ticket QR
            </button>
          )}
          <div className="bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 px-3 py-2 sm:py-1 rounded-xl sm:rounded-full text-sm font-medium">
            {activeVehicles.length} Ativos
          </div>
        </div>
      </div>

      {overnightVehicles.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-2xl p-4 flex items-start space-x-3">
          <div className="bg-amber-100 dark:bg-amber-900/50 p-2 rounded-xl shrink-0">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h3 className="font-bold text-amber-900 dark:text-amber-200">Alerta de Pernoite</h3>
            <p className="text-amber-700 dark:text-amber-300 text-sm mt-1">
              Há {overnightVehicles.length} veículo{overnightVehicles.length > 1 ? 's' : ''} estacionado
              {overnightVehicles.length > 1 ? 's' : ''} desde o dia anterior.
            </p>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por placa, modelo, cartão ou dono..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all text-slate-900 dark:text-slate-100"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilterType('all')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              filterType === 'all'
                ? 'bg-slate-800 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            Todos
          </button>
          <button
            onClick={() => setFilterType('bicycle')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              filterType === 'bicycle'
                ? 'bg-blue-600 text-white'
                : 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 hover:bg-blue-100'
            }`}
          >
            Bikes
          </button>
          <button
            onClick={() => setFilterType('ebike')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              filterType === 'ebike'
                ? 'bg-emerald-600 text-white'
                : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100'
            }`}
          >
            E-Bikes
          </button>
          <button
            onClick={() => setFilterType('motorcycle')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              filterType === 'motorcycle'
                ? 'bg-purple-600 text-white'
                : 'bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 hover:bg-purple-100'
            }`}
          >
            Motos
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredVehicles.map((vehicle) => {
          const isOvernight = now.getTime() - vehicle.checkInTime >= ONE_DAY_MS;
          const showTicketBtn =
            deviceConfig?.canPrintTicket !== false &&
            (deviceConfig?.enableQrTicketScanner || deviceConfig?.canPrintTicket);

          return (
            <div
              key={vehicle.id}
              className={`bg-white dark:bg-slate-900 p-5 rounded-2xl shadow-sm border flex flex-col ${
                isOvernight ? 'border-amber-300 dark:border-amber-700 shadow-amber-100/40' : 'border-slate-100 dark:border-slate-800'
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className={`p-3 rounded-xl ${getBgColor(vehicle.type)}`}>{getIcon(vehicle.type)}</div>
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-slate-100">{vehicle.identifier}</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{vehicle.ownerName}</p>
                  </div>
                </div>
                <div className="flex flex-col items-end space-y-2">
                  <div className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold px-3 py-1 rounded-lg text-sm">
                    {vehicle.cardNumber.startsWith('SN') ? vehicle.cardNumber : `Cartão ${vehicle.cardNumber}`}
                  </div>
                  {isOvernight && (
                    <div className="bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 font-bold px-2 py-1 rounded-md text-xs flex items-center">
                      <AlertTriangle className="w-3 h-3 mr-1" />
                      +1 Diária
                    </div>
                  )}
                </div>
              </div>

              {(vehicle.photoData || vehicle.damageNotes) && (
                <div className="mb-3 px-3 py-2 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 flex items-center gap-2 text-xs text-amber-900 dark:text-amber-200">
                  <Camera className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{vehicle.damageNotes || 'Vistoria com foto anexada'}</span>
                </div>
              )}

              <div className="mt-auto space-y-3">
                <div className="flex items-center justify-between text-sm bg-slate-50 dark:bg-slate-800/80 p-3 rounded-xl">
                  <div className="flex items-center text-slate-600 dark:text-slate-300">
                    <Clock className="w-4 h-4 mr-2" />
                    <span>
                      Entrada: {new Date(vehicle.checkInTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      {isOvernight && (
                        <span className="block text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                          {new Date(vehicle.checkInTime).toLocaleDateString('pt-BR')}
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="font-medium text-slate-900 dark:text-slate-100 block tabular-nums">
                      {formatDuration(vehicle.checkInTime, nowTime)}
                    </span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold text-sm block mt-0.5 tabular-nums">
                      Est. R$ {calculatePrice(vehicle, pricing, nowTime, hourlyEnabled).toFixed(2)}
                    </span>
                  </div>
                </div>

                {(showTicketBtn || deviceConfig?.enableWhatsappReceipts) && (
                  <div className="flex gap-2">
                    {showTicketBtn && (
                      <button
                        type="button"
                        onClick={() => handlePrintTicket(vehicle)}
                        className="flex-1 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        {deviceConfig?.enableQrTicketScanner ? 'Ticket QR' : 'Imprimir'}
                      </button>
                    )}
                    {deviceConfig?.enableWhatsappReceipts && (
                      <button
                        type="button"
                        onClick={() => openWhatsappMessage(buildCheckInWhatsappText(vehicle))}
                        className="flex-1 py-2 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        WhatsApp
                      </button>
                    )}
                  </div>
                )}

                {deviceConfig?.canCheckOut !== false && (
                  <button
                    onClick={() => onCheckOut(vehicle)}
                    className="w-full py-2.5 bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-700 text-white rounded-xl font-medium transition-colors flex items-center justify-center"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Registrar Saída
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {filteredVehicles.length === 0 && (
          <div className="col-span-full py-12 text-center">
            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-1">Nenhum veículo encontrado</h3>
            <p className="text-slate-500 dark:text-slate-400">Não há veículos estacionados correspondentes à sua busca.</p>
          </div>
        )}
      </div>
    </div>
  );
}
