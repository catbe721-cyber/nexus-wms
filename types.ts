
export const DEFAULT_ITEM_CATEGORIES = ['RTE', 'RAW', 'FG', 'WIP', 'PKG', 'OTH'];

export type UserRole = 'ADMIN' | 'MANAGER' | 'OPERATOR' | 'AUDITOR' | 'LOGISTICS';

export const ROLES: Record<UserRole, { label: string, description: string }> = {
  ADMIN: { label: 'System Admin', description: 'Full System Access' },
  MANAGER: { label: 'Warehouse Mgr', description: 'Operations Lead' },
  OPERATOR: { label: 'Floor Operator', description: 'Inbound/Outbound' },
  AUDITOR: { label: 'Inventory Auditor', description: 'Read-Only / QC' },
  LOGISTICS: { label: 'Logistics Partner', description: 'View Only' }
};

export interface Product {
  id: string;
  code: string;
  name: string;
  defaultCategory?: string;
  postingGroup?: string;
  defaultUnit?: string;
  minStockLevel?: number;
}

export interface InventoryLocation {
  rack: string; // A-H, J, STG, ADJ
  bay: number;  
  level: string; 
}

export interface MasterLocation {
  id: string;
  code: string; // e.g. "A-01-1"
  name?: string; // Optional alias
  rack: string;
  bay: number;
  level: string;
}

export interface InventoryItem {
  id: string;
  productId: string;
  productName: string; // Denormalized for easier display
  productCode: string;
  quantity: number;
  unit: string;
  category: string;
  locations: InventoryLocation[];
  notes?: string;
  updatedAt: number;
}

export interface Transaction {
  id: string;
  date: number;
  type: 'INBOUND' | 'OUTBOUND' | 'ADJUSTMENT';
  productCode: string;
  productName: string;
  category: string;
  quantity: number; // Positive for IN, Negative for OUT/Loss
  unit: string;
  locationInfo: string; // Human readable location string
  user?: string;
  notes?: string;
}

export const STANDARD_RACKS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J'];

// Define Area Dimensions
export const AREA_CONFIG: Record<string, { bays: number, levels: string[] }> = {
    // Special Areas (Priority Order)
    'STG': { bays: 18, levels: Array.from({length: 12}, (_, i) => String(12 - i)) }, // 12 down to 1
    'ADJ': { bays: 5, levels: ['5', '4', '3', '2', '1'] },

    // Standard Racks: 12 Bays, 4 Levels
    ...Object.fromEntries(STANDARD_RACKS.map(r => [r, { bays: 12, levels: ['3', '2', '1', 'Floor'] }])),
};

export const ALL_AREAS = Object.keys(AREA_CONFIG);
export const BAYS_PER_RACK = 12; // Legacy fallback
export const LEVELS = ['3', '2', '1', 'Floor']; // Legacy fallback

export type ViewState = 'dashboard' | 'entry' | 'outbound' | 'list' | 'history' | 'map' | 'products' | 'settings';

// Utility for safe ID generation
export const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    try {
      return crypto.randomUUID();
    } catch (e) {
      // Fallback
    }
  }
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
};