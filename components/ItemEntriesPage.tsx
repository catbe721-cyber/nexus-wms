import React, { useState, useMemo } from 'react';
import { Transaction } from '../types';
import { ClipboardList, ArrowDownLeft, ArrowUpRight, RefreshCw, Search } from 'lucide-react';

interface ItemEntriesPageProps {
    transactions: Transaction[];
}

const ItemEntriesPage: React.FC<ItemEntriesPageProps> = ({ transactions }) => {
    const [searchTerm, setSearchTerm] = useState('');

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
    const filteredTransactions = transactionsWithBalance.filter(t =>
        t.productCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.type.toLowerCase().includes(searchTerm.toLowerCase())
    ).sort((a, b) => b.date - a.date);

    const getTypeStyle = (type: string) => {
        switch (type) {
            case 'INBOUND': return 'bg-green-500/20 text-green-400 border-green-500/30';
            case 'OUTBOUND': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
            case 'ADJUSTMENT': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
            default: return 'bg-slate-800 text-slate-400 border-white/5';
        }
    };

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'INBOUND': return <ArrowDownLeft className="w-4 h-4" />;
            case 'OUTBOUND': return <ArrowUpRight className="w-4 h-4" />;
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

                <div className="relative max-w-md">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500 w-5 h-5" />
                    <input
                        type="text"
                        placeholder="Filter by product, type..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-white/10 bg-black/40 rounded-lg text-slate-200 placeholder-slate-600 focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                    />
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
                                <th className="px-6 py-4">Category</th>
                                <th className="px-6 py-4 text-right">Qty</th>
                                <th className="px-6 py-4 text-right">Balance</th>
                                <th className="px-6 py-4">Location Log</th>
                                <th className="px-6 py-4">Notes</th>
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
                                    <td className="px-6 py-4">
                                        <span className="px-2 py-0.5 bg-slate-800 rounded text-[10px] uppercase font-bold tracking-wide text-slate-400 border border-white/5">
                                            {t.category}
                                        </span>
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
                                    <td className="px-6 py-4 text-xs text-slate-500 italic">
                                        {t.notes || '-'}
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