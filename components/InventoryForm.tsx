import React, { useState, useEffect, useMemo } from 'react';
import { Product, InventoryItem, InventoryLocation, MasterLocation } from '../types';
import { X, CheckCircle, Save, MapPin, Lock } from 'lucide-react';
import ConfirmModal, { ModalType } from './ConfirmModal';

interface InventoryFormProps {
  products: Product[];
  masterLocations?: MasterLocation[]; // Now optional but recommended
  initialData?: InventoryItem | null;
  onSave: (item: Omit<InventoryItem, 'id' | 'updatedAt'>) => void;
  onCancel: () => void;
}

const InventoryForm: React.FC<InventoryFormProps> = ({ products, masterLocations = [], initialData, onSave, onCancel }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState<number>(0);
  const [unit, setUnit] = useState('pcs');
  const [category, setCategory] = useState<string>('OTH');
  const [locations, setLocations] = useState<InventoryLocation[]>([]);

  // Location Search State
  const [locationSearch, setLocationSearch] = useState('');
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);

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
      const product = products.find(p => p.code === initialData.productCode) || {
        id: initialData.productId,
        code: initialData.productCode,
        name: initialData.productName,
        defaultCategory: initialData.category,
        defaultUnit: initialData.unit
      } as Product;

      setSelectedProduct(product);
      setSearchTerm(`${initialData.productCode} - ${initialData.productName}`);
      setQuantity(initialData.quantity);
      setUnit(initialData.unit);
      setCategory(initialData.category);
      setLocations(initialData.locations);
    }
  }, [initialData, products]);

  // Filter products based on search
  const filteredProducts = products.filter(p =>
    p.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  ).slice(0, 10);

  // Filter Locations Logic
  const filteredLocations = useMemo(() => {
    if (!locationSearch) return [];

    // Normalize search term: remove non-alphanumeric to match "A11" against "A-1-1"
    const cleanSearch = locationSearch.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

    return masterLocations.filter(loc => {
      // Create search keys
      const cleanCode = loc.code.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      const shortHand = `${loc.rack.toLowerCase()}${loc.bay}${loc.level.toLowerCase()}`; // e.g. a11

      return cleanCode.includes(cleanSearch) ||
        shortHand.includes(cleanSearch) ||
        loc.code.toLowerCase().includes(locationSearch.toLowerCase());
    }).slice(0, 8);
  }, [locationSearch, masterLocations]);

  const handleSelectProduct = (product: Product) => {
    setSelectedProduct(product);
    setSearchTerm(`${product.code} - ${product.name}`);
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

    // Auto-assign to Staging if no location provided
    const finalLocations = locations.length > 0
      ? locations
      : [{ rack: 'STG', bay: 1, level: 'Floor' }];

    onSave({
      productId: selectedProduct.id,
      productCode: selectedProduct.code,
      productName: selectedProduct.name,
      quantity,
      unit,
      category,
      locations: finalLocations
    });
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-300 relative">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-slate-800">
          {initialData ? 'Edit Inventory Record' : 'Record Inbound Inventory'}
        </h2>
        {initialData && (
          <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2 py-1 rounded border border-amber-200">
            Editing Mode
          </span>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* Product Search */}
        <div className="relative">
          <label className="block text-sm font-medium text-slate-700 mb-1">Product Search (Code or Name)</label>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              if (selectedProduct && e.target.value !== `${selectedProduct.code} - ${selectedProduct.name}`) {
                setSelectedProduct(null); // Reset selection if typing new search
              }
            }}
            placeholder="Search by code or name..."
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
            disabled={!!initialData}
          />
          {initialData && <p className="text-xs text-slate-400 mt-1">Product cannot be changed when editing.</p>}

          {/* Autocomplete Dropdown */}
          {searchTerm && !selectedProduct && filteredProducts.length > 0 && !initialData && (
            <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {filteredProducts.map(p => (
                <div
                  key={p.id}
                  onClick={() => handleSelectProduct(p)}
                  className="px-4 py-2 hover:bg-slate-50 cursor-pointer border-b border-slate-50 last:border-0"
                >
                  <span className="font-bold text-slate-800">{p.name}</span>
                  <br />
                  <span className="text-xs text-slate-400">{p.code}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="col-span-2 md:col-span-1">
            <label className="block text-sm font-medium text-slate-700 mb-1">Quantity</label>
            <input
              type="number"
              min="0"
              value={quantity}
              onChange={(e) => setQuantity(parseFloat(e.target.value))}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="col-span-1">
            <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-1">
              Unit <Lock className="w-3 h-3 text-slate-400" />
            </label>
            <input
              type="text"
              value={unit}
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
              value={category}
              readOnly
              className="w-full px-4 py-2 border border-slate-200 bg-slate-100 text-slate-500 rounded-lg focus:outline-none cursor-not-allowed"
            />
          </div>
        </div>

        {selectedProduct && selectedProduct.postingGroup && (
          <div className="text-xs text-slate-500 bg-slate-50 p-2 rounded border">
            Posting Group: <span className="font-medium">{selectedProduct.postingGroup}</span>
          </div>
        )}

        {/* Location Manager */}
        <div className="border rounded-lg p-4 bg-slate-50">
          <div className="flex justify-between items-center mb-3">
            <label className="block text-sm font-bold text-slate-800">Bin (Storage)</label>
            <span className="text-xs text-slate-400 italic">Leave empty to assign to Staging Area</span>
          </div>

          <div className="relative mb-4">
            <div className="flex items-center border rounded-lg bg-white overflow-hidden focus-within:ring-2 focus-within:ring-primary">
              <div className="pl-3 text-slate-400"><MapPin className="w-4 h-4" /></div>
              <input
                type="text"
                value={locationSearch}
                onChange={(e) => {
                  setLocationSearch(e.target.value);
                  setShowLocationDropdown(true);
                }}
                onFocus={() => setShowLocationDropdown(true)}
                placeholder="Search bin (e.g. type 'A11' for A-01-1)..."
                className="w-full px-3 py-2 outline-none text-sm"
              />
              {locationSearch && (
                <button type="button" onClick={() => setLocationSearch('')} className="p-2 text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Location Dropdown */}
            {showLocationDropdown && locationSearch && filteredLocations.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {filteredLocations.map(loc => (
                  <div
                    key={loc.id}
                    onClick={() => handleAddLocation(loc)}
                    className="px-4 py-2 hover:bg-slate-50 cursor-pointer border-b border-slate-50 last:border-0 flex justify-between items-center"
                  >
                    <span className="font-bold text-slate-800 font-mono">{loc.code}</span>
                    <span className="text-xs text-slate-400">Rack {loc.rack} • Bay {loc.bay} • Level {loc.level}</span>
                  </div>
                ))}
              </div>
            )}
            {showLocationDropdown && locationSearch && filteredLocations.length === 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg p-4 text-center text-slate-500 text-sm">
                No matching bins found.
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {locations.length === 0 && <span className="text-sm text-slate-400 italic">No specific bins selected. Will default to Staging.</span>}
            {locations.map((loc, idx) => (
              <div key={idx} className={`border rounded-full px-3 py-1 text-sm flex items-center gap-2 shadow-sm ${loc.rack === 'STG' ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-white border-slate-300 text-slate-700'}`}>
                <span className="font-bold">
                  {`${loc.rack}-${loc.bay}-${loc.level}`}
                </span>
                <button type="button" onClick={() => handleRemoveLocation(idx)} className="text-red-500 hover:text-red-700">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-2 rounded-lg text-slate-600 hover:bg-slate-100 font-medium"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-6 py-2 rounded-lg bg-primary text-white hover:bg-blue-700 font-medium flex items-center gap-2 shadow-lg shadow-blue-500/30"
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