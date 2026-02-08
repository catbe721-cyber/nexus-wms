import React, { useState, useMemo, useEffect } from 'react';
import { InventoryItem, InventoryLocation, Product, MasterLocation, generateId } from '../types';
import { AREA_CONFIG, LEVELS, BAYS_PER_RACK } from '../consts/warehouse';
import { ArrowRightLeft, Search, MapPin, Box, ArrowRight, CheckCircle, Check } from 'lucide-react';
import { smartSearch, filterBinCodes, getEmbedLink } from '../utils';

interface StockMovementFormProps {
    products: Product[];
    inventory: InventoryItem[];
    masterLocations: MasterLocation[];
    onMove: (sourceItemId: string, destinationLoc: { rack: string, bay: number, level: string }, quantity: number) => void;
    onCancel: () => void;
}

const StockMovementForm: React.FC<StockMovementFormProps> = ({
    products,
    inventory,
    masterLocations,
    onMove,
    onCancel
}) => {
    // Step 1: Select Source Item
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedSourceItem, setSelectedSourceItem] = useState<InventoryItem | null>(null);

    // Step 2: Define Destination and Quantity
    const [moveQty, setMoveQty] = useState<number>(0);
    const [destinationSearch, setDestinationSearch] = useState('');
    const [selectedDestination, setSelectedDestination] = useState<MasterLocation | null>(null);

    // Custom Destination State (if not picking from master list)
    const [customDest, setCustomDest] = useState<{ rack: string, bay: number, level: string } | null>(null);

    // UI State
    const [showDestDropdown, setShowDestDropdown] = useState(false);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // --- Helpers ---

    // Filter Inventory Items based on Search
    const filteredInventory = useMemo(() => {
        if (!searchTerm) return [];
        const term = searchTerm.toLowerCase();
        return inventory.filter(item =>
            smartSearch(item, ['productCode', 'productName'], searchTerm)
        ).slice(0, 50); // Limit results
    }, [searchTerm, inventory]);

    // Filter Destinations
    const filteredDestinations = useMemo(() => {
        if (!destinationSearch) return [];

        return filterBinCodes(masterLocations, destinationSearch).slice(0, 10);
    }, [destinationSearch, masterLocations]);

    // Auto-dismiss success message
    useEffect(() => {
        if (successMessage) {
            const timer = setTimeout(() => {
                setSuccessMessage(null);
            }, 3000); // 3 seconds
            return () => clearTimeout(timer);
        }
    }, [successMessage]);

    // --- Handlers ---

    const handleSelectSource = (item: InventoryItem) => {
        setSelectedSourceItem(item);
        setSearchTerm(`${item.productName} (${item.productCode})`);
        setMoveQty(0);
        // Reset destination
        setDestinationSearch('');
        setSelectedDestination(null);
        setCustomDest(null);
    };

    const handleSelectDest = (loc: MasterLocation) => {
        setSelectedDestination(loc);
        setDestinationSearch(loc.binCode);
        setCustomDest({ rack: loc.rack, bay: loc.bay, level: loc.level });
        setShowDestDropdown(false);
    };

    const handleConfirmMove = () => {
        if (!selectedSourceItem || !customDest || moveQty <= 0) return;

        if (moveQty > selectedSourceItem.quantity) {
            // For now, simple alert if validation fails, or just ignore. 
            // Better UX would be a small error message, but let's stick to safe path.
            alert(`Cannot move ${moveQty}. Only ${selectedSourceItem.quantity} available.`);
            return;
        }

        // Execute Move
        onMove(selectedSourceItem.id, customDest, moveQty);

        // Show Success
        setSuccessMessage(`Moved ${moveQty} ${selectedSourceItem.unit} to ${destinationSearch} `);

        // Reset Form
        setSelectedSourceItem(null);
        setSearchTerm('');
        setMoveQty(0);
        setDestinationSearch('');
        setSelectedDestination(null);
        setCustomDest(null);
    };

    return (
        <div className="bg-slate-900/60 backdrop-blur-md rounded-xl shadow-[0_0_15px_rgba(0,0,0,0.5)] border border-white/10 p-6 max-w-4xl mx-auto flex flex-col min-h-[600px] animate-in fade-in slide-in-from-bottom-4 duration-300 relative overflow-hidden">

            {/* Success Toast Overlay */}
            {successMessage && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top-4 fade-in duration-300">
                    <div className="bg-green-500/20 backdrop-blur-md border border-green-500/50 text-green-300 px-6 py-3 rounded-full shadow-[0_0_20px_rgba(34,197,94,0.3)] flex items-center gap-2 font-bold font-display tracking-wide">
                        <Check className="w-5 h-5" />
                        {successMessage}
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="flex items-center gap-3 mb-8 border-b border-white/10 pb-4">
                <div className="bg-blue-500/20 p-2 rounded-lg border border-blue-500/50">
                    <ArrowRightLeft className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                    <h2 className="text-2xl font-bold text-white font-display uppercase tracking-wider">Stock Movement</h2>
                    <p className="text-slate-400 text-sm">Transfer inventory between bins securely.</p>
                </div>
            </div>

            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-8 relative">

                {/* Left: Source */}
                <div className="flex flex-col gap-4">
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <Box className="w-4 h-4" /> Source Item
                    </h3>

                    <div className="relative">
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={e => {
                                setSearchTerm(e.target.value);
                                if (selectedSourceItem && e.target.value !== `${selectedSourceItem.productName} (${selectedSourceItem.productCode})`) {
                                    setSelectedSourceItem(null);
                                }
                            }}
                            placeholder="Search Item to Move..."
                            className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-white focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                        {searchTerm && !selectedSourceItem && filteredInventory.length > 0 && (
                            <div className="absolute z-30 w-full mt-2 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-h-60 overflow-y-auto">
                                {filteredInventory.map(item => (
                                    <div
                                        key={item.id}
                                        onClick={() => handleSelectSource(item)}
                                        className="p-3 hover:bg-slate-800 cursor-pointer border-b border-slate-800 last:border-0"
                                    >
                                        <div className="flex justify-between items-start gap-3">
                                            {/* Image Thumbnail */}
                                            {item.image && (
                                                <div className="w-10 h-10 rounded bg-slate-800 border border-white/10 overflow-hidden flex-shrink-0 flex items-center justify-center">
                                                    <img src={getEmbedLink(item.image)} alt={item.productName} className="w-full h-full object-contain" />
                                                </div>
                                            )}
                                            <div className="flex-1">
                                                <p className="font-bold text-slate-200">{item.productName}</p>
                                                <p className="text-xs text-slate-500 font-mono">{item.productCode}</p>
                                            </div>
                                            <div className="text-right">
                                                <span className="block font-bold text-white bg-slate-800 px-2 py-1 rounded border border-white/10 text-xs">
                                                    {item.locations.map(l => `${l.rack} -${l.bay} -${l.level} `).join(', ')}
                                                </span>
                                                <span className="text-xs text-blue-400 mt-1 block font-mono">{item.quantity} {item.unit}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {selectedSourceItem && (
                        <div className="bg-slate-800/40 p-4 rounded-xl border border-white/5 animate-in fade-in">
                            {/* Product Image Preview */}
                            {selectedSourceItem.image && (
                                <div className="w-full h-32 bg-black/40 rounded-lg border border-white/10 overflow-hidden flex items-center justify-center mb-4">
                                    <img src={getEmbedLink(selectedSourceItem.image)} alt="Preview" className="h-full object-contain" />
                                </div>
                            )}

                            <div className="flex justify-between items-center mb-4">
                                <span className="text-xs text-slate-500 uppercase font-bold">Current Location</span>
                                <span className="font-mono font-bold text-white bg-blue-500/20 px-3 py-1 rounded text-blue-300 border border-blue-500/30">
                                    {selectedSourceItem.locations.map(l => `${l.rack}-${l.bay}-${l.level}`).join(', ')}
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-xs text-slate-500 uppercase font-bold">Max Available</span>
                                <span className="font-mono font-bold text-2xl text-white">
                                    {selectedSourceItem.quantity} <span className="text-sm text-slate-500 font-normal">{selectedSourceItem.unit}</span>
                                </span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Center Connector (Desktop) */}
                <div className="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-0 opacity-20 pointer-events-none">
                    <ArrowRight className="w-12 h-12 text-white" />
                </div>

                {/* Right: Destination */}
                <div className={`flex flex-col gap-4 transition-opacity duration-300 ${!selectedSourceItem ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}>
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <MapPin className="w-4 h-4" /> Destination
                    </h3>

                    <div className="relative">
                        <input
                            type="text"
                            value={destinationSearch}
                            onChange={e => {
                                setDestinationSearch(e.target.value);
                                setShowDestDropdown(true);
                            }}
                            onFocus={() => setShowDestDropdown(true)}
                            placeholder="Scan or Type Bin Code..."
                            className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-white focus:ring-2 focus:ring-green-500 outline-none font-mono"
                        />
                        {showDestDropdown && destinationSearch && filteredDestinations.length > 0 && (
                            <div className="absolute z-30 w-full mt-2 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-h-60 overflow-y-auto">
                                {filteredDestinations.map(loc => (
                                    <div
                                        key={loc.id}
                                        onClick={() => handleSelectDest(loc)}
                                        className="px-4 py-2 hover:bg-slate-800 cursor-pointer border-b border-slate-800 last:border-0 flex justify-between items-center"
                                    >
                                        <span className="font-bold text-white font-mono">{loc.binCode}</span>
                                        <span className="text-xs text-slate-500">Rack {loc.rack} • Level {loc.level}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="mt-4">
                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-2">Move Quantity</h3>
                        <input
                            type="number"
                            inputMode="decimal"
                            step="any"
                            min="0"
                            max={selectedSourceItem?.quantity || 0}
                            value={moveQty}
                            onChange={e => setMoveQty(parseFloat(e.target.value) || 0)}
                            className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-white font-bold text-xl outline-none focus:border-blue-500"
                        />
                    </div>

                </div>

            </div>

            {/* Footer Actions */}
            <div className="flex justify-end gap-4 mt-8 pt-6 border-t border-white/10">
                <button onClick={onCancel} className="px-6 py-3 text-slate-400 hover:text-white font-bold transition-colors">
                    Cancel
                </button>
                <button
                    onClick={handleConfirmMove}
                    disabled={!selectedSourceItem || moveQty <= 0 || !destinationSearch}
                    className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-blue-600/20 flex items-center gap-2 transition-all"
                >
                    <CheckCircle className="w-5 h-5" /> Confirm Move
                </button>
            </div>
        </div>
    );
};

export default StockMovementForm;
