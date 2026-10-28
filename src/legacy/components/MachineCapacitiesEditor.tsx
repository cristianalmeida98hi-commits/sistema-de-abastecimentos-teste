import React, { useEffect } from 'react';
import { 
  Droplet, Fuel, Layers, Plus, Trash2, Sparkles, 
  HelpCircle, CheckCircle2, ChevronDown, Package
} from 'lucide-react';
import { 
  OperationalCapacity, OperationalCapacityType, EquipmentCategory, 
  MachineSubtype, Sector, FuelType 
} from '../types';
import { getCapacityTypeEmoji, COMMON_UNITS } from '../utils/capacities';

interface MachineCapacitiesEditorProps {
  category: EquipmentCategory;
  machineSubtype?: MachineSubtype;
  onMachineSubtypeChange?: (subtype: MachineSubtype) => void;
  sector: Sector;
  fuelType: FuelType;
  onFuelTypeChange: (fuelType: FuelType) => void;
  tankCapacityLiters: number;
  onTankCapacityChange: (liters: number) => void;
  capacities: OperationalCapacity[];
  onChangeCapacities: (capacities: OperationalCapacity[]) => void;
  darkMode?: boolean;
}

export const MachineCapacitiesEditor: React.FC<MachineCapacitiesEditorProps> = ({
  category,
  machineSubtype,
  onMachineSubtypeChange,
  sector,
  fuelType,
  onFuelTypeChange,
  tankCapacityLiters,
  onTankCapacityChange,
  capacities,
  onChangeCapacities,
  darkMode = false,
}) => {
  const isRoadVehicle = category === 'VEICULO';
  const isTractor = category === 'TRATOR';
  const isAgroMachine = category === 'MAQUINA_AGRICOLA';
  const isImplement = category === 'IMPLEMENTO';

  // Determina se a máquina é prioritariamente um pulverizador ou distribuidor de adubo
  const isSprayer = machineSubtype === 'PULVERIZADOR' || sector === 'PULVERIZACAO';
  const isFertilizerDistributor = machineSubtype === 'DISTRIBUIDOR_ADUBO';
  const isHarvester = machineSubtype === 'COLHEITADEIRA' || sector === 'COLHEITA';
  const isSeeder = machineSubtype === 'PLANTADEIRA_SEMEADORA';

  // Função para carregar sugestões padrão caso o usuário solicite
  const handleApplyDefaultSuggestions = () => {
    const suggestions: OperationalCapacity[] = [];

    if (isSprayer) {
      suggestions.push({
        id: `cap-${Date.now()}-spray`,
        type: 'PULVERIZACAO',
        name: 'Tanque de Pulverização (Calda)',
        value: 2000,
        unit: 'L',
        notes: 'Capacidade nominal de calda'
      });
    } else if (isFertilizerDistributor) {
      suggestions.push({
        id: `cap-${Date.now()}-adubo`,
        type: 'ADUBO',
        name: 'Capacidade do Tanque / Caçamba de Adubo',
        value: 1500,
        unit: 'kg',
        notes: 'Adubo granulado e calcário'
      });
    } else if (isHarvester) {
      suggestions.push({
        id: `cap-${Date.now()}-grain`,
        type: 'SEMENTE',
        name: 'Tanque Graneleiro',
        value: 10500,
        unit: 'L',
        notes: 'Capacidade de grãos'
      });
    } else if (isSeeder) {
      suggestions.push({
        id: `cap-${Date.now()}-seed`,
        type: 'SEMENTE',
        name: 'Depósito de Sementes',
        value: 1000,
        unit: 'kg',
        notes: 'Sementes'
      });
      suggestions.push({
        id: `cap-${Date.now()}-adubo-seed`,
        type: 'ADUBO',
        name: 'Depósito de Fertilizante',
        value: 1200,
        unit: 'kg',
        notes: 'Adubo no plantio'
      });
    } else {
      suggestions.push({
        id: `cap-${Date.now()}-general`,
        type: 'OUTRO',
        name: 'Capacidade de Trabalho',
        value: 1000,
        unit: 'L',
        notes: ''
      });
    }

    if (suggestions.length > 0) {
      onChangeCapacities(suggestions);
    }
  };

  // Função para adicionar uma nova capacidade
  const handleAddCapacity = (type: OperationalCapacityType, defaultName?: string, defaultUnit?: string, defaultValue?: number) => {
    let name = defaultName;
    let unit = defaultUnit || 'L';
    let val = defaultValue || 0;

    switch (type) {
      case 'PULVERIZACAO':
        name = name || 'Tanque de Pulverização';
        unit = 'L';
        val = val || 2000;
        break;
      case 'ADUBO':
        name = name || 'Capacidade de Adubo';
        unit = 'kg';
        val = val || 1500;
        break;
      case 'COMBUSTIVEL':
        name = name || 'Tanque de Combustível';
        unit = 'L';
        val = val || 250;
        break;
      case 'SEMENTE':
        name = name || 'Depósito de Sementes / Graneleiro';
        unit = 'L';
        val = val || 1000;
        break;
      case 'CACAMBA':
        name = name || 'Caçamba de Carga';
        unit = 'm³';
        val = val || 1.5;
        break;
      case 'RESERVATORIO':
        name = name || 'Reservatório de Água Limpa';
        unit = 'L';
        val = val || 300;
        break;
      case 'CARGA':
        name = name || 'Capacidade de Carga';
        unit = 'kg';
        val = val || 3000;
        break;
      case 'OUTRO':
      default:
        name = name || 'Capacidade Operacional';
        unit = 'L';
        val = val || 100;
        break;
    }

    const newCap: OperationalCapacity = {
      id: `cap-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      type,
      name,
      value: val,
      unit,
      notes: ''
    };

    onChangeCapacities([...capacities, newCap]);
  };

  const handleUpdateCapacity = (id: string, field: keyof OperationalCapacity, value: any) => {
    const updated = capacities.map(c => {
      if (c.id === id) {
        return { ...c, [field]: value };
      }
      return c;
    });
    onChangeCapacities(updated);
  };

  const handleRemoveCapacity = (id: string) => {
    onChangeCapacities(capacities.filter(c => c.id !== id));
  };

  const hasFuel = fuelType !== 'NENHUM';

  return (
    <div className={`p-4 rounded-2xl border space-y-4 transition-all ${
      darkMode ? 'bg-emerald-950/40 border-emerald-800' : 'bg-slate-50 border-emerald-200/80 shadow-xs'
    }`}>
      {/* Header da Seção */}
      <div className="flex items-center justify-between border-b pb-2.5 border-emerald-500/20">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-xl bg-emerald-600 text-white shadow-xs">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-extrabold text-slate-900 dark:text-emerald-100 flex items-center gap-1.5">
              Capacidades da Máquina
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-emerald-400/80">
              Configure os reservatórios, tanques de calda, caçambas de adubo e combustíveis específicos deste equipamento.
            </p>
          </div>
        </div>
        <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700">
          {isRoadVehicle ? 'Veículo Rodoviário' : isTractor ? 'Trator Agrícola' : isImplement ? 'Implemento' : 'Máquina Agrícola'}
        </span>
      </div>

      {/* Tipo / Subtipo Específico da Máquina (quando não for veículo comum) */}
      {!isRoadVehicle && onMachineSubtypeChange && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-emerald-200 mb-1">
              Classificação / Tipo de Equipamento
            </label>
            <select
              value={machineSubtype || (isTractor ? 'OUTRO' : isImplement ? 'IMPLEMENTO' : 'OUTRO')}
              onChange={(e) => onMachineSubtypeChange(e.target.value as MachineSubtype)}
              className={`w-full p-2.5 rounded-xl text-xs font-bold border transition-colors ${
                darkMode ? 'bg-emerald-900/60 border-emerald-700 text-white' : 'bg-white border-slate-300 text-slate-900 focus:border-emerald-500'
              }`}
            >
              <option value="PULVERIZADOR">🧪 Pulverizador (Autopropelido / Arrasto / Barras)</option>
              <option value="DISTRIBUIDOR_ADUBO">🌾 Distribuidor de Adubo / Calcário / Fertilizantes</option>
              <option value="COLHEITADEIRA">🌾 Colheitadeira de Grãos</option>
              <option value="PLANTADEIRA_SEMEADORA">🌱 Plantadeira / Semeadora</option>
              <option value="ESCAVADEIRA">🚜 Escavadeira Hidráulica</option>
              <option value="RETROESCAVADEIRA">🚜 Retroescavadeira</option>
              <option value="PA_CARREGADEIRA">🚜 Pá Carregadeira</option>
              <option value="MOTONIVELADORA">🚜 Motoniveladora</option>
              <option value="IMPLEMENTO">⚙️ Implemento (Grade, Arado, Subsolador, etc.)</option>
              <option value="CARRETA_AGRICOLA">🚛 Carreta Agrícola / Basculante</option>
              <option value="OUTRO">📦 Outro Maquinário / Equipamento Geral</option>
            </select>
          </div>

          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-white dark:bg-emerald-900/30 border border-slate-200 dark:border-emerald-800 text-xs">
            <HelpCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="text-[11px] text-slate-600 dark:text-emerald-300 leading-tight">
              O formulário ajusta as sugestões de capacidade (litros de calda, kg de adubo, tanque de diesel, etc.) com base no tipo.
            </span>
          </div>
        </div>
      )}

      {/* 1. SEÇÃO DE COMBUSTÍVEL (CONDICIONAL / DINÂMICA) */}
      <div className={`p-3.5 rounded-xl border space-y-3 transition-all ${
        hasFuel 
          ? (darkMode ? 'bg-emerald-900/20 border-emerald-800/80' : 'bg-amber-50/50 border-amber-200/80')
          : (darkMode ? 'bg-slate-900/40 border-slate-800 opacity-80' : 'bg-slate-100/80 border-slate-200 opacity-90')
      }`}>
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={hasFuel}
              onChange={(e) => {
                if (e.target.checked) {
                  onFuelTypeChange('DIESEL_S10');
                  if (tankCapacityLiters === 0) onTankCapacityChange(isRoadVehicle ? 80 : 250);
                } else {
                  onFuelTypeChange('NENHUM');
                  onTankCapacityChange(0);
                }
              }}
              className="w-4 h-4 rounded text-emerald-600 border-slate-300 focus:ring-emerald-500"
            />
            <span className="font-extrabold text-xs text-slate-800 dark:text-emerald-100 flex items-center gap-1.5">
              <Fuel className={`w-3.5 h-3.5 ${hasFuel ? 'text-amber-500' : 'text-slate-400'}`} />
              Possui Tanque / Motor a Combustível Próprio?
            </span>
          </label>
          <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
            hasFuel 
              ? 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200' 
              : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
          }`}>
            {hasFuel ? 'Motorizado' : 'Sem Tanque de Combustível (Implemento / Tracionado)'}
          </span>
        </div>

        {hasFuel && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 animate-in fade-in duration-150">
            <div>
              <label className="block font-bold text-xs text-slate-700 dark:text-emerald-200 mb-1">
                Tipo de Combustível
              </label>
              <select
                value={fuelType}
                onChange={(e) => onFuelTypeChange(e.target.value as FuelType)}
                className={`w-full p-2 rounded-xl text-xs font-bold border ${
                  darkMode ? 'bg-emerald-950 border-emerald-700 text-white' : 'bg-white border-amber-300 text-slate-900'
                }`}
              >
                <option value="DIESEL_S10">Diesel S10</option>
                <option value="DIESEL_S500">Diesel S500</option>
                <option value="GASOLINA_COMUM">Gasolina Comum</option>
                <option value="GASOLINA_GRID">Gasolina Aditivada</option>
                <option value="ETANOL">Etanol Hidratado</option>
                <option value="ARLA_32">Arla 32</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-xs text-slate-700 dark:text-emerald-200 mb-1">
                Capacidade do Tanque de Combustível (Litros) *
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  placeholder="Ex: 250, 400, 600..."
                  value={tankCapacityLiters || ''}
                  onChange={(e) => onTankCapacityChange(parseFloat(e.target.value) || 0)}
                  className={`w-full p-2 pr-8 rounded-xl text-xs font-black border ${
                    darkMode ? 'bg-emerald-950 border-amber-500/60 text-white' : 'bg-white border-amber-300 text-slate-900'
                  }`}
                />
                <span className="absolute right-3 top-2 text-xs font-extrabold text-amber-600 dark:text-amber-400">
                  L
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 2. CAPACIDADES OPERACIONAIS ADICIONAIS / CUSTOMIZADAS */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <label className="text-xs font-extrabold text-slate-800 dark:text-emerald-200 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
              Capacidades Operacionais Cadastradas ({capacities.length})
            </label>
            {capacities.length > 0 && (
              <button
                type="button"
                onClick={() => onChangeCapacities([])}
                className="px-2 py-0.5 rounded-md text-[10px] font-bold text-red-600 dark:text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 transition-colors flex items-center gap-1"
                title="Remover todas as capacidades cadastradas"
              >
                <Trash2 className="w-3 h-3" />
                <span>Limpar todas</span>
              </button>
            )}
          </div>

          {/* Quick preset buttons */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-slate-500 dark:text-emerald-400 font-bold">Adicionar:</span>
            
            <button
              type="button"
              onClick={() => handleAddCapacity('PULVERIZACAO', 'Tanque de Pulverização (Calda)', 'L', 2000)}
              className="px-2 py-1 rounded-lg text-[11px] font-extrabold bg-cyan-50 dark:bg-cyan-950/60 border border-cyan-300 dark:border-cyan-700 text-cyan-800 dark:text-cyan-200 hover:bg-cyan-100 transition-colors flex items-center gap-1"
            >
              🧪 Pulverização (L)
            </button>

            <button
              type="button"
              onClick={() => handleAddCapacity('ADUBO', 'Capacidade de Adubo / Fertilizante', 'kg', 1500)}
              className="px-2 py-1 rounded-lg text-[11px] font-extrabold bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200 hover:bg-amber-100 transition-colors flex items-center gap-1"
            >
              🌾 Adubo (kg)
            </button>

            <button
              type="button"
              onClick={() => handleAddCapacity('SEMENTE', 'Depósito de Sementes / Graneleiro', 'L', 1000)}
              className="px-2 py-1 rounded-lg text-[11px] font-extrabold bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200 hover:bg-emerald-100 transition-colors flex items-center gap-1"
            >
              🌱 Sementes / Grãos
            </button>

            <button
              type="button"
              onClick={() => handleAddCapacity('CACAMBA', 'Caçamba / Carga', 'm³', 1.5)}
              className="px-2 py-1 rounded-lg text-[11px] font-extrabold bg-blue-50 dark:bg-blue-950/60 border border-blue-300 dark:border-blue-700 text-blue-800 dark:text-blue-200 hover:bg-blue-100 transition-colors flex items-center gap-1"
            >
              🚜 Caçamba (m³)
            </button>

            <button
              type="button"
              onClick={() => handleAddCapacity('CARGA', 'Capacidade de Carga', 'kg', 3000)}
              className="px-2 py-1 rounded-lg text-[11px] font-extrabold bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-300 dark:border-indigo-700 text-indigo-800 dark:text-indigo-200 hover:bg-indigo-100 transition-colors flex items-center gap-1"
            >
              ⚖️ Carga (kg/t)
            </button>

            <button
              type="button"
              onClick={() => handleAddCapacity('RESERVATORIO', 'Reservatório de Água Limpa', 'L', 300)}
              className="px-2 py-1 rounded-lg text-[11px] font-extrabold bg-sky-50 dark:bg-sky-950/60 border border-sky-300 dark:border-sky-700 text-sky-800 dark:text-sky-200 hover:bg-sky-100 transition-colors flex items-center gap-1"
            >
              💧 Reservatório (L)
            </button>

            <button
              type="button"
              onClick={() => handleAddCapacity('OUTRO', 'Outra Capacidade Personalizada', 'L', 100)}
              className="px-2 py-1 rounded-lg text-[11px] font-extrabold bg-purple-50 dark:bg-purple-950/60 border border-purple-300 dark:border-purple-700 text-purple-800 dark:text-purple-200 hover:bg-purple-100 transition-colors flex items-center gap-1"
            >
              ➕ Personalizada
            </button>
          </div>
        </div>

        {/* Lista de Capacidades Cadastradas */}
        {capacities.length === 0 ? (
          <div className="p-4 rounded-xl border border-dashed text-center space-y-2.5 border-slate-300 dark:border-emerald-800">
            <Package className="w-6 h-6 text-slate-400 mx-auto" />
            <p className="text-xs text-slate-500 dark:text-emerald-400 font-bold">
              Nenhuma capacidade adicional cadastrada para este equipamento.
            </p>
            <p className="text-[11px] text-slate-400 max-w-md mx-auto">
              Clique nos atalhos acima (🧪 Pulverização, 🌾 Adubo, 🌱 Sementes, etc.) ou adicione sugestões padrão:
            </p>
            <div>
              <button
                type="button"
                onClick={handleApplyDefaultSuggestions}
                className="px-3 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-800 dark:text-emerald-200 border border-emerald-500/40 text-xs font-bold transition-all flex items-center gap-1.5 mx-auto"
              >
                <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                <span>Preencher capacidades sugeridas para este tipo</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2.5">
            {capacities.map((cap, idx) => (
              <div 
                key={cap.id || idx}
                className={`p-3 rounded-xl border transition-all ${
                  cap.type === 'PULVERIZACAO' ? 'bg-cyan-50/70 dark:bg-cyan-950/40 border-cyan-200 dark:border-cyan-800' :
                  cap.type === 'ADUBO' ? 'bg-amber-50/70 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800' :
                  cap.type === 'SEMENTE' ? 'bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800' :
                  cap.type === 'CACAMBA' ? 'bg-blue-50/70 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800' :
                  'bg-white dark:bg-emerald-900/40 border-slate-200 dark:border-emerald-800'
                }`}
              >
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                  {/* Tipo / Ícone */}
                  <div className="sm:col-span-1 flex items-center justify-center">
                    <span className="text-lg" title={cap.type}>
                      {getCapacityTypeEmoji(cap.type)}
                    </span>
                  </div>

                  {/* Nome da Capacidade */}
                  <div className="sm:col-span-4">
                    <label className="block text-[10px] font-bold text-slate-500 dark:text-emerald-300">
                      Nome / Descrição
                    </label>
                    <input
                      type="text"
                      value={cap.name}
                      onChange={(e) => handleUpdateCapacity(cap.id, 'name', e.target.value)}
                      placeholder="Ex: Tanque de Pulverização..."
                      className={`w-full p-1.5 rounded-lg text-xs font-bold border ${
                        darkMode ? 'bg-emerald-950 border-emerald-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                      }`}
                    />
                  </div>

                  {/* Valor Numérico */}
                  <div className="sm:col-span-3">
                    <label className="block text-[10px] font-bold text-slate-500 dark:text-emerald-300">
                      Valor / Quantidade
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={cap.value || ''}
                      onChange={(e) => handleUpdateCapacity(cap.id, 'value', parseFloat(e.target.value) || 0)}
                      placeholder="Ex: 2000"
                      className={`w-full p-1.5 rounded-lg text-xs font-black border ${
                        darkMode ? 'bg-emerald-950 border-emerald-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                      }`}
                    />
                  </div>

                  {/* Unidade de Medida */}
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-bold text-slate-500 dark:text-emerald-300">
                      Unidade
                    </label>
                    <div className="flex items-center gap-1">
                      <select
                        value={COMMON_UNITS.includes(cap.unit) ? cap.unit : 'custom'}
                        onChange={(e) => {
                          if (e.target.value !== 'custom') {
                            handleUpdateCapacity(cap.id, 'unit', e.target.value);
                          }
                        }}
                        className={`w-full p-1.5 rounded-lg text-xs font-extrabold border ${
                          darkMode ? 'bg-emerald-950 border-emerald-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                        }`}
                      >
                        <option value="L">L (Litros)</option>
                        <option value="kg">kg (Quilos)</option>
                        <option value="t">t (Toneladas)</option>
                        <option value="m³">m³ (Metros cúbicos)</option>
                        <option value="sacas">sacas</option>
                        <option value="unidades">unidades</option>
                        <option value="custom">Outra...</option>
                      </select>
                    </div>
                  </div>

                  {/* Botão Remover */}
                  <div className="sm:col-span-2 flex items-center justify-end pt-3 sm:pt-0">
                    <button
                      type="button"
                      onClick={() => handleRemoveCapacity(cap.id)}
                      className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/50 transition-colors flex items-center gap-1 text-[11px] font-bold"
                      title="Excluir esta capacidade"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span className="sm:hidden">Remover</span>
                    </button>
                  </div>

                  {/* Observações Opcionais */}
                  <div className="sm:col-span-12">
                    <input
                      type="text"
                      value={cap.notes || ''}
                      onChange={(e) => handleUpdateCapacity(cap.id, 'notes', e.target.value)}
                      placeholder="Observação opcional (Ex: Calda pronta, Adubo a lanço, Barra 36m, etc.)"
                      className={`w-full p-1.5 rounded-lg text-[11px] border italic ${
                        darkMode ? 'bg-emerald-950/60 border-emerald-800 text-emerald-200' : 'bg-slate-50 border-slate-200 text-slate-600'
                      }`}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
