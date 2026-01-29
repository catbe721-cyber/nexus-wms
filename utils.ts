/**
 * smartSearch
 * 
 * Performs a multi-keyword search where EVERY term in the query must match
 * at least one of the specified fields in the item.
 * 
 * @param item The object to search
 * @param fields The list of fields in the object to search against (e.g. ['name', 'code'])
 * @param query The search query string
 * @returns true if the item matches the query
 */
export const smartSearch = <T>(item: T, fields: (keyof T)[], query: string): boolean => {
    if (!query) return true;

    const terms = query.toLowerCase().split(/\s+/).filter(t => t.length > 0);
    if (terms.length === 0) return true;

    // Every term must be found in at least one of the fields
    return terms.every(term => {
        return fields.some(field => {
            const value = item[field];
            if (typeof value === 'string') {
                return value.toLowerCase().includes(term);
            }
            if (typeof value === 'number') {
                return value.toString().includes(term);
            }
            return false;
        });
    });
};

/**
 * filterBinCodes
 * 
 * Centralized logic for fuzzy searching bin codes.
 * Supports:
 * - Direct matches (G-01-1)
 * - Compressed matches (g011, g11)
 * - Special handling for STG/ADJ to avoid pollution
 */
export const filterBinCodes = (locations: any[], searchTerm: string) => {
    const cleanSearch = searchTerm.trim().toLowerCase();
    const searchNoSpaces = cleanSearch.replace(/\s+/g, '');

    // Specific triggers
    const isStgSearch = cleanSearch.startsWith('s');
    const isAdjSearch = cleanSearch.startsWith('ad');

    return locations.filter(loc => {
        // Defensive checks
        if (!loc || !loc.binCode) return false;

        const rackLower = loc.rack ? loc.rack.toLowerCase() : '';

        // 1. Handling Special Areas (Auto-Legacy Support)
        // If rack is S, R, Z or standard rack, we treat equally now.
        // Old STG/ADJ logic removed to allow flexible searching of new codes.

        // 2. Handling Standard Racks
        // Smart fuzzy matching for "G11" -> "G-01-1"
        const bayNum = loc.bay;
        const bayStr = String(bayNum); // "1", "11"
        const bayPad = String(bayNum).padStart(2, '0'); // "01", "11"
        const levelStr = loc.level ? String(loc.level).toLowerCase() : '';

        const variants = [
            // Standard "Rack-Bay-Level" (G-01-1)
            loc.binCode.toLowerCase(),
            // Shorthand simplified (g011)
            `${rackLower}${bayPad}${levelStr}`,
            // Compact shorthand (g11 -> matches G-01-1)
            `${rackLower}${bayStr}${levelStr}`,
            // Just the components (g11 also in here potentially)
            `${rackLower}${bayStr}`
        ];

        return variants.some(v => v.includes(searchNoSpaces));
    });
};

/**
 * getCategoryColor
 * 
 * Centralized color logic for categories to ensure consistency across the app.
 */
export const getCategoryColor = (cat: string) => {
    const upperCat = cat?.toUpperCase() || '';

    // Standard Categories
    if (upperCat === 'RTE') return 'bg-green-500/20 text-green-400 border border-green-500/30';
    if (upperCat === 'RAW') return 'bg-red-500/20 text-red-400 border border-red-500/30';
    if (upperCat === 'FG') return 'bg-blue-500/20 text-blue-400 border border-blue-500/30';
    if (upperCat === 'WIP') return 'bg-amber-500/20 text-amber-400 border border-amber-500/30';

    // Packaging / Materials
    if (['PKG', 'PIB', 'PBX', 'PFL'].includes(upperCat)) return 'bg-purple-500/20 text-purple-400 border border-purple-500/30';

    // Default
    return 'bg-slate-800 text-slate-400 border border-white/10';
};
