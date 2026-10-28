import { Vehicle } from '../types';

/**
 * Robust parser to identify an AndradeAgro vehicle from any scanned QR Code string.
 * Supports:
 * - Direct vehicle ID (e.g. "eq-01", "vh-02")
 * - Direct license plate (e.g. "BRA2E19", "ABC-1234")
 * - Direct patrimony code (e.g. "PAT-001", "TR-05")
 * - Full system URLs (e.g. "https://andradeagro.app/#ficha-maquina/eq-01")
 * - Legacy format prefixes (e.g. "ANDRADEAGRO:eq-01")
 * - Query parameter links (e.g. "https://.../?vehicleId=eq-01")
 */
export function parseVehicleFromScannedQRCode(scannedText: string, vehicles: Vehicle[]): Vehicle | null {
  if (!scannedText || typeof scannedText !== 'string' || !Array.isArray(vehicles) || vehicles.length === 0) {
    return null;
  }

  const raw = scannedText.trim();
  const cleanRaw = raw.replace(/\s+/g, '');
  const cleanAlphanumeric = raw.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

  // 1. Direct match by exact ID, license plate or patrimony code
  const exactMatch = vehicles.find(v => {
    if (v.id && v.id.toLowerCase() === raw.toLowerCase()) return true;
    if (v.patrimonyCode && v.patrimonyCode.toLowerCase() === raw.toLowerCase()) return true;
    if (v.licensePlate) {
      const vPlateClean = v.licensePlate.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      if (vPlateClean && vPlateClean === cleanAlphanumeric) return true;
    }
    return false;
  });
  if (exactMatch) return exactMatch;

  // 2. Parse URL hashes (#ficha-maquina/..., #vehicle/..., #maintenance/...)
  const hashIdx = raw.indexOf('#');
  if (hashIdx !== -1) {
    const hashPart = raw.slice(hashIdx + 1);
    const slashParts = hashPart.split('/').filter(Boolean);
    if (slashParts.length > 0) {
      const candidateId = decodeURIComponent(slashParts[slashParts.length - 1]).trim();
      const match = findVehicleByCandidate(candidateId, vehicles);
      if (match) return match;
    }
  }

  // 3. Parse path segments (e.g. /ficha-maquina/eq-01)
  if (raw.includes('/ficha-maquina/') || raw.includes('/vehicle/') || raw.includes('/maintenance/')) {
    const segments = raw.split(/[/?#&]/).filter(Boolean);
    const last = segments[segments.length - 1];
    if (last) {
      const match = findVehicleByCandidate(decodeURIComponent(last), vehicles);
      if (match) return match;
    }
  }

  // 4. Parse custom "ANDRADEAGRO:ID" prefix
  if (raw.toUpperCase().startsWith('ANDRADEAGRO:')) {
    const candidateId = raw.split(':')[1]?.trim();
    if (candidateId) {
      const match = findVehicleByCandidate(candidateId, vehicles);
      if (match) return match;
    }
  }

  // 5. Try to extract URL search parameters if valid URL
  try {
    const url = new URL(raw, 'https://andradeagro.app');
    const paramVal = url.searchParams.get('id') || url.searchParams.get('vehicle') || url.searchParams.get('vehicleId');
    if (paramVal) {
      const match = findVehicleByCandidate(paramVal, vehicles);
      if (match) return match;
    }
  } catch {
    // Non-fatal if raw is not a full URL
  }

  // 6. Substring scan: check if any vehicle's ID or plate is contained as a word within the scanned string
  for (const v of vehicles) {
    if (v.id && raw.includes(v.id)) return v;
    if (v.patrimonyCode && raw.includes(v.patrimonyCode)) return v;
    if (v.licensePlate) {
      const cleanPlate = v.licensePlate.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      if (cleanPlate.length >= 4 && cleanAlphanumeric.includes(cleanPlate)) {
        return v;
      }
    }
  }

  return null;
}

function findVehicleByCandidate(candidate: string, vehicles: Vehicle[]): Vehicle | null {
  if (!candidate) return null;
  const cleanCandidate = candidate.trim().toLowerCase();
  const cleanAlpha = candidate.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

  return vehicles.find(v => {
    if (v.id && v.id.toLowerCase() === cleanCandidate) return true;
    if (v.patrimonyCode && v.patrimonyCode.toLowerCase() === cleanCandidate) return true;
    if (v.licensePlate) {
      const vPlate = v.licensePlate.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      if (vPlate && (vPlate === cleanAlpha || vPlate === cleanCandidate)) return true;
    }
    return false;
  }) || null;
}
