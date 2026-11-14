import React, { useEffect, useRef, useState } from 'react';
import { X, QrCode, Camera, Search, AlertCircle } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { ParkedVehicle } from '../types';

interface QrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  vehicles: ParkedVehicle[];
  onVehicleFound: (vehicle: ParkedVehicle) => void;
}

export function QrScannerModal({ isOpen, onClose, vehicles, onVehicleFound }: QrScannerModalProps) {
  const [manualInput, setManualInput] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const readerId = 'bikepark-qr-reader';

  const extractCardOrId = (rawText: string) => {
    const trimmed = rawText.trim().toUpperCase();
    // Format: BIKEPARK:CARD:<cardNumber>:ID:<vehicleId> or BIKEPARK:<cardNumber> or direct cardNumber
    if (trimmed.startsWith('BIKEPARK:')) {
      const parts = trimmed.split(':');
      const cardIdx = parts.indexOf('CARD');
      const idIdx = parts.indexOf('ID');
      return {
        cardNumber: cardIdx >= 0 && parts[cardIdx + 1] ? parts[cardIdx + 1] : parts[1] || '',
        vehicleId: idIdx >= 0 && parts[idIdx + 1] ? parts[idIdx + 1] : '',
      };
    }
    return { cardNumber: trimmed, vehicleId: '' };
  };

  const handleMatchCode = (rawText: string) => {
    const { cardNumber, vehicleId } = extractCardOrId(rawText);
    const activeVehicles = vehicles.filter(v => v.status === 'active' || v.status === 'stored');

    let found: ParkedVehicle | undefined;
    if (vehicleId) {
      found = activeVehicles.find(v => v.id.toUpperCase() === vehicleId);
    }
    if (!found && cardNumber) {
      found = activeVehicles.find(v => v.cardNumber.toUpperCase() === cardNumber);
    }
    if (!found && cardNumber) {
      found = activeVehicles.find(v => v.identifier.toUpperCase() === cardNumber);
    }

    if (found) {
      stopScanner().finally(() => {
        onVehicleFound(found!);
        onClose();
      });
    } else {
      setErrorMsg(`Nenhum veículo ativo encontrado para "${rawText}".`);
    }
  };

  const stopScanner = async () => {
    const instance = scannerRef.current;
    if (!instance) return;
    scannerRef.current = null;
    try {
      if (instance.isScanning) {
        await instance.stop();
      }
      instance.clear();
    } catch {
      // Ignore cleanup errors when stream wasn't started
    } finally {
      setCameraActive(false);
    }
  };

  useEffect(() => {
    if (!isOpen) {
      stopScanner();
      setManualInput('');
      setErrorMsg(null);
      return;
    }

    let cancelled = false;

    const startCamera = async () => {
      setErrorMsg(null);
      try {
        await new Promise(r => setTimeout(r, 120));
        if (cancelled || !document.getElementById(readerId)) return;

        const qr = new Html5Qrcode(readerId);
        scannerRef.current = qr;
        await qr.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 220, height: 220 } },
          (decodedText) => {
            if (!cancelled) {
              handleMatchCode(decodedText);
            }
          },
          () => {
            // Ignore per-frame scan misses
          }
        );
        if (!cancelled) {
          setCameraActive(true);
        }
      } catch (err: any) {
        if (!cancelled) {
          setCameraActive(false);
          setErrorMsg(
            'Não foi possível acessar a câmera neste dispositivo ou navegador. Você pode digitar o número do cartão abaixo.'
          );
        }
      }
    };

    startCamera();

    return () => {
      cancelled = true;
      stopScanner();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    handleMatchCode(manualInput);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md overflow-hidden shadow-xl border border-slate-200 dark:border-slate-800">
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 flex items-center justify-center">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-slate-100">Leitor de Ticket QR</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Aponte a câmera para o ticket ou digite o cartão</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="relative rounded-xl overflow-hidden bg-slate-950 border border-slate-800 min-h-[230px] flex items-center justify-center">
            <div id={readerId} className="w-full" />
            {!cameraActive && !errorMsg && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 gap-2 pointer-events-none">
                <Camera className="w-8 h-8 animate-pulse" />
                <span className="text-xs">Iniciando câmera...</span>
              </div>
            )}
          </div>

          {errorMsg && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs font-medium">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={manualInput}
                onChange={(e) => {
                  setManualInput(e.target.value);
                  setErrorMsg(null);
                }}
                placeholder="Nº do cartão ou identificador..."
                className="w-full pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition-colors"
            >
              Localizar
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
