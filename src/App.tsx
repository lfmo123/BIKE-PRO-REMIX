import React, { useState, useEffect } from 'react';
import { Plus, Menu } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { ActiveParking } from './components/ActiveParking';
import { CheckOut } from './components/CheckOut';
import { History } from './components/History';
import { Reports } from './components/Reports';
import { Settings } from './components/Settings';
import { SpotsGrid } from './components/SpotsGrid';
import { CheckInModal } from './components/CheckInModal';
import { CheckOutModal } from './components/CheckOutModal';
import { ParkedVehicle, Pricing } from './types';

const defaultPricing: Pricing = {
  bicycle: 5,
  ebike: 8,
  motorcycle: 12,
  totalSpots: 50,
};

export default function App() {
  const [user, setUser] = useState<{ email: string; displayName: string } | null>({ email: 'admin@admin.com', displayName: 'Administrador' });
  
  const [activeTab, setActiveTab] = useState('dashboard');
  const [vehicles, setVehicles] = useState<ParkedVehicle[]>([]);
  const [pricing, setPricing] = useState<Pricing>(defaultPricing);
  
  const [isCheckInOpen, setIsCheckInOpen] = useState(false);
  const [initialCheckInSpot, setInitialCheckInSpot] = useState<string>('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [vehicleToCheckOut, setVehicleToCheckOut] = useState<ParkedVehicle | null>(null);

  useEffect(() => {
    fetchVehicles();
    fetchPricing();
  }, []);

  const fetchVehicles = async () => {
    try {
      const res = await fetch('/api/vehicles');
      if (res.ok) {
        const data = await res.json();
        setVehicles(data);
      }
    } catch (e) {
      console.error('Failed to fetch vehicles', e);
    }
  };

  const fetchPricing = async () => {
    try {
      const res = await fetch('/api/pricing');
      if (res.ok) {
        const data = await res.json();
        setPricing(data);
      }
    } catch (e) {
      console.error('Failed to fetch pricing', e);
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

  const handleCheckOut = async (vehicleId: string, price: number, paymentMethod: 'pix' | 'card' | 'cash') => {
    try {
      const res = await fetch(`/api/vehicles/${vehicleId}/checkout`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ price, paymentMethod })
      });
      if (res.ok) {
        fetchVehicles(); // refresh list
        setVehicleToCheckOut(null);
      }
    } catch (error) {
       console.error('Error during checkout', error);
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
            <div className="flex items-center text-sm text-slate-500 font-medium hidden sm:flex">
              <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded-md mr-2">PRO</span>
              Sistema de Gestão
            </div>
            <div className="flex items-center text-sm text-slate-500 font-medium sm:hidden">
              <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded-md">PRO</span>
            </div>
          </div>
          
          <button 
            onClick={() => setIsCheckInOpen(true)}
            className="flex items-center px-4 py-2 lg:px-5 lg:py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold transition-colors shadow-lg shadow-emerald-500/30 text-sm lg:text-base"
          >
            <Plus className="w-5 h-5 lg:mr-2" />
            <span className="hidden lg:inline">Nova Entrada</span>
            <span className="inline lg:hidden ml-1">Entrada</span>
          </button>
        </header>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-8 relative">
          <div className="max-w-6xl mx-auto">
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
                {activeTab === 'active' && <ActiveParking vehicles={vehicles} pricing={pricing} onCheckOut={setVehicleToCheckOut} />}
                {activeTab === 'spots' && (
                  <SpotsGrid 
                    vehicles={vehicles} 
                    pricing={pricing} 
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
                {activeTab === 'checkout' && <CheckOut vehicles={vehicles} pricing={pricing} onCheckOut={handleCheckOut} />}
                {activeTab === 'history' && <History vehicles={vehicles} />}
                {activeTab === 'reports' && <Reports vehicles={vehicles} />}
                {activeTab === 'settings' && <Settings pricing={pricing} vehicles={vehicles} onSavePricing={handleSavePricing} />}
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
        onClose={() => setVehicleToCheckOut(null)} 
        onConfirm={handleCheckOut} 
      />
    </div>
  );
}
