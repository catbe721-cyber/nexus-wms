import React, { useState } from 'react';
import { InventoryItem, Product } from '../types';
import { FileText, AlertTriangle, Search, Package } from 'lucide-react';

interface InventoryListProps {
  inventory: InventoryItem[];
  products: Product[];
}

const InventoryList: React.FC<InventoryListProps> = ({ inventory, products }) => {
  const [searchTerm, setSearchTerm] = useState('');

  // Aggregate logic
  const inventorySummary = React.useMemo(() => {
    const summary: Record<string, { 
        code: string, 
        name: string, 
        qty: number, 
        unit: string, 
        category: string,
        locations: Set<string>,
        minStock: number
    }> = {};
    
    inventory.forEach(item => {
      const product = products.find(p => p.code === item.productCode);
      if (!summary[item.productCode]) {
        summary[item.productCode] = {
          code: item.productCode,
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
    item.code.toLowerCase().includes(searchTerm.toLowerCase()) || 
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getCategoryColor = (cat: string) => {
    const upperCat = cat?.toUpperCase() || '';
    if (upperCat === 'RTE') return 'bg-green-100 text-green-700';
    if (upperCat === 'RAW') return 'bg-red-100 text-red-700';
    if (upperCat === 'FG') return 'bg-blue-100 text-blue-700';
    if (upperCat === 'WIP') return 'bg-amber-100 text-amber-700';
    if (['PKG', 'PIB', 'PBX', 'PFL'].includes(upperCat)) return 'bg-purple-100 text-purple-700';
    return 'bg-gray-100 text-gray-700 border border-slate-200';
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <FileText className="w-6 h-6 text-primary" />
                Inventory Summary
            </h2>
            <p className="text-sm text-slate-500">Aggregated view by product. Check "Item Entries" for history.</p>
        </div>
        <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search inventory..."
                className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none"
            />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-xs uppercase font-medium text-slate-500 border-b">
                    <tr>
                        <th className="px-6 py-3">Item</th>
                        <th className="px-6 py-3">Category</th>
                        <th className="px-6 py-3 text-right">Total Qty</th>
                        <th className="px-6 py-3">Status</th>
                        <th className="px-6 py-3">Locations Found</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {filteredItems.map(item => {
                        const isLow = item.minStock > 0 && item.qty < item.minStock;
                        return (
                            <tr key={item.code} className="hover:bg-slate-50">
                                <td className="px-6 py-4">
                                    <div className="font-bold text-slate-800 text-base">{item.name}</div>
                                    <div className="text-xs text-slate-400 font-mono mt-0.5">{item.code}</div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`px-2 py-1 rounded text-xs font-bold ${getCategoryColor(item.category)}`}>
                                        {item.category}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <span className="font-bold text-slate-800">{item.qty}</span>
                                    <span className="text-xs text-slate-400 ml-1">{item.unit}</span>
                                </td>
                                <td className="px-6 py-4">
                                    {isLow ? (
                                        <span className="inline-flex items-center gap-1 text-red-600 font-bold text-xs bg-red-100 px-2 py-1 rounded">
                                            <AlertTriangle className="w-3 h-3" /> Low Stock
                                        </span>
                                    ) : (
                                        <span className="text-green-600 font-bold text-xs bg-green-100 px-2 py-1 rounded">OK</span>
                                    )}
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex flex-wrap gap-1">
                                        {Array.from(item.locations).sort().map((loc: string) => (
                                            <span key={loc} className={`px-2 py-0.5 rounded text-xs border ${
                                                loc.startsWith('STG') 
                                                    ? 'bg-amber-100 text-amber-800 border-amber-200 font-bold' 
                                                    : 'bg-slate-100 text-slate-600 border-slate-200'
                                            }`}>
                                                {loc}
                                            </span>
                                        ))}
                                    </div>
                                </td>
                            </tr>
                        )
                    })}
                    {filteredItems.length === 0 && (
                        <tr><td colSpan={5} className="p-8 text-center text-slate-400">No records found.</td></tr>
                    )}
                </tbody>
            </table>
        </div>
      </div>
    </div>
  );
};

export default InventoryList;