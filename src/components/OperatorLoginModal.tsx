import React, { useState } from 'react';
import { X, UserCheck, Lock, ShieldCheck } from 'lucide-react';
import { Operator } from '../types';

interface OperatorLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  operators: Operator[];
  currentOperatorName: string;
  onSelectOperator: (operatorName: string) => void;
}

export function OperatorLoginModal({
  isOpen,
  onClose,
  operators,
  currentOperatorName,
  onSelectOperator,
}: OperatorLoginModalProps) {
  const [selectedOp, setSelectedOp] = useState<Operator | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);

  if (!isOpen) return null;

  const handleChoose = (op: Operator) => {
    if (op.pin && op.pin.trim().length > 0) {
      setSelectedOp(op);
      setPinInput('');
      setPinError(false);
    } else {
      onSelectOperator(op.name);
      onClose();
    }
  };

  const handleVerifyPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOp) return;
    if (pinInput.trim() === (selectedOp.pin || '').trim()) {
      onSelectOperator(selectedOp.name);
      setSelectedOp(null);
      setPinInput('');
      setPinError(false);
      onClose();
    } else {
      setPinError(true);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md overflow-hidden shadow-xl border border-slate-200 dark:border-slate-800">
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 flex items-center justify-center">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-slate-100">Identificação do Operador</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Atual: <span className="font-semibold text-slate-700 dark:text-slate-200">{currentOperatorName}</span>
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setSelectedOp(null);
              onClose();
            }}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5">
          {selectedOp ? (
            <form onSubmit={handleVerifyPin} className="space-y-4">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center gap-3">
                <Lock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <div>
                  <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{selectedOp.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Digite o PIN individual deste operador</p>
                </div>
              </div>

              <div>
                <input
                  type="password"
                  inputMode="numeric"
                  autoFocus
                  value={pinInput}
                  onChange={(e) => {
                    setPinInput(e.target.value);
                    setPinError(false);
                  }}
                  placeholder="PIN do operador"
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-center text-lg tracking-widest font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {pinError && (
                  <p className="text-xs text-red-600 dark:text-red-400 font-medium mt-1.5 text-center">
                    PIN incorreto. Tente novamente.
                  </p>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedOp(null);
                    setPinError(false);
                  }}
                  className="flex-1 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Voltar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold"
                >
                  Confirmar
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-2.5 max-h-72 overflow-y-auto">
              <button
                onClick={() => {
                  onSelectOperator('Administrador');
                  onClose();
                }}
                className={`w-full flex items-center justify-between p-3.5 rounded-xl border text-left transition-colors ${
                  currentOperatorName === 'Administrador'
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200'
                    : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="font-semibold text-sm">Administrador (Padrão)</span>
                </div>
                {currentOperatorName === 'Administrador' && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-600 text-white">ATIVO</span>
                )}
              </button>

              {operators.length === 0 ? (
                <p className="text-xs text-center text-slate-500 dark:text-slate-400 py-4">
                  Nenhum operador extra cadastrado. Cadastre operadores em Configurações.
                </p>
              ) : (
                operators.map((op) => {
                  const isActive = currentOperatorName === op.name;
                  return (
                    <button
                      key={op.id}
                      onClick={() => handleChoose(op)}
                      className={`w-full flex items-center justify-between p-3.5 rounded-xl border text-left transition-colors ${
                        isActive
                          ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-700 text-blue-900 dark:text-blue-200'
                          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <UserCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        <span className="font-semibold text-sm">{op.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {op.pin && <Lock className="w-3.5 h-3.5 text-slate-400" />}
                        {isActive && (
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-blue-600 text-white">ATIVO</span>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
