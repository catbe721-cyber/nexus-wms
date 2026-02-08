
// Warehouse Configuration Constants

export const BAYS_PER_RACK = 12;
export const LEVELS = ['3', '2', '1', 'Floor'] as const;

export const STANDARD_RACKS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J'] as const;

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

    // Transit Area (T), 5 Bays, 5 Levels
    'T': {
        bays: 5,
        levels: ['5', '4', '3', '2', '1']
    },

    // Standard Racks (A-J)
    ...Object.fromEntries(STANDARD_RACKS.map(r => [r, { bays: BAYS_PER_RACK, levels: LEVELS }])),
};

export const ALL_AREAS = Object.keys(AREA_CONFIG);
