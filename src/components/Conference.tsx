import React, { useState } from 'react';
import { ParkedVehicle } from '../types';
import { generateThermalPrintHtml, printHtml } from '../utils/printHelper';
import { Printer, CheckCircle2, Circle } from 'lucide-react';

interface ConferenceProps {
  vehicles: ParkedVehicle[];
}

export function Conference({ vehicles }: ConferenceProps) {
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());

  const allActive = vehicles.filter(v => v.status === 'active' || v.status === 'stored');
  
  const activeVehicles = allActive.filter(v => v.status !== 'stored');
  const storedVehicles = allActive.filter(v => v.status === 'stored');
  
  const sn = activeVehicles.filter(v => v.cardNumber.startsWith('SN') || v.cardNumber.startsWith('VIP'));
  const bikes = activeVehicles.filter(v => v.type === 'bicycle' && !v.cardNumber.startsWith('SN') && !v.cardNumber.startsWith('VIP'));
  const ebikes = activeVehicles.filter(v => v.type === 'ebike' && !v.cardNumber.startsWith('SN') && !v.cardNumber.startsWith('VIP'));
  const motos = activeVehicles.filter(v => v.type === 'motorcycle' && !v.cardNumber.startsWith('SN') && !v.cardNumber.startsWith('VIP'));
  
  const storedSn = storedVehicles.filter(v => v.cardNumber.startsWith('SN') || v.cardNumber.startsWith('VIP'));
  const storedBikes = storedVehicles.filter(v => v.type === 'bicycle' && !v.cardNumber.startsWith('SN') && !v.cardNumber.startsWith('VIP'));
  const storedEbikes = storedVehicles.filter(v => v.type === 'ebike' && !v.cardNumber.startsWith('SN') && !v.cardNumber.startsWith('VIP'));
  const storedMotos = storedVehicles.filter(v => v.type === 'motorcycle' && !v.cardNumber.startsWith('SN') && !v.cardNumber.startsWith('VIP'));

  const handlePrintConference = () => {
    const renderCategory = (title: string, items: any[]) => {
      return `
        <div class="section" style="margin-bottom: 15px;">
          <h2 style="font-size: 11pt; margin-bottom: 8px;">${title} (${items.length})</h2>
          ${items.length > 0 ? `
          <div style="display: flex; flex-wrap: wrap; gap: 8px;">
            ${items.map(v => `
              <div style="border: 1px solid #000; padding: 4px 8px; border-radius: 4px; font-weight: bold; font-size: 11pt; display: flex; align-items: center; gap: 8px; ${v.status === 'stored' ? 'background-color: #000 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; color: #fff !important; border: 2px dashed #000;' : ''}">
                <span>${v.status === 'stored' ? 'DEPÓSITO #' : '#'}${v.cardNumber}</span>
                <span style="border: 1px solid #000; width: 14px; height: 14px; display: inline-block;"></span>
              </div>
            `).join('')}
          </div>
          ` : `<p style="font-size: 10pt; color: #666;">Nenhum veículo</p>`}
        </div>
      `;
    };

    const bodyHtml = `
      <h1>Conferência de Pátio</h1>
      <div class="subtitle" style="margin-bottom: 15px;">${new Date().toLocaleString('pt-BR')}</div>
      ${renderCategory('Bikes', bikes)}
      ${renderCategory('E-Bikes', ebikes)}
      ${renderCategory('Motos', motos)}
      ${renderCategory('Vagas Sem Número', sn)}
      ${storedBikes.length > 0 ? renderCategory('Bikes em Depósito', storedBikes) : ''}
      ${storedEbikes.length > 0 ? renderCategory('E-Bikes em Depósito', storedEbikes) : ''}
      ${storedMotos.length > 0 ? renderCategory('Motos em Depósito', storedMotos) : ''}
      ${storedSn.length > 0 ? renderCategory('Sem Número em Depósito', storedSn) : ''}
      <div class="section" style="text-align: center; margin-top: 10px; border-top: 1px dashed #000; padding-top: 10px;">
        <h2>Total Geral: ${allActive.length}</h2>
      </div>
      <div class="footer">
        <p>Bikepark - Conferência</p>
      </div>
    `;
    
    const html = generateThermalPrintHtml('Conferência de Pátio', bodyHtml);
    printHtml(html);
  };

  const toggleCheck = (id: string) => {
    const newChecked = new Set(checkedIds);
    if (newChecked.has(id)) {
      newChecked.delete(id);
    } else {
      newChecked.add(id);
    }
    setCheckedIds(newChecked);
  };

  const renderCategoryScreen = (title: string, items: ParkedVehicle[]) => {
    return (
      <div className="mb-8">
        <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
          {title} 
          <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-sm">
            {items.length}
          </span>
        </h2>
        {items.length === 0 ? (
          <p className="text-slate-400 italic">Nenhum veículo</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {items.map(vehicle => {
              const isChecked = checkedIds.has(vehicle.id);
              return (
                <button
                  key={vehicle.id}
                  onClick={() => toggleCheck(vehicle.id)}
                  className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                    vehicle.status === 'stored'
                      ? isChecked
                        ? 'bg-yellow-400 border-yellow-600 text-yellow-900 shadow-inner ring-2 ring-yellow-500'
                        : 'bg-yellow-200 border-yellow-400 text-yellow-900 shadow-sm'
                      : isChecked 
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-sm' 
                        : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <span className="font-bold">
                    {vehicle.cardNumber.startsWith('SN') || vehicle.cardNumber.startsWith('VIP') ? vehicle.cardNumber : `#${vehicle.cardNumber}`}
                  </span>
                  {isChecked ? (
                    <CheckCircle2 className={`w-5 h-5 ${vehicle.status === 'stored' ? 'text-yellow-700' : 'text-emerald-500'}`} />
                  ) : (
                    <Circle className={`w-5 h-5 ${vehicle.status === 'stored' ? 'text-yellow-500' : 'text-slate-300'}`} />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Conferência de Pátio</h1>
          <p className="text-slate-500 mt-1">Total de {allActive.length} veículos estacionados</p>
        </div>
        <button
          onClick={handlePrintConference}
          className="bg-slate-900 text-white px-5 py-2.5 rounded-xl font-medium hover:bg-slate-800 transition-colors flex items-center shadow-sm"
        >
          <Printer className="w-5 h-5 mr-2" />
          <span className="hidden sm:inline">Imprimir Folha</span>
        </button>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm min-h-[500px]">
        {allActive.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500">
            <CheckCircle2 className="w-16 h-16 text-slate-200 mb-4" />
            <p className="text-lg">Nenhum veículo estacionado no momento.</p>
          </div>
        ) : (
          <>
            <div className="mb-6 flex justify-end">
              <button 
                onClick={() => setCheckedIds(new Set())}
                className="text-sm text-slate-500 hover:text-slate-700 underline"
              >
                Limpar marcações
              </button>
            </div>
            {renderCategoryScreen('Bicicletas', bikes)}
            {renderCategoryScreen('E-Bikes', ebikes)}
            {renderCategoryScreen('Motos', motos)}
            {renderCategoryScreen('Vagas Sem Número', sn)}
            
            {storedVehicles.length > 0 && (
              <div className="mt-8 pt-8 border-t border-slate-200">
                <h2 className="text-xl font-bold text-yellow-700 mb-6 flex items-center gap-2">
                  <span className="bg-yellow-100 p-2 rounded-lg"><CheckCircle2 className="w-5 h-5" /></span>
                  Em Depósito
                </h2>
                {storedBikes.length > 0 && renderCategoryScreen('Bicicletas', storedBikes)}
                {storedEbikes.length > 0 && renderCategoryScreen('E-Bikes', storedEbikes)}
                {storedMotos.length > 0 && renderCategoryScreen('Motos', storedMotos)}
                {storedSn.length > 0 && renderCategoryScreen('Vagas Sem Número', storedSn)}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
