import React, { useState } from 'react';
import { ParkedVehicle, Sale } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { DollarSign, TrendingUp, CreditCard, Moon, Search, Calendar, ArrowRightLeft, Bike, LogOut, BarChart3, X, Clock, Users, ShoppingCart } from 'lucide-react';
import { getLocalDateString } from '../lib/dateUtils';

interface ReportsProps {
  vehicles: ParkedVehicle[];
  sales?: Sale[];
}

export function Reports({ vehicles, sales = [] }: ReportsProps) {
  const [reportType, setReportType] = useState<'daily' | 'monthly' | 'custom' | 'cards' | 'store' | 'parked'>('daily');
  const [selectedDate, setSelectedDate] = useState<string>(
    getLocalDateString()
  );
  const [selectedMonth, setSelectedMonth] = useState<string>(
    getLocalDateString().slice(0, 7) // YYYY-MM
  );
  const [startDate, setStartDate] = useState<string>(
    getLocalDateString(Date.now() - 7 * 24 * 60 * 60 * 1000)
  );
  const [endDate, setEndDate] = useState<string>(
    getLocalDateString()
  );
  const [searchCard, setSearchCard] = useState<string>('');
  const [selectedVehicleDetails, setSelectedVehicleDetails] = useState<ParkedVehicle | null>(null);

  const reportDate = new Date(selectedDate + 'T00:00:00');
  const startOfDay = reportDate.setHours(0, 0, 0, 0);
  const endOfDay = reportDate.setHours(23, 59, 59, 999);

  const monthDate = new Date(selectedMonth + '-01T00:00:00');
  const startOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1).getTime();
  const endOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 23, 59, 59, 999).getTime();

  const calculateAverageTime = (completedV: ParkedVehicle[]) => {
    if (completedV.length === 0) return '0m';
    const totalMs = completedV.reduce((acc, v) => acc + ((v.checkOutTime || 0) - v.checkInTime), 0);
    const avgMs = totalMs / completedV.length;
    const hours = Math.floor(avgMs / (1000 * 60 * 60));
    const mins = Math.floor((avgMs % (1000 * 60 * 60)) / (1000 * 60));
    if (hours === 0) return `${mins}m`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
  };

  const activeVehiclesCount = vehicles.filter(v => v.status === 'active').length;

  // Daily Calculations
  const completedVehiclesDaily = vehicles.filter(v => 
    v.status === 'completed' && v.price && v.checkOutTime && v.checkOutTime >= startOfDay && v.checkOutTime <= endOfDay
  );

  const avgTimeDaily = calculateAverageTime(completedVehiclesDaily);

  const entriesDaily = vehicles.filter(v => v.checkInTime >= startOfDay && v.checkInTime <= endOfDay);
  const exitsDaily = vehicles.filter(v => v.status === 'completed' && v.checkOutTime && v.checkOutTime >= startOfDay && v.checkOutTime <= endOfDay);

  const totalRevenueDaily = completedVehiclesDaily.reduce((sum, v) => sum + (v.price || 0), 0);

  const revenueByPaymentDaily = completedVehiclesDaily.reduce((acc, v) => {
    const method = v.paymentMethod || 'cash';
    acc[method] = (acc[method] || 0) + (v.price || 0);
    return acc;
  }, {} as Record<string, number>);

  const paymentDataDaily = [
    { name: 'Pré Pago', value: revenueByPaymentDaily['card'] || 0, color: '#3b82f6' }, 
    { name: 'Máquina', value: revenueByPaymentDaily['machine'] || 0, color: '#6366f1' }, 
    { name: 'Dinheiro', value: revenueByPaymentDaily['cash'] || 0, color: '#f59e0b' }, 
    { name: 'Pós-Pago', value: revenueByPaymentDaily['postpaid_card'] || 0, color: '#a855f7' }, 
    { name: 'Aguardando Pag.', value: revenueByPaymentDaily['fiado'] || 0, color: '#ef4444' }, 
  ].filter(d => d.value > 0);

  const revenueByTypeDaily = completedVehiclesDaily.reduce((acc, v) => {
    acc[v.type] = (acc[v.type] || 0) + (v.price || 0);
    return acc;
  }, {} as Record<string, number>);

  const typeDataDaily = [
    { name: 'Bikes', value: revenueByTypeDaily['bicycle'] || 0, fill: '#3b82f6' },
    { name: 'E-Bikes', value: revenueByTypeDaily['ebike'] || 0, fill: '#10b981' },
    { name: 'Motos', value: revenueByTypeDaily['motorcycle'] || 0, fill: '#a855f7' }, 
  ];

  const movementByTypeDaily = ['bicycle', 'ebike', 'motorcycle', 'car'].map(type => {
    const entries = entriesDaily.filter(v => v.type === type).length;
    const exits = exitsDaily.filter(v => v.type === type).length;
    const active = vehicles.filter(v => v.type === type && v.status === 'active').length;
    const revenue = completedVehiclesDaily.filter(v => v.type === type).reduce((sum, v) => sum + (v.price || 0), 0);
    
    const typeLabel = type === 'bicycle' ? 'Bicicleta' : type === 'ebike' ? 'E-Bike' : type === 'motorcycle' ? 'Moto' : 'Carro';
    return { type: typeLabel, entries, exits, active, revenue };
  }).filter(m => m.entries > 0 || m.exits > 0 || m.active > 0 || m.revenue > 0);

  const startOfPrevDay = startOfDay - 86400000;
  const endOfPrevDay = startOfDay;

  const entriesPrevDay = vehicles.filter(v => v.checkInTime >= startOfPrevDay && v.checkInTime < endOfPrevDay);
  const exitsPrevDay = vehicles.filter(v => v.checkOutTime && v.checkOutTime >= startOfPrevDay && v.checkOutTime < endOfPrevDay);
  const completedVehiclesPrevDay = vehicles.filter(v => v.status === 'completed' && v.checkOutTime && v.checkOutTime >= startOfPrevDay && v.checkOutTime < endOfPrevDay);

  const movementByTypePrevDay = ['bicycle', 'ebike', 'motorcycle', 'car'].map(type => {
    const entries = entriesPrevDay.filter(v => v.type === type).length;
    const exits = exitsPrevDay.filter(v => v.type === type).length;
    const active = vehicles.filter(v => v.type === type && v.checkInTime < endOfPrevDay && (!v.checkOutTime || v.checkOutTime >= endOfPrevDay)).length;
    const revenue = completedVehiclesPrevDay.filter(v => v.type === type).reduce((sum, v) => sum + (v.price || 0), 0);
    
    const typeLabel = type === 'bicycle' ? 'Bicicleta' : type === 'ebike' ? 'E-Bike' : type === 'motorcycle' ? 'Moto' : 'Carro';
    return { type: typeLabel, entries, exits, active, revenue };
  }).filter(m => m.entries > 0 || m.exits > 0 || m.active > 0 || m.revenue > 0);

  const overnightVehiclesDaily = vehicles.filter(v => {
    const checkedInBeforeToday = v.checkInTime < startOfDay;
    const activeToday = (v.status === 'active' || v.status === 'stored' || (v.checkOutTime && v.checkOutTime >= startOfDay));
    return checkedInBeforeToday && activeToday;
  }).sort((a, b) => b.checkInTime - a.checkInTime);

  const overnightRevenueDaily = overnightVehiclesDaily
    .filter(v => v.status === 'completed' && v.checkOutTime && v.checkOutTime >= startOfDay && v.checkOutTime <= endOfDay)
    .reduce((sum, v) => sum + (v.price || 0), 0);

  // Monthly Calculations
  const completedVehiclesMonthly = vehicles.filter(v => 
    v.status === 'completed' && v.price && v.checkOutTime && v.checkOutTime >= startOfMonth && v.checkOutTime <= endOfMonth
  );

  const avgTimeMonthly = calculateAverageTime(completedVehiclesMonthly);

  const entriesMonthly = vehicles.filter(v => v.checkInTime >= startOfMonth && v.checkInTime <= endOfMonth);
  const exitsMonthly = vehicles.filter(v => v.status === 'completed' && v.checkOutTime && v.checkOutTime >= startOfMonth && v.checkOutTime <= endOfMonth);

  const totalRevenueMonthly = completedVehiclesMonthly.reduce((sum, v) => sum + (v.price || 0), 0);

  const revenueByPaymentMonthly = completedVehiclesMonthly.reduce((acc, v) => {
    const method = v.paymentMethod || 'cash';
    acc[method] = (acc[method] || 0) + (v.price || 0);
    return acc;
  }, {} as Record<string, number>);

  const paymentDataMonthly = [
    { name: 'Pré Pago', value: revenueByPaymentMonthly['card'] || 0, color: '#3b82f6' }, 
    { name: 'Máquina', value: revenueByPaymentMonthly['machine'] || 0, color: '#6366f1' }, 
    { name: 'Dinheiro', value: revenueByPaymentMonthly['cash'] || 0, color: '#f59e0b' }, 
    { name: 'Pós-Pago', value: revenueByPaymentMonthly['postpaid_card'] || 0, color: '#a855f7' }, 
    { name: 'Aguardando Pag.', value: revenueByPaymentMonthly['fiado'] || 0, color: '#ef4444' },
  ].filter(d => d.value > 0);

  const revenueByTypeMonthly = completedVehiclesMonthly.reduce((acc, v) => {
    acc[v.type] = (acc[v.type] || 0) + (v.price || 0);
    return acc;
  }, {} as Record<string, number>);

  const typeDataMonthly = [
    { name: 'Bikes', value: revenueByTypeMonthly['bicycle'] || 0, fill: '#3b82f6' },
    { name: 'E-Bikes', value: revenueByTypeMonthly['ebike'] || 0, fill: '#10b981' },
    { name: 'Motos', value: revenueByTypeMonthly['motorcycle'] || 0, fill: '#a855f7' }, 
  ];

  const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
  const monthDays = Array.from({ length: daysInMonth }).map((_, i) => {
    const d = new Date(monthDate.getFullYear(), monthDate.getMonth(), i + 1);
    return d.getTime();
  });

  const monthTimeData = monthDays.map(timestamp => {
    const date = new Date(timestamp);
    const nextDay = timestamp + 86400000;
    
    const dayRevenue = completedVehiclesMonthly
      .filter(v => v.checkOutTime && v.checkOutTime >= timestamp && v.checkOutTime < nextDay)
      .reduce((sum, v) => sum + (v.price || 0), 0);

    return {
      date: date.getDate().toString().padStart(2, '0') + '/' + (date.getMonth() + 1).toString().padStart(2, '0'),
      receita: dayRevenue
    };
  });

  // Custom Calculations
  const customStart = new Date(startDate + 'T00:00:00').getTime();
  const customEnd = new Date(endDate + 'T23:59:59').getTime();

  const completedVehiclesCustom = vehicles.filter(v => 
    v.status === 'completed' && v.price && v.checkOutTime && v.checkOutTime >= customStart && v.checkOutTime <= customEnd
  );
  const avgTimeCustom = calculateAverageTime(completedVehiclesCustom);
  const entriesCustom = vehicles.filter(v => v.checkInTime >= customStart && v.checkInTime <= customEnd);
  const exitsCustom = vehicles.filter(v => v.status === 'completed' && v.checkOutTime && v.checkOutTime >= customStart && v.checkOutTime <= customEnd);
  const totalRevenueCustom = completedVehiclesCustom.reduce((sum, v) => sum + (v.price || 0), 0);

  const revenueByPaymentCustom = completedVehiclesCustom.reduce((acc, v) => {
    const method = v.paymentMethod || 'cash';
    acc[method] = (acc[method] || 0) + (v.price || 0);
    return acc;
  }, {} as Record<string, number>);

  const paymentDataCustom = [
    { name: 'Pré Pago', value: revenueByPaymentCustom['card'] || 0, color: '#3b82f6' }, 
    { name: 'Máquina', value: revenueByPaymentCustom['machine'] || 0, color: '#6366f1' }, 
    { name: 'Dinheiro', value: revenueByPaymentCustom['cash'] || 0, color: '#f59e0b' }, 
    { name: 'Pós-Pago', value: revenueByPaymentCustom['postpaid_card'] || 0, color: '#a855f7' }, 
    { name: 'Aguardando Pag.', value: revenueByPaymentCustom['fiado'] || 0, color: '#ef4444' },
  ].filter(d => d.value > 0);

  const revenueByTypeCustom = completedVehiclesCustom.reduce((acc, v) => {
    acc[v.type] = (acc[v.type] || 0) + (v.price || 0);
    return acc;
  }, {} as Record<string, number>);

  const typeDataCustom = [
    { name: 'Bikes', value: revenueByTypeCustom['bicycle'] || 0, fill: '#3b82f6' },
    { name: 'E-Bikes', value: revenueByTypeCustom['ebike'] || 0, fill: '#10b981' },
    { name: 'Motos', value: revenueByTypeCustom['motorcycle'] || 0, fill: '#a855f7' }, 
  ];

  // Overall historical for last 7 days (kept for Daily view)
  const completedVehicles = vehicles.filter(v => v.status === 'completed' && v.price);

  const last7Days = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }).reverse();

  const timeDataDaily = last7Days.map(timestamp => {
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

  // Store Report Calculations (by the selected day, like daily)
  const salesStoreDaily = sales.filter(s => s.date >= startOfDay && s.date <= endOfDay);
  const totalStoreRevenueDaily = salesStoreDaily.reduce((sum, s) => sum + s.totalPrice, 0);
  const totalStoreItemsDaily = salesStoreDaily.reduce((sum, s) => sum + s.quantity, 0);

  const storeSalesByProduct = salesStoreDaily.reduce((acc, s) => {
    if (!acc[s.productId]) {
      acc[s.productId] = { name: s.productName, quantity: 0, revenue: 0 };
    }
    acc[s.productId].quantity += s.quantity;
    acc[s.productId].revenue += s.totalPrice;
    return acc;
  }, {} as Record<string, { name: string; quantity: number; revenue: number }>);

  const topProductsChartData = Object.values(storeSalesByProduct)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5); // top 5
    
  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Relatórios</h1>
          <p className="text-sm text-slate-500">Resumo financeiro e fluxo de veículos</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4 items-center">
          <div className="flex bg-slate-100 p-1 rounded-xl shadow-inner border border-slate-200">
            <button
              onClick={() => setReportType('daily')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                reportType === 'daily' 
                  ? 'bg-white text-slate-900 shadow-sm border border-slate-200' 
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Diário
            </button>
            <button
              onClick={() => setReportType('monthly')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                reportType === 'monthly' 
                  ? 'bg-white text-slate-900 shadow-sm border border-slate-200' 
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Mensal
            </button>
            <button
              onClick={() => setReportType('custom')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                reportType === 'custom' 
                  ? 'bg-white text-slate-900 shadow-sm border border-slate-200' 
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Período
            </button>
            <button
              onClick={() => setReportType('cards')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                reportType === 'cards' 
                  ? 'bg-white text-slate-900 shadow-sm border border-slate-200' 
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Histórico
            </button>
            <button
              onClick={() => setReportType('store')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                reportType === 'store' 
                  ? 'bg-white text-slate-900 shadow-sm border border-slate-200' 
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Loja
            </button>
            <button
              onClick={() => setReportType('parked')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                reportType === 'parked' 
                  ? 'bg-white text-slate-900 shadow-sm border border-slate-200' 
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Estacionados
            </button>
          </div>

          {(reportType === 'daily' || reportType === 'store') && (
            <div className="flex items-center space-x-2 bg-white rounded-xl shadow-sm border border-slate-200 p-1 pl-3 transition-shadow hover:shadow-md">
              <Calendar className="w-5 h-5 text-emerald-500" />
              <input 
                type="date" 
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent border-0 focus:ring-0 text-slate-700 font-bold p-2 outline-none cursor-pointer"
              />
            </div>
          )}
          
          {reportType === 'monthly' && (
            <div className="flex items-center space-x-2 bg-white rounded-xl shadow-sm border border-slate-200 p-1 pl-3 transition-shadow hover:shadow-md">
              <Calendar className="w-5 h-5 text-blue-500" />
              <input 
                type="month" 
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-transparent border-0 focus:ring-0 text-slate-700 font-bold p-2 outline-none cursor-pointer"
              />
            </div>
          )}

          {reportType === 'custom' && (
            <div className="flex items-center space-x-2 bg-white rounded-xl shadow-sm border border-slate-200 p-1 pl-3 pr-2 transition-shadow hover:shadow-md">
              <Calendar className="w-5 h-5 text-indigo-500" />
              <input 
                type="date" 
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-transparent border-0 focus:ring-0 text-slate-700 font-bold p-2 outline-none cursor-pointer w-[130px]"
              />
              <span className="text-slate-400 font-bold">até</span>
              <input 
                type="date" 
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-transparent border-0 focus:ring-0 text-slate-700 font-bold p-2 outline-none cursor-pointer w-[130px]"
              />
            </div>
          )}

          {reportType === 'cards' && (
            <div className="flex items-center space-x-2 bg-white rounded-xl shadow-sm border border-slate-200 p-1 pl-3 transition-shadow hover:shadow-md">
              <Search className="w-5 h-5 text-slate-400" />
              <input 
                type="text" 
                placeholder="Buscar por placa ou cartão..."
                value={searchCard}
                onChange={(e) => setSearchCard(e.target.value)}
                className="bg-transparent border-0 focus:ring-0 text-slate-700 font-medium p-2 outline-none placeholder:text-slate-400"
              />
            </div>
          )}
        </div>
      </div>

      {reportType === 'daily' && (
        <>
          {/* Daily Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center space-x-4">
              <div className="bg-emerald-100 p-3 rounded-xl">
                <DollarSign className="w-6 h-6 text-emerald-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide truncate">Faturamento</p>
                <h3 className="text-2xl font-black text-slate-900 truncate">R$ {totalRevenueDaily.toFixed(2)}</h3>
              </div>
            </div>
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center space-x-4">
              <div className="bg-blue-100 p-3 rounded-xl">
                <TrendingUp className="w-6 h-6 text-blue-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide truncate">Ticket Médio</p>
                <h3 className="text-2xl font-black text-slate-900 truncate">
                  R$ {completedVehiclesDaily.length > 0 ? (totalRevenueDaily / completedVehiclesDaily.length).toFixed(2) : '0.00'}
                </h3>
              </div>
            </div>
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center space-x-4">
              <div className="bg-amber-100 p-3 rounded-xl">
                <Clock className="w-6 h-6 text-amber-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide truncate">Tempo Médio</p>
                <h3 className="text-2xl font-black text-slate-900 truncate">{avgTimeDaily}</h3>
              </div>
            </div>
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center space-x-4">
              <div className="bg-indigo-100 p-3 rounded-xl">
                <ArrowRightLeft className="w-6 h-6 text-indigo-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide truncate">Entradas (Dia)</p>
                <h3 className="text-2xl font-black text-slate-900 truncate">{entriesDaily.length}</h3>
              </div>
            </div>
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center space-x-4">
              <div className="bg-purple-100 p-3 rounded-xl">
                <LogOut className="w-6 h-6 text-purple-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide truncate">Saídas</p>
                <h3 className="text-2xl font-black text-slate-900 truncate">{exitsDaily.length}</h3>
              </div>
            </div>
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center space-x-4">
              <div className="bg-slate-100 p-3 rounded-xl">
                <Bike className="w-6 h-6 text-slate-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide truncate">No Pátio</p>
                <h3 className="text-2xl font-black text-slate-900 truncate">{activeVehiclesCount}</h3>
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

            {/* Movement by Type Section */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 lg:col-span-2">
              <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center">
                <ArrowRightLeft className="w-5 h-5 mr-2 text-indigo-500" />
                Movimentação Diária por Categoria
              </h3>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-sm font-bold text-slate-500">
                      <th className="p-4 rounded-tl-xl">Categoria</th>
                      <th className="p-4 text-center">Entradas</th>
                      <th className="p-4 text-center">Saídas</th>
                      <th className="p-4 text-center">No Pátio (Ativos)</th>
                      <th className="p-4 text-right rounded-tr-xl">Faturamento</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {movementByTypeDaily.map((item) => (
                      <tr key={item.type} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-4 font-bold text-slate-900">{item.type}</td>
                        <td className="p-4 text-center text-slate-600 font-medium">{item.entries}</td>
                        <td className="p-4 text-center text-slate-600 font-medium">{item.exits}</td>
                        <td className="p-4 text-center text-slate-600 font-medium">{item.active}</td>
                        <td className="p-4 text-right font-bold text-emerald-600">
                          R$ {item.revenue.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                    {movementByTypeDaily.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-slate-500 font-medium">
                          Nenhuma movimentação registrada neste dia.
                        </td>
                      </tr>
                    )}
                  </tbody>
                  {movementByTypeDaily.length > 0 && (
                    <tfoot className="bg-slate-50 font-bold text-slate-800">
                      <tr>
                        <td className="p-4 rounded-bl-xl">Total Geral</td>
                        <td className="p-4 text-center">{movementByTypeDaily.reduce((acc, curr) => acc + curr.entries, 0)}</td>
                        <td className="p-4 text-center">{movementByTypeDaily.reduce((acc, curr) => acc + curr.exits, 0)}</td>
                        <td className="p-4 text-center">{movementByTypeDaily.reduce((acc, curr) => acc + curr.active, 0)}</td>
                        <td className="p-4 text-right text-emerald-700 rounded-br-xl">
                          R$ {movementByTypeDaily.reduce((acc, curr) => acc + curr.revenue, 0).toFixed(2)}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 lg:col-span-2 mt-6">
              <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center">
                <ArrowRightLeft className="w-5 h-5 mr-2 text-slate-400" />
                Resumo do Dia Anterior
              </h3>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-sm font-bold text-slate-500">
                      <th className="p-4 rounded-tl-xl">Categoria</th>
                      <th className="p-4 text-center">Entradas</th>
                      <th className="p-4 text-center">Saídas</th>
                      <th className="p-4 text-center">No Pátio (Ativos)</th>
                      <th className="p-4 text-right rounded-tr-xl">Faturamento</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {movementByTypePrevDay.map((item) => (
                      <tr key={item.type} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-4 font-bold text-slate-900">{item.type}</td>
                        <td className="p-4 text-center text-slate-600 font-medium">{item.entries}</td>
                        <td className="p-4 text-center text-slate-600 font-medium">{item.exits}</td>
                        <td className="p-4 text-center text-slate-600 font-medium">{item.active}</td>
                        <td className="p-4 text-right font-bold text-emerald-600">
                          R$ {item.revenue.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                    {movementByTypePrevDay.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-slate-500 font-medium">
                          Nenhuma movimentação registrada no dia anterior.
                        </td>
                      </tr>
                    )}
                  </tbody>
                  {movementByTypePrevDay.length > 0 && (
                    <tfoot className="bg-slate-50 font-bold text-slate-800">
                      <tr>
                        <td className="p-4 rounded-bl-xl">Total Geral</td>
                        <td className="p-4 text-center">{movementByTypePrevDay.reduce((acc, curr) => acc + curr.entries, 0)}</td>
                        <td className="p-4 text-center">{movementByTypePrevDay.reduce((acc, curr) => acc + curr.exits, 0)}</td>
                        <td className="p-4 text-center">{movementByTypePrevDay.reduce((acc, curr) => acc + curr.active, 0)}</td>
                        <td className="p-4 text-right text-emerald-700 rounded-br-xl">
                          R$ {movementByTypePrevDay.reduce((acc, curr) => acc + curr.revenue, 0).toFixed(2)}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>

            {/* Overnight Report Section */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 lg:col-span-2 mt-6">
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
                  <LineChart data={timeDataDaily}>
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
        </>
      )}

      {reportType === 'monthly' && (
        <>
          {/* Monthly Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center space-x-4">
              <div className="bg-emerald-100 p-3 rounded-xl">
                <DollarSign className="w-6 h-6 text-emerald-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide truncate">Faturamento</p>
                <h3 className="text-2xl font-black text-slate-900 truncate">R$ {totalRevenueMonthly.toFixed(2)}</h3>
              </div>
            </div>
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center space-x-4">
              <div className="bg-blue-100 p-3 rounded-xl">
                <TrendingUp className="w-6 h-6 text-blue-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide truncate">Ticket Médio</p>
                <h3 className="text-2xl font-black text-slate-900 truncate">
                  R$ {completedVehiclesMonthly.length > 0 ? (totalRevenueMonthly / completedVehiclesMonthly.length).toFixed(2) : '0.00'}
                </h3>
              </div>
            </div>
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center space-x-4">
              <div className="bg-amber-100 p-3 rounded-xl">
                <Clock className="w-6 h-6 text-amber-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide truncate">Tempo Médio</p>
                <h3 className="text-2xl font-black text-slate-900 truncate">{avgTimeMonthly}</h3>
              </div>
            </div>
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center space-x-4">
              <div className="bg-indigo-100 p-3 rounded-xl">
                <ArrowRightLeft className="w-6 h-6 text-indigo-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide truncate">Entradas (Mês)</p>
                <h3 className="text-2xl font-black text-slate-900 truncate">{entriesMonthly.length}</h3>
              </div>
            </div>
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center space-x-4">
              <div className="bg-purple-100 p-3 rounded-xl">
                <LogOut className="w-6 h-6 text-purple-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide truncate">Saídas</p>
                <h3 className="text-2xl font-black text-slate-900 truncate">{exitsMonthly.length}</h3>
              </div>
            </div>
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center space-x-4">
              <div className="bg-slate-100 p-3 rounded-xl">
                <Bike className="w-6 h-6 text-slate-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide truncate">No Pátio</p>
                <h3 className="text-2xl font-black text-slate-900 truncate">{activeVehiclesCount}</h3>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Revenue by Type */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center">
                <Bike className="w-5 h-5 mr-2 text-blue-500" />
                Receita por Categoria (Mensal)
              </h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={typeDataMonthly}>
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
                Métodos de Pagamento (Mensal)
              </h3>
              <div className="h-72 flex items-center justify-center">
                {paymentDataMonthly.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={paymentDataMonthly}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {paymentDataMonthly.map((entry, index) => (
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
                  <p className="text-slate-500 font-medium">Nenhum faturamento registrado neste mês</p>
                )}
              </div>
            </div>

            {/* Monthly Trend */}
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 lg:col-span-2 shadow-inner">
              <h3 className="text-sm font-bold text-slate-500 mb-6 uppercase tracking-wider flex items-center">
                <BarChart3 className="w-4 h-4 mr-2" />
                Faturamento Diário - {selectedMonth}
              </h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthTimeData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} interval="preserveStartEnd" minTickGap={20} />
                    <YAxis axisLine={false} tickLine={false} tickFormatter={(value) => "R$ " + value} tick={{fill: '#64748b'}} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      formatter={(value: number) => ["R$ " + value.toFixed(2), 'Receita']}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="receita" 
                      stroke="#3b82f6" 
                      strokeWidth={3}
                      dot={{ r: 3, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }}
                      activeDot={{ r: 6, fill: '#3b82f6', strokeWidth: 0 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>
        </>
      )}

      {reportType === 'custom' && (
        <>
          {/* Custom Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center space-x-4">
              <div className="bg-emerald-100 p-3 rounded-xl">
                <DollarSign className="w-6 h-6 text-emerald-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide truncate">Faturamento</p>
                <h3 className="text-2xl font-black text-slate-900 truncate">R$ {totalRevenueCustom.toFixed(2)}</h3>
              </div>
            </div>
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center space-x-4">
              <div className="bg-blue-100 p-3 rounded-xl">
                <TrendingUp className="w-6 h-6 text-blue-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide truncate">Ticket Médio</p>
                <h3 className="text-2xl font-black text-slate-900 truncate">
                  R$ {completedVehiclesCustom.length > 0 ? (totalRevenueCustom / completedVehiclesCustom.length).toFixed(2) : '0.00'}
                </h3>
              </div>
            </div>
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center space-x-4">
              <div className="bg-amber-100 p-3 rounded-xl">
                <Clock className="w-6 h-6 text-amber-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide truncate">Tempo Médio</p>
                <h3 className="text-2xl font-black text-slate-900 truncate">{avgTimeCustom}</h3>
              </div>
            </div>
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center space-x-4">
              <div className="bg-indigo-100 p-3 rounded-xl">
                <ArrowRightLeft className="w-6 h-6 text-indigo-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide truncate">Entradas</p>
                <h3 className="text-2xl font-black text-slate-900 truncate">{entriesCustom.length}</h3>
              </div>
            </div>
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center space-x-4">
              <div className="bg-purple-100 p-3 rounded-xl">
                <LogOut className="w-6 h-6 text-purple-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide truncate">Saídas</p>
                <h3 className="text-2xl font-black text-slate-900 truncate">{exitsCustom.length}</h3>
              </div>
            </div>
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center space-x-4">
              <div className="bg-slate-100 p-3 rounded-xl">
                <Bike className="w-6 h-6 text-slate-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide truncate">No Pátio</p>
                <h3 className="text-2xl font-black text-slate-900 truncate">{activeVehiclesCount}</h3>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Revenue by Type */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center">
                <Bike className="w-5 h-5 mr-2 text-blue-500" />
                Receita por Categoria (Período)
              </h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={typeDataCustom}>
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
                Métodos de Pagamento (Período)
              </h3>
              <div className="h-72 flex items-center justify-center">
                {paymentDataCustom.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={paymentDataCustom}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {paymentDataCustom.map((entry, index) => (
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
                  <p className="text-slate-500 font-medium">Nenhum faturamento registrado neste período</p>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {reportType === 'store' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center space-x-4">
              <div className="bg-emerald-100 p-3 rounded-xl">
                <DollarSign className="w-6 h-6 text-emerald-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide truncate">Receita Lojinha</p>
                <h3 className="text-2xl font-black text-slate-900 truncate">R$ {totalStoreRevenueDaily.toFixed(2)}</h3>
              </div>
            </div>
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center space-x-4">
              <div className="bg-blue-100 p-3 rounded-xl">
                <ShoppingCart className="w-6 h-6 text-blue-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide truncate">Itens Vendidos</p>
                <h3 className="text-2xl font-black text-slate-900 truncate">{totalStoreItemsDaily}</h3>
              </div>
            </div>
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center space-x-4">
              <div className="bg-indigo-100 p-3 rounded-xl">
                <TrendingUp className="w-6 h-6 text-indigo-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide truncate">Op. Realizadas</p>
                <h3 className="text-2xl font-black text-slate-900 truncate">{salesStoreDaily.length}</h3>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Products */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center">
                <ShoppingCart className="w-5 h-5 mr-2 text-blue-500" />
                Produtos Mais Vendidos (Top 5)
              </h3>
              <div className="h-72">
                {topProductsChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topProductsChartData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                      <XAxis type="number" axisLine={false} tickLine={false} tickFormatter={(value) => "R$ " + value} />
                      <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={100} />
                      <Tooltip 
                        cursor={{ fill: '#f8fafc' }}
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        formatter={(value: number) => ["R$ " + value.toFixed(2), 'Faturamento']}
                      />
                      <Bar dataKey="revenue" fill="#3b82f6" radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-slate-500 font-medium">
                    Nenhuma venda de produto registrada.
                  </div>
                )}
              </div>
            </div>

            {/* Sales Table */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center">
                <Users className="w-5 h-5 mr-2 text-indigo-500" />
                Últimas Vendas
              </h3>
              <div className="overflow-auto h-72">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 bg-white">
                    <tr className="border-b border-slate-100 text-sm font-bold text-slate-500">
                      <th className="p-3">Horário</th>
                      <th className="p-3">Produto</th>
                      <th className="p-3">Qtd</th>
                      <th className="p-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {salesStoreDaily.slice().reverse().map(sale => (
                      <tr key={sale.id} className="hover:bg-slate-50">
                        <td className="p-3 text-sm text-slate-600">
                          {new Date(sale.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="p-3 font-medium text-slate-900">{sale.productName}</td>
                        <td className="p-3 text-slate-600">{sale.quantity}</td>
                        <td className="p-3 text-right font-bold text-emerald-600">
                          R$ {sale.totalPrice.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                    {salesStoreDaily.length === 0 && (
                      <tr>
                        <td colSpan={4} className="p-4 text-center text-slate-500">
                          Nenhuma venda.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {reportType === 'cards' && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col h-[calc(100vh-200px)]">
          <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center shrink-0">
            <Search className="w-5 h-5 mr-2 text-indigo-500" />
            Detalhes de Entradas e Saídas (Geral)
          </h3>
          <div className="overflow-auto border border-slate-100 rounded-xl flex-1 relative">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-50 border-b border-slate-100 text-sm font-bold text-slate-500">
                  <th className="p-4 whitespace-nowrap bg-slate-50 shadow-sm outline outline-1 outline-slate-100">Data Entrada</th>
                  <th className="p-4 whitespace-nowrap bg-slate-50 shadow-sm outline outline-1 outline-slate-100">Cartão/Placa</th>
                  <th className="p-4 whitespace-nowrap bg-slate-50 shadow-sm outline outline-1 outline-slate-100">Veículo</th>
                  <th className="p-4 whitespace-nowrap bg-slate-50 shadow-sm outline outline-1 outline-slate-100">Status</th>
                  <th className="p-4 whitespace-nowrap bg-slate-50 shadow-sm outline outline-1 outline-slate-100">Saída</th>
                  <th className="p-4 whitespace-nowrap bg-slate-50 shadow-sm outline outline-1 outline-slate-100">Método</th>
                  <th className="p-4 text-right whitespace-nowrap bg-slate-50 shadow-sm outline outline-1 outline-slate-100">Receita</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {vehicles
                  .filter(v => {
                    const search = searchCard.toLowerCase().trim();
                    if (!search) return true;
                    return (
                      (v.identifier && v.identifier.toLowerCase().includes(search)) ||
                      (v.cardNumber && v.cardNumber.toLowerCase().includes(search))
                    );
                  })
                  .sort((a, b) => b.checkInTime - a.checkInTime)
                  .map((vehicle) => (
                  <tr key={vehicle.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-4 text-sm font-medium text-slate-600">
                      {new Date(vehicle.checkInTime).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="p-4 font-bold text-indigo-600">
                      <div 
                        className="flex flex-col cursor-pointer hover:text-indigo-800 transition-colors"
                        onClick={() => setSelectedVehicleDetails(vehicle)}
                      >
                        <span>#{vehicle.cardNumber || '-'}</span>
                        <span className="text-xs font-medium text-slate-400 capitalize">
                          {vehicle.type === 'bicycle' ? 'Bicicleta' : 
                           vehicle.type === 'ebike' ? 'E-Bike' : 
                           vehicle.type === 'motorcycle' ? 'Moto' : 
                           vehicle.type}
                        </span>
                      </div>
                    </td>
                    <td className="p-4 text-sm font-bold text-slate-900">
                      <span 
                        className="cursor-pointer hover:text-slate-600 transition-colors"
                        onClick={() => setSelectedVehicleDetails(vehicle)}
                      >
                        {vehicle.identifier}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
                        vehicle.status === 'completed' ? 'bg-slate-100 text-slate-600 border border-slate-200' :
                        vehicle.status === 'active' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' :
                        'bg-blue-100 text-blue-700 border border-blue-200'
                      }`}>
                        {vehicle.status === 'completed' ? 'Finalizado' :
                         vehicle.status === 'active' ? 'Ativo' : 'Guardado'}
                      </span>
                    </td>
                    <td className="p-4 text-sm text-slate-600">
                      {vehicle.checkOutTime ? new Date(vehicle.checkOutTime).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
                    </td>
                    <td className="p-4 text-sm font-medium text-slate-500 capitalize">
                      {vehicle.paymentMethod === 'card' ? 'Pré Pago' : 
                       vehicle.paymentMethod === 'machine' ? 'Máquina' :
                       vehicle.paymentMethod === 'cash' ? 'Dinheiro' : 
                       vehicle.paymentMethod === 'postpaid_card' ? 'Pós-Pago' : '-'}
                    </td>
                    <td className="p-4 text-right font-black text-emerald-600">
                      {vehicle.price ? "R$ " + vehicle.price.toFixed(2) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {reportType === 'parked' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center space-x-4">
              <div className="bg-blue-100 p-3 rounded-xl">
                <Bike className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">Total Estacionados</p>
                <p className="text-2xl font-black text-slate-900">{vehicles.filter(v => v.status === 'active' || v.status === 'stored').length}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col h-[calc(100vh-250px)]">
            <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center shrink-0">
              <Clock className="w-5 h-5 mr-2 text-blue-500" />
              Veículos Atualmente Estacionados
            </h3>
            <div className="overflow-auto border border-slate-100 rounded-xl flex-1 relative">
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead className="sticky top-0 z-10">
                  <tr>
                    <th className="p-4 border-b border-slate-100 bg-slate-50 text-sm font-bold text-slate-500 rounded-tl-xl whitespace-nowrap">Entrada</th>
                    <th className="p-4 border-b border-slate-100 bg-slate-50 text-sm font-bold text-slate-500">Cartão / ID</th>
                    <th className="p-4 border-b border-slate-100 bg-slate-50 text-sm font-bold text-slate-500">Cliente</th>
                    <th className="p-4 border-b border-slate-100 bg-slate-50 text-sm font-bold text-slate-500 rounded-tr-xl">Tipo</th>
                  </tr>
                </thead>
                <tbody>
                  {vehicles.filter(v => v.status === 'active' || v.status === 'stored')
                    .sort((a,b) => b.checkInTime - a.checkInTime)
                    .map((vehicle, index) => (
                    <tr key={vehicle.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                      <td className="p-4 text-sm font-medium text-slate-700 whitespace-nowrap">
                        {new Date(vehicle.checkInTime).toLocaleString('pt-BR')}
                      </td>
                      <td className="p-4 text-sm">
                        {vehicle.cardNumber && <span className="inline-block px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs font-bold mr-2">C: {vehicle.cardNumber}</span>}
                        {vehicle.identifier && <span className="font-bold text-indigo-600 uppercase">{vehicle.identifier}</span>}
                      </td>
                      <td className="p-4 text-sm font-medium text-slate-900 capitalize truncate max-w-[200px]">
                        {vehicle.ownerName || '-'}
                      </td>
                      <td className="p-4 text-sm font-medium text-slate-700 capitalize">
                        {vehicle.type === 'bicycle' ? 'Bicicleta' : vehicle.type === 'ebike' ? 'Bicicleta Elétrica' : vehicle.type === 'motorcycle' ? 'Moto' : 'Carro'}
                      </td>
                    </tr>
                  ))}
                  {vehicles.filter(v => v.status === 'active' || v.status === 'stored').length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-slate-500">
                        Nenhum veículo estacionado no momento.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Vehicle Details Modal */}
      {selectedVehicleDetails && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h2 className="text-xl font-bold text-slate-800">Detalhes do Registro</h2>
              <button 
                onClick={() => setSelectedVehicleDetails(null)}
                className="text-slate-400 hover:text-slate-600 transition-colors p-2 rounded-lg hover:bg-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex justify-between border-b border-slate-100 pb-2">
                <span className="text-slate-500 font-medium">Cartão</span>
                <span className="font-bold text-slate-900 flex items-center">
                  <span className="text-indigo-600 px-2 py-0.5 bg-indigo-50 rounded mr-2 text-xs">#{selectedVehicleDetails.cardNumber || '-'}</span>
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-2">
                <span className="text-slate-500 font-medium">Identificação</span>
                <span className="font-bold text-slate-900">{selectedVehicleDetails.identifier}</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-2">
                <span className="text-slate-500 font-medium">Veículo</span>
                <span className="font-bold text-slate-900 capitalize">
                  {selectedVehicleDetails.type === 'bicycle' ? 'Bicicleta' : 
                   selectedVehicleDetails.type === 'ebike' ? 'E-Bike' : 
                   selectedVehicleDetails.type === 'motorcycle' ? 'Moto' : 
                   selectedVehicleDetails.type}
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-2">
                <span className="text-slate-500 font-medium">Status</span>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                  selectedVehicleDetails.status === 'completed' ? 'bg-slate-100 text-slate-600 border border-slate-200' :
                  selectedVehicleDetails.status === 'active' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' :
                  'bg-blue-100 text-blue-700 border border-blue-200'
                }`}>
                  {selectedVehicleDetails.status === 'completed' ? 'Finalizado' :
                   selectedVehicleDetails.status === 'active' ? 'Ativo' : 'Guardado'}
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-2">
                <span className="text-slate-500 font-medium">Data de Entrada</span>
                <span className="font-bold text-slate-900 text-sm">
                  {new Date(selectedVehicleDetails.checkInTime).toLocaleString('pt-BR')}
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-2">
                <span className="text-slate-500 font-medium">Data de Saída</span>
                <span className="font-bold text-slate-900 text-sm">
                  {selectedVehicleDetails.checkOutTime ? new Date(selectedVehicleDetails.checkOutTime).toLocaleString('pt-BR') : '-'}
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-2">
                <span className="text-slate-500 font-medium">Forma de Pagto</span>
                <span className="font-bold text-slate-900 capitalize">
                  {selectedVehicleDetails.paymentMethod === 'card' ? 'Pré Pago' : 
                   selectedVehicleDetails.paymentMethod === 'machine' ? 'Máquina' :
                   selectedVehicleDetails.paymentMethod === 'cash' ? 'Dinheiro' : 
                   selectedVehicleDetails.paymentMethod === 'postpaid_card' ? 'Pós-Pago' : '-'}
                </span>
              </div>
              <div className="flex justify-between pt-2">
                <span className="text-slate-500 font-bold">Valor Pago</span>
                <span className="font-black text-emerald-600 text-lg">
                  {selectedVehicleDetails.price ? "R$ " + selectedVehicleDetails.price.toFixed(2) : '-'}
                </span>
              </div>
            </div>
            <div className="p-4 border-t border-slate-100 bg-slate-50 text-right">
              <button
                onClick={() => setSelectedVehicleDetails(null)}
                className="px-6 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

