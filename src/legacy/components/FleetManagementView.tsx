import React, { useState, useMemo } from 'react';
import { 
  Truck, Plus, Search, Filter, QrCode, Wrench, Fuel, CheckCircle2, 
  AlertTriangle, Clock, Calendar, Shield, X, Edit3, Trash2, Printer, Eye, Droplet, Layers, Sparkles
} from 'lucide-react';
import { Vehicle, EquipmentCategory, FuelType, Sector, User, MaintenanceLog, FuelLog, OperationalCapacity, MachineSubtype, canEditSystemData } from '../types';
import { formatCurrency, getFuelTypeName, getSectorName, getCategoryLabel, getTodayDateSaoPaulo } from '../utils/calculations';
import { MachineCapacitiesEditor } from './MachineCapacitiesEditor';
import { getConsolidatedCapacities, getCapacityTypeEmoji, getMachineSubtypeName } from '../utils/capacities';
import { calculateOilChangeStatus } from '../utils/maintenanceCalculations';
import { QRCodeCanvas } from 'qrcode.react';
import { generateQRCodeDataUrl } from '../utils/qrcode';
import { openPrintWindow } from '../utils/printWindow';
import { recordOilChange } from '../utils/storage';

interface FleetManagementViewProps {
  vehicles: Vehicle[];
  users: User[];
  currentUser: User;
  maintenanceLogs: MaintenanceLog[];
  fuelLogs: FuelLog[];
  onAddVehicle: (v: Omit<Vehicle, 'id'>) => Promise<void> | void;
  onUpdateVehicle: (id: string, v: Partial<Vehicle>) => Promise<void> | void;
  onDeleteVehicle: (id: string) => Promise<void> | void;
  onOpenFuelingModalWithEquipment: (equipmentId: string) => void;
  onOpenDigitalSheet?: (vehicle: Vehicle) => void;
  darkMode: boolean;
}

