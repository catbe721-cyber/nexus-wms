import React from 'react';
import { InventoryItem, Transaction, Product } from '../types';
import { AlertTriangle, Tag, Boxes, Users } from 'lucide-react';
import { getCategoryColor } from '../utils';
import DashboardCharts from './DashboardCharts';

interface DashboardProps {
    inventory: InventoryItem[];
    inventorySummary: any[]; // Or specific type
    products: Product[];
    lowStockItems: any[];
    topMovers: any[];
    deadStock: any[];
    transactions: Transaction[];
}

const DashboardPage: React.FC<DashboardProps> = ({
    inventory,
    inventorySummary,
    products,
    lowStockItems,
    topMovers,
    deadStock,
    transactions
}) => {
    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-10">
            <div className="flex justify-between items-end">
                <h2 className="text-3xl font-bold text-white font-display tracking-tight">Command Center</h2>
            </div>

            {/* Alerts Section */}
            {lowStockItems.length > 0 && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 shadow-[0_0_20px_rgba(239,68,68,0.1)] relative overflow-hidden group">
                    <div className="absolute inset-0 bg-red-500/5 group-hover:bg-red-500/10 transition-colors"></div>
                    <h3 className="text-red-400 font-bold text-xl flex items-center gap-2 mb-4 font-display relative z-10">
                        <AlertTriangle className="w-6 h-6" /> Critical Warnings
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 relative z-10">
                        {lowStockItems.map(item => (
                            <div key={item.productCode} className="bg-slate-900/60 p-4 rounded-lg border border-red-500/20 shadow-sm flex flex-col justify-between hover:border-red-500/50 transition-colors backdrop-blur-md">
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex-1">
                                        <span className="font-bold text-slate-200 block truncate text-lg">{item.name}</span>
                                        <span className="text-xs text-slate-500 font-mono tracking-wider">{item.productCode}</span>
                                    </div>
                                    <span className="bg-red-500/20 text-red-400 text-[10px] uppercase font-bold px-2 py-1 rounded border border-red-500/20">
                                        Critical
                                    </span>
                                </div>
                                <div className="flex justify-between items-end border-t border-white/5 pt-2 mt-1">
                                    <div className="text-xs text-slate-500 uppercase tracking-widest">Stock Level</div>
                                    <div className="text-red-400 font-bold font-mono text-lg">
                                        {item.qty} <span className="text-xs font-normal text-slate-600">/ {item.minStockLevel} {item.unit}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-900/60 p-6 rounded-xl border border-white/10 hover:border-accent/50 transition-all backdrop-blur-md group shadow-[0_0_15px_rgba(0,0,0,0.3)]">
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mb-1 group-hover:text-accent transition-colors">Products</p>
                    <p className="text-4xl font-bold text-white font-display">{inventorySummary.length}</p>
                </div>
                <div className="bg-slate-900/60 p-6 rounded-xl border border-white/10 hover:border-red-500/50 transition-all backdrop-blur-md group shadow-[0_0_15px_rgba(0,0,0,0.3)]">
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mb-1 group-hover:text-red-400 transition-colors">Low Stock</p>
                    <p className="text-4xl font-bold text-red-400 font-display">
                        {lowStockItems.length}
                    </p>
                </div>
                <div className="bg-slate-900/60 p-6 rounded-xl border border-white/10 hover:border-blue-500/50 transition-all backdrop-blur-md group shadow-[0_0_15px_rgba(0,0,0,0.3)]">
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mb-1 group-hover:text-blue-400 transition-colors">Occupied Slots</p>
                    <p className="text-4xl font-bold text-blue-400 font-display">
                        {inventory.reduce((acc, i) => acc + i.locations.length, 0)}
                    </p>
                </div>
            </div>

            {/* VISUALIZATIONS */}
            <DashboardCharts
                inventory={inventory}
                transactions={transactions}
                products={products}
                topMovers={topMovers}
                deadStock={deadStock}
            />
        </div>
    );
};

export default DashboardPage;
