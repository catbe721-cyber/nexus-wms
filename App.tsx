import React, { useState, useEffect, useMemo } from 'react';
import {
  LayoutDashboard,
  PackagePlus,
  PackageMinus,
  Map,
  Boxes,
  Upload as UploadIcon,
  Search,
  Trash2,
  Edit,
  Menu,
  X,
  FileText,
  AlertTriangle,
  Bell,
  Ruler,
  Tag,
  ClipboardList,
  MapPin,
  Users,
  LogOut,
  ChevronUp,
  Settings,
  ArrowRightLeft,
  Sparkles
} from 'lucide-react';

import { Product, InventoryItem, ViewState, InventoryLocation, Transaction, MasterLocation, AREA_CONFIG, generateId, SavedPickList } from './types';
import InventoryForm from './components/InventoryForm';
import OutboundForm from './components/OutboundForm';
import WarehouseMap from './components/WarehouseMap';
import ProductPage from './components/ProductPage';
import ItemEntriesPage from './components/ItemEntriesPage';
import InventoryList from './components/InventoryList';
import SmartPickPage from './components/SmartPickPage';

import StockMovementForm from './components/StockMovementForm';
import ConfirmModal, { ModalType } from './components/ConfirmModal';
import SidebarItem from './components/SidebarItem';
import { GASService } from './services/gasApi';

// Updated initial data based on user request - USING NEW SCHEMA (productCode only)
import { INITIAL_PRODUCTS } from './consts/initialData';

// URL from environment variable
const DEFAULT_GAS_URL = import.meta.env.VITE_GOOGLE_SCRIPT_URL || '';

import { useAppState } from './hooks/useAppState';

