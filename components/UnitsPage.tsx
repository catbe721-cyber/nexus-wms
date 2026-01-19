import React, { useState } from 'react';
import { Plus, Trash2, Edit, Save, X, Ruler, AlertCircle } from 'lucide-react';
import ConfirmModal, { ModalType } from './ConfirmModal';

interface UnitsPageProps {
  units: string[];
  onAdd: (unit: string) => void;
  onUpdate: (oldUnit: string, newUnit: string) => void;
  onDelete: (unit: string) => void;
}

const UnitsPage: React.FC<UnitsPageProps> = ({ units, onAdd, onUpdate, onDelete }) => {
  const [newUnit, setNewUnit] = useState('');
  const [editingUnit, setEditingUnit] = useState<string | null>(null);
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
    if (newUnit.trim()) {
      if (units.includes(newUnit.trim())) {
        showAlert('Duplicate Unit', 'This unit already exists.');
        return;
      }
      onAdd(newUnit.trim());
      setNewUnit('');
    }
  };

  const startEdit = (unit: string) => {
    setEditingUnit(unit);
    setEditValue(unit);
  };

  const saveEdit = () => {
    if (editValue.trim() && editValue !== editingUnit) {
       if (units.includes(editValue.trim())) {
        showAlert('Duplicate Unit', 'This unit name already exists.');
        return;
      }
      if (editingUnit) {
        onUpdate(editingUnit, editValue.trim());
      }
    }
    setEditingUnit(null);
    setEditValue('');
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-3 mb-6">
            <div className="bg-emerald-100 p-2 rounded-lg">
                <Ruler className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
                <h2 className="text-xl font-bold text-slate-800">Unit of Measure Master</h2>
                <p className="text-sm text-slate-500">Manage standard units used in inventory records.</p>
            </div>
        </div>

        {/* Add New Unit */}
        <form onSubmit={handleAdd} className="flex gap-2 mb-8">
            <input
                type="text"
                value={newUnit}
                onChange={(e) => setNewUnit(e.target.value)}
                placeholder="Enter new unit (e.g., 'pallet', 'oz')"
                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
            />
            <button 
                type="submit"
                disabled={!newUnit.trim()}
                className="bg-emerald-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-emerald-700 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                <Plus className="w-5 h-5" />
                Add Unit
            </button>
        </form>

        {/* Unit List */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {units.map(unit => (
                <div key={unit} className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-lg group hover:border-emerald-300 transition-colors">
                    {editingUnit === unit ? (
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
                            <button onClick={() => setEditingUnit(null)} className="text-slate-400 hover:bg-slate-200 p-1 rounded">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    ) : (
                        <>
                            <span className="font-medium text-slate-700">{unit}</span>
                            <div className="flex gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                <button 
                                    onClick={() => startEdit(unit)}
                                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                                    title="Edit"
                                >
                                    <Edit className="w-4 h-4" />
                                </button>
                                <button 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onDelete(unit);
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
        
        {units.length === 0 && (
             <div className="text-center py-10 text-slate-400">
                <AlertCircle className="w-12 h-12 mx-auto mb-2 opacity-20" />
                <p>No units defined. Add one above.</p>
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

export default UnitsPage;