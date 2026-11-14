export interface DeviceFeaturesConfig {
  // --- Módulos Visíveis (Telas) ---
  dashboard: boolean;     // Painel Geral
  active: boolean;        // Vagas Ativas / Pátio
  conference: boolean;    // Conferência de Pátio
  stored: boolean;        // Em Depósito (Abandonadas/30+ dias)
  spots: boolean;         // Grade Visual de Vagas
  cards: boolean;         // Mensalistas / Cartões Pré e Pós
  shifts: boolean;        // Fechamento de Turno / Caixa
  cashbook: boolean;      // Livro Caixa / Despesas e Receitas
  store: boolean;         // Loja / Conveniência e Estoque
  history: boolean;       // Histórico de Saídas
  reports: boolean;       // Relatórios e Gráficos
  audit: boolean;         // Auditoria do Sistema
  settings: boolean;      // Configurações

  // --- Funções Específicas / Permissões no Aparelho ---
  // Entrada & Pátio
  canCheckIn: boolean;          // Realizar nova entrada de veículo
  canCheckInBulk: boolean;      // Entrada em lote (várias vagas de uma vez)
  canRevertCheckin: boolean;    // Cancelar/reverter entrada recém-feita
  canPrintTicket: boolean;      // Imprimir comprovante térmico de entrada

  // Saída & Cobrança (Check-out)
  canCheckOut: boolean;         // Finalizar estacionamento / cobrar
  canEditCheckoutPrice: boolean;// Alterar valor cobrado manualmente (desconto/acréscimo)
  canEditCheckoutTimes: boolean;// Editar datas/horários de entrada e saída no checkout
  canReportLostCard: boolean;   // Registrar cartão perdido com cobrança de taxa
  canAcceptFiado: boolean;      // Permitir método de pagamento "Fiado"

  // Histórico & Operações Sensíveis
  canRevertCheckout: boolean;   // Reverter saída finalizada (reabrir veículo no pátio)

  // Financeiro & Loja
  canManageCashbook: boolean;   // Lançar novas despesas/receitas no livro caixa
  canManageShifts: boolean;     // Abrir, fechar turnos ou fazer sangria de caixa
  canSellProducts: boolean;     // Realizar vendas de itens da loja
  canManageInventory: boolean;  // Cadastrar/editar produtos e estoque da loja
  canManageCards: boolean;      // Cadastrar novos mensalistas, recarregar créditos ou excluir

  // --- Recursos Modernos Opcionais (TODOS DESATIVADOS POR PADRÃO) ---
  // Atendimento & Cobrança
  enablePixQrCode: boolean;         // QR Code PIX Dinâmico (BR Code + Copia e Cola) no checkout e loja
  enableWhatsappReceipts: boolean;  // Envio de recibos e cobrança via WhatsApp Web/App
  enableQrTicketScanner: boolean;   // QR Code no ticket de entrada + Leitor por Câmera
  enableCheckInPhoto: boolean;      // Foto e checklist de avarias na entrada do veículo

  // Motor de Tarifação & Mensalistas
  enableHourlyPricing: boolean;     // Cobrança por tolerância, hora e fração (em vez de diária fixa)
  enableCardExpiryAlerts: boolean;  // Controle e alertas de vencimento de mensalistas

  // Infraestrutura, Offline & Segurança
  enableOfflineQueue: boolean;      // Fila Offline-First com sincronização automática ao reconectar
  enableOperatorLogin: boolean;     // Login / Troca rápida de operador por PIN individual + rastreio
  enableFullBackupRestore: boolean; // Restauração completa de backup JSON direto no servidor/nuvem

  // Visual, Produtividade & Relatórios
  enableDarkMode: boolean;          // Modo Escuro (Tema Dark) neste dispositivo
  enableKeyboardShortcuts: boolean; // Atalhos de teclado no PC (F2 Entrada, F4 Busca/Saída, Esc)
  enablePeakHoursChart: boolean;    // Gráfico de horários de pico nos Relatórios
  enableCsvExport: boolean;         // Exportação de tabelas/relatórios para Excel (CSV)
  enableSmartAlerts: boolean;       // Painel de alertas inteligentes (estoque baixo, fiado antigo, lotação)
}

export type PresetProfile = 'all' | 'patio' | 'caixa';

export const NEW_FEATURES_DEFAULTS = {
  enablePixQrCode: false,
  enableWhatsappReceipts: false,
  enableQrTicketScanner: false,
  enableCheckInPhoto: false,
  enableHourlyPricing: false,
  enableCardExpiryAlerts: false,
  enableOfflineQueue: false,
  enableOperatorLogin: false,
  enableFullBackupRestore: false,
  enableDarkMode: false,
  enableKeyboardShortcuts: false,
  enablePeakHoursChart: false,
  enableCsvExport: false,
  enableSmartAlerts: false,
};

