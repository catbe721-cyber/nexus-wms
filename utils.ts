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
    if (['BOX', 'PBX'].includes(upperCat)) return 'bg-amber-500/20 text-amber-400 border border-amber-500/30';
    if (['BAG', 'PKG'].includes(upperCat)) return 'bg-blue-500/20 text-blue-400 border border-blue-500/30';
    if (['FILM', 'WRAP'].includes(upperCat)) return 'bg-purple-500/20 text-purple-400 border border-purple-500/30';
    if (['TRAY', 'TAPE'].includes(upperCat)) return 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30';
    if (['PALLET'].includes(upperCat)) return 'bg-stone-500/20 text-stone-400 border border-stone-500/30';

    // Sushi
    if (upperCat.includes('SUSHI')) return 'bg-pink-500/20 text-pink-400 border border-pink-500/30';

    // Default
    return 'bg-slate-800 text-slate-400 border border-white/10';
};

/**
 * Converts a Google Drive share URL into a direct embeddable link.
 * Handles the common 'uc?export=view' format and converts to 'lh3.googleusercontent.com'.
 * 
 * @param url The original image URL
 * @returns A direct link suitable for <img src="..." />
 */
export const getEmbedLink = (url: string | undefined): string | undefined => {
    if (!url) return undefined;

    // Check if it's a Google Drive URL
    if (url.includes('drive.google.com')) {
        // Extract ID from 'id=' parameter
        const idMatch = url.match(/id=([a-zA-Z0-9_-]+)/);
        if (idMatch && idMatch[1]) {
            // Use the thumbnail API which is more reliable for hotlinking
            // sz=w1000 requests a width of 1000px (high quality)
            return `https://drive.google.com/thumbnail?id=${idMatch[1]}&sz=w1000`;
        }

        // Fallback: try extracting from /d/ID/ (view link)
        const pathMatch = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
        if (pathMatch && pathMatch[1]) {
            return `https://drive.google.com/thumbnail?id=${pathMatch[1]}&sz=w1000`;
        }
    }

    return url;
};

/**
 * parseCSV
 * 
 * robust CSV parser that handles quoted strings and comma separation.
 */
export const parseCSV = (text: string) => {
    const lines = text.split('\n');
    const result: string[][] = [];

    for (const line of lines) {
        if (!line.trim()) continue;
        const row: string[] = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                if (inQuotes && line[i + 1] === '"') {
                    current += '"';
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (char === ',' && !inQuotes) {
                row.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        row.push(current.trim());
        if (row.length > 1) result.push(row);
    }
    return result;
};

/**
 * generateCSV
 * 
 * Generates a CSV string from an array of objects/arrays.
 */
export const generateCSV = (headers: string[], data: (string | number)[][]): string => {
    const csvRows = [headers.join(',')];

    for (const row of data) {
        // Escape quotes and wrap in quotes if necessary
        const processedRow = row.map(cell => {
            const str = String(cell || '');
            if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
        });
        csvRows.push(processedRow.join(','));
    }

    return csvRows.join('\n');
};

/**
 * normalizeProduct
 * 
 * Enforces data standards based on product name rules.
 * Automatically extracts Brand, Weight, and Category from the product name.
 */
// @ts-ignore
export const normalizeProduct = (product: any): any => {
    let { name, defaultCategory } = product;
    if (!name) return product;

    const nameLower = name.toLowerCase();

    // Category Rules
    if (nameLower.includes('sushi')) defaultCategory = 'SUSHI';
    else if (name.includes('Bag')) defaultCategory = 'BAG';
    else if (name.includes('Box')) defaultCategory = 'BOX';
    else if (nameLower.includes('film')) defaultCategory = 'FILM';
    else if (name.includes('Tray')) defaultCategory = 'TRAY';

    return { ...product, defaultCategory };
};

/**
 * getAreaName
 * 
 * Returns the display name for a given area/rack code.
 */
export const getAreaName = (code: string) => {
    if (code === 'S') return 'Staging (S)';
    if (code === 'R') return 'Reserve (R)';
    if (code === 'Z') return 'Zone (Z)';
    return code;
};
