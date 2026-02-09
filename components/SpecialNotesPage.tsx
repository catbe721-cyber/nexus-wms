import React, { useState } from 'react';
import { Transaction } from '../types';
import { MessageSquare, ArrowDownLeft, ArrowUpRight, Search, RefreshCw, ArrowRightLeft, Trash2, ClipboardCheck, X } from 'lucide-react';

interface SpecialNotesPageProps {
    transactions: Transaction[];
}

const SpecialNotesPage: React.FC<SpecialNotesPageProps> = ({ transactions }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    // Filter for transactions with "Special" notes
    // We exclude the standard auto-generated system notes
    const specialNotes = transactions.filter(t => {
        const note = t.notes || '';
        if (!note) return false;

        // Exclude system messages
        const isSystem = note === 'System Entry' ||
            note === 'Manual Adjustment via Map' ||
            note === 'Cycle Count verified' ||
            note.startsWith('Moved:');

        if (isSystem) return false;

        // Apply Search
        const searchLower = searchTerm.toLowerCase();
        const matchesSearch = (
            t.productName.toLowerCase().includes(searchLower) ||
            t.productCode.toLowerCase().includes(searchLower) ||
            note.toLowerCase().includes(searchLower)
        );

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

        return matchesSearch && matchesDate;
    }).sort((a, b) => b.date - a.date); // Newest first

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
                            <MessageSquare className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white font-display uppercase tracking-wider">Special Notes Log</h2>
                            <p className="text-sm text-slate-400">Viewing flagged transactions with remarks (Vendor POs, Special Instructions, etc.)</p>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                    <div className="relative w-full md:w-96">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500 w-4 h-4" />
                        <input
                            type="text"
                            placeholder="Search notes, products..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 text-sm border border-white/10 bg-black/40 rounded-lg text-slate-200 placeholder-slate-600 focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                        />
                    </div>

                    <div className="flex items-center gap-2">
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="bg-slate-800 border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-primary outline-none"
                            placeholder="Start Date"
                        />
                        <span className="text-slate-500">-</span>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="bg-slate-800 border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-primary outline-none"
                            placeholder="End Date"
                        />

                        {(searchTerm || startDate || endDate) && (
                            <button
                                onClick={() => {
                                    setSearchTerm('');
                                    setStartDate('');
                                    setEndDate('');
                                }}
                                className="p-2 text-slate-400 hover:text-white transition-colors ml-2"
                                title="Clear Filters"
                            >
                                <X className="w-5 h-5" />
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
                                <th className="px-6 py-4 w-1/3">Note / Remark</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {specialNotes.map((t) => (
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
                                    <td className="px-6 py-4">
                                        <div className="bg-yellow-500/10 border border-yellow-500/20 p-3 rounded-lg text-yellow-200 font-medium">
                                            {t.notes}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {specialNotes.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="p-10 text-center text-slate-500">
                                        No special notes found. Records with system-generated logs are hidden.
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

export default SpecialNotesPage;