export const DEFAULT_DEVICE_CONFIG: DeviceFeaturesConfig = {
  dashboard: true,
  active: true,
  conference: true,
  stored: true,
  spots: true,
  cards: true,
  shifts: true,
  cashbook: true,
  store: true,
  history: true,
  reports: true,
  audit: true,
  settings: true,

  canCheckIn: true,
  canCheckInBulk: true,
  canRevertCheckin: true,
  canPrintTicket: true,

  canCheckOut: true,
  canEditCheckoutPrice: true,
  canEditCheckoutTimes: true,
  canReportLostCard: true,
  canAcceptFiado: true,

  canRevertCheckout: true,

  canManageCashbook: true,
  canManageShifts: true,
  canSellProducts: true,
  canManageInventory: true,
  canManageCards: true,

  ...NEW_FEATURES_DEFAULTS,
};

export const PRESET_PROFILES: Record<PresetProfile, { name: string; description: string; config: DeviceFeaturesConfig }> = {
  all: {
    name: 'Administrador Completo',
    description: 'Acesso irrestrito aos módulos principais. Recursos avançados opcionais permanecem desativados até você habilitá-los.',
    config: {
      ...DEFAULT_DEVICE_CONFIG,
      ...NEW_FEATURES_DEFAULTS,
    }
  },
  patio: {
    name: 'Operador de Pátio / Cancela',
    description: 'Entrada rápida, grade visual e conferência física. Bloqueia cobrança, caixa, edição de valores e dados financeiros.',
    config: {
      dashboard: true,
      active: true,
      conference: true,
      stored: true,
      spots: true,
      cards: false,
      shifts: false,
      cashbook: false,
      store: false,
      history: true,
      reports: false,
      audit: false,
      settings: true,

      canCheckIn: true,
      canCheckInBulk: true,
      canRevertCheckin: false,
      canPrintTicket: true,

      canCheckOut: false,
      canEditCheckoutPrice: false,
      canEditCheckoutTimes: false,
      canReportLostCard: false,
      canAcceptFiado: false,

      canRevertCheckout: false,

      canManageCashbook: false,
      canManageShifts: false,
      canSellProducts: false,
      canManageInventory: false,
      canManageCards: false,

      ...NEW_FEATURES_DEFAULTS,
    }
  },
  caixa: {
    name: 'Caixa / Cobrança & Loja',
    description: 'Cobrança, recebimentos, fechamento de turno, loja e mensalistas. Permite operação financeira completa.',
    config: {
      dashboard: true,
      active: true,
      conference: false,
      stored: false,
      spots: true,
      cards: true,
      shifts: true,
      cashbook: true,
      store: true,
      history: true,
      reports: true,
      audit: false,
      settings: true,

      canCheckIn: true,
      canCheckInBulk: false,
      canRevertCheckin: true,
      canPrintTicket: true,

      canCheckOut: true,
      canEditCheckoutPrice: true,
      canEditCheckoutTimes: true,
      canReportLostCard: true,
      canAcceptFiado: true,

      canRevertCheckout: true,

      canManageCashbook: true,
      canManageShifts: true,
      canSellProducts: true,
      canManageInventory: true,
      canManageCards: true,

      ...NEW_FEATURES_DEFAULTS,
    }
  }
};

const STORAGE_KEY = 'bikepark_device_modules';
const PIN_KEY = 'bikepark_admin_pin';
const DEFAULT_PIN = '1234';

export function getDeviceConfig(): DeviceFeaturesConfig {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return { ...DEFAULT_DEVICE_CONFIG, ...parsed, settings: true };
    }
  } catch (e) {
    console.error('Erro ao ler configuração do dispositivo:', e);
  }
  return DEFAULT_DEVICE_CONFIG;
}

export function saveDeviceConfig(config: DeviceFeaturesConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    window.dispatchEvent(new Event('bikepark_modules_changed'));
  } catch (e) {
    console.error('Erro ao salvar configuração do dispositivo:', e);
  }
}

// Backward compatibility alias
export type DeviceModulesConfig = DeviceFeaturesConfig;
export const getDeviceModules = getDeviceConfig;
export const saveDeviceModules = saveDeviceConfig;

export function getAdminPin(): string {
  try {
    return localStorage.getItem(PIN_KEY) || DEFAULT_PIN;
  } catch {
    return DEFAULT_PIN;
  }
}

export function setAdminPin(pin: string): void {
  try {
    localStorage.setItem(PIN_KEY, pin);
  } catch (e) {
    console.error('Erro ao salvar PIN:', e);
  }
}

export function verifyAdminPin(inputPin: string): boolean {
  const currentPin = getAdminPin();
  return inputPin.trim() === currentPin.trim();
}
