import React, { useState, useMemo } from 'react';
import { MasterLocation, STANDARD_RACKS, LEVELS, generateId } from '../types';
import { MapPin, Plus, Search, Edit, Trash2, X, Save, AlertCircle } from 'lucide-react';
import ConfirmModal, { ModalType } from './ConfirmModal';

interface LocationPageProps {
  locations: MasterLocation[];
  onUpdateLocations: (locations: MasterLocation[]) => void;
}

const LocationPage: React.FC<LocationPageProps> = ({ locations, onUpdateLocations }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLoc, setEditingLoc] = useState<MasterLocation | null>(null);

  // Form State
  const [formData, setFormData] = useState<Partial<MasterLocation>>({
    code: '',
    rack: 'A',
    bay: 1,
    level: '1'
  });

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

  const filteredLocations = useMemo(() => {
    return locations.filter(l =>
      l.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.rack.toLowerCase().includes(searchTerm.toLowerCase())
    ).slice(0, 50); // Limit rendering for performance
  }, [locations, searchTerm]);

  const handleOpenModal = (loc?: MasterLocation) => {
    if (loc) {
      setEditingLoc(loc);
      setFormData(loc);
    } else {
      setEditingLoc(null);
      setFormData({
        code: '',
        rack: 'A',
        bay: 1,
        level: '1'
      });
    }
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    showConfirm(
      "Delete Bin",
      'Are you sure you want to delete this bin?',
      () => onUpdateLocations(locations.filter(l => l.id !== id)),
      'danger'
    );
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();

    // Auto-generate code if empty based on standard format
    const rack = formData.rack || 'A';
    const bay = formData.bay || 1;
    const level = formData.level || '1';

    // Default naming convention: R-BB-L (e.g., A-01-1)
    const generatedCode = `${rack}-${String(bay).padStart(2, '0')}-${level}`;
    const finalCode = formData.code || generatedCode;

    // Check Uniqueness
    const isDuplicate = locations.some(l => l.code === finalCode && l.id !== editingLoc?.id);
    if (isDuplicate) {
      showAlert("Duplicate Bin", `Bin code '${finalCode}' already exists.`);
      return;
    }

    if (editingLoc) {
      const updated = locations.map(l => l.id === editingLoc.id ? { ...l, ...formData, binCode: finalCode } as MasterLocation : l);
      onUpdateLocations(updated);
    } else {
      const newLoc: MasterLocation = {
        id: generateId(),
        rack,
        bay,
        level,
        binCode: finalCode,
        name: formData.name
      };
      onUpdateLocations([newLoc, ...locations]);
    }
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="bg-slate-100 p-2 rounded-lg">
              <MapPin className="w-6 h-6 text-slate-700" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">Bin Master</h2>
              <p className="text-sm text-slate-500">Manage valid storage bins.</p>
            </div>
          </div>
          <button
            onClick={() => handleOpenModal()}
            className="px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 flex items-center gap-2 text-sm font-bold shadow-md"
          >
            <Plus className="w-4 h-4" /> Add Bin
          </button>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search bins (e.g. A-01)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="max-h-[600px] overflow-y-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-xs uppercase font-medium text-slate-500 sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="px-6 py-3">Bin Code</th>
                <th className="px-6 py-3">Rack</th>
                <th className="px-6 py-3">Bay</th>
                <th className="px-6 py-3">Level</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLocations.map(loc => (
                <tr key={loc.id} className="hover:bg-slate-50 group">
                  <td className="px-6 py-4 font-bold text-slate-800 font-mono">{loc.code}</td>
                  <td className="px-6 py-4">{loc.rack}</td>
                  <td className="px-6 py-4">{loc.bay}</td>
                  <td className="px-6 py-4">{loc.level}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleOpenModal(loc)}
                        className="p-1.5 text-slate-400 hover:text-primary hover:bg-red-50 rounded"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(loc.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredLocations.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-400">
                    No bins found matching your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="p-3 border-t bg-slate-50 text-xs text-slate-500 text-center">
          Showing top {filteredLocations.length} matches of {locations.length} total bins.
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-slate-800">
                {editingLoc ? 'Edit Bin' : 'Add New Bin'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Rack</label>
                  <select
                    value={formData.rack}
                    onChange={e => setFormData({ ...formData, rack: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary"
                  >
                    <option value="STAGE">STAGE</option>
                    {STANDARD_RACKS.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Bay</label>
                  <input
                    type="number"
                    min="1" max="99"
                    value={formData.bay}
                    onChange={e => setFormData({ ...formData, bay: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Level</label>
                  <select
                    value={formData.level}
                    onChange={e => setFormData({ ...formData, level: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary"
                  >
                    {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Bin Code (Optional)</label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={e => setFormData({ ...formData, code: e.target.value })}
                  placeholder="Leave empty to auto-generate (e.g. A-01-1)"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary outline-none"
                />
                <p className="text-xs text-slate-400 mt-1">
                  System will automatically format as Rack-Bay-Level if left blank.
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-red-700 font-bold"
                >
                  Save
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

export default LocationPage;