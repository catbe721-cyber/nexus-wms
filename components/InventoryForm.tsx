import React, { useState, useEffect, useMemo } from 'react';
import { Product, InventoryItem, MasterLocation, InventoryLocation, generateId } from '../types';
import { AREA_CONFIG, LEVELS, BAYS_PER_RACK } from '../consts/warehouse';
import { smartSearch, filterBinCodes, getEmbedLink } from '../utils';
import { X, CheckCircle, Save, MapPin, Lock, Check } from 'lucide-react';
import ConfirmModal, { ModalType } from './ConfirmModal';

interface InventoryFormProps {
  products: Product[];
  inventory?: InventoryItem[]; // Added for auto-bin logic
  masterLocations?: MasterLocation[]; // Now optional but recommended
  initialData?: InventoryItem | null;
  onSave: (item: Omit<InventoryItem, 'id' | 'updatedAt'>) => void;
  onCancel: () => void;
}

const InventoryForm: React.FC<InventoryFormProps> = ({ products, inventory = [], masterLocations = [], initialData, onSave, onCancel }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState<string>('');
  const [unit, setUnit] = useState<string>('');
  // const [expandedImage, setExpandedImage] = useState<string | null | undefined>(null); // Removed per user request
  const [category, setCategory] = useState<string>('OTH');
  const [inboundType, setInboundType] = useState<string>('Purchase');
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]); // Default to Today
  const [notes, setNotes] = useState<string>('');
  const [locations, setLocations] = useState<InventoryLocation[]>([]);

  // Location Search State
  const [locationSearch, setLocationSearch] = useState('');
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Modal State
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: ModalType;
  }>({ isOpen: false, title: '', message: '', type: 'info' });

  const showAlert = (title: string, message: string, type: ModalType = 'info') => {
    setModalConfig({ isOpen: true, title, message, type });
  };


  // Initialize form if initialData is provided (Edit Mode)
  useEffect(() => {
    if (initialData) {
      const product = products.find(p => p.productCode === initialData.productCode) || {
        productCode: initialData.productCode,
        name: initialData.productName,
        defaultCategory: initialData.category,
        defaultUnit: initialData.unit
      } as Product;

      setSelectedProduct(product);
      setSearchTerm(`${initialData.productCode} - ${initialData.productName} `);
      setQuantity(initialData.quantity);
      setUnit(initialData.unit);
      setCategory(initialData.category);
      setCategory(initialData.category);

      // Parse existing notes for Type tag e.g. [Return] ...
      const existingNote = initialData.notes || '';
      const typeMatch = existingNote.match(/^\[(.*?)\] (.*)$/);
      if (typeMatch) {
        setInboundType(typeMatch[1]);
        setNotes(typeMatch[2]);
      } else {
        setInboundType('Other'); // Default or fallback
        setNotes(existingNote);
      }

      setLocations(initialData.locations);
    }
  }, [initialData, products]);

  // Auto-dismiss success message
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => {
        setSuccessMessage(null);
      }, 3000); // 3 seconds
      return () => clearTimeout(timer);
    }
  }, [successMessage]);


  // Filter products based on search
  const filteredProducts = products.filter(p =>
    smartSearch(p, ['productCode', 'name'], searchTerm)
  ).slice(0, 10);

  // Filter Locations Logic
  const filteredLocations = useMemo(() => {
    if (!locationSearch) return [];

    return filterBinCodes(masterLocations, locationSearch).slice(0, 8);
  }, [locationSearch, masterLocations]);

  const handleSelectProduct = (product: Product) => {
    setSelectedProduct(product);
    setSearchTerm(`${product.productCode} - ${product.name} `);
    if (!initialData) {
      setCategory(product.defaultCategory || 'OTH');
      setUnit(product.defaultUnit || 'pcs');
    }
  };

  const handleAddLocation = (loc: MasterLocation) => {
    // Avoid duplicates
    const exists = locations.some(l =>
      l.rack === loc.rack && l.bay === loc.bay && l.level === loc.level
    );
    if (!exists) {
      setLocations([...locations, { rack: loc.rack, bay: loc.bay, level: loc.level }]);
    }
    setLocationSearch('');
    setShowLocationDropdown(false);
  };

  const handleRemoveLocation = (index: number) => {
    setLocations(locations.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct || quantity <= 0) {
      showAlert("Validation Error", "Please select a product and enter a valid quantity.", 'danger');
      return;
    }

    // Auto-assign Logic
    let finalLocations = locations;

    if (finalLocations.length === 0) {
      // Logic: Find first empty 'T' bin
      // We need to iterate through all possible T bins: T-1-1 to T-5-5
      // Simplest way: Generate all T candidates and find first one not in inventory

      let targetBin: InventoryLocation | null = null;

      // Transit Config: 5 Bays, 5 Levels. 
      // Iterate Bays 1-5, Levels 1-5. 
      // Order: T-1-1, T-1-2 ... T-1-5, T-2-1 ...

      outerLoop:
      for (let b = 1; b <= 5; b++) {
        for (let l = 1; l <= 5; l++) {
          const levelStr = String(l);
          // Check if occupied
          const isOccupied = inventory.some(item =>
            item.locations.some(loc => loc.rack === 'T' && loc.bay === b && loc.level === levelStr)
          );

          if (!isOccupied) {
            targetBin = { rack: 'T', bay: b, level: levelStr };
            break outerLoop;
          }
        }
      }

      // Fallback if all full -> T-1-1
      if (!targetBin) {
        targetBin = { rack: 'T', bay: 1, level: '1' };
      }

      finalLocations = [targetBin];
    }

    onSave({
      productCode: selectedProduct.productCode,
      productName: selectedProduct.name,
      quantity,
      unit,
      category,

      notes: `[${inboundType}] ${notes} `,
      locations: finalLocations,
      // @ts-ignore
      date: new Date(date).getTime()
    });

    // Success State & Reset
    const locString = finalLocations.map(l => `${l.rack} -${l.bay} `).join(', ');
    setSuccessMessage(`Received ${quantity} ${unit} of ${selectedProduct.name} at ${locString} `);

    if (!initialData) {
      // Only reset if it's a new entry (not editing existing)
      setQuantity(0);
      setSelectedProduct(null);
      setSearchTerm('');
      setInboundType('Purchase');
      setNotes('');
      setLocations([]);
    }
  };

  return (
    <div className="bg-slate-900/60 backdrop-blur-md rounded-xl shadow-[0_0_15px_rgba(0,0,0,0.5)] border border-white/10 p-6 max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-300 relative overflow-hidden">

      {/* Success Toast Overlay */}
      {successMessage && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top-4 fade-in duration-300 pointer-events-none w-full flex justify-center">
          <div className="bg-green-500/20 backdrop-blur-md border border-green-500/50 text-green-300 px-6 py-3 rounded-full shadow-[0_0_20px_rgba(34,197,94,0.3)] flex items-center gap-2 font-bold font-display tracking-wide">
            <Check className="w-5 h-5" />
            {successMessage}
          </div>
        </div>
      )}

      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-white font-display uppercase tracking-wide">
          {initialData ? 'Edit Inventory Record' : 'Record Inbound Inventory'}
        </h2>
        {initialData && (
          <span className="bg-amber-500/20 text-amber-400 text-xs font-bold px-2 py-1 rounded border border-amber-500/30">
            Editing Mode
          </span>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* Product Search */}
        <div className="relative">
          <label className="block text-sm font-bold text-slate-400 mb-1 uppercase tracking-wider">Product Search (Code or Name)</label>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              if (selectedProduct && e.target.value !== `${selectedProduct.productCode} - ${selectedProduct.name} `) {
                setSelectedProduct(null); // Reset selection if typing new search
              }
            }}
            placeholder="Search by code or name..."
            className="w-full px-4 py-2 border border-white/10 bg-black/40 text-slate-100 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none placeholder-slate-600"
            disabled={!!initialData}
          />
          {initialData && <p className="text-xs text-slate-500 mt-1">Product cannot be changed when editing.</p>}

          {/* Autocomplete Dropdown */}
          {searchTerm && !selectedProduct && filteredProducts.length > 0 && !initialData && (
            <div className="absolute z-50 w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl max-h-60 overflow-y-auto">
              {filteredProducts.map(p => (
                <div
                  key={p.productCode}
                  onClick={() => handleSelectProduct(p)}
                  className="px-4 py-2 hover:bg-slate-800 cursor-pointer border-b border-slate-800 last:border-0"
                >
                  <div className="flex items-center gap-3">
                    {p.image && (
                      <div className="w-8 h-8 rounded bg-slate-800 border border-white/10 overflow-hidden flex-shrink-0 flex items-center justify-center">
                        <img src={getEmbedLink(p.image)} alt={p.name} className="w-full h-full object-contain" />
                      </div>
                    )}
                    <div>
                      <span className="font-bold text-slate-200">{p.name}</span>
                      <br />
                      <span className="text-xs text-slate-500">{p.productCode}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="col-span-2 md:col-span-1">
            <label className="block text-sm font-bold text-slate-400 mb-1 uppercase tracking-wider">Quantity</label>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              value={quantity}
              onChange={(e) => setQuantity(parseFloat(e.target.value))}
              className="w-full px-4 py-2 border border-white/10 bg-black/40 text-slate-100 rounded-lg focus:ring-2 focus:ring-primary outline-none"
            />
          </div>
          <div className="col-span-1">
            <label className="block text-sm font-bold text-slate-400 mb-1 uppercase tracking-wider flex items-center gap-1">
              Unit <Lock className="w-3 h-3 text-slate-500" />
            </label>
            <input
              type="text"
              value={unit}
              readOnly
              className="w-full px-4 py-2 border border-white/5 bg-white/5 text-slate-500 rounded-lg focus:outline-none cursor-not-allowed"
            />
          </div>
          <div className="col-span-1">
            <label className="block text-sm font-bold text-slate-400 mb-1 uppercase tracking-wider flex items-center gap-1">
              Category <Lock className="w-3 h-3 text-slate-500" />
            </label>
            <input
              type="text"
              value={category}
              readOnly
              className="w-full px-4 py-2 border border-white/5 bg-white/5 text-slate-500 rounded-lg focus:outline-none cursor-not-allowed"
            />
          </div>
        </div>




        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-1">
            <label className="block text-sm font-bold text-slate-400 mb-1 uppercase tracking-wider">Inbound Type</label>
            <select
              value={inboundType}
              onChange={(e) => setInboundType(e.target.value)}
              className="w-full px-4 py-2 border border-white/10 bg-black/40 text-slate-100 rounded-lg focus:ring-2 focus:ring-primary outline-none appearance-none"
            >
              <option value="Purchase">Purchase (PO)</option>
              <option value="Return">Return</option>
              <option value="Internal Transfer">Internal Transfer</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-bold text-slate-400 mb-1 uppercase tracking-wider">Note / Reference</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Enter PO number or details..."
              className="w-full px-4 py-2 border border-white/10 bg-black/40 text-slate-100 rounded-lg focus:ring-2 focus:ring-primary outline-none"
            />
          </div>
        </div>



        {/* Selected Product Image Preview */}
        {
          selectedProduct && selectedProduct.image && (
            <div className="w-full h-48 bg-black/40 rounded-xl border border-white/10 overflow-hidden relative group">
              <img src={getEmbedLink(selectedProduct.image)} alt={selectedProduct.name} className="w-full h-full object-contain p-2" />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2 text-xs text-center text-slate-400">
                Product Reference Image
              </div>
            </div>
          )
        }

        {/* Date Field (Moved) */}
        <div className="flex flex-col gap-1">
          <label className="block text-sm font-bold text-slate-400 mb-1 uppercase tracking-wider">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-1/3 px-3 py-2 bg-transparent text-sm text-slate-300 border border-white/10 rounded-lg outline-none focus:border-primary"
          />
        </div>

        {/* Location Manager */}
        <div className="border border-white/10 rounded-lg p-4 bg-black/20">
          <div className="flex justify-between items-center mb-3">
            <label className="block text-sm font-bold text-slate-300 uppercase tracking-wider">Bin (Storage)</label>
            <span className="text-xs text-slate-500 italic">Leave empty to assign to Staging Area</span>
          </div>

          <div className="relative mb-4">
            <div className="flex items-center border border-white/10 rounded-lg bg-black/40 overflow-hidden focus-within:ring-2 focus-within:ring-primary">
              <div className="pl-3 text-slate-500"><MapPin className="w-4 h-4" /></div>
              <input
                type="text"
                value={locationSearch}
                onChange={(e) => {
                  setLocationSearch(e.target.value);
                  setShowLocationDropdown(true);
                }}
                onFocus={() => setShowLocationDropdown(true)}
                placeholder="Search bin (e.g. type 'A11' for A-01-1)..."
                className="w-full px-3 py-2 outline-none text-sm bg-transparent text-slate-100 placeholder-slate-600"
              />
              {locationSearch && (
                <button type="button" onClick={() => setLocationSearch('')} className="p-2 text-slate-500 hover:text-slate-300">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Location Dropdown */}
            {showLocationDropdown && locationSearch && filteredLocations.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                {filteredLocations.map(loc => (
                  <div
                    key={loc.binCode}
                    onClick={() => handleAddLocation(loc)}
                    className="px-4 py-2 hover:bg-slate-800 cursor-pointer border-b border-slate-800 last:border-0 flex justify-between items-center"
                  >
                    <span className="font-bold text-slate-200 font-mono">{loc.binCode}</span>
                    <span className="text-xs text-slate-500">Rack {loc.rack} • Bay {loc.bay} • Level {loc.level}</span>
                  </div>
                ))}
              </div>
            )}
            {showLocationDropdown && locationSearch && filteredLocations.length === 0 && (
              <div className="absolute z-10 w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg shadow-xl p-4 text-center text-slate-500 text-sm">
                No matching bins found.
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {locations.length === 0 && <span className="text-sm text-slate-500 italic">No specific bins selected. Will auto-assign to next empty <strong>Transit Bin</strong>.</span>}
            {locations.map((loc, idx) => (
              <div key={idx} className={`border rounded-full px-3 py-1 text-sm flex items-center gap-2 shadow-sm ${loc.rack === 'S' || loc.rack.startsWith('STG') ? 'bg-amber-900/30 border-amber-700/50 text-amber-200' : 'bg-slate-800 border-slate-600 text-slate-300'}`}>
                <span className="font-bold font-mono">
                  {`${loc.rack}-${loc.bay}-${loc.level}`}
                </span>
                <button type="button" onClick={() => handleRemoveLocation(idx)} className="text-red-400 hover:text-red-300">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-white/5">
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-2 rounded-lg text-slate-400 hover:bg-white/5 font-medium border border-transparent hover:border-white/10 transition-all"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-6 py-2 rounded-lg bg-primary text-white hover:bg-violet-600 font-medium flex items-center gap-2 shadow-[0_0_15px_rgba(139,92,246,0.5)] border border-primary/50 hover:border-primary transition-all"
          >
            {initialData ? <Save className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
            {initialData ? 'Update Record' : 'Save Record'}
          </button>
        </div>
      </form>

      {/* Validation/Error Modal */}
      <ConfirmModal
        isOpen={modalConfig.isOpen}
        onClose={() => setModalConfig(prev => ({ ...prev, isOpen: false }))}
        title={modalConfig.title}
        message={modalConfig.message}
        type={modalConfig.type}
      />
    </div>
  );
};

export default InventoryForm;