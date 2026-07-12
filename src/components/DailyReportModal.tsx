import React from 'react';
import { Transaction, ParkedVehicle, Shift } from '../types';
import { X, Printer, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { generateThermalPrintHtml, printHtml } from '../utils/printHelper';

interface DailyReportModalProps {
  date: string; // YYYY-MM-DD
  vehicles: ParkedVehicle[];
  transactions: Transaction[];
  shifts: Shift[];
  onClose: () => void;
}

export function DailyReportModal({ date, vehicles, transactions, shifts, onClose }: DailyReportModalProps) {
  const [year, month, day] = date.split('-').map(Number);
  const startOfDay = new Date(year, month - 1, day, 0, 0, 0).getTime();
  const endOfDay = new Date(year, month - 1, day, 23, 59, 59, 999).getTime();

  const prevStartOfDay = startOfDay - 24 * 60 * 60 * 1000;
  const prevEndOfDay = endOfDay - 24 * 60 * 60 * 1000;

  // Daily Shifts
  const dailyShifts = shifts.filter(s => {
    return s.openedAt >= startOfDay && s.openedAt <= endOfDay;
  }).sort((a, b) => a.openedAt - b.openedAt);

  // Operational Data (Today)
  const entriesToday = vehicles.filter(v => v.checkInTime >= startOfDay && v.checkInTime <= endOfDay);
  const exitsToday = vehicles.filter(v => v.status === 'completed' && v.checkOutTime && v.checkOutTime >= startOfDay && v.checkOutTime <= endOfDay);

  const bikesIn = entriesToday.filter(v => v.type === 'bicycle').length;
  const bikesOut = exitsToday.filter(v => v.type === 'bicycle').length;
  const ebikesIn = entriesToday.filter(v => v.type === 'ebike').length;
  const ebikesOut = exitsToday.filter(v => v.type === 'ebike').length;
  const motosIn = entriesToday.filter(v => v.type === 'motorcycle').length;
  const motosOut = exitsToday.filter(v => v.type === 'motorcycle').length;

  // Operational Data (Yesterday)
  const entriesYest = vehicles.filter(v => v.checkInTime >= prevStartOfDay && v.checkInTime <= prevEndOfDay);
  const exitsYest = vehicles.filter(v => v.status === 'completed' && v.checkOutTime && v.checkOutTime >= prevStartOfDay && v.checkOutTime <= prevEndOfDay);
  
  const totalInToday = entriesToday.length;
  const totalOutToday = exitsToday.length;
  const totalInYest = entriesYest.length;
  const totalOutYest = exitsYest.length;

  // Financial Data (Today)
  const manualTransactions = transactions.filter(t => t.date >= startOfDay && t.date <= endOfDay);
  const totalIncomeTransactions = manualTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
  const totalExpenseTransactions = manualTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  
  const dailyCheckouts = exitsToday.filter(v => !['fiado', 'card', 'postpaid_card'].includes(v.paymentMethod || ''));
  
  const totalCash = dailyCheckouts.filter(v => v.paymentMethod === 'cash').reduce((sum, v) => sum + (v.price || 0), 0) + 
                    manualTransactions.filter(t => t.type === 'income' && t.description.toLowerCase().includes('dinheiro')).reduce((sum, t) => sum + t.amount, 0);
  const totalPix = dailyCheckouts.filter(v => v.paymentMethod === 'pix').reduce((sum, v) => sum + (v.price || 0), 0) +
                   manualTransactions.filter(t => t.type === 'income' && t.description.toLowerCase().includes('pix')).reduce((sum, t) => sum + t.amount, 0);
  const totalMachine = dailyCheckouts.filter(v => v.paymentMethod === 'machine').reduce((sum, v) => sum + (v.price || 0), 0) +
                       manualTransactions.filter(t => t.type === 'income' && t.description.toLowerCase().includes('máquina')).reduce((sum, t) => sum + t.amount, 0);

  const totalIncome = totalCash + totalPix + totalMachine;
  const totalExpense = totalExpenseTransactions;
  const netTotal = totalIncome - totalExpense;

  // Financial Data (Yesterday)
  const yestManualTransactions = transactions.filter(t => t.date >= prevStartOfDay && t.date <= prevEndOfDay);
  const yestExits = vehicles.filter(v => v.status === 'completed' && v.checkOutTime && v.checkOutTime >= prevStartOfDay && v.checkOutTime <= prevEndOfDay);
  const yestCheckouts = yestExits.filter(v => !['fiado', 'card', 'postpaid_card'].includes(v.paymentMethod || ''));
  const yestTotalIncome = yestManualTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0) + 
                          yestCheckouts.reduce((sum, v) => sum + (v.price || 0), 0);
  const yestTotalExpense = yestManualTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  const yestNetTotal = yestTotalIncome - yestTotalExpense;

  const getTrendIcon = (current: number, previous: number) => {
    if (current > previous) return <TrendingUp className="w-4 h-4 text-emerald-500" />;
    if (current < previous) return <TrendingDown className="w-4 h-4 text-red-500" />;
    return <Minus className="w-4 h-4 text-slate-400" />;
  };
  const getTrendColor = (current: number, previous: number) => {
    if (current > previous) return 'text-emerald-600';
    if (current < previous) return 'text-red-600';
    return 'text-slate-500';
  };

  const handlePrint = () => {
    let shiftsHtml = '';
    dailyShifts.forEach((s, idx) => {
      shiftsHtml += `
        <div style="margin-bottom: 10px; border-bottom: 1px dashed #000; padding-bottom: 5px;">
          <div style="font-weight: bold;">Turno ${idx + 1} - ${s.operatorName}</div>
          <div style="font-size: 10pt;">
            Abertura: ${new Date(s.openedAt).toLocaleTimeString('pt-BR')}<br>
            Fechamento: ${s.closedAt ? new Date(s.closedAt).toLocaleTimeString('pt-BR') : 'Em andamento'}<br>
            Troco Inicial: R$ ${s.initialChange.toFixed(2)}<br>
            ${s.closedAt ? `Troco Final Informado: R$ ${(s.finalChange || 0).toFixed(2)}` : ''}
          </div>
        </div>
      `;
    });

    const bodyHtml = `
      <h1>Fechamento Diário</h1>
      <div class="subtitle" style="margin-bottom: 15px;">Data: ${date.split('-').reverse().join('/')}</div>
      
      <div class="section">
        <h2>Operacional (Entradas / Saídas)</h2>
        <table style="width: 100%; font-size: 10pt;">
          <tr><td>Bicicletas</td><td style="text-align: right;">${bikesIn} / ${bikesOut}</td></tr>
          <tr><td>E-Bikes</td><td style="text-align: right;">${ebikesIn} / ${ebikesOut}</td></tr>
          <tr><td>Motos</td><td style="text-align: right;">${motosIn} / ${motosOut}</td></tr>
          <tr style="font-weight: bold; border-top: 1px solid #000;">
            <td>Total</td><td style="text-align: right;">${totalInToday} / ${totalOutToday}</td>
          </tr>
        </table>
      </div>

      <div class="section">
        <h2>Financeiro</h2>
        <div class="row"><span class="label">Dinheiro</span> <span class="value">R$ ${totalCash.toFixed(2)}</span></div>
        <div class="row"><span class="label">PIX</span> <span class="value">R$ ${totalPix.toFixed(2)}</span></div>
        <div class="row"><span class="label">Máquina</span> <span class="value">R$ ${totalMachine.toFixed(2)}</span></div>
        <div class="row" style="font-weight: bold;"><span class="label">Total Entradas</span> <span class="value">R$ ${totalIncome.toFixed(2)}</span></div>
        <div class="row" style="color: #666;"><span class="label">Total Saídas</span> <span class="value">- R$ ${totalExpense.toFixed(2)}</span></div>
        <div class="row" style="font-weight: bold; margin-top: 5px; border-top: 1px solid #000; padding-top: 5px;">
          <span class="label">Saldo Líquido</span> <span class="value">R$ ${netTotal.toFixed(2)}</span>
        </div>
      </div>

      ${dailyShifts.length > 0 ? `
      <div class="section">
        <h2>Turnos do Dia</h2>
        ${shiftsHtml}
      </div>
      ` : ''}

      <div class="footer">
        <p>Bikepark - Fechamento Diário</p>
      </div>
    `;

    const html = generateThermalPrintHtml('Fechamento Diário', bodyHtml);
    printHtml(html);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Fechamento Detalhado</h2>
            <p className="text-sm text-slate-500">Referente ao dia {date.split('-').reverse().join('/')}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-8 bg-slate-50/50">
          {/* Operational Comparison */}
          <div>
            <h3 className="text-lg font-bold text-slate-800 mb-4">Operacional (Entradas / Saídas)</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <p className="text-sm font-medium text-slate-500 mb-2">Total</p>
                <div className="flex items-end justify-between">
                  <div className="text-xl font-bold text-slate-900">{totalInToday} / {totalOutToday}</div>
                  <div className={`flex items-center text-sm font-medium ${getTrendColor(totalInToday, totalInYest)}`}>
                    {getTrendIcon(totalInToday, totalInYest)}
                    <span className="ml-1">vs {totalInYest}/{totalOutYest}</span>
                  </div>
                </div>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <p className="text-sm font-medium text-slate-500 mb-2">Bicicletas</p>
                <div className="text-lg font-bold text-slate-900">{bikesIn} / {bikesOut}</div>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <p className="text-sm font-medium text-slate-500 mb-2">E-Bikes</p>
                <div className="text-lg font-bold text-slate-900">{ebikesIn} / {ebikesOut}</div>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <p className="text-sm font-medium text-slate-500 mb-2">Motos</p>
                <div className="text-lg font-bold text-slate-900">{motosIn} / {motosOut}</div>
              </div>
            </div>
          </div>

          {/* Financial Summary */}
          <div>
            <h3 className="text-lg font-bold text-slate-800 mb-4">Financeiro</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                <p className="text-sm font-medium text-emerald-800 mb-1">Entradas</p>
                <p className="text-2xl font-bold text-emerald-900">R$ {totalIncome.toFixed(2)}</p>
                <div className="text-xs text-emerald-700 mt-2 space-y-1">
                  <p>Dinheiro: R$ {totalCash.toFixed(2)}</p>
                  <p>PIX: R$ {totalPix.toFixed(2)}</p>
                  <p>Máquina: R$ {totalMachine.toFixed(2)}</p>
                </div>
              </div>
              <div className="bg-red-50 p-4 rounded-xl border border-red-100">
                <p className="text-sm font-medium text-red-800 mb-1">Saídas</p>
                <p className="text-2xl font-bold text-red-900">R$ {totalExpense.toFixed(2)}</p>
              </div>
              <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                <p className="text-sm font-medium text-blue-800 mb-1">Saldo Líquido</p>
                <div className="flex items-end justify-between">
                  <p className="text-2xl font-bold text-blue-900">R$ {netTotal.toFixed(2)}</p>
                </div>
                <div className={`flex items-center text-sm font-medium mt-2 ${getTrendColor(netTotal, yestNetTotal)}`}>
                  {getTrendIcon(netTotal, yestNetTotal)}
                  <span className="ml-1">Ontem: R$ {yestNetTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Shifts Breakdown */}
          <div>
            <h3 className="text-lg font-bold text-slate-800 mb-4">Turnos do Dia ({dailyShifts.length})</h3>
            {dailyShifts.length === 0 ? (
              <p className="text-slate-500 italic">Nenhum turno registrado neste dia.</p>
            ) : (
              <div className="space-y-3">
                {dailyShifts.map((shift, idx) => (
                  <div key={shift.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h4 className="font-bold text-slate-900">Turno {idx + 1} - {shift.operatorName}</h4>
                      <p className="text-sm text-slate-500">
                        {new Date(shift.openedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} 
                        {' - '}
                        {shift.closedAt ? new Date(shift.closedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : 'Em andamento'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-slate-600">Troco Inicial: <strong className="text-slate-900">R$ {shift.initialChange.toFixed(2)}</strong></p>
                      {shift.closedAt && (
                        <p className="text-sm text-slate-600">Troco Final (Informado): <strong className="text-slate-900">R$ {(shift.finalChange || 0).toFixed(2)}</strong></p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="p-6 border-t border-slate-100 flex justify-end">
          <button
            onClick={handlePrint}
            className="flex items-center px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-medium transition-colors"
          >
            <Printer className="w-5 h-5 mr-2" />
            Imprimir Fechamento
          </button>
        </div>
      </div>
    </div>
  );
}