export const FleetManagementViewComponent: React.FC<FleetManagementViewProps> = ({
  vehicles,
  users,
  currentUser,
  maintenanceLogs,
  fuelLogs,
  onAddVehicle,
  onUpdateVehicle,
  onDeleteVehicle,
  onOpenFuelingModalWithEquipment,
  onOpenDigitalSheet,
  darkMode
}) => {
  const canEdit = canEditSystemData(currentUser.role);
  const [activeTab, setActiveTab] = useState<EquipmentCategory>('VEICULO');
  const [search, setSearch] = useState('');
  const [sectorFilter, setSectorFilter] = useState<string>('ALL');

  // Modal Passport
  const [passportVehicle, setPassportVehicle] = useState<Vehicle | null>(null);

  // New & Edit Equipment Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [isSavingEquipment, setIsSavingEquipment] = useState(false);
  const [equipmentSaveError, setEquipmentSaveError] = useState<string | null>(null);

  const [model, setModel] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [year, setYear] = useState(2024);
  const [licensePlate, setLicensePlate] = useState('');
  const [patrimonyCode, setPatrimonyCode] = useState('');
  const [sector, setSector] = useState<Sector>('AGRICOLA');
  const [fuelType, setFuelType] = useState<FuelType>('DIESEL_S10');
  const [tankCapacityLiters, setTankCapacityLiters] = useState(100);
  const [sprayingTankCapacityLiters, setSprayingTankCapacityLiters] = useState<number>(0);
  const [hasSprayingTank, setHasSprayingTank] = useState<boolean>(false);
  const [machineSubtype, setMachineSubtype] = useState<MachineSubtype | undefined>(undefined);
  const [operationalCapacities, setOperationalCapacities] = useState<OperationalCapacity[]>([]);
  const [currentKm, setCurrentKm] = useState(0);
  const [currentHourmeter, setCurrentHourmeter] = useState(0);
  const [assignedOperatorId, setAssignedOperatorId] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');

  // Oil Change & Maintenance Interval Configuration State (for Add / Edit)
  const [oilChangeControlActive, setOilChangeControlActive] = useState(true);
  const [oilChangeIntervalHours, setOilChangeIntervalHours] = useState<number | string>(300);
  const [oilChangeWarningAdvanceHours, setOilChangeWarningAdvanceHours] = useState<number | string>(50);
  const [lastOilChangeHourmeter, setLastOilChangeHourmeter] = useState<number | string>(0);

  // KM-based Oil Change Configuration State (for Vehicles)
  const [oilChangeIntervalKm, setOilChangeIntervalKm] = useState<number | string>(10000);
  const [oilChangeWarningAdvanceKm, setOilChangeWarningAdvanceKm] = useState<number | string>(1000);
  const [lastOilChangeKm, setLastOilChangeKm] = useState<number | string>(0);

  // Quick Oil Change Modal State
  const [oilChangeVehicle, setOilChangeVehicle] = useState<Vehicle | null>(null);
  const [oilHourmeter, setOilHourmeter] = useState<number>(0);
  const [oilDate, setOilDate] = useState<string>(() => getTodayDateSaoPaulo());
  const [oilCost, setOilCost] = useState<number>(0);
  const [oilNotes, setOilNotes] = useState<string>('');
  const [oilType, setOilType] = useState<string>('15W40 Mineral');
  const [oilQuantityLiters, setOilQuantityLiters] = useState<number>(20);
  const [filtersReplaced, setFiltersReplaced] = useState<string>('Filtro de Óleo Lubrificante + Filtro de Combustível');
  const [oilPerformedBy, setOilPerformedBy] = useState<string>('');
  const [oilSupplier, setOilSupplier] = useState<string>('Oficina Interna AndradeAgro');
  const [isSavingOil, setIsSavingOil] = useState<boolean>(false);

  const handleOpenOilModal = (v: Vehicle) => {
    setOilChangeVehicle(v);
    const isKm = v.category === 'VEICULO' || v.maintenanceControlType === 'QUILOMETRAGEM';
    
    if (isKm) {
      setOilHourmeter(v.currentKm || 0);
      setOilNotes('Troca de óleo de motor e filtros do veículo realizada conforme ciclo preventivo.');
      setOilType('Óleo 5W30 / 15W40 Sintético');
      setOilQuantityLiters(6);
      setFiltersReplaced('Filtro de Óleo + Filtro de Ar + Filtro de Combustível');
    } else {
      setOilHourmeter(v.currentHourmeter || 0);
      setOilNotes('Troca de óleo de motor e filtros realizada conforme ciclo preventivo.');
      setOilType('15W40 Mineral');
      setOilQuantityLiters(20);
      setFiltersReplaced('Filtro de Óleo Lubrificante + Filtro de Combustível');
    }

    setOilDate(getTodayDateSaoPaulo());
    setOilCost(0);
    setOilPerformedBy(currentUser.name || 'Mecânico Responsável');
    setOilSupplier('Oficina Interna AndradeAgro');
  };

  const handleSaveOilChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oilChangeVehicle) return;
    setIsSavingOil(true);
    const isKm = oilChangeVehicle.category === 'VEICULO' || oilChangeVehicle.maintenanceControlType === 'QUILOMETRAGEM';

    try {
      await recordOilChange(
        oilChangeVehicle.id,
        oilHourmeter,
        oilDate,
        oilCost,
        oilNotes,
        {
          oilType,
          oilQuantityLiters: oilQuantityLiters > 0 ? oilQuantityLiters : undefined,
          filtersReplaced,
          performedBy: oilPerformedBy || currentUser.name,
          supplierOrWorkshop: oilSupplier,
          isKm
        }
      );
      setOilChangeVehicle(null);
    } catch (err) {
      console.error('Error saving oil change:', err);
    } finally {
      setIsSavingOil(false);
    }
  };

  const filteredVehicles = useMemo(() => {
    return vehicles.filter(v => {
      // Tab category match
      if (activeTab === 'MAQUINA_AGRICOLA') {
        if (v.category !== 'MAQUINA_AGRICOLA' && v.category !== 'IMPLEMENTO') return false;
      } else {
        if (v.category !== activeTab) return false;
      }

      // Search
      if (search) {
        const q = search.toLowerCase();
        const matchModel = v.model.toLowerCase().includes(q);
        const matchPlate = (v.licensePlate || v.patrimonyCode || '').toLowerCase().includes(q);
        const matchBrand = v.manufacturer.toLowerCase().includes(q);
        if (!matchModel && !matchPlate && !matchBrand) return false;
      }

      // Sector
      if (sectorFilter !== 'ALL' && v.sector !== sectorFilter) return false;

      return true;
    });
  }, [vehicles, activeTab, search, sectorFilter]);

  const handleCreateEquipment = async (e: React.FormEvent) => {
    e.preventDefault();
    const operator = users.find(u => u.id === assignedOperatorId);
    const cleanPatrimony = patrimonyCode.trim();
    const cleanPlate = licensePlate.trim();
    const isRoadVehicle = activeTab === 'VEICULO';
    
    // Sync spray capacity from operational capacities if defined
    const sprayCapObj = operationalCapacities.find(c => c.type === 'PULVERIZACAO');
    const sprayCapacity = sprayCapObj ? (Number(sprayCapObj.value) || 0) : (hasSprayingTank ? sprayingTankCapacityLiters : 0);

    const initialHourmeter = !isRoadVehicle ? currentHourmeter : undefined;
    const refOilMeter = Number(lastOilChangeHourmeter) > 0 ? Number(lastOilChangeHourmeter) : (initialHourmeter || 0);
    const intervalHours = Math.max(1, Number(oilChangeIntervalHours) || 300);
    const nextOilMeterHours = refOilMeter + intervalHours;

    const intervalKm = Math.max(1, Number(oilChangeIntervalKm) || 10000);
    const advanceKm = Math.max(0, Number(oilChangeWarningAdvanceKm) || 1000);
    const refOilKm = Number(lastOilChangeKm) > 0 ? Number(lastOilChangeKm) : (currentKm || 0);
    const nextOilKm = refOilKm + intervalKm;

    try {
      await onAddVehicle({
        category: activeTab,
        model: model.trim(),
        manufacturer: manufacturer.trim(),
        year,
        color: 'Verde/Branco',
        licensePlate: isRoadVehicle ? cleanPlate : (cleanPatrimony ? `AGRO-${cleanPatrimony}` : 'AGRO-000'),
        patrimonyCode: !isRoadVehicle ? cleanPatrimony : (cleanPatrimony || undefined),
        sector,
        fuelType,
        tankCapacityLiters: fuelType === 'NENHUM' ? 0 : tankCapacityLiters,
        sprayingTankCapacityLiters: sprayCapacity > 0 ? sprayCapacity : 0,
        hasSprayingTank: sprayCapacity > 0,
        operationalCapacities: operationalCapacities || [],
        machineSubtype: !isRoadVehicle ? (machineSubtype || (activeTab === 'MAQUINA_AGRICOLA' ? 'OUTRO' : undefined)) : undefined,
        currentKm: isRoadVehicle ? currentKm : 0,
        currentHourmeter: initialHourmeter,
        // Oil change program (KM for vehicles, Hours for machines)
        oilChangeControlActive: oilChangeControlActive,
        oilChangeIntervalHours: !isRoadVehicle ? intervalHours : undefined,
        oilChangeWarningAdvanceHours: !isRoadVehicle ? (Number(oilChangeWarningAdvanceHours) || 0) : undefined,
        lastOilChangeHourmeter: !isRoadVehicle ? refOilMeter : undefined,
        nextOilChangeHourmeter: !isRoadVehicle ? nextOilMeterHours : undefined,
        maintenanceIntervalHours: !isRoadVehicle ? intervalHours : undefined,
        maintenanceWarningAdvanceHours: !isRoadVehicle ? (Number(oilChangeWarningAdvanceHours) || 0) : undefined,
        lastMaintenanceHourmeter: !isRoadVehicle ? refOilMeter : undefined,
        nextMaintenanceHourmeter: !isRoadVehicle ? nextOilMeterHours : undefined,
        // KM fields for vehicles
        oilChangeIntervalKm: isRoadVehicle ? intervalKm : undefined,
        oilChangeWarningAdvanceKm: isRoadVehicle ? advanceKm : undefined,
        lastOilChangeKm: isRoadVehicle ? refOilKm : undefined,
        nextOilChangeKm: isRoadVehicle ? nextOilKm : undefined,
        maintenanceIntervalKm: isRoadVehicle ? intervalKm : undefined,
        maintenanceWarningAdvanceKm: isRoadVehicle ? advanceKm : undefined,
        lastMaintenanceKm: isRoadVehicle ? refOilKm : undefined,
        nextMaintenanceKm: isRoadVehicle ? nextOilKm : undefined,
        maintenanceControlType: isRoadVehicle ? 'QUILOMETRAGEM' : 'HORIMETRO',
        status: 'ATIVO',
        assignedOperatorId: operator?.id,
        assignedOperatorName: operator?.name,
        photoUrl: photoUrl || 'https://images.unsplash.com/photo-1592861956120-e524fc739696?w=600&auto=format&fit=crop&q=80'
      });

      setShowAddModal(false);
      // Reset
      setModel('');
      setManufacturer('');
      setYear(2024);
      setLicensePlate('');
      setPatrimonyCode('');
      setSector('AGRICOLA');
      setFuelType('DIESEL_S10');
      setTankCapacityLiters(100);
      setSprayingTankCapacityLiters(0);
      setHasSprayingTank(false);
      setMachineSubtype(undefined);
      setOperationalCapacities([]);
      setCurrentKm(0);
      setCurrentHourmeter(0);
      setAssignedOperatorId('');
      setPhotoUrl('');
      setOilChangeControlActive(true);
      setOilChangeIntervalHours(300);
      setOilChangeWarningAdvanceHours(50);
      setLastOilChangeHourmeter(0);
      setOilChangeIntervalKm(10000);
      setOilChangeWarningAdvanceKm(1000);
      setLastOilChangeKm(0);
    } catch (err: any) {
      console.error('Erro ao adicionar equipamento:', err);
      alert('Erro ao cadastrar equipamento: ' + (err?.message || 'Falha ao salvar no banco de dados.'));
    }
  };

  const handleOpenEditModal = (v: Vehicle) => {
    setEditingVehicle(v);
    setEquipmentSaveError(null);
    setModel(v.model || '');
    setManufacturer(v.manufacturer || '');
    setYear(v.year || 2024);
    setLicensePlate(v.licensePlate || '');
    setPatrimonyCode(v.patrimonyCode || '');
    setSector(v.sector || 'AGRICOLA');
    setFuelType(v.fuelType || 'DIESEL_S10');
    setTankCapacityLiters(v.tankCapacityLiters || 0);
    setSprayingTankCapacityLiters(v.sprayingTankCapacityLiters || 0);
    setHasSprayingTank(!!v.hasSprayingTank || !!(v.sprayingTankCapacityLiters && v.sprayingTankCapacityLiters > 0) || v.sector === 'PULVERIZACAO');
    setMachineSubtype(v.machineSubtype);
    setOperationalCapacities(getConsolidatedCapacities(v));
    setCurrentKm(v.currentKm || 0);
    setCurrentHourmeter(v.currentHourmeter || 0);
    setAssignedOperatorId(v.assignedOperatorId || '');
    setPhotoUrl(v.photoUrl || '');
    // Load oil change config for hours
    setOilChangeControlActive(v.oilChangeControlActive !== false);
    setOilChangeIntervalHours(v.oilChangeIntervalHours || v.maintenanceIntervalHours || 300);
    setOilChangeWarningAdvanceHours(v.oilChangeWarningAdvanceHours !== undefined ? v.oilChangeWarningAdvanceHours : (v.maintenanceWarningAdvanceHours || 50));
    setLastOilChangeHourmeter(v.lastOilChangeHourmeter !== undefined ? v.lastOilChangeHourmeter : (v.currentHourmeter || 0));
    // Load oil change config for KM
    setOilChangeIntervalKm(v.oilChangeIntervalKm || v.maintenanceIntervalKm || 10000);
    setOilChangeWarningAdvanceKm(v.oilChangeWarningAdvanceKm !== undefined ? v.oilChangeWarningAdvanceKm : (v.maintenanceWarningAdvanceKm || 1000));
    setLastOilChangeKm(v.lastOilChangeKm !== undefined ? v.lastOilChangeKm : (v.currentKm || 0));
  };

  const handleUpdateEquipment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVehicle) return;

    setIsSavingEquipment(true);
    setEquipmentSaveError(null);

    try {
      const operator = users.find(u => u.id === assignedOperatorId);
      const cleanPatrimony = patrimonyCode.trim();
      const cleanPlate = licensePlate.trim();
      const isRoadVehicle = editingVehicle.category === 'VEICULO';

      // Sync spray capacity from operational capacities if defined
      const sprayCapObj = operationalCapacities.find(c => c.type === 'PULVERIZACAO');
      const sprayCapacity = sprayCapObj ? (Number(sprayCapObj.value) || 0) : (hasSprayingTank ? sprayingTankCapacityLiters : 0);

      const intervalHours = Math.max(1, Number(oilChangeIntervalHours) || 300);
      const refMeterHours = Number(lastOilChangeHourmeter);
      const nextOilMeterHours = refMeterHours + intervalHours;

      const intervalKm = Math.max(1, Number(oilChangeIntervalKm) || 10000);
      const advanceKm = Math.max(0, Number(oilChangeWarningAdvanceKm) || 1000);
      const refMeterKm = Number(lastOilChangeKm);
      const nextOilMeterKm = refMeterKm + intervalKm;

      await onUpdateVehicle(editingVehicle.id, {
        model: model.trim(),
        manufacturer: manufacturer.trim(),
        year,
        licensePlate: isRoadVehicle ? cleanPlate : (cleanPatrimony ? `AGRO-${cleanPatrimony}` : editingVehicle.licensePlate),
        patrimonyCode: !isRoadVehicle ? cleanPatrimony : (cleanPatrimony || undefined),
        sector,
        fuelType,
        tankCapacityLiters: fuelType === 'NENHUM' ? 0 : tankCapacityLiters,
        sprayingTankCapacityLiters: sprayCapacity > 0 ? sprayCapacity : 0,
        hasSprayingTank: sprayCapacity > 0,
        operationalCapacities: operationalCapacities || [],
        machineSubtype: !isRoadVehicle ? machineSubtype : undefined,
        currentKm: isRoadVehicle ? currentKm : (editingVehicle.currentKm || 0),
        currentHourmeter: !isRoadVehicle ? currentHourmeter : editingVehicle.currentHourmeter,
        // Oil change updates
        oilChangeControlActive: oilChangeControlActive,
        oilChangeIntervalHours: !isRoadVehicle ? intervalHours : undefined,
        oilChangeWarningAdvanceHours: !isRoadVehicle ? (Number(oilChangeWarningAdvanceHours) || 0) : undefined,
        lastOilChangeHourmeter: !isRoadVehicle ? refMeterHours : undefined,
        nextOilChangeHourmeter: !isRoadVehicle ? nextOilMeterHours : undefined,
        maintenanceIntervalHours: !isRoadVehicle ? intervalHours : undefined,
        maintenanceWarningAdvanceHours: !isRoadVehicle ? (Number(oilChangeWarningAdvanceHours) || 0) : undefined,
        lastMaintenanceHourmeter: !isRoadVehicle ? refMeterHours : undefined,
        nextMaintenanceHourmeter: !isRoadVehicle ? nextOilMeterHours : undefined,
        // KM fields for vehicles
        oilChangeIntervalKm: isRoadVehicle ? intervalKm : undefined,
        oilChangeWarningAdvanceKm: isRoadVehicle ? advanceKm : undefined,
        lastOilChangeKm: isRoadVehicle ? refMeterKm : undefined,
        nextOilChangeKm: isRoadVehicle ? nextOilMeterKm : undefined,
        maintenanceIntervalKm: isRoadVehicle ? intervalKm : undefined,
        maintenanceWarningAdvanceKm: isRoadVehicle ? advanceKm : undefined,
        lastMaintenanceKm: isRoadVehicle ? refMeterKm : undefined,
        nextMaintenanceKm: isRoadVehicle ? nextOilMeterKm : undefined,
        maintenanceControlType: isRoadVehicle ? 'QUILOMETRAGEM' : 'HORIMETRO',
        assignedOperatorId: assignedOperatorId || '',
        assignedOperatorName: operator?.name || '',
        photoUrl: photoUrl || '',
      });

      setEditingVehicle(null);
    } catch (err: any) {
      console.error('Erro ao atualizar equipamento:', err);
      setEquipmentSaveError(err?.message || 'Falha ao salvar as alterações do equipamento no banco de dados.');
    } finally {
      setIsSavingEquipment(false);
    }
  };

  const handlePrintBadge = async (v: Vehicle) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://andradeagro.app';
    const qrValue = `${origin}/#ficha-maquina/${v.id}`;
    const qrDataUrl = await generateQRCodeDataUrl(qrValue, 350);
    const categoryLabel = getCategoryLabel(v.category);
    const sectorName = getSectorName(v.sector);
    const tankInfo = v.fuelType === 'NENHUM' ? 'Não aplica' : `${v.tankCapacityLiters}L`;

    const makeCardHtml = (extraClass = '') => `
      <div class="card ${extraClass}">
        <div class="card-header">
          <div class="brand-title">ANDRADEAGRO</div>
          <div class="card-subtitle">IDENTIFICAÇÃO DO EQUIPAMENTO</div>
          <div class="model" title="${v.model}">${v.model}</div>
          <div class="code-badge">${v.licensePlate || v.patrimonyCode}</div>
        </div>
        <div class="qr-container">
          <img src="${qrDataUrl}" alt="QR" />
        </div>
        <div class="card-footer">
          <span>Setor: ${sectorName} • Cap.: ${tankInfo}</span>
        </div>
      </div>
    `;

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="pt-BR">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Etiqueta QR Code - ${v.model} (${v.licensePlate || v.patrimonyCode})</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 6mm;
            }
            * { box-sizing: border-box; margin: 0; padding: 0; }
            html, body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
              background: #0f172a;
              color: #0f172a;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              width: 100%;
              height: auto;
            }
            .no-print {
              background: #022c22;
              color: #ffffff;
              padding: 12px 20px;
              border-bottom: 2px solid #044E36;
              display: flex;
              flex-wrap: wrap;
              align-items: center;
              justify-content: space-between;
              gap: 12px;
              box-shadow: 0 4px 14px rgba(0,0,0,0.3);
              position: sticky;
              top: 0;
              z-index: 1000;
            }
            .no-print h2 {
              font-size: 13px;
              font-weight: 900;
              color: #FACC15;
              letter-spacing: 0.5px;
            }
            .mode-tabs {
              display: flex;
              flex-wrap: wrap;
              gap: 4px;
              background: #011913;
              padding: 4px;
              border-radius: 8px;
              border: 1px solid #044E36;
            }
            .mode-btn {
              padding: 6px 11px;
              font-size: 11px;
              font-weight: 700;
              border-radius: 6px;
              border: none;
              cursor: pointer;
              background: transparent;
              color: #94a3b8;
              transition: all 0.15s;
              white-space: nowrap;
            }
            .mode-btn.active {
              background: #044E36;
              color: #ffffff;
              box-shadow: 0 1px 3px rgba(0,0,0,0.25);
            }
            .action-btns {
              display: flex;
              gap: 8px;
            }
            .btn {
              padding: 8px 16px;
              font-size: 13px;
              font-weight: 800;
              border-radius: 8px;
              cursor: pointer;
              border: none;
            }
            .btn-print { background: #FACC15; color: #022c22; }
            .btn-print:hover { background: #eab308; }
            .btn-close { background: #334155; color: #ffffff; }

            .page-container {
              padding: 12mm 0 20mm 0;
              display: flex;
              flex-direction: column;
              align-items: center;
              gap: 10mm;
            }

            /* Single Card Mode */
            .single-wrapper {
              display: flex;
              flex-direction: column;
              align-items: center;
              gap: 10px;
              padding: 16px;
              background: #ffffff;
              border: 2px dashed #94a3b8;
              border-radius: 12px;
              box-shadow: 0 6px 20px rgba(0,0,0,0.3);
            }
            .cut-guide {
              font-size: 11px;
              color: #475569;
              font-weight: 700;
            }

            /* Multi-card Sheet Pages */
            .sheet-page {
              box-sizing: border-box;
              width: 198mm;
              height: 284mm;
              max-height: 284mm;
              background: #ffffff;
              box-shadow: 0 6px 20px rgba(0,0,0,0.3);
              border-radius: 4px;
              page-break-after: always !important;
              break-after: page !important;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
              overflow: hidden;
              display: flex;
              flex-wrap: wrap;
              align-content: flex-start;
            }
            .sheet-page:last-child {
              page-break-after: auto !important;
              break-after: auto !important;
            }

            /* Card styling with vivid colors & high contrast */
            .card {
              box-sizing: border-box;
              border: 1.5px solid #044E36;
              border-radius: 8px;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              align-items: center;
              background: #ffffff;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
              break-inside: avoid-page !important;
              -webkit-column-break-inside: avoid !important;
              overflow: hidden;
              position: relative;
              box-shadow: 0 1px 3px rgba(0,0,0,0.06);
              transform: translateZ(0);
            }
            .card-header {
              width: 100%;
              text-align: center;
              padding: 1.5mm 1mm 0 1mm;
              display: flex;
              flex-direction: column;
              align-items: center;
            }
            .brand-title {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
              font-weight: 900;
              color: #044E36;
              letter-spacing: 1.2px;
              text-transform: uppercase;
              line-height: 1.1;
            }
            .card-subtitle {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
              font-weight: 800;
              color: #D97706;
              letter-spacing: 0.8px;
              text-transform: uppercase;
              line-height: 1.1;
              margin-top: 1px;
            }
            .model {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
              font-weight: 850;
              color: #0f172a;
              line-height: 1.15;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              width: 100%;
              margin-top: 1.5px;
            }
            .code-badge {
              background: #044E36;
              color: #FFFFFF;
              font-weight: 900;
              border-radius: 5px;
              border: 1px solid #065F46;
              display: inline-block;
              margin-top: 1.5px;
              letter-spacing: 0.8px;
              box-shadow: 0 1px 2px rgba(4,78,54,0.18);
              white-space: nowrap;
            }
            .qr-container {
              display: flex;
              align-items: center;
              justify-content: center;
              margin: 1mm 0;
              background: #ffffff;
              padding: 2px;
              border-radius: 4px;
            }
            .qr-container img {
              display: block;
              image-rendering: pixelated;
              image-rendering: crisp-edges;
            }
            .card-footer {
              width: 100%;
              border-top: 1px solid #E2E8F0;
              background: #F8FAFC;
              padding: 1.2mm 1.5mm;
              display: flex;
              justify-content: center;
              align-items: center;
              font-weight: 750;
              color: #064E3B;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              text-align: center;
            }

            /* Formats */
            /* 16 por folha (4x4) */
            .sheet-page.d-16 { gap: 2mm; padding: 2.5mm; }
            .sheet-page.d-16 .card {
              width: calc((100% - 3 * 2mm) / 4);
              height: 63.5mm;
              max-height: 63.5mm;
              padding: 1.5mm 1mm;
            }
            .sheet-page.d-16 .brand-title { font-size: 7.5pt; }
            .sheet-page.d-16 .card-subtitle { font-size: 5.2pt; }
            .sheet-page.d-16 .model { font-size: 7pt; }
            .sheet-page.d-16 .code-badge { font-size: 7.5pt; padding: 1px 6px; }
            .sheet-page.d-16 .qr-container img { width: 28mm; height: 28mm; }
            .sheet-page.d-16 .card-footer { font-size: 5.5pt; padding: 0.8mm 1mm; }

            /* 12 por folha (3x4) */
            .sheet-page.d-12 { gap: 2.5mm; padding: 2.5mm; }
            .sheet-page.d-12 .card {
              width: calc((100% - 2 * 2.5mm) / 3);
              height: 63.5mm;
              max-height: 63.5mm;
              padding: 1.8mm 1.5mm;
            }
            .sheet-page.d-12 .brand-title { font-size: 8.5pt; }
            .sheet-page.d-12 .card-subtitle { font-size: 6pt; }
            .sheet-page.d-12 .model { font-size: 8pt; }
            .sheet-page.d-12 .code-badge { font-size: 8.5pt; padding: 1.5px 8px; }
            .sheet-page.d-12 .qr-container img { width: 32mm; height: 32mm; }
            .sheet-page.d-12 .card-footer { font-size: 6.5pt; padding: 1mm 1.5mm; }

            /* 8 por folha (2x4) */
            .sheet-page.d-8 { gap: 3.5mm; padding: 2.5mm; }
            .sheet-page.d-8 .card {
              width: calc((100% - 1 * 3.5mm) / 2);
              height: 63.5mm;
              max-height: 63.5mm;
              padding: 2mm 3mm;
            }
            .sheet-page.d-8 .brand-title { font-size: 9pt; }
            .sheet-page.d-8 .card-subtitle { font-size: 6.5pt; }
            .sheet-page.d-8 .model { font-size: 8.5pt; }
            .sheet-page.d-8 .code-badge { font-size: 9pt; padding: 1.5px 8px; }
            .sheet-page.d-8 .qr-container img { width: 34mm; height: 34mm; }
            .sheet-page.d-8 .card-footer { font-size: 7pt; padding: 1mm 2mm; }

            /* 4 por folha (2x2) */
            .sheet-page.d-4 { gap: 5mm; padding: 3mm; }
            .sheet-page.d-4 .card {
              width: calc((100% - 1 * 5mm) / 2);
              height: 128mm;
              max-height: 128mm;
              padding: 4mm 5mm;
            }
            .sheet-page.d-4 .brand-title { font-size: 14pt; letter-spacing: 2px; }
            .sheet-page.d-4 .card-subtitle { font-size: 9.5pt; }
            .sheet-page.d-4 .model { font-size: 12pt; }
            .sheet-page.d-4 .code-badge { font-size: 12pt; padding: 3px 12px; }
            .sheet-page.d-4 .qr-container img { width: 68mm; height: 68mm; }
            .sheet-page.d-4 .card-footer { font-size: 9pt; padding: 2mm 3mm; }

            /* Standalone single card style */
            .single-wrapper .card {
              width: 72mm;
              height: 72mm;
              padding: 2.5mm;
            }
            .single-wrapper .brand-title { font-size: 8.5pt; }
            .single-wrapper .card-subtitle { font-size: 6pt; }
            .single-wrapper .model { font-size: 8pt; }
            .single-wrapper .code-badge { font-size: 8.5pt; padding: 1.5px 8px; }
            .single-wrapper .qr-container img { width: 36mm; height: 36mm; }
            .single-wrapper .card-footer { font-size: 6.5pt; padding: 1mm 1.5mm; }

            /* Absolute anti-break protection for Mobile & Desktop printing */
            @media print {
              @page {
                size: A4 portrait;
                margin: 6mm 5mm;
              }
              *, *::before, *::after {
                box-sizing: border-box !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              .no-print { display: none !important; }
              html, body {
                background: #ffffff !important;
                color: #0f172a !important;
                padding: 0 !important;
                margin: 0 !important;
                width: 100% !important;
                height: auto !important;
                overflow: visible !important;
              }
              .page-container {
                padding: 0 !important;
                margin: 0 !important;
                display: block !important;
                width: 100% !important;
                gap: 0 !important;
              }
              .single-wrapper {
                border: none !important;
                box-shadow: none !important;
                padding: 0 !important;
                background: transparent !important;
                margin: 0 auto !important;
              }
              .cut-guide { display: none !important; }
              .sheet-page {
                margin: 0 auto !important;
                box-shadow: none !important;
                border: none !important;
                border-radius: 0 !important;
                width: 100% !important;
                max-width: 198mm !important;
                height: auto !important;
                min-height: 255mm !important;
                max-height: 272mm !important;
                page-break-before: auto !important;
                page-break-after: always !important;
                break-after: page !important;
                page-break-inside: avoid !important;
                break-inside: avoid !important;
                overflow: visible !important;
                display: flex !important;
                flex-wrap: wrap !important;
                align-content: flex-start !important;
                background: #ffffff !important;
              }
              .sheet-page:last-child {
                page-break-after: auto !important;
                break-after: auto !important;
              }
              .card {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
                break-inside: avoid-page !important;
                -webkit-column-break-inside: avoid !important;
                transform: translateZ(0);
              }
            }
          </style>
        </head>
        <body>
          <div class="no-print">
            <div>
              <h2>${v.model} (${v.licensePlate || v.patrimonyCode})</h2>
            </div>
            <div class="mode-tabs">
              <button class="mode-btn active" id="btn-m-single" onclick="setMode('single')">1 Etiqueta Avulsa</button>
              <button class="mode-btn" id="btn-m-16" onclick="setMode(16)">📋 Folha 16 (Máx. Rendimento)</button>
              <button class="mode-btn" id="btn-m-12" onclick="setMode(12)">📋 Folha 12 (Padrão)</button>
              <button class="mode-btn" id="btn-m-8" onclick="setMode(8)">📋 Folha 8 (Amplo)</button>
              <button class="mode-btn" id="btn-m-4" onclick="setMode(4)">📋 Folha 4 (Grande)</button>
            </div>
            <div class="action-btns">
              <button class="btn btn-print" onclick="window.print()">🖨️ Imprimir</button>
              <button class="btn btn-close" onclick="window.close()">✕ Fechar</button>
            </div>
          </div>

          <div class="page-container" id="content-container">
            <div class="single-wrapper" id="single-view">
              <span class="cut-guide">✂️ Linha de Corte da Etiqueta</span>
              ${makeCardHtml()}
            </div>
            <div class="sheet-page d-16" id="view-16" style="display: none;">
              ${Array(16).fill(makeCardHtml()).join('')}
            </div>
            <div class="sheet-page d-12" id="view-12" style="display: none;">
              ${Array(12).fill(makeCardHtml()).join('')}
            </div>
            <div class="sheet-page d-8" id="view-8" style="display: none;">
              ${Array(8).fill(makeCardHtml()).join('')}
            </div>
            <div class="sheet-page d-4" id="view-4" style="display: none;">
              ${Array(4).fill(makeCardHtml()).join('')}
            </div>
          </div>

          <script>
            function setMode(mode) {
              const views = {
                'single': document.getElementById('single-view'),
                '16': document.getElementById('view-16'),
                '12': document.getElementById('view-12'),
                '8': document.getElementById('view-8'),
                '4': document.getElementById('view-4'),
              };
              const buttons = {
                'single': document.getElementById('btn-m-single'),
                '16': document.getElementById('btn-m-16'),
                '12': document.getElementById('btn-m-12'),
                '8': document.getElementById('btn-m-8'),
                '4': document.getElementById('btn-m-4'),
              };

              Object.keys(views).forEach(key => {
                if (views[key]) views[key].style.display = 'none';
                if (buttons[key]) buttons[key].classList.remove('active');
              });

              const key = String(mode);
              if (views[key]) views[key].style.display = 'flex';
              if (buttons[key]) buttons[key].classList.add('active');
            }
          </script>
        </body>
      </html>
    `;

    openPrintWindow(htmlContent);
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-emerald-100 flex items-center gap-2">
            <Truck className="w-6 h-6 text-amber-500" />
            Gestão de Frota, Tratores & Máquinas
          </h1>
          <p className="text-xs text-gray-500 dark:text-emerald-400">
            Cadastros completos, horímetros, odômetros, status de manutenção e QR Codes.
          </p>
        </div>

        {canEdit && (
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-emerald-800 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-md flex items-center gap-2 self-start sm:self-auto"
          >
            <Plus className="w-4 h-4 text-amber-400" />
            <span>Cadastrar Equipamento</span>
          </button>
        )}
      </div>

      {/* Category Tabs & Search */}
      <div className={`p-4 rounded-2xl border space-y-4 ${
        darkMode ? 'bg-emerald-950/40 border-emerald-900' : 'bg-white border-emerald-100'
      }`}>
        <div className="flex items-center gap-2 border-b border-emerald-800/20 pb-3 overflow-x-auto">
          <button
            onClick={() => setActiveTab('VEICULO')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'VEICULO'
                ? 'bg-amber-500 text-gray-950 shadow-md'
                : 'text-gray-600 dark:text-emerald-300 hover:bg-emerald-500/10'
            }`}
          >
            Veículos com Placa ({vehicles.filter(v => v.category === 'VEICULO').length})
          </button>
          <button
            onClick={() => setActiveTab('TRATOR')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'TRATOR'
                ? 'bg-amber-500 text-gray-950 shadow-md'
                : 'text-gray-600 dark:text-emerald-300 hover:bg-emerald-500/10'
            }`}
          >
            Tratores ({vehicles.filter(v => v.category === 'TRATOR').length})
          </button>
          <button
            onClick={() => setActiveTab('MAQUINA_AGRICOLA')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'MAQUINA_AGRICOLA'
                ? 'bg-amber-500 text-gray-950 shadow-md'
                : 'text-gray-600 dark:text-emerald-300 hover:bg-emerald-500/10'
            }`}
          >
            Máquinas Agrícolas ({vehicles.filter(v => v.category === 'MAQUINA_AGRICOLA' || v.category === 'IMPLEMENTO').length})
          </button>
        </div>

        {/* Filter Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por modelo, fabricante ou código..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`w-full pl-9 pr-3 py-2 rounded-xl border outline-none ${
                darkMode ? 'bg-emerald-900/40 border-emerald-800 text-white' : 'bg-gray-50 border-gray-200'
              }`}
            />
          </div>

          <select
            value={sectorFilter}
            onChange={(e) => setSectorFilter(e.target.value)}
            className={`px-3 py-2 rounded-xl border outline-none ${
              darkMode ? 'bg-emerald-900/40 border-emerald-800 text-white' : 'bg-gray-50 border-gray-200'
            }`}
          >
            <option value="ALL">Todos os Setores</option>
            <option value="PREPARO_SOLO">Preparo de Solo</option>
            <option value="COLHEITA">Colheita</option>
            <option value="PULVERIZACAO">Pulverização</option>
            <option value="AGRICOLA">Agrícola</option>
            <option value="LOGISTICA">Logística / Transporte</option>
            <option value="DIRETORIA">Diretoria</option>
            <option value="OFICINA_MANUTENCAO">Oficina</option>
          </select>
        </div>
      </div>

      {/* Equipment Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredVehicles.map(v => (
          <div
            key={v.id}
            className={`rounded-2xl border overflow-hidden flex flex-col transition-all hover:shadow-lg ${
              darkMode ? 'bg-emerald-950/50 border-emerald-900' : 'bg-white border-emerald-100 shadow-sm'
            }`}
          >
            {/* Image Banner */}
            <div className="h-40 relative bg-emerald-900/20 overflow-hidden">
              <img
                src={v.photoUrl || 'https://images.unsplash.com/photo-1592861956120-e524fc739696?w=600&auto=format&fit=crop&q=80'}
                alt={v.model}
                referrerPolicy="no-referrer"
                loading="lazy"
                decoding="async"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1592861956120-e524fc739696?w=600&auto=format&fit=crop&q=80';
                }}
                className="w-full h-full object-cover"
              />
              <div className="absolute top-2 right-2 flex gap-1">
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase shadow-md ${
                  v.status === 'ATIVO' 
                    ? 'bg-emerald-500 text-gray-950' 
                    : v.status === 'EM_MANUTENCAO' 
                    ? 'bg-amber-500 text-gray-950' 
                    : 'bg-red-500 text-white'
                }`}>
                  {v.status === 'EM_MANUTENCAO' ? 'Manutenção' : v.status}
                </span>
              </div>
              <div className="absolute bottom-2 left-2 bg-black/70 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/20 text-white font-extrabold text-xs">
                {v.licensePlate || v.patrimonyCode}
              </div>
            </div>

            {/* Content Body */}
            <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center justify-between">
                  <p className="text-[10px] uppercase font-bold text-amber-600 dark:text-amber-400">
                    {v.manufacturer} • {v.year}
                  </p>
                  {v.machineSubtype && (
                    <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/80 px-2 py-0.5 rounded-md border border-emerald-300/60 dark:border-emerald-700/60">
                      {getMachineSubtypeName(v.machineSubtype)}
                    </span>
                  )}
                </div>
                <h3 className="font-extrabold text-sm text-gray-900 dark:text-emerald-100 line-clamp-1 mt-0.5">
                  {v.model}
                </h3>
                <p className="text-[11px] text-gray-500 dark:text-emerald-300 font-medium mt-0.5">
                  Setor: <strong className="text-gray-800 dark:text-emerald-200">{getSectorName(v.sector)}</strong>
                </p>
              </div>

              {/* Specs Badge */}
              <div className="p-2.5 rounded-xl bg-emerald-500/5 border border-emerald-500/15 text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-emerald-400">Uso Atual:</span>
                  <strong className="text-emerald-800 dark:text-emerald-300">
                    {v.category === 'VEICULO' ? `${v.currentKm.toLocaleString('pt-BR')} km` : `${v.currentHourmeter || 0} horas`}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-emerald-400">Combustível:</span>
                  <strong className="text-gray-800 dark:text-emerald-200">
                    {v.fuelType === 'NENHUM' ? 'Não se aplica' : `${v.tankCapacityLiters}L (${getFuelTypeName(v.fuelType)})`}
                  </strong>
                </div>

                {/* Capacidades Operacionais da Máquina */}
                {(() => {
                  const caps = getConsolidatedCapacities(v).filter(c => c.type !== 'COMBUSTIVEL');
                  if (caps.length === 0) return null;
                  return (
                    <div className="space-y-1 pt-1 border-t border-emerald-500/10">
                      {caps.map((cap, idx) => (
                        <div 
                          key={cap.id || idx}
                          className={`flex justify-between items-center px-2 py-0.5 rounded-lg border text-[11px] ${
                            cap.type === 'PULVERIZACAO' ? 'bg-cyan-500/10 dark:bg-cyan-950/40 border-cyan-500/20 text-cyan-900 dark:text-cyan-100' :
                            cap.type === 'ADUBO' ? 'bg-amber-500/10 dark:bg-amber-950/40 border-amber-500/20 text-amber-900 dark:text-amber-100' :
                            cap.type === 'SEMENTE' ? 'bg-emerald-500/10 dark:bg-emerald-950/40 border-emerald-500/20 text-emerald-900 dark:text-emerald-100' :
                            'bg-slate-100 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200'
                          }`}
                        >
                          <span className="font-bold flex items-center gap-1">
                            <span>{getCapacityTypeEmoji(cap.type)}</span>
                            <span className="truncate max-w-[130px]">{cap.name}:</span>
                          </span>
                          <strong className="font-extrabold whitespace-nowrap">
                            {cap.value.toLocaleString('pt-BR')} {cap.unit}
                          </strong>
                        </div>
                      ))}
                    </div>
                  );
                })()}

                {v.assignedOperatorName && (
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-emerald-400">Operador:</span>
                    <strong className="text-amber-600 dark:text-amber-400 truncate max-w-[110px]">{v.assignedOperatorName}</strong>
                  </div>
                )}

                {/* Oil Change Tracker for Vehicles (KM) and Machines (Hours) */}
                {(() => {
                  const oilStatus = calculateOilChangeStatus(v);
                  
                  if (!oilStatus.isOilActive) {
                    return (
                      <div className="pt-1.5 border-t border-emerald-800/20 flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-gray-600 dark:text-emerald-300 flex items-center gap-1">
                          <Droplet className="w-3.5 h-3.5 text-amber-500" /> Troca de Óleo:
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-500/20 text-slate-400">Desativado</span>
                      </div>
                    );
                  }

                  return (
                    <div className="pt-1.5 border-t border-emerald-800/20">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-gray-600 dark:text-emerald-300 flex items-center gap-1">
                          <Droplet className="w-3.5 h-3.5 text-amber-500" /> Troca de Óleo:
                        </span>
                        {oilStatus.status === 'ATRASADA' ? (
                          <span 
                            className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-red-500 text-white animate-pulse" 
                            title={`Vencida há ${oilStatus.hoursOrKmOverdue.toLocaleString('pt-BR')}${oilStatus.unit} (Limite: ${oilStatus.nextMeter.toLocaleString('pt-BR')}${oilStatus.unit})`}
                          >
                            VENCIDA ({oilStatus.hoursOrKmOverdue.toLocaleString('pt-BR')}{oilStatus.unit})
                          </span>
                        ) : oilStatus.status === 'PROXIMA' ? (
                          <span 
                            className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500 text-gray-950" 
                            title={`Trocar em ${oilStatus.remaining.toLocaleString('pt-BR')}${oilStatus.unit} (Programada: ${oilStatus.nextMeter.toLocaleString('pt-BR')}${oilStatus.unit})`}
                          >
                            Trocar em {oilStatus.remaining.toLocaleString('pt-BR')}{oilStatus.unit}
                          </span>
                        ) : (
                          <span 
                            className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-700 dark:text-emerald-300" 
                            title={`Próxima em ${oilStatus.nextMeter.toLocaleString('pt-BR')}${oilStatus.unit}`}
                          >
                            Em {oilStatus.remaining.toLocaleString('pt-BR')}{oilStatus.unit} ({oilStatus.nextMeter.toLocaleString('pt-BR')}{oilStatus.unit})
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Card Actions */}
              <div className="pt-2 border-t border-emerald-800/20 flex items-center justify-between gap-1 flex-wrap">
                <button
                  onClick={() => {
                    if (onOpenDigitalSheet) {
                      onOpenDigitalSheet(v);
                    } else {
                      setPassportVehicle(v);
                    }
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-800 dark:text-emerald-200 text-xs font-bold flex items-center gap-1 min-h-[36px]"
                >
                  <Eye className="w-3.5 h-3.5" /> Ficha Digital
                </button>

                {/* Quick Oil Change Button for All Vehicles & Machines */}
                {canEdit && (
                  <button
                    onClick={() => handleOpenOilModal(v)}
                    className="px-2.5 py-1.5 rounded-lg bg-emerald-800 hover:bg-emerald-700 text-[#FACC15] text-xs font-bold flex items-center gap-1 min-h-[36px]"
                    title={`Registrar Troca de Óleo / Revisão (${v.category === 'VEICULO' ? 'Quilometragem' : 'Horímetro'})`}
                  >
                    <Wrench className="w-3.5 h-3.5" /> Trocar Óleo
                  </button>
                )}

                {v.fuelType !== 'NENHUM' && (
                  <button
                    onClick={() => onOpenFuelingModalWithEquipment(v.id)}
                    className="px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-gray-950 text-xs font-bold flex items-center gap-1 shadow-sm min-h-[36px]"
                  >
                    <Fuel className="w-3.5 h-3.5" /> Abastecer
                  </button>
                )}

                <button
                  onClick={() => handlePrintBadge(v)}
                  className="p-1.5 rounded-lg bg-gray-100 dark:bg-emerald-900/40 text-gray-600 dark:text-emerald-300 min-h-[36px] min-w-[36px] flex items-center justify-center"
                  title="Imprimir Emblema com QR Code"
                >
                  <QrCode className="w-4 h-4 text-amber-500" />
                </button>

                {canEdit && (
                  <>
                    <button
                      onClick={() => handleOpenEditModal(v)}
                      className="p-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 min-h-[36px] min-w-[36px] flex items-center justify-center"
                      title="Editar Equipamento"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Tem certeza que deseja excluir o equipamento "${v.model}" (${v.licensePlate || v.patrimonyCode})? Esta ação não pode ser desfeita.`)) {
                          onDeleteVehicle(v.id);
                        }
                      }}
                      className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 min-h-[36px] min-w-[36px] flex items-center justify-center"
                      title="Excluir Equipamento"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>

            </div>
          </div>
        ))}
      </div>

      {/* Equipment Passport Modal */}
      {passportVehicle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className={`w-full max-w-2xl rounded-2xl shadow-2xl border p-5 max-h-[90vh] overflow-y-auto space-y-4 ${
            darkMode ? 'bg-emerald-950 border-emerald-800 text-emerald-100' : 'bg-white border-emerald-100 text-gray-900'
          }`}>
            <div className="flex items-center justify-between border-b pb-3 border-emerald-800/20">
              <div className="flex items-center gap-2">
                <QrCode className="w-5 h-5 text-amber-500" />
                <span className="font-bold text-sm">Passaporte / Ficha do Equipamento</span>
              </div>
              <button onClick={() => setPassportVehicle(null)} className="p-1 rounded-lg hover:bg-emerald-500/10">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* QR Code & Badge */}
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center flex flex-col items-center justify-center">
                <div className="p-2 bg-white rounded-xl border border-gray-200 shadow-sm flex items-center justify-center">
                  <QRCodeCanvas
                    value={`${typeof window !== 'undefined' ? window.location.origin : 'https://andradeagro.app'}/#ficha-maquina/${passportVehicle.id}`}
                    size={140}
                  />
                </div>
                <span className="mt-2 text-xs font-black text-amber-600 dark:text-amber-400 uppercase">
                  {passportVehicle.licensePlate || passportVehicle.patrimonyCode}
                </span>
                <button
                  onClick={() => handlePrintBadge(passportVehicle)}
                  className="mt-3 px-3 py-1.5 rounded-lg bg-amber-500 text-gray-950 font-bold text-xs flex items-center gap-1"
                >
                  <Printer className="w-3.5 h-3.5" /> Imprimir QR
                </button>
              </div>

              {/* Specs */}
              <div className="md:col-span-2 space-y-2 text-xs">
                <div>
                  <div className="flex items-center justify-between">
                    <p className="text-base font-extrabold text-gray-900 dark:text-emerald-100">{passportVehicle.model}</p>
                    {passportVehicle.machineSubtype && (
                      <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/80 px-2 py-0.5 rounded-md border border-emerald-300/60 dark:border-emerald-700/60">
                        {getMachineSubtypeName(passportVehicle.machineSubtype)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-gray-600 dark:text-emerald-300">
                  <p><strong>Fabricante:</strong> {passportVehicle.manufacturer}</p>
                  <p><strong>Ano:</strong> {passportVehicle.year}</p>
                  <p><strong>Setor:</strong> {getSectorName(passportVehicle.sector)}</p>
                  <p><strong>Combustível:</strong> {passportVehicle.fuelType === 'NENHUM' ? 'Não se aplica' : `${passportVehicle.tankCapacityLiters}L (${getFuelTypeName(passportVehicle.fuelType)})`}</p>
                  <p><strong>Uso Atual:</strong> {passportVehicle.category === 'VEICULO' ? `${passportVehicle.currentKm} km` : `${passportVehicle.currentHourmeter || 0} h`}</p>
                  <p><strong>Operador:</strong> {passportVehicle.assignedOperatorName || 'Não atribuído'}</p>
                  <p><strong>Status:</strong> {passportVehicle.status}</p>
                </div>

                {/* Capacidades Operacionais Registradas */}
                {(() => {
                  const caps = getConsolidatedCapacities(passportVehicle).filter(c => c.type !== 'COMBUSTIVEL');
                  if (caps.length === 0) return null;
                  return (
                    <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 space-y-1.5 mt-2">
                      <p className="font-extrabold text-[11px] text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-emerald-600" /> Capacidades Operacionais:
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {caps.map((c, i) => (
                          <div key={c.id || i} className="text-[11px] flex justify-between items-center bg-white dark:bg-emerald-950 px-2 py-1 rounded-md border border-emerald-200 dark:border-emerald-800">
                            <span className="font-semibold text-slate-700 dark:text-emerald-300 flex items-center gap-1">
                              <span>{getCapacityTypeEmoji(c.type)}</span> {c.name}:
                            </span>
                            <strong className="text-emerald-900 dark:text-emerald-100 font-extrabold">
                              {c.value.toLocaleString('pt-BR')} {c.unit}
                            </strong>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {passportVehicle.notes && (
                  <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-emerald-900/30 border text-[11px]">
                    <strong>Observações:</strong> {passportVehicle.notes}
                  </div>
                )}
              </div>
            </div>

            <div className="pt-3 border-t flex justify-end gap-2">
              <button
                onClick={() => setPassportVehicle(null)}
                className="px-4 py-2 rounded-xl bg-emerald-800 text-white font-bold text-xs"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add New Equipment Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className={`w-full max-w-lg rounded-2xl shadow-2xl border p-5 space-y-4 max-h-[90vh] overflow-y-auto ${
            darkMode ? 'bg-emerald-950 border-emerald-800 text-emerald-100' : 'bg-white border-emerald-100 text-gray-900'
          }`}>
            <div className="flex items-center justify-between border-b pb-3 border-emerald-800/20">
              <span className="font-bold text-sm">Cadastrar Novo Equipamento</span>
              <button onClick={() => setShowAddModal(false)} className="p-1 rounded-lg hover:bg-emerald-500/10">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateEquipment} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold mb-1">Modelo do Equipamento</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: John Deere 8370R / Hilux SRX..."
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className={`w-full p-2 rounded-xl border ${darkMode ? 'bg-emerald-900/40 border-emerald-800 text-white' : 'bg-gray-50'}`}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold mb-1">Fabricante</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Toyota, John Deere..."
                    value={manufacturer}
                    onChange={(e) => setManufacturer(e.target.value)}
                    className={`w-full p-2 rounded-xl border ${darkMode ? 'bg-emerald-900/40 border-emerald-800 text-white' : 'bg-gray-50'}`}
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">Ano</label>
                  <input
                    type="number"
                    value={year}
                    onChange={(e) => setYear(parseInt(e.target.value) || 2024)}
                    className={`w-full p-2 rounded-xl border ${darkMode ? 'bg-emerald-900/40 border-emerald-800 text-white' : 'bg-gray-50'}`}
                  />
                </div>
              </div>

              {activeTab === 'VEICULO' ? (
                <div>
                  <label className="block font-bold mb-1">Placa do Veículo</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: QAA-8J90"
                    value={licensePlate}
                    onChange={(e) => setLicensePlate(e.target.value)}
                    className={`w-full p-2 rounded-xl border ${darkMode ? 'bg-emerald-900/40 border-emerald-800 text-white' : 'bg-gray-50'}`}
                  />
                </div>
              ) : (
                <div>
                  <label className="block font-bold mb-1">Código de Patrimônio</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: TRAT-003 ou MAQ-005"
                    value={patrimonyCode}
                    onChange={(e) => setPatrimonyCode(e.target.value)}
                    className={`w-full p-2 rounded-xl border ${darkMode ? 'bg-emerald-900/40 border-emerald-800 text-white' : 'bg-gray-50'}`}
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold mb-1">Setor Operacional</label>
                  <select
                    value={sector}
                    onChange={(e) => setSector(e.target.value as Sector)}
                    className={`w-full p-2 rounded-xl border ${darkMode ? 'bg-emerald-900/40 border-emerald-800 text-white' : 'bg-gray-50'}`}
                  >
                    <option value="PREPARO_SOLO">Preparo de Solo</option>
                    <option value="COLHEITA">Colheita</option>
                    <option value="PULVERIZACAO">Pulverização</option>
                    <option value="AGRICOLA">Agrícola</option>
                    <option value="LOGISTICA">Logística / Transporte</option>
                    <option value="DIRETORIA">Diretoria</option>
                    <option value="OFICINA_MANUTENCAO">Oficina</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold mb-1">
                    {activeTab === 'VEICULO' ? 'Quilometragem Inicial (KM)' : 'Horímetro Inicial (Horas)'}
                  </label>
                  <input
                    type="number"
                    value={activeTab === 'VEICULO' ? currentKm : currentHourmeter}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      if (activeTab === 'VEICULO') setCurrentKm(val);
                      else setCurrentHourmeter(val);
                    }}
                    className={`w-full p-2 rounded-xl border ${darkMode ? 'bg-emerald-900/40 border-emerald-800 text-white' : 'bg-gray-50'}`}
                  />
                </div>
              </div>

              {/* Capacidades da Máquina (Dinâmica e Específica por Equipamento) */}
              <MachineCapacitiesEditor
                category={activeTab}
                machineSubtype={machineSubtype}
                onMachineSubtypeChange={setMachineSubtype}
                sector={sector}
                fuelType={fuelType}
                onFuelTypeChange={setFuelType}
                tankCapacityLiters={tankCapacityLiters}
                onTankCapacityChange={setTankCapacityLiters}
                capacities={operationalCapacities}
                onChangeCapacities={setOperationalCapacities}
                darkMode={darkMode}
              />

              {/* Plano de Manutenção Preventiva (Troca de Óleo por Horímetro ou Quilometragem) */}
              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-amber-900 dark:text-amber-200 flex items-center gap-1.5 text-xs">
                    <Droplet className="w-4 h-4 text-amber-500" />
                    <span>
                      {activeTab === 'VEICULO' ? 'Plano de Troca de Óleo por Quilometragem (KM)' : 'Plano de Troca de Óleo por Horas'}
                    </span>
                  </span>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={oilChangeControlActive}
                      onChange={(e) => setOilChangeControlActive(e.target.checked)}
                      className="rounded border-amber-500 text-amber-600 focus:ring-amber-500"
                    />
                    <span className="text-[11px] font-bold text-amber-900 dark:text-amber-200">
                      {oilChangeControlActive ? 'Ativo' : 'Desativado'}
                    </span>
                  </label>
                </div>

                {oilChangeControlActive && (
                  activeTab === 'VEICULO' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                      <div>
                        <label className="block font-bold text-[11px] mb-1 text-slate-700 dark:text-emerald-200">
                          Intervalo Padrão (KM)
                        </label>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={oilChangeIntervalKm}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === '') {
                              setOilChangeIntervalKm('');
                            } else {
                              const parsed = parseInt(val, 10);
                              if (!isNaN(parsed) && parsed >= 0) {
                                setOilChangeIntervalKm(parsed);
                              }
                            }
                          }}
                          onBlur={() => {
                            if (!oilChangeIntervalKm || Number(oilChangeIntervalKm) <= 0) {
                              setOilChangeIntervalKm(10000);
                            }
                          }}
                          placeholder="Ex: 10000, 15000, 20000, 30000"
                          className={`w-full p-2 rounded-xl border text-xs font-bold ${
                            darkMode ? 'bg-emerald-900/40 border-emerald-800 text-white' : 'bg-white border-slate-200'
                          }`}
                        />
                        <p className="text-[10px] text-slate-500 mt-0.5">Ex: 10.000, 15.000, 20.000, 30.000 km ou mais</p>
                      </div>

                      <div>
                        <label className="block font-bold text-[11px] mb-1 text-slate-700 dark:text-emerald-200">
                          Alerta Prévio (KM)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={oilChangeWarningAdvanceKm}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === '') {
                              setOilChangeWarningAdvanceKm('');
                            } else {
                              const parsed = parseInt(val, 10);
                              if (!isNaN(parsed) && parsed >= 0) {
                                setOilChangeWarningAdvanceKm(parsed);
                              }
                            }
                          }}
                          onBlur={() => {
                            if (oilChangeWarningAdvanceKm === '' || isNaN(Number(oilChangeWarningAdvanceKm)) || Number(oilChangeWarningAdvanceKm) < 0) {
                              setOilChangeWarningAdvanceKm(1000);
                            }
                          }}
                          className={`w-full p-2 rounded-xl border text-xs font-bold ${
                            darkMode ? 'bg-emerald-900/40 border-emerald-800 text-white' : 'bg-white border-slate-200'
                          }`}
                        />
                        <p className="text-[10px] text-slate-500 mt-0.5">Avisar com antecedência (ex: 1.000 km)</p>
                      </div>

                      <div>
                        <label className="block font-bold text-[11px] mb-1 text-slate-700 dark:text-emerald-200">
                          KM de Referência da Última Troca
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={lastOilChangeKm}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === '') {
                              setLastOilChangeKm('');
                            } else {
                              const parsed = parseFloat(val);
                              if (!isNaN(parsed) && parsed >= 0) {
                                setLastOilChangeKm(parsed);
                              }
                            }
                          }}
                          onBlur={() => {
                            if (lastOilChangeKm === '' || isNaN(Number(lastOilChangeKm)) || Number(lastOilChangeKm) < 0) {
                              setLastOilChangeKm(0);
                            }
                          }}
                          placeholder="0 ou da última troca"
                          className={`w-full p-2 rounded-xl border text-xs font-bold ${
                            darkMode ? 'bg-emerald-900/40 border-emerald-800 text-white' : 'bg-white border-slate-200'
                          }`}
                        />
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          Próxima troca: <strong>{((Number(lastOilChangeKm) || 0) + (Number(oilChangeIntervalKm) || 10000)).toLocaleString('pt-BR')} km</strong>
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                      <div>
                        <label className="block font-bold text-[11px] mb-1 text-slate-700 dark:text-emerald-200">
                          Intervalo Padrão (h)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={oilChangeIntervalHours}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === '') {
                              setOilChangeIntervalHours('');
                            } else {
                              const parsed = parseInt(val, 10);
                              if (!isNaN(parsed) && parsed >= 0) {
                                setOilChangeIntervalHours(parsed);
                              }
                            }
                          }}
                          onBlur={() => {
                            if (!oilChangeIntervalHours || Number(oilChangeIntervalHours) <= 0) {
                              setOilChangeIntervalHours(300);
                            }
                          }}
                          className={`w-full p-2 rounded-xl border text-xs font-bold ${
                            darkMode ? 'bg-emerald-900/40 border-emerald-800 text-white' : 'bg-white border-slate-200'
                          }`}
                        />
                        <p className="text-[10px] text-slate-500 mt-0.5">Padrão agrícola: 300h</p>
                      </div>

                      <div>
                        <label className="block font-bold text-[11px] mb-1 text-slate-700 dark:text-emerald-200">
                          Alerta Prévio (h)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={oilChangeWarningAdvanceHours}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === '') {
                              setOilChangeWarningAdvanceHours('');
                            } else {
                              const parsed = parseInt(val, 10);
                              if (!isNaN(parsed) && parsed >= 0) {
                                setOilChangeWarningAdvanceHours(parsed);
                              }
                            }
                          }}
                          onBlur={() => {
                            if (oilChangeWarningAdvanceHours === '' || isNaN(Number(oilChangeWarningAdvanceHours)) || Number(oilChangeWarningAdvanceHours) < 0) {
                              setOilChangeWarningAdvanceHours(50);
                            }
                          }}
                          className={`w-full p-2 rounded-xl border text-xs font-bold ${
                            darkMode ? 'bg-emerald-900/40 border-emerald-800 text-white' : 'bg-white border-slate-200'
                          }`}
                        />
                        <p className="text-[10px] text-slate-500 mt-0.5">Avisar com antecedência (ex: 50h)</p>
                      </div>

                      <div>
                        <label className="block font-bold text-[11px] mb-1 text-slate-700 dark:text-emerald-200">
                          Horímetro de Referência (h)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={lastOilChangeHourmeter}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === '') {
                              setLastOilChangeHourmeter('');
                            } else {
                              const parsed = parseFloat(val);
                              if (!isNaN(parsed) && parsed >= 0) {
                                setLastOilChangeHourmeter(parsed);
                              }
                            }
                          }}
                          onBlur={() => {
                            if (lastOilChangeHourmeter === '' || isNaN(Number(lastOilChangeHourmeter)) || Number(lastOilChangeHourmeter) < 0) {
                              setLastOilChangeHourmeter(0);
                            }
                          }}
                          placeholder="0 ou da última troca"
                          className={`w-full p-2 rounded-xl border text-xs font-bold ${
                            darkMode ? 'bg-emerald-900/40 border-emerald-800 text-white' : 'bg-white border-slate-200'
                          }`}
                        />
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          Próxima troca: <strong>{((Number(lastOilChangeHourmeter) || 0) + (Number(oilChangeIntervalHours) || 300)).toLocaleString('pt-BR')}h</strong>
                        </p>
                      </div>
                    </div>
                  )
                )}
              </div>

              <div>
                <label className="block font-bold mb-1">Operador Atribuído (Opcional)</label>
                <select
                  value={assignedOperatorId}
                  onChange={(e) => setAssignedOperatorId(e.target.value)}
                  className={`w-full p-2 rounded-xl border ${darkMode ? 'bg-emerald-900/40 border-emerald-800 text-white' : 'bg-gray-50'}`}
                >
                  <option value="">Nenhum operador atribuído</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.name} ({u.department || u.role})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold mb-1">URL da Foto (Opcional)</label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={photoUrl}
                  onChange={(e) => setPhotoUrl(e.target.value)}
                  className={`w-full p-2 rounded-xl border ${darkMode ? 'bg-emerald-900/40 border-emerald-800 text-white' : 'bg-gray-50'}`}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 rounded-xl hover:bg-emerald-500/10"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-500 text-gray-950 font-bold"
                >
                  Cadastrar Equipamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Equipment Modal */}
      {editingVehicle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className={`w-full max-w-lg rounded-2xl shadow-2xl border p-5 space-y-4 max-h-[90vh] overflow-y-auto ${
            darkMode ? 'bg-emerald-950 border-emerald-800 text-emerald-100' : 'bg-white border-emerald-100 text-gray-900'
          }`}>
            <div className="flex items-center justify-between border-b pb-3 border-emerald-800/20">
              <span className="font-bold text-sm">Editar Equipamento: {editingVehicle.model}</span>
              <button onClick={() => setEditingVehicle(null)} className="p-1 rounded-lg hover:bg-emerald-500/10">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateEquipment} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold mb-1">Modelo do Equipamento</label>
                <input
                  type="text"
                  required
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className={`w-full p-2 rounded-xl border ${darkMode ? 'bg-emerald-900/40 border-emerald-800 text-white' : 'bg-gray-50'}`}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold mb-1">Fabricante</label>
                  <input
                    type="text"
                    required
                    value={manufacturer}
                    onChange={(e) => setManufacturer(e.target.value)}
                    className={`w-full p-2 rounded-xl border ${darkMode ? 'bg-emerald-900/40 border-emerald-800 text-white' : 'bg-gray-50'}`}
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">Ano</label>
                  <input
                    type="number"
                    value={year}
                    onChange={(e) => setYear(parseInt(e.target.value) || 2024)}
                    className={`w-full p-2 rounded-xl border ${darkMode ? 'bg-emerald-900/40 border-emerald-800 text-white' : 'bg-gray-50'}`}
                  />
                </div>
              </div>

              {editingVehicle.category === 'VEICULO' ? (
                <div>
                  <label className="block font-bold mb-1">Placa do Veículo</label>
                  <input
                    type="text"
                    required
                    value={licensePlate}
                    onChange={(e) => setLicensePlate(e.target.value)}
                    className={`w-full p-2 rounded-xl border ${darkMode ? 'bg-emerald-900/40 border-emerald-800 text-white' : 'bg-gray-50'}`}
                  />
                </div>
              ) : (
                <div>
                  <label className="block font-bold mb-1">Código de Patrimônio</label>
                  <input
                    type="text"
                    required
                    value={patrimonyCode}
                    onChange={(e) => setPatrimonyCode(e.target.value)}
                    className={`w-full p-2 rounded-xl border ${darkMode ? 'bg-emerald-900/40 border-emerald-800 text-white' : 'bg-gray-50'}`}
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold mb-1">Setor Operacional</label>
                  <select
                    value={sector}
                    onChange={(e) => setSector(e.target.value as Sector)}
                    className={`w-full p-2 rounded-xl border ${darkMode ? 'bg-emerald-900/40 border-emerald-800 text-white' : 'bg-gray-50'}`}
                  >
                    <option value="PREPARO_SOLO">Preparo de Solo</option>
                    <option value="COLHEITA">Colheita</option>
                    <option value="PULVERIZACAO">Pulverização</option>
                    <option value="AGRICOLA">Agrícola</option>
                    <option value="LOGISTICA">Logística / Transporte</option>
                    <option value="DIRETORIA">Diretoria</option>
                    <option value="OFICINA_MANUTENCAO">Oficina</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold mb-1">
                    {editingVehicle.category === 'VEICULO' ? 'Quilometragem (KM)' : 'Horímetro (Horas)'}
                  </label>
                  <input
                    type="number"
                    value={editingVehicle.category === 'VEICULO' ? currentKm : currentHourmeter}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      if (editingVehicle.category === 'VEICULO') setCurrentKm(val);
                      else setCurrentHourmeter(val);
                    }}
                    className={`w-full p-2 rounded-xl border ${darkMode ? 'bg-emerald-900/40 border-emerald-800 text-white' : 'bg-gray-50'}`}
                  />
                </div>
              </div>

              {/* Capacidades da Máquina (Dinâmica e Específica por Equipamento) */}
              <MachineCapacitiesEditor
                category={editingVehicle.category}
                machineSubtype={machineSubtype}
                onMachineSubtypeChange={setMachineSubtype}
                sector={sector}
                fuelType={fuelType}
                onFuelTypeChange={setFuelType}
                tankCapacityLiters={tankCapacityLiters}
                onTankCapacityChange={setTankCapacityLiters}
                capacities={operationalCapacities}
                onChangeCapacities={setOperationalCapacities}
                darkMode={darkMode}
              />

              {/* Plano de Manutenção Preventiva (Troca de Óleo por Horímetro ou KM) */}
              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-amber-900 dark:text-amber-200 flex items-center gap-1.5 text-xs">
                    <Droplet className="w-4 h-4 text-amber-500" />
                    <span>
                      {editingVehicle.category === 'VEICULO' ? 'Configurar Troca de Óleo por Quilometragem (KM)' : 'Configurar Troca de Óleo por Horas'}
                    </span>
                  </span>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={oilChangeControlActive}
                      onChange={(e) => setOilChangeControlActive(e.target.checked)}
                      className="rounded border-amber-500 text-amber-600 focus:ring-amber-500"
                    />
                    <span className="text-[11px] font-bold text-amber-900 dark:text-amber-200">
                      {oilChangeControlActive ? 'Ativo' : 'Desativado'}
                    </span>
                  </label>
                </div>

                {oilChangeControlActive && (
                  editingVehicle.category === 'VEICULO' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                      <div>
                        <label className="block font-bold text-[11px] mb-1 text-slate-700 dark:text-emerald-200">
                          Intervalo Padrão (KM)
                        </label>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={oilChangeIntervalKm}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === '') {
                              setOilChangeIntervalKm('');
                            } else {
                              const parsed = parseInt(val, 10);
                              if (!isNaN(parsed) && parsed >= 0) {
                                setOilChangeIntervalKm(parsed);
                              }
                            }
                          }}
                          onBlur={() => {
                            if (!oilChangeIntervalKm || Number(oilChangeIntervalKm) <= 0) {
                              setOilChangeIntervalKm(10000);
                            }
                          }}
                          placeholder="Ex: 10000, 15000, 20000, 30000"
                          className={`w-full p-2 rounded-xl border text-xs font-bold ${
                            darkMode ? 'bg-emerald-900/40 border-emerald-800 text-white' : 'bg-white border-slate-200'
                          }`}
                        />
                        <p className="text-[10px] text-slate-500 mt-0.5">Ex: 10.000, 15.000, 20.000, 30.000 km ou mais</p>
                      </div>

                      <div>
                        <label className="block font-bold text-[11px] mb-1 text-slate-700 dark:text-emerald-200">
                          Alerta Prévio (KM)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={oilChangeWarningAdvanceKm}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === '') {
                              setOilChangeWarningAdvanceKm('');
                            } else {
                              const parsed = parseInt(val, 10);
                              if (!isNaN(parsed) && parsed >= 0) {
                                setOilChangeWarningAdvanceKm(parsed);
                              }
                            }
                          }}
                          onBlur={() => {
                            if (oilChangeWarningAdvanceKm === '' || isNaN(Number(oilChangeWarningAdvanceKm)) || Number(oilChangeWarningAdvanceKm) < 0) {
                              setOilChangeWarningAdvanceKm(1000);
                            }
                          }}
                          className={`w-full p-2 rounded-xl border text-xs font-bold ${
                            darkMode ? 'bg-emerald-900/40 border-emerald-800 text-white' : 'bg-white border-slate-200'
                          }`}
                        />
                        <p className="text-[10px] text-slate-500 mt-0.5">Avisar com antecedência (ex: 1.000 km)</p>
                      </div>

                      <div>
                        <label className="block font-bold text-[11px] mb-1 text-slate-700 dark:text-emerald-200">
                          Odômetro da Última Troca / Ref (KM)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={lastOilChangeKm}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === '') {
                              setLastOilChangeKm('');
                            } else {
                              const parsed = parseFloat(val);
                              if (!isNaN(parsed) && parsed >= 0) {
                                setLastOilChangeKm(parsed);
                              }
                            }
                          }}
                          onBlur={() => {
                            if (lastOilChangeKm === '' || isNaN(Number(lastOilChangeKm)) || Number(lastOilChangeKm) < 0) {
                              setLastOilChangeKm(0);
                            }
                          }}
                          placeholder="0 ou da última troca"
                          className={`w-full p-2 rounded-xl border text-xs font-bold ${
                            darkMode ? 'bg-emerald-900/40 border-emerald-800 text-white' : 'bg-white border-slate-200'
                          }`}
                        />
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          Próxima troca: <strong>{((Number(lastOilChangeKm) || 0) + (Number(oilChangeIntervalKm) || 10000)).toLocaleString('pt-BR')} km</strong>
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                      <div>
                        <label className="block font-bold text-[11px] mb-1 text-slate-700 dark:text-emerald-200">
                          Intervalo Padrão (h)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={oilChangeIntervalHours}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === '') {
                              setOilChangeIntervalHours('');
                            } else {
                              const parsed = parseInt(val, 10);
                              if (!isNaN(parsed) && parsed >= 0) {
                                setOilChangeIntervalHours(parsed);
                              }
                            }
                          }}
                          onBlur={() => {
                            if (!oilChangeIntervalHours || Number(oilChangeIntervalHours) <= 0) {
                              setOilChangeIntervalHours(300);
                            }
                          }}
                          className={`w-full p-2 rounded-xl border text-xs font-bold ${
                            darkMode ? 'bg-emerald-900/40 border-emerald-800 text-white' : 'bg-white border-slate-200'
                          }`}
                        />
                        <p className="text-[10px] text-slate-500 mt-0.5">Padrão agrícola: 300h</p>
                      </div>

                      <div>
                        <label className="block font-bold text-[11px] mb-1 text-slate-700 dark:text-emerald-200">
                          Alerta Prévio (h)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={oilChangeWarningAdvanceHours}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === '') {
                              setOilChangeWarningAdvanceHours('');
                            } else {
                              const parsed = parseInt(val, 10);
                              if (!isNaN(parsed) && parsed >= 0) {
                                setOilChangeWarningAdvanceHours(parsed);
                              }
                            }
                          }}
                          onBlur={() => {
                            if (oilChangeWarningAdvanceHours === '' || isNaN(Number(oilChangeWarningAdvanceHours)) || Number(oilChangeWarningAdvanceHours) < 0) {
                              setOilChangeWarningAdvanceHours(50);
                            }
                          }}
                          className={`w-full p-2 rounded-xl border text-xs font-bold ${
                            darkMode ? 'bg-emerald-900/40 border-emerald-800 text-white' : 'bg-white border-slate-200'
                          }`}
                        />
                        <p className="text-[10px] text-slate-500 mt-0.5">Avisar com antecedência (ex: 50h)</p>
                      </div>

                      <div>
                        <label className="block font-bold text-[11px] mb-1 text-slate-700 dark:text-emerald-200">
                          Horímetro da Última Troca / Ref (h)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={lastOilChangeHourmeter}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === '') {
                              setLastOilChangeHourmeter('');
                            } else {
                              const parsed = parseFloat(val);
                              if (!isNaN(parsed) && parsed >= 0) {
                                setLastOilChangeHourmeter(parsed);
                              }
                            }
                          }}
                          onBlur={() => {
                            if (lastOilChangeHourmeter === '' || isNaN(Number(lastOilChangeHourmeter)) || Number(lastOilChangeHourmeter) < 0) {
                              setLastOilChangeHourmeter(0);
                            }
                          }}
                          placeholder="0 ou da última troca"
                          className={`w-full p-2 rounded-xl border text-xs font-bold ${
                            darkMode ? 'bg-emerald-900/40 border-emerald-800 text-white' : 'bg-white border-slate-200'
                          }`}
                        />
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          Próxima troca calculada: <strong>{((Number(lastOilChangeHourmeter) || 0) + (Number(oilChangeIntervalHours) || 300)).toLocaleString('pt-BR')}h</strong>
                        </p>
                      </div>
                    </div>
                  )
                )}
              </div>

              <div>
                <label className="block font-bold mb-1">Operador Atribuído (Opcional)</label>
                <select
                  value={assignedOperatorId}
                  onChange={(e) => setAssignedOperatorId(e.target.value)}
                  className={`w-full p-2 rounded-xl border ${darkMode ? 'bg-emerald-900/40 border-emerald-800 text-white' : 'bg-gray-50'}`}
                >
                  <option value="">Nenhum operador atribuído</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.name} ({u.department || u.role})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold mb-1">URL da Foto (Opcional)</label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={photoUrl}
                  onChange={(e) => setPhotoUrl(e.target.value)}
                  className={`w-full p-2 rounded-xl border ${darkMode ? 'bg-emerald-900/40 border-emerald-800 text-white' : 'bg-gray-50'}`}
                />
              </div>

              {equipmentSaveError && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs font-bold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{equipmentSaveError}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingVehicle(null)}
                  disabled={isSavingEquipment}
                  className="px-3 py-1.5 rounded-xl hover:bg-emerald-500/10 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingEquipment}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-gray-950 font-bold disabled:opacity-60 flex items-center gap-1.5 shadow-md"
                >
                  {isSavingEquipment ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Oil Change Modal */}
      {oilChangeVehicle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className={`w-full max-w-md rounded-2xl shadow-2xl border p-5 space-y-4 max-h-[90vh] overflow-y-auto ${
            darkMode ? 'bg-emerald-950 border-emerald-800 text-emerald-100' : 'bg-white border-emerald-100 text-gray-900'
          }`}>
            <div className="flex items-center justify-between border-b pb-3 border-emerald-800/20">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-500 flex items-center justify-center">
                  <Droplet className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-gray-900 dark:text-emerald-100">
                    Registrar Troca de Óleo / Manutenção
                  </h3>
                  <p className="text-[11px] text-gray-500 dark:text-emerald-400">
                    {oilChangeVehicle.model} ({oilChangeVehicle.patrimonyCode || oilChangeVehicle.licensePlate})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setOilChangeVehicle(null)}
                className="p-1.5 rounded-lg hover:bg-emerald-500/10 text-gray-500 hover:text-gray-900 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveOilChange} className="space-y-3.5 text-xs">
              {(() => {
                const isKm = oilChangeVehicle.category === 'VEICULO' || oilChangeVehicle.maintenanceControlType === 'QUILOMETRAGEM';
                const interval = isKm 
                  ? (oilChangeVehicle.oilChangeIntervalKm || oilChangeVehicle.maintenanceIntervalKm || 10000)
                  : (oilChangeVehicle.oilChangeIntervalHours || oilChangeVehicle.maintenanceIntervalHours || 300);
                const last = isKm 
                  ? (oilChangeVehicle.lastOilChangeKm !== undefined ? oilChangeVehicle.lastOilChangeKm : (oilChangeVehicle.lastMaintenanceKm || 0))
                  : (oilChangeVehicle.lastOilChangeHourmeter !== undefined ? oilChangeVehicle.lastOilChangeHourmeter : (oilChangeVehicle.lastMaintenanceHourmeter || 0));
                const unit = isKm ? 'km' : 'h';
                const nextCalc = (oilHourmeter || 0) + interval;

                return (
                  <>
                    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-1">
                      <div className="flex justify-between items-center">
                        <p className="font-black text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                          <Sparkles className="w-4 h-4 text-amber-500" />
                          <span>Ciclo Preventivo: {interval.toLocaleString('pt-BR')} {unit === 'km' ? 'Quilômetros (KM)' : 'Horas'}</span>
                        </p>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300">
                          Última: {last.toLocaleString('pt-BR')}{unit}
                        </span>
                      </div>
                      <p className="text-[11px] text-amber-800 dark:text-amber-300">
                        Ao registrar esta troca, o sistema calculará a próxima manutenção programada para <strong>{nextCalc.toLocaleString('pt-BR')} {unit}</strong> e atualizará o odômetro/horímetro e histórico do equipamento.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="block font-bold mb-1">
                          {isKm
                            ? 'Odômetro Atual no Serviço (KM) *'
                            : 'Horímetro Atual no Serviço (h) *'}
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          required
                          value={oilHourmeter}
                          onChange={(e) => setOilHourmeter(parseFloat(e.target.value) || 0)}
                          className={`w-full p-2.5 rounded-xl border font-black text-sm ${
                            darkMode ? 'bg-emerald-900/40 border-emerald-800 text-white' : 'bg-gray-50 border-gray-200'
                          }`}
                        />
                        {oilHourmeter < (isKm ? (oilChangeVehicle.currentKm || 0) : (oilChangeVehicle.currentHourmeter || 0)) && (
                          <p className="text-[10px] text-amber-500 font-bold mt-1">
                            ⚠️ Atenção: O valor digitado ({oilHourmeter}{unit}) é menor que o valor atual oficial ({isKm ? (oilChangeVehicle.currentKm || 0) : (oilChangeVehicle.currentHourmeter || 0)}{unit}). O horímetro oficial da máquina será mantido no maior valor.
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="block font-bold mb-1">Data da Troca *</label>
                        <input
                          type="date"
                          required
                          value={oilDate}
                          onChange={(e) => setOilDate(e.target.value)}
                          className={`w-full p-2.5 rounded-xl border ${
                            darkMode ? 'bg-emerald-900/40 border-emerald-800 text-white' : 'bg-gray-50 border-gray-200'
                          }`}
                        />
                      </div>
                    </div>
                  </>
                );
              })()}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-bold mb-1">Tipo de Óleo Utilizado</label>
                  <input
                    type="text"
                    placeholder="Ex: 15W40 Mineral, 15W40 Semi-Sintético, 10W40..."
                    value={oilType}
                    onChange={(e) => setOilType(e.target.value)}
                    className={`w-full p-2 rounded-xl border ${
                      darkMode ? 'bg-emerald-900/40 border-emerald-800 text-white' : 'bg-gray-50 border-gray-200'
                    }`}
                  />
                </div>

                <div>
                  <label className="block font-bold mb-1">Volume de Óleo (Litros)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    placeholder="Ex: 20"
                    value={oilQuantityLiters}
                    onChange={(e) => setOilQuantityLiters(parseFloat(e.target.value) || 0)}
                    className={`w-full p-2 rounded-xl border ${
                      darkMode ? 'bg-emerald-900/40 border-emerald-800 text-white' : 'bg-gray-50 border-gray-200'
                    }`}
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold mb-1">Filtros Substituídos</label>
                <input
                  type="text"
                  placeholder="Ex: Filtro lubrificante + Filtro de combustível + Filtro de ar..."
                  value={filtersReplaced}
                  onChange={(e) => setFiltersReplaced(e.target.value)}
                  className={`w-full p-2 rounded-xl border ${
                    darkMode ? 'bg-emerald-900/40 border-emerald-800 text-white' : 'bg-gray-50 border-gray-200'
                  }`}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-bold mb-1">Mecânico / Responsável</label>
                  <input
                    type="text"
                    value={oilPerformedBy}
                    onChange={(e) => setOilPerformedBy(e.target.value)}
                    placeholder="Ex: Mecânico AndradeAgro"
                    className={`w-full p-2 rounded-xl border ${
                      darkMode ? 'bg-emerald-900/40 border-emerald-800 text-white' : 'bg-gray-50 border-gray-200'
                    }`}
                  />
                </div>

                <div>
                  <label className="block font-bold mb-1">Custo Total (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={oilCost}
                    onChange={(e) => setOilCost(parseFloat(e.target.value) || 0)}
                    placeholder="0,00"
                    className={`w-full p-2 rounded-xl border ${
                      darkMode ? 'bg-emerald-900/40 border-emerald-800 text-white' : 'bg-gray-50 border-gray-200'
                    }`}
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold mb-1">Observações Adicionais</label>
                <textarea
                  rows={2}
                  value={oilNotes}
                  onChange={(e) => setOilNotes(e.target.value)}
                  placeholder="Ex: Óleo trocado no ponto de manutenção. Sem vazamentos identificados."
                  className={`w-full p-2 rounded-xl border resize-none ${
                    darkMode ? 'bg-emerald-900/40 border-emerald-800 text-white' : 'bg-gray-50 border-gray-200'
                  }`}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-emerald-800/20">
                <button
                  type="button"
                  onClick={() => setOilChangeVehicle(null)}
                  className="px-3.5 py-2 rounded-xl hover:bg-emerald-500/10 font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingOil}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-gray-950 font-black flex items-center gap-1.5 shadow-md transition-transform active:scale-95"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {isSavingOil ? 'Gravando...' : 'Confirmar Troca de Óleo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export const FleetManagementView = React.memo(FleetManagementViewComponent);
