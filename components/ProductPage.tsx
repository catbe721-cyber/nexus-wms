import React, { useState, useRef, useMemo } from 'react';
import { Product, generateId } from '../types';
import { Plus, Upload, Trash2, Edit, Save, X, Search, Boxes, AlertTriangle } from 'lucide-react';
import ConfirmModal, { ModalType } from './ConfirmModal';
import { smartSearch, getCategoryColor, getEmbedLink, parseCSV, normalizeProduct, generateCSV } from '../utils';
import { GASService } from '../services/gasApi';
import ImageThumbnail from './ImageThumbnail';
// @ts-ignore
// const API_URL = window.API_URL || '';

interface ProductPageProps {
  products: Product[];
  onUpdateProducts: (products: Product[]) => void;
  gasUrl?: string;
}

const ProductPage: React.FC<ProductPageProps> = ({ products, onUpdateProducts, gasUrl }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const imageUploadRef = useRef<HTMLInputElement>(null);

  // Form State
  const [formData, setFormData] = useState<Partial<Product>>({
    code: '',
    name: '',
    defaultCategory: '',
    defaultUnit: '',
    minStockLevel: 0,
    image: '',
    department: 'SHARED',
    countPerPallet: 0,
    updatedAt: Date.now()
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
  // Derive unique lists for autocomplete suggestions
  const existingCategories = useMemo(() => {
    const cats = new Set(products.map(p => p.defaultCategory).filter(Boolean));
    // Add default categories to suggestions
    ['Box', 'Film', 'Tray', 'Sushi', 'Tape', 'Wrap', 'Pallet'].forEach(c => cats.add(c));
    return Array.from(cats).sort();
  }, [products]);

  const existingUnits = useMemo(() =>
    Array.from(new Set(products.map(p => p.defaultUnit).filter(Boolean))) as string[],
    [products]);

  const handleProductUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const text = evt.target?.result as string;
          const rows = parseCSV(text);

          const newProducts: Product[] = [];
          // Create a mutable copy of products for updates
          const currentProducts = [...products];

          const startIndex = rows[0]?.[0]?.toLowerCase().includes('no.') ? 1 : 0;

          for (let i = startIndex; i < rows.length; i++) {
            const row = rows[i];
            if (row.length < 2) continue;

            const code = row[0];
            const name = row[1];
            // Format: Code, Name, Category, Department, Unit, MinStock, ImageUrl

            if (code && name) {
              // Check if exists
              const existingIdx = currentProducts.findIndex(p => p.productCode === code);

              const productData: Product = {
                productCode: code,
                name: name,
                defaultCategory: row[2] || 'OTH',
                department: (row[3] as any) || 'SHARED',
                defaultUnit: row[4] || 'pcs',
                minStockLevel: parseInt(row[5]) || 0,
                image: row[6] || '',
                countPerPallet: parseInt(row[7]) || 0,
                updatedAt: Date.now()
              };

              if (existingIdx !== -1) {
                // Update existing (CSV overrides)
                // We do NOT use normalizeProduct here as user might have manually fixed CSV
                currentProducts[existingIdx] = { ...currentProducts[existingIdx], ...productData };
              } else {
                // Add new
                newProducts.push(productData);
              }
            }
          }

          // Merge updates and new products
          onUpdateProducts([...currentProducts, ...newProducts]);
          showAlert("Success", `Processed file. Updated existing and added ${newProducts.length} new products.`);
        } catch (err) {
          console.error(err);
          showAlert("Error", 'Failed to parse file. Please ensure standard CSV format.');
        }
      };
      reader.readAsText(file);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!gasUrl) {
      showAlert("Configuration Error", "API URL is not configured. Please check Dashboard settings.");
      return;
    }

    setIsUploading(true);
    try {
      const imageUrl = await GASService.uploadImage(gasUrl, file, 'Products');
      setFormData(prev => ({ ...prev, image: imageUrl }));
    } catch (error: any) {
      console.error(error);
      showAlert("Upload Failed", error.message || "Failed to upload image");
    } finally {
      setIsUploading(false);
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
        productCode: '',
        name: '',
        defaultCategory: '',
        defaultUnit: '',
        minStockLevel: 0,
        image: '',
        department: 'SHARED',
        countPerPallet: 0,
        updatedAt: Date.now()
      });
    }
    setIsModalOpen(true);
  };

  const handleExportCSV = () => {
    const headers = ['Code', 'Name', 'Category', 'Department', 'Unit', 'MinStock', 'ImageUrl', 'Count/Pallet'];
    const data = products.map(p => [
      p.productCode,
      p.name,
      p.defaultCategory || '',
      p.department || 'SHARED',
      p.defaultUnit || '',
      p.minStockLevel || 0,
      p.image || '',
      p.countPerPallet || 0
    ]);

    const csvContent = generateCSV(headers, data);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `products_export_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };


  const handleDelete = (code: string) => {
    showConfirm(
      "Delete Product",
      `Are you sure you want to delete product '${code}'?`,
      () => onUpdateProducts(products.filter(p => p.productCode !== code)),
      'danger'
    );
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.productCode || !formData.name) {
      showAlert("Validation Error", "Code and Name are required.");
      return;
    }

    // Check Duplicate Code
    const isDuplicate = products.some(p => p.productCode === formData.productCode && p.productCode !== editingProduct?.productCode);
    if (isDuplicate) {
      showAlert("Duplicate Code", "Product Code must be unique.");
      return;
    }

    if (editingProduct) {
      // Check if image has changed or was removed
      if (editingProduct.image && editingProduct.image !== formData.image) {
        if (gasUrl) {
          GASService.deleteImage(gasUrl, editingProduct.image)
            .then(success => {
              if (success) console.log('Old image deleted from Drive');
            });
        }
      }

      // Update
      // normalizeProduct removed to respect manual edits
      const updatedList = products.map(p => p.productCode === editingProduct.productCode ? { ...formData, updatedAt: Date.now() } as Product : p);
      onUpdateProducts(updatedList);
    } else {
      // Create - Keep normalize logic for new manual creations as a helper
      const newProduct = { ...formData, updatedAt: Date.now() } as Product;
      onUpdateProducts([...products, newProduct]);
    }
    setIsModalOpen(false);
  };

  // Helper for colors


  const filteredProducts = products.filter(p =>
    smartSearch(p, ['productCode', 'name'], searchTerm)
  );

  // Floating Tooltip State
  // Refactored to use ImageThumbnail component


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
              onClick={handleExportCSV}
              className="px-4 py-2 border border-blue-500/30 text-blue-400 hover:bg-blue-500/10 rounded-lg text-sm font-bold transition-colors flex items-center gap-2"
              title="Export to CSV"
            >
              <Upload className="w-4 h-4 rotate-180" /> Export CSV
            </button>
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
            className="w-full pl-10 pr-4 py-2 border border-white/10 bg-black/40 rounded-lg text-slate-100 placeholder-slate-600 focus:ring-2 focus:ring-primary focus:border-primary outline-none font-bold"
          />
        </div>
      </div>

      {/* Product Table */}
      <div className="bg-slate-900/60 backdrop-blur-md rounded-xl shadow-[0_0_15px_rgba(0,0,0,0.5)] border border-white/10 overflow-hidden">
        <div className="max-h-[600px] overflow-y-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-black/40 sticky top-0 z-10 backdrop-blur-md border-b border-white/10">
              <tr>
                <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-wider text-xs w-16">Image</th>
                <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-wider text-xs">Code</th>
                <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-wider text-xs">Name</th>
                <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-wider text-xs">Category</th>
                <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-wider text-xs">Dept</th>
                <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-wider text-xs">Unit</th>
                <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-wider text-xs">Min Stock</th>
                <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-wider text-xs">Count/PLT</th>
                <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-wider text-xs">Updated</th>
                <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-wider text-xs text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredProducts.map(p => (
                <tr key={p.productCode} className="hover:bg-white/5 transition-colors group">
                  <td className="px-6 py-3">
                    {p.image ? (
                      <ImageThumbnail src={p.image} alt={p.name} />
                    ) : (
                      <div className="w-10 h-10 rounded bg-slate-800/50 border border-white/5 flex items-center justify-center">
                        <Boxes className="w-4 h-4 text-slate-600" />
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-3 text-slate-300 font-mono text-xs">{p.productCode}</td>
                  <td className="px-6 py-3 text-slate-200 font-bold">{p.name}</td>
                  <td className="px-6 py-3">
                    <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wide border ${getCategoryColor(p.defaultCategory || '')}`}>
                      {p.defaultCategory || '-'}
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    <span className={`px-2 py-1 rounded text-[10px] font-bold border ${p.department === 'RTE' ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' : p.department === 'RTC' ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' : 'bg-slate-700/50 text-slate-500 border-white/5'}`}>
                      {p.department || 'SHARED'}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-slate-400 text-xs">{p.defaultUnit || 'pcs'}</td>
                  <td className="px-6 py-3">
                    <span className={`px-2 py-1 rounded text-[10px] font-bold border ${p.minStockLevel && p.minStockLevel > 0 ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' : 'bg-slate-800 text-slate-600 border-white/5'}`}>
                      {p.minStockLevel || 0}
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    <span className="px-2 py-1 rounded text-[10px] font-bold bg-slate-800 text-slate-400 border border-white/5">
                      {p.countPerPallet || 0}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-slate-500 text-xs font-mono">
                    {p.updatedAt ? new Date(p.updatedAt).toLocaleDateString() : '-'}
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
                        onClick={() => handleDelete(p.productCode)}
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
                  <td colSpan={9} className="p-10 text-center text-slate-500">
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
                <div className="col-span-2">
                  <label className="block text-sm font-bold text-slate-400 mb-1 uppercase tracking-wider">Product Image</label>
                  <div className="flex items-center gap-4 p-4 border border-white/10 rounded-lg bg-black/20">
                    {formData.image ? (
                      <div className="relative group w-24 h-24">
                        <ImageThumbnail src={formData.image} alt="Preview" className="w-24 h-24" />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setFormData({ ...formData, image: '' });
                          }}
                          className="absolute top-1 right-1 z-10 bg-red-500/80 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="w-24 h-24 bg-white/5 rounded border border-white/10 flex items-center justify-center text-slate-500">
                        <div className="text-center">
                          <Upload className="w-6 h-6 mx-auto mb-1 opacity-50" />
                          <span className="text-[10px] uppercase">No Image</span>
                        </div>
                      </div>
                    )}

                    <div className="flex-1">
                      <p className="text-xs text-slate-400 mb-2">
                        Upload an image to identify this product easily.
                      </p>
                      <button
                        type="button"
                        disabled={isUploading}
                        onClick={() => imageUploadRef.current?.click()}
                        className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-xs font-bold text-white transition-colors flex items-center gap-2"
                      >
                        {isUploading ? 'Uploading...' : 'Choose Image'}
                        {!isUploading && <Upload className="w-3 h-3" />}
                      </button>
                      <input
                        type="file"
                        ref={imageUploadRef}
                        className="hidden"
                        accept="image/*"
                        onChange={handleImageUpload}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-400 mb-1 uppercase tracking-wider">code *</label>
                  <input
                    type="text"
                    required
                    value={formData.productCode}
                    onChange={e => setFormData({ ...formData, productCode: e.target.value })}
                    className="w-full px-3 py-2 border border-white/10 bg-black/40 rounded-lg text-white focus:ring-2 focus:ring-primary focus:border-primary outline-none placeholder-slate-600 font-bold"
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
                    className="w-full px-3 py-2 border border-white/10 bg-black/40 rounded-lg text-white focus:ring-2 focus:ring-primary focus:border-primary outline-none placeholder-slate-600 font-bold"
                  />
                  <datalist id="category-options">
                    {existingCategories.map(c => <option key={c} value={c} />)}
                  </datalist>
                </div>
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
                    className="w-full px-3 py-2 border border-white/10 bg-black/40 rounded-lg text-white focus:ring-2 focus:ring-primary focus:border-primary outline-none placeholder-slate-600 font-bold"
                  />
                  <datalist id="unit-options">
                    {existingUnits.map(u => <option key={u} value={u} />)}
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
                  className="w-full px-3 py-2 border border-white/10 bg-black/40 rounded-lg text-white focus:ring-2 focus:ring-primary focus:border-primary outline-none placeholder-slate-600 font-bold"
                />

              </div>

              <div>
                <label className="block text-sm font-bold text-slate-400 mb-1 uppercase tracking-wider">Department / Usage</label>
                <div className="flex gap-4">
                  {['SHARED', 'RTE', 'RTC'].map((dept) => (
                    <label key={dept} className="flex items-center gap-2 cursor-pointer group">
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${formData.department === dept || (!formData.department && dept === 'SHARED') ? 'border-primary' : 'border-slate-600 group-hover:border-slate-500'}`}>
                        {(formData.department === dept || (!formData.department && dept === 'SHARED')) && <div className="w-2 h-2 rounded-full bg-primary" />}
                      </div>
                      <input
                        type="radio"
                        name="department"
                        value={dept}
                        checked={formData.department === dept || (!formData.department && dept === 'SHARED')}
                        onChange={() => setFormData({ ...formData, department: dept as any })}
                        className="hidden"
                      />
                      <span className={`text-sm font-bold ${formData.department === dept || (!formData.department && dept === 'SHARED') ? 'text-white' : 'text-slate-500 group-hover:text-slate-400'}`}>
                        {dept}
                      </span>
                    </label>
                  ))}
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
                  className="w-full px-3 py-2 border border-orange-500/30 bg-black/40 rounded-lg text-orange-200 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none font-bold placeholder-orange-500/50"
                />
                <p className="text-xs text-orange-500/70 mt-1">Dashboard will alert if stock falls below this amount.</p>
              </div>

              <div className="bg-slate-800/30 p-4 rounded-lg border border-white/10">
                <label className="block text-sm font-bold text-slate-400 mb-1 flex items-center gap-2 uppercase tracking-wide">
                  <Boxes className="w-4 h-4" /> Count Per Pallet
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.countPerPallet}
                  onChange={e => setFormData({ ...formData, countPerPallet: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-white/10 bg-black/40 rounded-lg text-slate-200 focus:ring-2 focus:ring-primary focus:border-primary outline-none font-bold"
                />
                <p className="text-xs text-slate-500/70 mt-1">Reference for pallet calculations.</p>
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

      {/* Global Fixed Tooltip */}

    </div>
  );
};

export default ProductPage;