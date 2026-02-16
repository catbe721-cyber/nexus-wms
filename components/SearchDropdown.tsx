import React, { useMemo } from 'react';
import { Product, InventoryItem } from '../types';
import { smartSearch, getEmbedLink } from '../utils';

interface SearchDropdownProps {
    mapSearch: string;
    products: Product[];
    inventory: InventoryItem[];
    onSelect: (productName: string) => void;
}

const SearchDropdown: React.FC<SearchDropdownProps> = ({ mapSearch, products, inventory, onSelect }) => {

    // Search Dropdown Data Logic (Modified for new component structure)
    const searchResults = useMemo(() => {
        if (!mapSearch) return [];

        const matches: { product: Product, areas: string[] }[] = [];
        const productsFound = products.filter(p => smartSearch(p, ['productCode', 'name'], mapSearch));

        for (const p of productsFound) {
            if (matches.length >= 8) break;

            const items = inventory.filter(i => i.productCode === p.productCode);
            if (items.length === 0) continue; // Hide if out of stock

            const uniqueLocs = new Set<string>();
            items.flatMap(i => i.locations).forEach(l => {
                let name = l.rack;
                if (l.rack === 'S') name = 'Staging';
                else if (l.rack === 'R') name = 'Reserve';
                else if (l.rack === 'Z') name = 'Zone';
                else if (l.rack === 'T') name = 'Transit';
                else if (l.rack.length === 1) {
                    // Include Level for Standard Racks
                    const lv = l.level === 'Floor' ? 'Lv Floor' : `Lv ${l.level}`;
                    name = `Rack ${l.rack} ${lv}`;
                }
                uniqueLocs.add(name);
            });

            const areas = Array.from(uniqueLocs).sort();

            matches.push({
                product: p,
                areas: Array.from(new Set(areas)).sort()
            });
        }

        return matches;
    }, [mapSearch, products, inventory]);

    if (!mapSearch || searchResults.length === 0) return null;

    return (
        <div className="absolute z-50 w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg shadow-xl max-h-60 overflow-y-auto right-0 min-w-[300px]">
            {searchResults.map(({ product: p, areas }) => (
                <div
                    key={p.productCode}
                    onClick={() => onSelect(p.name)}
                    className="px-4 py-2 hover:bg-slate-800 cursor-pointer border-b border-slate-800 last:border-0"
                >
                    <div className="flex items-center gap-3">
                        {p.image && (
                            <div className="w-8 h-8 rounded bg-slate-800 border border-white/10 overflow-hidden flex-shrink-0 flex items-center justify-center">
                                <img src={getEmbedLink(p.image)} alt={p.name} className="w-full h-full object-contain" />
                            </div>
                        )}
                        <div className="flex-1">
                            <div className="font-bold text-slate-200 text-sm">{p.name}</div>
                            <div className="text-xs text-slate-500">{p.productCode}</div>
                        </div>
                    </div>
                    {areas.length > 0 && (
                        <div className="mt-1 text-xs text-amber-500/80 font-mono pl-11">
                            In: {areas.join(', ')}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
};

export default SearchDropdown;
