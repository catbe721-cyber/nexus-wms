export const DEFAULT_ITEM_CATEGORIES = ['RTE', 'RAW', 'FG', 'WIP', 'PKG', 'OTH'] as const;

export interface Product {
  productCode: string; // Formerly id & code
  name: string;
  defaultCategory?: string;
  postingGroup?: string;
  defaultUnit?: string;
  minStockLevel?: number;
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



// Legacy fallbacks (needed for AREA_CONFIG)
export const BAYS_PER_RACK = 12;
export const LEVELS = ['3', '2', '1', 'Floor'] as const;

export const STANDARD_RACKS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J'] as const;

// Define Area Dimensions
// Define Area Dimensions
export const AREA_CONFIG: Record<string, { bays: number, levels: string[] }> = {
  // Staging Area (S), 11 Bays, Levels 12 down to 1
  'S': {
    bays: 11,
    levels: Array.from({ length: 12 }, (_, i) => String(12 - i))
  },

  // Reserve (formerly Adjustment) (R), 7 Rows (Bays), 4 Bays (Levels)
  'R': {
    bays: 7,
    levels: ['4', '3', '2', '1']
  },

  // Zone (formerly Reserve) (Z), 4 Rows (Bays), 8 Bays (Levels)
  'Z': {
    bays: 4,
    levels: Array.from({ length: 8 }, (_, i) => String(8 - i))
  },

  // Standard Racks (A-J)
  ...Object.fromEntries(STANDARD_RACKS.map(r => [r, { bays: BAYS_PER_RACK, levels: LEVELS }])),
};


export const ALL_AREAS = Object.keys(AREA_CONFIG);


export type ViewState = 'dashboard' | 'entry' | 'outbound' | 'list' | 'history' | 'map' | 'products' | 'move' | 'smart-pick';

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