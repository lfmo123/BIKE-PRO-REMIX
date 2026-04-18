import React, { useState, useRef, useEffect } from 'react';
import { Save, DollarSign, Download, Upload, Database, Cloud, CloudDownload } from 'lucide-react';
import { ParkedVehicle, Pricing } from '../types';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { writeBatch, doc, collection } from 'firebase/firestore';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';

interface SettingsProps {
  pricing: Pricing;
  vehicles: ParkedVehicle[];
  onSavePricing: (pricing: Pricing) => Promise<void> | void;
}

export function Settings({ pricing, vehicles, onSavePricing }: SettingsProps) {
  const [localPricing, setLocalPricing] = useState<Pricing>(pricing);
  const [isSaving, setIsSaving] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLocalPricing(pricing);
  }, [pricing]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSavePricing(localPricing);
      alert('Configurações salvas com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar configurações:', error);
      alert('Erro ao salvar configurações. Tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };

  const generateBackupData = () => {
    const activeVehicles = vehicles.filter(v => v.status === 'active');
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
      // Mantemos a chave vehicles com todos os dados para facilitar a restauração
      vehicles
    };
  };

  const handleDownloadBackup = () => {
    const backupData = generateBackupData();

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `bikepark_backup_completo_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleSaveToDrive = async () => {
    try {
      setIsUploading(true);
      const provider = new GoogleAuthProvider();
      provider.addScope('https://www.googleapis.com/auth/drive.file');
      
      // Request consent to ensure we get the token with the new scope
      provider.setCustomParameters({ prompt: 'consent' });

      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      const token = credential?.accessToken;

      if (!token) {
        throw new Error('Não foi possível obter o token de acesso do Google.');
      }

      const backupData = generateBackupData();

      const fileContent = JSON.stringify(backupData, null, 2);
      const metadata = {
        name: `bikepark_backup_completo_${new Date().toISOString().split('T')[0]}.json`,
        mimeType: 'application/json',
      };

      const boundary = '-------314159265358979323846';
      const delimiter = "\r\n--" + boundary + "\r\n";
      const close_delim = "\r\n--" + boundary + "--";

      const multipartRequestBody =
        "--" + boundary + "\r\n" +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        JSON.stringify(metadata) +
        delimiter +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        fileContent +
        close_delim;

      const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body: multipartRequestBody,
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error('Drive API Error:', errorData);
        throw new Error('Erro ao fazer upload para o Google Drive');
      }

      alert('Backup salvo no Google Drive com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar no Google Drive:', error);
      alert('Erro ao salvar no Google Drive. Verifique as permissões e tente novamente.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRestoreFromDrive = async () => {
    try {
      setIsRestoring(true);
      const provider = new GoogleAuthProvider();
      provider.addScope('https://www.googleapis.com/auth/drive.readonly');
      provider.setCustomParameters({ prompt: 'consent' });

      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      const token = credential?.accessToken;

      if (!token) {
        throw new Error('Não foi possível obter o token de acesso do Google.');
      }

      // Buscar o arquivo de backup mais recente
      const query = "name contains 'bikepark_backup_' and mimeType='application/json'";
      const searchResponse = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&orderBy=${encodeURIComponent('createdTime desc')}&pageSize=1&fields=${encodeURIComponent('files(id, name)')}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (!searchResponse.ok) {
        throw new Error('Erro ao buscar arquivos no Google Drive');
      }

      const searchData = await searchResponse.json();
      
      if (!searchData.files || searchData.files.length === 0) {
        alert('Nenhum backup encontrado no seu Google Drive.');
        return;
      }

      const fileId = searchData.files[0].id;

      // Baixar o conteúdo do arquivo
      const fileResponse = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (!fileResponse.ok) {
        throw new Error('Erro ao baixar o arquivo do Google Drive');
      }
      
      const content = await fileResponse.text();
      const data = JSON.parse(content);

      if (!data.pricing || !data.vehicles) {
        throw new Error('Formato de backup inválido.');
      }

      const user = auth.currentUser;
      if (!user) {
        alert('Usuário não autenticado.');
        return;
      }

      // Atualizar preços
      onSavePricing(data.pricing);
      setLocalPricing(data.pricing);

      // Atualizar veículos
      const batch = writeBatch(db);
      data.vehicles.forEach((vehicle: ParkedVehicle) => {
        const vehicleRef = doc(db, `users/${user.uid}/vehicles/${vehicle.id}`);
        batch.set(vehicleRef, {
          ...vehicle,
          userId: user.uid
        });
      });

      await batch.commit();
      alert(`Backup restaurado com sucesso a partir do arquivo: ${searchData.files[0].name}`);

    } catch (error) {
      console.error('Erro ao restaurar do Google Drive:', error);
      alert('Erro ao restaurar do Google Drive. Verifique as permissões e tente novamente.');
    } finally {
      setIsRestoring(false);
    }
  };

  const handleRestoreClick = () => {
    fileInputRef.current?.click();
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

        const user = auth.currentUser;
        if (!user) {
          alert('Usuário não autenticado.');
          return;
        }

        setIsRestoring(true);

        // Update pricing
        onSavePricing(data.pricing);
        setLocalPricing(data.pricing);

        // Update vehicles using a batch
        const batch = writeBatch(db);
        
        // Note: We are adding/overwriting the vehicles from the backup.
        // To do a full restore, we might want to clear existing ones, but for safety, 
        // we'll just upsert the ones from the backup using their IDs.
        data.vehicles.forEach((vehicle: ParkedVehicle) => {
          const vehicleRef = doc(db, `users/${user.uid}/vehicles/${vehicle.id}`);
          batch.set(vehicleRef, {
            ...vehicle,
            userId: user.uid
          });
        });

        await batch.commit();
        alert('Backup restaurado com sucesso!');
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
            <h3 className="font-semibold text-slate-700 border-b border-slate-100 pb-2">Configurações Gerais</h3>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Total de Vagas Disponíveis
              </label>
              <input
                type="number"
                min="1"
                step="1"
                value={localPricing.totalSpots ?? ''}
                onChange={(e) => setLocalPricing({ ...localPricing, totalSpots: e.target.value === '' ? undefined : parseInt(e.target.value, 10) })}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500 transition-all"
                placeholder="50"
              />
            </div>
          </div>
          
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

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div className="flex items-center space-x-3 mb-6">
          <div className="bg-blue-100 p-2 rounded-lg">
            <Database className="w-5 h-5 text-blue-600" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Backup Completo e Restauração</h2>
        </div>
        
        <p className="text-sm text-slate-500 mb-6">
          Salve uma cópia de segurança abrangente de todos os seus dados. O backup inclui: <strong>Veículos Ativos, Histórico Completo, Registros de Pagamentos e Tabela de Preços</strong>.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 flex-wrap">
          <button
            onClick={handleDownloadBackup}
            className="flex items-center justify-center px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-medium transition-colors shadow-lg shadow-slate-900/20"
          >
            <Download className="w-5 h-5 mr-2" />
            Baixar Backup
          </button>

          <button
            onClick={handleSaveToDrive}
            disabled={isUploading || isRestoring}
            className="flex items-center justify-center px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors shadow-lg shadow-blue-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Cloud className="w-5 h-5 mr-2" />
            {isUploading ? 'Salvando...' : 'Salvar no Drive'}
          </button>
          
          <button
            onClick={handleRestoreClick}
            disabled={isRestoring || isUploading}
            className="flex items-center justify-center px-6 py-3 bg-white border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Upload className="w-5 h-5 mr-2" />
            Restaurar Local
          </button>

          <button
            onClick={handleRestoreFromDrive}
            disabled={isRestoring || isUploading}
            className="flex items-center justify-center px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium transition-colors shadow-lg shadow-emerald-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <CloudDownload className="w-5 h-5 mr-2" />
            {isRestoring ? 'Restaurando...' : 'Restaurar do Drive'}
          </button>
          <input 
            type="file" 
            accept=".json" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            className="hidden" 
          />
        </div>
      </div>
    </div>
  );
}
