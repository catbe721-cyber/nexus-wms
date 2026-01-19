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
      if (c === 'RTE') return 'bg-green-100 text-green-700';
      if (c === 'RAW') return 'bg-red-100 text-red-700';
      if (c === 'FG') return 'bg-blue-100 text-blue-700';
      if (c === 'WIP') return 'bg-amber-100 text-amber-700';
      if (['PKG', 'PIB', 'PBX', 'PFL'].includes(c)) return 'bg-purple-100 text-purple-700';
      return 'bg-gray-100 text-gray-700 border border-slate-200';
  };

  const filteredProducts = products.filter(p => 
    p.code.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header & Actions */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <Boxes className="w-6 h-6 text-primary" />
              Product Master List
            </h2>
            <p className="text-sm text-slate-500">Manage your product catalog. Set Categories and Units here.</p>
          </div>
          <div className="flex gap-2">
             <button 
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 flex items-center gap-2 text-sm font-medium"
             >
               <Upload className="w-4 h-4" /> Import CSV
             </button>
             <input type="file" ref={fileInputRef} accept=".csv" onChange={handleProductUpload} className="hidden" />
             
             <button 
                onClick={() => handleOpenModal()}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 text-sm font-medium"
             >
               <Plus className="w-4 h-4" /> Add Product
             </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input 
            type="text" 
            placeholder="Search products..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
          />
        </div>
      </div>

      {/* Product Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="max-h-[600px] overflow-y-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="px-6 py-3 font-medium text-slate-500">No.</th>
                <th className="px-6 py-3 font-medium text-slate-500">Description</th>
                <th className="px-6 py-3 font-medium text-slate-500">Category</th>
                <th className="px-6 py-3 font-medium text-slate-500">Unit</th>
                <th className="px-6 py-3 font-medium text-slate-500">Min Stock (Alert)</th>
                <th className="px-6 py-3 font-medium text-slate-500 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProducts.map(p => (
                <tr key={p.id} className="hover:bg-slate-50 group">
                  <td className="px-6 py-3 font-mono text-slate-600 font-medium">{p.code}</td>
                  <td className="px-6 py-3">{p.name}</td>
                  <td className="px-6 py-3">
                      <span className={`px-2 py-1 rounded text-xs font-bold ${getCategoryColor(p.defaultCategory || '')}`}>
                        {p.defaultCategory || '-'}
                      </span>
                  </td>
                  <td className="px-6 py-3 text-slate-500">{p.defaultUnit || '-'}</td>
                  <td className="px-6 py-3">
                     {p.minStockLevel && p.minStockLevel > 0 ? (
                       <span className="text-orange-600 font-bold">{p.minStockLevel}</span>
                     ) : (
                       <span className="text-slate-300">-</span>
                     )}
                  </td>
                  <td className="px-6 py-3 text-right">
                    <div className="flex justify-end gap-2 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        type="button"
                        onClick={() => handleOpenModal(p)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                        title="Edit"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button 
                        type="button"
                        onClick={() => handleDelete(p.id, p.code)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
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
                  <td colSpan={6} className="p-8 text-center text-slate-400">
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
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-slate-800">
                {editingProduct ? 'Edit Product' : 'Add New Product'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Product No. (Code) *</label>
                  <input
                    type="text"
                    required
                    value={formData.code}
                    onChange={e => setFormData({...formData, code: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary outline-none"
                  />
                </div>
                <div>
                   <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                   <input
                      list="category-options"
                      type="text"
                      value={formData.defaultCategory}
                      onChange={e => setFormData({...formData, defaultCategory: e.target.value})}
                      placeholder="e.g. RAW"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary outline-none"
                   />
                   <datalist id="category-options">
                      {existingCategories.map(c => <option key={c} value={c} />)}
                   </datalist>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description (Name) *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Unit</label>
                    <input
                      list="unit-options"
                      type="text"
                      value={formData.defaultUnit}
                      onChange={e => setFormData({...formData, defaultUnit: e.target.value})}
                      placeholder="e.g. kg, pcs"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary outline-none"
                   />
                   <datalist id="unit-options">
                      {existingUnits.map(u => <option key={u} value={u} />)}
                   </datalist>
                 </div>
                 <div>
                    {/* Hidden posting group field to keep data model consistent if needed */}
                 </div>
              </div>

              <div className="bg-orange-50 p-4 rounded-lg border border-orange-100">
                 <label className="block text-sm font-bold text-orange-800 mb-1 flex items-center gap-2">
                   <AlertTriangle className="w-4 h-4"/> Min Stock (Alert)
                 </label>
                 <input
                    type="number"
                    min="0"
                    value={formData.minStockLevel}
                    onChange={e => setFormData({...formData, minStockLevel: parseInt(e.target.value) || 0})}
                    className="w-full px-3 py-2 border border-orange-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                  />
                  <p className="text-xs text-orange-600 mt-1">Dashboard will alert if stock falls below this amount.</p>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-blue-700 font-medium"
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