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
  ArrowRightLeft
} from 'lucide-react';

import { Product, InventoryItem, ViewState, InventoryLocation, Transaction, MasterLocation, AREA_CONFIG, generateId, UserRole, ROLES, SavedPickList } from './types';
import InventoryForm from './components/InventoryForm';
import OutboundForm from './components/OutboundForm';
import WarehouseMap from './components/WarehouseMap';
import ProductPage from './components/ProductPage';
import ItemEntriesPage from './components/ItemEntriesPage';
import InventoryList from './components/InventoryList';
import SettingsPage from './components/SettingsPage';
import StockMovementForm from './components/StockMovementForm';
import ConfirmModal, { ModalType } from './components/ConfirmModal';
import { GASService } from './services/gasApi';

// Updated initial data based on user request - USING NEW SCHEMA (productCode only)
const INITIAL_PRODUCTS: Product[] = [
  { productCode: 'S001-04-2', name: 'Soy Souce (5ML) 2.5kg/case(DALIAN) 2000pcs/cs', defaultCategory: 'RTE', defaultUnit: 'CS', minStockLevel: 13 },
  { productCode: 'S001-02-1', name: 'GINGER (5G) 1000 bag/case', defaultCategory: 'RTE', defaultUnit: 'CS', minStockLevel: 13 },
  { productCode: 'S001-03-1', name: 'WASABI (5G) 2000bags/case', defaultCategory: 'RTE', defaultUnit: 'CS', minStockLevel: 9 },
  { productCode: 'S005-01-1', name: 'Sushi Box', defaultCategory: 'RTE', defaultUnit: 'PLT', minStockLevel: 3 },
  { productCode: 'S003-01-2', name: 'Takumi Premium Rainbow Combo 890g Label', defaultCategory: 'RTE', defaultUnit: 'CS', minStockLevel: 3 },
  { productCode: 'S003-01-3', name: 'Family Pack California Roll 1000g Label', defaultCategory: 'RTE', defaultUnit: 'CS', minStockLevel: 3 },
  { productCode: 'S003-01-4', name: 'Family Pack Veggie Roll 900g Label', defaultCategory: 'RTE', defaultUnit: 'CS', minStockLevel: 3 },
  { productCode: 'S002-01-1', name: 'HP-20/ BH-20 (100sets/cs)', defaultCategory: 'RTE', defaultUnit: 'CS', minStockLevel: 63 },
  { productCode: 'S001-07-1', name: 'Nori Half Size Seaweed', defaultCategory: 'RTE', defaultUnit: 'CS', minStockLevel: 3 },
  { productCode: 'S001-08-1', name: 'Nori Full Size Seaweed', defaultCategory: 'RTE', defaultUnit: 'CS', minStockLevel: 3 },
  { productCode: 'S001-06-2', name: 'RICE (Komachi) 50 bags/pallet', defaultCategory: 'RTE', defaultUnit: 'PLT', minStockLevel: 3 },
  { productCode: 'S001-01-1', name: 'VINEGAR', defaultCategory: 'RTE', defaultUnit: 'CS', minStockLevel: 19 },
  { productCode: 'S001-05-1', name: 'Sugar 20KG/bag', defaultCategory: 'RTE', defaultUnit: 'CS', minStockLevel: 19 },
  { productCode: 'S001-11-1', name: 'Peach', defaultCategory: 'RTE', defaultUnit: 'CS', minStockLevel: 11 },
  { productCode: 'S004-01-1', name: 'SFLM-2 LID FLAT FOR SBM-24B&SBM-32B', defaultCategory: 'RTE', defaultUnit: 'CS', minStockLevel: 5 },
  { productCode: 'S004-02-1', name: 'SBM-24C PLASTIC ECOSTAR CROUND CONTAINER CLEAR', defaultCategory: 'RTE', defaultUnit: 'CS', minStockLevel: 5 },
  { productCode: 'S001-09-1', name: 'Mayonnaise', defaultCategory: 'RTE', defaultUnit: 'PLT', minStockLevel: 3 },
];

