import React, { useState, useEffect, useRef } from 'react';
import { Fuel, Plus, Edit3, CheckCircle2, DollarSign, MapPin, Building, X, Trash2, Settings, AlertTriangle } from 'lucide-react';
import { GasStation, FuelType, CentralTank, User, canEditSystemData } from '../types';
import { formatCurrency, getFuelTypeName } from '../utils/calculations';
import { getCentralTanks, updateCentralTank, getCurrentUser, getTankStatus } from '../utils/storage';
import { EditCentralTankModal } from './EditCentralTankModal';

interface GasStationsViewProps {
  gasStations: GasStation[];
  onAddStation: (station: Omit<GasStation, 'id'>) => void;
  onUpdateStation: (id: string, fields: Partial<GasStation>) => void;
  onDeleteStation?: (id: string) => void;
  darkMode: boolean;
  highlightedTankId?: string | null;
  onClearHighlightTank?: () => void;
}

export const GasStationsViewComponent: React.FC<GasStationsViewProps> = ({
  gasStations,
  onAddStation,
  onUpdateStation,
  onDeleteStation,
  darkMode,
  highlightedTankId,
  onClearHighlightTank
}) => {
  const [showModal, setShowModal] = useState(false);
  const [editingStation, setEditingStation] = useState<GasStation | null>(null);
  const [selectedTankForModal, setSelectedTankForModal] = useState<CentralTank | null>(null);
  const [activeHighlight, setActiveHighlight] = useState<string | null>(highlightedTankId || null);
  const highlightedRef = useRef<HTMLDivElement | null>(null);
  const currentUser = getCurrentUser() || { id: 'usr-admin', name: 'Administrador', role: 'ADMIN' } as User;
  const canEdit = canEditSystemData(currentUser.role);
  const centralTanks = getCentralTanks();

  useEffect(() => {
    if (highlightedTankId) {
      setActiveHighlight(highlightedTankId);
      setTimeout(() => {
        if (highlightedRef.current) {
          highlightedRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 200);

      const timer = setTimeout(() => {
        setActiveHighlight(null);
        if (onClearHighlightTank) onClearHighlightTank();
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [highlightedTankId, onClearHighlightTank]);

  // Helpers to handle price input with comma (,) or dot (.) decimal separators
  const parseFuelPrice = (val: string | number | undefined | null): number => {
    if (typeof val === 'number') return isNaN(val) ? 0 : val;
    if (!val) return 0;
    const clean = String(val).replace(',', '.').trim();
    const parsed = parseFloat(clean);
    return isNaN(parsed) ? 0 : parsed;
  };

  const formatPriceForInput = (val: number | string | undefined | null, fallback = '0,00'): string => {
    if (val === undefined || val === null || val === '') return fallback;
    if (typeof val === 'string') return val;
    return String(val).replace('.', ',');
  };

  // Form states
  const [name, setName] = useState('');
  const [type, setType] = useState<'INTERNO' | 'EXTERNO'>('INTERNO');
  const [supplierName, setSupplierName] = useState('');
  const [location, setLocation] = useState('');
  const [dieselS10Price, setDieselS10Price] = useState('5,79');
  const [dieselS500Price, setDieselS500Price] = useState('5,59');
  const [gasolinaPrice, setGasolinaPrice] = useState('6,09');
  const [etanolPrice, setEtanolPrice] = useState('3,89');

  const handleOpenAdd = () => {
    setEditingStation(null);
    setName('');
    setType('INTERNO');
    setSupplierName('');
    setLocation('');
    setDieselS10Price('5,79');
    setDieselS500Price('5,59');
    setGasolinaPrice('6,09');
    setEtanolPrice('3,89');
    setShowModal(true);
  };

  const handleOpenEdit = (stn: GasStation) => {
    setEditingStation(stn);
    setName(stn.name);
    setType(stn.type);
    setSupplierName(stn.supplierName);
    setLocation(stn.location);
    setDieselS10Price(formatPriceForInput(stn.pricePerLiter.DIESEL_S10, '5,79'));
    setDieselS500Price(formatPriceForInput(stn.pricePerLiter.DIESEL_S500, '5,59'));
    setGasolinaPrice(formatPriceForInput(stn.pricePerLiter.GASOLINA_COMUM, '6,09'));
    setEtanolPrice(formatPriceForInput(stn.pricePerLiter.ETANOL, '3,89'));
    setShowModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const s10 = parseFuelPrice(dieselS10Price);
    const s500 = parseFuelPrice(dieselS500Price);
    const gas = parseFuelPrice(gasolinaPrice);
    const eta = parseFuelPrice(etanolPrice);

    if (editingStation) {
      onUpdateStation(editingStation.id, {
        name,
        type,
        supplierName,
        location,
        pricePerLiter: {
          DIESEL_S10: s10,
          DIESEL_S500: s500,
          GASOLINA_COMUM: gas,
          GASOLINA_GRID: gas > 0 ? Number((gas + 0.30).toFixed(2)) : 0,
          ETANOL: eta,
          ARLA_32: 2.50,
          NENHUM: 0
        }
      });
    } else {
      onAddStation({
        name,
        type,
        supplierName,
        location,
        pricePerLiter: {
          DIESEL_S10: s10,
          DIESEL_S500: s500,
          GASOLINA_COMUM: gas,
          GASOLINA_GRID: gas > 0 ? Number((gas + 0.30).toFixed(2)) : 0,
          ETANOL: eta,
          ARLA_32: 2.50,
          NENHUM: 0
        },
        active: true
      });
    }
    setShowModal(false);
    setEditingStation(null);
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-emerald-100 flex items-center gap-2">
            <Fuel className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            Postos de Combustível & Fornecedores
          </h1>
          <p className="text-xs text-gray-500 dark:text-emerald-400">
            Gestão do posto interno da fazenda, postos comerciais externos e tabela de preços vigentes.
          </p>
        </div>

        {canEdit && (
          <button
            onClick={handleOpenAdd}
            className="bg-emerald-800 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-md flex items-center gap-2 self-start sm:self-auto"
          >
            <Plus className="w-4 h-4 text-amber-400" />
            <span>Cadastrar Posto</span>
          </button>
        )}
      </div>

      {/* Gas Stations Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {gasStations.map(stn => {
          const isHighlighted = !!activeHighlight && (
            stn.id === activeHighlight ||
            stn.tankId === activeHighlight ||
            (activeHighlight === 'tank-quadra' && (stn.id === 'tank-quadra' || stn.name.toLowerCase().includes('quadra'))) ||
            (activeHighlight === 'tank-itapeva' && (stn.id === 'tank-itapeva' || stn.name.toLowerCase().includes('itapeva')))
          );

          return (
            <div
              key={stn.id}
              ref={isHighlighted ? highlightedRef : undefined}
              className={`p-5 rounded-2xl border space-y-4 transition-all duration-300 ${
                isHighlighted
                  ? 'ring-2 ring-[#FACC15] shadow-[0_0_25px_rgba(250,204,21,0.35)] bg-emerald-950/90 border-[#FACC15]'
                  : darkMode ? 'bg-emerald-950/40 border-emerald-900' : 'bg-white border-emerald-100 shadow-sm'
              }`}
            >
              {isHighlighted && (
                <div className="p-2.5 rounded-xl bg-amber-500/20 border border-amber-500/50 flex items-center justify-between text-xs text-amber-300 font-bold animate-pulse">
                  <span className="flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-[#FACC15]" />
                    Tanque Indicado na Notificação Push
                  </span>
                  <span className="text-[10px] text-amber-200">Verifique o Estoque</span>
                </div>
              )}
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                  stn.type === 'INTERNO' 
                    ? 'bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30' 
                    : 'bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/30'
                }`}>
                  Posto {stn.type}
                </span>
                <h3 className="font-extrabold text-sm text-gray-900 dark:text-emerald-100 mt-1">
                  {stn.name}
                </h3>
                <p className="text-xs text-gray-500 dark:text-emerald-300 flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3.5 h-3.5 text-amber-500" /> {stn.location}
                </p>
              </div>

              {canEdit && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleOpenEdit(stn)}
                    className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
                    title="Editar Posto e Preços"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  {onDeleteStation && (
                    <button
                      onClick={() => {
                        if (confirm(`Tem certeza que deseja excluir o posto "${stn.name}"? Esta ação não pode ser desfeita.`)) {
                          onDeleteStation(stn.id);
                        }
                      }}
                      className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20"
                      title="Excluir Posto"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* If Internal Station, show Tank status and quick config button */}
            {stn.type === 'INTERNO' && (() => {
              const matchedTank = centralTanks.find(t => 
                t.id === stn.tankId || 
                (stn.id === 'tank-quadra' || stn.name.toLowerCase().includes('quadra') ? t.id === 'tank-quadra' : false) ||
                (stn.id === 'tank-itapeva' || stn.name.toLowerCase().includes('itapeva') ? t.id === 'tank-itapeva' : false)
              ) || centralTanks[0];

              if (!matchedTank) return null;
              const status = getTankStatus(matchedTank.id);

              return (
                <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-800/80 space-y-2 text-xs">
                  <div className="flex items-center justify-between font-bold">
                    <span className="text-emerald-300 flex items-center gap-1.5">
                      <Fuel className="w-3.5 h-3.5 text-[#FACC15]" />
                      Estoque Físico
                    </span>
                    <span className="text-[#FACC15] font-black">{status.percentage}%</span>
                  </div>

                  <div className="w-full h-2 bg-emerald-900 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full ${status.isCritical ? 'bg-red-500' : (status.isLow ? 'bg-amber-500' : 'bg-[#FACC15]')}`}
                      style={{ width: `${Math.min(100, Math.max(0, status.percentage))}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-emerald-200">
                    <span>{Math.round(status.currentStock).toLocaleString('pt-BR')} L / {status.capacity.toLocaleString('pt-BR')} L</span>
                    {canEdit && (
                      <button
                        onClick={() => setSelectedTankForModal(matchedTank)}
                        className="text-[#FACC15] hover:underline font-bold flex items-center gap-1"
                      >
                        <Settings className="w-3 h-3" />
                        Configurar
                      </button>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Price Table */}
            <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/15 space-y-1.5 text-xs">
              <span className="text-[10px] font-bold text-gray-500 dark:text-emerald-400 uppercase block mb-1">
                Tabela de Preços Atual (R$/L)
              </span>
              <div className="flex justify-between font-semibold">
                <span>Diesel S10:</span>
                <strong className="text-emerald-700 dark:text-emerald-300">{formatCurrency(stn.pricePerLiter.DIESEL_S10)}</strong>
              </div>
              <div className="flex justify-between font-semibold">
                <span>Diesel S500:</span>
                <strong className="text-emerald-700 dark:text-emerald-300">{formatCurrency(stn.pricePerLiter.DIESEL_S500)}</strong>
              </div>
              <div className="flex justify-between font-semibold">
                <span>Gasolina Comum:</span>
                <strong className="text-gray-800 dark:text-emerald-200">{formatCurrency(stn.pricePerLiter.GASOLINA_COMUM)}</strong>
              </div>
              <div className="flex justify-between font-semibold">
                <span>Etanol:</span>
                <strong className="text-amber-600 dark:text-amber-400">{formatCurrency(stn.pricePerLiter.ETANOL)}</strong>
              </div>
            </div>

            <p className="text-[11px] text-gray-500 dark:text-emerald-400 font-medium">
              Fornecedor: <strong>{stn.supplierName}</strong>
            </p>
          </div>
          );
        })}
      </div>

      {/* New/Edit Station Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className={`w-full max-w-md rounded-2xl shadow-2xl border p-5 space-y-4 ${
            darkMode ? 'bg-emerald-950 border-emerald-800 text-emerald-100' : 'bg-white border-emerald-100 text-gray-900'
          }`}>
            <div className="flex items-center justify-between border-b pb-3 border-emerald-800/20">
              <span className="font-bold text-sm">
                {editingStation ? 'Editar Posto e Preços' : 'Cadastrar Novo Posto'}
              </span>
              <button onClick={() => { setShowModal(false); setEditingStation(null); }} className="p-1 rounded-lg hover:bg-emerald-500/10">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold mb-1">Nome do Posto</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Posto Fazenda Andrade - Sede..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={`w-full p-2 rounded-xl border ${darkMode ? 'bg-emerald-900/40 border-emerald-800' : 'bg-gray-50'}`}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold mb-1">Tipo</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as any)}
                    className={`w-full p-2 rounded-xl border ${darkMode ? 'bg-emerald-900/40 border-emerald-800' : 'bg-gray-50'}`}
                  >
                    <option value="INTERNO">Interno (Fazenda)</option>
                    <option value="EXTERNO">Externo (Comercial)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold mb-1">Fornecedor</label>
                  <input
                    type="text"
                    placeholder="Ex: Vibra / Shell..."
                    value={supplierName}
                    onChange={(e) => setSupplierName(e.target.value)}
                    className={`w-full p-2 rounded-xl border ${darkMode ? 'bg-emerald-900/40 border-emerald-800' : 'bg-gray-50'}`}
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold mb-1">Localização</label>
                <input
                  type="text"
                  placeholder="Ex: Sorriso/MT - BR 163 Km 740..."
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className={`w-full p-2 rounded-xl border ${darkMode ? 'bg-emerald-900/40 border-emerald-800' : 'bg-gray-50'}`}
                />
              </div>

              <div className="p-3 rounded-xl bg-emerald-900/30 border border-emerald-800/60 space-y-1">
                <span className="font-bold text-xs flex items-center gap-1.5 text-amber-300">
                  {type === 'INTERNO' ? 'Regra do Posto Interno:' : 'Regra do Posto Externo:'}
                </span>
                <p className="text-[11px] text-emerald-300/80">
                  {type === 'INTERNO' 
                    ? 'No posto interno (sede), estes preços são travados e aplicados automaticamente aos abastecimentos sem digitação manual.' 
                    : 'No posto externo comercial, estes preços servem como referência padrão. O usuário poderá digitar manualmente o valor exato no momento de registrar o abastecimento.'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold mb-1">Preço Diesel S10 (R$/L)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="Ex: 5,79 ou 5.79"
                    value={dieselS10Price}
                    onChange={(e) => setDieselS10Price(e.target.value)}
                    className={`w-full p-2 rounded-xl border ${darkMode ? 'bg-emerald-900/40 border-emerald-800 text-white' : 'bg-gray-50 text-gray-900'}`}
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">Preço Diesel S500 (R$/L)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="Ex: 5,59 ou 5.59"
                    value={dieselS500Price}
                    onChange={(e) => setDieselS500Price(e.target.value)}
                    className={`w-full p-2 rounded-xl border ${darkMode ? 'bg-emerald-900/40 border-emerald-800 text-white' : 'bg-gray-50 text-gray-900'}`}
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">Preço Gasolina (R$/L)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="Ex: 6,09 ou 6.09"
                    value={gasolinaPrice}
                    onChange={(e) => setGasolinaPrice(e.target.value)}
                    className={`w-full p-2 rounded-xl border ${darkMode ? 'bg-emerald-900/40 border-emerald-800 text-white' : 'bg-gray-50 text-gray-900'}`}
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">Preço Etanol (R$/L)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="Ex: 3,89 ou 3.89"
                    value={etanolPrice}
                    onChange={(e) => setEtanolPrice(e.target.value)}
                    className={`w-full p-2 rounded-xl border ${darkMode ? 'bg-emerald-900/40 border-emerald-800 text-white' : 'bg-gray-50 text-gray-900'}`}
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); setEditingStation(null); }}
                  className="px-3 py-1.5 rounded-xl hover:bg-emerald-500/10"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-500 text-gray-950 font-bold"
                >
                  {editingStation ? 'Salvar Alterações' : 'Salvar Posto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Central Tank Modal when clicked */}
      {selectedTankForModal && (
        <EditCentralTankModal
          isOpen={!!selectedTankForModal}
          tank={selectedTankForModal}
          currentUser={currentUser}
          onClose={() => setSelectedTankForModal(null)}
          onSave={async (tankId, updates, reason) => {
            await updateCentralTank(tankId, updates, reason);
          }}
          darkMode={darkMode}
        />
      )}

    </div>
  );
};

export const GasStationsView = React.memo(GasStationsViewComponent);
