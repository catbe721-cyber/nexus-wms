import React, { useState, useMemo } from 'react';
import { Transaction } from '../types';
import { ClipboardList, ArrowDownLeft, ArrowUpRight, RefreshCw, Search, Filter, X, ArrowRightLeft, Trash2, ClipboardCheck } from 'lucide-react';

const TRANSACTION_TYPES = ['INBOUND', 'OUTBOUND', 'MOVE', 'ADJUSTMENT', 'DELETE', 'COUNT'];

interface ItemEntriesPageProps {
    transactions: Transaction[];
}

const ItemEntriesPage: React.FC<ItemEntriesPageProps> = ({ transactions }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const toggleType = (type: string) => {
        setSelectedTypes(prev =>
            prev.includes(type)
                ? prev.filter(t => t !== type)
                : [...prev, type]
        );
    };

    // Calculate balances based on full history to ensure accuracy before filtering
    const transactionsWithBalance = useMemo(() => {
        // 1. Sort chronologically (Oldest first)
        const sorted = [...transactions].sort((a, b) => a.date - b.date);

        // 2. Track running totals per product
        const productBalances: Record<string, number> = {};

        return sorted.map(t => {
            const prevBalance = productBalances[t.productCode] || 0;
            const newBalance = prevBalance + t.quantity;
            productBalances[t.productCode] = newBalance;

            return {
                ...t,
                balanceSnapshot: newBalance
            };
        });
    }, [transactions]);

    // Filter and Sort for Display (Newest first)
    const filteredTransactions = transactionsWithBalance.filter(t => {
        const matchesSearch =
            t.productCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
            t.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            t.type.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesType = selectedTypes.length === 0 || selectedTypes.includes(t.type);

        let matchesDate = true;
        if (startDate) {
            const [y, m, d] = startDate.split('-').map(Number);
            const start = new Date(y, m - 1, d).setHours(0, 0, 0, 0);
            if (t.date < start) matchesDate = false;
        }
        if (endDate && matchesDate) {
            const [y, m, d] = endDate.split('-').map(Number);
            const end = new Date(y, m - 1, d).setHours(23, 59, 59, 999);
            if (t.date > end) matchesDate = false;
        }

        return matchesSearch && matchesType && matchesDate;
    }).sort((a, b) => b.date - a.date);

    const getTypeStyle = (type: string) => {
        switch (type) {
            case 'INBOUND': return 'bg-green-500/20 text-green-400 border-green-500/30';
            case 'OUTBOUND': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
            case 'MOVE': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
            case 'DELETE': return 'bg-red-500/20 text-red-400 border-red-500/30';
            case 'COUNT': return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30';
            case 'ADJUSTMENT': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
            default: return 'bg-slate-800 text-slate-400 border-white/5';
        }
    };

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'INBOUND': return <ArrowDownLeft className="w-4 h-4" />;
            case 'OUTBOUND': return <ArrowUpRight className="w-4 h-4" />;
            case 'MOVE': return <ArrowRightLeft className="w-4 h-4" />;
            case 'DELETE': return <Trash2 className="w-4 h-4" />;
            case 'COUNT': return <ClipboardCheck className="w-4 h-4" />;
            default: return <RefreshCw className="w-4 h-4" />;
        }
    };

    return (
        <div className="space-y-6">
            <div className="bg-slate-900/60 backdrop-blur-md p-6 rounded-xl shadow-[0_0_15px_rgba(0,0,0,0.5)] border border-white/10">
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-3">
                        <div className="bg-primary/20 p-2 rounded-lg border border-primary/50 shadow-[0_0_10px_rgba(139,92,246,0.3)]">
                            <ClipboardList className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white font-display uppercase tracking-wider">Item Entries</h2>
                            <p className="text-sm text-slate-400">Historical log of all inventory movements. Read-only.</p>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                    {/* Type Slicer */}
                    <div className="flex flex-wrap gap-2">
                        {TRANSACTION_TYPES.map(type => {
                            const isSelected = selectedTypes.includes(type);
                            // Determine active color style based on type
                            let activeClass = 'bg-primary text-black border-primary font-bold shadow-[0_0_10px_rgba(139,92,246,0.5)]'; // Default
                            if (isSelected) {
                                if (type === 'INBOUND') activeClass = 'bg-green-500 text-black border-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]';
                                if (type === 'OUTBOUND') activeClass = 'bg-orange-500 text-black border-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.5)]';
                                if (type === 'MOVE') activeClass = 'bg-purple-500 text-white border-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.5)]';
                                if (type === 'DELETE') activeClass = 'bg-red-500 text-white border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]';
                                if (type === 'COUNT') activeClass = 'bg-cyan-500 text-white border-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.5)]';
                            }

                            return (
                                <button
                                    key={type}
                                    onClick={() => toggleType(type)}
                                    className={`
                                        px-3 py-1.5 rounded-full text-xs font-medium transition-all border
                                        ${isSelected
                                            ? activeClass
                                            : 'bg-slate-800 text-slate-400 border-white/5 hover:bg-slate-700 hover:text-white'
                                        }
                                    `}
                                >
                                    {type}
                                </button>
                            );
                        })}
                        {selectedTypes.length > 0 && (
                            <button
                                onClick={() => setSelectedTypes([])}
                                className="px-3 py-1.5 rounded-full text-xs font-medium transition-all text-slate-500 hover:text-white flex items-center gap-1"
                            >
                                <X className="w-3 h-3" /> Clear
                            </button>
                        )}
                    </div>

                    <div className="flex flex-col md:flex-row gap-4 items-center">
                        <div className="relative w-full md:w-64">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500 w-4 h-4" />
                            <input
                                type="text"
                                placeholder="Search history..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 text-sm border border-white/10 bg-black/40 rounded-lg text-slate-200 placeholder-slate-600 focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                            />
                        </div>

                        {/* Date Range Inputs */}
                        <div className="flex items-center gap-2">
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="bg-slate-800 border border-white/10 rounded px-2 py-1.5 text-xs text-white focus:border-primary outline-none"
                                placeholder="Start Date"
                            />
                            <span className="text-slate-500">-</span>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="bg-slate-800 border border-white/10 rounded px-2 py-1.5 text-xs text-white focus:border-primary outline-none"
                                placeholder="End Date"
                            />
                        </div>

                        {(searchTerm || selectedTypes.length > 0 || startDate || endDate) && (
                            <button
                                onClick={() => {
                                    setSearchTerm('');
                                    setSelectedTypes([]);
                                    setStartDate('');
                                    setEndDate('');
                                }}
                                className="p-1.5 text-slate-400 hover:text-white transition-colors"
                                title="Clear Filters"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <div className="bg-slate-900/60 backdrop-blur-md rounded-xl shadow-[0_0_15px_rgba(0,0,0,0.5)] border border-white/10 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-400">
                        <thead className="bg-black/40 text-xs uppercase font-bold text-slate-400 border-b border-white/10 tracking-wider">
                            <tr>
                                <th className="px-6 py-4">Date</th>
                                <th className="px-6 py-4">Type</th>
                                <th className="px-6 py-4">Item</th>
                                <th className="px-6 py-4 text-right">Qty</th>
                                <th className="px-6 py-4 text-right">Balance</th>
                                <th className="px-6 py-4">Location Log</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {filteredTransactions.map((t) => (
                                <tr key={t.id} className="hover:bg-white/5 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="font-medium text-slate-300">{new Date(t.date).toLocaleDateString()}</div>
                                        <div className="text-xs text-slate-500">{new Date(t.date).toLocaleTimeString()}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${getTypeStyle(t.type)}`}>
                                            {getTypeIcon(t.type)}
                                            {t.type}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="font-medium text-slate-200 text-base">{t.productName}</div>
                                        <div className="text-xs text-slate-500 font-mono mt-0.5">{t.productCode}</div>
                                    </td>
                                    <td className="px-6 py-4 text-right font-mono">
                                        <span className={t.quantity > 0 ? 'text-green-400 font-bold' : 'text-orange-400 font-bold'}>
                                            {t.quantity > 0 ? '+' : ''}{t.quantity}
                                        </span>
                                        <span className="text-xs text-slate-500 ml-1">{t.unit}</span>
                                    </td>
                                    <td className="px-6 py-4 text-right font-mono text-white font-bold bg-black/20">
                                        {t.balanceSnapshot}
                                    </td>
                                    <td className="px-6 py-4 text-xs font-mono text-slate-500">
                                        {t.locationInfo}
                                    </td>
                                </tr>
                            ))}
                            {filteredTransactions.length === 0 && (
                                <tr>
                                    <td colSpan={8} className="p-10 text-center text-slate-500">
                                        No records found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default ItemEntriesPage;