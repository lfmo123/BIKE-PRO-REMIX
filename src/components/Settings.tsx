import React, { useState, useRef, useEffect } from 'react';
import { Save, DollarSign, Download, Upload, Database, Cloud, Trash2 } from 'lucide-react';
import { ParkedVehicle, Pricing, LostCard } from '../types';

interface SettingsProps {
  pricing: Pricing;
  vehicles: ParkedVehicle[];
  lostCards?: LostCard[];
  onLostCardsChange?: () => void;
  onSavePricing: (pricing: Pricing) => Promise<void> | void;
  onResetApp: () => void;
}

export function Settings({ pricing, vehicles, lostCards = [], onLostCardsChange, onSavePricing, onResetApp }: SettingsProps) {
  const [localPricing, setLocalPricing] = useState<Pricing>(pricing);
  const [localAutoBackupEnabled, setLocalAutoBackupEnabled] = useState(localStorage.getItem('autoBackupEnabled') === 'true');
  const [isSaving, setIsSaving] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLocalPricing(pricing);
  }, [pricing]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSavePricing(localPricing);
      if (localAutoBackupEnabled) {
        localStorage.setItem('autoBackupEnabled', 'true');
      } else {
        localStorage.setItem('autoBackupEnabled', 'false');
      }
      alert('Configurações salvas com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar configurações:', error);
      alert('Erro ao salvar configurações. Tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };

  const generateBackupData = () => {
    const activeVehicles = vehicles.filter(v => v.status === 'active' || v.status === 'stored');
    const history = vehicles.filter(v => v.status === 'completed');
    const totalRevenue = history.reduce((sum, v) => sum + (v.price || 0), 0);

    return {
      version: 2,
      exportDate: new Date().toISOString(),
      summary: {
        totalRevenue,
        activeCount: activeVehicles.length,
        historyCount: history.length,
        includesPayments: true
      },
      pricing,
      activeVehicles,
      history,
      vehicles
    };
  };

  const handleDownloadBackup = async () => {
    try {
      // Tenta buscar o backup completo (veículos, caixa, cartões, etc) do servidor
      let backupData;
      try {
        const res = await fetch('/api/backup/export');
        if (res.ok) {
          backupData = await res.json();
        } else {
          // Se falhar o servidor por algum motivo, usa os dados locais (fallback)
          backupData = generateBackupData();
        }
      } catch (err) {
        backupData = generateBackupData();
      }

      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
      const downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.setAttribute("href", dataStr);
      downloadAnchorNode.setAttribute("download", `bikepark_backup_completo_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
    } catch (error) {
      console.error("Erro ao gerar backup:", error);
      alert("Erro ao tentar baixar o backup.");
    }
  };

  const handleRestoreClick = () => {
    fileInputRef.current?.click();
  };

  const handleTestDB = async () => {
    try {
      const res = await fetch('/api/system/db-status');
      const data = await res.json();
      if (data.status === 'ok') {
        alert(data.message + '\nTipo de Banco: ' + data.dbType);
      } else {
        alert('Erro ao conectar com o banco: ' + data.message + '\nDetalhes: ' + data.error);
      }
    } catch (error) {
       console.error(error);
       alert('Ocorreu um erro ao tentar testar o banco de dados. Tente novamente.');
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string;
        const data = JSON.parse(content);

        if (!data.pricing || !data.vehicles) {
          throw new Error('Formato de backup inválido.');
        }

        setIsRestoring(true);
        await onSavePricing(data.pricing);
        
        // This is a naive local restore simulation since backend route would need writing all at once
        // For standard local use, alerting.
        alert('Backup restaurado localmente! Lembre-se de implementar a rota massiva na API.');

      } catch (error) {
        console.error('Erro ao restaurar backup:', error);
        alert('Erro ao restaurar backup. Verifique se o arquivo é válido.');
      } finally {
        setIsRestoring(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Configurações</h1>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div className="flex items-center space-x-3 mb-6">
          <div className="bg-yellow-100 p-2 rounded-lg">
            <DollarSign className="w-5 h-5 text-yellow-600" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Tabela de Preços (Valor Único / Pernoite)</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h3 className="font-semibold text-slate-700 border-b border-slate-100 pb-2">Valor por Pernoite</h3>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Bicicleta Comum (R$)
              </label>
              <input
                type="number"
                min="0"
                step="0.5"
                value={localPricing.bicycle || ''}
                onChange={(e) => setLocalPricing({ ...localPricing, bicycle: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500 transition-all"
                placeholder="0"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Bicicleta Elétrica (R$)
              </label>
              <input
                type="number"
                min="0"
                step="0.5"
                value={localPricing.ebike || ''}
                onChange={(e) => setLocalPricing({ ...localPricing, ebike: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500 transition-all"
                placeholder="0"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Motocicleta (R$)
              </label>
              <input
                type="number"
                min="0"
                step="0.5"
                value={localPricing.motorcycle || ''}
                onChange={(e) => setLocalPricing({ ...localPricing, motorcycle: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500 transition-all"
                placeholder="0"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1 text-red-600">
                Taxa Cartão Perdido (R$)
              </label>
              <input
                type="number"
                min="0"
                step="0.5"
                value={localPricing.lostCardFee !== undefined ? localPricing.lostCardFee : ''}
                onChange={(e) => setLocalPricing({ ...localPricing, lostCardFee: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500 transition-all"
                placeholder="0"
              />
            </div>

          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-slate-100">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center px-6 py-3 bg-yellow-400 hover:bg-yellow-500 text-slate-900 rounded-xl font-medium transition-colors shadow-lg shadow-yellow-400/30 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-5 h-5 mr-2" />
            {isSaving ? 'Salvando...' : 'Salvar Configurações'}
          </button>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 mt-6 mb-6">
        <div className="flex items-center space-x-3 mb-6">
          <div className="bg-red-100 p-2 rounded-lg">
            <Cloud className="w-5 h-5 text-red-600" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Cartões Perdidos</h2>
        </div>
        
        <p className="text-sm text-slate-500 mb-6">
          Estes cartões foram marcados como perdidos e estão fora de serviço. Para devolvê-los à grade ao encontrá-los, clique para remover da lista de perdidos.
        </p>

        {lostCards.length === 0 ? (
          <div className="text-slate-400 text-sm">Não há cartões perdidos no momento.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {lostCards.map(card => (
              <div key={card.cardNumber} className="flex flex-col bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl text-sm font-medium relative">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-lg text-red-900">Cartão {card.cardNumber}</span>
                  <button 
                    onClick={async () => {
                      if (confirm(`O cartão ${card.cardNumber} foi encontrado? Ele voltará para a grade como disponível.`)) {
                        await fetch(`/api/lost-cards/${card.cardNumber}`, { method: 'DELETE' });
                        onLostCardsChange?.();
                      }
                    }}
                    className="hover:bg-red-200 p-1.5 rounded-lg transition-colors text-red-600 border border-red-300"
                    title="Marcar como encontrado"
                  >
                    <Save className="w-4 h-4 mr-1 inline" /> Recuperar
                  </button>
                </div>
                {card.name && <div className="text-red-800"><b>Cliente:</b> {card.name}</div>}
                {card.phone && <div className="text-red-800"><b>Telefone:</b> {card.phone}</div>}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div className="flex items-center space-x-3 mb-6">
          <div className="bg-blue-100 p-2 rounded-lg">
            <Database className="w-5 h-5 text-blue-600" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Backup Local</h2>
        </div>
        
        <p className="text-sm text-slate-500 mb-6">
          Salve ou restaure uma cópia de segurança dos dados localmente.
        </p>

        <div className="mb-8">
          <div className="flex items-start bg-slate-50 border border-slate-200 p-4 rounded-xl">
            <input
              type="checkbox"
              id="autoBackupCheck"
              checked={localAutoBackupEnabled}
              onChange={(e) => {
                setLocalAutoBackupEnabled(e.target.checked);
                if (e.target.checked) localStorage.setItem('autoBackupEnabled', 'true');
                else localStorage.setItem('autoBackupEnabled', 'false');
              }}
              className="mt-1 w-5 h-5 text-blue-600 bg-white border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
            />
            <div className="ml-3">
              <label htmlFor="autoBackupCheck" className="text-sm font-bold text-slate-700 cursor-pointer">
                Baixar backup automaticamente
              </label>
              <p className="text-xs text-slate-500 mt-1">
                Uma cópia do banco de dados será baixada assim que abrir o software e depois a cada 4 horas. Note que para valer é preciso clicar em "Salvar Configurações" caso essa opção esteja na sessão acima, mas agora funciona ao marcar!
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 flex-wrap">
          <button
            onClick={handleDownloadBackup}
            className="flex items-center justify-center px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-medium transition-colors shadow-lg shadow-slate-900/20"
          >
            <Download className="w-5 h-5 mr-2" />
            Baixar Backup
          </button>

          <button
            onClick={handleRestoreClick}
            disabled={isRestoring}
            className="flex items-center justify-center px-6 py-3 bg-white border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Upload className="w-5 h-5 mr-2" />
            Restaurar Arquivo Local
          </button>

          <input 
            type="file" 
            accept=".json" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            className="hidden" 
          />

           <button
            onClick={handleTestDB}
            className="flex items-center justify-center px-6 py-3 border-2 border-indigo-200 hover:bg-indigo-50 hover:border-indigo-300 text-indigo-700 rounded-xl font-medium transition-colors"
          >
            <Cloud className="w-5 h-5 mr-2" />
            Testar Conexão do BD
          </button>
        </div>
      </div>
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div className="flex items-center space-x-3 mb-6">
           <div className="bg-blue-100 p-2 rounded-lg">
             <Cloud className="w-5 h-5 text-blue-600" />
           </div>
           <h2 className="text-lg font-bold text-slate-900">Migração de Grade</h2>
        </div>
        <p className="text-sm text-slate-500 mb-6">
          Move todas as motos e e-bikes hoje estacionadas na Grade Comum para a nova Grade Especial MT/BE (1 a 50).
        </p>
        <button
            onClick={async () => {
              if (window.confirm("Deseja migrar todas as Motos e E-Bikes para a nova grade MT/BE?")) {
                try {
                  const res = await fetch('/api/system/migrate-ebikes', { method: 'POST' });
                  const data = await res.json();
                  alert(data.message || 'Migração concluída.');
                  window.location.reload();
                } catch (e) {
                  alert('Erro ao migrar.');
                }
              }
            }}
            className="flex items-center justify-center px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors shadow-lg shadow-blue-600/30"
          >
            Migrar Motos e E-Bikes
        </button>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div className="flex items-center space-x-3 mb-6">
          <div className="bg-red-100 p-2 rounded-lg">
            <Trash2 className="w-5 h-5 text-red-600" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Zerar Aplicativo</h2>
        </div>
        
        <p className="text-sm text-slate-500 mb-6">
          Atenção: Esta ação apagará todos os registros do aplicativo (veículos, transações e cartões perdidos).
        </p>

        <button
          onClick={onResetApp}
          className="flex items-center justify-center px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium transition-colors shadow-lg shadow-red-600/30"
        >
          <Trash2 className="w-5 h-5 mr-2" />
          Zerar Todos os Dados
        </button>
      </div>

    </div>
  );
}
