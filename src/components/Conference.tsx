import React, { useState } from 'react';
import { ParkedVehicle } from '../types';
import { generateThermalPrintHtml, printHtml } from '../utils/printHelper';
import { Printer, CheckCircle2, Circle, Search } from 'lucide-react';

interface ConferenceProps {
  vehicles: ParkedVehicle[];
}

export function Conference({ vehicles }: ConferenceProps) {
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');

  const filteredVehicles = vehicles.filter(v => 
    (v.cardNumber || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const allActive = filteredVehicles.filter(v => v.status === 'active' || v.status === 'stored');
  
  const activeVehicles = allActive.filter(v => v.status !== 'stored');
  const storedVehicles = allActive.filter(v => v.status === 'stored');
  
  const sortVehicles = (arr: ParkedVehicle[]) => {
    return arr.sort((a, b) => {
      const numA = parseInt(a.cardNumber?.replace(/\D/g, '') || '0', 10);
      const numB = parseInt(b.cardNumber?.replace(/\D/g, '') || '0', 10);
      if (numA !== numB) {
        return numA - numB;
      }
      return (a.cardNumber || '').localeCompare(b.cardNumber || '');
    });
  };
  
  const sn = sortVehicles(activeVehicles.filter(v => v.cardNumber?.startsWith('SN') || v.cardNumber?.startsWith('VIP')));
  const bikes = sortVehicles(activeVehicles.filter(v => v.type === 'bicycle' && !v.cardNumber?.startsWith('SN') && !v.cardNumber?.startsWith('VIP')));
  const ebikes = sortVehicles(activeVehicles.filter(v => v.type === 'ebike' && !v.cardNumber?.startsWith('SN') && !v.cardNumber?.startsWith('VIP')));
  const motos = sortVehicles(activeVehicles.filter(v => v.type === 'motorcycle' && !v.cardNumber?.startsWith('SN') && !v.cardNumber?.startsWith('VIP')));
  
  const storedSn = sortVehicles(storedVehicles.filter(v => v.cardNumber?.startsWith('SN') || v.cardNumber?.startsWith('VIP')));
  const storedBikes = sortVehicles(storedVehicles.filter(v => v.type === 'bicycle' && !v.cardNumber?.startsWith('SN') && !v.cardNumber?.startsWith('VIP')));
  const storedEbikes = sortVehicles(storedVehicles.filter(v => v.type === 'ebike' && !v.cardNumber?.startsWith('SN') && !v.cardNumber?.startsWith('VIP')));
  const storedMotos = sortVehicles(storedVehicles.filter(v => v.type === 'motorcycle' && !v.cardNumber?.startsWith('SN') && !v.cardNumber?.startsWith('VIP')));

  const handlePrintConference = () => {
    const renderCategory = (title: string, items: any[]) => {
      return `
        <div style="margin-bottom: 15px; border-bottom: 1px dashed #ccc; padding-bottom: 10px;">
          <h2 style="font-size: 12pt; margin-bottom: 6px;">${title} (${items.length})</h2>
          ${items.length > 0 ? `
          <div style="display: block;">
            ${items.map(v => `
              <div style="display: inline-block; width: 24%; box-sizing: border-box; border: 1px solid #000; padding: 6px 8px; border-radius: 4px; font-weight: bold; font-size: 13pt; vertical-align: top; margin-bottom: 8px; margin-right: 1%; page-break-inside: avoid; ${v.status === 'stored' ? 'background-color: #000 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; color: #fff !important; border: 1px dashed #000;' : ''}">
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 4px;">
                  <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${v.status === 'stored' ? 'DEP#' : '#'}${v.cardNumber || 'S/N'}</span>
                  <span style="border: 1px solid #000; width: 14px; height: 14px; display: inline-block; flex-shrink: 0;"></span>
                </div>
              </div>
            `).join('')}
          </div>
          ` : `<p style="font-size: 11pt; color: #666;">Nenhum veículo</p>`}
        </div>
      `;
    };

    const bodyHtml = `
      <h1>Conferência de Pátio</h1>
      <div class="subtitle" style="margin-bottom: 15px;">${new Date().toLocaleString('pt-BR')}</div>
      ${renderCategory('Bicicletas', bikes)}
      ${renderCategory('Bicicletas Elétricas (E-Bikes)', ebikes)}
      ${renderCategory('Motos', motos)}
      ${renderCategory('Vagas sem número', sn)}
      
      <div style="border-top: 2px solid #000; margin: 15px 0;"></div><h2 style="font-size: 12pt; margin-bottom: 8px;">Em Depósito</h2>
      ${renderCategory('Bicicletas (Depósito)', storedBikes)}
      ${renderCategory('Bicicletas Elétricas (Depósito)', storedEbikes)}
      ${renderCategory('Motos (Depósito)', storedMotos)}
      ${renderCategory('Vagas sem número (Depósito)', storedSn)}
      
      <div style="text-align: center; margin-top: 10px; border-top: 1px dashed #000; padding-top: 10px; page-break-inside: avoid;">
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
          <div className="grid grid-cols-5 gap-3">
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
                    {vehicle.cardNumber?.startsWith('SN') || vehicle.cardNumber?.startsWith('VIP') ? vehicle.cardNumber : `#${vehicle.cardNumber}`}
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
        <div className="mb-6 relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-slate-400" />
          </div>
          <input
            type="text"
            placeholder="Buscar por número do veículo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="block w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl leading-5 bg-slate-50 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-slate-900 focus:border-slate-900 transition-colors"
          />
        </div>

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
            
            <div className="mt-8 pt-8 border-t border-slate-200">
              {renderCategoryScreen('Bicicletas Elétricas (E-Bikes)', ebikes)}
            </div>
            
            <div className="mt-8 pt-8 border-t border-slate-200">
              {renderCategoryScreen('Motos', motos)}
            </div>
            
            <div className="mt-8 pt-8 border-t border-slate-200">
              {renderCategoryScreen('Vagas Sem Número', sn)}
            </div>
            
            <div className="mt-8 pt-8 border-t border-slate-200">
              <h2 className="text-xl font-bold text-yellow-700 mb-6 flex items-center gap-2">
                <span className="bg-yellow-100 p-2 rounded-lg"><CheckCircle2 className="w-5 h-5" /></span>
                Em Depósito
              </h2>
              {renderCategoryScreen('Bicicletas (Depósito)', storedBikes)}
              <div className="mt-6 pt-6 border-t border-yellow-200/50">
                {renderCategoryScreen('Bicicletas Elétricas (Depósito)', storedEbikes)}
              </div>
              <div className="mt-6 pt-6 border-t border-yellow-200/50">
                {renderCategoryScreen('Motos (Depósito)', storedMotos)}
              </div>
              <div className="mt-6 pt-6 border-t border-yellow-200/50">
                {renderCategoryScreen('Vagas Sem Número (Depósito)', storedSn)}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
