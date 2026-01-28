import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Product, InventoryItem, ViewState, Transaction, MasterLocation, AREA_CONFIG, generateId, SavedPickList } from '../types';
import { GASService } from '../services/gasApi';
import { ModalType } from '../components/ConfirmModal';

// Updated initial data based on user request - USING NEW SCHEMA (productCode only)
const INITIAL_PRODUCTS: Product[] = [
    { productCode: 'UFTS0010', name: 'Sushi Tray HP 65', defaultCategory: 'PKG', defaultUnit: 'CS', minStockLevel: 20 },
    { productCode: 'UFTS0001', name: 'BH-20 Sushi Tray/BX -20', defaultCategory: 'PKG', defaultUnit: 'CS', minStockLevel: 20 },
    { productCode: 'UV000008', name: 'Nori Half Size', defaultCategory: 'RAW', defaultUnit: 'CS', minStockLevel: 10 },
    { productCode: 'UV000009', name: 'Nori Full Size', defaultCategory: 'RAW', defaultUnit: 'CS', minStockLevel: 10 },
    { productCode: 'UFTP0002', name: 'SFLM-2 LID', defaultCategory: 'PKG', defaultUnit: 'CS', minStockLevel: 20 },
    { productCode: 'UFTP0001', name: 'SBM-24C', defaultCategory: 'PKG', defaultUnit: 'CS', minStockLevel: 20 },
    { productCode: 'UFHS0001', name: 'Sushi Box', defaultCategory: 'PKG', defaultUnit: 'CS', minStockLevel: 50 },
    { productCode: 'UFHP0001', name: 'Poke Bowl Box', defaultCategory: 'PKG', defaultUnit: 'CS', minStockLevel: 50 },
    { productCode: 'UV000007', name: 'GINGER', defaultCategory: 'RAW', defaultUnit: 'CS', minStockLevel: 15 },
    { productCode: 'UE000013', name: 'Soy Sauce', defaultCategory: 'RAW', defaultUnit: 'CS', minStockLevel: 15 },
    { productCode: 'UE000008', name: 'WASABI', defaultCategory: 'RAW', defaultUnit: 'CS', minStockLevel: 10 },
    { productCode: 'UE000023', name: 'Sugar', defaultCategory: 'RAW', defaultUnit: 'CS', minStockLevel: 15 },
    { productCode: 'UE000021', name: 'Vinegar', defaultCategory: 'RAW', defaultUnit: 'CS', minStockLevel: 15 },
    { productCode: 'UE000004', name: 'Rice', defaultCategory: 'RAW', defaultUnit: 'PLT', minStockLevel: 5 },
    { productCode: 'UE000003', name: 'Mayonnaise', defaultCategory: 'RAW', defaultUnit: 'CS', minStockLevel: 10 },
    { productCode: 'UE000031', name: 'Peach', defaultCategory: 'RAW', defaultUnit: 'CS', minStockLevel: 10 },
    { productCode: 'UFLC0001', name: 'Costco Family Pack California Roll', defaultCategory: 'RTE', defaultUnit: 'CS', minStockLevel: 10 },
    { productCode: 'UFLV0001', name: 'Costco Family Pack Veggie Roll', defaultCategory: 'RTE', defaultUnit: 'CS', minStockLevel: 10 },
    { productCode: 'UFLA0001', name: 'Takumi Premium Rainbow Combo', defaultCategory: 'RTE', defaultUnit: 'CS', minStockLevel: 10 },
    { productCode: 'UFLP0001', name: 'Poke Bowl label', defaultCategory: 'PKG', defaultUnit: 'ROL', minStockLevel: 5 },
    { productCode: 'UFIN0001', name: 'Ingredion Corn Starch', defaultCategory: 'RAW', defaultUnit: 'CS', minStockLevel: 5 },
    { productCode: 'UFTS0002', name: 'BX61', defaultCategory: 'PKG', defaultUnit: 'CS', minStockLevel: 10 },
    { productCode: 'FHE00001', name: '15*15*5', defaultCategory: 'PKG', defaultUnit: 'CS', minStockLevel: 10 },
    { productCode: 'FB000012', name: 'Tape', defaultCategory: 'PKG', defaultUnit: 'ROL', minStockLevel: 10 },
    { productCode: 'UFME0001', name: 'Costco 454g CAB Beef Chuck Rolls-USA-V2-327-film', defaultCategory: 'RAW', defaultUnit: 'CS', minStockLevel: 15 },
];

