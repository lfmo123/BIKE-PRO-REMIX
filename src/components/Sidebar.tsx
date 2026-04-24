import React from 'react';
import { LayoutDashboard, Bike, History, Settings, BarChart3, LogOut, LogOutIcon, Grid } from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onLogout: () => void;
  user: any;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

export function Sidebar({ activeTab, setActiveTab, onLogout, user, isOpen, setIsOpen }: SidebarProps) {
  const navItems = [
    { id: 'dashboard', label: 'Painel', icon: LayoutDashboard },
    { id: 'active', label: 'Estacionados', icon: Bike },
    { id: 'spots', label: 'Grade de Cartões', icon: Grid },
    { id: 'checkout', label: 'Saída', icon: LogOut },
    { id: 'history', label: 'Histórico', icon: History },
    { id: 'reports', label: 'Relatórios', icon: BarChart3 },
    { id: 'settings', label: 'Configurações', icon: Settings },
  ];

  return (
    <>
      {/* Mobile Overlay */}
      <div 
        className={`fixed inset-0 bg-slate-900/50 z-40 lg:hidden transition-opacity duration-300 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setIsOpen(false)}
      />
      
      {/* Sidebar */}
      <div className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-slate-900 text-white flex flex-col h-full transform transition-transform duration-300 ease-in-out ${
        isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}>
        <div className="p-6 flex items-center space-x-3">
        <div className="bg-emerald-500 p-2 rounded-lg">
          <Bike className="w-6 h-6 text-white" />
        </div>
        <span className="text-xl font-bold tracking-tight">BikePark Pro</span>
      </div>
      
      <nav className="flex-1 px-4 space-y-2 mt-6">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id);
                setIsOpen(false);
              }}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-colors ${
                isActive 
                  ? 'bg-emerald-500/10 text-emerald-400' 
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="font-medium">{item.label}</span>
            </button>
          );
        })}
      </nav>
      
      <div className="p-6 border-t border-slate-800">
        <div className="flex items-center space-x-3 mb-4">
          {user.photoURL ? (
            <img src={user.photoURL} alt={user.displayName || 'User'} className="w-10 h-10 rounded-full" referrerPolicy="no-referrer" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center">
              <span className="text-sm font-medium">{user.displayName?.charAt(0) || 'U'}</span>
            </div>
          )}
          <div className="overflow-hidden">
            <p className="text-sm font-medium truncate">{user.displayName || 'Usuário'}</p>
            <p className="text-xs text-slate-400 truncate">{user.email}</p>
          </div>
        </div>
        <button 
          onClick={onLogout}
          className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl transition-colors text-sm font-medium"
        >
          <LogOutIcon className="w-4 h-4" />
          <span>Sair</span>
        </button>
      </div>
      </div>
    </>
  );
}
