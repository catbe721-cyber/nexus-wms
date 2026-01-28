import React from 'react';
import { InventoryItem, Transaction, Product } from '../types';
import { AlertTriangle, Tag } from 'lucide-react';
import DashboardCharts from './DashboardCharts';

interface DashboardProps {
    inventory: InventoryItem[];
    inventorySummary: any[]; // Or specific type
    lowStockItems: any[];
    topMovers: any[];
    deadStock: any[];
    transactions: Transaction[];
}

const DashboardPage: React.FC<DashboardProps> = ({
    inventory,
    inventorySummary,
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

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-slate-800/40 p-6 rounded-xl border border-white/5 hover:border-primary/50 transition-all backdrop-blur-md group">
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mb-1 group-hover:text-primary transition-colors">Total Items</p>
                    <p className="text-4xl font-bold text-white font-display">{inventory.reduce((acc, i) => acc + i.quantity, 0).toLocaleString()}</p>
                </div>
                <div className="bg-slate-800/40 p-6 rounded-xl border border-white/5 hover:border-accent/50 transition-all backdrop-blur-md group">
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mb-1 group-hover:text-accent transition-colors">Products</p>
                    <p className="text-4xl font-bold text-white font-display">{inventorySummary.length}</p>
                </div>
                <div className="bg-slate-800/40 p-6 rounded-xl border border-white/5 hover:border-red-500/50 transition-all backdrop-blur-md group">
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mb-1 group-hover:text-red-400 transition-colors">Low Stock</p>
                    <p className="text-4xl font-bold text-red-400 font-display">
                        {lowStockItems.length}
                    </p>
                </div>
                <div className="bg-slate-800/40 p-6 rounded-xl border border-white/5 hover:border-blue-500/50 transition-all backdrop-blur-md group">
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mb-1 group-hover:text-blue-400 transition-colors">Occupied Slots</p>
                    <p className="text-4xl font-bold text-blue-400 font-display">
                        {inventory.reduce((acc, i) => acc + i.locations.length, 0)}
                    </p>
                </div>
            </div>

            {/* VISUALIZATIONS */}
            <DashboardCharts inventory={inventory} transactions={transactions} />

            {/* Advanced Metrics Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                {/* Top Movers */}
                <div className="bg-slate-900/40 p-6 rounded-xl border border-white/5">
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2 font-display">
                        <Tag className="w-5 h-5 text-green-400" /> Top Movers
                    </h3>
                    <div className="space-y-3">
                        {topMovers.length === 0 ? (
                            <p className="text-slate-500 text-sm italic">No outbound data yet.</p>
                        ) : (
                            topMovers.map((item, idx) => (
                                <div key={item.code} className="flex justify-between items-center p-3 bg-slate-800/50 rounded-lg border border-white/5">
                                    <div className="flex items-center gap-3">
                                        <span className="text-slate-500 font-mono text-sm font-bold">#{idx + 1}</span>
                                        <div>
                                            <p className="font-bold text-slate-200 text-sm">{item.name}</p>
                                            <p className="text-xs text-slate-500 font-mono">{item.code}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold text-green-400">{item.qty.toLocaleString()}</p>
                                        <p className="text-[10px] text-slate-500 uppercase">{item.unit}</p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Dead Stock */}
                <div className="bg-slate-900/40 p-6 rounded-xl border border-white/5">
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2 font-display">
                        <AlertTriangle className="w-5 h-5 text-amber-500" /> Stagnant Stock (30d+)
                    </h3>
                    <div className="space-y-3">
                        {deadStock.length === 0 ? (
                            <p className="text-slate-500 text-sm italic">Inventory is moving nicely!</p>
                        ) : (
                            deadStock.map((item) => (
                                <div key={item.id} className="flex justify-between items-center p-3 bg-slate-800/50 rounded-lg border border-white/5">
                                    <div>
                                        <p className="font-bold text-slate-200 text-sm">{item.productName}</p>
                                        <p className="text-xs text-slate-500 font-mono flex gap-2">
                                            <span>{item.productCode}</span>
                                            <span className="text-amber-500/80">• {Math.floor((Date.now() - item.updatedAt) / (1000 * 60 * 60 * 24))}d old</span>
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <div className="bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2 py-1 rounded text-xs font-bold">
                                            {item.locations.map((l: any) => `${l.rack}-${l.bay}`).join(', ')}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DashboardPage;
