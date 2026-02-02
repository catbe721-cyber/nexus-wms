import React, { useState, useMemo } from 'react';
import { Product, InventoryItem, SavedPickList, getBestLocationScore } from '../types';
import { PackageMinus, CheckCircle, ShoppingCart, Trash2, Plus, AlertCircle, Save, FolderOpen, X, ScanLine, Image as ImageIcon, Sparkles, Loader2 } from 'lucide-react';
import ConfirmModal, { ModalType } from './ConfirmModal';
import { parsePickList } from '../services/geminiService';
import { smartSearch, getEmbedLink } from '../utils';

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
  const [showScanModal, setShowScanModal] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanImage, setScanImage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Modal State (Confirmations)
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: ModalType;
    onConfirm?: () => void;
  }>({ isOpen: false, title: '', message: '', type: 'info' });

  // Auto-dismiss success message
  React.useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => {
        setSuccessMessage(null);
      }, 3000); // 3 seconds
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  const cartItemsWithValidation = useMemo(() => {
    return cart.map((c, idx) => {
      const totalStock = inventory
        .filter(i => i.productCode === c.product.productCode)
        .reduce((acc, i) => acc + i.quantity, 0);

      const totalRequested = cart
        .filter(item => item.product.productCode === c.product.productCode)
        .reduce((acc, item) => acc + item.requestQty, 0);

      return {
        ...c,
        originalIdx: idx,
        totalStock,
        totalRequested,
        isOverStock: totalRequested > totalStock
      };
    });
  }, [cart, inventory]);

  const hasValidationErrors = useMemo(() => cartItemsWithValidation.some(c => c.isOverStock), [cartItemsWithValidation]);

  // --- Derived State ---

  // 1. Calculate Available Stock (Total - InCart)
  const getProductAvailability = (productCode: string) => {
    const totalPhysical = inventory
      .filter(i => i.productCode === productCode)
      .reduce((acc, i) => acc + i.quantity, 0);

    const inCart = cart
      .filter(c => c.product.productCode === productCode)
      .reduce((acc, c) => acc + c.requestQty, 0);

    return Math.max(0, totalPhysical - inCart);
  };

  const currentAvailable = selectedProduct ? getProductAvailability(selectedProduct.productCode) : 0;

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
        .filter(i => i.productCode === cartItem.product.productCode)
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

  // 3. Filtered Products (Search LIVE INVENTORY, not just Product Master)
  const filteredProducts = useMemo(() => {
    if (!searchTerm) return [];

    const term = searchTerm.toLowerCase();

    // Group inventory by Product Code to show unique options
    // We prioritize the "Product Master" info if it exists, otherwise fall back to Inventory data
    const matches = new Map<string, Product>();

    inventory.forEach(item => {
      // search match?
      // Use smart search for multi-keyword matching
      // We check against both the inventory item fields AND the potential full product details if available
      const matchesSearch = smartSearch(item, ['productCode', 'productName'], term);

      if (matchesSearch) {
        if (!matches.has(item.productCode)) {
          // Try to find full product details
          const masterConfig = products.find(p => p.productCode === item.productCode);
          if (masterConfig) {
            matches.set(item.productCode, masterConfig);
          } else {
            // "Orphan" item - create transient product object
            matches.set(item.productCode, {
              productCode: item.productCode,
              name: item.productName,
              defaultCategory: item.category,
              defaultUnit: item.unit,
              minStockLevel: 0
            });
          }
        }
      }
    });

    return Array.from(matches.values())
      .sort((a, b) => {
        // Sort by name match, then code
        const aName = a.name.toLowerCase();
        const bName = b.name.toLowerCase();
        if (aName.startsWith(term) && !bName.startsWith(term)) return -1;
        if (!aName.startsWith(term) && bName.startsWith(term)) return 1;
        return aName.localeCompare(bName);
      })
      .slice(0, 10);

  }, [searchTerm, products, inventory]);


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
      const existing = prev.find(c => c.product.productCode === selectedProduct.productCode);
      if (existing) {
        return prev.map(c => c.product.productCode === selectedProduct.productCode ? { ...c, requestQty: c.requestQty + requestQty } : c);
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

    // Success notification and Reset
    setSuccessMessage(`Successfully processed ${cart.length} items for shipping.`);
    setCart([]);
  };

  const handleSaveList = () => {
    if (!newListName.trim()) return;
    const items = cart.map(c => ({ productCode: c.product.productCode, qty: c.requestQty }));
    onSaveList(newListName, items);
    setShowSaveModal(false);
    setNewListName('');
  };

  const handleScanImage = async () => {
    if (!scanImage) return;
    setIsScanning(true);

    try {
      const rawScannedItems = await parsePickList(scanImage, products);

      const newScanCart: CartItem[] = [];

      rawScannedItems.forEach((scanned: any) => {
        // Now we trust the AI to have matched the code if possible
        const product = products.find(p => p.productCode === scanned.code);

        if (product && scanned.qty > 0) {
          // Check if product already in newScanCart (duplicate lines in scan)
          const existingIdx = newScanCart.findIndex(c => c.product.productCode === product.productCode);
          if (existingIdx > -1) {
            newScanCart[existingIdx] = {
              ...newScanCart[existingIdx],
              requestQty: newScanCart[existingIdx].requestQty + scanned.qty
            };
          } else {
            newScanCart.push({ product, requestQty: scanned.qty });
          }
        }
      });

      // User requested to CLEAR existing cart before adding scan results
      setCart(newScanCart);

      setShowScanModal(false);
      setScanImage(null);

      setModalConfig({
        isOpen: true,
        title: 'Smart Scan Result',
        message: `Successfully processed the image. Items have been identified and added to your list.`,
        type: 'success'
      });
    } catch (error: any) {
      console.error(error);
      setModalConfig({
        isOpen: true,
        title: 'Scan Error',
        message: error.message || 'Failed to process the pick list. Please ensure your API key is configured.',
        type: 'danger'
      });
    } finally {
      setIsScanning(false);
    }
  };

  const handleLoadList = (list: SavedPickList) => {
    // Convert Saved List items to CartItems
    // We need to look up the Product object for each code
    const newCart: CartItem[] = [];
    list.items.forEach(item => {
      const product = products.find(p => p.productCode === item.productCode);
      if (product) {
        newCart.push({ product, requestQty: item.qty });
      }
    });

    setCart(newCart);
    setShowLoadModal(false);
  };

  return (
    <div className="bg-slate-900/60 backdrop-blur-md rounded-xl shadow-[0_0_15px_rgba(0,0,0,0.5)] border border-white/10 p-6 max-w-5xl mx-auto flex flex-col h-[calc(100vh-140px)] animate-in fade-in slide-in-from-bottom-4 duration-300 relative">

      {/* Success Toast Overlay */}
      {successMessage && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[60] animate-in slide-in-from-top-4 fade-in duration-300 pointer-events-none w-full flex justify-center">
          <div className="bg-green-500/20 backdrop-blur-md border border-green-500/50 text-green-300 px-6 py-3 rounded-full shadow-[0_0_20px_rgba(34,197,94,0.3)] flex items-center gap-2 font-bold font-display tracking-wide">
            <CheckCircle className="w-5 h-5" />
            {successMessage}
          </div>
        </div>
      )}

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
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowScanModal(true)}
                className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 font-bold bg-amber-400/10 px-2 py-1 rounded border border-amber-400/20"
              >
                <ScanLine className="w-3 h-3" /> Smart Scan
              </button>
              <button
                onClick={() => setShowLoadModal(true)}
                className="text-xs text-primary hover:text-primary-400 flex items-center gap-1 font-bold"
              >
                <FolderOpen className="w-3 h-3" /> Load Saved List
              </button>
            </div>
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
                    key={p.productCode}
                    onClick={() => handleSelectProduct(p)}
                    className="px-4 py-3 hover:bg-slate-800 cursor-pointer border-b border-slate-800 last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      {p.image && (
                        <div className="w-10 h-10 rounded bg-slate-800 border border-white/10 overflow-hidden flex-shrink-0 flex items-center justify-center">
                          <img src={getEmbedLink(p.image)} alt={p.name} className="w-full h-full object-contain" />
                        </div>
                      )}
                      <div>
                        <span className="font-bold text-slate-200 block text-md">{p.name}</span>
                        <span className="text-slate-500 text-xs font-mono">{p.productCode}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quantity & Info */}
          {selectedProduct && (
            <div className="animate-in fade-in space-y-4">
              {selectedProduct.image && (
                <div className="w-full h-48 bg-black/40 rounded-xl border border-white/10 overflow-hidden relative group">
                  <img src={getEmbedLink(selectedProduct.image)} alt={selectedProduct.name} className="w-full h-full object-contain p-2" />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2 text-xs text-center text-slate-400">
                    Product Reference Image
                  </div>
                </div>
              )}
              <div className="p-3 bg-white/5 rounded-lg border border-white/5">
                <p className="text-xs text-slate-500 uppercase font-bold mb-1">Available Stock</p>
                <div className="flex items-baseline gap-2">
                  <p className={`text-3xl font-bold font-mono ${currentAvailable === 0 ? 'text-red-500' : 'text-green-400'}`}>
                    {currentAvailable}
                  </p>
                  <span className="text-sm text-slate-400 font-bold">{selectedProduct.defaultUnit}</span>
                </div>
                <div className="mt-1 text-xs text-slate-500 font-mono">
                  {selectedProduct.productCode}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Quantity to Pick</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    inputMode="decimal"
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
              cartItemsWithValidation.map((c, idx) => {
                const { totalStock, isOverStock } = c;

                return (
                  <div key={idx} className={`p-3 rounded-lg border flex items-center justify-between group transition-colors relative ${isOverStock ? 'bg-red-500/10 border-red-500/50 hover:bg-red-500/20' : 'bg-slate-800/40 border-white/5 hover:border-primary/30'}`}>
                    {isOverStock && (
                      <div className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg flex items-center gap-1 z-10">
                        <AlertCircle className="w-3 h-3" />
                        Insufficient Stock (Max {totalStock})
                      </div>
                    )}

                    <div className="flex items-center gap-3">
                      {c.product.image && (
                        <div className="w-10 h-10 rounded bg-black/40 border border-white/10 overflow-hidden flex-shrink-0 flex items-center justify-center">
                          <img src={getEmbedLink(c.product.image)} alt={c.product.name} className="w-full h-full object-contain" />
                        </div>
                      )}
                      <div>
                        <p className={`font-bold ${isOverStock ? 'text-red-300' : 'text-slate-200'}`}>{c.product.name}</p>
                        <p className="text-xs text-slate-500 font-mono">{c.product.productCode}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="1"
                          value={c.requestQty}
                          onChange={(e) => {
                            const newQty = parseInt(e.target.value) || 0;
                            setCart(prev => prev.map((item, i) => i === c.originalIdx ? { ...item, requestQty: newQty } : item));
                          }}
                          className={`w-20 px-2 py-1 bg-black/40 border rounded text-center font-bold outline-none focus:border-primary ${isOverStock ? 'border-red-500/50 text-red-300' : 'border-white/10 text-white'}`}
                        />
                        <span className="text-xs text-slate-500 font-normal">{c.product.defaultUnit}</span>
                      </div>
                      <button onClick={() => handleRemoveFromCart(c.originalIdx)} className="p-2 hover:bg-red-500/20 text-slate-500 hover:text-red-400 rounded transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer Actions */}
          <div className="p-4 border-t border-white/5 bg-slate-900/50 backdrop-blur flex justify-between items-center">
            <button onClick={onCancel} className="text-slate-400 hover:text-white font-bold">Cancel</button>
            <button
              onClick={() => {
                if (cart.length > 0 && !hasValidationErrors) {
                  handleProcessOutbound();
                }
              }}
              disabled={cart.length === 0 || hasValidationErrors}
              className="bg-green-500 hover:bg-green-600 disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed text-white px-8 py-3 rounded-lg font-bold shadow-lg shadow-green-500/20 flex items-center gap-2 transition-all"
            >
              <CheckCircle className="w-5 h-5" /> Process Outbound
            </button>
          </div>
        </div>
      </div>

      {/* Save List Modal */}
      {
        showSaveModal && (
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
        )
      }

      {/* Load List Modal */}
      {
        showLoadModal && (
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
        )
      }
      {/* AI Scan Modal */}
      {
        showScanModal && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
            <div className="bg-slate-900 border border-white/10 rounded-xl shadow-2xl w-full max-w-xl flex flex-col animate-in zoom-in-95 overflow-hidden">
              <div className="p-4 border-b border-white/10 flex justify-between items-center bg-slate-800/50">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-amber-400" />
                  <h3 className="text-lg font-bold text-white font-display uppercase tracking-wider">AI Pick List Scanner</h3>
                </div>
                <button onClick={() => setShowScanModal(false)} className="text-slate-400 hover:text-white"><X className="w-6 h-6" /></button>
              </div>

              <div className="p-8 flex flex-col items-center gap-6">
                {!scanImage ? (
                  <label className="w-full aspect-video border-2 border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center gap-4 hover:border-amber-400/50 hover:bg-amber-400/5 cursor-pointer transition-all group">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (rv) => setScanImage(rv.target?.result as string);
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                    <div className="bg-white/5 p-4 rounded-full group-hover:bg-amber-400/20 group-hover:scale-110 transition-all">
                      <ImageIcon className="w-10 h-10 text-slate-500 group-hover:text-amber-400" />
                    </div>
                    <div className="text-center">
                      <p className="text-white font-bold">Upload Pick List Photo</p>
                      <p className="text-slate-500 text-sm">Drag and drop or click to browse</p>
                    </div>
                  </label>
                ) : (
                  <div className="w-full space-y-4">
                    <div className="relative rounded-xl overflow-hidden border border-white/10 aspect-video bg-black/40">
                      <img src={scanImage} alt="Pick List Scan" className="w-full h-full object-contain" />
                      {isScanning && (
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] flex flex-col items-center justify-center gap-3">
                          <Loader2 className="w-10 h-10 text-amber-400 animate-spin" />
                          <p className="text-amber-400 font-bold animate-pulse">Analyzing Items...</p>
                          <div className="w-48 h-1 bg-white/10 rounded-full overflow-hidden mt-2">
                            <div className="h-full bg-amber-400 animate-[progress_2s_ease-in-out_infinite]"></div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={() => setScanImage(null)}
                        disabled={isScanning}
                        className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-bold transition-all disabled:opacity-50"
                      >
                        Change Image
                      </button>
                      <button
                        onClick={handleScanImage}
                        disabled={isScanning}
                        className="flex-[2] py-3 bg-amber-500 hover:bg-amber-400 text-black rounded-lg font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50"
                      >
                        <Sparkles className="w-5 h-5" /> Process with AI
                      </button>
                    </div>
                  </div>
                )}

                <div className="bg-amber-400/10 p-4 rounded-xl border border-amber-400/20 text-xs text-amber-200/70">
                  <p className="font-bold mb-1 flex items-center gap-1 uppercase tracking-tighter">
                    <AlertCircle className="w-3 h-3" /> Pro Tip
                  </p>
                  Ensure the image is clear and the "Qty" column is visible. The system will match items by name or code and add them to your cart.
                </div>
              </div>
            </div>
          </div>
        )
      }

      <ConfirmModal
        isOpen={modalConfig.isOpen}
        onClose={() => setModalConfig(prev => ({ ...prev, isOpen: false }))}
        onConfirm={modalConfig.onConfirm}
        title={modalConfig.title}
        message={modalConfig.message}
        type={modalConfig.type}
      />
    </div >
  );
};

export default OutboundForm;