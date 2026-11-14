import { ParkedVehicle, CustomerCard } from '../types';
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
