import React, { useState } from 'react';
import { ParkedVehicle } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { DollarSign, TrendingUp, CreditCard, Moon, Search, Calendar, ArrowRightLeft, Bike, LogOut } from 'lucide-react';

interface ReportsProps {
  vehicles: ParkedVehicle[];
}

export function Reports({ vehicles }: ReportsProps) {
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );

  const reportDate = new Date(selectedDate + 'T00:00:00');
  const startOfDay = reportDate.setHours(0, 0, 0, 0);
  const endOfDay = reportDate.setHours(23, 59, 59, 999);

  const completedVehiclesDaily = vehicles.filter(v => 
    v.status === 'completed' && v.price && v.checkOutTime && v.checkOutTime >= startOfDay && v.checkOutTime <= endOfDay
  );

  const entriesDaily = vehicles.filter(v => v.checkInTime >= startOfDay && v.checkInTime <= endOfDay);
  const exitsDaily = vehicles.filter(v => v.status === 'completed' && v.checkOutTime && v.checkOutTime >= startOfDay && v.checkOutTime <= endOfDay);

  const totalRevenueDaily = completedVehiclesDaily.reduce((sum, v) => sum + (v.price || 0), 0);

  // 1. Revenue by Payment Method (Daily)
  const revenueByPaymentDaily = completedVehiclesDaily.reduce((acc, v) => {
    const method = v.paymentMethod || 'cash';
    acc[method] = (acc[method] || 0) + (v.price || 0);
    return acc;
  }, {} as Record<string, number>);

  const paymentDataDaily = [
    { name: 'PIX', value: revenueByPaymentDaily['pix'] || 0, color: '#10b981' }, // emerald-500
    { name: 'Cartão', value: revenueByPaymentDaily['card'] || 0, color: '#3b82f6' }, // blue-500
    { name: 'Dinheiro', value: revenueByPaymentDaily['cash'] || 0, color: '#f59e0b' }, // amber-500
    { name: 'Pós-Pago', value: revenueByPaymentDaily['postpaid_card'] || 0, color: '#a855f7' }, // purple-500
  ].filter(d => d.value > 0);

  // 2. Revenue by Vehicle Type (Daily)
  const revenueByTypeDaily = completedVehiclesDaily.reduce((acc, v) => {
    acc[v.type] = (acc[v.type] || 0) + (v.price || 0);
    return acc;
  }, {} as Record<string, number>);

  const typeDataDaily = [
    { name: 'Bikes', value: revenueByTypeDaily['bicycle'] || 0, fill: '#3b82f6' },
    { name: 'E-Bikes', value: revenueByTypeDaily['ebike'] || 0, fill: '#10b981' },
    { name: 'Motos', value: revenueByTypeDaily['motorcycle'] || 0, fill: '#a855f7' }, // purple-500
  ];

  // 3. Overall All Time Data for historic context
  const completedVehicles = vehicles.filter(v => v.status === 'completed' && v.price);

  const last7Days = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }).reverse();

  const timeData = last7Days.map(timestamp => {
    const date = new Date(timestamp);
    const nextDay = timestamp + 86400000;
    
    const dayRevenue = completedVehicles
      .filter(v => v.checkOutTime && v.checkOutTime >= timestamp && v.checkOutTime < nextDay)
      .reduce((sum, v) => sum + (v.price || 0), 0);

    return {
      date: date.toLocaleDateString('pt-BR', { weekday: 'short' }),
      receita: dayRevenue
    };
  });

  // 4. Overnight Vehicles (Relative to the selected date)
  const overnightVehiclesDaily = vehicles.filter(v => {
    const checkedInBeforeToday = v.checkInTime < startOfDay;
    const activeToday = (v.status === 'active' || v.status === 'stored' || (v.checkOutTime && v.checkOutTime >= startOfDay));
    return checkedInBeforeToday && activeToday;
  }).sort((a, b) => b.checkInTime - a.checkInTime);

  const overnightRevenueDaily = overnightVehiclesDaily
    .filter(v => v.status === 'completed' && v.checkOutTime && v.checkOutTime >= startOfDay && v.checkOutTime <= endOfDay)
    .reduce((sum, v) => sum + (v.price || 0), 0);

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Relatório Diário</h1>
          <p className="text-sm text-slate-500">Resumo financeiro e fluxo de veículos do dia selecionado</p>
        </div>
        
        <div className="flex items-center space-x-2 bg-white rounded-xl shadow-sm border border-slate-200 p-1 pl-3 transition-shadow hover:shadow-md">
          <Calendar className="w-5 h-5 text-emerald-500" />
          <input 
            type="date" 
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-transparent border-0 focus:ring-0 text-slate-700 font-bold p-2 outline-none cursor-pointer"
          />
        </div>
      </div>

      {/* Daily Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center space-x-4">
          <div className="bg-emerald-100 p-3 rounded-xl">
            <DollarSign className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Faturamento</p>
            <h3 className="text-2xl font-black text-slate-900">R$ {totalRevenueDaily.toFixed(2)}</h3>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center space-x-4">
          <div className="bg-blue-100 p-3 rounded-xl">
            <TrendingUp className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Ticket Médio</p>
            <h3 className="text-2xl font-black text-slate-900">
              R$ {completedVehiclesDaily.length > 0 ? (totalRevenueDaily / completedVehiclesDaily.length).toFixed(2) : '0.00'}
            </h3>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center space-x-4">
          <div className="bg-indigo-100 p-3 rounded-xl">
            <ArrowRightLeft className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Entradas do Dia</p>
            <h3 className="text-2xl font-black text-slate-900">{entriesDaily.length}</h3>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center space-x-4">
          <div className="bg-purple-100 p-3 rounded-xl">
            <LogOut className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Saídas Concluídas</p>
            <h3 className="text-2xl font-black text-slate-900">{exitsDaily.length}</h3>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue by Type */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center">
            <Bike className="w-5 h-5 mr-2 text-blue-500" />
            Receita por Categoria (Diário)
          </h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={typeDataDaily}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} tickFormatter={(value) => "R$ " + value} />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: number) => ["R$ " + value.toFixed(2), 'Faturamento']}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Revenue by Payment Method */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center">
            <CreditCard className="w-5 h-5 mr-2 text-emerald-500" />
            Métodos de Pagamento (Diário)
          </h3>
          <div className="h-72 flex items-center justify-center">
            {paymentDataDaily.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={paymentDataDaily}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {paymentDataDaily.map((entry, index) => (
                      <Cell key={"cell-" + index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    formatter={(value: number) => ["R$ " + value.toFixed(2), 'Faturamento']}
                  />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-slate-500 font-medium">Nenhum faturamento registrado neste dia</p>
            )}
          </div>
        </div>

        {/* Overnight Report Section */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 lg:col-span-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <h3 className="text-lg font-bold text-slate-900 flex items-center">
              <Moon className="w-5 h-5 mr-2 text-amber-500" />
              Relatório de Pernoites (Deste dia)
            </h3>
            <div className="flex flex-wrap gap-2 text-sm">
              <div className="bg-amber-50 text-amber-700 px-3 py-1 rounded-lg font-bold">
                Total: {overnightVehiclesDaily.length} veículos
              </div>
              <div className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-lg font-bold">
                Receita (Hoje): R$ {overnightRevenueDaily.toFixed(2)}
              </div>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-sm font-bold text-slate-500">
                  <th className="p-4 rounded-tl-xl">Cartão</th>
                  <th className="p-4">Veículo</th>
                  <th className="p-4">Entrada</th>
                  <th className="p-4">Saída</th>
                  <th className="p-4">Situação</th>
                  <th className="p-4 text-right rounded-tr-xl">Valor Pago (Hoje)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {overnightVehiclesDaily.map((vehicle) => {
                  const hasCheckedOutToday = vehicle.status === 'completed' && vehicle.checkOutTime && vehicle.checkOutTime >= startOfDay && vehicle.checkOutTime <= endOfDay;
                  
                  return (
                  <tr key={vehicle.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-4 font-bold text-emerald-600">#{vehicle.cardNumber || '-'}</td>
                    <td className="p-4 font-medium text-slate-900">{vehicle.identifier}</td>
                    <td className="p-4 text-slate-600">
                      {new Date(vehicle.checkInTime).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="p-4 text-slate-600">
                      {vehicle.checkOutTime ? new Date(vehicle.checkOutTime).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'}
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
                        hasCheckedOutToday ? 'bg-slate-100 text-slate-800 border border-slate-200' : 'bg-amber-100 text-amber-800 border border-amber-200'
                      }`}>
                        {hasCheckedOutToday ? 'Finalizado Hoje' : 'Pernoite Ativo'}
                      </span>
                    </td>
                    <td className="p-4 text-right font-bold text-slate-900">
                      {hasCheckedOutToday && vehicle.price ? "R$ " + vehicle.price.toFixed(2) : '-'}
                    </td>
                  </tr>
                )})}
                {overnightVehiclesDaily.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-500 font-medium">
                      Nenhum registro de pernoite encontrado neste dia.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Revenue Over Time (General Historical Data) */}
        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 lg:col-span-2 shadow-inner">
          <h3 className="text-sm font-bold text-slate-500 mb-6 uppercase tracking-wider">Desempenho Geral - Últimos 7 Dias</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timeData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#64748b'}} />
                <YAxis axisLine={false} tickLine={false} tickFormatter={(value) => "R$ " + value} tick={{fill: '#64748b'}} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: number) => ["R$ " + value.toFixed(2), 'Receita']}
                />
                <Line 
                  type="monotone" 
                  dataKey="receita" 
                  stroke="#10b981" 
                  strokeWidth={3}
                  dot={{ r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }}
                  activeDot={{ r: 6, fill: '#10b981', strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </div>
  );
}