const DEFAULT_GAS_URL = import.meta.env.VITE_GOOGLE_SCRIPT_URL || '';

export function useAppState() {
    const [view, setView] = useState<ViewState>('dashboard');

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

    const closeModal = () => setModalConfig(prev => ({ ...prev, isOpen: false }));

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
        Object.entries(AREA_CONFIG).forEach(([rackName, config]) => {
            for (let b = 1; b <= config.bays; b++) {
                config.levels.forEach(l => {
                    locs.push({
                        id: generateId(),
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

    // Force update URL from Env Var if changed (Fixes stale local storage)
    useEffect(() => {
        if (DEFAULT_GAS_URL && gasConfig.url !== DEFAULT_GAS_URL) {
            console.log('NexusWMS: Updating GAS URL from environment variable');
            setGasConfig(prev => ({ ...prev, url: DEFAULT_GAS_URL }));
        }
    }, []);

    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);

    // -- Persistence Effects --
    useEffect(() => { localStorage.setItem('nexuswms_inventory', JSON.stringify(inventory)); }, [inventory]);
    useEffect(() => { localStorage.setItem('nexuswms_products', JSON.stringify(products)); }, [products]);
    useEffect(() => { localStorage.setItem('nexuswms_transactions', JSON.stringify(transactions)); }, [transactions]);
    useEffect(() => { localStorage.setItem('nexuswms_picklists', JSON.stringify(savedPickLists)); }, [savedPickLists]);
    useEffect(() => { localStorage.setItem('nexuswms_locations_v3', JSON.stringify(masterLocations)); }, [masterLocations]);
    useEffect(() => { localStorage.setItem('nexuswms_gas_config', JSON.stringify(gasConfig)); }, [gasConfig]);

    // -- Auto-Sync Effect --
    const isInitialSyncDone = useRef(false);
    const hasLoadedRef = useRef(false);

    // Load from GAS on mount if enabled - Force Pull
    useEffect(() => {
        if (gasConfig.enabled && gasConfig.url) {
            if (hasLoadedRef.current) return;
            hasLoadedRef.current = true;

            handleSyncGas(false);
        }
    }, []); // Run once on mount

    const handleSyncGas = async (pushLocalToCloud = true, silent = false, forcePushEmpty = false) => {
        if (!gasConfig.url || !gasConfig.enabled) return;

        // Safety: If we haven't successfully pulled yet, do NOT auto-save (push).
        // This protects against overwriting the cloud with empty local data on fresh boot.
        if (pushLocalToCloud && !isInitialSyncDone.current && !forcePushEmpty) {
            console.warn('NexusWMS: Skipped auto-save because initial load is not complete.');
            return;
        }

        if (!silent) setIsSyncing(true);
        try {
            if (pushLocalToCloud) {
                // Push Mode: Save all local data to Cloud
                await GASService.saveData(gasConfig.url, 'saveAll', {
                    inventory,
                    products,
                    transactions,
                    locations: masterLocations,
                    pickLists: savedPickLists
                });
                if (!silent) console.log('NexusWMS: Auto-saved to Google Sheets.');
            } else {
                // Pull Mode: Load from Cloud (Priority Source)
                const data = await GASService.fetchData(gasConfig.url);

                // SAFETY CHECK: Prevent overwriting with suspiciously empty data
                const cloudInventoryCount = data.inventory?.length || 0;
                const localInventoryCount = inventory.length;

                // If local has data but cloud is empty or significantly smaller (>50% loss)
                if (localInventoryCount > 5 && cloudInventoryCount < localInventoryCount * 0.5) {
                    console.warn('NexusWMS: Cloud data is suspiciously small. Skipping overwrite to protect local data.');
                    showAlert(
                        'Sync Warning',
                        `Cloud returned ${cloudInventoryCount} items but you have ${localInventoryCount} locally. ` +
                        'This might indicate a problem with your Google Sheet. Data was NOT overwritten. ' +
                        'Please verify your Google Sheet data before refreshing again.',
                        'warning'
                    );
                    // Do NOT set isInitialSyncDone to true, keeping the save lock active
                    return;
                }

                // Overwrite local state with Cloud Data
                // We trust the cloud as the source of truth on startup
                if (data.inventory) {
                    // MIGRATION / SANITIZATION: Fix legacy STG-01/ADJ-01 formats
                    const cleanInventory = data.inventory.map((item: InventoryItem) => ({
                        ...item,
                        locations: item.locations.map(loc => {
                            // Fix STG-01 -> STG
                            if (loc.rack === 'STG-01' || loc.rack === 'STG') {
                                // Ensure level is valid for STG (1-12)
                                // If it was 'Floor', map to '1'.
                                const newLevel = (loc.level === 'Floor') ? '1' : loc.level;
                                return { ...loc, rack: 'STG', level: newLevel };
                            }
                            // Fix ADJ-01 -> ADJ
                            if (loc.rack === 'ADJ-01' || loc.rack === 'ADJ') {
                                return { ...loc, rack: 'ADJ', level: (loc.level === 'Floor' ? '1' : loc.level) };
                            }
                            return loc;
                        })
                    }));
                    setInventory(cleanInventory);
                }

                if (data.products) setProducts(data.products);
                if (data.transactions) setTransactions(data.transactions);

                // IGNORE cloud locations to enforce local schema (AREA_CONFIG) as source of truth
                // if (data.locations) setMasterLocations(data.locations); 

                if (data.pickLists) setSavedPickLists(data.pickLists);

                isInitialSyncDone.current = true;
                if (!silent) console.log('NexusWMS: Initial data loaded from Google Sheets (Sanitized).');
            }

        } catch (error: any) {
            console.error(error);
            if (!silent) showAlert('Sync Error', error.message || 'Failed to sync with Google Sheets');
        } finally {
            if (!silent) setIsSyncing(false);
        }
    };

    // Trigger Auto-Save on Data Change
    useEffect(() => {
        if (!gasConfig.enabled || !gasConfig.url) return;
        if (!isInitialSyncDone.current) return;

        // Debounce to prevent flooding API
        const timer = setTimeout(() => {
            handleSyncGas(true, true); // Push, Silent
        }, 1000); // 1 second debounce (User requested faster than 2s)

        return () => clearTimeout(timer);
    }, [inventory, products, transactions, masterLocations, savedPickLists, gasConfig.enabled, gasConfig.url]);

    // -- Helpers --
    const logTransaction = (
        type: 'INBOUND' | 'OUTBOUND' | 'ADJUSTMENT',
        item: InventoryItem,
        qty: number,
        locationOverride?: string
    ) => {
        // Resolve the latest data from Product Master to ensure history matches current catalog
        const masterProduct = products.find(p => p.productCode === item.productCode);
        const resolvedName = masterProduct ? masterProduct.name : item.productName;
        const resolvedUnit = masterProduct?.defaultUnit || item.unit;
        const resolvedCategory = masterProduct?.defaultCategory || item.category;

        const newTx: Transaction = {
            id: generateId(),
            date: Date.now(),
            type,
            productCode: item.productCode,
            productName: resolvedName,
            category: resolvedCategory,
            quantity: qty,
            unit: resolvedUnit,
            locationInfo: locationOverride || item.locations.map(l => `${l.rack}-${l.bay}-${l.level}`).join(', '),
            notes: locationOverride ? 'Manual Adjustment via Map' : 'System Entry'
        };
        setTransactions(prev => [newTx, ...prev]);
    };

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
        const newTransactions: Transaction[] = [];
        const currentInventory = [...inventory];
        const updatedInventory = [...inventory];

        itemsToRemove.forEach(request => {
            const idx = updatedInventory.findIndex(x => x.id === request.id);
            if (idx === -1) return;

            const item = updatedInventory[idx];
            const qtyToRemove = request.qty;
            if (qtyToRemove <= 0) return;

            // Prepare Transaction Data
            const masterProduct = products.find(p => p.productCode === item.productCode);
            const resolvedName = masterProduct ? masterProduct.name : item.productName;
            const resolvedUnit = masterProduct?.defaultUnit || item.unit;
            const resolvedCategory = masterProduct?.defaultCategory || item.category;

            const tx: Transaction = {
                id: generateId(),
                date: Date.now(),
                type: 'OUTBOUND',
                productCode: item.productCode,
                productName: resolvedName,
                category: resolvedCategory,
                quantity: -qtyToRemove,
                unit: resolvedUnit,
                locationInfo: item.locations.map(l => `${l.rack}-${l.bay}-${l.level}`).join(', '),
                notes: 'System Entry'
            };
            newTransactions.push(tx);

            // Update Inventory
            if (item.quantity <= qtyToRemove) {
                updatedInventory.splice(idx, 1);
            } else {
                updatedInventory[idx] = {
                    ...item,
                    quantity: item.quantity - qtyToRemove,
                    updatedAt: Date.now()
                };
            }
        });

        // Apply both updates at once
        setInventory(updatedInventory);
        setTransactions(prev => [...newTransactions, ...prev]);
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
            const fromLoc = moveContext?.previousLocation ? `${moveContext.previousLocation.rack}-${moveContext.previousLocation.bay}-${moveContext.previousLocation.level}` : 'Unknown';
            const toLoc = item.locations[0] ? `${item.locations[0].rack}-${item.locations[0].bay}-${item.locations[0].level}` : 'Unknown';
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

        setInventory(prev => {
            const newInv = [...prev];
            const sourceIdx = newInv.findIndex(i => i.id === sourceId);
            if (sourceIdx === -1) return prev;

            const src = newInv[sourceIdx];
            // Defensive check in case state changed
            if (qty > src.quantity) return prev;

            // Check if item exists at destination to merge
            const destIdx = newInv.findIndex(i =>
                i.productCode === src.productCode &&
                i.locations[0].rack === destLoc.rack &&
                i.locations[0].bay === destLoc.bay &&
                i.locations[0].level === destLoc.level &&
                i.id !== sourceId
            );

            if (destIdx !== -1) {
                // MERGE: Update Dest
                newInv[destIdx] = {
                    ...newInv[destIdx],
                    quantity: newInv[destIdx].quantity + qty,
                    updatedAt: Date.now()
                };

                // Handle Source
                if (qty === src.quantity) {
                    // Full move -> Delete source
                    newInv.splice(sourceIdx, 1);
                } else {
                    // Partial move -> Reduce source
                    newInv[sourceIdx] = {
                        ...src,
                        quantity: src.quantity - qty,
                        updatedAt: Date.now()
                    };
                }
            } else {
                // NO MERGE
                if (qty === src.quantity) {
                    // Full Move: Update Location
                    newInv[sourceIdx] = {
                        ...src,
                        locations: [destLoc],
                        updatedAt: Date.now()
                    };
                } else {
                    // Partial Move: Split
                    // 1. Reduce Source
                    newInv[sourceIdx] = {
                        ...src,
                        quantity: src.quantity - qty,
                        updatedAt: Date.now()
                    };
                    // 2. Add New
                    newInv.push({
                        ...src,
                        id: generateId(),
                        quantity: qty,
                        locations: [destLoc],
                        updatedAt: Date.now()
                    });
                }
            }
            return newInv;
        });

        const sourceLocString = `${sourceItem.locations[0].rack}-${sourceItem.locations[0].bay}-${sourceItem.locations[0].level}`;
        const destLocString = `${destLoc.rack}-${destLoc.bay}-${destLoc.level}`;
        logTransaction('ADJUSTMENT', sourceItem, 0, `Moved ${qty} ${sourceItem.unit} from ${sourceLocString} to ${destLocString}`);
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

    const handleUpdateProducts = (newProducts: Product[]) => {
        // 1. Update Product Master ONLY
        // As per user request, do not cascade changes to historical inventory or transactions
        setProducts(newProducts);
    };

    return {
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
        actions: {
            setView,
            setEditingItem,
            setSidebarOpen,
            setSavedPickLists, // Needed for SmartPickPage updates potentially
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
        }
    };
}
