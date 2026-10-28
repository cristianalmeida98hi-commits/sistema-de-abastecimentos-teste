import { OperationalCapacity, OperationalCapacityType, Vehicle, MachineSubtype } from '../types';

export function getCapacityTypeLabel(type: OperationalCapacityType): string {
  switch (type) {
    case 'COMBUSTIVEL':
      return 'Tanque de Combustível';
    case 'PULVERIZACAO':
      return 'Tanque de Pulverização / Calda';
    case 'ADUBO':
      return 'Capacidade / Depósito de Adubo';
    case 'SEMENTE':
      return 'Depósito de Sementes / Graneleiro';
    case 'CACAMBA':
      return 'Caçamba de Carga';
    case 'RESERVATORIO':
      return 'Reservatório de Água / Fluidos';
    case 'CARGA':
      return 'Capacidade de Carga';
    case 'OUTRO':
    default:
      return 'Capacidade Operacional';
  }
}

export function getCapacityTypeEmoji(type: OperationalCapacityType): string {
  switch (type) {
    case 'COMBUSTIVEL':
      return '⛽';
    case 'PULVERIZACAO':
      return '🧪';
    case 'ADUBO':
      return '🌾';
    case 'SEMENTE':
      return '🌱';
    case 'CACAMBA':
      return '🚜';
    case 'RESERVATORIO':
      return '💧';
    case 'CARGA':
      return '⚖️';
    case 'OUTRO':
    default:
      return '📦';
  }
}

export function getDefaultUnitForType(type: OperationalCapacityType): string {
  switch (type) {
    case 'COMBUSTIVEL':
    case 'PULVERIZACAO':
    case 'RESERVATORIO':
      return 'L';
    case 'ADUBO':
    case 'CARGA':
      return 'kg';
    case 'CACAMBA':
      return 'm³';
    case 'SEMENTE':
      return 'L';
    case 'OUTRO':
    default:
      return 'L';
  }
}

export const COMMON_UNITS = ['L', 'kg', 't', 'm³', 'sacas', 'unidades'];

export function getMachineSubtypeName(subtype?: MachineSubtype | string): string {
  if (!subtype) return 'Geral';
  switch (subtype) {
    case 'PULVERIZADOR':
      return 'Pulverizador Autopropelido / Arrasto';
    case 'COLHEITADEIRA':
      return 'Colheitadeira de Grãos';
    case 'DISTRIBUIDOR_ADUBO':
      return 'Distribuidor de Adubo / Calcário';
    case 'PLANTADEIRA_SEMEADORA':
      return 'Plantadeira / Semeadora';
    case 'ESCAVADEIRA':
      return 'Escavadeira Hidráulica';
    case 'RETROESCAVADEIRA':
      return 'Retroescavadeira';
    case 'PA_CARREGADEIRA':
      return 'Pá Carregadeira';
    case 'MOTONIVELADORA':
      return 'Motoniveladora';
    case 'IMPLEMENTO':
      return 'Implemento / Grade / Arado';
    case 'CARRETA_AGRICOLA':
      return 'Carreta Agrícola / Basculante';
    case 'OUTRO':
      return 'Outro Equipamento';
    default:
      return subtype;
  }
}

/**
 * Retorna as capacidades operacionais do veículo consolidadas,
 * garantindo que a capacidade do tanque de combustível (vehicle.tankCapacityLiters)
 * registrada no Firestore seja SEMPRE a fonte da verdade atualizada em tempo real.
 */
export function getConsolidatedCapacities(vehicle: Vehicle): OperationalCapacity[] {
  const hasFuelTank = vehicle.fuelType && vehicle.fuelType !== 'NENHUM' && (Number(vehicle.tankCapacityLiters) || 0) > 0;
  const currentFuelLiters = Number(vehicle.tankCapacityLiters) || 0;

  if (Array.isArray(vehicle.operationalCapacities) && vehicle.operationalCapacities.length > 0) {
    const list: OperationalCapacity[] = [];
    let fuelTankProcessed = false;

    for (const cap of vehicle.operationalCapacities) {
      if (cap.type === 'COMBUSTIVEL' || cap.id === 'legacy-fuel' || cap.id === 'fuel-tank-main') {
        if (hasFuelTank) {
          fuelTankProcessed = true;
          list.push({
            ...cap,
            type: 'COMBUSTIVEL',
            name: cap.name || 'Tanque de Combustível',
            value: currentFuelLiters, // Sempre o valor real atual de vehicle.tankCapacityLiters do Firestore
            unit: 'L'
          });
        }
        // Se fuelType === 'NENHUM' ou capacidade for 0, não inclui tanque de combustível
      } else {
        list.push(cap);
      }
    }

    // Se o veículo possui combustível configurado mas ainda não tinha o item no array
    if (hasFuelTank && !fuelTankProcessed) {
      list.unshift({
        id: 'fuel-tank-main',
        type: 'COMBUSTIVEL',
        name: 'Tanque de Combustível',
        value: currentFuelLiters,
        unit: 'L'
      });
    }

    return list;
  }

  const generated: OperationalCapacity[] = [];

  // Tanque de combustível (sempre com o dado real do Firestore)
  if (hasFuelTank) {
    generated.push({
      id: 'legacy-fuel',
      type: 'COMBUSTIVEL',
      name: 'Tanque de Combustível',
      value: currentFuelLiters,
      unit: 'L'
    });
  }

  // Tanque de pulverização
  if ((vehicle.sprayingTankCapacityLiters || 0) > 0 || vehicle.hasSprayingTank || vehicle.sector === 'PULVERIZACAO' || vehicle.machineSubtype === 'PULVERIZADOR') {
    if ((vehicle.sprayingTankCapacityLiters || 0) > 0) {
      generated.push({
        id: 'legacy-spray',
        type: 'PULVERIZACAO',
        name: 'Tanque de Pulverização',
        value: Number(vehicle.sprayingTankCapacityLiters) || 0,
        unit: 'L',
        notes: 'Calda / Defensivos'
      });
    }
  }

  return generated;
}
