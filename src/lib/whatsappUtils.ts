import { ParkedVehicle, CustomerCard, SpotRental } from '../types';
import { formatDuration } from './pricing';

export function normalizeWhatsappPhone(phone?: string): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('55') && digits.length >= 12) return digits;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

export function openWhatsappMessage(message: string, phone?: string) {
  const cleanPhone = normalizeWhatsappPhone(phone);
  const encoded = encodeURIComponent(message);
  const url = cleanPhone
    ? `https://wa.me/${cleanPhone}?text=${encoded}`
    : `https://wa.me/?text=${encoded}`;
  const link = document.createElement('a');
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function buildCheckInWhatsappText(vehicle: ParkedVehicle): string {
  return [
    `*BikePark - Comprovante de Entrada*`,
    `Cartão/Vaga: *#${vehicle.cardNumber}*`,
    `Veículo: ${vehicle.identifier || 'Não informado'}`,
    `Cliente: ${vehicle.ownerName || 'Não informado'}`,
    `Entrada: ${new Date(vehicle.checkInTime).toLocaleString('pt-BR')}`,
    vehicle.damageNotes ? `Obs/Avarias: ${vehicle.damageNotes}` : '',
    `Guarde o número do seu cartão para retirada.`
  ].filter(Boolean).join('\n');
}

export function buildCheckOutWhatsappText(
  vehicle: ParkedVehicle,
  price: number,
  paymentMethod: string,
  checkInMs: number,
  checkOutMs: number
): string {
  const methodLabel =
    paymentMethod === 'cash' ? 'Dinheiro' :
    paymentMethod === 'pix' ? 'PIX' :
    paymentMethod === 'machine' ? 'Cartão (Máquina)' :
    paymentMethod === 'card' ? 'Cartão Pré-Pago' :
    paymentMethod === 'postpaid_card' ? 'Cartão Pós-Pago' :
    paymentMethod === 'rental' ? 'Vaga Alugada (Incluso no Período)' :
    paymentMethod === 'fiado' ? 'Fiado (Pendente)' : paymentMethod;

  return [
    `*BikePark - Comprovante de Estacionamento*`,
    `Cartão/Vaga: *#${vehicle.cardNumber}*`,
    `Veículo: ${vehicle.identifier || 'Não informado'}`,
    `Cliente: ${vehicle.ownerName || 'Não informado'}`,
    `Entrada: ${new Date(checkInMs).toLocaleString('pt-BR')}`,
    `Saída: ${new Date(checkOutMs).toLocaleString('pt-BR')}`,
    `Permanência: ${formatDuration(checkInMs, checkOutMs)}`,
    `Valor: *R$ ${price.toFixed(2)}*`,
    `Pagamento: ${methodLabel}`,
    `Obrigado pela preferência!`
  ].join('\n');
}

export function buildFiadoWhatsappText(vehicle: ParkedVehicle): string {
  const price = Number(vehicle.price) || 0;
  const paid = Number(vehicle.fiadoPaidAmount) || 0;
  const remaining = Math.max(0, price - paid);
  return [
    `*BikePark - Lembrete de Pendência (Fiado)*`,
    `Cliente: ${vehicle.ownerName || 'Cliente'}`,
    `Veículo/Cartão: ${vehicle.identifier} (#${vehicle.cardNumber})`,
    `Data: ${new Date(vehicle.checkOutTime || vehicle.checkInTime).toLocaleDateString('pt-BR')}`,
    `Valor em aberto: *R$ ${remaining.toFixed(2)}*`,
    `Qualquer dúvida estamos à disposição.`
  ].join('\n');
}

export function buildCardWhatsappText(card: CustomerCard): string {
  const isPrepaid = card.type === 'prepaid';
  return [
    `*BikePark - Extrato de Cartão ${isPrepaid ? 'Pré-Pago' : 'Pós-Pago'}*`,
    `Cliente: ${card.ownerName}`,
    `Cartão: *#${card.cardNumber}*`,
    isPrepaid
      ? `Saldo disponível: *R$ ${(Number(card.balance) || 0).toFixed(2)}*`
      : `Fatura em aberto: *R$ ${(Number(card.balance) || 0).toFixed(2)}*`,
    card.expirationDate ? `Vencimento: ${card.expirationDate.split('-').reverse().join('/')}` : '',
    `Obrigado pela preferência!`
  ].filter(Boolean).join('\n');
}

export function buildSpotRentalWhatsappText(rental: SpotRental): string {
  const startBr = rental.startDate.split('-').reverse().join('/');
  const endBr = rental.endDate.split('-').reverse().join('/');
  const modeText = rental.mode === 'fixed'
    ? `Vaga Fixa Reservada (*#${rental.spotNumber || '-'}*)`
    : 'Direito Rotativo (Qualquer Vaga Livre)';
  return [
    `*BikePark - Comprovante de Aluguel de Vaga*`,
    `Cliente: *${rental.ownerName}*`,
    `Modalidade: ${modeText}`,
    rental.vehicleIdentifier ? `Veículo: ${rental.vehicleIdentifier}` : '',
    `Vigência: *${startBr} até ${endBr}*`,
    `Valor do Período: *R$ ${(Number(rental.price) || 0).toFixed(2)}*`,
    `Obrigado pela preferência!`
  ].filter(Boolean).join('\n');
}

export function buildTransactionFiadoWhatsappText(params: {
  clientName: string;
  title: string;
  date: number;
  remainingAmount: number;
  originLabel: string;
}): string {
  return [
    `*BikePark - Lembrete de Pendência (Fiado)*`,
    `Cliente: *${params.clientName}*`,
    `Referência: ${params.title} (${params.originLabel})`,
    `Data: ${new Date(params.date).toLocaleDateString('pt-BR')}`,
    `Valor em aberto: *R$ ${params.remainingAmount.toFixed(2)}*`,
    `Qualquer dúvida estamos à disposição.`
  ].join('\n');
}

export function buildClientFiadoSummaryWhatsappText(params: {
  clientName: string;
  count: number;
  totalRemaining: number;
  oldestDate: number;
}): string {
  return [
    `*BikePark - Resumo de Pendências (Fiado)*`,
    `Cliente: *${params.clientName}*`,
    `Lançamentos em aberto: ${params.count} (desde ${new Date(params.oldestDate).toLocaleDateString('pt-BR')})`,
    `Total em aberto: *R$ ${params.totalRemaining.toFixed(2)}*`,
    `Qualquer dúvida estamos à disposição.`
  ].join('\n');
}

export function buildCashbookSummaryWhatsappText(params: {
  periodLabel: string;
  totalIncome: number;
  incomeCash: number;
  incomePix: number;
  incomeMachine: number;
  totalExpense: number;
  balance: number;
  incomeFiado: number;
  totalPendingFiado: number;
  drawerCash?: number;
  digitalNet?: number;
  rentalPaidIncome?: number;
  rentalCheckoutsCount?: number;
}): string {
  const lines = [
    `*BikePark - Resumo do Livro Caixa*`,
    `Período: ${params.periodLabel}`,
    ``,
    `*Entradas:* R$ ${params.totalIncome.toFixed(2)}`,
    `• Dinheiro: R$ ${params.incomeCash.toFixed(2)}`,
    `• Máquina: R$ ${params.incomeMachine.toFixed(2)}`,
    `• PIX: R$ ${params.incomePix.toFixed(2)}`,
  ];

  if (params.rentalPaidIncome && params.rentalPaidIncome > 0 || (params.rentalCheckoutsCount && params.rentalCheckoutsCount > 0)) {
    lines.push(`• Vagas Alugadas (incluso acima): R$ ${(params.rentalPaidIncome || 0).toFixed(2)} (${params.rentalCheckoutsCount || 0} saídas)`);
  }

  lines.push(
    `*Saídas:* R$ ${params.totalExpense.toFixed(2)}`,
    `*Saldo do Período:* R$ ${params.balance.toFixed(2)}`
  );

  if (typeof params.drawerCash === 'number' && typeof params.digitalNet === 'number') {
    lines.push(
      ``,
      `*Separação de Caixa:*`,
      `• Dinheiro na Gaveta: R$ ${params.drawerCash.toFixed(2)}`,
      `• Digital (PIX + Máquina): R$ ${params.digitalNet.toFixed(2)}`
    );
  }

  lines.push(
    ``,
    `*Fiado:*`,
    `• Gerado no período: R$ ${params.incomeFiado.toFixed(2)}`,
    `• Total geral em haver: R$ ${params.totalPendingFiado.toFixed(2)}`
  );

  return lines.join('\n');
}


