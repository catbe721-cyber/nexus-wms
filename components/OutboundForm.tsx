import React, { useState, useEffect } from 'react';
import { Product, InventoryItem, getBestLocationScore } from '../types';
import { PackageMinus, CheckCircle, Lock, AlertTriangle } from 'lucide-react';
import ConfirmModal, { ModalType } from './ConfirmModal';

interface OutboundFormProps {
  products: Product[];
  inventory: InventoryItem[];
  // Updated signature to support bulk items
  onProcess: (itemsToRemove: { id: string, qty: number }[]) => void;
  onCancel: () => void;
}

const OutboundForm: React.FC<OutboundFormProps> = ({ products, inventory, onProcess, onCancel }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // The user's desired total, used for auto-fill
  const [targetTotal, setTargetTotal] = useState<number>(0);

  // The actual specific pick plan: matches inventory items to quantity to remove
  const [pickPlan, setPickPlan] = useState<Record<string, number>>({});

  // Available inventory items for selected product (sorted)
  const [sortedItems, setSortedItems] = useState<InventoryItem[]>([]);

  // Modal State
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: ModalType;
    onConfirm?: () => void;
  }>({ isOpen: false, title: '', message: '', type: 'info' });

  const showAlert = (title: string, message: string, type: ModalType = 'info') => {
    setModalConfig({ isOpen: true, title, message, type });
  };

  // Calculate total currently selected in plan
  const currentPlanTotal = Object.values(pickPlan).reduce((acc, q) => acc + q, 0);

  // Total physically available
  const totalAvailable = sortedItems.reduce((acc, i) => acc + i.quantity, 0);

  // --- Handlers ---

  const handleSelectProduct = (product: Product) => {
    setSelectedProduct(product);
    setSearchTerm(`${product.code} - ${product.name}`);
    setTargetTotal(0);
    setPickPlan({});

    // Find and Sort Items
    const items = inventory.filter(i => i.productCode === product.code);
    const sorted = [...items].sort((a, b) => getBestLocationScore(a.locations) - getBestLocationScore(b.locations));
    setSortedItems(sorted);
  };

  // Auto-Fill Logic (The "Core" requirement)
  const handleAutoFill = (amount: number) => {
    let remaining = amount;
    const newPlan: Record<string, number> = {};

    sortedItems.forEach(item => {
      if (remaining <= 0) {
        newPlan[item.id] = 0;
        return;
      }

      const take = Math.min(item.quantity, remaining);
      newPlan[item.id] = take;
      remaining -= take;
    });

    // If we couldn't fill the request (insufficient stock), fill what we can
    setPickPlan(newPlan);
    setTargetTotal(amount); // Keep user input even if capped?
  };

  const handlePlanChange = (itemId: string, val: number) => {
    const item = sortedItems.find(i => i.id === itemId);
    if (!item) return;

    const max = item.quantity;
    const safeVal = Math.min(Math.max(0, val), max);

    setPickPlan(prev => ({
      ...prev,
      [itemId]: safeVal
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;

    if (currentPlanTotal <= 0) {
      showAlert("Invalid Quantity", "Please select items to remove.", 'danger');
      return;
    }

    // Convert plan to array
    const result = Object.entries(pickPlan)
      .filter(([_, qty]) => qty > 0)
      .map(([id, qty]) => ({ id, qty }));

    onProcess(result);
  };

  const filteredProducts = products.filter(p =>
    p.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  ).slice(0, 10);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-300 relative">
      <div className="flex items-center gap-3 mb-6 pb-4 border-b">
        <div className="bg-red-50 p-2 rounded-lg">
          <PackageMinus className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Outbound Picking</h2>
          <p className="text-slate-500 text-sm">Select inventory source bins</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Product Selection */}
        <div className="relative">
          <label className="block text-sm font-medium text-slate-700 mb-1">Product Search</label>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              if (selectedProduct && e.target.value !== `${selectedProduct.code} - ${selectedProduct.name}`) {
                setSelectedProduct(null);
                setSortedItems([]);
                setPickPlan({});
              }
            }}
            placeholder="Search by code or name..."
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
          />
          {searchTerm && !selectedProduct && filteredProducts.length > 0 && (
            <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {filteredProducts.map(p => (
                <div
                  key={p.id}
                  onClick={() => handleSelectProduct(p)}
                  className="px-4 py-2 hover:bg-slate-50 cursor-pointer border-b border-slate-50 last:border-0"
                >
                  <span className="font-bold text-slate-800">{p.code}</span>
                  <span className="text-slate-500 ml-2">{p.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {selectedProduct && (
          <div className="animate-in fade-in duration-500 space-y-6">

            {/* Planner Header */}
            <div className="flex flex-col md:flex-row gap-6 items-start md:items-center bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div className="flex-1">
                <p className="text-sm text-slate-500">Total Available</p>
                <p className="text-2xl font-bold text-slate-800">{totalAvailable} <span className="text-sm font-normal text-slate-500">{selectedProduct.defaultUnit}</span></p>
              </div>

              <div className="flex-1">
                <label className="block text-sm font-medium text-slate-700 mb-1">Auto-Fill Qty</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="0"
                    max={totalAvailable}
                    value={targetTotal}
                    onChange={(e) => handleAutoFill(parseInt(e.target.value) || 0)}
                    className="w-32 px-3 py-1.5 border border-slate-300 rounded-md font-bold text-center"
                  />
                  <button
                    type="button"
                    onClick={() => handleAutoFill(totalAvailable)}
                    className="text-xs bg-slate-200 hover:bg-slate-300 px-3 rounded font-bold text-slate-600"
                  >
                    MAX
                  </button>
                </div>
              </div>

              <div className="flex-1 text-right">
                <p className="text-sm text-slate-500">Pick Total</p>
                <p className={`text-3xl font-bold ${currentPlanTotal === targetTotal ? 'text-primary' : 'text-orange-500'}`}>
                  {currentPlanTotal}
                </p>
              </div>
            </div>

            {/* Picking Table */}
            <div>
              <h3 className="font-bold text-slate-800 mb-2 flex items-center justify-between">
                <span>Picking Plan</span>
                <span className="text-xs font-normal text-slate-500">Priority: STG &rarr; ADJ &rarr; Floor &rarr; Lv1 &rarr; Lv2</span>
              </h3>

              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100 text-slate-600">
                    <tr>
                      <th className="px-4 py-2 text-left">Priority</th>
                      <th className="px-4 py-2 text-left">Location</th>
                      <th className="px-4 py-2 text-right">Available</th>
                      <th className="px-4 py-2 text-right w-32">Pick Qty</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {sortedItems.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-slate-400">No stock available for this product.</td>
                      </tr>
                    ) : (
                      sortedItems.map((item, idx) => (
                        <tr key={item.id} className={pickPlan[item.id] > 0 ? 'bg-red-50' : 'hover:bg-slate-50'}>
                          <td className="px-4 py-3 text-slate-400 font-mono">#{idx + 1}</td>
                          <td className="px-4 py-3 font-bold text-slate-700">
                            {item.locations.map(l => `${l.rack}-${l.bay}-${l.level}`).join(', ')}
                            {item.locations.some(l => l.rack === 'STG') && <span className="ml-2 px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[10px] rounded uppercase font-bold">STG</span>}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-600">{item.quantity}</td>
                          <td className="px-4 py-3 text-right">
                            <input
                              type="number"
                              min="0"
                              max={item.quantity}
                              value={pickPlan[item.id] || 0}
                              onChange={(e) => handlePlanChange(item.id, parseInt(e.target.value) || 0)}
                              className={`w-full text-right px-2 py-1 rounded border focus:ring-2 outline-none font-bold ${pickPlan[item.id] > 0 ? 'border-primary text-primary bg-white' : 'border-slate-200 text-slate-400'}`}
                            />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <button type="button" onClick={onCancel} className="px-6 py-2 rounded-lg text-slate-600 hover:bg-slate-100 font-medium">Cancel</button>
              <button
                type="submit"
                disabled={currentPlanTotal <= 0}
                className="px-6 py-2 rounded-lg bg-primary text-white hover:bg-red-700 font-bold flex items-center gap-2 shadow-lg shadow-red-500/30 disabled:opacity-50 disabled:cursor-not-allowed uppercase text-sm tracking-wide"
              >
                <CheckCircle className="w-5 h-5" /> Confirm Picking ({currentPlanTotal})
              </button>
            </div>

          </div>
        )}
      </form>

      <ConfirmModal
        isOpen={modalConfig.isOpen}
        onClose={() => setModalConfig(prev => ({ ...prev, isOpen: false }))}
        onConfirm={modalConfig.onConfirm}
        title={modalConfig.title}
        message={modalConfig.message}
        type={modalConfig.type}
      />
    </div>
  );
};

export default OutboundForm;