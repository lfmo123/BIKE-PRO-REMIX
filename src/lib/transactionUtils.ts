import { Transaction } from '../types';

export function isFiadoTransaction(t: Transaction): boolean {
  if (t.type !== 'income') return false;
  if (t.paymentMethod === 'fiado') return true;
  const desc = (t.description || '').toUpperCase();
  return desc.includes('(FIADO)');
}

export function getTransactionPaymentMethod(t: Transaction): 'fiado' | 'cash' | 'machine' | 'pix' {
  if (isFiadoTransaction(t)) return 'fiado';
  if (t.paymentMethod === 'cash') return 'cash';
  if (t.paymentMethod === 'machine' || t.paymentMethod === 'card') return 'machine';
  if (t.paymentMethod === 'pix') return 'pix';

  const desc = (t.description || '').toUpperCase();
  if (desc.includes('(DINHEIRO)') || desc.includes('DINHEIRO')) return 'cash';
  if (desc.includes('(MÁQUINA)') || desc.includes('(MAQUINA)') || desc.includes('MÁQUINA') || desc.includes('MAQUINA')) return 'machine';
  if (desc.includes('(PIX)') || desc.includes('PIX')) return 'pix';
  if (desc.includes('(CARTÃO)') || desc.includes('(CARTAO)')) return 'machine';
  return 'cash';
}

export function getTransactionRemainingFiado(t: Transaction): number {
  if (!isFiadoTransaction(t) || t.isFiadoPaid) return 0;
  const total = Number(t.amount) || 0;
  const paid = Number(t.fiadoPaidAmount) || 0;
  return Math.max(0, total - paid);
}

export function extractCardNumberFromTransaction(t: Transaction): string | null {
  if (t.cardNumber) return t.cardNumber;
  const match = (t.description || '').match(/Cartão\s+([^\s(]+)/i);
  return match ? match[1] : null;
}
