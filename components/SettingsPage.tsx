import React, { useRef, useState } from 'react';
import { InventoryItem, Product, Transaction, MasterLocation, generateId } from '../types';
import { Download, Upload, Database, AlertTriangle, FileSpreadsheet, CheckCircle, RefreshCw } from 'lucide-react';
import ConfirmModal, { ModalType } from './ConfirmModal';

interface SettingsPageProps {
  inventory: InventoryItem[];
  products: Product[];
  transactions: Transaction[];
  locations: MasterLocation[];
  onImportInventory: (data: InventoryItem[]) => void;
  onImportProducts: (data: Product[]) => void;
  onImportTransactions: (data: Transaction[]) => void;
  onImportLocations: (data: MasterLocation[]) => void;
}

const SettingsPage: React.FC<SettingsPageProps> = ({
  inventory,
  products,
  transactions,
  locations,
  onImportInventory,
  onImportProducts,
  onImportTransactions,
  onImportLocations
}) => {
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: ModalType;
  }>({ isOpen: false, title: '', message: '', type: 'info' });

  const inventoryInputRef = useRef<HTMLInputElement>(null);
  const productsInputRef = useRef<HTMLInputElement>(null);
  const transactionsInputRef = useRef<HTMLInputElement>(null);
  const locationsInputRef = useRef<HTMLInputElement>(null);

  const showAlert = (title: string, message: string, type: ModalType = 'info') => {
    setModalConfig({ isOpen: true, title, message, type });
  };

  // --- CSV Helpers ---

  const convertToCSV = (data: any[], columns: string[]) => {
    if (data.length === 0) return '';
    const header = columns.join(',');
    const rows = data.map(item => {
      return columns.map(col => {
        let val = item[col];
        
        // Special Handlers
        if (col === 'locations' && Array.isArray(val)) {
             // Convert location objects to string "Rack-Bay-Level|..."
             val = val.map((l: any) => `${l.rack}-${l.bay}-${l.level}`).join('|');
        } else if (typeof val === 'object' && val !== null) {
             val = JSON.stringify(val);
        } else if (val === undefined || val === null) {
             val = '';
        }
        
        // Escape quotes
        const stringVal = String(val);
        if (stringVal.includes(',') || stringVal.includes('"') || stringVal.includes('\n')) {
          return `"${stringVal.replace(/"/g, '""')}"`;
        }
        return stringVal;
      }).join(',');
    });
    return [header, ...rows].join('\n');
  };

  const downloadFile = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const parseCSV = (text: string): Record<string, string>[] => {
    const lines = text.split('\n');
    const result: Record<string, string>[] = [];
    if (lines.length < 2) return result;

    const headers = lines[0].split(',').map(h => h.trim());

    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      
      const row: string[] = [];
      let current = '';
      let inQuotes = false;
      const line = lines[i];
      
      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        if (char === '"') {
          if (inQuotes && line[j + 1] === '"') {
            current += '"';
            j++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === ',' && !inQuotes) {
          row.push(current);
          current = '';
        } else {
          current += char;
        }
      }
      row.push(current);

      if (row.length === headers.length) {
        const obj: Record<string, string> = {};
        headers.forEach((h, idx) => {
           obj[h] = row[idx];
        });
        result.push(obj);
      }
    }
    return result;
  };

  // --- Handlers ---

  const handleExportInventory = () => {
     const cols = ['id','productId','productCode','productName','quantity','unit','category','locations','updatedAt'];
     const csv = convertToCSV(inventory, cols);
     downloadFile(csv, `inventory_export_${Date.now()}.csv`);
  };

  const handleExportProducts = () => {
     const cols = ['id','code','name','defaultCategory','postingGroup','defaultUnit','minStockLevel'];
     const csv = convertToCSV(products, cols);
     downloadFile(csv, `products_export_${Date.now()}.csv`);
  };

  const handleExportTransactions = () => {
     const cols = ['id','date','type','productCode','productName','category','quantity','unit','locationInfo','user','notes'];
     const csv = convertToCSV(transactions, cols);
     downloadFile(csv, `transactions_export_${Date.now()}.csv`);
  };

  const handleExportLocations = () => {
     const cols = ['id','code','name','rack','bay','level'];
     const csv = convertToCSV(locations, cols);
     downloadFile(csv, `locations_export_${Date.now()}.csv`);
  };

  const handleFileRead = (file: File, callback: (data: any[]) => void, type: 'INVENTORY' | 'PRODUCTS' | 'TRANSACTIONS' | 'LOCATIONS') => {
      const reader = new FileReader();
      reader.onload = (e) => {
          try {
              const text = e.target?.result as string;
              const rawData = parseCSV(text);
              
              const parsedData = rawData.map(row => {
                  if (type === 'INVENTORY') {
                      // Locations Parsing
                      let parsedLocs: any[] = [];
                      if (row.locations) {
                          parsedLocs = row.locations.split('|').map(s => {
                              const parts = s.split('-');
                              if (parts.length >= 3) {
                                  return { rack: parts[0], bay: parseInt(parts[1]), level: parts[2] };
                              }
                              return null;
                          }).filter(Boolean);
                      }
                      
                      return {
                          id: row.id || generateId(),
                          productId: row.productId || generateId(),
                          productCode: row.productCode,
                          productName: row.productName,
                          quantity: parseFloat(row.quantity) || 0,
                          unit: row.unit,
                          category: row.category,
                          locations: parsedLocs,
                          updatedAt: parseInt(row.updatedAt) || Date.now(),
                      } as InventoryItem;
                  }
                  
                  if (type === 'PRODUCTS') {
                      return {
                          id: row.id || generateId(),
                          code: row.code,
                          name: row.name,
                          defaultCategory: row.defaultCategory,
                          postingGroup: row.postingGroup,
                          defaultUnit: row.defaultUnit,
                          minStockLevel: parseFloat(row.minStockLevel) || 0
                      } as Product;
                  }

                  if (type === 'TRANSACTIONS') {
                      return {
                          id: row.id || generateId(),
                          date: parseInt(row.date) || Date.now(),
                          type: row.type as any,
                          productCode: row.productCode,
                          productName: row.productName,
                          category: row.category,
                          quantity: parseFloat(row.quantity) || 0,
                          unit: row.unit,
                          locationInfo: row.locationInfo,
                          user: row.user,
                          notes: row.notes
                      } as Transaction;
                  }

                  if (type === 'LOCATIONS') {
                      return {
                          id: row.id || row.code, // Fallback
                          code: row.code,
                          name: row.name,
                          rack: row.rack,
                          bay: parseInt(row.bay) || 1,
                          level: row.level
                      } as MasterLocation;
                  }

                  return row;
              });

              callback(parsedData);
              showAlert('Success', `Successfully imported ${parsedData.length} records.`, 'confirm');
          } catch (err) {
              console.error(err);
              showAlert('Error', 'Failed to parse CSV file. Please check format.', 'danger');
          }
      };
      reader.readAsText(file);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-3 mb-2">
            <div className="bg-slate-800 p-2 rounded-lg">
                <Database className="w-6 h-6 text-white" />
            </div>
            <div>
                <h2 className="text-xl font-bold text-slate-800">Data Management</h2>
                <p className="text-sm text-slate-500">Backup and Restore your data via CSV.</p>
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Inventory Card */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <div className="flex items-center gap-2 mb-4">
                  <FileSpreadsheet className="w-5 h-5 text-primary" />
                  <h3 className="font-bold text-slate-800">Current Inventory</h3>
              </div>
              <p className="text-sm text-slate-500 mb-6">
                  {inventory.length} active records.
              </p>
              <div className="flex gap-3">
                  <button 
                    onClick={handleExportInventory}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium"
                  >
                      <Download className="w-4 h-4" /> Export
                  </button>
                  <button 
                    onClick={() => inventoryInputRef.current?.click()}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-sm font-medium"
                  >
                      <Upload className="w-4 h-4" /> Import
                  </button>
                  <input 
                    type="file" 
                    ref={inventoryInputRef} 
                    className="hidden" 
                    accept=".csv"
                    onChange={(e) => e.target.files?.[0] && handleFileRead(e.target.files[0], onImportInventory, 'INVENTORY')}
                  />
              </div>
          </div>

          {/* Products Card */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <div className="flex items-center gap-2 mb-4">
                  <FileSpreadsheet className="w-5 h-5 text-blue-600" />
                  <h3 className="font-bold text-slate-800">Product Master</h3>
              </div>
              <p className="text-sm text-slate-500 mb-6">
                  {products.length} registered products.
              </p>
              <div className="flex gap-3">
                  <button 
                    onClick={handleExportProducts}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium"
                  >
                      <Download className="w-4 h-4" /> Export
                  </button>
                  <button 
                    onClick={() => productsInputRef.current?.click()}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-sm font-medium"
                  >
                      <Upload className="w-4 h-4" /> Import
                  </button>
                  <input 
                    type="file" 
                    ref={productsInputRef} 
                    className="hidden" 
                    accept=".csv"
                    onChange={(e) => e.target.files?.[0] && handleFileRead(e.target.files[0], onImportProducts, 'PRODUCTS')}
                  />
              </div>
          </div>

          {/* Transactions Card */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <div className="flex items-center gap-2 mb-4">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                  <h3 className="font-bold text-slate-800">Transaction History</h3>
              </div>
              <p className="text-sm text-slate-500 mb-6">
                  {transactions.length} historical entries.
              </p>
              <div className="flex gap-3">
                  <button 
                    onClick={handleExportTransactions}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium"
                  >
                      <Download className="w-4 h-4" /> Export
                  </button>
                  <button 
                    onClick={() => transactionsInputRef.current?.click()}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-sm font-medium"
                  >
                      <Upload className="w-4 h-4" /> Import
                  </button>
                  <input 
                    type="file" 
                    ref={transactionsInputRef} 
                    className="hidden" 
                    accept=".csv"
                    onChange={(e) => e.target.files?.[0] && handleFileRead(e.target.files[0], onImportTransactions, 'TRANSACTIONS')}
                  />
              </div>
          </div>

          {/* Locations Card */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <div className="flex items-center gap-2 mb-4">
                  <FileSpreadsheet className="w-5 h-5 text-purple-600" />
                  <h3 className="font-bold text-slate-800">Bin Locations</h3>
              </div>
              <p className="text-sm text-slate-500 mb-6">
                  {locations.length} storage bins defined.
              </p>
              <div className="flex gap-3">
                  <button 
                    onClick={handleExportLocations}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium"
                  >
                      <Download className="w-4 h-4" /> Export
                  </button>
                  <button 
                    onClick={() => locationsInputRef.current?.click()}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-sm font-medium"
                  >
                      <Upload className="w-4 h-4" /> Import
                  </button>
                  <input 
                    type="file" 
                    ref={locationsInputRef} 
                    className="hidden" 
                    accept=".csv"
                    onChange={(e) => e.target.files?.[0] && handleFileRead(e.target.files[0], onImportLocations, 'LOCATIONS')}
                  />
              </div>
          </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl flex gap-3">
          <AlertTriangle className="w-5 h-5 text-blue-600 flex-shrink-0" />
          <div className="text-sm text-blue-800">
              <p className="font-bold mb-1">Import Note:</p>
              <p>Importing data will <strong>overwrite</strong> or <strong>append</strong> depending on ID matches. Ensure your CSV file format matches the export format exactly. "Locations" field in Inventory CSV uses pipe-separated values (e.g., "A-01-1|B-02-1").</p>
          </div>
      </div>

      <ConfirmModal 
        isOpen={modalConfig.isOpen}
        onClose={() => setModalConfig(prev => ({...prev, isOpen: false}))}
        title={modalConfig.title}
        message={modalConfig.message}
        type={modalConfig.type}
      />
    </div>
  );
};

export default SettingsPage;