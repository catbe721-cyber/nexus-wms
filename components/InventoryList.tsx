
import React, { useState, useMemo } from 'react';
import { InventoryItem, Product } from '../types';
import { FileText, AlertTriangle, Search, Package, Filter, List } from 'lucide-react';
import { smartSearch, getCategoryColor, getEmbedLink } from '../utils';
import ImageThumbnail from './ImageThumbnail';

interface InventoryListProps {
    inventory: InventoryItem[];
    products: Product[];
}

const InventoryList: React.FC<InventoryListProps> = ({ inventory, products }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<string>('ALL');

    // Derive dynamic categories from products
    const availableCategories = useMemo(() => {
        const categories = new Set(products.map(p => p.defaultCategory).filter(Boolean));
        return Array.from(categories).sort();
    }, [products]);

    // Aggregate logic
    const inventorySummary = React.useMemo(() => {
        const summary: Record<string, {
            productCode: string,
            name: string,
            qty: number,
            unit: string,
            category: string,
            department: string, // Added department
            locations: Set<string>,
            minStock: number,
            image?: string
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
                    department: product?.department || '-', // Derive department
                    locations: new Set(),
                    minStock: product?.minStockLevel || 0,
                    image: product?.image
                };
            }
            summary[item.productCode].qty += item.quantity;
            item.locations.forEach(l => summary[item.productCode].locations.add(`${l.rack}-${l.bay}-${l.level}`));
        });

        return Object.values(summary);
    }, [inventory, products]);

    const filteredItems = inventorySummary.filter(item => {
        const matchesSearch = smartSearch(item, ['productCode', 'name'], searchTerm);
        return matchesSearch;
    });

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

    // --- Image Preview Logic (Fixed Positioning) ---
    // --- Image Preview Logic (Fixed Positioning) ---
    // Refactored to use ImageThumbnail




    return (
        <div className="space-y-6">
            <div className="bg-slate-900/60 backdrop-blur-md p-6 rounded-xl shadow-[0_0_15px_rgba(0,0,0,0.5)] border border-white/10">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                    <div>
                        <h2 className="text-xl font-bold text-white flex items-center gap-2 font-display uppercase tracking-wider">
                            <FileText className="w-6 h-6 text-primary" />
                            Inventory Summary
                        </h2>
                        <p className="text-sm text-slate-400">Aggregated view by product. Click items to see bin breakdown.</p>
                    </div>

                    <div className="flex gap-2 w-full md:w-auto">
                        <div className="text-right">
                            <h2 className="text-xl font-bold text-white flex items-center justify-end gap-2 font-display uppercase tracking-wider">
                                <List className="w-6 h-6 text-primary" />
                                Current Stock
                            </h2>
                            <p className="text-sm text-slate-400">View real-time inventory levels across all bins.</p>
                        </div>
                    </div>
                </div>

                {/* Search - Full Width */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500 w-5 h-5" />
                    <input
                        type="text"
                        placeholder="Search item, code, bin..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-white/10 bg-black/40 rounded-lg text-slate-200 placeholder-slate-600 focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                    />
                </div>
            </div>

            {/* Main Table */}
            <div className="flex-1 min-h-0 bg-slate-900/60 backdrop-blur-md rounded-xl shadow-lg border border-white/10 flex flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-black/40 sticky top-0 z-10 backdrop-blur-md border-b border-white/10">
                            <tr>
                                <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-wider text-xs w-1/4">Product</th>
                                <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-wider text-xs">Category</th>
                                <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-wider text-xs">Dept</th>
                                <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-wider text-xs text-right">Total Qty</th>
                                <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-wider text-xs text-center">Status</th>
                                <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-wider text-xs">Locations Found</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {filteredItems.map(item => {
                                const isLow = item.minStock > 0 && item.qty < item.minStock;
                                const isExpanded = expandedItems.has(item.productCode);
                                const productInventory = inventory.filter(i => i.productCode === item.productCode);

                                return (
                                    <React.Fragment key={item.productCode}>
                                        <tr
                                            onClick={() => toggleExpand(item.productCode)}
                                            className="hover:bg-white/5 transition-colors cursor-pointer group"
                                        >
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <div>
                                                        <div className="font-bold text-slate-200 text-base group-hover:text-primary transition-colors">{item.name}</div>
                                                        <div className="text-xs text-slate-500 font-mono mt-0.5">{item.productCode}</div>
                                                    </div>
                                                    {item.image && (
                                                        <ImageThumbnail src={item.image} alt={item.name} />
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-0.5 rounded text-xs font-bold ${getCategoryColor(item.category)}`}>
                                                    {item.category}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-1 rounded text-[10px] font-bold border ${item.department === 'RTE' ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' : item.department === 'RTC' ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' : 'bg-slate-700/50 text-slate-500 border-white/5'}`}>
                                                    {item.department || 'SHARED'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <span className="text-lg font-bold font-mono text-white">{item.qty}</span>
                                                <span className="text-xs text-slate-500 ml-1">{item.unit}</span>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`px-2 py-1 rounded text-xs font-bold uppercase border ${!isLow
                                                    ? 'bg-green-500/10 text-green-500 border-green-500/20'
                                                    : 'bg-red-500/10 text-red-500 border-red-500/20'
                                                    }`}>
                                                    {!isLow ? 'OK' : 'LOW'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-wrap gap-1">
                                                    {Array.from(item.locations).slice(0, 3).map((loc, i) => (
                                                        <span key={i} className="px-2 py-0.5 bg-white/5 rounded text-xs font-mono text-slate-300 border border-white/10">
                                                            {loc}
                                                        </span>
                                                    ))}
                                                    {item.locations.size > 3 && (
                                                        <span className="px-2 py-0.5 text-xs text-slate-500">+{item.locations.size - 3} more</span>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>

                                        {/* Expanded Detail Row */}
                                        {isExpanded && (
                                            <tr className="bg-black/20 animate-in fade-in slide-in-from-top-2 duration-200">
                                                <td colSpan={4} className="p-4 pl-16">
                                                    <div className="bg-slate-900 rounded-lg border border-white/10 p-4 shadow-inner">
                                                        <h4 className="text-xs font-bold text-slate-400 uppercase mb-3 flex items-center gap-2">
                                                            <Package className="w-3 h-3" /> Location Breakdown
                                                        </h4>
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                                            {productInventory.map((invItem, idx) => (
                                                                <div key={idx} className="flex justify-between items-center p-2 bg-black/40 rounded border border-white/5 hover:border-white/10 transition-colors">
                                                                    <div className="font-mono text-primary font-bold">
                                                                        {invItem.locations.map(l => `${l.rack}-${l.bay}-${l.level}`).join(', ')}
                                                                    </div>
                                                                    <div className="text-right">
                                                                        <div className="text-white font-bold">{invItem.quantity} {item.unit}</div>
                                                                        {(invItem.locations[0]?.rack === 'S' || invItem.locations[0]?.rack.startsWith('STG')) && (
                                                                            <div className="text-[10px] text-amber-500 uppercase">Staging</div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })}

                            {filteredItems.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="p-12 text-center text-slate-500">
                                        <div className="flex flex-col items-center">
                                            <Search className="w-8 h-8 mb-2 opacity-50" />
                                            <p>No inventory items found matching your filter.</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Global Fixed Tooltip */}

        </div >
    );
};

export default InventoryList;