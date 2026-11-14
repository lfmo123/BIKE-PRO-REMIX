import React, { useState, useRef, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Save, DollarSign, Download, Upload, Database, Cloud, Trash2, Smartphone, Lock, Check, Key, Shield, QrCode, Clock, Sparkles, CheckCircle, AlertTriangle } from 'lucide-react';
import { ParkedVehicle, Pricing, LostCard, Operator } from '../types';
import { getLocalDateString } from '../lib/dateUtils';
import { parseResponseJson } from '../lib/apiUtils';
import { 
  DeviceModulesConfig, 
  getDeviceModules, 
  saveDeviceModules, 
  PRESET_PROFILES, 
  PresetProfile,
  setAdminPin,
  verifyAdminPin
} from '../lib/deviceModules';

interface SettingsProps {
  operators: Operator[];
  onAddOperator: (name: string, pin?: string) => Promise<void>;
  onDeleteOperator: (id: string) => Promise<void>;
  pricing: Pricing;
  vehicles: ParkedVehicle[];
  lostCards?: LostCard[];
  onLostCardsChange?: () => void;
  onSavePricing: (pricing: Pricing) => Promise<void> | void;
  onResetApp: () => void;
  onRefreshAll?: () => Promise<void> | void;
}

export function Settings({ operators, onAddOperator, onDeleteOperator, pricing, vehicles, lostCards = [], onLostCardsChange, onSavePricing, onResetApp, onRefreshAll }: SettingsProps) {
  const [localPricing, setLocalPricing] = useState<Pricing>(pricing);
  const [localAutoBackupEnabled, setLocalAutoBackupEnabled] = useState(localStorage.getItem('autoBackupEnabled') === 'true');
  const [isSaving, setIsSaving] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [operatorName, setOperatorName] = useState('');
  const [operatorPin, setOperatorPin] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [confirmRecoverCard, setConfirmRecoverCard] = useState<string | null>(null);
  const [confirmMigrate, setConfirmMigrate] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [modules, setModules] = useState<DeviceModulesConfig>(getDeviceModules());
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [showNewPinSection, setShowNewPinSection] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [newPinConfirm, setNewPinConfirm] = useState('');
  const [pinSuccessMsg, setPinSuccessMsg] = useState('');

  const showFeedback = (type: 'success' | 'error', text: string) => {
    setFeedback({ type, text });
    setTimeout(() => {
      setFeedback((prev) => (prev?.text === text ? null : prev));
    }, 5000);
  };

  useEffect(() => {
    setLocalPricing(pricing);
    setModules(getDeviceModules());
  }, [pricing]);

  const handleUnlockModules = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (verifyAdminPin(pinInput)) {
      setIsUnlocked(true);
      setPinError('');
      setPinInput('');
    } else {
      setPinError('PIN incorreto. Tente novamente.');
    }
  };

  const handleToggleModule = (key: keyof DeviceModulesConfig) => {
    if (!isUnlocked) return;
    const updated = { ...modules, [key]: !modules[key] };
    setModules(updated);
    saveDeviceModules(updated);
  };

  const handleApplyPreset = (presetKey: PresetProfile) => {
    if (!isUnlocked) return;
    const preset = PRESET_PROFILES[presetKey];
    if (preset) {
      setModules(preset.config);
      saveDeviceModules(preset.config);
    }
  };

  const handleChangePin = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPin.length < 4) {
      showFeedback('error', 'O PIN deve ter pelo menos 4 dígitos.');
      return;
    }
    if (newPin !== newPinConfirm) {
      showFeedback('error', 'A confirmação do PIN não confere.');
      return;
    }
    setAdminPin(newPin);
    setNewPin('');
    setNewPinConfirm('');
    setShowNewPinSection(false);
    setPinSuccessMsg('Senha PIN alterada com sucesso!');
    setTimeout(() => setPinSuccessMsg(''), 4000);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSavePricing(localPricing);
      if (localAutoBackupEnabled) {
        localStorage.setItem('autoBackupEnabled', 'true');
      } else {
        localStorage.setItem('autoBackupEnabled', 'false');
      }
      showFeedback('success', 'Configurações salvas com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar configurações:', error);
      showFeedback('error', 'Erro ao salvar configurações. Tente novamente.');
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
        const parsed = await parseResponseJson(res, 'Falha ao buscar backup');
        if (parsed.ok && parsed.data) {
          backupData = parsed.data;
        } else {
          // Se falhar o servidor por algum motivo, usa os dados locais (fallback)
          backupData = generateBackupData();
        }
      } catch (err) {
        backupData = generateBackupData();
      }

      const fileName = `bikepark_backup_completo_${getLocalDateString()}.json`;
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
          showFeedback('success', 'Backup salvo nos Documentos do dispositivo com sucesso!');
        } catch(err) {
          console.error('Erro ao salvar no capacitor', err);
          showFeedback('error', 'Erro ao salvar arquivo no dispositivo. Verifique as permissões.');
        }
      } else {
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.style.display = 'none';
        downloadAnchorNode.setAttribute("href", url);
        downloadAnchorNode.setAttribute("download", fileName);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        
        setTimeout(() => {
          document.body.removeChild(downloadAnchorNode);
          URL.revokeObjectURL(url);
        }, 100);
        showFeedback('success', 'Backup exportado com sucesso!');
      }

      // Atualiza a marcação de tempo para o sistema reconhecer que um backup foi realizado
      localStorage.setItem('lastAutoBackupTimestamp', Date.now().toString());
    } catch (error) {
      console.error("Erro ao gerar backup:", error);
      showFeedback('error', 'Erro ao tentar baixar o backup.');
    }
  };

  const handleRestoreClick = () => {
    fileInputRef.current?.click();
  };

  const handleTestDB = async () => {
    try {
      const res = await fetch('/api/system/db-status');
      const parsed = await parseResponseJson(res, 'Erro ao testar banco de dados');
      if (parsed.ok && parsed.data) {
        const data = parsed.data;
        if (data.status === 'ok') {
          showFeedback('success', `${data.message} (Banco: ${data.dbType})`);
        } else {
          showFeedback('error', `Erro ao conectar com o banco: ${data.message}`);
        }
      } else {
        showFeedback('error', parsed.error || 'Erro ao comunicar com o servidor.');
      }
    } catch (error) {
       console.error(error);
       showFeedback('error', 'Ocorreu um erro ao tentar testar o banco de dados.');
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

        if (!data || typeof data !== 'object' || (!data.pricing && !data.vehicles)) {
          throw new Error('Formato de backup inválido.');
        }

        setIsRestoring(true);

        if (modules.enableFullBackupRestore) {
          const res = await fetch('/api/backup/restore', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
          });
          const parsed = await parseResponseJson(res, 'Erro ao restaurar backup completo');
          if (!parsed.ok) {
            throw new Error(parsed.error || 'Falha ao restaurar backup no servidor.');
          }
          await onRefreshAll?.();
          showFeedback('success', parsed.data?.message || 'Backup completo restaurado no banco de dados!');
        } else {
          if (data.pricing) {
            await onSavePricing(data.pricing);
          }
          showFeedback('success', 'Tarifas do backup restauradas! Ative "Restauração Completa de Backup" nos módulos deste dispositivo para restaurar também todos os veículos e transações.');
        }
      } catch (error: any) {
        console.error('Erro ao restaurar backup:', error);
        showFeedback('error', error?.message || 'Erro ao restaurar backup. Verifique se o arquivo é válido.');
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
    <div className="space-y-6 max-w-2xl pb-16">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Configurações</h1>
      </div>

      {feedback && (
        <div className={`p-4 rounded-xl border flex items-center gap-3 text-sm font-semibold ${
          feedback.type === 'success'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/50 dark:border-emerald-800 dark:text-emerald-200'
            : 'bg-red-50 border-red-200 text-red-800 dark:bg-red-950/50 dark:border-red-800 dark:text-red-200'
        }`}>
          {feedback.type === 'success' ? <CheckCircle className="w-5 h-5 shrink-0" /> : <AlertTriangle className="w-5 h-5 shrink-0" />}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* MÓDULOS DESTE DISPOSITIVO & PIN */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="bg-indigo-100 p-2 rounded-lg">
              <Smartphone className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Módulos deste Dispositivo</h2>
              <p className="text-xs text-slate-500">
                Personalize quais menus e funções ficam visíveis especificamente neste aparelho.
              </p>
            </div>
          </div>
          {isUnlocked && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-md border border-emerald-200">
              <Check className="w-3.5 h-3.5" /> Desbloqueado
            </span>
          )}
        </div>

        {!isUnlocked ? (
          <form onSubmit={handleUnlockModules} className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center gap-2 text-slate-700 text-sm font-semibold">
              <Lock className="w-4 h-4 text-slate-500" />
              <span>Digite o PIN de Administrador para configurar este aparelho</span>
            </div>
            <p className="text-xs text-slate-500">
              Acesso restrito ao administrador do estabelecimento.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="password"
                inputMode="numeric"
                maxLength={8}
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                placeholder="Digite o PIN de segurança"
                className="flex-1 px-4 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm"
              />
              <button
                type="submit"
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-1.5"
              >
                <Key className="w-4 h-4" /> Desbloquear
              </button>
            </div>
            {pinError && <p className="text-xs text-red-600 font-medium">{pinError}</p>}
          </form>
        ) : (
          <div className="space-y-6">
            {/* Perfis Rápidos */}
            <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100">
              <label className="block text-xs font-bold uppercase tracking-wider text-indigo-900 mb-2">
                ⚡ Perfis Prontos de Operação
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {(['all', 'patio', 'caixa'] as PresetProfile[]).map((key) => {
                  const p = PRESET_PROFILES[key];
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handleApplyPreset(key)}
                      className="p-3 text-left bg-white hover:bg-indigo-50 border border-indigo-200 hover:border-indigo-400 rounded-xl transition-all shadow-xs flex flex-col justify-between"
                    >
                      <span className="text-xs font-bold text-slate-800">{p.name}</span>
                      <span className="text-[11px] text-slate-500 mt-1 line-clamp-2">{p.description}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Módulos Individuais */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-3">
                📋 Módulos Ativos neste Aparelho
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {[
                  { key: 'dashboard', label: 'Painel Geral', desc: 'Resumo e indicadores principais' },
                  { key: 'active', label: 'Vagas Ativas', desc: 'Listagem de veículos no pátio' },
                  { key: 'conference', label: 'Conferência de Pátio', desc: 'Auditoria e conferência física' },
                  { key: 'spots', label: 'Grade de Vagas', desc: 'Visualização gráfica de vagas numeradas' },
                  { key: 'stored', label: 'Em Depósito', desc: 'Veículos abandonados ou retidos' },
                  { key: 'cards', label: 'Cartões Mensalistas', desc: 'Pré-pago e pós-pago de clientes' },
                  { key: 'shifts', label: 'Fechamento de Caixa', desc: 'Abertura, turnos e conferência de caixa' },
                  { key: 'cashbook', label: 'Livro Caixa', desc: 'Registro de entradas e saídas extras' },
                  { key: 'store', label: 'Loja & Estoque', desc: 'Venda de peças, acessórios e bebidas' },
                  { key: 'history', label: 'Histórico de Saídas', desc: 'Consultas de veículos finalizados' },
                  { key: 'reports', label: 'Relatórios Financeiros', desc: 'Gráficos e estatísticas de faturamento' },
                  { key: 'audit', label: 'Auditoria do Sistema', desc: 'Rastreio de ações dos operadores' },
                ].map((item) => {
                  const isEnabled = (modules as any)[item.key] !== false;
                  return (
                    <div
                      key={item.key}
                      onClick={() => handleToggleModule(item.key as keyof DeviceModulesConfig)}
                      className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                        isEnabled
                          ? 'bg-slate-50 border-slate-300'
                          : 'bg-white border-slate-200 opacity-60'
                      }`}
                    >
                      <div className="pr-2">
                        <p className={`text-sm font-semibold ${isEnabled ? 'text-slate-900' : 'text-slate-500'}`}>
                          {item.label}
                        </p>
                        <p className="text-xs text-slate-500">{item.desc}</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={isEnabled}
                        onChange={() => {}}
                        className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 cursor-pointer"
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Permissões de Funções Específicas */}
            <div className="pt-4 border-t border-slate-200">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                🔒 Permissões e Ações Específicas neste Aparelho
              </label>
              <p className="text-xs text-slate-500 mb-3">
                Desative botões críticos para impedir descontos indevidos, edições de horário ou saídas não autorizadas.
              </p>

              <div className="space-y-4">
                {/* Entrada e Pátio */}
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    🚲 Entrada & Pátio
                  </h4>
                  <div className="space-y-2">
                    {[
                      { key: 'canCheckIn', label: 'Permitir Nova Entrada de Veículo', desc: 'Exibe o botão de check-in' },
                      { key: 'canCheckInBulk', label: 'Permitir Entrada em Lote / Várias Vagas', desc: 'Preenchimento rápido de múltiplos cartões' },
                      { key: 'canPrintTicket', label: 'Permitir Imprimir Ticket / Cupom', desc: 'Geração de comprovante térmico de entrada' },
                      { key: 'canRevertCheckin', label: 'Permitir Cancelar Entrada Recente', desc: 'Reversão de veículo que acabou de entrar' },
                    ].map((item) => {
                      const isEnabled = (modules as any)[item.key] !== false;
                      return (
                        <label key={item.key} className="flex items-start justify-between cursor-pointer p-1.5 rounded-lg hover:bg-white transition-colors">
                          <div className="pr-2">
                            <span className={`text-xs font-semibold ${isEnabled ? 'text-slate-900' : 'text-slate-500'}`}>{item.label}</span>
                            <p className="text-[11px] text-slate-500">{item.desc}</p>
                          </div>
                          <input
                            type="checkbox"
                            checked={isEnabled}
                            onChange={() => handleToggleModule(item.key as keyof DeviceModulesConfig)}
                            className="mt-0.5 w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 cursor-pointer"
                          />
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Saída e Cobrança */}
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    💳 Saída, Cobrança & Checkout
                  </h4>
                  <div className="space-y-2">
                    {[
                      { key: 'canCheckOut', label: 'Permitir Realizar Saída / Cobrança', desc: 'Habilita o botão de finalizar estadia' },
                      { key: 'canEditCheckoutPrice', label: 'Permitir Alterar Valor Cobrado Manualmente', desc: 'Desabilitar impede operador de dar desconto/alterar o cálculo' },
                      { key: 'canEditCheckoutTimes', label: 'Permitir Editar Horários de Entrada/Saída', desc: 'Desabilitar bloqueia alteração manual do tempo estacionado' },
                      { key: 'canReportLostCard', label: 'Permitir Lançar Cartão Perdido com Taxa', desc: 'Cobrança de taxa por extravio' },
                      { key: 'canAcceptFiado', label: 'Permitir Pagamento Fiado / Débito em Conta', desc: 'Habilita opção Fiado na tela de pagamento' },
                      { key: 'canRevertCheckout', label: 'Permitir Reverter Saída Finalizada', desc: 'Reabrir veículo no histórico de saídas' },
                    ].map((item) => {
                      const isEnabled = (modules as any)[item.key] !== false;
                      return (
                        <label key={item.key} className="flex items-start justify-between cursor-pointer p-1.5 rounded-lg hover:bg-white transition-colors">
                          <div className="pr-2">
                            <span className={`text-xs font-semibold ${isEnabled ? 'text-slate-900' : 'text-slate-500'}`}>{item.label}</span>
                            <p className="text-[11px] text-slate-500">{item.desc}</p>
                          </div>
                          <input
                            type="checkbox"
                            checked={isEnabled}
                            onChange={() => handleToggleModule(item.key as keyof DeviceModulesConfig)}
                            className="mt-0.5 w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 cursor-pointer"
                          />
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Caixa, Loja & Clientes */}
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    🏪 Caixa, Loja & Mensalistas
                  </h4>
                  <div className="space-y-2">
                    {[
                      { key: 'canManageShifts', label: 'Permitir Abertura / Fechamento de Turno', desc: 'Operação de caixa e sangria' },
                      { key: 'canManageCashbook', label: 'Permitir Lançar Receitas/Despesas Extras', desc: 'Lançamentos diretos no Livro Caixa' },
                      { key: 'canSellProducts', label: 'Permitir Venda de Produtos da Loja', desc: 'Venda de peças, acessórios e bebidas' },
                      { key: 'canManageInventory', label: 'Permitir Alterar Estoque e Preço de Produtos', desc: 'Cadastro e ajuste de mercadorias' },
                      { key: 'canManageCards', label: 'Permitir Cadastrar/Alterar Mensalistas', desc: 'Recarga de créditos e criação de cartões' },
                    ].map((item) => {
                      const isEnabled = (modules as any)[item.key] !== false;
                      return (
                        <label key={item.key} className="flex items-start justify-between cursor-pointer p-1.5 rounded-lg hover:bg-white transition-colors">
                          <div className="pr-2">
                            <span className={`text-xs font-semibold ${isEnabled ? 'text-slate-900' : 'text-slate-500'}`}>{item.label}</span>
                            <p className="text-[11px] text-slate-500">{item.desc}</p>
                          </div>
                          <input
                            type="checkbox"
                            checked={isEnabled}
                            onChange={() => handleToggleModule(item.key as keyof DeviceModulesConfig)}
                            className="mt-0.5 w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 cursor-pointer"
                          />
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Recursos Modernos Opcionais (Desativados por Padrão) */}
                <div className="bg-indigo-50/60 dark:bg-indigo-950/30 p-4 rounded-xl border border-indigo-200 dark:border-indigo-800 space-y-4">
                  <div>
                    <h4 className="text-xs font-bold text-indigo-900 dark:text-indigo-200 uppercase tracking-wide flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      Recursos Modernos Opcionais (Desativados por Padrão)
                    </h4>
                    <p className="text-[11px] text-indigo-700/80 dark:text-indigo-300/80 mt-0.5">
                      Ative somente o que desejar usar especificamente neste dispositivo. Todos começam desligados para manter a operação tradicional intacta.
                    </p>
                  </div>

                  {/* Atendimento & Cobrança */}
                  <div className="bg-white/90 dark:bg-slate-900/60 p-3 rounded-xl border border-indigo-100 dark:border-indigo-900/60 space-y-2">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                      Atendimento & Cobrança
                    </p>
                    {[
                      { key: 'enablePixQrCode', label: 'PIX QR Code Dinâmico (Copia e Cola)', desc: 'Gera QR Code EMV/PIX automático na saída e na lojinha (configure sua chave PIX na tabela de preços)' },
                      { key: 'enableWhatsappReceipts', label: 'Recibos e Cobrança via WhatsApp', desc: 'Botão para enviar comprovante de entrada, saída, extrato ou cobrança de fiado no WhatsApp' },
                      { key: 'enableQrTicketScanner', label: 'QR Code no Ticket + Leitor por Câmera', desc: 'Imprime QR Code no cupom de entrada e habilita leitura rápida pela câmera para dar saída' },
                      { key: 'enableCheckInPhoto', label: 'Foto & Checklist de Avarias na Entrada', desc: 'Captura foto compacta do veículo e observações de avarias no check-in' },
                    ].map((item) => {
                      const isEnabled = Boolean((modules as any)[item.key]);
                      return (
                        <label key={item.key} className="flex items-start justify-between cursor-pointer p-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                          <div className="pr-2">
                            <span className={`text-xs font-semibold ${isEnabled ? 'text-indigo-900 dark:text-indigo-200' : 'text-slate-600 dark:text-slate-400'}`}>{item.label}</span>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">{item.desc}</p>
                          </div>
                          <input
                            type="checkbox"
                            checked={isEnabled}
                            onChange={() => handleToggleModule(item.key as keyof DeviceModulesConfig)}
                            className="mt-0.5 w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 cursor-pointer"
                          />
                        </label>
                      );
                    })}
                  </div>

                  {/* Tarifação & Mensalistas */}
                  <div className="bg-white/90 dark:bg-slate-900/60 p-3 rounded-xl border border-indigo-100 dark:border-indigo-900/60 space-y-2">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                      Motor de Tarifação & Mensalistas
                    </p>
                    {[
                      { key: 'enableHourlyPricing', label: 'Cobrança por Tolerância, Hora & Fração', desc: 'Calcula tolerância inicial, 1ª hora, frações extras e teto diário (desativado = diária 24h tradicional)' },
                      { key: 'enableCardExpiryAlerts', label: 'Controle & Alertas de Vencimento de Mensalistas', desc: 'Exibe data de vencimento, mensalidade e alertas de cartão vencido/a vencer' },
                    ].map((item) => {
                      const isEnabled = Boolean((modules as any)[item.key]);
                      return (
                        <label key={item.key} className="flex items-start justify-between cursor-pointer p-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                          <div className="pr-2">
                            <span className={`text-xs font-semibold ${isEnabled ? 'text-indigo-900 dark:text-indigo-200' : 'text-slate-600 dark:text-slate-400'}`}>{item.label}</span>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">{item.desc}</p>
                          </div>
                          <input
                            type="checkbox"
                            checked={isEnabled}
                            onChange={() => handleToggleModule(item.key as keyof DeviceModulesConfig)}
                            className="mt-0.5 w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 cursor-pointer"
                          />
                        </label>
                      );
                    })}
                  </div>

                  {/* Infraestrutura & Segurança */}
                  <div className="bg-white/90 dark:bg-slate-900/60 p-3 rounded-xl border border-indigo-100 dark:border-indigo-900/60 space-y-2">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                      Infraestrutura, Offline & Segurança
                    </p>
                    {[
                      { key: 'enableOfflineQueue', label: 'Fila Offline-First (Sincronização ao Reconectar)', desc: 'Guarda entradas, saídas e lançamentos offline na fila local e sincroniza quando a internet voltar' },
                      { key: 'enableOperatorLogin', label: 'Login / Troca Rápida de Operador por PIN', desc: 'Identifica o operador ativo no topo e registra quem fez cada entrada, saída e venda' },
                      { key: 'enableFullBackupRestore', label: 'Restauração Completa de Backup no Servidor', desc: 'Permite restaurar todas as coleções (veículos, caixa, cartões, loja) a partir de um JSON' },
                    ].map((item) => {
                      const isEnabled = Boolean((modules as any)[item.key]);
                      return (
                        <label key={item.key} className="flex items-start justify-between cursor-pointer p-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                          <div className="pr-2">
                            <span className={`text-xs font-semibold ${isEnabled ? 'text-indigo-900 dark:text-indigo-200' : 'text-slate-600 dark:text-slate-400'}`}>{item.label}</span>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">{item.desc}</p>
                          </div>
                          <input
                            type="checkbox"
                            checked={isEnabled}
                            onChange={() => handleToggleModule(item.key as keyof DeviceModulesConfig)}
                            className="mt-0.5 w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 cursor-pointer"
                          />
                        </label>
                      );
                    })}
                  </div>

                  {/* Visual, Produtividade & Relatórios */}
                  <div className="bg-white/90 dark:bg-slate-900/60 p-3 rounded-xl border border-indigo-100 dark:border-indigo-900/60 space-y-2">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                      Visual, Produtividade & Relatórios
                    </p>
                    {[
                      { key: 'enableDarkMode', label: 'Modo Escuro (Tema Dark neste Dispositivo)', desc: 'Habilita alternância entre tema claro e escuro no topo do sistema' },
                      { key: 'enableKeyboardShortcuts', label: 'Atalhos de Teclado no PC', desc: 'F2 = Nova Entrada, F4 = Leitor/Vagas Ativas, Esc = Fechar Modal' },
                      { key: 'enablePeakHoursChart', label: 'Gráfico de Horários de Pico (00h–23h)', desc: 'Exibe fluxo horário de entradas e saídas na tela de Relatórios' },
                      { key: 'enableCsvExport', label: 'Exportação de Tabelas para Excel (CSV)', desc: 'Adiciona botão Exportar CSV em Relatórios, Histórico, Livro Caixa e Mensalistas' },
                      { key: 'enableSmartAlerts', label: 'Alertas Inteligentes no Painel Inicial', desc: 'Destaca estoque baixo, fiado antigo (+7 dias), lotação alta e mensalistas vencidos' },
                    ].map((item) => {
                      const isEnabled = Boolean((modules as any)[item.key]);
                      return (
                        <label key={item.key} className="flex items-start justify-between cursor-pointer p-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                          <div className="pr-2">
                            <span className={`text-xs font-semibold ${isEnabled ? 'text-indigo-900 dark:text-indigo-200' : 'text-slate-600 dark:text-slate-400'}`}>{item.label}</span>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">{item.desc}</p>
                          </div>
                          <input
                            type="checkbox"
                            checked={isEnabled}
                            onChange={() => handleToggleModule(item.key as keyof DeviceModulesConfig)}
                            className="mt-0.5 w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 cursor-pointer"
                          />
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Alteração do PIN */}
            <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <button
                  type="button"
                  onClick={() => setShowNewPinSection(!showNewPinSection)}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                >
                  <Key className="w-3.5 h-3.5" />
                  {showNewPinSection ? 'Cancelar alteração do PIN' : 'Alterar PIN de Administrador deste aparelho'}
                </button>
                {pinSuccessMsg && <p className="text-xs text-emerald-600 font-bold mt-1">{pinSuccessMsg}</p>}
              </div>
              <button
                type="button"
                onClick={() => setIsUnlocked(false)}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1"
              >
                <Lock className="w-3.5 h-3.5" /> Bloquear Configuração
              </button>
            </div>

            {showNewPinSection && (
              <form onSubmit={handleChangePin} className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <p className="text-xs font-bold text-slate-700">Definir Novo PIN de Segurança</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={8}
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value)}
                    placeholder="Novo PIN (mín. 4 dígitos)"
                    className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs"
                    required
                  />
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={8}
                    value={newPinConfirm}
                    onChange={(e) => setNewPinConfirm(e.target.value)}
                    placeholder="Confirmar Novo PIN"
                    className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs"
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold"
                >
                  Salvar Novo PIN
                </button>
              </form>
            )}
          </div>
        )}
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
                value={localPricing.lostCardFee || ''}
                onChange={(e) => setLocalPricing({ ...localPricing, lostCardFee: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500 transition-all"
                placeholder="0"
              />
            </div>

          </div>

          {modules.enableHourlyPricing && (
            <div className="space-y-4">
              <h3 className="font-semibold text-slate-700 dark:text-slate-200 border-b border-slate-100 dark:border-slate-700 pb-2 flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-500" />
                Tolerância, Hora e Fração
              </h3>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Tolerância Gratuita (minutos)
                </label>
                <input
                  type="number"
                  min="0"
                  value={localPricing.graceMinutes ?? ''}
                  onChange={(e) => setLocalPricing({ ...localPricing, graceMinutes: e.target.value === '' ? 0 : parseInt(e.target.value, 10) })}
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  placeholder="Ex: 15"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Valor 1ª Hora (R$) — vazio usa diária padrão
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={localPricing.firstHourRate ?? ''}
                  onChange={(e) => setLocalPricing({ ...localPricing, firstHourRate: e.target.value === '' ? undefined : parseFloat(e.target.value) })}
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  placeholder="Ex: 5.00"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Fração Extra (min)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={localPricing.additionalFractionMinutes ?? ''}
                    onChange={(e) => setLocalPricing({ ...localPricing, additionalFractionMinutes: e.target.value === '' ? undefined : parseInt(e.target.value, 10) })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm"
                    placeholder="30"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Valor Fração (R$)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={localPricing.additionalFractionRate ?? ''}
                    onChange={(e) => setLocalPricing({ ...localPricing, additionalFractionRate: e.target.value === '' ? undefined : parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm"
                    placeholder="2.00"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Teto Diário (horas para fechar 1 diária)
                </label>
                <input
                  type="number"
                  min="1"
                  max="24"
                  value={localPricing.dailyCapHours ?? ''}
                  onChange={(e) => setLocalPricing({ ...localPricing, dailyCapHours: e.target.value === '' ? undefined : parseInt(e.target.value, 10) })}
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  placeholder="Ex: 6"
                />
              </div>
            </div>
          )}

          {modules.enablePixQrCode && (
            <div className="space-y-4 md:col-span-2 pt-2 border-t border-slate-100 dark:border-slate-700">
              <h3 className="font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                <QrCode className="w-4 h-4 text-emerald-600" />
                Configuração PIX (QR Code Dinâmico)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Chave PIX (CPF, CNPJ, Email, Telefone ou Aleatória)
                  </label>
                  <input
                    type="text"
                    value={localPricing.pixKey || ''}
                    onChange={(e) => setLocalPricing({ ...localPricing, pixKey: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm"
                    placeholder="Ex: 11999999999 ou email@loja.com"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Nome do Recebedor (até 25 caracteres)
                  </label>
                  <input
                    type="text"
                    maxLength={25}
                    value={localPricing.pixMerchantName || ''}
                    onChange={(e) => setLocalPricing({ ...localPricing, pixMerchantName: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm"
                    placeholder="BIKEPARK PRO"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Cidade (até 15 caracteres)
                  </label>
                  <input
                    type="text"
                    maxLength={15}
                    value={localPricing.pixMerchantCity || ''}
                    onChange={(e) => setLocalPricing({ ...localPricing, pixMerchantCity: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm"
                    placeholder="SAO PAULO"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-700">
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
                  {confirmRecoverCard === card.cardNumber ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={async () => {
                          await fetch(`/api/lost-cards?cardNumber=${encodeURIComponent(card.cardNumber)}`, { method: 'DELETE' });
                          setConfirmRecoverCard(null);
                          onLostCardsChange?.();
                          showFeedback('success', `Cartão ${card.cardNumber} devolvido à grade!`);
                        }}
                        className="px-2.5 py-1 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700"
                      >
                        Confirmar
                      </button>
                      <button
                        onClick={() => setConfirmRecoverCard(null)}
                        className="px-2 py-1 bg-white text-slate-600 rounded-lg text-xs border border-slate-300"
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <button 
                      onClick={() => setConfirmRecoverCard(card.cardNumber)}
                      className="hover:bg-red-200 p-1.5 rounded-lg transition-colors text-red-600 border border-red-300"
                      title="Marcar como encontrado"
                    >
                      <Save className="w-4 h-4 mr-1 inline" /> Recuperar
                    </button>
                  )}
                </div>
                {card.name && <div className="text-red-800"><b>Cliente:</b> {card.name}</div>}
                {card.phone && <div className="text-red-800"><b>Telefone:</b> {card.phone}</div>}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">Cadastro de Operadores</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Gerencie os operadores que podem abrir e fechar o caixa.</p>
        
        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <input 
            type="text" 
            placeholder="Nome do operador" 
            className="flex-1 px-4 py-2 border border-slate-200 dark:border-slate-700 dark:bg-slate-900 rounded-xl focus:ring-2 focus:ring-blue-500"
            value={operatorName}
            onChange={e => setOperatorName(e.target.value)}
          />
          {modules.enableOperatorLogin && (
            <input
              type="password"
              inputMode="numeric"
              maxLength={8}
              placeholder="PIN (opcional)"
              className="sm:w-36 px-3 py-2 border border-slate-200 dark:border-slate-700 dark:bg-slate-900 rounded-xl focus:ring-2 focus:ring-blue-500 text-sm"
              value={operatorPin}
              onChange={e => setOperatorPin(e.target.value)}
            />
          )}
          <button 
            onClick={() => {
              if (operatorName.trim()) {
                onAddOperator(operatorName.trim(), operatorPin.trim() || undefined);
                setOperatorName('');
                setOperatorPin('');
              }
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl font-bold"
          >
            Adicionar
          </button>
        </div>

        <div className="space-y-2">
          {operators.map(op => (
            <div key={op.id} className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-700 rounded-xl">
              <div className="flex items-center gap-2">
                <span className="font-medium text-slate-700 dark:text-slate-200">{op.name}</span>
                {op.pin && (
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 inline-flex items-center gap-1">
                    <Shield className="w-3 h-3" /> PIN ativo
                  </span>
                )}
              </div>
              <button 
                onClick={() => onDeleteOperator(op.id)}
                className="text-red-500 hover:text-red-700 p-2"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          {operators.length === 0 && <p className="text-slate-400 text-sm">Nenhum operador cadastrado.</p>}
        </div>
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
                Uma cópia do banco de dados é feita automaticamente a cada 12 horas. Se você baixar manualmente ou já tiver recebido o backup nas últimas 12 horas, o sistema não baixará novamente até completar o ciclo.
              </p>
              {(() => {
                const lastTs = parseInt(localStorage.getItem('lastAutoBackupTimestamp') || '0', 10);
                if (lastTs > 0) {
                  return (
                    <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-md border border-emerald-200">
                      <span>✓ Último backup realizado:</span>
                      <span>{new Date(lastTs).toLocaleString('pt-BR')}</span>
                    </div>
                  );
                }
                return null;
              })()}
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
        {confirmMigrate ? (
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Confirmar migração para MT/BE?</span>
            <button
              onClick={async () => {
                try {
                  const res = await fetch('/api/system/migrate-ebikes', { method: 'POST' });
                  const data = await res.json();
                  setConfirmMigrate(false);
                  showFeedback('success', data.message || 'Migração concluída.');
                  await onRefreshAll?.();
                } catch (e) {
                  setConfirmMigrate(false);
                  showFeedback('error', 'Erro ao migrar.');
                }
              }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-sm"
            >
              Sim, Migrar
            </button>
            <button
              onClick={() => setConfirmMigrate(false)}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-semibold text-sm"
            >
              Cancelar
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmMigrate(true)}
            className="flex items-center justify-center px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors shadow-lg shadow-blue-600/30"
          >
            Migrar Motos e E-Bikes
          </button>
        )}
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
