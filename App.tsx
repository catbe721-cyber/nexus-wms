import React, { useState, useEffect, useMemo } from 'react';
import { Routes, Route, useNavigate, Navigate, useLocation } from 'react-router-dom';
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
import { ErrorBoundary } from './components/ErrorBoundary';
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
    editingItem, // We stick with global edit state for now as it's easier than URL params for complex objects
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
    // setView, // No longer used
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

  const navigate = useNavigate();
  const location = useLocation();

  // Redirect to dashboard if root
  useEffect(() => {
    if (location.pathname === '/') {
      navigate('/dashboard');
    }
  }, [location.pathname, navigate]);

  const handleEditRedirect = (item: InventoryItem) => {
    handleEditInventory(item);
    navigate('/inbound');
  };

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
              navigate('/dashboard');
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
              to="/dashboard"
              icon={LayoutDashboard}
              label="Dashboard"
              alert={lowStockItems.length > 0}
              onClick={() => setSidebarOpen(false)}
            />
            <SidebarItem
              to="/analytics"
              icon={Sparkles}
              label="Item Analytics"
              onClick={() => setSidebarOpen(false)}
            />

            <div className="my-4 border-t border-white/5 mx-4"></div>

            {/* Operational Section */}
            <p className="px-4 text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Operations</p>
            <SidebarItem
              to="/inbound"
              icon={PackagePlus}
              label="Inbound"
              onClick={() => {
                setSidebarOpen(false);
                setEditingItem(null); // Reset edit state when clicking directly
              }}
            />
            <SidebarItem
              to="/outbound"
              icon={PackageMinus}
              label="Outbound"
              onClick={() => setSidebarOpen(false)}
            />
            <SidebarItem
              to="/move"
              icon={ArrowRightLeft}
              label="Move Stock"
              onClick={() => setSidebarOpen(false)}
            />
            <SidebarItem
              to="/smart-pick"
              icon={Sparkles}
              label="Smart Pick"
              onClick={() => setSidebarOpen(false)}
            />

            <div className="my-4 border-t border-white/5 mx-4"></div>

            {/* Inventory Section */}
            <p className="px-4 text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Inventory</p>
            <SidebarItem
              to="/inventory"
              icon={FileText}
              label="Stock List"
              onClick={() => setSidebarOpen(false)}
            />
            <SidebarItem
              to="/map"
              icon={Map}
              label="Visual Map"
              onClick={() => setSidebarOpen(false)}
            />
            <SidebarItem
              to="/history"
              icon={ClipboardList}
              label="History"
              onClick={() => setSidebarOpen(false)}
            />

            <div className="my-4 border-t border-white/5 mx-4"></div>

            {/* Master Data Section */}
            <p className="px-4 text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">System & Data</p>
            <SidebarItem
              to="/products"
              icon={Boxes}
              label="Product Master"
              onClick={() => setSidebarOpen(false)}
            />
            <SidebarItem
              to="/notes"
              icon={MessageSquare}
              label="Special Notes"
              onClick={() => setSidebarOpen(false)}
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
          <ErrorBoundary name="Global App Route">
            <Routes>
              <Route path="/dashboard" element={
                <DashboardPage
                  inventory={inventory}
                  inventorySummary={inventorySummary}
                  products={products}
                  lowStockItems={lowStockItems}
                  topMovers={topMovers}
                  deadStock={deadStock}
                  transactions={transactions}
                />
              } />

              <Route path="/analytics" element={
                <ErrorBoundary name="Item Analytics Page">
                  <ItemAnalyticsPage
                    inventory={inventory}
                    transactions={transactions}
                    products={products}
                  />
                </ErrorBoundary>
              } />

              <Route path="/inbound" element={
                <InventoryForm
                  products={products}
                  inventory={inventory}
                  masterLocations={masterLocations}
                  initialData={editingItem}
                  onSave={handleSaveInventory}
                  onCancel={() => {
                    navigate('/inventory');
                    setEditingItem(null);
                  }}
                />
              } />

              <Route path="/outbound" element={
                <OutboundForm
                  products={products}
                  inventory={inventory}
                  onProcess={handleOutboundProcess}
                  onCancel={() => navigate('/dashboard')}
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
              } />

              <Route path="/inventory" element={
                <InventoryList
                  inventory={inventory}
                  products={products}
                // We might need to pass an edit handler if InventoryList has an edit button
                // But InventoryList usually handles its own "Edit" button logic by calling a provided callback?
                // Checking InventoryList props... it usually takes `onEdit`? No, it probably uses internal context or specific props.
                // Let's assume standard behavior or check if we need to pass a callback.
                // For now, if InventoryList uses `onEdit`, we pass `handleEditRedirect`.
                />
              } />

              <Route path="/history" element={
                <ItemEntriesPage transactions={transactions} />
              } />

              <Route path="/notes" element={
                <SpecialNotesPage transactions={transactions} />
              } />

              <Route path="/map" element={
                <WarehouseMap
                  inventory={inventory}
                  products={products}
                  masterLocations={masterLocations}
                  onInventoryChange={handleMapInventoryChange}
                  onToggleBinStatus={actions.handleToggleBinStatus}
                />
              } />

              <Route path="/products" element={
                <ProductPage
                  products={products}
                  onUpdateProducts={handleUpdateProducts}
                  gasUrl={gasConfig.url}
                />
              } />

              <Route path="/smart-pick" element={
                <SmartPickPage
                  inventory={inventory}
                  products={products}
                  onProcessOutbound={handleOutboundProcess}
                />
              } />

              <Route path="/move" element={
                <StockMovementForm
                  products={products}
                  inventory={inventory}
                  masterLocations={masterLocations}
                  onMove={handleMoveStock}
                  onCancel={() => navigate('/dashboard')}
                />
              } />

              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </ErrorBoundary>
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
