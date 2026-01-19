import React, { useState } from 'react';
import { Plus, Trash2, Edit, Save, X, Tag, AlertCircle } from 'lucide-react';
import ConfirmModal, { ModalType } from './ConfirmModal';

interface CategoryPageProps {
  categories: string[];
  onAdd: (category: string) => void;
  onUpdate: (oldCategory: string, newCategory: string) => void;
  onDelete: (category: string) => void;
}

const CategoryPage: React.FC<CategoryPageProps> = ({ categories, onAdd, onUpdate, onDelete }) => {
  const [newCategory, setNewCategory] = useState('');
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  // Modal State
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: ModalType;
  }>({ isOpen: false, title: '', message: '', type: 'info' });

  const showAlert = (title: string, message: string) => {
    setModalConfig({ isOpen: true, title, message, type: 'info' });
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (newCategory.trim()) {
      if (categories.includes(newCategory.trim())) {
        showAlert('Duplicate Category', 'This category already exists.');
        return;
      }
      onAdd(newCategory.trim());
      setNewCategory('');
    }
  };

  const startEdit = (cat: string) => {
    setEditingCategory(cat);
    setEditValue(cat);
  };

  const saveEdit = () => {
    if (editValue.trim() && editValue !== editingCategory) {
       if (categories.includes(editValue.trim())) {
        showAlert('Duplicate Category', 'This category name already exists.');
        return;
      }
      if (editingCategory) {
        onUpdate(editingCategory, editValue.trim());
      }
    }
    setEditingCategory(null);
    setEditValue('');
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-3 mb-6">
            <div className="bg-purple-100 p-2 rounded-lg">
                <Tag className="w-6 h-6 text-purple-600" />
            </div>
            <div>
                <h2 className="text-xl font-bold text-slate-800">Category Master</h2>
                <p className="text-sm text-slate-500">Manage item categories (e.g., Raw Material, Finished Goods).</p>
            </div>
        </div>

        {/* Add New Category */}
        <form onSubmit={handleAdd} className="flex gap-2 mb-8">
            <input
                type="text"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="Enter new category (e.g., 'FROZEN', 'DRY')"
                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
            />
            <button 
                type="submit"
                disabled={!newCategory.trim()}
                className="bg-purple-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-purple-700 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                <Plus className="w-5 h-5" />
                Add Category
            </button>
        </form>

        {/* Category List */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map(cat => (
                <div key={cat} className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-lg group hover:border-purple-300 transition-colors">
                    {editingCategory === cat ? (
                        <div className="flex flex-1 gap-2">
                             <input
                                type="text"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                className="flex-1 px-2 py-1 border border-slate-300 rounded text-sm"
                                autoFocus
                            />
                            <button onClick={saveEdit} className="text-green-600 hover:bg-green-100 p-1 rounded">
                                <Save className="w-4 h-4" />
                            </button>
                            <button onClick={() => setEditingCategory(null)} className="text-slate-400 hover:bg-slate-200 p-1 rounded">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    ) : (
                        <>
                            <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-purple-400"></span>
                                <span className="font-medium text-slate-700">{cat}</span>
                            </div>
                            <div className="flex gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                <button 
                                    onClick={() => startEdit(cat)}
                                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                                    title="Edit"
                                >
                                    <Edit className="w-4 h-4" />
                                </button>
                                <button 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onDelete(cat);
                                    }}
                                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                                    title="Delete"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </>
                    )}
                </div>
            ))}
        </div>
        
        {categories.length === 0 && (
             <div className="text-center py-10 text-slate-400">
                <AlertCircle className="w-12 h-12 mx-auto mb-2 opacity-20" />
                <p>No categories defined.</p>
            </div>
        )}
      </div>

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

export default CategoryPage;