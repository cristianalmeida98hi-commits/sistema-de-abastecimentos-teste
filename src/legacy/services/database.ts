import { 
  User, Vehicle, GasStation, FuelLog, MaintenanceLog 
} from '../types';
import { 
  getVehicles, getUsers, getFuelLogs, getMaintenanceLogs, getGasStations,
  addVehicle, updateVehicle, deleteVehicle,
  addUser, updateUser, deleteUser,
  addFuelLog, deleteFuelLog,
  addMaintenance, updateMaintenance, deleteMaintenance,
  addGasStation, updateGasStation, deleteGasStation
} from '../utils/storage';

// Online Central Firebase Firestore Database Service Layer
export const databaseService = {
  // MACHINES / VEHICLES
  async getMachines(): Promise<Vehicle[]> {
    return getVehicles();
  },

  async addMachine(machine: Vehicle): Promise<boolean> {
    try {
      await addVehicle(machine);
      return true;
    } catch (e) {
      console.error('[databaseService] Error adding machine:', e);
      return false;
    }
  },

  async updateMachine(id: string, fields: Partial<Vehicle>): Promise<boolean> {
    try {
      await updateVehicle(id, fields);
      return true;
    } catch (e) {
      console.error('[databaseService] Error updating machine:', e);
      return false;
    }
  },

  async deleteMachine(id: string): Promise<boolean> {
    try {
      await deleteVehicle(id);
      return true;
    } catch (e) {
      console.error('[databaseService] Error deleting machine:', e);
      return false;
    }
  },

  // EMPLOYEES / USERS
  async getEmployees(): Promise<User[]> {
    return getUsers();
  },

  async addEmployee(user: User): Promise<boolean> {
    try {
      await addUser(user);
      return true;
    } catch (e) {
      console.error('[databaseService] Error adding employee:', e);
      return false;
    }
  },

  async updateEmployee(id: string, fields: Partial<User>): Promise<boolean> {
    try {
      await updateUser(id, fields);
      return true;
    } catch (e) {
      console.error('[databaseService] Error updating employee:', e);
      return false;
    }
  },

  async deleteEmployee(id: string): Promise<boolean> {
    try {
      await deleteUser(id);
      return true;
    } catch (e) {
      console.error('[databaseService] Error deleting employee:', e);
      return false;
    }
  },

  // FUEL RECORDS / ABASTECIMENTOS
  async getFuelRecords(): Promise<FuelLog[]> {
    return getFuelLogs();
  },

  async addFuelRecord(log: Omit<FuelLog, 'id' | 'createdAt'>): Promise<boolean> {
    try {
      await addFuelLog(log);
      return true;
    } catch (e) {
      console.error('[databaseService] Error adding fuel record:', e);
      return false;
    }
  },

  async deleteFuelRecord(id: string): Promise<boolean> {
    try {
      await deleteFuelLog(id);
      return true;
    } catch (e) {
      console.error('[databaseService] Error deleting fuel record:', e);
      return false;
    }
  },

  // MAINTENANCE RECORDS / MANUTENÇÕES
  async getMaintenanceRecords(): Promise<MaintenanceLog[]> {
    return getMaintenanceLogs();
  },

  async addMaintenanceRecord(log: Omit<MaintenanceLog, 'id'>): Promise<boolean> {
    try {
      await addMaintenance(log);
      return true;
    } catch (e) {
      console.error('[databaseService] Error adding maintenance record:', e);
      return false;
    }
  },

  async updateMaintenanceRecord(id: string, fields: Partial<MaintenanceLog>): Promise<boolean> {
    try {
      await updateMaintenance(id, fields);
      return true;
    } catch (e) {
      console.error('[databaseService] Error updating maintenance record:', e);
      return false;
    }
  },

  async deleteMaintenanceRecord(id: string): Promise<boolean> {
    try {
      await deleteMaintenance(id);
      return true;
    } catch (e) {
      console.error('[databaseService] Error deleting maintenance record:', e);
      return false;
    }
  },

  // GAS STATIONS / POSTOS
  async getGasStations(): Promise<GasStation[]> {
    return getGasStations();
  },

  async addGasStation(station: Omit<GasStation, 'id'>): Promise<boolean> {
    try {
      await addGasStation(station);
      return true;
    } catch (e) {
      console.error('[databaseService] Error adding gas station:', e);
      return false;
    }
  },

  async updateGasStation(id: string, fields: Partial<GasStation>): Promise<boolean> {
    try {
      await updateGasStation(id, fields);
      return true;
    } catch (e) {
      console.error('[databaseService] Error updating gas station:', e);
      return false;
    }
  },

  async deleteGasStation(id: string): Promise<boolean> {
    try {
      await deleteGasStation(id);
      return true;
    } catch (e) {
      console.error('[databaseService] Error deleting gas station:', e);
      return false;
    }
  }
};

