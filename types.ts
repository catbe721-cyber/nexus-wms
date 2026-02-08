export const DEFAULT_ITEM_CATEGORIES = [
  'RTE', 'RAW', 'FG', 'WIP', 'PKG', 'OTH',
  'Box', 'Film', 'Tray', 'Sushi', 'Tape', 'Wrap', 'Pallet'
] as const;

export interface Product {
  productCode: string; // Formerly id & code
  name: string;
  defaultCategory?: string;
  defaultUnit?: string;
  minStockLevel?: number;
  image?: string;
  department?: 'RTE' | 'RTC' | 'SHARED';
  updatedAt?: number;
}

export interface InventoryLocation {
  rack: string; // A-H, J, STG, ADJ...
  bay: number;
  level: string;
}

export interface MasterLocation {
  id: string; // Unique ID
  binCode: string; // Formerly code ("A-01-1")
  name?: string; // Optional alias
  rack: string;
  bay: number;
  level: string;
  status?: 'active' | 'disabled'; // New status field
}

export interface InventoryItem {
  id: string; // Unique Batch ID
  // Removed productId
  productName: string; // Denormalized for easier display
  productCode: string; // Link to Product
  quantity: number;
  unit: string;
  category: string;
  locations: InventoryLocation[];
  notes?: string;
  updatedAt: number;
  lastCountedAt?: number; // Cycle Count Timestamp
}

export interface Transaction {
  id: string;
  date: number;
  type: 'INBOUND' | 'OUTBOUND' | 'ADJUSTMENT' | 'MOVE' | 'DELETE' | 'COUNT';
  productCode: string;
  productName: string;
  category: string;
  quantity: number; // Positive for IN, Negative for OUT/Loss
  unit: string;
  locationInfo: string; // Human readable location string
  user?: string;
  notes?: string;
}

export interface SavedPickList {
  id: string;
  name: string;
  items: { productCode: string; qty: number }[];
  createdAt: number;
}



// Warehouse constants moved to consts/warehouse.ts


export type ViewState = 'dashboard' | 'entry' | 'outbound' | 'list' | 'history' | 'map' | 'products' | 'move' | 'smart-pick' | 'notes' | 'analytics';

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

// Priority Calculation Helper
// Logic: STG -> ADJ -> FLOOR -> Level -> BAY -> RACK
export const getBestLocationScore = (locations: InventoryLocation[]) => {
  if (locations.length === 0) return 999999999;

  const scoreLocation = (loc: InventoryLocation) => {
    // 1. Area Priority (STG/S=0, ADJ/R=1, Standard=2)
    let areaScore = 2;
    if (loc.rack === 'S' || loc.rack.startsWith('STG')) areaScore = 0;
    else if (loc.rack === 'R' || loc.rack.startsWith('ADJ')) areaScore = 1;

    // 2. Level Priority (Floor=0, 1=1, 2=2...)
    let levelScore = 0;
    if (loc.level === 'Floor') levelScore = 0;
    else levelScore = parseInt(loc.level) || 99;

    // 3. Bay Priority
    const bayScore = loc.bay;

    // 4. Rack Name Priority (A < B) - Standard Racks Alphabetical
    const rackScore = loc.rack.charCodeAt(0);

    // Weighting: Area >> Level >> Bay >> Rack
    return (areaScore * 100000000) + (levelScore * 1000000) + (bayScore * 1000) + rackScore;
  };

  return Math.min(...locations.map(scoreLocation));
};