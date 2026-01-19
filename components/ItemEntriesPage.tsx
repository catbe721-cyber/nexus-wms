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
    switch(type) {
        case 'INBOUND': return 'bg-green-100 text-green-700 border-green-200';
        case 'OUTBOUND': return 'bg-orange-100 text-orange-700 border-orange-200';
        case 'ADJUSTMENT': return 'bg-blue-100 text-blue-700 border-blue-200';
        default: return 'bg-slate-100 text-slate-700';
    }
  };

  const getTypeIcon = (type: string) => {
    switch(type) {
        case 'INBOUND': return <ArrowDownLeft className="w-4 h-4" />;
        case 'OUTBOUND': return <ArrowUpRight className="w-4 h-4" />;
        default: return <RefreshCw className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-3">
                <div className="bg-slate-100 p-2 rounded-lg">
                    <ClipboardList className="w-6 h-6 text-slate-600" />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-slate-800">Item Entries</h2>
                    <p className="text-sm text-slate-500">Historical log of all inventory movements. Read-only.</p>
                </div>
            </div>
        </div>

        <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input 
                type="text" 
                placeholder="Filter by product, type..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
            />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-xs uppercase font-medium text-slate-500 border-b">
                    <tr>
                        <th className="px-6 py-3">Date</th>
                        <th className="px-6 py-3">Type</th>
                        <th className="px-6 py-3">Item</th>
                        <th className="px-6 py-3">Category</th>
                        <th className="px-6 py-3 text-right">Qty</th>
                        <th className="px-6 py-3 text-right">Balance</th>
                        <th className="px-6 py-3">Location Log</th>
                        <th className="px-6 py-3">Notes</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {filteredTransactions.map((t) => (
                        <tr key={t.id} className="hover:bg-slate-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                                <div className="font-medium text-slate-700">{new Date(t.date).toLocaleDateString()}</div>
                                <div className="text-xs text-slate-400">{new Date(t.date).toLocaleTimeString()}</div>
                            </td>
                            <td className="px-6 py-4">
                                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold border ${getTypeStyle(t.type)}`}>
                                    {getTypeIcon(t.type)}
                                    {t.type}
                                </span>
                            </td>
                            <td className="px-6 py-4">
                                <div className="font-medium text-slate-900 text-base">{t.productName}</div>
                                <div className="text-xs text-slate-400 font-mono mt-0.5">{t.productCode}</div>
                            </td>
                            <td className="px-6 py-4">
                                <span className="px-2 py-1 bg-slate-100 rounded text-xs text-slate-600 font-medium">
                                    {t.category}
                                </span>
                            </td>
                            <td className="px-6 py-4 text-right font-mono">
                                <span className={t.quantity > 0 ? 'text-green-600 font-bold' : 'text-orange-600 font-bold'}>
                                    {t.quantity > 0 ? '+' : ''}{t.quantity}
                                </span>
                                <span className="text-xs text-slate-400 ml-1">{t.unit}</span>
                            </td>
                            <td className="px-6 py-4 text-right font-mono text-slate-800 font-bold bg-slate-50/50">
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
                            <td colSpan={8} className="p-10 text-center text-slate-400">
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