import React from 'react';
import { ParkedVehicle } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { DollarSign, TrendingUp, CreditCard, Moon } from 'lucide-react';

interface ReportsProps {
  vehicles: ParkedVehicle[];
}

export function Reports({ vehicles }: ReportsProps) {
  const completedVehicles = vehicles.filter(v => v.status === 'completed' && v.price);

  // 1. Revenue by Payment Method
  const revenueByPayment = completedVehicles.reduce((acc, v) => {
    const method = v.paymentMethod || 'cash';
    acc[method] = (acc[method] || 0) + (v.price || 0);
    return acc;
  }, {} as Record<string, number>);

  const paymentData = [
    { name: 'PIX', value: revenueByPayment['pix'] || 0, color: '#10b981' }, // emerald-500
    { name: 'Cartão', value: revenueByPayment['card'] || 0, color: '#3b82f6' }, // blue-500
    { name: 'Dinheiro', value: revenueByPayment['cash'] || 0, color: '#f59e0b' }, // amber-500
    { name: 'Pós-Pago', value: revenueByPayment['postpaid_card'] || 0, color: '#a855f7' }, // purple-500
  ].filter(d => d.value > 0);

  // 2. Revenue by Vehicle Type
  const revenueByType = completedVehicles.reduce((acc, v) => {
    acc[v.type] = (acc[v.type] || 0) + (v.price || 0);
    return acc;
  }, {} as Record<string, number>);

  const typeData = [
    { name: 'Bikes', value: revenueByType['bicycle'] || 0, fill: '#3b82f6' },
    { name: 'E-Bikes', value: revenueByType['ebike'] || 0, fill: '#10b981' },
    { name: 'Motos', value: revenueByType['motorcycle'] || 0, fill: '#a855f7' }, // purple-500
  ];

  // 3. Revenue over time (last 7 days)
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

  const totalRevenue = completedVehicles.reduce((sum, v) => sum + (v.price || 0), 0);

  // 4. Overnight Vehicles
  const now = new Date();
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  const overnightVehicles = vehicles.filter(v => {
    const checkInDate = new Date(v.checkInTime).setHours(0, 0, 0, 0);
    if (v.status === 'completed' && v.checkOutTime) {
      const checkOutDate = new Date(v.checkOutTime).setHours(0, 0, 0, 0);
      return checkOutDate > checkInDate;
    } else {
      return v.checkInTime < todayMidnight;
    }
  }).sort((a, b) => b.checkInTime - a.checkInTime);

  const overnightRevenue = overnightVehicles
    .filter(v => v.status === 'completed')
    .reduce((sum, v) => sum + (v.price || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Relatórios e Análises</h1>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center space-x-4">
          <div className="bg-emerald-100 p-3 rounded-xl">
            <DollarSign className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Receita Total</p>
            <h3 className="text-2xl font-bold text-slate-900">R$ {totalRevenue.toFixed(2)}</h3>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center space-x-4">
          <div className="bg-blue-100 p-3 rounded-xl">
            <TrendingUp className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Ticket Médio</p>
            <h3 className="text-2xl font-bold text-slate-900">
              R$ {completedVehicles.length > 0 ? (totalRevenue / completedVehicles.length).toFixed(2) : '0.00'}
            </h3>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center space-x-4">
          <div className="bg-purple-100 p-3 rounded-xl">
            <CreditCard className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Total de Transações</p>
            <h3 className="text-2xl font-bold text-slate-900">{completedVehicles.length}</h3>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue by Type */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-bold text-slate-900 mb-6">Receita por Tipo de Veículo</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={typeData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} tickFormatter={(value) => `R$${value}`} />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: number) => [`R$ ${value.toFixed(2)}`, 'Receita']}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Revenue by Payment Method */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-bold text-slate-900 mb-6">Métodos de Pagamento</h3>
          <div className="h-72 flex items-center justify-center">
            {paymentData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={paymentData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {paymentData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    formatter={(value: number) => [`R$ ${value.toFixed(2)}`, 'Receita']}
                  />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-slate-500">Sem dados suficientes</p>
            )}
          </div>
        </div>

        {/* Revenue Over Time */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 lg:col-span-2">
          <h3 className="text-lg font-bold text-slate-900 mb-6">Receita nos Últimos 7 Dias</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timeData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} tickFormatter={(value) => `R$${value}`} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: number) => [`R$ ${value.toFixed(2)}`, 'Receita']}
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

        {/* Overnight Report Section */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 lg:col-span-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <h3 className="text-lg font-bold text-slate-900 flex items-center">
              <Moon className="w-5 h-5 mr-2 text-amber-500" />
              Relatório de Pernoites
            </h3>
            <div className="flex flex-wrap gap-2 text-sm">
              <div className="bg-amber-50 text-amber-700 px-3 py-1 rounded-lg font-medium">
                Total: {overnightVehicles.length} veículos
              </div>
              <div className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-lg font-medium">
                Receita: R$ {overnightRevenue.toFixed(2)}
              </div>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-sm font-medium text-slate-500">
                  <th className="p-4">Cartão</th>
                  <th className="p-4">Veículo</th>
                  <th className="p-4">Entrada</th>
                  <th className="p-4">Saída</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {overnightVehicles.map((vehicle) => (
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
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                        vehicle.status === 'active' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-800'
                      }`}>
                        {vehicle.status === 'active' ? 'Pernoite Ativo' : 'Finalizado'}
                      </span>
                    </td>
                    <td className="p-4 text-right font-medium text-slate-900">
                      {vehicle.price ? `R$ ${vehicle.price.toFixed(2)}` : '-'}
                    </td>
                  </tr>
                ))}
                {overnightVehicles.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-500">
                      Nenhum registro de pernoite encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
