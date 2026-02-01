import React, { useState, useMemo, useEffect } from 'react';
import { InventoryItem, InventoryLocation, STANDARD_RACKS, AREA_CONFIG, Product, generateId, MasterLocation, BAYS_PER_RACK, LEVELS } from '../types';
import { getCategoryColor, smartSearch } from '../utils';
import { Package, Search, MapPin, Plus, Save, Trash2, X, Lock, ArrowRightLeft, Layers, ChevronRight, Copy, Move, AlertTriangle, Check, Clipboard as ClipboardIcon } from 'lucide-react';
import ConfirmModal, { ModalType } from './ConfirmModal';

interface WarehouseMapProps {
    inventory: InventoryItem[];
    products: Product[];
    onInventoryChange: (action: 'ADD' | 'UPDATE' | 'DELETE' | 'MOVE' | 'COUNT', item: InventoryItem, qtyDiff?: number, moveContext?: any) => void;
}

const WarehouseMap: React.FC<WarehouseMapProps> = ({ inventory, products, onInventoryChange }) => {

    // Helper for display names
    const getAreaName = (code: string) => {
        if (code === 'S') return 'Staging (S)';
        if (code === 'R') return 'Reserve (R)';
        if (code === 'Z') return 'Zone (Z)';
        return code;
    };

    // Default to RACKS (ALL)
    const [selectedRack, setSelectedRack] = useState<string>('ALL');
    const [selectedLocation, setSelectedLocation] = useState<InventoryLocation | null>(null);
    const [levelView, setLevelView] = useState<string>('Floor');

    // Edit State
    const [isAddingItem, setIsAddingItem] = useState(false);
    const [newItemCode, setNewItemCode] = useState('');
    const [newItemQty, setNewItemQty] = useState(0);

    const [editingItemId, setEditingItemId] = useState<string | null>(null);
    const [editQty, setEditQty] = useState<number>(0);

    // Move State
    const [movingItemId, setMovingItemId] = useState<string | null>(null);
    const [copyingItemId, setCopyingItemId] = useState<string | null>(null); // New Copy State
    const [moveDest, setMoveDest] = useState<{ rack: string, bay: number, level: string }>({ rack: 'A', bay: 1, level: '1' });
    const [moveMode, setMoveMode] = useState<'FULL' | 'PARTIAL'>('FULL');
    const [moveQty, setMoveQty] = useState<number>(0);

    // Floating Tooltip State
    const [tooltipData, setTooltipData] = useState<{ x: number, y: number, items: InventoryItem[], title: string } | null>(null);

    // Auto-focus Input Ref & Dropdown State
    const newItemInputRef = React.useRef<HTMLInputElement>(null);
    const [showDropdown, setShowDropdown] = useState(false);

    // Cycle Count State
    const [isCountModalOpen, setIsCountModalOpen] = useState(false);
    const [countItem, setCountItem] = useState<InventoryItem | null>(null);
    const [countQty, setCountQty] = useState('');

    // Filter products for dropdown
    const filteredProducts = useMemo(() => {
        if (!newItemCode) return [];
        return products.filter(p => smartSearch(p, ['productCode', 'name'], newItemCode)).slice(0, 8);
    }, [products, newItemCode]);

    React.useEffect(() => {
        if (isAddingItem && newItemInputRef.current) {
            // Small timeout to ensure DOM is ready and transition is done
            setTimeout(() => {
                newItemInputRef.current?.focus();
            }, 100);
        }
        setShowDropdown(false); // Reset dropdown when opening/closing
    }, [isAddingItem]);

    const handleCellHover = (e: React.MouseEvent, rack: string, bay: number, level: string, items: InventoryItem[]) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setTooltipData({
            x: rect.right + 10, // Offset to right
            y: rect.top,
            items,
            title: `${rack}-${bay}-${level}`
        });
    };

    const handleCellLeave = () => {
        setTooltipData(null);
    };

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

    // Reset edit/move state when selection changes
    React.useEffect(() => {
        setIsAddingItem(false);
        setEditingItemId(null);
        setMovingItemId(null);
        setCopyingItemId(null);
        setNewItemCode('');
        setNewItemQty(0);
        setMoveMode('FULL');
    }, [selectedRack, selectedLocation]);



    // Permissions - Removed role based access
    const canEdit = true;

    // Current Dimensions based on selected rack
    // Safe lookup, default to S if missing
    const currentConfig = AREA_CONFIG[selectedRack] || AREA_CONFIG['S'];
    const currentBays = currentConfig?.bays || 12;
    const currentLevels = currentConfig?.levels || ['Floor'];

    // Optimization: Create a lookup map for O(1) access
    const locationLookup = useMemo(() => {
        const map = new Map<string, InventoryItem[]>();
        inventory.forEach(item => {
            item.locations.forEach(loc => {
                // Normalize keys to handle string/number mismatches
                // COMPAT: Map old rack codes to new ones for display
                let rack = loc.rack;
                if (rack === 'STG') rack = 'S';
                if (rack === 'ADJ') rack = 'R';
                if (rack === 'RSV') rack = 'Z';

                const key = `${rack}-${String(loc.bay)}-${String(loc.level)}`;
                if (!map.has(key)) {
                    map.set(key, []);
                }
                map.get(key)!.push(item);
            });
        });
        return map;
    }, [inventory]);

    // Helper to find items in a specific cell
    const getItemsInCell = (rack: string, bay: number, level: string) => {
        const key = `${rack}-${String(bay)}-${String(level)}`;
        return locationLookup.get(key) || [];
    };

    const selectedCellItems = useMemo(() => {
        if (!selectedLocation) return [];
        return getItemsInCell(selectedLocation.rack, selectedLocation.bay, selectedLocation.level);
    }, [selectedLocation, inventory]);

    // Keyboard Listener for Delete
    React.useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key !== 'Delete') return;
            if (!canEdit || !selectedLocation) return;

            // Prevent if user is typing in an input
            const activeTag = document.activeElement?.tagName.toLowerCase();
            if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') return;

            if (selectedCellItems.length === 0) return;

            showConfirm(
                "Clear Bin?",
                `Are you sure you want to remove all ${selectedCellItems.length} items from ${selectedLocation.rack}-${selectedLocation.bay}-${selectedLocation.level}?`,
                () => {
                    selectedCellItems.forEach(item => {
                        onInventoryChange('DELETE', item, -item.quantity);
                    });
                },
                'danger'
            );
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedLocation, selectedCellItems, canEdit]);



    // -- Handlers --

    const handleStartCount = (item: InventoryItem) => {
        setCountItem(item);
        setCountQty(''); // Blank for blind count
        setIsCountModalOpen(true);
    };

    const handleSubmitCount = () => {
        if (!countItem) return;
        const actualQty = parseFloat(countQty);
        if (isNaN(actualQty)) {
            showAlert("Invalid Quantity", "Please enter a valid number for the actual quantity.");
            return;
        }

        const diff = actualQty - countItem.quantity;

        onInventoryChange('COUNT', { ...countItem, quantity: actualQty }, diff);

        setIsCountModalOpen(false);
        setCountItem(null);
        setCountQty('');
    };

    // Actions
    const handleAddItem = () => {
        if (!canEdit) return;
        if (!selectedLocation) return;

        const inputVal = newItemCode.trim().toLowerCase();
        // Match by Name (exact or case-insensitive) or Code
        const product = products.find(p =>
            p.name.toLowerCase().trim() === inputVal ||
            p.productCode.toLowerCase().trim() === inputVal
        );

        if (!product || newItemQty <= 0) {
            showAlert("Invalid Input", "Please select a valid product and quantity.");
            return;
        }

        // Check if item already exists in this specific bin (location)
        const existingItem = selectedCellItems.find(item => item.productCode === product.productCode);

        if (existingItem) {
            // Merge logic
            const newTotal = existingItem.quantity + newItemQty;
            const updatedItem = { ...existingItem, quantity: newTotal, updatedAt: Date.now() };
            onInventoryChange('UPDATE', updatedItem, newItemQty);
        } else {
            // Create new logic
            const newItem: InventoryItem = {
                id: generateId(),
                productCode: product.productCode,
                productName: product.name,
                category: product.defaultCategory || 'OTH',
                unit: product.defaultUnit || 'pcs',
                quantity: newItemQty,
                locations: [selectedLocation],
                updatedAt: Date.now()
            };
            onInventoryChange('ADD', newItem, newItemQty);
        }

        setIsAddingItem(false);
        setNewItemCode('');
        setNewItemQty(0);
    };

    const handleUpdateQty = (item: InventoryItem) => {
        if (!canEdit) return;
        if (editQty < 0) return;

        if (editQty === 0) {
            showConfirm(
                "Delete Item?",
                "Quantity is 0. Do you want to remove this item?",
                () => onInventoryChange('DELETE', item, -item.quantity),
                'danger'
            );
        } else {
            const diff = editQty - item.quantity;
            if (diff === 0) { setEditingItemId(null); return; }

            const updatedItem = { ...item, quantity: editQty, updatedAt: Date.now() };
            onInventoryChange('UPDATE', updatedItem, diff);
        }
        setEditingItemId(null);
    };

    const handleDeleteItem = (item: InventoryItem) => {
        if (!canEdit) return;
        showConfirm(
            "Remove Item",
            `Remove ${item.productName} from this bin?`,
            () => onInventoryChange('DELETE', item, -item.quantity),
            'danger'
        );
    };

    const handleMoveConfirm = (item: InventoryItem, isCopy = false) => {
        if (!canEdit) return;

        const qtyToMove = moveMode === 'FULL' ? item.quantity : moveQty;

        // Validation
        if (qtyToMove <= 0) {
            showAlert("Invalid Quantity", "Quantity to must be greater than 0.");
            return;
        }
        if (!isCopy && qtyToMove > item.quantity) {
            showAlert("Invalid Quantity", "Cannot move more than available quantity.");
            return;
        }
        // For copy, we don't strictly care if it's more than source, but usually it's just a duplicator.
        // Let's assume user wants to copy X amount.

        // Determine if this is effectively a full move (even if selected as partial)
        const isFullMove = !isCopy && qtyToMove === item.quantity;

        // Construct Dest Location Object
        const dest: InventoryLocation = { rack: moveDest.rack, bay: moveDest.bay, level: moveDest.level };

        // Check if moving/copying to same spot
        if (item.locations[0] &&
            dest.rack === item.locations[0].rack &&
            dest.bay === item.locations[0].bay &&
            dest.level === item.locations[0].level
        ) {
            setMovingItemId(null);
            setCopyingItemId(null);
            return;
        }

        // Check if dest already has this product
        const destItems = getItemsInCell(dest.rack, dest.bay, dest.level);
        const existingDestItem = destItems.find(i => i.productCode === item.productCode);

        const performMove = () => {
            // SCENARIO 1: Merge with existing item at destination (or Copy into existing)
            if (existingDestItem) {
                // 1. Update Destination
                const newTotal = existingDestItem.quantity + qtyToMove;
                const updatedDestItem = { ...existingDestItem, quantity: newTotal, updatedAt: Date.now() };
                onInventoryChange('UPDATE', updatedDestItem, qtyToMove);

                // 2. Handle Source (Only if NOT copying)
                if (!isCopy) {
                    if (isFullMove) {
                        // Delete Source
                        onInventoryChange('DELETE', item, -item.quantity);
                    } else {
                        // Update Source
                        const remainingQty = item.quantity - qtyToMove;
                        const updatedSourceItem = { ...item, quantity: remainingQty, updatedAt: Date.now() };
                        onInventoryChange('UPDATE', updatedSourceItem, -qtyToMove);
                    }
                }
            }
            // SCENARIO 2: Move/Copy to empty slot (or slot without this product)
            else {
                if (isFullMove && !isCopy) {
                    // Standard Full Move
                    const updatedItem = { ...item, locations: [dest], updatedAt: Date.now() };
                    onInventoryChange('MOVE', updatedItem, 0, { previousLocation: item.locations[0] });
                } else {
                    // Partial Move or Copy to Empty Slot
                    // 1. Create New Item at Dest
                    const newItem: InventoryItem = {
                        ...item,
                        id: generateId(),
                        quantity: qtyToMove,
                        locations: [dest],
                        updatedAt: Date.now()
                    };
                    onInventoryChange('ADD', newItem, qtyToMove);

                    // 2. Update Source (Only if NOT copying)
                    if (!isCopy) {
                        const remainingQty = item.quantity - qtyToMove;
                        const updatedSourceItem = { ...item, quantity: remainingQty, updatedAt: Date.now() };
                        onInventoryChange('UPDATE', updatedSourceItem, -qtyToMove);
                    }
                }
            }
            setMovingItemId(null);
            setCopyingItemId(null);
        };

        if (existingDestItem) {
            showConfirm(
                isCopy ? "Merge Copy?" : "Merge with Existing Item?",
                `Destination bin already contains ${item.productName}. ${isCopy ? 'Add' : 'Merge'} ${qtyToMove} units into it?`,
                performMove,
                'confirm'
            );
        } else {
            performMove();
        }
    };

    // Drag and Drop Handlers
    const handleDragStart = (e: React.DragEvent, item: InventoryItem) => {
        e.stopPropagation(); // Prevent cell drag when dragging item
        e.dataTransfer.setData("itemId", item.id);
        e.dataTransfer.effectAllowed = "copyMove";
    };

    const handleCellDragStart = (e: React.DragEvent, rack: string, bay: number, level: string) => {
        const items = getItemsInCell(rack, bay, level);
        if (items.length === 0) {
            e.preventDefault();
            return;
        }
        e.dataTransfer.setData("sourceLoc", JSON.stringify({ rack, bay, level }));
        e.dataTransfer.effectAllowed = "copyMove";
    };

    const handleDropOnBin = (e: React.DragEvent, rack: string, bay: number, level: string) => {
        e.preventDefault();
        const isCopy = e.ctrlKey || e.metaKey;
        e.dataTransfer.dropEffect = isCopy ? 'copy' : 'move';

        // CASE 1: Single Item Drag (from Sidebar)
        const itemId = e.dataTransfer.getData("itemId");
        if (itemId) {
            const item = inventory.find(i => i.id === itemId);
            if (!item) return;

            // Prevent dropping on existing location
            const currentLoc = item.locations[0];
            if (!isCopy && currentLoc && currentLoc.rack === rack && currentLoc.bay === bay && currentLoc.level === level) {
                return;
            }
            handleDropMove(item, { rack, bay, level }, isCopy);
            return;
        }

        // CASE 2: Whole Cell Drag (sourceLoc)
        const sourceLocStr = e.dataTransfer.getData("sourceLoc");
        if (sourceLocStr) {
            const sourceLoc = JSON.parse(sourceLocStr);
            // Prevent drop on self
            if (!isCopy && sourceLoc.rack === rack && sourceLoc.bay === bay && sourceLoc.level === level) return;

            const sourceItems = getItemsInCell(sourceLoc.rack, sourceLoc.bay, sourceLoc.level);
            if (sourceItems.length === 0) return;

            handleBulkMove(sourceItems, { rack, bay, level }, isCopy);
        }
    };

    const handleBulkMove = (items: InventoryItem[], dest: InventoryLocation, isCopy: boolean = false) => {
        const destItems = getItemsInCell(dest.rack, dest.bay, dest.level);

        // Check for merges
        const itemsToMerge: InventoryItem[] = [];
        const itemsToMove: InventoryItem[] = [];

        items.forEach(srcItem => {
            const match = destItems.find(d => d.productCode === srcItem.productCode);
            if (match) itemsToMerge.push(srcItem);
            else itemsToMove.push(srcItem);
        });

        const executeMove = () => {
            // Processing merges
            itemsToMerge.forEach(srcItem => {
                const destItem = destItems.find(d => d.productCode === srcItem.productCode)!;
                // Update Dest
                const newTotal = destItem.quantity + srcItem.quantity;
                const updatedDest = { ...destItem, quantity: newTotal, updatedAt: Date.now() };
                onInventoryChange('UPDATE', updatedDest, srcItem.quantity);
                // Delete Source (only if not copying)
                if (!isCopy) {
                    onInventoryChange('DELETE', srcItem, -srcItem.quantity);
                }
            });

            // Processing direct moves/copies
            itemsToMove.forEach(srcItem => {
                if (isCopy) {
                    // COPY: Create new item at dest
                    const newItem: InventoryItem = {
                        ...srcItem,
                        id: generateId(),
                        locations: [dest],
                        updatedAt: Date.now()
                    };
                    onInventoryChange('ADD', newItem, srcItem.quantity);
                } else {
                    // MOVE: Update location
                    const updatedItem = { ...srcItem, locations: [dest], updatedAt: Date.now() };
                    onInventoryChange('MOVE', updatedItem, 0, { previousLocation: srcItem.locations[0] });
                }
            });
        };

        if (itemsToMerge.length > 0) {
            showConfirm(
                isCopy ? "Merge & Copy Items?" : "Merge Items?",
                `Merging ${itemsToMerge.length} overlapping items into destination. ${itemsToMove.length} unique items will be ${isCopy ? 'copied' : 'moved'}.`,
                executeMove,
                'confirm'
            );
        } else {
            executeMove();
        }
    };

    const handleDropMove = (item: InventoryItem, dest: InventoryLocation, isCopy: boolean = false) => {
        if (!canEdit) return;

        const qtyToMove = item.quantity; // Default to full move for D&D

        // Check if dest already has this product
        const destItems = getItemsInCell(dest.rack, dest.bay, dest.level);
        const existingDestItem = destItems.find(i => i.productCode === item.productCode);

        const performMove = () => {
            // SCENARIO 1: Merge with existing item at destination
            if (existingDestItem) {
                // 1. Update Destination
                const newTotal = existingDestItem.quantity + qtyToMove;
                const updatedDestItem = { ...existingDestItem, quantity: newTotal, updatedAt: Date.now() };
                onInventoryChange('UPDATE', updatedDestItem, qtyToMove);

                // 2. Handle Source (only delete if not copying)
                if (!isCopy) {
                    onInventoryChange('DELETE', item, -item.quantity);
                }
            }
            // SCENARIO 2: Move/Copy to empty slot
            else {
                if (isCopy) {
                    // COPY: Create new item at dest
                    const newItem: InventoryItem = {
                        ...item,
                        id: generateId(),
                        locations: [dest],
                        updatedAt: Date.now()
                    };
                    onInventoryChange('ADD', newItem, item.quantity);
                } else {
                    // MOVE: Update location
                    const updatedItem = { ...item, locations: [dest], updatedAt: Date.now() };
                    onInventoryChange('MOVE', updatedItem, 0, { previousLocation: item.locations[0] });
                }
            }
        };

        if (existingDestItem) {
            showConfirm(
                isCopy ? "Merge & Copy?" : "Merge with Existing Item?",
                `Destination bin already contains ${item.productName}. ${isCopy ? 'Copy' : 'Merge'} ${qtyToMove} units into it?`,
                performMove,
                'confirm'
            );
        } else {
            performMove();
        }
    };

    return (
        <div className="h-full flex flex-col md:flex-row gap-4 h-[calc(100vh-100px)]">
            {/* Left: Map Visualization */}
            <div className="flex-1 bg-slate-900/60 backdrop-blur-md rounded-xl shadow-[0_0_15px_rgba(0,0,0,0.5)] border border-white/10 p-4 flex flex-col overflow-hidden relative">
                {/* Grid Background Effect */}
                <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:20px_20px] [mask-image:radial-gradient(ellipse_at_center,black_70%,transparent_100%)]"></div>

                <div className="flex flex-col gap-2 mb-4 relative z-10">
                    <div className="flex justify-between items-center">
                        <h2 className="text-xl font-bold text-white flex items-center gap-2 font-display tracking-wide">
                            <MapPin className="w-5 h-5 text-primary" />
                            Warehouse Visualizer
                        </h2>
                    </div>

                    {/* Zone Selector Bar - Dynamic */}
                    <div className="flex gap-2 p-1 bg-black/40 rounded-lg overflow-x-auto">
                        <button
                            key="RACKS"
                            onClick={() => { setSelectedRack('ALL'); setSelectedLocation(null); }}
                            className={`px-4 py-1 text-sm font-bold rounded transition-colors whitespace-nowrap ${selectedRack === 'ALL'
                                ? 'bg-amber-500 text-black'
                                : 'bg-slate-800 text-slate-400 hover:text-amber-400'
                                }`}
                        >
                            RACKS (A-J)
                        </button>

                        {['Z', 'S', 'R'].map(zone => (
                            <button
                                key={zone}
                                onClick={() => { setSelectedRack(zone); setSelectedLocation(null); }}
                                className={`px-4 py-1 text-sm font-bold rounded transition-colors whitespace-nowrap ${selectedRack === zone
                                    ? 'bg-amber-500 text-black'
                                    : 'bg-slate-800 text-slate-400 hover:text-amber-400'
                                    }`}
                            >
                                {getAreaName(zone)}
                            </button>
                        ))}
                    </div>


                </div>

                <div className="flex-1 overflow-auto bg-slate-950/50 border border-white/5 rounded-lg p-4 relative shadow-inner">
                    {/* STANDARD GRID RENDERER */}
                    <div className="min-w-fit">
                        {selectedRack === 'ALL' ? (
                            // ALL RACKS OVERVIEW MODE
                            <div className="flex flex-col h-full">
                                {/* Level Selector */}
                                <div className="flex justify-center mb-6 gap-2">
                                    {['Floor', '1', '2', '3'].map(lvl => (
                                        <button
                                            key={lvl}
                                            onClick={() => setLevelView(lvl)}
                                            className={`px-6 py-2 rounded-full text-sm font-bold transition-all border ${levelView === lvl
                                                ? 'bg-primary text-white border-primary shadow-[0_0_15px_rgba(139,92,246,0.5)] scale-105'
                                                : 'bg-white/5 text-slate-400 border-white/10 hover:bg-white/10 hover:text-white'
                                                }`}
                                        >
                                            {lvl === 'Floor' ? 'Floor Level' : `Level ${lvl}`}
                                        </button>
                                    ))}
                                </div>

                                {/* Multi-Rack Grid */}
                                <div className="flex overflow-x-auto pb-4 pt-2 px-2">
                                    {[...STANDARD_RACKS].reverse().map((rack, index) => {
                                        // Layout Logic:
                                        // Floor: J (gap) H,G (gap) F,E (gap) D,C (gap) B,A (gap at 0, 2, 4, 6)
                                        // Levels: J,H (gap) G,F (gap) E,D (gap) C,B (gap) A (gap at 1, 3, 5, 7)
                                        const isGap = levelView === 'Floor'
                                            ? index % 2 === 0  // Gap at 0, 2, 4, 6...
                                            : index % 2 !== 0; // Gap at 1, 3, 5, 7...

                                        return (
                                            <div
                                                key={rack}
                                                className={`flex flex-col flex-none w-16 ${isGap ? 'mr-24' : 'mr-1'}`}
                                            >


                                                <div className="flex flex-col gap-1">
                                                    {Array.from({ length: 12 }, (_, i) => 12 - i).map(bay => {
                                                        const items = getItemsInCell(rack, bay, levelView);
                                                        const hasItems = items.length > 0;
                                                        const isSelected = selectedLocation?.rack === rack && selectedLocation?.bay === bay && selectedLocation?.level === levelView;
                                                        const isGapBelow = bay % 2 !== 0 && bay !== 1; // Gap after odd numbers (11, 9...) except 1 (bottom)

                                                        return (
                                                            <div key={`${rack}-${bay}-container`} className={`w-full ${isGapBelow ? 'mb-1' : ''}`}>
                                                                <div
                                                                    key={`${rack}-${bay}-${levelView}`}
                                                                    draggable={hasItems && canEdit}
                                                                    onDragStart={(e) => handleCellDragStart(e, rack, bay, levelView)}
                                                                    onClick={() => setSelectedLocation({ rack, bay, level: levelView })}
                                                                    onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('ring-2', 'ring-green-400'); }}
                                                                    onDragLeave={(e) => { e.currentTarget.classList.remove('ring-2', 'ring-green-400'); }}
                                                                    onDrop={(e) => { e.currentTarget.classList.remove('ring-2', 'ring-green-400'); handleDropOnBin(e, rack, bay, levelView); }}
                                                                    onMouseEnter={(e) => handleCellHover(e, rack, bay, levelView, items)}
                                                                    onMouseLeave={handleCellLeave}
                                                                    className={`
                                                                    relative group cursor-pointer border rounded-sm transition-all h-8 w-full flex items-center justify-center
                                                                    ${isSelected ? 'ring-2 ring-primary border-primary z-10' : 'border-white/5'}
                                                                    ${hasItems
                                                                            ? 'bg-primary/20 hover:bg-primary/30 border-primary/30 text-primary-200'
                                                                            : 'bg-white/5 hover:bg-white/10 text-slate-600'}
                                                                `}
                                                                >
                                                                    <span className="text-[10px] font-bold absolute left-1 top-1/2 -translate-y-1/2 opacity-30 pointer-events-none">{bay}</span>

                                                                    {hasItems ? (
                                                                        <div className="flex flex-col items-center ml-2 transition-transform duration-200 group-hover:scale-125">
                                                                            <Package className="w-3 h-3 text-primary" />
                                                                            <span className="text-[10px] font-bold leading-none text-white">{items.length}</span>
                                                                        </div>
                                                                    ) : (
                                                                        <span className="opacity-0 group-hover:opacity-30 text-[8px] text-slate-400">.</span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>

                                                {/* Rack Label (Bottom) */}
                                                <div className="text-center font-bold text-slate-500 mt-2 py-1 bg-white/5 rounded border border-white/5">
                                                    {rack}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ) : STANDARD_RACKS.includes(selectedRack) ? (
                            // SPECIAL LAYOUT FOR Racks A-J: Rows=Bays(12-1), Cols=Levels(Floor-3)
                            // NOTE: Keeping this view read-only or unsupported for D&D for now or I should update it too.
                            // The user said "Visual Map", and they use the other views. Let's update this one too for consistency.
                            <>
                                {/* Header Row - Levels */}
                                <div className="flex mb-2 pl-12">
                                    {['Floor', '1', '2', '3'].map(levelDisplay => (
                                        <div key={levelDisplay} className={`w-10 mx-2 text-center text-[10px] font-bold text-slate-500 uppercase flex-none ${levelDisplay === 'Floor' ? 'mr-8' : ''}`}>
                                            {levelDisplay === 'Floor' ? 'FLR' : `L${levelDisplay}`}
                                        </div>
                                    ))}
                                </div>

                                {/* Body - Rows are Bays (12 down to 1) */}
                                {Array.from({ length: 12 }, (_, i) => 12 - i).map(bay => (
                                    <div key={bay} className="flex mb-1">
                                        {/* Row Label - Bay */}
                                        <div className="w-12 flex-none flex items-center justify-center text-[10px] font-bold text-slate-500 text-center px-1">
                                            {bay}
                                        </div>

                                        {/* Cells - Columns are Levels */}
                                        {['Floor', '1', '2', '3'].map(level => {
                                            const items = getItemsInCell(selectedRack, bay, level);
                                            const hasItems = items.length > 0;
                                            const isSelected = selectedLocation?.rack === selectedRack && selectedLocation?.bay === bay && selectedLocation?.level === level;

                                            return (
                                                <div
                                                    key={`${selectedRack}-${bay}-${level}`}
                                                    draggable={hasItems && canEdit}
                                                    onDragStart={(e) => handleCellDragStart(e, selectedRack, bay, level)}
                                                    onClick={() => setSelectedLocation({ rack: selectedRack, bay, level })}
                                                    onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('ring-2', 'ring-green-400'); }}
                                                    onDragLeave={(e) => { e.currentTarget.classList.remove('ring-2', 'ring-green-400'); }}
                                                    onDrop={(e) => { e.currentTarget.classList.remove('ring-2', 'ring-green-400'); handleDropOnBin(e, selectedRack, bay, level); }}
                                                    onMouseEnter={(e) => handleCellHover(e, selectedRack, bay, level, items)}
                                                    onMouseLeave={handleCellLeave}
                                                    className={`
                                                         mx-2 border rounded-sm cursor-pointer transition-all relative group
                                                         flex items-center justify-center text-xs w-10 h-10 aspect-square
                                                         ${level === 'Floor' ? 'mr-8' : ''}
                                                         ${isSelected ? 'ring-2 ring-primary border-primary z-10 shadow-[0_0_10px_rgba(139,92,246,0.5)]' : 'border-white/5'}
                                                         ${hasItems
                                                            ? 'bg-primary/20 hover:bg-primary/30 border-primary/30 text-primary-200'
                                                            : 'bg-white/5 hover:bg-white/10 text-slate-600'}
                                                     `}
                                                >
                                                    {hasItems ? (
                                                        <div className="flex flex-col items-center transition-transform duration-200 group-hover:scale-125">
                                                            <Package className={`w-3 h-3 ${isSelected ? 'text-white' : 'text-primary'}`} />
                                                            <span className={`text-[10px] font-bold leading-none ${isSelected ? 'text-white' : 'text-primary-100'}`}>{items.length}</span>
                                                        </div>
                                                    ) : (
                                                        <span className="opacity-0 group-hover:opacity-50 text-[10px] text-slate-400">.</span>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                ))}
                            </>
                        ) : (
                            // DEFAULT LAYOUT FOR OTHER AREAS (STG, ADJ)
                            <>
                                {/* Multi-Rack Grid Style for S, R, Z */}
                                <div className="flex gap-4 overflow-x-auto pb-4 pt-2 px-2">
                                    {Array.from({ length: currentBays }, (_, i) => i + 1).map(bay => (
                                        <div key={bay} className="flex flex-col flex-none w-16">
                                            {/* Vertical Levels */}
                                            <div className="flex flex-col gap-1">
                                                {currentLevels.map(level => {
                                                    const items = getItemsInCell(selectedRack, bay, level);
                                                    const hasItems = items.length > 0;
                                                    const isSelected = selectedLocation?.rack === selectedRack && selectedLocation?.bay === bay && selectedLocation?.level === level;

                                                    return (
                                                        <div
                                                            key={`${selectedRack}-${bay}-${level}`}
                                                            draggable={hasItems && canEdit}
                                                            onDragStart={(e) => handleCellDragStart(e, selectedRack, bay, level)}
                                                            onClick={() => setSelectedLocation({ rack: selectedRack, bay, level })}
                                                            onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('ring-2', 'ring-green-400'); }}
                                                            onDragLeave={(e) => { e.currentTarget.classList.remove('ring-2', 'ring-green-400'); }}
                                                            onDrop={(e) => { e.currentTarget.classList.remove('ring-2', 'ring-green-400'); handleDropOnBin(e, selectedRack, bay, level); }}
                                                            onMouseEnter={(e) => handleCellHover(e, selectedRack, bay, level, items)}
                                                            onMouseLeave={handleCellLeave}
                                                            className={`
                                                                relative group cursor-pointer border rounded-sm transition-all h-8 w-full flex items-center justify-center
                                                                ${isSelected ? 'ring-2 ring-primary border-primary z-10' : 'border-white/5'}
                                                                ${hasItems
                                                                    ? 'bg-primary/20 hover:bg-primary/30 border-primary/30 text-primary-200'
                                                                    : 'bg-white/5 hover:bg-white/10 text-slate-600'}
                                                            `}
                                                        >
                                                            {/* Level Number (Faint) */}
                                                            <span className="text-[10px] font-bold absolute left-1 top-1/2 -translate-y-1/2 opacity-30 pointer-events-none">
                                                                {level === 'Floor' ? 'F' : level}
                                                            </span>

                                                            {/* Content */}
                                                            {hasItems ? (
                                                                <div className="flex flex-col items-center ml-2 transition-transform duration-200 group-hover:scale-125">
                                                                    <Package className="w-3 h-3 text-primary" />
                                                                    <span className="text-[10px] font-bold leading-none text-white">{items.length}</span>
                                                                </div>
                                                            ) : (
                                                                <span className="opacity-0 group-hover:opacity-30 text-[8px] text-slate-400">.</span>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>

                                            {/* Column Label (Bottom) */}
                                            <div className="text-center font-bold text-slate-500 mt-2 py-1 bg-white/5 rounded border border-white/5">
                                                {selectedRack}{bay}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                </div>

                <div className="mt-4 flex gap-4 text-sm text-slate-500">
                    <div className="flex items-center gap-2"><div className="w-4 h-4 bg-primary/20 border border-primary/30 rounded"></div> Occupied</div>
                    <div className="flex items-center gap-2"><div className="w-4 h-4 bg-white/5 border border-white/10 rounded"></div> Empty</div>
                    <div className="flex items-center gap-2"><div className="w-4 h-4 border-2 border-primary rounded"></div> Selected</div>
                    <div className="flex items-center gap-2 text-slate-400 text-xs ml-auto">
                        {selectedRack === 'ALL'
                            ? `Overview Mode - Showing Level: ${levelView === 'Floor' ? 'Floor' : levelView}`
                            : `Area: ${getAreaName(selectedRack)} (${currentBays} Bays x ${currentLevels.length} Levels)`
                        }
                    </div>
                </div>
            </div>

            {/* Right: Cell Details */}
            <div className="w-full md:w-80 bg-slate-900/60 backdrop-blur-md rounded-xl shadow-lg border border-white/10 p-4 flex flex-col">
                <div className="flex justify-between items-center border-b border-white/10 pb-2 mb-4">
                    <h3 className="text-lg font-semibold text-white font-display uppercase tracking-wider">Bin Details</h3>
                </div>

                {selectedLocation ? (
                    <div className="flex-1 flex flex-col overflow-hidden">
                        <div className="mb-4 p-3 bg-primary/10 rounded-lg border border-primary/20 text-white flex justify-between items-center relative overflow-hidden">
                            <div className="absolute inset-0 bg-primary/5 blur-xl"></div>
                            <div className="relative z-10">
                                <span className="font-bold block text-sm uppercase tracking-wider text-primary">Selected Bin</span>
                                <span className="text-3xl font-bold font-display text-white">
                                    {selectedLocation.rack}-{selectedLocation.bay}-{selectedLocation.level}
                                </span>
                            </div>
                        </div>

                        <div className="p-3">
                            {/* Persistent Add Item Form (Outside Scroll) */}
                            {canEdit && (
                                <div className="mb-4">
                                    {isAddingItem ? (
                                        <div className="bg-slate-900 border border-white/10 p-3 rounded-lg shadow-inner">
                                            <h4 className="text-xs font-bold text-slate-300 mb-2">Add Item to Bin</h4>
                                            <div className="relative">
                                                <input
                                                    ref={newItemInputRef}
                                                    placeholder="Product Name or Code"
                                                    value={newItemCode}
                                                    onChange={(e) => { setNewItemCode(e.target.value); setShowDropdown(true); }}
                                                    onFocus={() => setShowDropdown(true)}
                                                    onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                                                    autoFocus
                                                    autoComplete="off"
                                                    className="w-full px-2 py-1.5 bg-black/40 border border-white/10 rounded text-sm mb-2 text-white placeholder-slate-500 focus:border-primary outline-none"
                                                />
                                                {/* Custom Dropdown */}
                                                {showDropdown && newItemCode && filteredProducts.length > 0 && (
                                                    <div className="absolute top-full left-0 w-64 mt-1 bg-slate-900 border border-white/20 rounded shadow-2xl z-50 max-h-48 overflow-y-auto">
                                                        {filteredProducts.map(p => (
                                                            <div
                                                                key={p.productCode}
                                                                onMouseDown={(e) => {
                                                                    e.preventDefault(); // Prevent blur
                                                                    setNewItemCode(p.name);
                                                                    setShowDropdown(false);
                                                                }}
                                                                className="px-3 py-2 hover:bg-slate-800 cursor-pointer border-b border-white/5 last:border-0"
                                                            >
                                                                <div className="text-xs font-bold text-slate-200 whitespace-normal">{p.name}</div>
                                                                <div className="text-[10px] text-slate-500 font-mono">{p.productCode}</div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                            <input
                                                type="number"
                                                inputMode="decimal"
                                                placeholder="Quantity"
                                                value={newItemQty}
                                                onChange={(e) => setNewItemQty(parseFloat(e.target.value))}
                                                className="w-full px-2 py-1.5 bg-black/40 border border-white/10 rounded text-sm mb-2 text-white placeholder-slate-500 focus:border-primary outline-none"
                                            />
                                            <div className="flex gap-2">
                                                <button type="button" onClick={handleAddItem} className="flex-1 bg-primary text-white py-1.5 rounded text-xs font-bold hover:bg-violet-600 border border-primary/50 shadow-[0_0_10px_rgba(139,92,246,0.2)]">Save</button>
                                                <button type="button" onClick={() => setIsAddingItem(false)} className="flex-1 bg-slate-800 text-slate-400 py-1.5 rounded text-xs font-bold hover:bg-slate-700 hover:text-white border border-white/5">Cancel</button>
                                            </div>
                                        </div>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => setIsAddingItem(true)}
                                            className="w-full py-2 bg-white/5 text-slate-400 rounded-lg border border-dashed border-white/10 hover:border-primary/50 hover:text-primary hover:bg-primary/5 transition-colors flex items-center justify-center gap-2 font-medium text-sm"
                                        >
                                            <Plus className="w-4 h-4" /> Add Item Here
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-3 mb-4 px-3">
                            {/* Empty State */}
                            {selectedCellItems.length === 0 && (
                                <div className="text-center py-6 text-slate-400 flex flex-col items-center">
                                    <Package className="w-10 h-10 mx-auto mb-2 opacity-30" />
                                    <p className="text-xs">No items in this bin</p>
                                </div>
                            )}

                            {/* Item List */}
                            {selectedCellItems.length > 0 && selectedCellItems.map(item => (
                                <div
                                    key={item.id}
                                    draggable={canEdit}
                                    onDragStart={(e) => handleDragStart(e, item)}
                                    className="p-3 border border-white/5 rounded-lg hover:border-primary/30 transition-all bg-slate-800/40 hover:bg-slate-800/60 cursor-grab active:cursor-grabbing"
                                >
                                    <div className="font-medium text-slate-200 text-base">{item.productName}</div>
                                    <div className="text-xs text-slate-500 font-mono mt-0.5 tracking-wider">{item.productCode}</div>

                                    {canEdit && editingItemId === item.id ? (
                                        <div className="flex items-center gap-2 mt-2">
                                            <input
                                                type="number"
                                                value={editQty}
                                                onChange={(e) => setEditQty(parseFloat(e.target.value))}
                                                className="w-20 px-2 py-1 border border-primary/50 bg-slate-900 text-white rounded text-sm focus:ring-1 focus:ring-primary outline-none"
                                            />
                                            <button type="button" onClick={() => handleUpdateQty(item)} className="p-1 bg-green-500/20 text-green-400 border border-green-500/30 rounded hover:bg-green-500/30"><Save className="w-4 h-4" /></button>
                                            <button type="button" onClick={() => setEditingItemId(null)} className="p-1 bg-slate-700 text-slate-400 rounded hover:bg-slate-600"><X className="w-4 h-4" /></button>
                                        </div>
                                    ) : (
                                        <>
                                            {/* Standard View */}
                                            {movingItemId !== item.id && copyingItemId !== item.id && (
                                                <>
                                                    <div className="flex justify-between items-center mt-2">
                                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${getCategoryColor(item.category)}`}>
                                                            {item.category}
                                                        </span>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-sm font-bold bg-black/40 text-primary border border-white/10 px-2.5 py-1 rounded shadow-inner font-mono">
                                                                {item.quantity} {item.unit}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    {item.lastCountedAt && (
                                                        <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-white/5 text-[10px] text-cyan-400 font-mono">
                                                            <ClipboardIcon className="w-3 h-3" />
                                                            <span>Verified: {new Date(item.lastCountedAt).toLocaleDateString()} {new Date(item.lastCountedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                        </div>
                                                    )}

                                                    {canEdit && !editingItemId && !movingItemId && !copyingItemId && (
                                                        <div className={`flex gap-2 ${item.lastCountedAt ? 'mt-3' : 'mt-3 pt-3 border-t border-white/5'}`}>
                                                            <button onClick={() => setMovingItemId(item.id)} className="flex-1 flex items-center justify-center gap-1 bg-slate-800 text-slate-300 py-1.5 rounded hover:bg-slate-700 hover:text-white border border-white/5 text-[10px] font-bold transition-colors">
                                                                <ArrowRightLeft className="w-3 h-3" /> Move
                                                            </button>
                                                            <button onClick={() => setCopyingItemId(item.id)} className="flex-1 flex items-center justify-center gap-1 bg-slate-800 text-slate-300 py-1.5 rounded hover:bg-slate-700 hover:text-white border border-white/5 text-[10px] font-bold transition-colors">
                                                                <Copy className="w-3 h-3" /> Copy
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setEditingItemId(item.id);
                                                                    setEditQty(item.quantity);
                                                                }}
                                                                className="flex-1 flex items-center justify-center gap-1 bg-slate-800 text-slate-300 py-1.5 rounded hover:bg-slate-700 hover:text-white border border-white/5 text-[10px] font-bold transition-colors"
                                                            >
                                                                Adjust
                                                            </button>
                                                            <button
                                                                onClick={() => handleStartCount(item)}
                                                                className="p-1.5 bg-blue-900/20 text-blue-400 rounded hover:bg-blue-900/40 hover:text-blue-300 border border-blue-900/30 transition-colors"
                                                                title="Cycle Count"
                                                            >
                                                                <ClipboardIcon className="w-4 h-4" />
                                                            </button>
                                                            <button onClick={() => handleDeleteItem(item)} className="p-1.5 bg-red-900/20 text-red-400 rounded hover:bg-red-900/40 hover:text-red-300 border border-red-900/30 transition-colors">
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    )}
                                                </>
                                            )}

                                            {/* Move/Copy UI */}
                                            {(movingItemId === item.id || copyingItemId === item.id) && (
                                                <div className="mt-2 text-xs bg-slate-900 border border-white/10 p-2 rounded relative z-50">
                                                    <div className="font-bold text-slate-300 mb-2 flex items-center gap-2">
                                                        {movingItemId === item.id ? <ArrowRightLeft className="w-3 h-3 text-amber-500" /> : <Copy className="w-3 h-3 text-green-500" />}
                                                        {movingItemId === item.id ? 'Move to Bin' : 'Duplicate to Bin'}
                                                    </div>

                                                    {/* Quantity Selection */}
                                                    <div className="flex bg-black/40 rounded p-1 mb-2">
                                                        <button
                                                            onClick={() => setMoveMode('FULL')}
                                                            className={`flex-1 py-1 rounded text-[10px] font-bold transition-colors ${moveMode === 'FULL' ? 'bg-slate-700 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}
                                                        >
                                                            ALL ({item.quantity})
                                                        </button>
                                                        <div className="w-px bg-white/10 mx-1"></div>
                                                        <button
                                                            onClick={() => { setMoveMode('PARTIAL'); setMoveQty(Math.floor(item.quantity / 2) || 1); }}
                                                            className={`flex-1 py-1 rounded text-[10px] font-bold transition-colors ${moveMode === 'PARTIAL' ? 'bg-slate-700 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}
                                                        >
                                                            PARTIAL
                                                        </button>
                                                    </div>

                                                    {moveMode === 'PARTIAL' && (
                                                        <div className="mb-2">
                                                            <input
                                                                type="number"
                                                                value={moveQty}
                                                                onChange={(e) => setMoveQty(parseFloat(e.target.value))}
                                                                className="w-full px-2 py-1 bg-black/40 border border-white/10 rounded text-center font-mono font-bold text-white focus:border-amber-500 outline-none"
                                                            />
                                                        </div>
                                                    )}

                                                    {/* Destination Selector */}
                                                    <div className="flex gap-1 mb-2">
                                                        <select
                                                            value={moveDest.rack}
                                                            onChange={(e) => setMoveDest({ ...moveDest, rack: e.target.value })}
                                                            className="w-12 px-1 py-1.5 text-xs border border-white/10 rounded bg-slate-950 text-white focus:border-purple-500 outline-none"
                                                        >
                                                            {Object.keys(AREA_CONFIG).map(r => <option key={r} value={r}>{r}</option>)}
                                                        </select>
                                                        <select
                                                            value={moveDest.bay}
                                                            onChange={(e) => setMoveDest({ ...moveDest, bay: parseInt(e.target.value) || 1 })}
                                                            className="flex-1 px-1 py-1.5 text-xs border border-white/10 rounded bg-slate-950 text-white focus:border-purple-500 outline-none"
                                                        >
                                                            {Array.from({ length: AREA_CONFIG[moveDest.rack]?.bays || 12 }, (_, i) => i + 1).map(b => (
                                                                <option key={b} value={b}>{b}</option>
                                                            ))}
                                                        </select>
                                                        <select
                                                            value={moveDest.level}
                                                            onChange={(e) => setMoveDest({ ...moveDest, level: e.target.value })}
                                                            className="w-16 px-1 py-1.5 text-xs border border-white/10 rounded bg-slate-950 text-white focus:border-purple-500 outline-none"
                                                        >
                                                            {AREA_CONFIG[moveDest.rack]?.levels.map(l => <option key={l} value={l}>{l === 'Floor' ? 'Flr' : l}</option>)}
                                                        </select>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <button onClick={() => handleMoveConfirm(item, copyingItemId === item.id)} className={`flex-1 text-white text-xs py-1.5 rounded transition-colors font-bold shadow-lg ${movingItemId === item.id ? 'bg-purple-600 hover:bg-purple-500 shadow-purple-900/20' : 'bg-green-600 hover:bg-green-500 shadow-green-900/20'}`}>{movingItemId === item.id ? 'Move' : 'Copy'}</button>
                                                        <button onClick={() => { setMovingItemId(null); setCopyingItemId(null); }} className="flex-1 bg-slate-800 text-slate-300 text-xs py-1.5 rounded hover:bg-slate-700 transition-colors border border-white/5">Cancel</button>
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            ))
                            }
                        </div>

                        {/* Quick Add Form - Only for Editiable Roles (Bottom fallback if items exist) */}
                        {canEdit && selectedCellItems.length > 0 ? (
                            null
                        ) : null}

                    </div>
                ) : (
                    <div className="text-center py-20 text-slate-400">
                        <Search className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>Select a bin on the map<br />to view or manage stock</p>
                    </div>
                )}
            </div>

            {/* Count Modal */}
            {isCountModalOpen && countItem && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-slate-900 border border-white/10 rounded-xl shadow-2xl max-w-sm w-full p-6">
                        <h3 className="text-lg font-bold text-white mb-4">Cycle Count</h3>
                        <div className="mb-4">
                            <label className="block text-xs uppercase text-slate-400 font-bold mb-1">Item</label>
                            <div className="text-slate-200">{countItem.productName}</div>
                        </div>
                        <div className="mb-6">
                            <label className="block text-xs uppercase text-slate-400 font-bold mb-1">Actual Quantity</label>
                            <input
                                type="number"
                                autoFocus
                                value={countQty}
                                onChange={(e) => setCountQty(e.target.value)}
                                className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-white focus:ring-2 focus:ring-primary outline-none font-mono text-lg"
                                placeholder="Enter qty..."
                            />
                        </div>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setIsCountModalOpen(false)}
                                className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSubmitCount}
                                disabled={!countQty}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Verify Count
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Global Floating Tooltip */}
            {tooltipData && (
                <div
                    className="fixed z-[100] bg-slate-900/95 backdrop-blur text-white text-sm p-3 rounded border border-white/20 shadow-xl pointer-events-none w-64"
                    style={{
                        left: tooltipData.x,
                        top: tooltipData.y,
                        transform: 'translateY(-50%)', // Center vertically relative to mouse/trigger
                    }}
                >
                    <div className="font-bold text-amber-500 border-b border-white/10 pb-1 mb-2 text-base">
                        {tooltipData.title}
                    </div>
                    {tooltipData.items.length > 0 ? (
                        tooltipData.items.map((item, idx) => (
                            <div key={item.id || idx} className="mb-2 last:mb-0 border-b border-white/5 last:border-0 pb-1 last:pb-0">
                                <div className="font-medium text-white text-sm mb-0.5 whitespace-normal leading-tight" title={item.productName}>{item.productName}</div>
                                <div className="text-slate-400 flex justify-between items-center text-xs font-mono">
                                    <span>Qty: <span className="text-primary-300">{item.quantity}</span> {item.unit}</span>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="text-slate-500 italic">Empty</div>
                    )}
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

export default WarehouseMap;