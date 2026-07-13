import React, { useState, useEffect } from 'react';
import { Plus, Menu, Trash2, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { ActiveParking } from './components/ActiveParking';
import { StoredVehicles } from './components/StoredVehicles';
import { CashBook } from './components/CashBook';
import { CheckOut } from './components/CheckOut';
import { Conference } from './components/Conference';
import { CustomerCards } from './components/CustomerCards';
import { ShiftControl } from './components/ShiftControl';
import { History } from './components/History';
import { Reports } from './components/Reports';
import { Settings } from './components/Settings';
import { SpotsGrid } from './components/SpotsGrid';
import { Store } from './components/Store';
import { Audit } from './components/Audit';
import { CheckInModal } from './components/CheckInModal';
import { CheckOutModal } from './components/CheckOutModal';
import { ResetAppModal } from './components/ResetAppModal';
import { ParkedVehicle, Pricing, LostCard, Transaction, Product, Sale, CustomerCard, Shift, Operator } from './types';
import { getLocalDateString } from './lib/dateUtils';

const defaultPricing: Pricing = {
  bicycle: 5,
  ebike: 8,
  motorcycle: 12,
  totalSpots: 300,
};

export default function App() {
  const [user, setUser] = useState<{ email: string; displayName: string } | null>({ email: 'admin@admin.com', displayName: 'Administrador' });
  
  const [activeTab, setActiveTab] = useState('dashboard');
  const [vehicles, setVehicles] = useState<ParkedVehicle[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [customerCards, setCustomerCards] = useState<CustomerCard[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);
  const activeShift = shifts.find(s => s.status === 'open');
  const [pricing, setPricing] = useState<Pricing>(defaultPricing);
  const [lostCards, setLostCards] = useState<LostCard[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const [isCheckInOpen, setIsCheckInOpen] = useState(false);
  const [isResetAppOpen, setIsResetAppOpen] = useState(false);
  const [initialCheckInSpot, setInitialCheckInSpot] = useState<string>('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [vehicleToCheckOut, setVehicleToCheckOut] = useState<ParkedVehicle | null>(null);

  const fetchOperators = async () => {
    try {
      const res = await fetch('/api/operators');
      if (res.ok) setOperators(await res.json());
    } catch (e) {
      console.error('Failed to fetch operators', e);
    }
  };

  const handleAddOperator = async (name: string) => {
    try {
      const res = await fetch('/api/operators', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: Date.now().toString(), name })
      });
      if (res.ok) fetchOperators();
    } catch (e) { console.error('Failed to add operator', e); }
  };

  const handleDeleteOperator = async (id: string) => {
    try {
      const res = await fetch(`/api/operators/${id}`, { method: 'DELETE' });
      if (res.ok) fetchOperators();
    } catch (e) { console.error('Failed to delete operator', e); }
  };

  useEffect(() => {
    fetchVehicles();
    fetchPricing();
    fetchLostCards();
    fetchTransactions();
    fetchCustomerCards();
    fetchShifts();
    fetchOperators();

        // Auto backup local check
    const performAutoBackup = async (reason = 'timer') => {
      const isEnabled = localStorage.getItem('autoBackupEnabled');
      if (isEnabled !== 'true') return;

      const lastBackupTime = parseInt(localStorage.getItem('lastAutoBackupTimestamp') || '0', 10);
      const now = Date.now();
      
      const ONE_HOUR = 1 * 60 * 60 * 1000;
      
      // Permitir backup de inicialização (startup) ou a cada hora
      const shouldBackup = (reason === 'startup') || (now - lastBackupTime >= ONE_HOUR);
      
      if (shouldBackup) { 
         try {
            console.log(`Executando backup automático local (${reason})...`);
            const res = await fetch('/api/backup/export');
            if (res.ok) {
              const backupData = await res.json();
              const dateStr = getLocalDateString();
              const timeStr = new Date().toLocaleTimeString('pt-BR').replace(/:/g, '-');
              const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              
              const downloadAnchorNode = document.createElement('a');
              downloadAnchorNode.style.display = 'none';
              downloadAnchorNode.setAttribute("href", url);
              downloadAnchorNode.setAttribute("download", `bikepark_backup_auto_${dateStr}_${timeStr}.json`);
              document.body.appendChild(downloadAnchorNode);
              downloadAnchorNode.click();
              
              setTimeout(() => {
                document.body.removeChild(downloadAnchorNode);
                URL.revokeObjectURL(url);
              }, 100);
              
              localStorage.setItem('lastAutoBackupTimestamp', now.toString());
              
              // Opcional: mostrar um alerta visual de sucesso
              // alert('Backup automático realizado com sucesso.');
            }
          } catch(e) { console.error('Auto backup failed', e); }
      }
    };
    
    // Roda direto no início sem exigir clique (com pequeno delay para carregar a UI)
    setTimeout(() => {
      performAutoBackup('startup');
    }, 2000);
    
    // Checa a cada minuto se já passou 1 hora
    const backupTimer = setInterval(() => performAutoBackup('timer'), 60 * 1000);
    
    return () => {
      clearInterval(backupTimer);
    };
  }, []);

  const handleResetApp = async () => {
    try {
      const res = await fetch('/api/system/reset', { method: 'DELETE' });
      if (res.ok) {
        setVehicles([]);
        setTransactions([]);
        setLostCards([]);
        setIsResetAppOpen(false);
        setErrorMsg(null);
        alert('Aplicativo zerado com sucesso.');
      } else {
        const err = await res.json();
        setErrorMsg(err.error || 'Erro ao zerar aplicativo.');
      }
    } catch (e) {
      console.error('Failed to reset app', e);
      setErrorMsg('Falha ao zerar aplicativo.');
    }
  };

  const fetchTransactions = async () => {
    try {
      const res = await fetch('/api/transactions');
      if (res.ok) {
        const data = await res.json();
        setTransactions(data);
      }
    } catch (e) {
      console.error('Failed to fetch transactions', e);
    }
  };

  const handleAddTransaction = async (transaction: Omit<Transaction, 'id'>) => {
    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(transaction)
      });
      if (res.ok) {
        const data = await res.json();
        setTransactions(prev => [data, ...prev].sort((a, b) => b.date - a.date));
      }
    } catch (e) {
      console.error('Failed to add transaction', e);
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    try {
      const res = await fetch(`/api/transactions/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setTransactions(prev => prev.filter(t => t.id !== id));
      }
    } catch (e) {
      console.error('Failed to delete transaction', e);
    }
  };

  const handlePayFiado = async (vehicleId: string, paymentMethod: string, amount: number, observation?: string) => {
    try {
      const res = await fetch(`/api/vehicles/${vehicleId}/pay-fiado`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentMethod, amount, observation })
      });
      if (res.ok) {
        fetchVehicles();
        fetchTransactions();
      } else {
        alert('Erro ao realizar baixa do fiado.');
      }
    } catch (error) {
       console.error('Error paying fiado', error);
    }
  };

  const fetchCustomerCards = async () => {
    try {
      const res = await fetch('/api/customer-cards');
      if (res.ok) setCustomerCards(await res.json());
    } catch (e) { console.error('Failed to fetch customer cards', e); }
  };

  const handleAddCard = async (card: Omit<CustomerCard, 'id'>) => {
    try {
      const id = Date.now().toString() + Math.random().toString(36).substring(2, 6);
      const res = await fetch('/api/customer-cards', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...card, id }) });
      if (res.ok) fetchCustomerCards();
    } catch (error) { console.error(error); }
  };

  const handleUpdateCard = async (id: string, card: Partial<CustomerCard>) => {
    try {
      const res = await fetch(`/api/customer-cards/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(card) });
      if (res.ok) fetchCustomerCards();
    } catch (error) { console.error(error); }
  };

  const handleDeleteCard = async (id: string) => {
    try {
      const res = await fetch(`/api/customer-cards/${id}`, { method: 'DELETE' });
      if (res.ok) fetchCustomerCards();
    } catch (error) { console.error(error); }
  };

  const fetchShifts = async () => {
    try {
      const res = await fetch('/api/shifts');
      if (res.ok) setShifts(await res.json());
    } catch (e) { console.error('Failed to fetch shifts', e); }
  };

  const handleOpenShift = async (operatorName: string, initialChange: number, startTime?: number) => {
    try {
      const newShift: Omit<Shift, 'id'> = { operatorName, initialChange, startTime: startTime || Date.now(), status: 'open' };
      const res = await fetch('/api/shifts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...newShift, id: Date.now().toString() }) });
      if (res.ok) fetchShifts();
    } catch (error) { console.error(error); }
  };

  const handleCloseShift = async (shift: Shift) => {
    try {
      const res = await fetch(`/api/shifts/${shift.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(shift) });
      if (res.ok) fetchShifts();
    } catch (error) { console.error(error); }
  };

  const fetchLostCards = async () => {
    try {
      const res = await fetch('/api/lost-cards');
      if (res.ok) {
        const data = await res.json();
        setLostCards(data);
      }
    } catch (e) {
      console.error('Failed to fetch lost cards', e);
    }
  };

  const fetchVehicles = async () => {
    try {
      const res = await fetch('/api/vehicles');
      if (res.ok) {
        const data = await res.json();
        setVehicles(data);
        setErrorMsg(null);
      } else {
        const err = await res.json();
        setErrorMsg(err.error || 'Erro ao carregar veículos.');
      }
    } catch (e) {
      console.error('Failed to fetch vehicles', e);
      setErrorMsg('Falha na comunicação com o servidor.');
    }
  };

  const fetchPricing = async () => {
    try {
      const res = await fetch('/api/pricing');
      if (res.ok) {
        const data = await res.json();
        setPricing(data);
      } else {
        const err = await res.json();
        setErrorMsg(err.error || 'Erro ao carregar preços.');
      }
    } catch (e) {
      console.error('Failed to fetch pricing', e);
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/products');
      if (res.ok) setProducts(await res.json());
    } catch (e) { console.error(e); }
  };

  const fetchSales = async () => {
    try {
      const res = await fetch('/api/sales');
      if (res.ok) setSales(await res.json());
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    fetchProducts();
    fetchSales();
  }, []);

  const handleRefreshAll = async () => {
    try {
      await Promise.all([
        fetchVehicles(),
        fetchPricing(),
        fetchLostCards(),
        fetchTransactions(),
        fetchCustomerCards(),
        fetchShifts(),
        fetchOperators(),
        fetchProducts(),
        fetchSales()
      ]);
    } catch (e) {
      console.error('Failed to refresh data', e);
    }
  };

  const handleAddProduct = async (product: Omit<Product, 'id'>) => {
    const res = await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(product)
    });
    if (res.ok) fetchProducts();
  };

  const handleUpdateProduct = async (product: Product) => {
    const res = await fetch(`/api/products/${product.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(product)
    });
    if (res.ok) fetchProducts();
  };

  const handleDeleteProduct = async (id: string) => {
    const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
    if (res.ok) fetchProducts();
  };

  const handleAddSale = async (sale: Omit<Sale, 'id'>) => {
    const res = await fetch('/api/sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sale)
    });
    if (res.ok) {
      fetchProducts();
      fetchSales();
      fetchTransactions();
      alert('Venda realizada com sucesso!');
    }
  };

  const handleCheckIn = async (newVehicle: Omit<ParkedVehicle, 'id' | 'status'>) => {
    try {
      const res = await fetch('/api/vehicles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newVehicle)
      });
      if (res.ok) {
        fetchVehicles(); // refresh list
        fetchLostCards();
        setIsCheckInOpen(false);
        return { success: true };
      } else {
        const errorData = await res.json();
        return { success: false, error: errorData.error || 'Erro ao registrar entrada' };
      }
    } catch (error) {
      console.error('Error during checkin', error);
      return { success: false, error: 'Erro de conexão com o servidor' };
    }
  };

  const handleCheckOut = async (vehicleId: string, price: number, paymentMethod: 'card' | 'cash' | 'postpaid_card' | 'fiado' | 'machine' | 'pix', customerCardId?: string) => {
    try {
      const res = await fetch(`/api/vehicles/${vehicleId}/checkout`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ price, paymentMethod, customerCardId })
      });
      if (res.ok) {
        fetchVehicles(); // refresh list
        fetchLostCards();
        fetchCustomerCards(); // refresh balances
        setVehicleToCheckOut(null);
      } else {
        const errorData = await res.json();
        alert(`Erro ao registrar checkout: ${errorData.error}`);
      }
    } catch (error) {
       console.error('Error during checkout', error);
       alert('Erro ao registrar checkout');
    }
  };

  const handleRevertCheckout = async (vehicleId: string) => {
    try {
      const res = await fetch(`/api/vehicles/${vehicleId}/revert-checkout`, { method: 'PUT' });
      if (res.ok) {
        fetchVehicles();
      } else {
        alert('Erro ao estornar saída.');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleRevertCheckin = async (vehicleId: string) => {
    try {
      const res = await fetch(`/api/vehicles/${vehicleId}/revert-checkin`, { method: 'DELETE' });
      if (res.ok) {
        fetchVehicles();
      } else {
        alert('Erro ao estornar entrada.');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleReportLostCard = async (vehicleId: string, lostCardName: string, lostCardPhone: string) => {
    try {
      const res = await fetch(`/api/vehicles/${vehicleId}/lost`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lostCardName, lostCardPhone })
      });
      if (res.ok) {
        fetchVehicles(); // refresh list
        fetchLostCards();
      } else {
        const data = await res.json();
        alert('Erro ao registrar cartão perdido: ' + data.error);
      }
    } catch (error) {
      console.error('Failed to report lost card', error);
      alert('Erro inesperado ao registrar cartão perdido.');
    }
  };

  const handleSavePricing = async (newPricing: Pricing) => {
    try {
      const res = await fetch('/api/pricing', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPricing)
      });
      if (res.ok) {
        fetchPricing();
      }
    } catch (error) {
       console.error('Error updating pricing', error);
    }
  };

  const handleLogout = () => {
    setUser(null);
  };

  if (!user) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50"><button className="px-4 py-2 bg-emerald-500 rounded text-white font-bold" onClick={() => setUser({ email: 'admin@admin.com', displayName: 'Admin' })}>Entrar Localmente</button></div>;
  }

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        onLogout={handleLogout} 
        user={user as any} 
        isOpen={isMobileMenuOpen}
        setIsOpen={setIsMobileMenuOpen}
      />
      
      <main className="flex-1 flex flex-col relative overflow-hidden w-full">
        {/* Top Header */}
        <header className="h-20 bg-white border-b border-slate-100 flex items-center justify-between px-4 lg:px-8 shrink-0">
          <div className="flex items-center">
            <button 
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-2 mr-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-lg lg:hidden"
            >
              <Menu className="w-6 h-6" />
            </button>
            
            {activeTab !== 'dashboard' && (
              <button
                onClick={() => setActiveTab('dashboard')}
                className="p-2 mr-3 text-slate-600 hover:bg-slate-100 hover:text-slate-900 rounded-xl flex items-center transition-colors border border-slate-200 lg:-ml-2 bg-white shadow-sm"
                title="Voltar ao Início"
              >
                <ArrowLeft className="w-5 h-5 sm:mr-1" />
                <span className="font-medium hidden sm:inline text-sm">Voltar</span>
              </button>
            )}

            <div className="flex items-center text-sm text-slate-500 font-medium hidden sm:flex">
              <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded-md mr-2">PRO</span>
              Sistema de Gestão
            </div>
            <div className="flex items-center text-sm text-slate-500 font-medium sm:hidden">
              <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded-md">PRO</span>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-8 relative">
          <div className="max-w-6xl mx-auto">
            {errorMsg && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4" role="alert">
                <strong className="font-bold">Aviso: </strong>
                <span className="block sm:inline">{errorMsg}</span>
              </div>
            )}
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                {activeTab === 'dashboard' && (
                  <Dashboard 
                    vehicles={vehicles} 
                    pricing={pricing} 
                    lostCards={lostCards}
                    products={products}
                    onAddSale={handleAddSale}
                    onSpotClick={(spotNum, occupiedVehicle) => {
                      if (occupiedVehicle) {
                        setVehicleToCheckOut(occupiedVehicle);
                      } else {
                        setInitialCheckInSpot(spotNum.toString());
                        setIsCheckInOpen(true);
                      }
                    }}
                  />
                )}
                {activeTab === 'active' && <ActiveParking vehicles={vehicles} pricing={pricing} onCheckOut={setVehicleToCheckOut} onRevertCheckin={handleRevertCheckin} />}
                {activeTab === 'conference' && <Conference vehicles={vehicles} />}
                {activeTab === 'stored' && <StoredVehicles vehicles={vehicles} pricing={pricing} onCheckOut={setVehicleToCheckOut} />}
                {activeTab === 'spots' && (
                  <SpotsGrid 
                    vehicles={vehicles} 
                    pricing={pricing} 
                    lostCards={lostCards}
                    onSpotClick={(spotNum, occupiedVehicle) => {
                      if (occupiedVehicle) {
                        setVehicleToCheckOut(occupiedVehicle);
                      } else {
                        setInitialCheckInSpot(spotNum.toString());
                        setIsCheckInOpen(true);
                      }
                    }} 
                  />
                )}
                {activeTab === 'checkout' && <CheckOut vehicles={vehicles} pricing={pricing} onCheckOut={handleCheckOut} customerCards={customerCards} />}
                {activeTab === 'cashbook' && <CashBook transactions={transactions} vehicles={vehicles} shifts={shifts} onAddTransaction={handleAddTransaction} onDeleteTransaction={handleDeleteTransaction} onPayFiado={handlePayFiado} />}
                {activeTab === 'shifts' && <ShiftControl operators={operators} shifts={shifts} transactions={transactions} vehicles={vehicles} sales={sales} activeShift={activeShift} user={user as any} onOpenShift={handleOpenShift} onCloseShift={handleCloseShift} />}
                {activeTab === 'cards' && <CustomerCards cards={customerCards} vehicles={vehicles} onAddCard={handleAddCard} onUpdateCard={handleUpdateCard} onDeleteCard={handleDeleteCard} onAddTransaction={handleAddTransaction} />}
                {activeTab === 'store' && <Store products={products} onAddProduct={handleAddProduct} onUpdateProduct={handleUpdateProduct} onDeleteProduct={handleDeleteProduct} onAddSale={handleAddSale} />}
                {activeTab === 'audit' && <Audit vehicles={vehicles} sales={sales} transactions={transactions} products={products} onRefreshAll={handleRefreshAll} />}
                {activeTab === 'history' && <History vehicles={vehicles} onRevertCheckout={handleRevertCheckout} />}
                {activeTab === 'reports' && <Reports vehicles={vehicles} sales={sales} transactions={transactions} />}
                {activeTab === 'settings' && <Settings operators={operators} onAddOperator={handleAddOperator} onDeleteOperator={handleDeleteOperator} pricing={pricing} vehicles={vehicles} onSavePricing={handleSavePricing} lostCards={lostCards} onLostCardsChange={fetchLostCards} onResetApp={() => setIsResetAppOpen(true)} />}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </main>

      {/* Modals */}
      <CheckInModal 
        isOpen={isCheckInOpen} 
        onClose={() => {
          setIsCheckInOpen(false);
          setInitialCheckInSpot('');
        }} 
        onCheckIn={handleCheckIn} 
        initialCardNumber={initialCheckInSpot}
      />
      
      <CheckOutModal 
        vehicle={vehicleToCheckOut} 
        pricing={pricing} 
        customerCards={customerCards}
        onClose={() => setVehicleToCheckOut(null)} 
        onConfirm={handleCheckOut} 
        onReportLostCard={handleReportLostCard}
        onRevertCheckin={handleRevertCheckin}
      />
      
      <ResetAppModal
        isOpen={isResetAppOpen}
        onClose={() => setIsResetAppOpen(false)}
        onConfirm={handleResetApp}
      />
    </div>
  );
}
