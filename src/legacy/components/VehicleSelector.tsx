import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search, ChevronDown, Check, X } from 'lucide-react';
import { Vehicle } from '../types';

interface VehicleSelectorProps {
  vehicles: Vehicle[];
  selectedVehicleId: string;
  onSelect: (vehicleId: string) => void;
  darkMode?: boolean;
  label?: string;
  required?: boolean;
  disabled?: boolean;
}

export const VehicleSelector: React.FC<VehicleSelectorProps> = ({
  vehicles,
  selectedVehicleId,
  onSelect,
  darkMode = true,
  label = 'Veículo / Trator / Máquina *',
  required = true,
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | 'TRATOR' | 'MAQUINA_AGRICOLA' | 'VEICULO'>('ALL');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Filter fuelable vehicles only
  const fuelableVehicles = useMemo(
    () => vehicles.filter(v => v.fuelType !== 'NENHUM'),
    [vehicles]
  );

  const selectedVehicle = useMemo(
    () => fuelableVehicles.find(v => v.id === selectedVehicleId) || fuelableVehicles[0],
    [fuelableVehicles, selectedVehicleId]
  );

  // Focus input when dropdown opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 80);
    }
  }, [isOpen]);

  // Counts by category
  const categoryCounts = useMemo(() => {
    return {
      ALL: fuelableVehicles.length,
      TRATOR: fuelableVehicles.filter(v => v.category === 'TRATOR').length,
      MAQUINA_AGRICOLA: fuelableVehicles.filter(v => v.category === 'MAQUINA_AGRICOLA').length,
      VEICULO: fuelableVehicles.filter(v => v.category === 'VEICULO').length,
    };
  }, [fuelableVehicles]);

  // Filtered vehicles with instant search (searching by model, licensePlate, patrimonyCode, manufacturer)
  const filteredVehicles = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    return fuelableVehicles.filter(v => {
      // Category filter
      if (categoryFilter !== 'ALL' && v.category !== categoryFilter) {
        return false;
      }

      // Search query
      if (!query) return true;
      const plate = (v.licensePlate || '').toLowerCase();
      const code = (v.patrimonyCode || '').toLowerCase();
      const model = (v.model || '').toLowerCase();
      const manufacturer = (v.manufacturer || '').toLowerCase();

      return (
        plate.includes(query) ||
        code.includes(query) ||
        model.includes(query) ||
        manufacturer.includes(query)
      );
    });
  }, [fuelableVehicles, searchQuery, categoryFilter]);

  const handleSelectVehicle = (vId: string) => {
    onSelect(vId);
    setIsOpen(false);
    setSearchQuery('');
  };

  const getCategoryEmoji = (category: string) => {
    switch (category) {
      case 'TRATOR':
        return '🚜';
      case 'MAQUINA_AGRICOLA':
        return '🌾';
      case 'VEICULO':
        return '🚗';
      default:
        return '⚙️';
    }
  };

  // Helper to format vehicle display title & plate/code
  const getIdentifierText = (v: Vehicle) => {
    if (v.licensePlate && v.patrimonyCode) {
      return `${v.patrimonyCode} • Placa: ${v.licensePlate}`;
    }
    if (v.licensePlate) {
      return `Placa: ${v.licensePlate}`;
    }
    if (v.patrimonyCode) {
      return `Cód: ${v.patrimonyCode}`;
    }
    return 'Sem identificador';
  };

  return (
    <div className="relative w-full space-y-1.5">
      {label && (
        <div className="flex items-center justify-between">
          <label className="block text-xs font-black uppercase tracking-wider text-slate-200">
            {label}
          </label>
          <span className="text-[11px] font-bold text-emerald-300">
            {fuelableVehicles.length} cadastrados
          </span>
        </div>
      )}

      {/* Selected Vehicle Trigger Card */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full text-left p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 group outline-none min-h-[56px] ${
          disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
        } ${
          isOpen
            ? 'ring-2 ring-[#FACC15] border-[#FACC15] bg-[#063327]'
            : darkMode
            ? 'bg-[#042d23] hover:bg-[#06382b] border-emerald-800/80 text-white shadow-sm'
            : 'bg-white hover:bg-slate-50 border-slate-300 text-slate-900 shadow-sm'
        }`}
      >
        {selectedVehicle ? (
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {/* Category Emoji Badge */}
            <div className="w-10 h-10 rounded-xl bg-[#FACC15] text-[#064E3B] flex items-center justify-center text-lg font-black shrink-0 shadow-sm">
              {getCategoryEmoji(selectedVehicle.category)}
            </div>

            {/* Clean Vehicle Name & Plate */}
            <div className="min-w-0 flex-1 space-y-0.5">
              <h4 className="text-sm sm:text-base font-extrabold text-white truncate group-hover:text-[#FACC15] transition-colors">
                {selectedVehicle.model}
              </h4>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 rounded-md text-xs font-black uppercase tracking-wider bg-[#064E3B] text-[#FACC15] border border-emerald-700/80">
                  {selectedVehicle.licensePlate ? `Placa: ${selectedVehicle.licensePlate}` : selectedVehicle.patrimonyCode ? `Cód: ${selectedVehicle.patrimonyCode}` : 'Sem placa'}
                </span>
                {selectedVehicle.patrimonyCode && selectedVehicle.licensePlate && (
                  <span className="text-[11px] font-semibold text-emerald-200/90">
                    ({selectedVehicle.patrimonyCode})
                  </span>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-emerald-200 py-1">
            <Search className="w-5 h-5 text-[#FACC15]" />
            <span className="text-xs sm:text-sm font-bold">Clique para selecionar um veículo...</span>
          </div>
        )}

        {/* Change hint */}
        <div className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-900/60 border border-emerald-700/60 text-[#FACC15] font-bold text-xs group-hover:bg-[#FACC15] group-hover:text-[#064E3B] transition-all">
          <span>Trocar</span>
          <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {/* Clean Dropdown Menu with Instant Search */}
      {isOpen && (
        <div className="p-3 sm:p-4 rounded-3xl border border-emerald-700/80 bg-[#03231b] shadow-2xl space-y-3 animate-in fade-in zoom-in-95 duration-150 z-30">
          
          {/* Instant Search Bar */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#FACC15]" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por nome do veículo, modelo ou placa..."
              className="w-full pl-10 pr-9 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-[#063327] border-2 border-emerald-600/80 text-white placeholder-emerald-300/60 outline-none focus:border-[#FACC15] focus:ring-2 focus:ring-[#FACC15]/20 transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg text-slate-300 hover:text-white hover:bg-emerald-800/60"
                title="Limpar busca"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Clean Category Filters */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar text-[11px] font-bold">
            <button
              type="button"
              onClick={() => setCategoryFilter('ALL')}
              className={`px-3 py-1.5 rounded-xl shrink-0 transition-all ${
                categoryFilter === 'ALL'
                  ? 'bg-[#FACC15] text-[#064E3B] font-black shadow-sm'
                  : 'bg-[#063327] text-emerald-200 hover:bg-emerald-800/60 border border-emerald-800'
              }`}
            >
              Todos ({categoryCounts.ALL})
            </button>
            <button
              type="button"
              onClick={() => setCategoryFilter('TRATOR')}
              className={`px-3 py-1.5 rounded-xl shrink-0 transition-all ${
                categoryFilter === 'TRATOR'
                  ? 'bg-[#FACC15] text-[#064E3B] font-black shadow-sm'
                  : 'bg-[#063327] text-emerald-200 hover:bg-emerald-800/60 border border-emerald-800'
              }`}
            >
              🚜 Tratores ({categoryCounts.TRATOR})
            </button>
            <button
              type="button"
              onClick={() => setCategoryFilter('MAQUINA_AGRICOLA')}
              className={`px-3 py-1.5 rounded-xl shrink-0 transition-all ${
                categoryFilter === 'MAQUINA_AGRICOLA'
                  ? 'bg-[#FACC15] text-[#064E3B] font-black shadow-sm'
                  : 'bg-[#063327] text-emerald-200 hover:bg-emerald-800/60 border border-emerald-800'
              }`}
            >
              🌾 Máquinas ({categoryCounts.MAQUINA_AGRICOLA})
            </button>
            <button
              type="button"
              onClick={() => setCategoryFilter('VEICULO')}
              className={`px-3 py-1.5 rounded-xl shrink-0 transition-all ${
                categoryFilter === 'VEICULO'
                  ? 'bg-[#FACC15] text-[#064E3B] font-black shadow-sm'
                  : 'bg-[#063327] text-emerald-200 hover:bg-emerald-800/60 border border-emerald-800'
              }`}
            >
              🚗 Veículos ({categoryCounts.VEICULO})
            </button>
          </div>

          {/* Clean List of Vehicles (Model & Plate only) */}
          <div className="max-h-60 sm:max-h-72 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
            {filteredVehicles.length === 0 ? (
              <div className="p-6 text-center rounded-2xl bg-[#04281f] border border-emerald-900/80 text-emerald-300">
                <Search className="w-6 h-6 mx-auto mb-2 text-[#FACC15] opacity-80" />
                <p className="font-bold text-xs text-white">Nenhum veículo encontrado para "{searchQuery}"</p>
                <button
                  type="button"
                  onClick={() => { setSearchQuery(''); setCategoryFilter('ALL'); }}
                  className="mt-2.5 px-3 py-1 bg-[#FACC15] text-[#064E3B] rounded-xl text-xs font-black"
                >
                  Limpar busca
                </button>
              </div>
            ) : (
              filteredVehicles.map(v => {
                const isSelected = v.id === selectedVehicleId;
                const emoji = getCategoryEmoji(v.category);
                const identifier = getIdentifierText(v);

                return (
                  <div
                    key={v.id}
                    onClick={() => handleSelectVehicle(v.id)}
                    className={`px-3.5 py-2.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 min-h-[48px] ${
                      isSelected
                        ? 'bg-[#064E3B] border-2 border-[#FACC15] shadow-md'
                        : 'bg-[#042d23] hover:bg-[#063b2e] border-emerald-800/80 text-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {/* Emoji Icon */}
                      <span className="text-xl shrink-0">
                        {emoji}
                      </span>

                      {/* Clean Name & Plate */}
                      <div className="min-w-0 flex-1">
                        <p className="text-xs sm:text-sm font-extrabold text-white truncate">
                          {v.patrimonyCode ? `${v.patrimonyCode} | ` : ''}{v.model}
                        </p>
                        <p className="text-[11px] font-bold text-[#FACC15] truncate">
                          {v.licensePlate ? `Placa: ${v.licensePlate}` : v.patrimonyCode ? `Cód: ${v.patrimonyCode}` : 'Sem placa'}
                        </p>
                      </div>
                    </div>

                    {/* Radio/Check indicator */}
                    <div className="shrink-0">
                      {isSelected ? (
                        <div className="w-6 h-6 rounded-full bg-[#FACC15] text-[#064E3B] flex items-center justify-center font-black">
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </div>
                      ) : (
                        <div className="w-6 h-6 rounded-full border border-emerald-700 bg-emerald-950/40 text-transparent"></div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="pt-2 border-t border-emerald-800/60 flex items-center justify-between text-xs">
            <span className="text-emerald-300 text-[11px]">
              {filteredVehicles.length} {filteredVehicles.length === 1 ? 'veículo listado' : 'veículos listados'}
            </span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-3 py-1.5 bg-emerald-900/80 hover:bg-emerald-800 text-emerald-100 rounded-xl font-bold text-xs"
            >
              Fechar
            </button>
          </div>

        </div>
      )}
    </div>
  );
};
