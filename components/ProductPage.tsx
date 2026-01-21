import React, { useState, useRef, useMemo } from 'react';
import { Product, generateId } from '../types';
import { Plus, Upload, Trash2, Edit, Save, X, Search, Boxes, AlertTriangle } from 'lucide-react';
import ConfirmModal, { ModalType } from './ConfirmModal';

interface ProductPageProps {
  products: Product[];
  onUpdateProducts: (products: Product[]) => void;
}

const ProductPage: React.FC<ProductPageProps> = ({ products, onUpdateProducts }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Form State
  const [formData, setFormData] = useState<Partial<Product>>({
    code: '',
    name: '',
    defaultCategory: '',
    postingGroup: '',
    defaultUnit: '',
    minStockLevel: 0
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Modal State
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: ModalType;
    onConfirm?: () => void;
  }>({ isOpen: false, title: '', message: '', type: 'info' });

  const showAlert = (title: string, message: string) => {
    setModalConfig({ isOpen: true, title, message, type: 'info' });
  };

  const showConfirm = (title: string, message: string, onConfirm: () => void, type: ModalType = 'confirm') => {
    setModalConfig({ isOpen: true, title, message, type, onConfirm });
  };

  // Derive unique lists for autocomplete suggestions
  const existingCategories = useMemo(() =>
    Array.from(new Set(products.map(p => p.defaultCategory).filter(Boolean))) as string[],
    [products]);

  const existingUnits = useMemo(() =>
    Array.from(new Set(products.map(p => p.defaultUnit).filter(Boolean))) as string[],
    [products]);

  // --- CSV Logic ---
  const parseCSVLine = (text: string) => {
    const lines = text.split('\n');
    const result: string[][] = [];

    for (const line of lines) {
      if (!line.trim()) continue;
      const row: string[] = [];
      let current = '';
      let inQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          if (inQuotes && line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === ',' && !inQuotes) {
          row.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      row.push(current.trim());
      if (row.length > 1) result.push(row);
    }
    return result;
  };

  const handleProductUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const text = evt.target?.result as string;
          const rows = parseCSVLine(text);
          const newProducts: Product[] = [];

          const startIndex = rows[0]?.[0]?.toLowerCase().includes('no.') ? 1 : 0;

          for (let i = startIndex; i < rows.length; i++) {
            const row = rows[i];
            if (row.length < 2) continue;

            const code = row[0];
            const name = row[1];

            const existing = products.find(p => p.code === code);

            if (code && name) {
              newProducts.push({
                id: existing?.id || generateId(),
                code,
                name,
                defaultCategory: row[4] || 'OTH',
                postingGroup: row[5] || '',
                defaultUnit: row[7] || 'pcs',
                minStockLevel: existing?.minStockLevel || 0
              });
            }
          }

          if (newProducts.length > 0) {
            const codesInImport = new Set(newProducts.map(p => p.code));
            const productsToKeep = products.filter(p => !codesInImport.has(p.code));
            onUpdateProducts([...productsToKeep, ...newProducts]);
            showAlert("Success", `Successfully processed ${newProducts.length} products.`);
          }
        } catch (err) {
          console.error(err);
          showAlert("Error", 'Failed to parse file. Please ensure standard CSV format.');
        }
      };
      reader.readAsText(file);
    }
  };

  // --- CRUD Logic ---
  const handleOpenModal = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setFormData(product);
    } else {
      setEditingProduct(null);
      setFormData({
        code: '',
        name: '',
        defaultCategory: '',
        postingGroup: '',
        defaultUnit: '',
        minStockLevel: 0
      });
    }
    setIsModalOpen(true);
  };

  const handleDelete = (id: string, code: string) => {
    showConfirm(
      "Delete Product",
      `Are you sure you want to delete product '${code}'?`,
      () => onUpdateProducts(products.filter(p => p.id !== id)),
      'danger'
    );
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.code || !formData.name) {
      showAlert("Validation Error", "Code and Name are required.");
      return;
    }

    // Check Duplicate Code
    const isDuplicate = products.some(p => p.code === formData.code && p.id !== editingProduct?.id);
    if (isDuplicate) {
      showAlert("Duplicate Code", "Product Code must be unique.");
      return;
    }

    if (editingProduct) {
      // Update
      const updatedList = products.map(p => p.id === editingProduct.id ? { ...formData, id: editingProduct.id } as Product : p);
      onUpdateProducts(updatedList);
    } else {
      // Create
      const newProduct = { ...formData, id: generateId() } as Product;
      onUpdateProducts([...products, newProduct]);
    }
    setIsModalOpen(false);
  };

  // Helper for colors
  const getCategoryColor = (cat: string) => {
    const c = cat?.toUpperCase() || '';
    if (c === 'RTE') return 'bg-green-500/20 text-green-400 border border-green-500/30';
    if (c === 'RAW') return 'bg-red-500/20 text-red-400 border border-red-500/30';
    if (c === 'FG') return 'bg-blue-500/20 text-blue-400 border border-blue-500/30';
    if (c === 'WIP') return 'bg-amber-500/20 text-amber-400 border border-amber-500/30';
    if (['PKG', 'PIB', 'PBX', 'PFL'].includes(c)) return 'bg-purple-500/20 text-purple-400 border border-purple-500/30';
    return 'bg-slate-800 text-slate-400 border border-white/10';
  };

  const filteredProducts = products.filter(p =>
    p.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header & Actions */}
      <div className="bg-slate-900/60 backdrop-blur-md p-6 rounded-xl shadow-[0_0_15px_rgba(0,0,0,0.5)] border border-white/10">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2 font-display uppercase tracking-wider">
              <Boxes className="w-6 h-6 text-primary" />
              Product Master List
            </h2>
            <p className="text-sm text-slate-400">Manage your product catalog. Set Categories and Units here.</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 border border-white/10 rounded-lg text-slate-400 hover:bg-white/5 hover:text-white flex items-center gap-2 text-sm font-bold transition-colors"
            >
              <Upload className="w-4 h-4" /> Import CSV
            </button>
            <input type="file" ref={fileInputRef} accept=".csv" onChange={handleProductUpload} className="hidden" />

            <button
              onClick={() => handleOpenModal()}
              className="px-4 py-2 bg-primary/20 text-primary border border-primary/50 rounded-lg hover:bg-primary/30 flex items-center gap-2 text-sm font-bold transition-all shadow-[0_0_10px_rgba(139,92,246,0.3)] hover:shadow-[0_0_15px_rgba(139,92,246,0.5)]"
            >
              <Plus className="w-4 h-4" /> Add Product
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500 w-5 h-5" />
          <input
            type="text"
            placeholder="Search products..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-white/10 bg-black/40 rounded-lg text-slate-200 placeholder-slate-600 focus:ring-2 focus:ring-primary focus:border-primary outline-none"
          />
        </div>
      </div>

      {/* Product Table */}
      <div className="bg-slate-900/60 backdrop-blur-md rounded-xl shadow-[0_0_15px_rgba(0,0,0,0.5)] border border-white/10 overflow-hidden">
        <div className="max-h-[600px] overflow-y-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-black/40 sticky top-0 z-10 backdrop-blur-md border-b border-white/10">
              <tr>
                <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-wider text-xs">No.</th>
                <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-wider text-xs">Description</th>
                <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-wider text-xs">Category</th>
                <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-wider text-xs">Unit</th>
                <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-wider text-xs">Min Stock (Alert)</th>
                <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-wider text-xs text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredProducts.map(p => (
                <tr key={p.id} className="hover:bg-white/5 transition-colors group">
                  <td className="px-6 py-3 font-mono text-slate-500 font-medium tracking-wide">{p.code}</td>
                  <td className="px-6 py-3 text-slate-200">{p.name}</td>
                  <td className="px-6 py-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${getCategoryColor(p.defaultCategory || '')}`}>
                      {p.defaultCategory || '-'}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-slate-500 font-mono text-xs">{p.defaultUnit || '-'}</td>
                  <td className="px-6 py-3">
                    {p.minStockLevel && p.minStockLevel > 0 ? (
                      <span className="text-orange-400 font-bold font-mono">{p.minStockLevel}</span>
                    ) : (
                      <span className="text-slate-600">-</span>
                    )}
                  </td>
                  <td className="px-6 py-3 text-right">
                    <div className="flex justify-end gap-2 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={() => handleOpenModal(p)}
                        className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded transition-colors"
                        title="Edit"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(p.id, p.code)}
                        className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredProducts.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-10 text-center text-slate-500">
                    No products found. Add one or adjust search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit/Create Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-white/10 rounded-xl shadow-2xl max-w-lg w-full p-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6 border-b border-white/10 pb-4">
              <h3 className="text-xl font-bold text-white font-display uppercase tracking-wide">
                {editingProduct ? 'Edit Product' : 'Add New Product'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-500 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-400 mb-1 uppercase tracking-wider">code *</label>
                  <input
                    type="text"
                    required
                    value={formData.code}
                    onChange={e => setFormData({ ...formData, code: e.target.value })}
                    className="w-full px-3 py-2 border border-white/10 bg-black/40 rounded-lg text-white focus:ring-2 focus:ring-primary outline-none placeholder-slate-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-400 mb-1 uppercase tracking-wider">Category</label>
                  <input
                    list="category-options"
                    type="text"
                    value={formData.defaultCategory}
                    onChange={e => setFormData({ ...formData, defaultCategory: e.target.value })}
                    placeholder="e.g. RAW"
                    className="w-full px-3 py-2 border border-white/10 bg-black/40 rounded-lg text-white focus:ring-2 focus:ring-primary outline-none placeholder-slate-600"
                  />
                  <datalist id="category-options">
                    {existingCategories.map(c => <option key={c} value={c} />)}
                  </datalist>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-400 mb-1 uppercase tracking-wider">Description (Name) *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-white/10 bg-black/40 rounded-lg text-white focus:ring-2 focus:ring-primary outline-none placeholder-slate-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-400 mb-1 uppercase tracking-wider">Unit</label>
                  <input
                    list="unit-options"
                    type="text"
                    value={formData.defaultUnit}
                    onChange={e => setFormData({ ...formData, defaultUnit: e.target.value })}
                    placeholder="e.g. kg, pcs"
                    className="w-full px-3 py-2 border border-white/10 bg-black/40 rounded-lg text-white focus:ring-2 focus:ring-primary outline-none placeholder-slate-600"
                  />
                  <datalist id="unit-options">
                    {existingUnits.map(u => <option key={u} value={u} />)}
                  </datalist>
                </div>
                <div>
                  {/* Hidden posting group field to keep data model consistent if needed */}
                </div>
              </div>

              <div className="bg-orange-900/20 p-4 rounded-lg border border-orange-500/30">
                <label className="block text-sm font-bold text-orange-400 mb-1 flex items-center gap-2 uppercase tracking-wide">
                  <AlertTriangle className="w-4 h-4" /> Min Stock (Alert)
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.minStockLevel}
                  onChange={e => setFormData({ ...formData, minStockLevel: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-orange-500/30 bg-black/40 rounded-lg text-orange-200 focus:ring-2 focus:ring-orange-500 outline-none"
                />
                <p className="text-xs text-orange-500/70 mt-1">Dashboard will alert if stock falls below this amount.</p>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg font-bold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/80 font-bold shadow-[0_0_15px_rgba(139,92,246,0.3)] border border-primary/50"
                >
                  Save Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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

export default ProductPage;