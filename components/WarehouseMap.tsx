import React, { useState, useMemo } from 'react';
import { InventoryItem, InventoryLocation, STANDARD_RACKS, AREA_CONFIG, Product, generateId } from '../types';
import { Package, Search, MapPin, Plus, Save, Trash2, X, Lock, ArrowRightLeft, Layers, ChevronRight } from 'lucide-react';
import ConfirmModal, { ModalType } from './ConfirmModal';

interface WarehouseMapProps {
    inventory: InventoryItem[];
    products: Product[];
    onInventoryChange: (action: 'ADD' | 'UPDATE' | 'DELETE' | 'MOVE', item: InventoryItem, qtyDiff?: number, moveContext?: any) => void;
}

const WarehouseMap: React.FC<WarehouseMapProps> = ({ inventory, products, onInventoryChange }) => {
    // Default to first Staging Row
    const [selectedRack, setSelectedRack] = useState<string>('STG');
    const [selectedLocation, setSelectedLocation] = useState<InventoryLocation | null>(null);

    // Edit State
    const [isAddingItem, setIsAddingItem] = useState(false);
    const [newItemCode, setNewItemCode] = useState('');
    const [newItemQty, setNewItemQty] = useState(0);

    const [editingItemId, setEditingItemId] = useState<string | null>(null);
    const [editQty, setEditQty] = useState<number>(0);

    // Move State
    const [movingItemId, setMovingItemId] = useState<string | null>(null);
    const [moveDest, setMoveDest] = useState<{ rack: string, bay: number, level: string }>({ rack: 'A', bay: 1, level: '1' });
    const [moveMode, setMoveMode] = useState<'FULL' | 'PARTIAL'>('FULL');
    const [moveQty, setMoveQty] = useState<number>(0);

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

    // Permissions - Removed role based access
    const canEdit = true;

    // Current Dimensions based on selected rack
    // Safe lookup, default to STG-01 if missing
    const currentConfig = AREA_CONFIG[selectedRack] || AREA_CONFIG['STG-01'];
    const currentBays = currentConfig?.bays || 12;
    const currentLevels = currentConfig?.levels || ['Floor'];

    // Helper to find items in a specific cell
    const getItemsInCell = (rack: string, bay: number, level: string) => {
        return inventory.filter(item =>
            item.locations.some(loc =>
                loc.rack === rack &&
                // Loose equality check for bay/level to handle potential string/number mismatches
                String(loc.bay) === String(bay) &&
                String(loc.level) === String(level)
            )
        );
    };

    const selectedCellItems = useMemo(() => {
        if (!selectedLocation) return [];
        return getItemsInCell(selectedLocation.rack, selectedLocation.bay, selectedLocation.level);
    }, [selectedLocation, inventory]);

    const getCategoryColor = (cat: string) => {
        const upperCat = cat.toUpperCase();
        if (upperCat === 'RTE') return 'bg-green-100 text-green-700';
        if (upperCat === 'RAW') return 'bg-red-100 text-red-700';
        if (upperCat === 'FG') return 'bg-blue-100 text-blue-700';
        if (upperCat === 'WIP') return 'bg-amber-100 text-amber-700';
        if (['PKG', 'PIB', 'PBX', 'PFL'].includes(upperCat)) return 'bg-purple-100 text-purple-700';
        return 'bg-gray-100 text-gray-700';
    };

    // Actions
    const handleAddItem = () => {
        if (!canEdit) return;
        if (!selectedLocation) return;

        const inputVal = newItemCode.trim();
        // Match by Name (exact or case-insensitive) or Code
        const product = products.find(p =>
            p.name.toLowerCase() === inputVal.toLowerCase() ||
            p.productCode.toLowerCase() === inputVal.toLowerCase()
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

    const handleMoveConfirm = (item: InventoryItem) => {
        if (!canEdit) return;

        const qtyToMove = moveMode === 'FULL' ? item.quantity : moveQty;

        // Validation
        if (qtyToMove <= 0) {
            showAlert("Invalid Quantity", "Quantity to move must be greater than 0.");
            return;
        }
        if (qtyToMove > item.quantity) {
            showAlert("Invalid Quantity", "Cannot move more than available quantity.");
            return;
        }

        // Determine if this is effectively a full move (even if selected as partial)
        const isFullMove = qtyToMove === item.quantity;

        // Construct Dest Location Object
        const dest: InventoryLocation = { rack: moveDest.rack, bay: moveDest.bay, level: moveDest.level };

        // Check if moving to same spot
        if (item.locations[0] &&
            dest.rack === item.locations[0].rack &&
            dest.bay === item.locations[0].bay &&
            dest.level === item.locations[0].level
        ) {
            setMovingItemId(null); // No op
            return;
        }

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

                // 2. Handle Source
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
            // SCENARIO 2: Move to empty slot (or slot without this product)
            else {
                if (isFullMove) {
                    // Standard Full Move
                    const updatedItem = { ...item, locations: [dest], updatedAt: Date.now() };
                    onInventoryChange('MOVE', updatedItem, 0, { previousLocation: item.locations[0] });
                } else {
                    // Partial Move to Empty Slot
                    // 1. Create New Item at Dest
                    const newItem: InventoryItem = {
                        ...item,
                        id: generateId(),
                        quantity: qtyToMove,
                        locations: [dest],
                        updatedAt: Date.now()
                    };
                    onInventoryChange('ADD', newItem, qtyToMove);

                    // 2. Update Source
                    const remainingQty = item.quantity - qtyToMove;
                    const updatedSourceItem = { ...item, quantity: remainingQty, updatedAt: Date.now() };
                    onInventoryChange('UPDATE', updatedSourceItem, -qtyToMove);
                }
            }
            setMovingItemId(null);
        };

        if (existingDestItem) {
            showConfirm(
                "Merge with Existing Item?",
                `Destination bin already contains ${item.productName}. Merge ${qtyToMove} units into it?`,
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

                    {/* Zone Selector Bar */}
                    <div className="flex gap-2 p-1 bg-black/40 rounded-lg overflow-x-auto">
                        <button
                            onClick={() => { setSelectedRack('STG'); setSelectedLocation(null); }}
                            className={`px-4 py-1 text-sm font-bold rounded transition-colors whitespace-nowrap ${selectedRack === 'STG' ? 'bg-amber-500 text-black' : 'bg-slate-800 text-slate-400 hover:text-amber-400'}`}
                        >
                            STAGING
                        </button>
                        <button
                            onClick={() => { setSelectedRack('ADJ'); setSelectedLocation(null); }}
                            className={`px-4 py-1 text-sm font-bold rounded transition-colors whitespace-nowrap ${selectedRack === 'ADJ' ? 'bg-purple-500 text-white' : 'bg-slate-800 text-slate-400 hover:text-purple-400'}`}
                        >
                            ADJUSTMENT
                        </button>
                    </div>

                    {/* Standard Racks Bar */}
                    <div className="flex gap-2 overflow-x-auto pb-2 border-t border-white/5 pt-2">
                        <div className="px-2 flex items-center text-xs font-bold text-slate-500 uppercase tracking-wider bg-white/5 rounded">Racks</div>
                        {STANDARD_RACKS.map(rack => (
                            <button
                                key={rack}
                                type="button"
                                onClick={() => {
                                    setSelectedRack(rack);
                                    setSelectedLocation(null);
                                }}
                                className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${selectedRack === rack
                                    ? 'bg-primary text-white shadow-[0_0_10px_rgba(139,92,246,0.6)] border border-primary/50'
                                    : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white border border-white/5'
                                    }`}
                            >
                                {rack}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex-1 overflow-auto bg-slate-950/50 border border-white/5 rounded-lg p-4 relative shadow-inner">
                    {/* STANDARD GRID RENDERER */}
                    <div className="min-w-fit">
                        {/* Header Row for Bays */}
                        <div className="flex mb-2 pl-12">
                            {Array.from({ length: currentBays }, (_, i) => i + 1).map(bay => (
                                <div key={bay} className="w-10 mx-0.5 text-center text-[10px] font-bold text-slate-500 uppercase flex-none">
                                    {bay}
                                </div>
                            ))}
                        </div>

                        {/* Grid Rows for Levels */}
                        {currentLevels.map(level => (
                            <div key={level} className="flex mb-2">
                                {/* Level Label */}
                                <div className="w-12 flex-none flex items-center justify-center text-[10px] font-bold text-slate-500 text-center px-1">
                                    {level === 'Floor' ? 'FLR' : (['STG', 'ADJ'].includes(selectedRack) ? `P${level}` : `L${level}`)}
                                </div>

                                {/* Cells */}
                                {Array.from({ length: currentBays }, (_, i) => i + 1).map(bay => {
                                    const items = getItemsInCell(selectedRack, bay, level);
                                    const hasItems = items.length > 0;
                                    const isSelected = selectedLocation?.rack === selectedRack && selectedLocation?.bay === bay && selectedLocation?.level === level;

                                    return (
                                        <div
                                            key={`${selectedRack}-${bay}-${level}`}
                                            onClick={() => setSelectedLocation({ rack: selectedRack, bay, level })}
                                            className={`
                                             mx-0.5 border rounded-sm cursor-pointer transition-all relative group
                                             flex items-center justify-center text-xs w-10 h-10 aspect-square
                                             ${isSelected ? 'ring-2 ring-primary border-primary z-10 shadow-[0_0_10px_rgba(139,92,246,0.5)]' : 'border-white/5'}
                                             ${hasItems
                                                    ? 'bg-primary/20 hover:bg-primary/30 border-primary/30 text-primary-200'
                                                    : 'bg-white/5 hover:bg-white/10 text-slate-600'}
                                         `}
                                        >
                                            {hasItems ? (
                                                <div className="flex flex-col items-center">
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
                    </div>
                </div>

                <div className="mt-4 flex gap-4 text-sm text-slate-500">
                    <div className="flex items-center gap-2"><div className="w-4 h-4 bg-green-100 border border-green-300 rounded"></div> Occupied</div>
                    <div className="flex items-center gap-2"><div className="w-4 h-4 bg-white border border-slate-300 rounded"></div> Empty</div>
                    <div className="flex items-center gap-2"><div className="w-4 h-4 border-2 border-primary rounded"></div> Selected</div>
                    <div className="flex items-center gap-2 text-slate-400 text-xs ml-auto">
                        Area: {selectedRack} ({currentBays} Bays x {currentLevels.length} Levels)
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

                        <div className="flex-1 overflow-y-auto space-y-3 mb-4">
                            {selectedCellItems.length > 0 ? (
                                selectedCellItems.map(item => (
                                    <div key={item.id} className="p-3 border border-white/5 rounded-lg hover:border-primary/30 transition-all bg-slate-800/40 hover:bg-slate-800/60">
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
                                                {movingItemId !== item.id && (
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

                                                        {canEdit && !editingItemId && !movingItemId && (
                                                            <div className="flex justify-end gap-3 mt-3 pt-3 border-t border-white/5">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setMovingItemId(item.id);
                                                                        setMoveDest({ ...selectedLocation }); // Default to current
                                                                        setMoveMode('FULL');
                                                                        setMoveQty(item.quantity);
                                                                    }}
                                                                    className="text-xs text-purple-400 hover:text-purple-300 hover:underline flex items-center gap-1 transition-colors"
                                                                >
                                                                    <ArrowRightLeft className="w-3 h-3" /> Move
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setEditingItemId(item.id);
                                                                        setEditQty(item.quantity);
                                                                    }}
                                                                    className="text-xs text-blue-400 hover:text-blue-300 hover:underline transition-colors"
                                                                >
                                                                    Adjust
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleDeleteItem(item)}
                                                                    className="text-xs text-red-400 hover:text-red-300 hover:underline transition-colors"
                                                                >
                                                                    Remove
                                                                </button>
                                                            </div>
                                                        )}
                                                    </>
                                                )}

                                                {/* Move View */}
                                                {movingItemId === item.id && (
                                                    <div className="mt-2 bg-slate-900/80 p-3 rounded border border-purple-500/30 shadow-inner">
                                                        <div className="text-xs font-bold text-purple-400 mb-2 flex items-center gap-1">
                                                            <Layers className="w-3 h-3" /> Move Item
                                                        </div>

                                                        {/* Move Mode Toggle */}
                                                        <div className="flex gap-4 mb-3 text-xs text-slate-300">
                                                            <label className="flex items-center gap-2 cursor-pointer hover:text-white">
                                                                <input
                                                                    type="radio"
                                                                    checked={moveMode === 'FULL'}
                                                                    onChange={() => { setMoveMode('FULL'); setMoveQty(item.quantity); }}
                                                                    className="accent-purple-500"
                                                                />
                                                                Full ({item.quantity})
                                                            </label>
                                                            <label className="flex items-center gap-2 cursor-pointer hover:text-white">
                                                                <input
                                                                    type="radio"
                                                                    checked={moveMode === 'PARTIAL'}
                                                                    onChange={() => { setMoveMode('PARTIAL'); setMoveQty(Math.floor(item.quantity / 2) || 1); }}
                                                                    className="accent-purple-500"
                                                                />
                                                                Partial
                                                            </label>
                                                        </div>

                                                        {/* Partial Qty Input */}
                                                        {moveMode === 'PARTIAL' && (
                                                            <div className="mb-2">
                                                                <input
                                                                    type="number"
                                                                    min="1"
                                                                    max={item.quantity}
                                                                    value={moveQty}
                                                                    onChange={(e) => setMoveQty(Math.min(parseInt(e.target.value) || 0, item.quantity))}
                                                                    className="w-full px-2 py-1.5 text-xs border border-purple-500/30 rounded focus:ring-1 focus:ring-purple-500 bg-slate-950 text-white placeholder-slate-500"
                                                                    placeholder="Qty to move"
                                                                />
                                                            </div>
                                                        )}

                                                        <div className="text-[10px] text-slate-400 mb-1 uppercase tracking-wider font-bold">To Location</div>
                                                        <div className="flex gap-1 mb-3">
                                                            <select
                                                                value={moveDest.rack}
                                                                onChange={(e) => setMoveDest({ ...moveDest, rack: e.target.value })}
                                                                className="w-16 px-1 py-1.5 text-xs border border-white/10 rounded bg-slate-950 text-white focus:border-purple-500 outline-none"
                                                            >
                                                                {Object.keys(AREA_CONFIG).map(r => <option key={r} value={r}>{r}</option>)}
                                                            </select>

                                                            {/* Dynamic Range based on destination Rack */}
                                                            <input
                                                                type="number"
                                                                min="1"
                                                                max={AREA_CONFIG[moveDest.rack]?.bays || 12}
                                                                value={moveDest.bay}
                                                                onChange={(e) => setMoveDest({ ...moveDest, bay: parseInt(e.target.value) || 1 })}
                                                                className="w-12 px-1 py-1.5 text-xs border border-white/10 rounded bg-slate-950 text-white focus:border-purple-500 outline-none"
                                                                title={`1-${AREA_CONFIG[moveDest.rack]?.bays}`}
                                                            />

                                                            <select
                                                                value={moveDest.level}
                                                                onChange={(e) => setMoveDest({ ...moveDest, level: e.target.value })}
                                                                className="w-16 px-1 py-1.5 text-xs border border-white/10 rounded bg-slate-950 text-white focus:border-purple-500 outline-none"
                                                            >
                                                                {AREA_CONFIG[moveDest.rack]?.levels.map(l => <option key={l} value={l}>{l === 'Floor' ? 'Flr' : l}</option>)}
                                                            </select>
                                                        </div>
                                                        <div className="flex gap-2">
                                                            <button onClick={() => handleMoveConfirm(item)} className="flex-1 bg-purple-600 text-white text-xs py-1.5 rounded hover:bg-purple-500 transition-colors font-bold shadow-lg shadow-purple-900/20">Confirm</button>
                                                            <button onClick={() => setMovingItemId(null)} className="flex-1 bg-slate-800 text-slate-300 text-xs py-1.5 rounded hover:bg-slate-700 transition-colors border border-white/5">Cancel</button>
                                                        </div>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-10 text-slate-400">
                                    <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
                                    <p>No items in this bin</p>
                                </div>
                            )}
                        </div>

                        {/* Quick Add Form - Only for Editiable Roles */}
                        {canEdit ? (
                            <>
                                {isAddingItem ? (
                                    <div className="bg-slate-900 border border-white/10 p-3 rounded-lg shadow-inner">
                                        <h4 className="text-xs font-bold text-slate-300 mb-2">Add Item to Bin</h4>
                                        <input
                                            list="product-options"
                                            placeholder="Product Name or Code"
                                            value={newItemCode}
                                            onChange={(e) => setNewItemCode(e.target.value)}
                                            className="w-full px-2 py-1.5 bg-black/40 border border-white/10 rounded text-sm mb-2 text-white placeholder-slate-500 focus:border-primary outline-none"
                                        />
                                        <datalist id="product-options">
                                            {products.map(p => <option key={p.code} value={p.name}>{p.code}</option>)}
                                        </datalist>
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
                            </>
                        ) : (
                            <div className="bg-slate-800/50 p-4 rounded-lg border border-white/5 text-center">
                                <p className="text-xs text-slate-500">You do not have permission to modify bin contents.</p>
                            </div>
                        )}

                    </div>
                ) : (
                    <div className="text-center py-20 text-slate-400">
                        <Search className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>Select a bin on the map<br />to view or manage stock</p>
                    </div>
                )}
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
};

export default WarehouseMap;