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
  Sparkles,
  MessageSquare
} from 'lucide-react';

import { Product, InventoryItem, ViewState, InventoryLocation, Transaction, MasterLocation, generateId, SavedPickList } from './types';
import { AREA_CONFIG } from './consts/warehouse';
import InventoryForm from './components/InventoryForm';
import OutboundForm from './components/OutboundForm';
import WarehouseMap from './components/WarehouseMap';
import ProductPage from './components/ProductPage';
import ItemEntriesPage from './components/ItemEntriesPage';
import SpecialNotesPage from './components/SpecialNotesPage';
import InventoryList from './components/InventoryList';
import SmartPickPage from './components/SmartPickPage';

import StockMovementForm from './components/StockMovementForm';
import ConfirmModal, { ModalType } from './components/ConfirmModal';
import SidebarItem from './components/SidebarItem';
import DashboardPage from './components/DashboardPage';
import ItemAnalyticsPage from './components/ItemAnalyticsPage';
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
    gasConfig,
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
            {/* Overview Section */}
            <p className="px-4 text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 mt-2">Overview</p>
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
              id="analytics"
              icon={Sparkles}
              label="Item Analytics"
              active={view === 'analytics'}
              onClick={() => {
                setView('analytics');
                setSidebarOpen(false);
              }}
            />

            <div className="my-4 border-t border-white/5 mx-4"></div>

            {/* Operational Section */}
            <p className="px-4 text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Operations</p>
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
            />

            <div className="my-4 border-t border-white/5 mx-4"></div>

            {/* Inventory Section */}
            <p className="px-4 text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Inventory</p>
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

            <div className="my-4 border-t border-white/5 mx-4"></div>

            {/* Master Data Section */}
            <p className="px-4 text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">System & Data</p>
            <SidebarItem
              id="products"
              icon={Boxes}
              label="Product Master"
              active={view === 'products'}
              onClick={() => {
                setView('products');
                setSidebarOpen(false);
              }}
            />
            <SidebarItem
              id="notes"
              icon={MessageSquare}
              label="Special Notes"
              active={view === 'notes'}
              onClick={() => {
                setView('notes');
                setSidebarOpen(false);
              }}
            />
          </nav>


        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden relative z-10">
        {/* Header (Mobile Only) */}
        <div className="lg:hidden bg-slate-900/80 backdrop-blur-md border-b border-white/10 p-4 flex justify-between items-center sticky top-0 z-30">
          <button onClick={() => setSidebarOpen(true)} className="p-2 hover:bg-white/10 rounded-md">
            <Menu className="w-6 h-6 text-slate-300" />
          </button>
          <span className="font-bold text-white font-display text-xl">NEXUS<span className="text-primary">WMS</span></span>
          <div className="w-10"></div>
        </div>

        {/* Content Area */}
        <main className="flex-1 overflow-auto p-4 md:p-8">

          {/* Dashboard View */}
          {/* Dashboard View */}
          {
            view === 'dashboard' && (
              <DashboardPage
                inventory={inventory}
                inventorySummary={inventorySummary}
                products={products}
                lowStockItems={lowStockItems}
                topMovers={topMovers}
                deadStock={deadStock}
                transactions={transactions}
              />
            )
          }

          {/* Analytics View */}
          {
            view === 'analytics' && (
              <ItemAnalyticsPage
                inventory={inventory}
                transactions={transactions}
                products={products}
              />
            )
          }

          {/* Entry View */}
          {
            view === 'entry' && (
              <InventoryForm
                products={products}
                inventory={inventory}
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

          {/* Special Notes View */}
          {
            view === 'notes' && (
              <SpecialNotesPage transactions={transactions} />
            )
          }

          {/* Map View */}
          {
            view === 'map' && (
              <WarehouseMap
                inventory={inventory}
                products={products}
                masterLocations={masterLocations}
                onInventoryChange={handleMapInventoryChange}
                onToggleBinStatus={actions.handleToggleBinStatus}
              />
            )
          }

          {/* Product Master View */}
          {
            view === 'products' && (
              <ProductPage
                products={products}
                onUpdateProducts={handleUpdateProducts}
                gasUrl={gasConfig.url}
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

        </main>
      </div>

      {/* Global Modal */}
      <ConfirmModal
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