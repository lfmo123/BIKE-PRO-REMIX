import React from 'react';
import { Shift, Transaction, ParkedVehicle, Sale } from '../types';
import { X, Printer } from 'lucide-react';
import { generateThermalPrintHtml, printHtml } from '../utils/printHelper';

interface ShiftDetailsModalProps {
  shift: Shift;
  onClose: () => void;
  vehicles: ParkedVehicle[];
  transactions: Transaction[];
  sales: Sale[];
}

export function ShiftDetailsModal({ shift, onClose, vehicles, transactions, sales }: ShiftDetailsModalProps) {
  // Re-calculate complex details
  const shiftTransactions = transactions.filter(t => t.date >= shift.startTime && (!shift.endTime || t.date <= shift.endTime));
  const checkedOutVehicles = vehicles.filter(v => v.status === 'completed' && v.checkOutTime && v.checkOutTime >= shift.startTime && (!shift.endTime || v.checkOutTime <= shift.endTime));
  const shiftSales = sales.filter(s => s.date >= shift.startTime && (!shift.endTime || s.date <= shift.endTime));

  let cash = 0;
  let card = 0; // or machine
  let fiado = 0;
  let postpaid = 0;
  let expenses = 0;
  let prepaid = 0; // if used

  // check out income
  checkedOutVehicles.forEach(v => {
      const p = v.price || 0;
      if (v.paymentMethod === 'cash') cash += p;
      else if (v.paymentMethod === 'machine') card += p;
      else if (v.paymentMethod === 'card') prepaid += p;
      else if (v.paymentMethod === 'fiado') fiado += p;
      else if (v.paymentMethod === 'postpaid_card') postpaid += p;
      else cash += p; // default
  });

  // sales income
  shiftSales.forEach(s => {
      const p = s.totalPrice || 0;
      if (s.paymentMethod === 'cash') cash += p;
      else if (s.paymentMethod === 'machine') card += p;
      else if (s.paymentMethod === 'card') prepaid += p;
      else if (s.paymentMethod === 'fiado') fiado += p;
      else if (s.paymentMethod === 'postpaid_card') postpaid += p;
      else cash += p; // default
  });

  // transactions
  shiftTransactions.forEach(t => {
      if (t.type === 'expense') {
          expenses += t.amount;
      } else {
          cash += t.amount; // Assume manual income is cash unless specified, normally we don't have method for manual in this basic app
      }
  });

  const totalIncomeReal = cash + card; 
  const totalPending = fiado + postpaid;
  const totalInternalBalances = prepaid;

  const handlePrint = () => {
    // We launch print using an iframe just like before, but with the detailed layout
    const bodyHtml = `
  <h1>Fechamento Turno</h1>
  
  <div class="header-info">
    <div class="header-row"><span class="label">Op:</span> <span class="value">${shift.operatorName}</span></div>
    <div class="header-row"><span class="label">Abre:</span> <span class="value" style="font-size:10pt;">${new Date(shift.startTime).toLocaleString('pt-BR')}</span></div>
    <div class="header-row"><span class="label">Fecha:</span> <span class="value" style="font-size:10pt;">${shift.endTime ? new Date(shift.endTime).toLocaleString('pt-BR') : 'Em aberto'}</span></div>
  </div>

  <div class="section">
    <h2>Caixa (Dinheiro)</h2>
    <div class="row"><span class="label">Fundo Inicial</span> <span class="value">R$ ${shift.initialChange.toFixed(2)}</span></div>
    <div class="row"><span class="label">Entradas</span> <span class="value">R$ ${cash.toFixed(2)}</span></div>
    <div class="row"><span class="label">Despesas</span> <span class="value">- R$ ${expenses.toFixed(2)}</span></div>
    <div class="total-row"><span class="label">Em Caixa</span> <span class="value">R$ ${(shift.initialChange + cash - expenses).toFixed(2)}</span></div>
    <div class="row" style="margin-top: 15px; padding-top: 15px; border-top: 2px dotted #000;"><span class="label">Troco Repassado</span> <span class="value">R$ ${(shift.finalChange || 0).toFixed(2)}</span></div>
  </div>

  <div class="section">
    <h2>Outras Entradas</h2>
    <div class="row"><span class="label">Máquina</span> <span class="value">R$ ${card.toFixed(2)}</span></div>
    <div class="row"><span class="label">Fiado</span> <span class="value">R$ ${fiado.toFixed(2)}</span></div>
  </div>

  <div class="section">
    <h2>A Receber / Abatido</h2>
    <div class="row"><span class="label">Pós-pago</span> <span class="value">R$ ${postpaid.toFixed(2)}</span></div>
    <div class="row"><span class="label">Uso Pré-pago</span> <span class="value">R$ ${prepaid.toFixed(2)}</span></div>
  </div>

  <div class="section">
    <h2>Operacional</h2>
    <div class="row"><span class="label">Check-outs</span> <span class="value">${shift.summary?.checkOuts || 0}</span></div>
    <div class="row"><span class="label">Check-ins</span> <span class="value">${shift.summary?.checkIns || 0}</span></div>
    <div class="row"><span class="label">Pernoites</span> <span class="value">${shift.summary?.overnightCount || 0}</span></div>
  </div>
  
  <div class="footer">
    <p>___________________</p>
    <p>${shift.operatorName}</p>
    <p>Gerado: ${new Date().toLocaleString('pt-BR')}</p>
    <p>Bikepark</p>
  </div>
`;
    const html = generateThermalPrintHtml(`Fechamento de Turno - ${shift.operatorName}`, bodyHtml);
    printHtml(html);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl flex flex-col">
        <div className="sticky top-0 bg-white border-b border-slate-100 p-4 md:p-6 flex justify-between items-center z-10">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Relatório de Fechamento</h2>
            <p className="text-sm text-slate-500">Operador: {shift.operatorName}</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-4 md:p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-50 p-4 rounded-xl">
              <span className="block text-xs font-bold text-slate-500 uppercase">Abertura</span>
              <span className="font-semibold">{new Date(shift.startTime).toLocaleString('pt-BR')}</span>
            </div>
            <div className="bg-slate-50 p-4 rounded-xl">
              <span className="block text-xs font-bold text-slate-500 uppercase">Fechamento</span>
              <span className="font-semibold">{shift.endTime ? new Date(shift.endTime).toLocaleString('pt-BR') : 'Em aberto'}</span>
            </div>
          </div>

          <div className="bg-white border text-sm border-slate-200 rounded-xl overflow-hidden">
            <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
              <h3 className="font-bold text-slate-800">Resumo de Caixa</h3>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex justify-between">
                <span className="text-slate-600">Fundo de Caixa (Abertura)</span>
                <span className="font-semibold">R$ {shift.initialChange.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Total Dinheiro (Espécie)</span>
                <span className="font-semibold text-emerald-600">+ R$ {cash.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Despesas / Sangrias</span>
                <span className="font-semibold text-rose-600">- R$ {expenses.toFixed(2)}</span>
              </div>
              <div className="pt-3 border-t border-slate-100 flex justify-between">
                <span className="font-bold">Saldo Esperado em Gaveta</span>
                <span className="font-bold text-lg text-emerald-700">R$ {(shift.initialChange + cash - expenses).toFixed(2)}</span>
              </div>
              <div className="flex justify-between bg-slate-50 p-2 rounded-lg">
                <span className="font-bold text-slate-700">Troco Informado / Repassado pelo Operador</span>
                <span className="font-bold text-blue-700">R$ {(shift.finalChange || 0).toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="bg-white border text-sm border-slate-200 rounded-xl overflow-hidden">
            <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
              <h3 className="font-bold text-slate-800">Detalhamento de Entradas</h3>
            </div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="border border-slate-100 p-3 rounded-xl text-center">
                  <span className="block text-xs font-bold text-slate-500 mb-1">MÁQUINA</span>
                  <span className="font-black text-lg text-slate-800">R$ {card.toFixed(2)}</span>
                </div>
                <div className="border border-slate-100 p-3 rounded-xl text-center">
                  <span className="block text-xs font-bold text-slate-500 mb-1">DINHEIRO</span>
                  <span className="font-black text-lg text-slate-800">R$ {cash.toFixed(2)}</span>
                </div>
                <div className="border border-slate-100 p-3 rounded-xl text-center">
                  <span className="block text-xs font-bold text-slate-500 mb-1">FIADO</span>
                  <span className="font-black text-lg text-slate-800 text-orange-600">R$ {fiado.toFixed(2)}</span>
                </div>
              </div>
              <div className="pt-3 flex justify-between items-center text-base border-t border-slate-100 mt-2">
                <span className="font-bold text-slate-700">Total Faturado (Incluindo Fiado)</span>
                <span className="font-black text-emerald-700">R$ {(totalIncomeReal + fiado).toFixed(2)}</span>
              </div>
            </div>
          </div>

          {postpaid > 0 && (
            <div className="bg-orange-50 border text-sm border-orange-200 rounded-xl overflow-hidden">
               <div className="bg-orange-100 px-4 py-3 border-b border-orange-200">
                 <h3 className="font-bold text-orange-900">Pagamentos Pendentes (A Receber)</h3>
               </div>
               <div className="p-4 space-y-3">
                 <div className="flex justify-between">
                   <span className="text-orange-800">Cartões Pós-Pagos (Acrescentado à conta)</span>
                   <span className="font-semibold text-orange-900">R$ {postpaid.toFixed(2)}</span>
                 </div>
               </div>
            </div>
          )}

          {prepaid > 0 && (
            <div className="bg-blue-50 border text-sm border-blue-200 rounded-xl overflow-hidden">
               <div className="bg-blue-100 px-4 py-3 border-b border-blue-200">
                 <h3 className="font-bold text-blue-900">Uso de Saldo de Clientes</h3>
               </div>
               <div className="p-4 space-y-3">
                 <div className="flex justify-between">
                   <span className="text-blue-800">Estacionamento Pago com Pré-pago</span>
                   <span className="font-semibold text-blue-900">R$ {prepaid.toFixed(2)}</span>
                 </div>
               </div>
            </div>
          )}
        </div>

        <div className="border-t border-slate-100 p-4 md:p-6 bg-slate-50 sticky bottom-0 rounded-b-2xl flex flex-col sm:flex-row gap-3 justify-end items-center mt-auto">
          <p className="text-xs text-slate-400 mr-auto flex-1">Use a impressão para Imprimir ou Salvar PDF</p>
          <button 
             onClick={onClose}
             className="w-full sm:w-auto px-5 py-2.5 font-bold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors"
          >
             Fechar
          </button>
          <button 
             onClick={handlePrint}
             className="w-full sm:w-auto px-5 py-2.5 font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors flex items-center justify-center"
          >
             <Printer className="w-4 h-4 mr-2" />
             Imprimir / Salvar PDF
          </button>
        </div>
      </div>
    </div>
  );
}
