import React, { useState } from 'react';
import { ParkedVehicle, Shift } from '../types';
import { generateThermalPrintHtml, printHtml } from '../utils/printHelper';
import { Printer, CheckCircle2, Circle, Search } from 'lucide-react';

interface ConferenceProps {
  vehicles: ParkedVehicle[];
  shifts: Shift[];
}

export function Conference({ vehicles, shifts }: ConferenceProps) {
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [targetDate, setTargetDate] = useState<string>(''); // YYYY-MM-DD

  const getTargetTime = () => {
    if (!targetDate) return Date.now();
    const [year, month, day] = targetDate.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    date.setHours(23, 59, 59, 999);
    return date.getTime();
  };

  const targetTime = getTargetTime();

  const filteredVehicles = vehicles.filter(v => {
    const matchesSearch = (v.cardNumber || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    if (!targetDate) {
      return matchesSearch && (v.status === 'active' || v.status === 'stored');
    }

    const checkedInBefore = v.checkInTime <= targetTime;
    const checkedOutAfter = !v.checkOutTime || v.checkOutTime > targetTime;
    
    return matchesSearch && checkedInBefore && checkedOutAfter;
  });

  const allActive = filteredVehicles;
  
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

  let displayShift;
  if (targetDate) {
    const [year, month, day] = targetDate.split('-').map(Number);
    const startOfDay = new Date(year, month - 1, day).getTime();
    const endOfDay = startOfDay + 86400000;
    // Get the last shift that overlaps with the selected date
    displayShift = shifts.slice().reverse().find(s => 
      (s.startTime >= startOfDay && s.startTime < endOfDay) || 
      (s.endTime && s.endTime >= startOfDay && s.endTime < endOfDay)
    );
  } else {
    displayShift = shifts.find(s => s.status === 'open') || shifts[shifts.length - 1];
  }

  const dateText = targetDate 
    ? `Data consultada: ${targetDate.split('-').reverse().join('/')}` 
    : new Date().toLocaleString('pt-BR');

  const handlePrintConference = () => {
    const renderCategory = (title: string, items: any[]) => {
      return `
        <div style="margin-bottom: 15px; border-bottom: 1px dashed #ccc; padding-bottom: 10px;">
          <h2 style="font-size: 28pt; margin-bottom: 10px;">${title} (${items.length})</h2>
          ${items.length > 0 ? `
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px;">
            ${items.map(v => `
              <div style="box-sizing: border-box; border: 1px solid #000; padding: 10px; border-radius: 6px; font-weight: bold; font-size: 22pt; page-break-inside: avoid; text-align: center; ${v.status === 'stored' ? 'background-color: #000 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; color: #fff !important; border: 1px dashed #000;' : ''}">
                <div style="display: flex; align-items: center; justify-content: center; gap: 4px;">
                  <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${v.status === 'stored' ? 'DEP ' : ''}${v.cardNumber || 'S/N'}</span>
                </div>
              </div>
            `).join('')}
          </div>
          ` : `<p style="font-size: 24pt; color: #666;">Nenhum veículo</p>`}
        </div>
      `;
    };
    
    const bodyHtml = `
      <h1 style="font-size: 32pt; font-weight: 900; margin-bottom: 15px; text-align: center; text-transform: uppercase; color: #000; border-bottom: 2px dashed #000; padding-bottom: 10px;">Conferência de Pátio</h1>
      <div style="text-align: center; font-size: 24pt; margin-bottom: 10px; font-weight: 900;">Data: ${dateText}</div>
      <div style="text-align: center; font-size: 22pt; margin-bottom: 10px;">Operador: ${displayShift?.operatorName || 'Não informado'}</div>
      <div style="text-align: center; font-size: 22pt; margin-bottom: 25px;">Troco Caixa: ${displayShift?.initialChange?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) || 'R$ 0,00'}</div>
      ${renderCategory('Bicicletas', bikes)}
      ${renderCategory('Bicicletas Elétricas (E-Bikes)', ebikes)}
      ${renderCategory('Motos', motos)}
      ${renderCategory('Vagas sem número', sn)}
      
      <div style="border-top: 2px solid #000; margin: 20px 0;"></div><h2 style="font-size: 28pt; margin-bottom: 12px;">Em Depósito</h2>
      ${renderCategory('Bicicletas (Depósito)', storedBikes)}
      ${renderCategory('Bicicletas Elétricas (Depósito)', storedEbikes)}
      ${renderCategory('Motos (Depósito)', storedMotos)}
      ${renderCategory('Vagas sem número (Depósito)', storedSn)}
      
      <div style="text-align: center; margin-top: 20px; border-top: 1px dashed #000; padding-top: 15px; page-break-inside: avoid;">
        <h2 style="font-size: 28pt; font-weight: 900; margin: 0 0 15px 0; text-transform: uppercase; color: #000; text-align: center;">Total Geral: ${allActive.length}</h2>
      </div>
      <div style="text-align: center; margin-top: 40px; font-size: 24pt; color: #000; font-weight: bold; padding-bottom: 20px;">
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
        <h2 className="text-base font-bold text-slate-800 mb-3 flex items-center gap-2">
          {title} 
          <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-xs">
            {items.length}
          </span>
        </h2>
        {items.length === 0 ? (
          <p className="text-slate-400 italic text-sm">Nenhum veículo</p>
        ) : (
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
            {items.map(vehicle => {
              const isChecked = checkedIds.has(vehicle.id);
              return (
                <button
                  key={vehicle.id}
                  onClick={() => toggleCheck(vehicle.id)}
                  className={`flex items-center justify-between p-2 rounded-lg border transition-all ${
                    vehicle.status === 'stored'
                      ? isChecked
                        ? 'bg-yellow-400 border-yellow-600 text-yellow-900 shadow-inner ring-2 ring-yellow-500'
                        : 'bg-yellow-200 border-yellow-400 text-yellow-900 shadow-sm'
                      : isChecked 
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-sm' 
                        : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <span className="font-bold text-sm">
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-white p-6 rounded-2xl border border-slate-100 shadow-sm gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Conferência de Pátio</h1>
          <p className="text-slate-500 mt-1 mb-2">Total de {allActive.length} veículos estacionados</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm font-medium text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100">
            <div><span className="text-slate-400">Data:</span> {dateText.replace('Data consultada: ', '')}</div>
            <div><span className="text-slate-400">Operador:</span> {displayShift?.operatorName || 'Não informado'}</div>
            <div><span className="text-slate-400">Troco Caixa:</span> {displayShift?.initialChange?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) || 'R$ 0,00'}</div>
          </div>
        </div>
        <button
          onClick={handlePrintConference}
          className="bg-slate-900 text-white px-5 py-2.5 rounded-xl font-medium hover:bg-slate-800 transition-colors flex items-center shadow-sm self-start sm:self-center"
        >
          <Printer className="w-5 h-5 mr-2" />
          <span className="hidden sm:inline">Imprimir Folha</span>
        </button>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm min-h-[500px]">
        <div className="mb-6 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
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
          <div className="sm:w-48">
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="block w-full px-3 py-3 border border-slate-200 rounded-xl leading-5 bg-slate-50 text-slate-700 focus:outline-none focus:bg-white focus:ring-2 focus:ring-slate-900 focus:border-slate-900 transition-colors"
            />
            <p className="text-xs text-slate-500 mt-1 pl-1">Data passada (opcional)</p>
          </div>
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
