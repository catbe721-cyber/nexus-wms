import React, { useState } from 'react';
import { Product, InventoryItem } from '../types';
import { PackageMinus, CheckCircle, Lock } from 'lucide-react';
import ConfirmModal, { ModalType } from './ConfirmModal';

interface OutboundFormProps {
  products: Product[];
  inventory: InventoryItem[];
  onProcess: (productCode: string, quantity: number) => void;
  onCancel: () => void;
}

const OutboundForm: React.FC<OutboundFormProps> = ({ products, inventory, onProcess, onCancel }) => {
  // Single Mode State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState<number>(0);

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

  // Calculate available stock helper
  const getStock = (code: string) => inventory
    .filter(i => i.productCode === code)
    .reduce((acc, i) => acc + i.quantity, 0);

  // --- Single Mode Logic ---
  const filteredProducts = products.filter(p => 
    p.code.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  ).slice(0, 10);

  const handleSelectProduct = (product: Product) => {
    setSelectedProduct(product);
    setSearchTerm(`${product.code} - ${product.name}`);
    setQuantity(0);
  };

  const handleSingleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;
    const available = getStock(selectedProduct.code);
    
    if (quantity <= 0) {
      showAlert("Invalid Input", "Please enter a valid quantity.", 'danger');
      return;
    }
    if (quantity > available) {
      showAlert("Insufficient Stock", `You only have ${available} available.`, 'danger');
      return;
    }

    onProcess(selectedProduct.code, quantity);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-300 relative">
      <div className="flex items-center gap-3 mb-6 pb-4 border-b">
        <div className="bg-red-50 p-2 rounded-lg">
            <PackageMinus className="w-6 h-6 text-primary" />
        </div>
        <div>
            <h2 className="text-2xl font-bold text-slate-800">Outbound Entry</h2>
            <p className="text-slate-500 text-sm">Remove items from inventory</p>
        </div>
      </div>
      
      <form onSubmit={handleSingleSubmit} className="space-y-6">
          <div className="relative">
            <label className="block text-sm font-medium text-slate-700 mb-1">Product</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                if (selectedProduct && e.target.value !== `${selectedProduct.code} - ${selectedProduct.name}`) {
                  setSelectedProduct(null);
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
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                  <div className="flex justify-between items-center text-sm mb-2">
                      <span className="text-slate-500">Current Stock:</span>
                      <span className="font-bold text-slate-800 text-lg">{getStock(selectedProduct.code)} <span className="text-xs font-normal text-slate-500">{selectedProduct.defaultUnit}</span></span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-1.5">
                      <div className="bg-primary h-1.5 rounded-full" style={{ width: '100%' }}></div>
                  </div>
              </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="col-span-2 md:col-span-1">
                <label className="block text-sm font-medium text-slate-700 mb-1">Quantity</label>
                <input
                  type="number"
                  min="0"
                  max={selectedProduct ? getStock(selectedProduct.code) : 0}
                  value={quantity}
                  onChange={(e) => setQuantity(parseFloat(e.target.value))}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary text-lg font-bold"
                  disabled={!selectedProduct}
                />
            </div>
            <div className="col-span-1">
                <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-1">
                    Unit <Lock className="w-3 h-3 text-slate-400" />
                </label>
                <input 
                    type="text"
                    value={selectedProduct?.defaultUnit || '-'}
                    readOnly
                    className="w-full px-4 py-2 border border-slate-200 bg-slate-100 text-slate-500 rounded-lg focus:outline-none cursor-not-allowed"
                />
            </div>
            <div className="col-span-1">
                <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-1">
                    Category <Lock className="w-3 h-3 text-slate-400" />
                </label>
                <input 
                    type="text"
                    value={selectedProduct?.defaultCategory || '-'}
                    readOnly
                    className="w-full px-4 py-2 border border-slate-200 bg-slate-100 text-slate-500 rounded-lg focus:outline-none cursor-not-allowed"
                />
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            System will automatically deduct from STG -&gt; ADJ -&gt; Floor -&gt; Lv1 -&gt; Lv2.
          </p>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={onCancel} className="px-6 py-2 rounded-lg text-slate-600 hover:bg-slate-100 font-medium">Cancel</button>
            <button 
              type="submit"
              disabled={!selectedProduct || quantity <= 0}
              className="px-6 py-2 rounded-lg bg-primary text-white hover:bg-red-700 font-bold flex items-center gap-2 shadow-lg shadow-red-500/30 disabled:opacity-50 disabled:cursor-not-allowed uppercase text-sm tracking-wide"
            >
              <CheckCircle className="w-5 h-5" /> Process Outbound
            </button>
          </div>
      </form>

      {/* Global Modal */}
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