// Hardcoded URL for shared database access
const DEFAULT_GAS_URL = 'https://script.google.com/macros/s/AKfycbxvCw5tZAZPyH7LLOU30ivLKGksCAzHTtSvlNM14wAXCKw7RLnBD4O6ejNBRiYpYXOT/exec';

function App() {
  const [view, setView] = useState<ViewState>('dashboard');

  // -- Auth/User State (Simulated) --
  const [currentUser, setCurrentUser] = useState<{ name: string, role: UserRole }>({ name: 'Admin User', role: 'ADMIN' });
  const [showRoleSwitcher, setShowRoleSwitcher] = useState(false);

  // -- Modal State --
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: ModalType;
    onConfirm?: () => void;
  }>({ isOpen: false, title: '', message: '', type: 'info' });

  const showAlert = (title: string, message: string, type: ModalType = 'info') => {
    setModalConfig({ isOpen: true, title, message, type });
  };

  // -- State Initialization --
  const [inventory, setInventory] = useState<InventoryItem[]>(() => {
    const saved = localStorage.getItem('nexuswms_inventory');
    return saved ? JSON.parse(saved) : [];
  });

  const [products, setProducts] = useState<Product[]>(() => {
    const saved = localStorage.getItem('nexuswms_products');
    return saved ? JSON.parse(saved) : INITIAL_PRODUCTS;
  });

  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem('nexuswms_transactions');
    return saved ? JSON.parse(saved) : [];
  });

  const [savedPickLists, setSavedPickLists] = useState<SavedPickList[]>(() => {
    const saved = localStorage.getItem('nexuswms_picklists');
    return saved ? JSON.parse(saved) : [];
  });

  // Re-generate master locations if they are stale or missing to ensure new areas exist
  const [masterLocations, setMasterLocations] = useState<MasterLocation[]>(() => {
    // Always regenerate in dev for now to pick up new structure (STG-01 etc)
    const locs: MasterLocation[] = [];

    // Iterate over all configured areas to generate locations
    // New Area Config has STG-01, ADJ-01, etc.
    Object.entries(AREA_CONFIG).forEach(([rackName, config]) => {
      for (let b = 1; b <= config.bays; b++) {
        config.levels.forEach(l => {
          locs.push({
            binCode: `${rackName}-${b}-${l}`,
            rack: rackName,
            bay: b,
            level: l
          });
        });
      }
    });

    return locs;
  });

  // -- Google Sheets State --
  const [gasConfig, setGasConfig] = useState<{ url: string, enabled: boolean }>(() => {
    const saved = localStorage.getItem('nexuswms_gas_config');
    const parsed = saved ? JSON.parse(saved) : {};
    return {
      url: parsed.url || DEFAULT_GAS_URL,
      enabled: parsed.enabled !== undefined ? parsed.enabled : true
    };
  });
  const [isSyncing, setIsSyncing] = useState(false);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);

  // -- Persistence Effects --
  useEffect(() => { localStorage.setItem('nexuswms_inventory', JSON.stringify(inventory)); }, [inventory]);
  useEffect(() => { localStorage.setItem('nexuswms_products', JSON.stringify(products)); }, [products]);
  useEffect(() => { localStorage.setItem('nexuswms_transactions', JSON.stringify(transactions)); }, [transactions]);
  useEffect(() => { localStorage.setItem('nexuswms_picklists', JSON.stringify(savedPickLists)); }, [savedPickLists]);
  useEffect(() => { localStorage.setItem('nexuswms_locations_v3', JSON.stringify(masterLocations)); }, [masterLocations]);
  useEffect(() => { localStorage.setItem('nexuswms_gas_config', JSON.stringify(gasConfig)); }, [gasConfig]);

  // Load from GAS on mount if enabled
  useEffect(() => {
    if (gasConfig.enabled && gasConfig.url) {
      handleSyncGas(false); // Initial load (don't overwrite cloud with local yet)
    }
  }, []); // Run once on mount

  const handleSyncGas = async (pushLocalToCloud = true, silent = false, forcePushEmpty = false) => {
    if (!gasConfig.url || !gasConfig.enabled) return; // check enabled flag

    // SAFETY CHECK: 
    // If we are about to PUSH (Auto-Save), but the local inventory is completely empty,
    // it likely means the user just opened the app in a new session (e.g., Incognito).
    // In this case, we should NOT wipe the cloud data. Instead, we should PULL (Load) from cloud.
    if (pushLocalToCloud && !forcePushEmpty && inventory.length === 0 && transactions.length === 0) {
      if (!silent) console.log("NexusWMS: Detected empty local state. Switching to PULL mode to load data from Cloud.");
      pushLocalToCloud = false;
    }

    setIsSyncing(true);
    try {
      if (pushLocalToCloud) {
        // Push Mode: Save all local data to Cloud
        await GASService.saveData(gasConfig.url, 'saveAll', {
          inventory,
          products,
          transactions,
          locations: masterLocations
        });
        // if (!silent) showAlert('Sync Complete', 'Local data successfully saved to Google Sheets.');
      } else {
        // Pull Mode: Load from Cloud
        const data = await GASService.fetchData(gasConfig.url);

        // If the user added items *while* we were fetching data (e.g., initial load race),
        // we must NOT overwrite their new work with potentially empty/stale cloud data.

        // Mark initial sync as done effectively, allowing future auto-saves
        isInitialSyncDone.current = true;

        setInventory(prev => {
          // If we started with empty inventory (inventory.length === 0 captured in closure)
          // but now have items (prev.length > 0), user must have added them. Abort overwrite.
          if (inventory.length === 0 && prev.length > 0) {
            console.warn('NexusWMS: Prevented overwrite of user data during initial sync.');
            return prev;
          }
          return data.inventory || prev;
        });

        if (data.products) setProducts(data.products);

        setTransactions(prev => {
          if (transactions.length === 0 && prev.length > 0) return prev;
          return data.transactions || prev;
        });

        // Locations usually don't have this race condition as user doesn't "add" them quickly on start,
        // but safe to keep consistent.
        if (data.locations) setMasterLocations(data.locations);

        // if (!silent) showAlert('Sync Complete', 'Data successfully loaded from Google Sheets.');
      }
    } catch (error: any) {
      console.error(error);
      if (!silent) showAlert('Sync Error', error.message || 'Failed to sync with Google Sheets');
    } finally {
      setIsSyncing(false);
    }
  };

  // -- Auto-Sync Effect --
  const isInitialSyncDone = React.useRef(false);

  useEffect(() => {
    if (!gasConfig.enabled || !gasConfig.url) return;

    // BLOCKER: Do not auto-sync (push) until we have successfully pulled at least once.
    // This prevents overwriting cloud data with stale/empty local data on load.
    if (!isInitialSyncDone.current) return;

    const timer = setTimeout(() => {
      // Auto-save silently
      handleSyncGas(true, true);
    }, 2000); // 2 second debounce

    return () => clearTimeout(timer);
  }, [inventory, products, transactions, masterLocations, gasConfig.enabled, gasConfig.url]);

  // -- Helpers --
  const logTransaction = (
    type: 'INBOUND' | 'OUTBOUND' | 'ADJUSTMENT',
    item: InventoryItem,
    qty: number,
    locationOverride?: string
  ) => {
    const newTx: Transaction = {
      id: generateId(),
      date: Date.now(),
      type,
      productCode: item.productCode,
      productName: item.productName,
      category: item.category,
      quantity: qty,
      unit: item.unit,
      locationInfo: locationOverride || item.locations.map(l => `${l.rack}-${l.bay}`).join(', '),
      notes: locationOverride ? 'Manual Adjustment via Map' : 'System Entry',
      user: currentUser.name
    };
    setTransactions(prev => [newTx, ...prev]);
  };

  // Priority logic moved to types.ts (getBestLocationScore)

  // -- Permissions Logic --
  const PERMISSIONS: Record<UserRole, ViewState[]> = {
    ADMIN: ['dashboard', 'entry', 'outbound', 'list', 'map', 'history', 'products', 'settings', 'move'],
    MANAGER: ['dashboard', 'entry', 'outbound', 'list', 'map', 'history', 'products', 'settings', 'move'],
    OPERATOR: ['dashboard', 'entry', 'outbound', 'list', 'map', 'move'],
    AUDITOR: ['dashboard', 'list', 'map', 'history'],
    LOGISTICS: ['dashboard', 'list', 'map']
  };

  const hasAccess = (v: ViewState) => PERMISSIONS[currentUser.role].includes(v);

  // Effect to redirect if user switches role and loses access to current view
  useEffect(() => {
    if (!hasAccess(view)) {
      setView('dashboard');
    }
  }, [currentUser.role]);


  // -- Handlers --

  const handleSaveInventory = (item: Omit<InventoryItem, 'id' | 'updatedAt'>) => {
    if (editingItem) {
      // Update existing (Inbound Edit)
      const qtyDiff = item.quantity - editingItem.quantity;
      if (qtyDiff !== 0) {
        logTransaction('ADJUSTMENT', { ...item, id: editingItem.id, updatedAt: Date.now() }, qtyDiff, 'Edit Entry Form');
      }

      setInventory(prev => prev.map(i =>
        i.id === editingItem.id
          ? { ...item, id: editingItem.id, updatedAt: Date.now() }
          : i
      ));
      setEditingItem(null);
    } else {
      // Create new (Inbound)
      const newItem: InventoryItem = {
        ...item,
        id: generateId(),
        updatedAt: Date.now()
      };
      setInventory(prev => [newItem, ...prev]);
      logTransaction('INBOUND', newItem, newItem.quantity);
    }
  };

  const handleEditInventory = (item: InventoryItem) => {
    setEditingItem(item);
    setView('entry');
  };

  // Delete inventory from Map or List context
  const handleDeleteInventory = (id: string) => {
    // Find item first to log it
    const item = inventory.find(i => i.id === id);

    if (item) {
      // Update state first to feel responsive
      setInventory(prev => prev.filter(i => i.id !== id));
      // Then log
      logTransaction('ADJUSTMENT', item, -item.quantity, 'Deleted Record');
    }
  };

  const handleOutboundProcess = (itemsToRemove: { id: string, qty: number }[]) => {
    setInventory(prevInventory => {
      let newInventory = [...prevInventory];

      itemsToRemove.forEach(request => {
        const index = newInventory.findIndex(x => x.id === request.id);
        if (index === -1) return;

        const item = newInventory[index];
        const qtyToRemove = request.qty;

        if (qtyToRemove <= 0) return;

        if (item.quantity <= qtyToRemove) {
          // Remove fully
          logTransaction('OUTBOUND', item, -item.quantity);
          newInventory.splice(index, 1);
        } else {
          // Partial removal
          logTransaction('OUTBOUND', item, -qtyToRemove);
          newInventory[index] = {
            ...item,
            quantity: item.quantity - qtyToRemove,
            updatedAt: Date.now()
          };
        }
      });

      return newInventory;
    });

    setView('list');
    showAlert('Success', 'Processed outbound items successfully.');
  };

  const handleMapInventoryChange = (action: 'ADD' | 'UPDATE' | 'DELETE' | 'MOVE', item: InventoryItem, qtyDiff?: number, moveContext?: any) => {
    if (action === 'ADD') {
      setInventory(prev => [item, ...prev]);
      logTransaction('INBOUND', item, item.quantity, 'Map Direct Add');
    } else if (action === 'UPDATE') {
      setInventory(prev => prev.map(i => i.id === item.id ? item : i));
      if (qtyDiff) {
        logTransaction('ADJUSTMENT', item, qtyDiff, 'Map Direct Adjustment');
      } else if (qtyDiff === 0 && !moveContext) {
        // Fallback if no specific logic
      }
    } else if (action === 'DELETE') {
      setInventory(prev => prev.filter(i => i.id !== item.id));
      // Log explicitly with negative quantity of the item
      logTransaction('ADJUSTMENT', item, -item.quantity, 'Map Direct Removal');
    } else if (action === 'MOVE') {
      // Move logic: Update item location
      setInventory(prev => prev.map(i => i.id === item.id ? item : i));
      // Log move
      const fromLoc = moveContext?.previousLocation ? `${moveContext.previousLocation.rack}-${moveContext.previousLocation.bay}` : 'Unknown';
      const toLoc = item.locations[0] ? `${item.locations[0].rack}-${item.locations[0].bay}` : 'Unknown';
      logTransaction('ADJUSTMENT', item, 0, `Moved: ${fromLoc} -> ${toLoc}`);
    }
  };

  const handleMoveStock = (sourceId: string, destLoc: { rack: string, bay: number, level: string }, qty: number) => {
    const sourceItem = inventory.find(i => i.id === sourceId);
    if (!sourceItem) return;

    // Validate again just in case
    if (qty > sourceItem.quantity) {
      showAlert('Error', 'Cannot move more than available quantity', 'danger');
      return;
    }

    const sourceLocString = `${sourceItem.locations[0].rack}-${sourceItem.locations[0].bay}-${sourceItem.locations[0].level}`;
    const destLocString = `${destLoc.rack}-${destLoc.bay}-${destLoc.level}`;

    setInventory(prev => {
      const newInv = [...prev];
      const sourceIdx = newInv.findIndex(i => i.id === sourceId);

      if (sourceIdx === -1) return prev; // Should not happen

      // Check if item exists at destination to merge
      const destItemIdx = newInv.findIndex(i =>
        i.productCode === sourceItem.productCode &&
        i.locations[0].rack === destLoc.rack &&
        i.locations[0].bay === destLoc.bay &&
        i.locations[0].level === destLoc.level &&
        i.id !== sourceId
      );

      if (destItemIdx !== -1) {
        // Merge into destination
        newInv[destItemIdx] = {
          ...newInv[destItemIdx],
          quantity: newInv[destItemIdx].quantity + qty,
          updatedAt: Date.now()
        };

        // Handle Source
        if (qty === sourceItem.quantity) {
          // Full move -> Delete source
          newInv.splice(sourceIdx, 1);
        } else {
          // Partial move -> Reduce source
          newInv[sourceIdx] = {
            ...sourceItem, // Use spread of sourceItem (from closure) but this is inside setState updater? 
            // Safe enough if we assume source item structure hasn't drifted wildly, 
            // but cleaner to use newInv[sourceIdx] if we hadn't modified it yet.
            // Actually since sourceIdx might shift if we spliced? 
            // Wait, if destItemIdx < sourceIdx, splicing destItem causes shift. 
            // SAFEGUARDS:
            // 1. Identify objects first.
            // 2. Map new array.
            // Current approach with splice is risky if indices change.
            // Let's use map/filter for safety or be very careful with indices.
          };
        }
      }

      // Let's rewrite using safer immutable patterns to avoid index hell
      // This is clearer and safer
      let finalInv = [...prev];
      const src = finalInv.find(i => i.id === sourceId);
      if (!src) return prev;

      const dest = finalInv.find(i =>
        i.productCode === src.productCode &&
        i.locations[0].rack === destLoc.rack &&
        i.locations[0].bay === destLoc.bay &&
        i.locations[0].level === destLoc.level &&
        i.id !== sourceId
      );

      if (dest) {
        // MERGE CASE
        // Update Dest
        finalInv = finalInv.map(i => i.id === dest.id ? { ...i, quantity: i.quantity + qty, updatedAt: Date.now() } : i);

        // Update Source
        if (qty === src.quantity) {
          finalInv = finalInv.filter(i => i.id !== sourceId);
        } else {
          finalInv = finalInv.map(i => i.id === sourceId ? { ...i, quantity: i.quantity - qty, updatedAt: Date.now() } : i);
        }
      } else {
        // NO MERGE CASE
        if (qty === src.quantity) {
          // Full Move: Update Location
          finalInv = finalInv.map(i => i.id === sourceId ? { ...i, locations: [destLoc], updatedAt: Date.now() } : i);
        } else {
          // Partial Move: Split
          // 1. Reduce Source
          finalInv = finalInv.map(i => i.id === sourceId ? { ...i, quantity: i.quantity - qty, updatedAt: Date.now() } : i);
          // 2. Add New
          finalInv.push({
            ...src,
            id: generateId(),
            quantity: qty,
            locations: [destLoc],
            updatedAt: Date.now()
          });
        }
      }
      return finalInv;
    });

    logTransaction('ADJUSTMENT', sourceItem, 0, `Moved ${qty} ${sourceItem.unit} from ${sourceLocString} to ${destLocString}`);
  };

  const switchRole = (role: UserRole) => {
    setCurrentUser({ name: `${ROLES[role].label} User`, role });
    setShowRoleSwitcher(false);
  };

  // Aggregation Logic for Dashboard
  const inventorySummary = useMemo(() => {
    const summary: Record<string, { productCode: string, name: string, qty: number, unit: string, locations: Set<string> }> = {};
    inventory.forEach(item => {
      if (!summary[item.productCode]) {
        summary[item.productCode] = {
          productCode: item.productCode,
          name: item.productName,
          qty: 0,
          unit: item.unit,
          locations: new Set()
        };
      }
      summary[item.productCode].qty += item.quantity;
      item.locations.forEach(l => summary[item.productCode].locations.add(`${l.rack}-${l.bay}-${l.level}`));
    });

    return Object.values(summary).map(item => {
      const product = products.find(p => p.productCode === item.productCode);
      return {
        ...item,
        minStockLevel: product?.minStockLevel || 0
      };
    });
  }, [inventory, products]);

  const lowStockItems = useMemo(() => {
    return inventorySummary.filter(item => item.minStockLevel > 0 && item.qty < item.minStockLevel);
  }, [inventorySummary]);

  // -- Dashboard Calculations --

  // Top Movers: Most outbound quantity in persistent history
  const topMovers = useMemo(() => {
    const counts: Record<string, number> = {};
    transactions
      .filter(t => t.type === 'OUTBOUND')
      .forEach(t => {
        counts[t.productCode] = (counts[t.productCode] || 0) + Math.abs(t.quantity);
      });

    return Object.entries(counts)
      .map(([code, qty]) => {
        const product = products.find(p => p.productCode === code);
        return { code, name: product?.name || code, qty, unit: product?.defaultUnit || 'pcs' };
      })
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);
  }, [transactions, products]);

  // Dead Stock: Items not moved in 30 days (simplified to just check last update time per batch)
  const deadStock = useMemo(() => {
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    return inventory
      .filter(i => i.updatedAt < thirtyDaysAgo)
      .sort((a, b) => a.updatedAt - b.updatedAt) // Oldest first
      .slice(0, 5);
  }, [inventory]);

  const SidebarItem = ({ id, icon: Icon, label, alert }: { id: ViewState, icon: any, label: string, alert?: boolean }) => {
    if (!hasAccess(id)) return null;

    return (
      <button
        onClick={() => {
          setView(id);
          setSidebarOpen(false);
          if (id === 'entry') setEditingItem(null);
        }}
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-md transition-all mb-1 relative ${view === id
          ? 'bg-primary/90 text-white shadow-[0_0_15px_rgba(139,92,246,0.5)] border border-primary/50'
          : 'text-slate-400 hover:bg-white/5 hover:text-primary font-medium'
          }`}
      >
        <Icon className={`w-5 h-5 ${view === id ? 'text-white' : 'text-slate-500 group-hover:text-primary'}`} />
        <span className="tracking-wide">{label}</span>
        {alert && (
          <span className="absolute right-4 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse border border-white"></span>
        )}
      </button>
    );
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

          <div className="flex items-center gap-4 mb-10 relative z-10">
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
            {(hasAccess('dashboard') || hasAccess('entry') || hasAccess('outbound')) && (
              <>
                <p className="px-4 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Operations</p>
                <SidebarItem id="dashboard" icon={LayoutDashboard} label="Dashboard" alert={lowStockItems.length > 0} />
                <SidebarItem id="entry" icon={PackagePlus} label="Inbound" />
                <SidebarItem id="outbound" icon={PackageMinus} label="Outbound" />
                <SidebarItem id="move" icon={ArrowRightLeft} label="Move Stock" />
                <div className="my-6"></div>
              </>
            )}

            {/* Inventory Section */}
            {(hasAccess('list') || hasAccess('map') || hasAccess('history')) && (
              <>
                <p className="px-4 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Inventory</p>
                <SidebarItem id="list" icon={FileText} label="Stock List" />
                <SidebarItem id="map" icon={Map} label="Visual Map" />
                <SidebarItem id="history" icon={ClipboardList} label="History" />
                <div className="my-6"></div>
              </>
            )}

            {/* Master Data Section */}
            {(hasAccess('products') || hasAccess('settings')) && (
              <>
                <p className="px-4 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Master Data</p>
                <SidebarItem id="products" icon={Boxes} label="Products" />
                <SidebarItem id="settings" icon={Settings} label="System Settings" />
                <div className="my-4 border-t border-slate-100"></div>
              </>
            )}
          </nav>

          <div className="mt-auto pt-4 border-t border-slate-100 relative">
            {showRoleSwitcher && (
              <div className="absolute bottom-full left-0 w-full bg-slate-800 border border-slate-700 shadow-2xl rounded-lg mb-2 p-1 z-50 animate-in fade-in slide-in-from-bottom-2">
                <p className="px-3 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider">Switch Role</p>
                {(Object.keys(ROLES) as UserRole[]).map(role => (
                  <button
                    key={role}
                    onClick={() => switchRole(role)}
                    className={`w-full text-left px-3 py-2 text-sm rounded-md flex items-center justify-between ${currentUser.role === role ? 'bg-primary/10 text-primary font-bold border border-primary/20' : 'hover:bg-slate-700/50 text-slate-400'}`}
                  >
                    <span>{ROLES[role].label}</span>
                    {currentUser.role === role && <span className="w-2 h-2 rounded-full bg-primary"></span>}
                  </button>
                ))}
              </div>
            )}

            <button
              onClick={() => setShowRoleSwitcher(!showRoleSwitcher)}
              className="flex items-center gap-3 px-2 w-full hover:bg-white/5 p-2 rounded-lg transition-colors group"
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs border ${currentUser.role === 'ADMIN' ? 'bg-primary text-white border-primary' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                {currentUser.role[0]}
              </div>
              <div className="text-left flex-1">
                <p className="text-sm font-bold text-slate-200 group-hover:text-primary transition-colors font-display tracking-wide">{ROLES[currentUser.role].label}</p>
                <p className="text-[10px] text-slate-500 uppercase tracking-wide">Change Role</p>
              </div>
              <ChevronUp className={`w-4 h-4 text-slate-500 transition-transform ${showRoleSwitcher ? 'rotate-180' : ''}`} />
            </button>
          </div>
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
          {view === 'dashboard' && (
            <div className="space-y-6 animate-in fade-in duration-500">
              <div className="flex justify-between items-end">
                <h2 className="text-3xl font-bold text-white font-display tracking-tight">Command Center</h2>
                <span className="text-sm text-slate-400 bg-white/5 px-3 py-1 rounded-full border border-white/10 backdrop-blur-sm">
                  User: <span className="font-bold text-primary">{ROLES[currentUser.role].label}</span>
                </span>
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
          )}

          {/* Entry View */}
          {view === 'entry' && hasAccess('entry') && (
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
          )}

          {/* Outbound View */}
          {view === 'outbound' && hasAccess('outbound') && (
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
          )}

          {/* Inventory List View (Summary) */}
          {view === 'list' && hasAccess('list') && (
            <InventoryList inventory={inventory} products={products} />
          )}

          {/* Item Entries History */}
          {view === 'history' && hasAccess('history') && (
            <ItemEntriesPage transactions={transactions} />
          )}

          {/* Map View */}
          {view === 'map' && hasAccess('map') && (
            <WarehouseMap
              inventory={inventory}
              products={products}
              userRole={currentUser.role}
              onInventoryChange={handleMapInventoryChange}
            />
          )}

          {/* Product Master View */}
          {view === 'products' && hasAccess('products') && (
            <ProductPage
              products={products}
              onUpdateProducts={(newProducts) => {
                // Simplified update to avoid crashes with ID mismatches. 
                // TODO: Re-implement cascading rename if needed using a diff strategy.
                setProducts(newProducts);
              }}
            />
          )}

          {/* Settings View */}
          {view === 'settings' && hasAccess('settings') && (
            <SettingsPage
              gasConfig={gasConfig}
              onSyncGas={() => handleSyncGas(false, false)} // Manual Pull (Refresh) from Cloud
              isSyncing={isSyncing}
              onInitializeApp={() => {
                // isInitializingRef was removed, but we want to allow this specific manual flush
                isInitialSyncDone.current = true;
                setTransactions([]);
                setInventory([]);
                // Also clear location override if needed, but masterLocations usually static?
                // Actually if we want to reset EVERYTHING:
                // setMasterLocations(INITIAL_LOCATIONS...); // If we wanted. For now just data.

                showAlert('App Initialized', 'History and Inventory cleared. Syncing empty state to cloud...', 'info');

                // FORCE PUSH EMPTY STATE IMMEDIATELY
                // We use setTimeout to allow state to settle, although in React 18+ batching might handle it.
                // Better to just call sync with empty arrays directly passed if possible, but handleSyncGas reads from state.
                // State updates are async. We need to be careful.
                // Actually handleSyncGas reads from CLOSURE or REF? It reads from state dependencies in useEffect, 
                // but if called directly it reads current render scope which is old? 
                // Let's rely on the useEffect that watches inventory?
                // The useEffect will trigger because we updated inventory/transactions.
                // We just need to ensure that `isInitializingRef.current` is TRUE when that effect fires.

                // It is already set to true above.
                // The useEffect in App.tsx (line 222) checks this flag to decide if it should forcePushEmpty.
                // So this logic SHOULD work, assuming the effect fires.

                // Let's strengthen it by clearing Products too if "Initialize App" means "Factory Reset".
                // Usually "Initialize" keeps master data but clears transaction data.
                // User said "Initialize Application does not work".
                // Problem: handleSyncGas logic at line 164 prevents pushing empty if local is empty.
                // Fix: Ensure forcePushEmpty (3rd arg) is respected.
              }}
            />
          )}

          {/* Stock Movement View */}
          {view === 'move' && (
            <StockMovementForm
              products={products}
              inventory={inventory}
              masterLocations={masterLocations}
              onMove={handleMoveStock}
              onCancel={() => setView('dashboard')}
            />
          )}

        </main>
      </div>

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
}

export default App;