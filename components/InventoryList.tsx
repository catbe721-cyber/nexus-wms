import React, { useState } from 'react';
import { InventoryItem, Product } from '../types';
import { FileText, AlertTriangle, Search, Package } from 'lucide-react';
import { smartSearch } from '../utils';

interface InventoryListProps {
    inventory: InventoryItem[];
    products: Product[];
}

const InventoryList: React.FC<InventoryListProps> = ({ inventory, products }) => {
    const [searchTerm, setSearchTerm] = useState('');

    // Aggregate logic
    const inventorySummary = React.useMemo(() => {
        const summary: Record<string, {
            productCode: string,
            name: string,
            qty: number,
            unit: string,
            category: string,
            locations: Set<string>,
            minStock: number
        }> = {};

        inventory.forEach(item => {
            const product = products.find(p => p.productCode === item.productCode);
            if (!summary[item.productCode]) {
                summary[item.productCode] = {
                    productCode: item.productCode,
                    name: item.productName,
                    qty: 0,
                    unit: item.unit,
                    category: item.category,
                    locations: new Set(),
                    minStock: product?.minStockLevel || 0
                };
            }
            summary[item.productCode].qty += item.quantity;
            item.locations.forEach(l => summary[item.productCode].locations.add(`${l.rack}-${l.bay}-${l.level}`));
        });

        return Object.values(summary);
    }, [inventory, products]);

    const filteredItems = inventorySummary.filter(item =>
        smartSearch(item, ['productCode', 'name', 'category'], searchTerm)
    );

    const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

    const toggleExpand = (code: string) => {
        const newSet = new Set(expandedItems);
        if (newSet.has(code)) {
            newSet.delete(code);
        } else {
            newSet.add(code);
        }
        setExpandedItems(newSet);
    };

    const getCategoryColor = (cat: string) => {
        const upperCat = cat?.toUpperCase() || '';
        if (upperCat === 'RTE') return 'bg-green-500/20 text-green-400 border border-green-500/30';
        if (upperCat === 'RAW') return 'bg-red-500/20 text-red-400 border border-red-500/30';
        if (upperCat === 'FG') return 'bg-blue-500/20 text-blue-400 border border-blue-500/30';
        if (upperCat === 'WIP') return 'bg-amber-500/20 text-amber-400 border border-amber-500/30';
        if (['PKG', 'PIB', 'PBX', 'PFL'].includes(upperCat)) return 'bg-purple-500/20 text-purple-400 border border-purple-500/30';
        return 'bg-slate-800 text-slate-400 border border-white/10';
    };

    return (
        <div className="space-y-6">
            <div className="bg-slate-900/60 backdrop-blur-md p-6 rounded-xl shadow-[0_0_15px_rgba(0,0,0,0.5)] border border-white/10 flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2 font-display uppercase tracking-wider">
                        <FileText className="w-6 h-6 text-primary" />
                        Inventory Summary
                    </h2>
                    <p className="text-sm text-slate-400">Aggregated view by product. Click items to see bin breakdown.</p>
                </div>
                <div className="relative w-full md:w-64">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500 w-4 h-4" />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search inventory..."
                        className="w-full pl-9 pr-4 py-2 border border-white/10 bg-black/40 rounded-lg text-sm text-slate-200 focus:ring-2 focus:ring-primary outline-none placeholder-slate-600"
                    />
                </div>
            </div>

            <div className="bg-slate-900/60 backdrop-blur-md rounded-xl shadow-[0_0_15px_rgba(0,0,0,0.5)] border border-white/10 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-400">
                        <thead className="bg-black/40 text-xs uppercase font-bold text-slate-400 border-b border-white/10 tracking-wider">
                            <tr>
                                <th className="px-6 py-4">Item</th>
                                <th className="px-6 py-4">Category</th>
                                <th className="px-6 py-4 text-right">Total Qty</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4">Locations Found</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {filteredItems.map(item => {
                                const isLow = item.minStock > 0 && item.qty < item.minStock;
                                const isExpanded = expandedItems.has(item.productCode);

                                // Group locations by unique sub-quantities if we want precise counts
                                // We need to re-scan inventory to get detailed breakdown for this product
                                const productInventory = inventory.filter(i => i.productCode === item.productCode);

                                return (
                                    <React.Fragment key={item.productCode}>
                                        <tr
                                            onClick={() => toggleExpand(item.productCode)}
                                            className="hover:bg-white/5 transition-colors cursor-pointer group"
                                        >
                                            <td className="px-6 py-4">
                                                <div className="font-bold text-slate-200 text-base group-hover:text-primary transition-colors">{item.name}</div>
                                                <div className="text-xs text-slate-500 font-mono mt-0.5">{item.productCode}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${getCategoryColor(item.category)}`}>
                                                    {item.category}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <span className="font-bold text-white text-lg font-mono">{item.qty}</span>
                                                <span className="text-xs text-slate-500 ml-1">{item.unit}</span>
                                            </td>
                                            <td className="px-6 py-4">
                                                {isLow ? (
                                                    <span className="inline-flex items-center gap-1 text-red-400 font-bold text-xs bg-red-500/10 border border-red-500/30 px-2 py-1 rounded">
                                                        <AlertTriangle className="w-3 h-3" /> Low Stock
                                                    </span>
                                                ) : (
                                                    <span className="text-green-400 font-bold text-xs bg-green-500/10 border border-green-500/30 px-2 py-1 rounded">OK</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-wrap gap-1">
                                                    {Array.from(item.locations).slice(0, 3).map((loc: string) => (
                                                        <span key={loc} className={`px-2 py-0.5 rounded text-xs border ${loc.startsWith('STG')
                                                            ? 'bg-amber-500/20 text-amber-400 border-amber-500/30 font-bold'
                                                            : 'bg-slate-800 text-slate-400 border-white/5'
                                                            }`}>
                                                            {loc}
                                                        </span>
                                                    ))}
                                                    {item.locations.size > 3 && (
                                                        <span className="px-2 py-0.5 rounded text-xs bg-slate-800 text-slate-400 border border-white/5">
                                                            +{item.locations.size - 3} more
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                        {isExpanded && (
                                            <tr className="bg-slate-900/80">
                                                <td colSpan={5} className="px-6 py-4 shadow-inner">
                                                    <div className="border border-white/10 rounded-lg overflow-hidden">
                                                        <div className="px-4 py-2 bg-black/40 text-xs font-bold text-slate-400 uppercase tracking-wider flex justify-between">
                                                            <span>Bin Location</span>
                                                            <span>Quantity</span>
                                                        </div>
                                                        <div className="divide-y divide-white/5">
                                                            {productInventory.map(invItem => (
                                                                <div key={invItem.id} className="px-4 py-3 flex justify-between items-center bg-slate-800/20 hover:bg-slate-800/40 transition-colors">
                                                                    <div className="flex items-center gap-2">
                                                                        <Package className="w-4 h-4 text-primary/50" />
                                                                        <span className="font-mono text-slate-300 font-bold">
                                                                            {invItem.locations.map(l => `${l.rack}-${l.bay}-${l.level}`).join(', ')}
                                                                        </span>
                                                                        {invItem.locations[0]?.rack.startsWith('STG') && (
                                                                            <span className="text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded border border-amber-500/30">Staging</span>
                                                                        )}
                                                                    </div>
                                                                    <div className="font-mono text-white font-bold">
                                                                        {invItem.quantity} <span className="text-xs text-slate-500 font-normal">{item.unit}</span>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                )
                            })}
                            {filteredItems.length === 0 && (
                                <tr><td colSpan={5} className="p-10 text-center text-slate-500">No records found.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default InventoryList;