function App() {
  const {
    inventory,
    products,
    transactions,
    savedPickLists,
    masterLocations,
    view,
    editingItem,
    sidebarOpen,
    modalConfig,
    inventorySummary,
    lowStockItems,
    topMovers,
    deadStock,
    actions
  } = useAppState();

  const {
    setView,
    setEditingItem,
    setSidebarOpen,
    setSavedPickLists,
    handleSaveInventory,
    handleEditInventory,
    handleDeleteInventory,
    handleOutboundProcess,
    handleMapInventoryChange,
    handleMoveStock,
    handleSyncGas,
    handleUpdateProducts,
    showAlert,
    closeModal
  } = actions;

  return (
    <div className="flex h-screen bg-[url('https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?q=80&w=2670&auto=format&fit=crop')] bg-cover bg-center text-slate-100 relative">
      <div className="absolute inset-0 bg-background/90 backdrop-blur-sm"></div>



      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-md z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <div className={`fixed lg:static inset-y-0 left-0 z-50 w-72 bg-slate-900/50 backdrop-blur-xl border-r border-white/10 text-slate-100 transform transition-transform duration-200 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="p-6 h-full flex flex-col relative">
          {/* Scanline Effect */}
          <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-0 bg-[length:100%_2px,3px_100%]"></div>

          <div
            className="flex items-center gap-4 mb-10 relative z-10 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => {
              setView('dashboard');
              setSidebarOpen(false);
            }}
          >
            <div className="bg-primary/20 p-2.5 rounded-lg border border-primary/50 shadow-[0_0_15px_rgba(139,92,246,0.3)]">
              <Boxes className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white leading-none font-display">NEXUS<span className="text-primary">WMS</span></h1>
              <span className="text-[10px] font-bold text-slate-400 tracking-[0.2em] uppercase">System v2.0</span>
            </div>
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto">
            {/* Operational Section */}
            <p className="px-4 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Operations</p>
            <SidebarItem
              id="dashboard"
              icon={LayoutDashboard}
              label="Dashboard"
              alert={lowStockItems.length > 0}
              active={view === 'dashboard'}
              onClick={() => {
                setView('dashboard');
                setSidebarOpen(false);
              }}
            />
            <SidebarItem
              id="entry"
              icon={PackagePlus}
              label="Inbound"
              active={view === 'entry'}
              onClick={() => {
                setView('entry');
                setSidebarOpen(false);
                setEditingItem(null);
              }}
            />
            <SidebarItem
              id="outbound"
              icon={PackageMinus}
              label="Outbound"
              active={view === 'outbound'}
              onClick={() => {
                setView('outbound');
                setSidebarOpen(false);
              }}
            />
            <SidebarItem
              id="move"
              icon={ArrowRightLeft}
              label="Move Stock"
              active={view === 'move'}
              onClick={() => {
                setView('move');
                setSidebarOpen(false);
              }}
            />
            <SidebarItem
              id="smart-pick"
              icon={Sparkles}
              label="Smart Pick"
              active={view === 'smart-pick'}
              onClick={() => {
                setView('smart-pick');
                setSidebarOpen(false);
              }}
            />{/* INTEGRATION POINT */}
            <div className="my-6"></div>

            {/* Inventory Section */}
            <p className="px-4 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Inventory</p>
            <SidebarItem
              id="list"
              icon={FileText}
              label="Stock List"
              active={view === 'list'}
              onClick={() => {
                setView('list');
                setSidebarOpen(false);
              }}
            />
            <SidebarItem
              id="map"
              icon={Map}
              label="Visual Map"
              active={view === 'map'}
              onClick={() => {
                setView('map');
                setSidebarOpen(false);
              }}
            />
            <SidebarItem
              id="history"
              icon={ClipboardList}
              label="History"
              active={view === 'history'}
              onClick={() => {
                setView('history');
                setSidebarOpen(false);
              }}
            />
            <div className="my-6"></div>

            {/* Master Data Section */}
            <p className="px-4 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Master Data</p>
            <SidebarItem
              id="products"
              icon={Boxes}
              label="Products"
              active={view === 'products'}
              onClick={() => {
                setView('products');
                setSidebarOpen(false);
              }}
            />
            <div className="my-4 border-t border-slate-100"></div>
          </nav>


        </div >
      </div >

      {/* Main Content */}
      < div className="flex-1 flex flex-col overflow-hidden relative z-10" >
        {/* Header (Mobile Only) */}
        < div className="lg:hidden bg-slate-900/80 backdrop-blur-md border-b border-white/10 p-4 flex justify-between items-center sticky top-0 z-30" >
          <button onClick={() => setSidebarOpen(true)} className="p-2 hover:bg-white/10 rounded-md">
            <Menu className="w-6 h-6 text-slate-300" />
          </button>
          <span className="font-bold text-white font-display text-xl">NEXUS<span className="text-primary">WMS</span></span>
          <div className="w-10"></div>
        </div >

        {/* Content Area */}
        < main className="flex-1 overflow-auto p-4 md:p-8" >

          {/* Dashboard View */}
          {
            view === 'dashboard' && (
              <div className="space-y-6 animate-in fade-in duration-500">
                <div className="flex justify-between items-end">
                  <h2 className="text-3xl font-bold text-white font-display tracking-tight">Command Center</h2>
                </div>

                {/* Alerts Section */}
                {lowStockItems.length > 0 && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 shadow-[0_0_20px_rgba(239,68,68,0.1)] relative overflow-hidden group">
                    <div className="absolute inset-0 bg-red-500/5 group-hover:bg-red-500/10 transition-colors"></div>
                    <h3 className="text-red-400 font-bold text-xl flex items-center gap-2 mb-4 font-display relative z-10">
                      <AlertTriangle className="w-6 h-6" /> Critical Warnings
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 relative z-10">
                      {lowStockItems.map(item => (
                        <div key={item.productCode} className="bg-slate-900/60 p-4 rounded-lg border border-red-500/20 shadow-sm flex flex-col justify-between hover:border-red-500/50 transition-colors backdrop-blur-md">
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex-1">
                              <span className="font-bold text-slate-200 block truncate text-lg">{item.name}</span>
                              <span className="text-xs text-slate-500 font-mono tracking-wider">{item.productCode}</span>
                            </div>
                            <span className="bg-red-500/20 text-red-400 text-[10px] uppercase font-bold px-2 py-1 rounded border border-red-500/20">
                              Critical
                            </span>
                          </div>
                          <div className="flex justify-between items-end border-t border-white/5 pt-2 mt-1">
                            <div className="text-xs text-slate-500 uppercase tracking-widest">Stock Level</div>
                            <div className="text-red-400 font-bold font-mono text-lg">
                              {item.qty} <span className="text-xs font-normal text-slate-600">/ {item.minStockLevel} {item.unit}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-slate-800/40 p-6 rounded-xl border border-white/5 hover:border-primary/50 transition-all backdrop-blur-md group">
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mb-1 group-hover:text-primary transition-colors">Total Items</p>
                    <p className="text-4xl font-bold text-white font-display">{inventory.reduce((acc, i) => acc + i.quantity, 0).toLocaleString()}</p>
                  </div>
                  <div className="bg-slate-800/40 p-6 rounded-xl border border-white/5 hover:border-accent/50 transition-all backdrop-blur-md group">
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mb-1 group-hover:text-accent transition-colors">Products</p>
                    <p className="text-4xl font-bold text-white font-display">{inventorySummary.length}</p>
                  </div>
                  <div className="bg-slate-800/40 p-6 rounded-xl border border-white/5 hover:border-red-500/50 transition-all backdrop-blur-md group">
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mb-1 group-hover:text-red-400 transition-colors">Low Stock</p>
                    <p className="text-4xl font-bold text-red-400 font-display">
                      {lowStockItems.length}
                    </p>
                  </div>
                  <div className="bg-slate-800/40 p-6 rounded-xl border border-white/5 hover:border-blue-500/50 transition-all backdrop-blur-md group">
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mb-1 group-hover:text-blue-400 transition-colors">Occupied Slots</p>
                    <p className="text-4xl font-bold text-blue-400 font-display">
                      {inventory.reduce((acc, i) => acc + i.locations.length, 0)}
                    </p>
                  </div>
                </div>

                {/* Advanced Metrics Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Top Movers */}
                  <div className="bg-slate-900/40 p-6 rounded-xl border border-white/5">
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2 font-display">
                      <Tag className="w-5 h-5 text-green-400" /> Top Movers
                    </h3>
                    <div className="space-y-3">
                      {topMovers.length === 0 ? (
                        <p className="text-slate-500 text-sm italic">No outbound data yet.</p>
                      ) : (
                        topMovers.map((item, idx) => (
                          <div key={item.code} className="flex justify-between items-center p-3 bg-slate-800/50 rounded-lg border border-white/5">
                            <div className="flex items-center gap-3">
                              <span className="text-slate-500 font-mono text-sm font-bold">#{idx + 1}</span>
                              <div>
                                <p className="font-bold text-slate-200 text-sm">{item.name}</p>
                                <p className="text-xs text-slate-500 font-mono">{item.code}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-green-400">{item.qty.toLocaleString()}</p>
                              <p className="text-[10px] text-slate-500 uppercase">{item.unit}</p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Dead Stock */}
                  <div className="bg-slate-900/40 p-6 rounded-xl border border-white/5">
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2 font-display">
                      <AlertTriangle className="w-5 h-5 text-amber-500" /> Stagnant Stock (30d+)
                    </h3>
                    <div className="space-y-3">
                      {deadStock.length === 0 ? (
                        <p className="text-slate-500 text-sm italic">Inventory is moving nicely!</p>
                      ) : (
                        deadStock.map((item) => (
                          <div key={item.id} className="flex justify-between items-center p-3 bg-slate-800/50 rounded-lg border border-white/5">
                            <div>
                              <p className="font-bold text-slate-200 text-sm">{item.productName}</p>
                              <p className="text-xs text-slate-500 font-mono flex gap-2">
                                <span>{item.productCode}</span>
                                <span className="text-amber-500/80">• {Math.floor((Date.now() - item.updatedAt) / (1000 * 60 * 60 * 24))}d old</span>
                              </p>
                            </div>
                            <div className="text-right">
                              <div className="bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2 py-1 rounded text-xs font-bold">
                                {item.locations.map(l => `${l.rack}-${l.bay}`).join(', ')}
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          }

          {/* Entry View */}
          {
            view === 'entry' && (
              <InventoryForm
                products={products}
                masterLocations={masterLocations}
                initialData={editingItem}
                onSave={handleSaveInventory}
                onCancel={() => {
                  setView('list');
                  setEditingItem(null);
                }}
              />
            )
          }

          {/* Outbound View */}
          {
            view === 'outbound' && (
              <OutboundForm
                products={products}
                inventory={inventory}
                onProcess={handleOutboundProcess}
                onCancel={() => setView('dashboard')}
                savedPickLists={savedPickLists}
                onSaveList={(name, items) => {
                  const newList: SavedPickList = {
                    id: generateId(),
                    name,
                    items,
                    createdAt: Date.now()
                  };
                  setSavedPickLists(prev => [...prev, newList]);
                }}
                onDeleteList={(id) => setSavedPickLists(prev => prev.filter(l => l.id !== id))}
              />
            )
          }



          {/* Inventory List View (Summary) */}
          {
            view === 'list' && (
              <InventoryList inventory={inventory} products={products} />
            )
          }

          {/* Item Entries History */}
          {
            view === 'history' && (
              <ItemEntriesPage transactions={transactions} />
            )
          }

          {/* Map View */}
          {
            view === 'map' && (
              <WarehouseMap
                inventory={inventory}
                products={products}
                onInventoryChange={handleMapInventoryChange}
              />
            )
          }

          {/* Product Master View */}
          {
            view === 'products' && (
              <ProductPage
                products={products}
                onUpdateProducts={handleUpdateProducts}
              />
            )
          }




          {/* Smart Pick View */}
          {
            view === 'smart-pick' && (
              <SmartPickPage
                inventory={inventory}
                products={products}
                onProcessOutbound={handleOutboundProcess}
              />
            )
          }

          {/* Stock Movement View */}
          {
            view === 'move' && (
              <StockMovementForm
                products={products}
                inventory={inventory}
                masterLocations={masterLocations}
                onMove={handleMoveStock}
                onCancel={() => setView('dashboard')}
              />
            )
          }

        </main >
      </div >

      {/* Global Modal */}
      < ConfirmModal
        isOpen={modalConfig.isOpen}
        onClose={closeModal}
        onConfirm={modalConfig.onConfirm}
        title={modalConfig.title}
        message={modalConfig.message}
        type={modalConfig.type}
      />
    </div>
  );
}

export default App;