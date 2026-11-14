import QRCode from 'qrcode';

function sanitizeText(str: string, maxLen: number): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9 .,-]/g, '')
    .trim()
    .slice(0, maxLen);
}

function emvField(id: string, value: string): string {
  const len = value.length.toString().padStart(2, '0');
  return `${id}${len}${value}`;
}

function crc16Ccitt(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export interface PixPayloadParams {
  pixKey: string;
  merchantName?: string;
  merchantCity?: string;
  amount?: number;
  txid?: string;
}

export function generatePixPayload({
  pixKey,
  merchantName = 'BIKEPARK',
  merchantCity = 'SAO PAULO',
  amount,
  txid = 'BIKEPARK01'
}: PixPayloadParams): string {
  const cleanKey = pixKey.trim();
  if (!cleanKey) return '';

  const name = sanitizeText(merchantName || 'BIKEPARK', 25) || 'BIKEPARK';
  const city = sanitizeText(merchantCity || 'BRASIL', 15) || 'BRASIL';
  const cleanTxid = (txid.replace(/[^a-zA-Z0-9]/g, '').slice(0, 25)) || '***';

  const merchantAccountInfo =
    emvField('00', 'br.gov.bcb.pix') +
    emvField('01', cleanKey);

  let payload = '';
  payload += emvField('00', '01'); // Payload Format Indicator
  payload += emvField('26', merchantAccountInfo); // Merchant Account Information
  payload += emvField('52', '0000'); // Merchant Category Code
  payload += emvField('53', '986'); // Currency BRL

  if (amount !== undefined && amount > 0) {
    payload += emvField('54', amount.toFixed(2));
  }

  payload += emvField('58', 'BR');
  payload += emvField('59', name);
  payload += emvField('60', city);
  payload += emvField('62', emvField('05', cleanTxid));
  payload += '6304'; // CRC16 tag + length

  return payload + crc16Ccitt(payload);
}

export async function generateQrDataUrl(text: string, width = 220): Promise<string> {
  return QRCode.toDataURL(text, {
    width,
    margin: 1,
    errorCorrectionLevel: 'M',
  });
}

export async function generateQrSvg(text: string): Promise<string> {
  return QRCode.toString(text, {
    type: 'svg',
    margin: 1,
    width: 140,
    errorCorrectionLevel: 'M',
  });
}
