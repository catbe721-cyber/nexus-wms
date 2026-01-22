import React, { useState, useMemo } from 'react';
import { Product, InventoryItem, SavedPickList, getBestLocationScore } from '../types';
import { PackageMinus, CheckCircle, ShoppingCart, Trash2, Plus, AlertCircle, Save, FolderOpen, X } from 'lucide-react';
import ConfirmModal, { ModalType } from './ConfirmModal';

interface OutboundFormProps {
  products: Product[];
  inventory: InventoryItem[];
  savedPickLists: SavedPickList[];
  onProcess: (itemsToRemove: { id: string, qty: number }[]) => void;
  onCancel: () => void;
  onSaveList: (name: string, items: { productCode: string, qty: number }[]) => void;
  onDeleteList: (id: string) => void;
}

interface CartItem {
  product: Product;
  requestQty: number;
}

const OutboundForm: React.FC<OutboundFormProps> = ({
  products,
  inventory,
  onProcess,
  onCancel,
  savedPickLists,
  onSaveList,
  onDeleteList
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [requestQty, setRequestQty] = useState<number>(0);

  // Shopping Cart State
  const [cart, setCart] = useState<CartItem[]>([]);

  // UI State
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [newListName, setNewListName] = useState('');

  // Modal State (Confirmations)
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: ModalType;
    onConfirm?: () => void;
  }>({ isOpen: false, title: '', message: '', type: 'info' });

  // --- Derived State ---

  // 1. Calculate Available Stock (Total - InCart)
  const getProductAvailability = (productCode: string) => {
    const totalPhysical = inventory
      .filter(i => i.productCode === productCode)
      .reduce((acc, i) => acc + i.quantity, 0);

    const inCart = cart
      .filter(c => c.product.code === productCode)
      .reduce((acc, c) => acc + c.requestQty, 0);

    return Math.max(0, totalPhysical - inCart);
  };

  const currentAvailable = selectedProduct ? getProductAvailability(selectedProduct.code) : 0;

  // 2. Generate the "Pick Plan" (The precise breakdown of WHICH items to remove)
  const pickPlan = useMemo(() => {
    const plan: {
      product: Product,
      breakdown: { item: InventoryItem, takeQty: number }[],
      fulfilled: number,
      requested: number
    }[] = [];

    cart.forEach(cartItem => {
      // Find matching physical items, sorted by priority (FIFO/Location)
      const auditItems = inventory
        .filter(i => i.productCode === cartItem.product.code)
        .sort((a, b) => getBestLocationScore(a.locations) - getBestLocationScore(b.locations));

      let remaining = cartItem.requestQty;
      const breakdown: { item: InventoryItem, takeQty: number }[] = [];

      for (const item of auditItems) {
        if (remaining <= 0) break;
        const take = Math.min(item.quantity, remaining);
        if (take > 0) {
          breakdown.push({ item, takeQty: take });
          remaining -= take;
        }
      }

      plan.push({
        product: cartItem.product,
        breakdown,
        fulfilled: cartItem.requestQty - remaining,
        requested: cartItem.requestQty
      });
    });

    return plan;
  }, [cart, inventory]);

  // 3. Filtered Products (Prioritizing Name)
  const filteredProducts = useMemo(() => {
    if (!searchTerm) return [];
    const term = searchTerm.toLowerCase();
    return products
      .filter(p => p.code.toLowerCase().includes(term) || p.name.toLowerCase().includes(term))
      .sort((a, b) => {
        const aName = a.name.toLowerCase();
        const bName = b.name.toLowerCase();
        // Priority 1: Name starts with term
        if (aName.startsWith(term) && !bName.startsWith(term)) return -1;
        if (!aName.startsWith(term) && bName.startsWith(term)) return 1;
        // Priority 2: Code starts with term
        const aCode = a.code.toLowerCase();
        const bCode = b.code.toLowerCase();
        if (aCode.startsWith(term) && !bCode.startsWith(term)) return -1;
        if (!aCode.startsWith(term) && bCode.startsWith(term)) return 1;
        return 0; // Default filter order
      })
      .slice(0, 10);
  }, [searchTerm, products]);


  // --- Handlers ---

  const handleSelectProduct = (product: Product) => {
    setSelectedProduct(product);
    setSearchTerm(`${product.name}`); // Display Name
    setRequestQty(0);
  };

  const handleAddToCart = () => {
    if (!selectedProduct || requestQty <= 0) return;

    if (requestQty > currentAvailable) {
      setModalConfig({ isOpen: true, title: 'Insufficient Stock', message: `Only ${currentAvailable} available.`, type: 'danger' });
      return;
    }

    // Add to cart (Merge if exists, or add new)
    setCart(prev => {
      const existing = prev.find(c => c.product.code === selectedProduct.code);
      if (existing) {
        return prev.map(c => c.product.code === selectedProduct.code ? { ...c, requestQty: c.requestQty + requestQty } : c);
      }
      return [...prev, { product: selectedProduct, requestQty }];
    });

    // Reset Input
    setSelectedProduct(null);
    setSearchTerm('');
    setRequestQty(0);
  };

  const handleRemoveFromCart = (index: number) => {
    setCart(prev => prev.filter((_, i) => i !== index));
  };

  const handleProcessOutbound = () => {
    // Flatten the pick plan
    const flatList: { id: string, qty: number }[] = [];
    pickPlan.forEach(p => {
      p.breakdown.forEach(b => {
        const existing = flatList.find(x => x.id === b.item.id);
        if (existing) {
          existing.qty += b.takeQty;
        } else {
          flatList.push({ id: b.item.id, qty: b.takeQty });
        }
      });
    });
    onProcess(flatList);
  };

  const handleSaveList = () => {
    if (!newListName.trim()) return;
    const items = cart.map(c => ({ productCode: c.product.code, qty: c.requestQty }));
    onSaveList(newListName, items);
    setShowSaveModal(false);
    setNewListName('');
  };

  const handleLoadList = (list: SavedPickList) => {
    // Convert Saved List items to CartItems
    // We need to look up the Product object for each code
    const newCart: CartItem[] = [];
    list.items.forEach(item => {
      const product = products.find(p => p.code === item.productCode);
      if (product) {
        newCart.push({ product, requestQty: item.qty });
      }
    });

    setCart(newCart);
    setShowLoadModal(false);
  };

  return (
    <div className="bg-slate-900/60 backdrop-blur-md rounded-xl shadow-[0_0_15px_rgba(0,0,0,0.5)] border border-white/10 p-6 max-w-5xl mx-auto flex flex-col h-[calc(100vh-140px)] animate-in fade-in slide-in-from-bottom-4 duration-300 relative">

      {/* Header */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/10 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="bg-primary/20 p-2 rounded-lg border border-primary/50 shadow-[0_0_10px_rgba(139,92,246,0.3)]">
            <PackageMinus className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white font-display uppercase tracking-wider">Outbound Pick List</h2>
            <p className="text-slate-400 text-sm">Build a list of items to ship. System auto-allocates stock.</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 flex-1 overflow-hidden">

        {/* Left: Item Selector */}
        <div className="w-full lg:w-1/3 flex flex-col gap-4 bg-slate-800/30 p-4 rounded-xl border border-white/5">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-slate-300 uppercase tracking-wider text-sm flex items-center gap-2">
              <Plus className="w-4 h-4" /> Add Item
            </h3>
            <button
              onClick={() => setShowLoadModal(true)}
              className="text-xs text-primary hover:text-primary-400 flex items-center gap-1 font-bold"
            >
              <FolderOpen className="w-3 h-3" /> Load Saved List
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                // Clear selection if user types something new
                if (selectedProduct && e.target.value !== selectedProduct.name) {
                  setSelectedProduct(null);
                }
              }}
              placeholder="Search Product Name or Code..."
              className="w-full px-4 py-2 border border-white/10 bg-black/40 text-slate-100 rounded-lg focus:ring-2 focus:ring-primary outline-none"
              autoFocus
            />
            {searchTerm && !selectedProduct && filteredProducts.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl max-h-64 overflow-y-auto">
                {filteredProducts.map(p => (
                  <div
                    key={p.id}
                    onClick={() => handleSelectProduct(p)}
                    className="px-4 py-3 hover:bg-slate-800 cursor-pointer border-b border-slate-800 last:border-0"
                  >
                    <span className="font-bold text-slate-200 block text-md">{p.name}</span>
                    <span className="text-slate-500 text-xs font-mono">{p.code}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quantity & Info */}
          {selectedProduct && (
            <div className="animate-in fade-in space-y-4">
              <div className="p-3 bg-white/5 rounded-lg border border-white/5">
                <p className="text-xs text-slate-500 uppercase font-bold mb-1">Available Stock</p>
                <div className="flex items-baseline gap-2">
                  <p className={`text-3xl font-bold font-mono ${currentAvailable === 0 ? 'text-red-500' : 'text-green-400'}`}>
                    {currentAvailable}
                  </p>
                  <span className="text-sm text-slate-400 font-bold">{selectedProduct.defaultUnit}</span>
                </div>
                <div className="mt-1 text-xs text-slate-500 font-mono">
                  {selectedProduct.code}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Quantity to Pick</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="1"
                    max={currentAvailable}
                    value={requestQty}
                    onChange={(e) => setRequestQty(parseInt(e.target.value) || 0)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddToCart()}
                    className="flex-1 px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-white font-bold outline-none focus:border-primary"
                  />
                  <button
                    onClick={handleAddToCart}
                    disabled={requestQty <= 0 || requestQty > currentAvailable}
                    className="bg-primary hover:bg-primary/80 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 rounded-lg font-bold flex items-center gap-2"
                  >
                    <Plus className="w-5 h-5" /> Add
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right: Cart & Review */}
        <div className="w-full lg:w-2/3 flex flex-col bg-black/20 rounded-xl border border-white/5 overflow-hidden">
          {/* Cart Header */}
          <div className="p-4 bg-white/5 border-b border-white/5 flex justify-between items-center">
            <h3 className="font-bold text-white flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-primary" />
              Current Pick List
              <span className="bg-primary/20 text-primary text-xs px-2 py-0.5 rounded-full">{cart.length} items</span>
            </h3>
            <div className="flex items-center gap-2">
              {cart.length > 0 && (
                <>
                  <button
                    onClick={() => setShowSaveModal(true)}
                    className="flex items-center gap-1 text-xs bg-slate-700 hover:bg-slate-600 text-white px-2 py-1 rounded transition-colors"
                  >
                    <Save className="w-3 h-3" /> Save List
                  </button>
                  <button onClick={() => setCart([])} className="text-xs text-red-400 hover:text-red-300 px-2">Clear</button>
                </>
              )}
            </div>
          </div>

          {/* Cart List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 opacity-50">
                <ShoppingCart className="w-12 h-12 mb-2" />
                <p>List is empty</p>
              </div>
            ) : (
              cart.map((c, idx) => (
                <div key={idx} className="bg-slate-800/40 p-3 rounded-lg border border-white/5 flex items-center justify-between group hover:border-primary/30 transition-colors">
                  <div>
                    <p className="font-bold text-slate-200">{c.product.name}</p>
                    <p className="text-xs text-slate-500 font-mono">{c.product.code}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="1"
                        max={getProductAvailability(c.product.code) + c.requestQty} // Allow editing up to total available + what's already in this cart slot
                        value={c.requestQty}
                        onChange={(e) => {
                          const newQty = parseInt(e.target.value) || 0;
                          // Use functional update to avoid stale closure issues if checking availability strictly
                          setCart(prev => prev.map((item, i) => i === idx ? { ...item, requestQty: newQty } : item));
                        }}
                        className="w-20 px-2 py-1 bg-black/40 border border-white/10 rounded text-center font-bold text-white outline-none focus:border-primary"
                      />
                      <span className="text-xs text-slate-500 font-normal">{c.product.defaultUnit}</span>
                    </div>
                    <button onClick={() => handleRemoveFromCart(idx)} className="p-2 hover:bg-red-500/20 text-slate-500 hover:text-red-400 rounded transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer Actions */}
          <div className="p-4 border-t border-white/5 bg-slate-900/50 backdrop-blur flex justify-between items-center">
            <button onClick={onCancel} className="text-slate-400 hover:text-white font-bold">Cancel</button>
            <button
              onClick={() => {
                if (cart.length > 0) {
                  setModalConfig({
                    isOpen: true,
                    title: 'Confirm Outbound',
                    message: `Process ${cart.length} items for shipping? Stock will be deducted automatically.`,
                    type: 'confirm',
                    onConfirm: handleProcessOutbound
                  });
                }
              }}
              disabled={cart.length === 0}
              className="bg-green-500 hover:bg-green-600 disabled:opacity-50 disabled:grayscale text-white px-8 py-3 rounded-lg font-bold shadow-lg shadow-green-500/20 flex items-center gap-2 transition-all"
            >
              <CheckCircle className="w-5 h-5" /> Process Outbound
            </button>
          </div>
        </div>
      </div>

      {/* Save List Modal */}
      {showSaveModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-white/10 p-6 rounded-xl shadow-2xl w-full max-w-md animate-in zoom-in-95">
            <h3 className="text-xl font-bold text-white mb-4">Save Pick List</h3>
            <input
              autoFocus
              type="text"
              placeholder="List Name (e.g., 'Weekly Sushi Restock')"
              value={newListName}
              onChange={e => setNewListName(e.target.value)}
              className="w-full px-4 py-2 bg-black/40 border border-white/10 rounded-lg text-white mb-4 focus:ring-2 focus:ring-primary outline-none"
            />
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowSaveModal(false)} className="px-4 py-2 text-slate-400 hover:text-white">Cancel</button>
              <button
                onClick={handleSaveList}
                disabled={!newListName.trim()}
                className="px-4 py-2 bg-primary hover:bg-primary/80 text-white rounded-lg font-bold disabled:opacity-50"
              >
                Save List
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Load List Modal */}
      {showLoadModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-white/10 rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[80vh] animate-in zoom-in-95">
            <div className="p-6 border-b border-white/10 flex justify-between items-center">
              <h3 className="text-xl font-bold text-white">Load Saved List</h3>
              <button onClick={() => setShowLoadModal(false)} className="text-slate-400 hover:text-white"><X className="w-6 h-6" /></button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 space-y-3">
              {savedPickLists.length === 0 ? (
                <p className="text-center text-slate-500 py-8">No saved lists found.</p>
              ) : (
                savedPickLists.map(list => (
                  <div key={list.id} className="bg-slate-800/50 p-4 rounded-lg border border-white/5 flex items-center justify-between hover:border-primary/30 group">
                    <div>
                      <p className="font-bold text-white text-lg">{list.name}</p>
                      <p className="text-slate-500 text-sm">{list.items.length} items • {new Date(list.createdAt).toLocaleDateString()}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleLoadList(list)}
                        className="px-3 py-1.5 bg-primary/20 hover:bg-primary/30 text-primary rounded-lg text-sm font-bold border border-primary/20"
                      >
                        Load
                      </button>
                      <button
                        onClick={() => onDeleteList(list.id)}
                        className="p-2 text-slate-600 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

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