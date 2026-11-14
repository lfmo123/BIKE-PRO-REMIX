import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Menu, ArrowLeft, QrCode, UserCheck, Sun, Moon, WifiOff, RefreshCw, X, CheckCircle, AlertTriangle, Info } from 'lucide-react';
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
import { QrScannerModal } from './components/QrScannerModal';
import { OperatorLoginModal } from './components/OperatorLoginModal';
import { ParkedVehicle, Pricing, LostCard, Transaction, Product, Sale, CustomerCard, Shift, Operator } from './types';
import { getLocalDateString } from './lib/dateUtils';
import { parseResponseJson } from './lib/apiUtils';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { getDeviceModules, DeviceModulesConfig } from './lib/deviceModules';
import { getOfflineQueue, enqueueOfflineMutation, flushOfflineQueue } from './lib/offlineQueue';

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
  const [toast, setToast] = useState<{ type: 'success' | 'info' | 'warning' | 'error'; text: string } | null>(null);

  const [isCheckInOpen, setIsCheckInOpen] = useState(false);
  const [isResetAppOpen, setIsResetAppOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isOperatorModalOpen, setIsOperatorModalOpen] = useState(false);
  const [initialCheckInSpot, setInitialCheckInSpot] = useState<string>('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [vehicleToCheckOut, setVehicleToCheckOut] = useState<ParkedVehicle | null>(null);
  const [deviceModules, setDeviceModules] = useState<DeviceModulesConfig>(getDeviceModules());

  const [activeOperator, setActiveOperator] = useState<string>(() => {
    try {
      return localStorage.getItem('bikepark_active_operator') || 'Administrador';
    } catch {
      return 'Administrador';
    }
  });

  const [isDarkTheme, setIsDarkTheme] = useState<boolean>(() => {
    try {
      return localStorage.getItem('bikepark_dark_theme') === 'true';
    } catch {
      return false;
    }
  });

  const [isOnline, setIsOnline] = useState<boolean>(() => (typeof navigator !== 'undefined' ? navigator.onLine : true));
  const [offlineQueueCount, setOfflineQueueCount] = useState<number>(() => getOfflineQueue().length);
  const isSyncingRef = useRef(false);

  const showToast = useCallback((type: 'success' | 'info' | 'warning' | 'error', text: string) => {
    setToast({ type, text });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  // Listen to device module changes
  useEffect(() => {
    const handleModulesChanged = () => {
      setDeviceModules(getDeviceModules());
    };
    window.addEventListener('bikepark_modules_changed', handleModulesChanged);
    return () => {
      window.removeEventListener('bikepark_modules_changed', handleModulesChanged);
    };
  }, []);

  // Strict Dark Mode control: only active when BOTH deviceModules.enableDarkMode AND isDarkTheme are true
  useEffect(() => {
    if (deviceModules.enableDarkMode && isDarkTheme) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [deviceModules.enableDarkMode, isDarkTheme]);

  const toggleDarkTheme = () => {
    const next = !isDarkTheme;
    setIsDarkTheme(next);
    try {
      localStorage.setItem('bikepark_dark_theme', next ? 'true' : 'false');
    } catch {
      // ignore storage errors
    }
  };

  const handleSelectOperator = (opName: string) => {
    setActiveOperator(opName);
    try {
      localStorage.setItem('bikepark_active_operator', opName);
    } catch {
      // ignore
    }
    showToast('info', `Operador ativo: ${opName}`);
  };

  const fetchOperators = async () => {
    try {
      const res = await fetch('/api/operators');
      if (res.ok) setOperators(await res.json());
    } catch (e) {
      console.error('Failed to fetch operators', e);
    }
  };

  const handleAddOperator = async (name: string, pin?: string) => {
    try {
      const res = await fetch('/api/operators', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: Date.now().toString(), name, ...(pin ? { pin } : {}) })
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

  const fetchCustomerCards = async () => {
    try {
      const res = await fetch('/api/customer-cards');
      if (res.ok) setCustomerCards(await res.json());
    } catch (e) { console.error('Failed to fetch customer cards', e); }
  };

  const fetchShifts = async () => {
    try {
      const res = await fetch('/api/shifts');
      if (res.ok) setShifts(await res.json());
    } catch (e) { console.error('Failed to fetch shifts', e); }
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
      if (navigator.onLine) {
        setErrorMsg('Falha na comunicação com o servidor.');
      }
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

  const handleRefreshAll = useCallback(async () => {
    if (isSyncingRef.current) return;
    isSyncingRef.current = true;
    try {
      await Promise.allSettled([
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
    } finally {
      isSyncingRef.current = false;
    }
  }, []);

  // Silent background multi-device sync (never closes/resets open modals)
  const silentSync = useCallback(async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    await handleRefreshAll();
  }, [handleRefreshAll]);

  const runOfflineFlush = useCallback(async () => {
    if (!deviceModules.enableOfflineQueue) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    if (getOfflineQueue().length === 0) return;

    const result = await flushOfflineQueue();
    setOfflineQueueCount(getOfflineQueue().length);
    if (result.synced > 0) {
      showToast('success', `${result.synced} lançamento(s) offline sincronizado(s) com o servidor.`);
      await handleRefreshAll();
    }
    if (result.conflicts.length > 0) {
      showToast('warning', `Conflito na sincronização: ${result.conflicts[0]}`);
      await handleRefreshAll();
    }
  }, [deviceModules.enableOfflineQueue, handleRefreshAll, showToast]);

  // Initial load + Auto Backup + Multi-Device Sync Polling
  useEffect(() => {
    handleRefreshAll();

    const syncInterval = setInterval(() => {
      silentSync();
    }, 12000);

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        silentSync();
      }
    };

    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);

    // Auto backup local check
    let interactionBackupDone = false;

    const performAutoBackup = async (reason = 'timer') => {
      let isEnabled = localStorage.getItem('autoBackupEnabled');
      if (isEnabled === null) {
        isEnabled = Capacitor.isNativePlatform() ? 'true' : 'false';
        localStorage.setItem('autoBackupEnabled', isEnabled);
      }
      if (isEnabled !== 'true') return;

      const lastBackupTime = parseInt(localStorage.getItem('lastAutoBackupTimestamp') || '0', 10);
      const now = Date.now();
      const TWELVE_HOURS = 12 * 60 * 60 * 1000;
      const shouldBackup = (now - lastBackupTime >= TWELVE_HOURS);

      if (shouldBackup) {
        try {
          console.log(`Executando backup automático local (${reason})...`);
          const res = await fetch('/api/backup/export');
          const parsed = await parseResponseJson(res, 'Erro ao exportar backup');
          if (parsed.ok && parsed.data) {
            const backupData = parsed.data;
            const dateStr = getLocalDateString();
            const timeStr = new Date().toLocaleTimeString('pt-BR').replace(/:/g, '-');
            const fileName = `bikepark_backup_auto_${dateStr}_${timeStr}.json`;
            const jsonString = JSON.stringify(backupData, null, 2);

            if (Capacitor.isNativePlatform()) {
              try {
                const permissions = await Filesystem.checkPermissions();
                if (permissions.publicStorage !== 'granted') {
                  await Filesystem.requestPermissions();
                }
                await Filesystem.writeFile({
                  path: fileName,
                  data: jsonString,
                  directory: Directory.Documents,
                  encoding: Encoding.UTF8
                });
              } catch (err) {
                console.error('Erro ao salvar no capacitor', err);
              }
            } else {
              const blob = new Blob([jsonString], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const downloadAnchorNode = document.createElement('a');
              downloadAnchorNode.style.display = 'none';
              downloadAnchorNode.setAttribute('href', url);
              downloadAnchorNode.setAttribute('download', fileName);
              document.body.appendChild(downloadAnchorNode);
              downloadAnchorNode.click();
              setTimeout(() => {
                document.body.removeChild(downloadAnchorNode);
                URL.revokeObjectURL(url);
              }, 100);
            }
            localStorage.setItem('lastAutoBackupTimestamp', now.toString());
          }
        } catch (e) { console.warn('Auto backup skipped:', e); }
      }
    };

    setTimeout(() => {
      if (!interactionBackupDone) {
        interactionBackupDone = true;
        performAutoBackup('startup');
      }
    }, 1500);

    const onFirstInteraction = () => {
      if (!interactionBackupDone) {
        interactionBackupDone = true;
        document.removeEventListener('click', onFirstInteraction);
        document.removeEventListener('touchstart', onFirstInteraction);
        if (!Capacitor.isNativePlatform()) {
          performAutoBackup('startup');
        }
      }
    };

    document.addEventListener('click', onFirstInteraction);
    document.addEventListener('touchstart', onFirstInteraction);

    const backupTimer = setInterval(() => performAutoBackup('timer'), 60 * 1000);

    return () => {
      clearInterval(syncInterval);
      clearInterval(backupTimer);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      document.removeEventListener('click', onFirstInteraction);
      document.removeEventListener('touchstart', onFirstInteraction);
    };
  }, [handleRefreshAll, silentSync]);

  // Online / Offline listeners & offline queue flushing
  useEffect(() => {
    const updateQueueCount = () => setOfflineQueueCount(getOfflineQueue().length);
    const handleOnline = () => {
      setIsOnline(true);
      setErrorMsg(null);
      runOfflineFlush();
      silentSync();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('bikepark_offline_queue_changed', updateQueueCount);

    // Flush if queue already has pending items on startup/enable
    runOfflineFlush();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('bikepark_offline_queue_changed', updateQueueCount);
    };
  }, [runOfflineFlush, silentSync]);

  // Global keyboard shortcuts when enableKeyboardShortcuts is active
  useEffect(() => {
    if (!deviceModules.enableKeyboardShortcuts) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        if (deviceModules.canCheckIn !== false) {
          e.preventDefault();
          setIsCheckInOpen(true);
        }
      } else if (e.key === 'F4') {
        e.preventDefault();
        if (deviceModules.enableQrTicketScanner) {
          setIsScannerOpen(true);
        } else {
          setActiveTab('active');
        }
      } else if (e.key === 'Escape') {
        if (vehicleToCheckOut) setVehicleToCheckOut(null);
        else if (isCheckInOpen) setIsCheckInOpen(false);
        else if (isScannerOpen) setIsScannerOpen(false);
        else if (isOperatorModalOpen) setIsOperatorModalOpen(false);
        else if (isResetAppOpen) setIsResetAppOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    deviceModules.enableKeyboardShortcuts,
    deviceModules.canCheckIn,
    deviceModules.enableQrTicketScanner,
    vehicleToCheckOut,
    isCheckInOpen,
    isScannerOpen,
    isOperatorModalOpen,
    isResetAppOpen,
  ]);

  const handleResetApp = async () => {
    try {
      const res = await fetch('/api/system/reset', { method: 'DELETE' });
      const parsed = await parseResponseJson(res, 'Erro ao zerar aplicativo.');
      if (parsed.ok) {
        setVehicles([]);
        setTransactions([]);
        setLostCards([]);
        setIsResetAppOpen(false);
        setErrorMsg(null);
        showToast('success', 'Aplicativo zerado com sucesso.');
      } else {
        setErrorMsg(parsed.error || 'Erro ao zerar aplicativo.');
      }
    } catch (e) {
      console.error('Failed to reset app', e);
      setErrorMsg('Falha ao zerar aplicativo.');
    }
  };

  const handleAddTransaction = async (transaction: Omit<Transaction, 'id'>) => {
    const payload: Omit<Transaction, 'id'> = {
      ...transaction,
      operator: transaction.operator || (deviceModules.enableOperatorLogin ? activeOperator : activeShift?.operatorName)
    };

    if (deviceModules.enableOfflineQueue && !navigator.onLine) {
      enqueueOfflineMutation({
        method: 'POST',
        url: '/api/transactions',
        body: payload,
        description: `Lançamento (${payload.description})`,
      });
      const localTx: Transaction = { ...payload, id: `offline_${Date.now()}` };
      setTransactions(prev => [localTx, ...prev].sort((a, b) => b.date - a.date));
      showToast('info', 'Sem internet: lançamento salvo na fila offline.');
      return;
    }

    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const data = await res.json();
        setTransactions(prev => [data, ...prev].sort((a, b) => b.date - a.date));
      }
    } catch (e) {
      console.error('Failed to add transaction', e);
      if (deviceModules.enableOfflineQueue) {
        enqueueOfflineMutation({
          method: 'POST',
          url: '/api/transactions',
          body: payload,
          description: `Lançamento (${payload.description})`,
        });
        const localTx: Transaction = { ...payload, id: `offline_${Date.now()}` };
        setTransactions(prev => [localTx, ...prev].sort((a, b) => b.date - a.date));
        showToast('info', 'Falha de rede: lançamento salvo na fila offline.');
      }
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
        showToast('success', 'Baixa de fiado registrada com sucesso!');
      } else {
        showToast('error', 'Erro ao realizar baixa do fiado.');
      }
    } catch (error) {
      console.error('Error paying fiado', error);
      showToast('error', 'Falha de comunicação ao registrar baixa de fiado.');
    }
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
    const payload = {
      ...sale,
      operatorName: sale.operatorName || (deviceModules.enableOperatorLogin ? activeOperator : undefined),
    };
    const res = await fetch('/api/sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      fetchProducts();
      fetchSales();
      fetchTransactions();
      showToast('success', 'Venda realizada com sucesso!');
    } else {
      showToast('error', 'Erro ao registrar venda.');
    }
  };

  const handleCheckIn = async (newVehicle: Omit<ParkedVehicle, 'id' | 'status'>) => {
    const payload: Omit<ParkedVehicle, 'id' | 'status'> = {
      ...newVehicle,
      operatorName: newVehicle.operatorName || (deviceModules.enableOperatorLogin ? activeOperator : undefined),
    };

    if (deviceModules.enableOfflineQueue && !navigator.onLine) {
      enqueueOfflineMutation({
        method: 'POST',
        url: '/api/vehicles',
        body: payload,
        description: `Entrada Cartão ${payload.cardNumber}`,
      });
      const optimistic: ParkedVehicle = { ...payload, id: `offline_${Date.now()}`, status: 'active' };
      setVehicles(prev => [optimistic, ...prev]);
      setIsCheckInOpen(false);
      showToast('info', `Sem internet: entrada do cartão ${payload.cardNumber} salva na fila offline.`);
      return { success: true, vehicle: optimistic };
    }

    try {
      const res = await fetch('/api/vehicles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const parsed = await parseResponseJson(res, 'Erro ao registrar entrada');
      if (parsed.ok) {
        fetchVehicles();
        fetchLostCards();
        setIsCheckInOpen(false);
        return { success: true, vehicle: parsed.data };
      } else {
        return { success: false, error: parsed.error || 'Erro ao registrar entrada' };
      }
    } catch (error) {
      console.error('Error during checkin', error);
      if (deviceModules.enableOfflineQueue) {
        enqueueOfflineMutation({
          method: 'POST',
          url: '/api/vehicles',
          body: payload,
          description: `Entrada Cartão ${payload.cardNumber}`,
        });
        const optimistic: ParkedVehicle = { ...payload, id: `offline_${Date.now()}`, status: 'active' };
        setVehicles(prev => [optimistic, ...prev]);
        setIsCheckInOpen(false);
        showToast('info', `Falha de rede: entrada do cartão ${payload.cardNumber} salva na fila offline.`);
        return { success: true, vehicle: optimistic };
      }
      return { success: false, error: 'Erro de conexão com o servidor' };
    }
  };

  const handleCheckInBulk = async (newVehicles: Omit<ParkedVehicle, 'id' | 'status'>[]) => {
    try {
      let successCount = 0;
      for (const vehicle of newVehicles) {
        const payload = {
          ...vehicle,
          operatorName: vehicle.operatorName || (deviceModules.enableOperatorLogin ? activeOperator : undefined),
        };
        const res = await fetch('/api/vehicles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (res.ok) successCount++;
      }
      fetchVehicles();
      fetchLostCards();
      setIsCheckInOpen(false);
      return { success: true, count: successCount };
    } catch (error) {
      console.error('Error during bulk checkin', error);
      return { success: false, error: 'Erro de conexão com o servidor' };
    }
  };

  const handleCheckOut = async (
    vehicleId: string,
    price: number,
    paymentMethod: 'card' | 'cash' | 'postpaid_card' | 'fiado' | 'machine' | 'pix',
    customerCardId?: string,
    checkInTime?: number,
    checkOutTime?: number
  ) => {
    const payload = {
      price,
      paymentMethod,
      customerCardId,
      checkInTime,
      checkOutTime,
      checkOutOperatorName: deviceModules.enableOperatorLogin ? activeOperator : undefined,
    };

    if (deviceModules.enableOfflineQueue && !navigator.onLine) {
      enqueueOfflineMutation({
        method: 'PUT',
        url: `/api/vehicles/${vehicleId}/checkout`,
        body: payload,
        description: `Saída Veículo #${vehicleId.slice(-4)}`,
      });
      setVehicles(prev =>
        prev.map(v =>
          v.id === vehicleId
            ? { ...v, status: 'completed', price, paymentMethod, checkOutTime: checkOutTime || Date.now() }
            : v
        )
      );
      setVehicleToCheckOut(null);
      showToast('info', 'Sem internet: saída salva na fila offline para sincronizar.');
      return;
    }

    try {
      const res = await fetch(`/api/vehicles/${vehicleId}/checkout`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const parsed = await parseResponseJson(res, 'Erro ao registrar checkout');
      if (parsed.ok) {
        fetchVehicles();
        fetchLostCards();
        fetchCustomerCards();
        setVehicleToCheckOut(null);
        showToast('success', 'Saída finalizada com sucesso!');
      } else {
        showToast('error', `Erro ao registrar saída: ${parsed.error}`);
        fetchVehicles();
      }
    } catch (error) {
      console.error('Error during checkout', error);
      if (deviceModules.enableOfflineQueue) {
        enqueueOfflineMutation({
          method: 'PUT',
          url: `/api/vehicles/${vehicleId}/checkout`,
          body: payload,
          description: `Saída Veículo #${vehicleId.slice(-4)}`,
        });
        setVehicles(prev =>
          prev.map(v =>
            v.id === vehicleId
              ? { ...v, status: 'completed', price, paymentMethod, checkOutTime: checkOutTime || Date.now() }
              : v
          )
        );
        setVehicleToCheckOut(null);
        showToast('info', 'Falha de rede: saída salva na fila offline.');
      } else {
        showToast('error', 'Erro ao registrar checkout');
      }
    }
  };

  const handleRevertCheckout = async (vehicleId: string) => {
    try {
      const res = await fetch(`/api/vehicles/${vehicleId}/revert-checkout`, { method: 'PUT' });
      if (res.ok) {
        fetchVehicles();
        showToast('success', 'Saída revertida com sucesso.');
      } else {
        showToast('error', 'Erro ao estornar saída.');
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
        showToast('success', 'Entrada cancelada com sucesso.');
      } else {
        showToast('error', 'Erro ao estornar entrada.');
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
      const parsed = await parseResponseJson(res, 'Erro ao registrar cartão perdido');
      if (parsed.ok) {
        fetchVehicles();
        fetchLostCards();
        showToast('success', 'Cartão perdido registrado.');
      } else {
        showToast('error', 'Erro ao registrar cartão perdido: ' + parsed.error);
      }
    } catch (error) {
      console.error('Failed to report lost card', error);
      showToast('error', 'Erro inesperado ao registrar cartão perdido.');
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
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <button
          className="px-4 py-2 bg-emerald-500 rounded text-white font-bold"
          onClick={() => setUser({ email: 'admin@admin.com', displayName: 'Admin' })}
        >
          Entrar Localmente
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-900 font-sans text-slate-900 dark:text-slate-100 overflow-hidden transition-colors">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onLogout={handleLogout}
        user={user as any}
        isOpen={isMobileMenuOpen}
        setIsOpen={setIsMobileMenuOpen}
        modules={deviceModules}
      />

      <main className="flex-1 flex flex-col relative overflow-hidden w-full">
        {/* Top Header */}
        <header className="h-20 bg-white dark:bg-slate-950 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between px-4 lg:px-8 shrink-0">
          <div className="flex items-center">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-2 mr-2 -ml-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg lg:hidden"
            >
              <Menu className="w-6 h-6" />
            </button>

            {activeTab !== 'dashboard' && (
              <button
                onClick={() => setActiveTab('dashboard')}
                className="p-2 mr-3 text-slate-600 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl flex items-center transition-colors border border-slate-200 dark:border-slate-700 lg:-ml-2 bg-white dark:bg-slate-900 shadow-sm"
                title="Voltar ao Início"
              >
                <ArrowLeft className="w-5 h-5 sm:mr-1" />
                <span className="font-medium hidden sm:inline text-sm">Voltar</span>
              </button>
            )}

            <div className="flex items-center text-sm text-slate-500 dark:text-slate-400 font-medium hidden sm:flex">
              <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded-md mr-2 font-bold">PRO</span>
              Sistema de Gestão
            </div>
            <div className="flex items-center text-sm text-slate-500 font-medium sm:hidden">
              <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded-md font-bold">PRO</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {deviceModules.enableOfflineQueue && (!isOnline || offlineQueueCount > 0) && (
              <button
                onClick={() => runOfflineFlush()}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
                  !isOnline
                    ? 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/50 dark:border-amber-800 dark:text-amber-300'
                    : 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-950/50 dark:border-indigo-800 dark:text-indigo-300'
                }`}
                title={!isOnline ? 'Operando offline' : 'Clique para sincronizar fila pendente'}
              >
                {!isOnline ? <WifiOff className="w-3.5 h-3.5" /> : <RefreshCw className="w-3.5 h-3.5" />}
                <span>{!isOnline ? 'Offline' : 'Sincronizar'} ({offlineQueueCount})</span>
              </button>
            )}

            {deviceModules.enableQrTicketScanner && (
              <button
                onClick={() => setIsScannerOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-colors"
                title={deviceModules.enableKeyboardShortcuts ? 'Ler QR Code do Ticket (F4)' : 'Ler QR Code do Ticket'}
              >
                <QrCode className="w-4 h-4 text-emerald-600" />
                <span className="hidden md:inline">Ler Ticket</span>
              </button>
            )}

            {deviceModules.enableOperatorLogin && (
              <button
                onClick={() => setIsOperatorModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-xl text-xs font-bold transition-colors"
                title="Trocar operador ativo"
              >
                <UserCheck className="w-4 h-4" />
                <span className="hidden sm:inline max-w-[110px] truncate">{activeOperator}</span>
              </button>
            )}

            {deviceModules.enableDarkMode && (
              <button
                onClick={toggleDarkTheme}
                className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-amber-400 rounded-xl transition-colors"
                title={isDarkTheme ? 'Mudar para Tema Claro' : 'Mudar para Tema Escuro'}
              >
                {isDarkTheme ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
            )}

            {deviceModules.canCheckIn !== false && (
              <button
                onClick={() => setIsCheckInOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs sm:text-sm font-bold shadow-sm shadow-emerald-500/20 transition-colors"
                title={deviceModules.enableKeyboardShortcuts ? 'Nova Entrada (F2)' : 'Nova Entrada'}
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Nova Entrada</span>
              </button>
            )}
          </div>
        </header>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-8 relative">
          <div className="max-w-6xl mx-auto">
            {toast && (
              <div
                className={`mb-4 px-4 py-3 rounded-xl border flex items-center justify-between text-sm font-semibold shadow-sm ${
                  toast.type === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/60 dark:border-emerald-800 dark:text-emerald-200'
                    : toast.type === 'warning'
                    ? 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/60 dark:border-amber-800 dark:text-amber-200'
                    : toast.type === 'error'
                    ? 'bg-red-50 border-red-200 text-red-800 dark:bg-red-950/60 dark:border-red-800 dark:text-red-200'
                    : 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-950/60 dark:border-blue-800 dark:text-blue-200'
                }`}
              >
                <div className="flex items-center gap-2">
                  {toast.type === 'success' ? (
                    <CheckCircle className="w-4 h-4 shrink-0" />
                  ) : toast.type === 'info' ? (
                    <Info className="w-4 h-4 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                  )}
                  <span>{toast.text}</span>
                </div>
                <button onClick={() => setToast(null)} className="p-1 opacity-70 hover:opacity-100">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {errorMsg && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-xl mb-4" role="alert">
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
                    customerCards={customerCards}
                    deviceConfig={deviceModules}
                    activeOperator={deviceModules.enableOperatorLogin ? activeOperator : undefined}
                    onAddSale={handleAddSale}
                    onNavigate={setActiveTab}
                    onSpotClick={(spotNum, occupiedVehicle) => {
                      if (occupiedVehicle) {
                        if (deviceModules.canCheckOut !== false) {
                          setVehicleToCheckOut(occupiedVehicle);
                        }
                      } else if (deviceModules.canCheckIn !== false) {
                        setInitialCheckInSpot(spotNum.toString());
                        setIsCheckInOpen(true);
                      }
                    }}
                  />
                )}
                {activeTab === 'active' && (
                  <ActiveParking
                    vehicles={vehicles}
                    pricing={pricing}
                    deviceConfig={deviceModules}
                    onCheckOut={setVehicleToCheckOut}
                    onRevertCheckin={handleRevertCheckin}
                    onOpenScanner={() => setIsScannerOpen(true)}
                  />
                )}
                {activeTab === 'conference' && <Conference vehicles={vehicles} shifts={shifts} />}
                {activeTab === 'stored' && (
                  <StoredVehicles
                    vehicles={vehicles}
                    pricing={pricing}
                    deviceConfig={deviceModules}
                    onCheckOut={setVehicleToCheckOut}
                  />
                )}
                {activeTab === 'spots' && (
                  <SpotsGrid
                    vehicles={vehicles}
                    pricing={pricing}
                    lostCards={lostCards}
                    deviceConfig={deviceModules}
                    onSpotClick={(spotNum, occupiedVehicle) => {
                      if (occupiedVehicle) {
                        if (deviceModules.canCheckOut !== false) {
                          setVehicleToCheckOut(occupiedVehicle);
                        }
                      } else if (deviceModules.canCheckIn !== false) {
                        setInitialCheckInSpot(spotNum.toString());
                        setIsCheckInOpen(true);
                      }
                    }}
                  />
                )}
                {activeTab === 'checkout' && (
                  <CheckOut
                    vehicles={vehicles}
                    pricing={pricing}
                    customerCards={customerCards}
                    deviceConfig={deviceModules}
                    onCheckOut={handleCheckOut}
                  />
                )}
                {activeTab === 'cashbook' && (
                  <CashBook
                    transactions={transactions}
                    vehicles={vehicles}
                    shifts={shifts}
                    deviceConfig={deviceModules}
                    onAddTransaction={handleAddTransaction}
                    onDeleteTransaction={handleDeleteTransaction}
                    onPayFiado={handlePayFiado}
                  />
                )}
                {activeTab === 'shifts' && (
                  <ShiftControl
                    operators={operators}
                    shifts={shifts}
                    transactions={transactions}
                    vehicles={vehicles}
                    sales={sales}
                    activeShift={activeShift}
                    user={user as any}
                    deviceConfig={deviceModules}
                    activeOperator={deviceModules.enableOperatorLogin ? activeOperator : undefined}
                    onOpenShift={handleOpenShift}
                    onCloseShift={handleCloseShift}
                  />
                )}
                {activeTab === 'cards' && (
                  <CustomerCards
                    cards={customerCards}
                    vehicles={vehicles}
                    transactions={transactions}
                    deviceConfig={deviceModules}
                    onAddCard={handleAddCard}
                    onUpdateCard={handleUpdateCard}
                    onDeleteCard={handleDeleteCard}
                    onAddTransaction={handleAddTransaction}
                  />
                )}
                {activeTab === 'store' && (
                  <Store
                    products={products}
                    pricing={pricing}
                    deviceConfig={deviceModules}
                    activeOperator={deviceModules.enableOperatorLogin ? activeOperator : undefined}
                    onAddProduct={handleAddProduct}
                    onUpdateProduct={handleUpdateProduct}
                    onDeleteProduct={handleDeleteProduct}
                    onAddSale={handleAddSale}
                  />
                )}
                {activeTab === 'audit' && (
                  <Audit
                    vehicles={vehicles}
                    sales={sales}
                    transactions={transactions}
                    products={products}
                    onRefreshAll={handleRefreshAll}
                  />
                )}
                {activeTab === 'history' && (
                  <History
                    vehicles={vehicles}
                    deviceConfig={deviceModules}
                    onRevertCheckout={handleRevertCheckout}
                  />
                )}
                {activeTab === 'reports' && (
                  <Reports
                    vehicles={vehicles}
                    sales={sales}
                    transactions={transactions}
                    deviceConfig={deviceModules}
                  />
                )}
                {activeTab === 'settings' && (
                  <Settings
                    operators={operators}
                    onAddOperator={handleAddOperator}
                    onDeleteOperator={handleDeleteOperator}
                    pricing={pricing}
                    vehicles={vehicles}
                    onSavePricing={handleSavePricing}
                    lostCards={lostCards}
                    onLostCardsChange={() => { fetchLostCards(); fetchVehicles(); }}
                    onResetApp={() => setIsResetAppOpen(true)}
                    onRefreshAll={handleRefreshAll}
                  />
                )}
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
        onCheckInBulk={handleCheckInBulk}
        initialCardNumber={initialCheckInSpot}
        vehicles={vehicles}
        lostCards={lostCards}
        deviceConfig={deviceModules}
        activeOperator={deviceModules.enableOperatorLogin ? activeOperator : undefined}
      />

      <CheckOutModal
        vehicle={vehicleToCheckOut}
        pricing={pricing}
        customerCards={customerCards}
        deviceConfig={deviceModules}
        onClose={() => setVehicleToCheckOut(null)}
        onConfirm={handleCheckOut}
        onReportLostCard={handleReportLostCard}
        onRevertCheckin={handleRevertCheckin}
      />

      <QrScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        vehicles={vehicles}
        onVehicleFound={(foundVehicle) => {
          setIsScannerOpen(false);
          if (deviceModules.canCheckOut !== false) {
            setVehicleToCheckOut(foundVehicle);
          } else {
            showToast('info', `Veículo localizado: Cartão #${foundVehicle.cardNumber}`);
            setActiveTab('active');
          }
        }}
      />

      <OperatorLoginModal
        isOpen={isOperatorModalOpen}
        onClose={() => setIsOperatorModalOpen(false)}
        operators={operators}
        currentOperatorName={activeOperator}
        onSelectOperator={handleSelectOperator}
      />

      <ResetAppModal
        isOpen={isResetAppOpen}
        onClose={() => setIsResetAppOpen(false)}
        onConfirm={handleResetApp}
      />
    </div>
  );
}
