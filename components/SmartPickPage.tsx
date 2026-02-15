import React, { useState, useEffect, useRef } from 'react';
import { Upload, Trash2, Calendar, FileText, Check, Settings, Loader2, Image as ImageIcon, Search, AlertCircle, X, PackageMinus, Plus } from 'lucide-react';
import { InventoryItem, Product } from '../types';
import { smartSearch, getEmbedLink } from '../utils'; // Add getEmbedLink import
import { PICKING_RULES } from '../config/pickingConfig';
import { getImageFromDB, deleteImageFromDB } from '../imageDB'; // Keep get/delete for legacy support, remove save usage

// --- Interfaces ---
interface PickItem {
    id: string;
    item: string;
    qty: number;
    uom: string;
}

interface ManifestData {
    dateId: string;
    formattedDate: string;
    processedResults: {
        Pallet1Items: PickItem[];
        Pallet2Items: PickItem[];
        Pallet3Items: PickItem[];
        MiscellaneousItems: PickItem[];
        totalValidItems: number;
    };
    pickedState: Record<string, boolean>;
    originalImage?: string;
}

interface SmartPickPageProps {
    inventory: InventoryItem[];
    products: Product[];
    onProcessOutbound: (items: any[], note?: string) => void;
}

const CONFIG = {
    API_URL_PREFIX: 'https://generativelanguage.googleapis.com/v1beta/models/',
    API_MODEL: 'gemini-2.5-flash'
};

export default function SmartPickPage({ inventory, products, onProcessOutbound }: SmartPickPageProps) {
    // --- State ---
    const [manifests, setManifests] = useState<Record<string, ManifestData>>(() => {
        try {
            const saved = localStorage.getItem('nexuswms_smartpick_manifests');
            return saved ? JSON.parse(saved) : {};
        } catch (e) { return {}; }
    });
    const [currentDateId, setCurrentDateId] = useState<string | null>(null);
    const [previewImg, setPreviewImg] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [displayImage, setDisplayImage] = useState<string | null>(null);
    const [expandedImage, setExpandedImage] = useState<string | null>(null);

    // Manual Entry State
    const [manualItemName, setManualItemName] = useState('');
    const [manualItemQty, setManualItemQty] = useState(1);
    const [showManualDropdown, setShowManualDropdown] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // --- Persistence ---
    useEffect(() => {
        try {
            // OPTIMIZATION: Only keep the 20 most recent manifests locally
            const MAX_MANIFESTS = 20;
            const dates = Object.keys(manifests).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

            if (dates.length > MAX_MANIFESTS) {
                const authorizedKeys = new Set(dates.slice(0, MAX_MANIFESTS));
                const prunedManifests: Record<string, ManifestData> = {};

                authorizedKeys.forEach(key => {
                    if (manifests[key]) prunedManifests[key] = manifests[key];
                });

                localStorage.setItem('nexuswms_smartpick_manifests', JSON.stringify(prunedManifests));
            } else {
                localStorage.setItem('nexuswms_smartpick_manifests', JSON.stringify(manifests));
            }
        } catch (e) { console.error("Failed to save manifests", e); }
    }, [manifests]);

    // --- Image Loading ---
    useEffect(() => {
        const loadImg = async () => {
            if (!currentDateId) {
                setDisplayImage(null);
                return;
            }
            const m = manifests[currentDateId];
            if (m?.originalImage) {
                if (m.originalImage.startsWith('http')) {
                    setDisplayImage(getEmbedLink(m.originalImage) || m.originalImage);
                } else if (m.originalImage.startsWith('data:')) {
                    setDisplayImage(m.originalImage);
                } else {
                    const img = await getImageFromDB(m.originalImage);
                    setDisplayImage(img || null);
                }
            } else {
                setDisplayImage(null);
            }
        };
        loadImg();
    }, [currentDateId, manifests]);

    // --- Helpers ---
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                if (ev.target?.result) setPreviewImg(ev.target.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const processResults = (items: PickItem[]) => {
        const p1: PickItem[] = [];
        const p2: PickItem[] = [];
        const p3: PickItem[] = [];
        const misc: PickItem[] = [];

        items.forEach(i => {
            const name = i.item.toLowerCase();
            // Simple keyword matching based on config
            if (PICKING_RULES.P1_KEYWORDS.some(k => name.includes(k))) p1.push(i);
            else if (PICKING_RULES.P2_KEYWORDS.some(k => name.includes(k))) p2.push(i);
            else if (PICKING_RULES.P3_UOMS.includes(i.uom as any)) p3.push(i);
            else misc.push(i);
        });

        return {
            Pallet1Items: p1,
            Pallet2Items: p2,
            Pallet3Items: p3,
            MiscellaneousItems: misc,
            totalValidItems: items.length
        };
    };

    const processImage = async () => {
        const file = fileInputRef.current?.files?.[0];
        if (!file) return;

        const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
        if (!apiKey) {
            setError("API Key not found (VITE_GEMINI_API_KEY). Check .env file.");
            return;
        }

        setLoading(true);
        setError(null);

        try {
            if (!previewImg) throw new Error("Image not loaded");

            // Optimize Image Size (Resize to max 1024px)
            const resizeImage = (dataUrl: string): Promise<string> => {
                return new Promise((resolve) => {
                    const img = new Image();
                    img.src = dataUrl;
                    img.onload = () => {
                        const canvas = document.createElement('canvas');
                        let width = img.width;
                        let height = img.height;
                        const maxDim = 1024;

                        if (width > maxDim || height > maxDim) {
                            if (width > height) {
                                height = Math.round((height * maxDim) / width);
                                width = maxDim;
                            } else {
                                width = Math.round((width * maxDim) / height);
                                height = maxDim;
                            }
                        }

                        canvas.width = width;
                        canvas.height = height;
                        const ctx = canvas.getContext('2d');
                        ctx?.drawImage(img, 0, 0, width, height);
                        resolve(canvas.toDataURL('image/jpeg', 0.8)); // 80% quality
                    };
                });
            };

            const resizedBase64Url = await resizeImage(previewImg);
            const base64 = resizedBase64Url.split(',')[1];

            if (!base64) throw new Error("Image processing failed");

            // 1. Start Gemini Analysis
            const prompt = "Extract Date (YYYY-MM-DD), Item, UoM, Qty where Qty > 0. Response JSON format: {date: string, items: Array<{item: string, uom: string, qty: number}>}";
            const schema = { type: "OBJECT", properties: { date: { type: "STRING" }, items: { type: "ARRAY", items: { type: "OBJECT", properties: { item: { type: "STRING" }, uom: { type: "STRING" }, qty: { type: "NUMBER" } }, required: ["item", "uom", "qty"] } } }, required: ["date", "items"] };
            const url = `${CONFIG.API_URL_PREFIX}${CONFIG.API_MODEL}:generateContent?key=${apiKey}`;

            const geminiReq = fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType: file.type, data: base64 } }] }],
                    generationConfig: { responseMimeType: "application/json", responseSchema: schema }
                })
            });

            // 2. Wait for Gemini Analysis First (to get the date)
            const response = await geminiReq;

            if (!response.ok) {
                const errorText = await response.text();
                console.error("Gemini API Error Details:", errorText);
                throw new Error(`API Error: ${response.status} ${response.statusText} - ${errorText}`);
            }

            const res = await response.json();
            const data = JSON.parse(res.candidates[0].content.parts[0].text);

            const items: PickItem[] = data.items.map((it: any, idx: number) => ({
                ...it,
                id: `item-${Date.now()}-${idx}`,
                uom: it.uom === '板' ? 'PLT' : it.uom
            }));

            const results = processResults(items);

            // Robust Date Parsing
            let dateObj = new Date(data.date);
            if (isNaN(dateObj.getTime())) {
                console.warn("Invalid date from Gemini:", data.date, "Falling back to today.");
                dateObj = new Date();
            }

            // Fix timezone offset issues by treating the YYYY-MM-DD as local 
            // If Gemini returns YYYY-MM-DD, new Date() might treat it as UTC.
            // Let's ensure we just use the components if it matches the pattern
            if (/^\d{4}-\d{2}-\d{2}$/.test(data.date)) {
                const [y, m, d] = data.date.split('-').map(Number);
                dateObj = new Date(y, m - 1, d);
            }

            const formattedDate = dateObj.toLocaleDateString(); // e.g., 2/15/2026/
            const dateFilename = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            const newFilename = `SmartPick_${dateFilename}.jpg`;

            console.log("Renaming image to:", newFilename);

            // Use dateObj string for dateId to be safe
            const safeDateId = dateObj.toISOString().split('T')[0];

            // 3. Skip Drive Upload (User requested to disable storage for speed)
            console.log("Skipping Drive upload as per configuration.");

            /* 
            // Previous Upload Logic (Disabled)
            let driveUrl = '';
            const gasUrl = localStorage.getItem('nexuswms_gas_config') ? JSON.parse(localStorage.getItem('nexuswms_gas_config')!).url : '';

            if (gasUrl) {
                try {
                    // Create a new File object with the new name
                    const renamedFile = new File([file], newFilename, { type: file.type });

                    // Upload to "Pick Lists" folder
                    driveUrl = await import('../services/gasApi').then(mod => mod.GASService.uploadImage(gasUrl, renamedFile, 'Pick Lists'));
                    console.log("Image uploaded successfully:", driveUrl);

                    // Force a small delay to allow drive propagation if needed?
                } catch (err) {
                    console.error("Auto-upload failed:", err);
                    alert("Warning: Auto-upload to Drive failed. Image not saved to cloud.");
                }
            }
            */

            const newManifest: ManifestData = {
                dateId: safeDateId,
                formattedDate,
                processedResults: results,
                pickedState: {},
                originalImage: undefined // Do not store image
            };

            setManifests(prev => ({ ...prev, [safeDateId]: newManifest }));
            setCurrentDateId(safeDateId);
            setPreviewImg(null);
            if (fileInputRef.current) fileInputRef.current.value = '';

        } catch (e: any) {
            setError(e.message || "Failed to process image");
        } finally {
            setLoading(false);
        }
    };

    const handleSaveToDrive = async () => {
        if (!currentDateId) return;
        const m = manifests[currentDateId];
        if (!m || !m.originalImage) return;

        setLoading(true);
        try {
            // Get image data
            let base64 = '';
            if (m.originalImage.startsWith('data:')) {
                base64 = m.originalImage;
            } else {
                const img = await getImageFromDB(m.originalImage);
                if (img) base64 = img;
            }

            if (!base64) throw new Error("Image data not found");

            // Convert base64 to File object for upload
            const res = await fetch(base64);
            const blob = await res.blob();
            const file = new File([blob], `SmartPick_${currentDateId}.jpg`, { type: 'image/jpeg' });

            const gasUrl = localStorage.getItem('nexuswms_gas_config') ? JSON.parse(localStorage.getItem('nexuswms_gas_config')!).url : '';
            if (!gasUrl) throw new Error("Google Apps Script URL not configured");

            // Upload to "Pick Lists" subfolder
            await import('../services/gasApi').then(mod => mod.GASService.uploadImage(gasUrl, file, 'Pick Lists'));

            alert("Image saved to Google Drive (Folder: Pick Lists)!");

        } catch (e: any) {
            console.error(e);
            alert("Failed to save to Drive: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleAddItem = (newItemName: string, newItemQty: number, newItemUom: string) => {
        if (!currentDateId) return;

        const newItem: PickItem = {
            id: `manual-${Date.now()}`,
            item: newItemName,
            qty: newItemQty,
            uom: newItemUom
        };

        setManifests(prev => {
            const m = prev[currentDateId];
            const allItems = [
                ...m.processedResults.Pallet1Items,
                ...m.processedResults.Pallet2Items,
                ...m.processedResults.Pallet3Items,
                ...m.processedResults.MiscellaneousItems,
                newItem
            ];

            const newResults = processResults(allItems);
            return { ...prev, [currentDateId]: { ...m, processedResults: newResults } };
        });
    };

    const handleDeleteItem = (itemId: string) => {
        if (!currentDateId) return;

        setManifests(prev => {
            const m = prev[currentDateId];
            const newResults = { ...m.processedResults };

            (['Pallet1Items', 'Pallet2Items', 'Pallet3Items', 'MiscellaneousItems'] as const).forEach(key => {
                newResults[key] = newResults[key].filter(i => i.id !== itemId);
            });

            let allItemsCount = 0;
            (['Pallet1Items', 'Pallet2Items', 'Pallet3Items', 'MiscellaneousItems'] as const).forEach(key => {
                allItemsCount += newResults[key].length;
            });

            newResults.totalValidItems = allItemsCount;

            return { ...prev, [currentDateId]: { ...m, processedResults: newResults } };
        });
    };

    const handleUpdateItemQty = (itemId: string, newQty: number) => {
        if (!currentDateId || newQty < 0) return;

        setManifests(prev => {
            const m = prev[currentDateId];
            const newResults = { ...m.processedResults };

            (['Pallet1Items', 'Pallet2Items', 'Pallet3Items', 'MiscellaneousItems'] as const).forEach(key => {
                newResults[key] = newResults[key].map(i => i.id === itemId ? { ...i, qty: newQty } : i);
            });

            return { ...prev, [currentDateId]: { ...m, processedResults: newResults } };
        });
    };

    const toggleItem = (itemId: string) => {
        if (!currentDateId) return;
        setManifests(prev => {
            const m = prev[currentDateId];
            const isChecked = !!m.pickedState[itemId];
            const newState = { ...m.pickedState };
            if (isChecked) delete newState[itemId];
            else newState[itemId] = true;
            return { ...prev, [currentDateId]: { ...m, pickedState: newState } };
        });
    };

    const deleteCurrent = async () => {
        if (!currentDateId) return;
        const newManifests = { ...manifests };
        delete newManifests[currentDateId];
        setManifests(newManifests);

        // Remove from DB
        await deleteImageFromDB(currentDateId);

        const remaining = Object.keys(newManifests).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
        setCurrentDateId(remaining[0] || null);
    };

    const currentManifest = currentDateId ? manifests[currentDateId] : null;

    const manualFilteredProducts = products.filter(p =>
        (p.productCode || '').toLowerCase().includes(manualItemName.toLowerCase()) ||
        (p.name || '').toLowerCase().includes(manualItemName.toLowerCase())
    ).slice(0, 8);

    // --- Render Helpers ---

    const PalletCard = ({ title, colorClass, items, note, borderClass }: { title: string, colorClass: string, items: PickItem[], note?: string, borderClass: string }) => {
        if (!items || items.length === 0) return null;

        const total = items.length;
        const checked = items.filter(i => currentManifest?.pickedState[i.id]).length;
        const progress = Math.round((checked / total) * 100);
        const isDone = progress === 100;

        return (
            <div className={`bg-slate-800/40 rounded-xl p-5 mb-6 border-l-4 ${borderClass} border-white/5 shadow-sm backdrop-blur-sm`}>
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h3 className={`font-bold text-slate-200 text-lg flex items-center gap-2`}>
                            {title}
                            {isDone && <Check className="w-5 h-5 text-green-400" />}
                        </h3>
                        {note && <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">{note}</p>}
                    </div>
                    <div className="text-right">
                        <span className={`text-xl font-black ${colorClass}`}>{progress}%</span>
                    </div>
                </div>

                <div className="space-y-2">
                    {items.map(item => {
                        const isChecked = !!currentManifest?.pickedState[item.id];

                        return (
                            <div
                                key={item.id}
                                onClick={() => toggleItem(item.id)}
                                className={`flex items-center p-3 rounded-lg border transition-all group cursor-pointer ${isChecked ? 'bg-green-500/10 border-green-500/30' : 'bg-slate-900/50 border-white/5 hover:bg-slate-800/50 hover:border-white/10'}`}
                            >
                                <div className="relative">
                                    <input
                                        type="checkbox"
                                        className="w-5 h-5 rounded border-slate-600 bg-slate-800 text-violet-600 focus:ring-violet-500 focus:ring-offset-slate-900 pointer-events-none"
                                        checked={isChecked}
                                        readOnly
                                    />
                                </div>

                                <div className="ml-3 flex-1">
                                    <p className={`text-sm font-medium transition-colors ${isChecked ? 'text-slate-500 line-through' : 'text-slate-200'}`}>
                                        {item.item}
                                    </p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="text-right mr-2 flex items-center bg-black/20 rounded px-2 border border-white/5">
                                        <input
                                            type="number"
                                            className="w-12 bg-transparent text-right text-sm font-bold text-slate-100 outline-none p-1"
                                            value={item.qty}
                                            onChange={(e) => handleUpdateItemQty(item.id, parseFloat(e.target.value) || 0)}
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                        <span className="text-[10px] font-bold text-slate-500 uppercase ml-1">{item.uom}</span>
                                    </div>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleDeleteItem(item.id); }}
                                        className="text-slate-600 hover:text-red-400 transition-colors p-1 opacity-0 group-hover:opacity-100"
                                        title="Remove Item"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-20">
            {/* Header */}
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-3xl font-bold text-white font-display tracking-tight flex items-center gap-3">
                        🍣 Ready-to-Eat Picking
                    </h2>
                    <p className="text-slate-400 mt-1">Smart manifest processing assistant</p>
                </div>
                <div className="flex gap-2 items-center">
                    {/* Simplified Header - No Outbound Button */}
                    {currentManifest && (
                        <div className="text-right hidden md:block pl-4 border-l border-white/10 ml-4">
                            <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">Summary</div>
                            <div className="text-lg font-bold text-violet-400">
                                {currentManifest.processedResults.totalValidItems} Items
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {error && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-xl flex items-center gap-3 animate-in shake">
                    <AlertCircle className="w-5 h-5" />
                    <span className="font-bold">{error}</span>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Sidebar Controls */}
                <aside className="lg:col-span-3 space-y-6">
                    {/* History Selector */}
                    <div className="bg-slate-800/40 p-5 rounded-xl border border-white/5 backdrop-blur-md sticky top-6">
                        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <Calendar className="w-4 h-4" /> History
                        </h2>
                        <select
                            className="w-full bg-slate-900 border border-white/10 rounded-lg p-3 text-slate-200 focus:ring-2 focus:ring-violet-500 outline-none"
                            value={currentDateId || ''}
                            onChange={(e) => setCurrentDateId(e.target.value || null)}
                        >
                            <option value="">-- No Record Selected --</option>
                            {Object.values(manifests)
                                .sort((a: ManifestData, b: ManifestData) => new Date(b.dateId).getTime() - new Date(a.dateId).getTime())
                                .map((m: ManifestData) => (
                                    <option key={m.dateId} value={m.dateId}>{m.formattedDate}</option>
                                ))
                            }
                        </select>
                        <div className="mt-3 flex justify-between items-center h-8">
                            {currentDateId && (
                                <>
                                    <span className="text-lg font-bold text-white">{manifests[currentDateId]?.formattedDate}</span>
                                    <div className="flex gap-2">
                                        {/* Save to Drive Disabled
                                        {manifests[currentDateId]?.originalImage && !manifests[currentDateId]?.originalImage?.startsWith('http') && (
                                            <button onClick={handleSaveToDrive} className="text-blue-400 hover:text-blue-300 transition-colors p-1" title="Save to Drive">
                                                <Upload className="w-4 h-4" />
                                            </button>
                                        )}
                                        */}
                                        <button onClick={deleteCurrent} className="text-red-400 hover:text-red-300 transition-colors p-1" title="Delete">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Upload Section (Moved to Sidebar) */}
                    <div className={`bg-gradient-to-br from-violet-600/20 to-violet-900/20 p-5 rounded-xl border border-violet-500/20 backdrop-blur-md relative overflow-hidden`}>
                        <div className="absolute inset-0 bg-violet-600/5 z-0 pointer-events-none"></div>
                        <h2 className="text-xs font-bold text-violet-300 uppercase tracking-widest mb-4 flex items-center gap-2 relative z-10">
                            <Upload className="w-4 h-4" /> New Manifest
                        </h2>

                        <input
                            type="file"
                            id="smart-pick-upload"
                            accept="image/*"
                            ref={fileInputRef}
                            className="hidden"
                            onChange={handleFileSelect}
                        />

                        {!previewImg ? (
                            <label
                                htmlFor="smart-pick-upload"
                                className="block w-full border-2 border-dashed border-violet-500/30 rounded-xl p-8 text-center cursor-pointer hover:bg-violet-500/10 transition-colors mb-4 relative z-10 group"
                            >
                                <div className="flex flex-col items-center gap-2">
                                    <div className="bg-violet-500/20 p-3 rounded-full group-hover:scale-110 transition-transform">
                                        <ImageIcon className="w-6 h-6 text-violet-300" />
                                    </div>
                                    <span className="text-xs font-bold text-violet-200">Tap to Upload</span>
                                </div>
                            </label>
                        ) : (
                            <div className="mb-4 relative z-10 group">
                                <img src={previewImg} className="w-full max-h-48 object-cover rounded-lg shadow-lg border border-white/10" alt="Preview" />
                                <button
                                    onClick={() => { setPreviewImg(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                                    className="absolute top-2 right-2 bg-black/60 text-white p-1 rounded-full hover:bg-red-500 transition-colors"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        )}

                        <button
                            onClick={processImage}
                            disabled={!previewImg || loading}
                            className={`w-full py-3 bg-violet-600 hover:bg-violet-500 text-white font-bold rounded-xl shadow-lg shadow-violet-900/20 transition-all flex justify-center items-center gap-2 relative z-10 ${loading ? 'opacity-70 cursor-wait' : 'active:scale-95'}`}
                        >
                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Analyze with AI'}
                        </button>
                    </div>

                    {/* Manual Entry Section (Moved to Sidebar) */}
                    {currentManifest && (
                        <div className="bg-slate-800/40 p-5 rounded-xl border border-white/5 backdrop-blur-md">
                            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <Plus className="w-4 h-4" /> Add Item Manually
                            </h2>
                            <div className="space-y-3">
                                <div className="relative">
                                    <input
                                        type="text"
                                        className="w-full px-4 py-2 border border-white/10 bg-black/40 text-slate-100 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none placeholder-slate-600 text-sm"
                                        placeholder="Search Product..."
                                        value={manualItemName}
                                        onChange={(e) => {
                                            setManualItemName(e.target.value);
                                            setShowManualDropdown(true);
                                        }}
                                        onFocus={() => setShowManualDropdown(true)}
                                    />

                                    {/* Search Dropdown */}
                                    {showManualDropdown && manualItemName.trim() && manualFilteredProducts.length > 0 && (
                                        <div className="absolute z-50 w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl max-h-60 overflow-y-auto">
                                            {manualFilteredProducts.map(p => (
                                                <div
                                                    key={p.productCode}
                                                    onClick={() => {
                                                        setManualItemName(p.name);
                                                        setShowManualDropdown(false);
                                                    }}
                                                    className="px-4 py-2 hover:bg-slate-800 cursor-pointer border-b border-slate-800 last:border-0"
                                                >
                                                    <div className="flex justify-between items-start">
                                                        <span className="font-bold text-slate-200 text-sm">{p.name}</span>
                                                        {p.defaultUnit && <span className="text-[10px] text-slate-400 font-bold bg-white/5 px-1.5 py-0.5 rounded ml-2 whitespace-nowrap">{p.defaultUnit}</span>}
                                                    </div>
                                                    <span className="text-xs text-slate-500 block mt-0.5">{p.productCode}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="flex gap-2">
                                    <input
                                        type="number"
                                        className="w-20 bg-slate-900 border border-white/10 rounded-lg p-3 text-slate-200 focus:ring-2 focus:ring-violet-500 outline-none text-sm font-bold text-center"
                                        value={manualItemQty}
                                        onChange={(e) => setManualItemQty(parseFloat(e.target.value) || 0)}
                                        min={1}
                                    />
                                    <button
                                        onClick={() => {
                                            if (manualItemName.trim()) {
                                                const match = products.find(p => p.name.toLowerCase() === manualItemName.toLowerCase());
                                                const uom = match ? match.defaultUnit : 'ea';

                                                handleAddItem(manualItemName, manualItemQty, uom);
                                                setManualItemName('');
                                                setManualItemQty(1);
                                                setShowManualDropdown(false);
                                            }
                                        }}
                                        disabled={!manualItemName.trim() || !currentDateId}
                                        className="flex-1 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-lg text-sm transition-colors"
                                    >
                                        Add Item
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </aside>

                {/* Main Content */}
                <main className="lg:col-span-9">

                    {currentManifest && (
                        <div className="space-y-6">
                            {/* Sort Misc items to match requested order */}
                            {(() => {
                                const sortedMisc = [...(currentManifest.processedResults.MiscellaneousItems || [])].sort((a, b) => {
                                    const getRank = (item: PickItem) => {
                                        const name = item.item.toLowerCase();
                                        const idx = PICKING_RULES.MISC_ORDER.findIndex(k => name.includes(k));
                                        return idx === -1 ? 999 : idx;
                                    };
                                    return getRank(a) - getRank(b);
                                });

                                return (
                                    <>
                                        <PalletCard
                                            title="Kitchen (Sugar / Vinegar / Peach)"
                                            items={currentManifest.processedResults.Pallet1Items}
                                            colorClass="text-violet-400"
                                            borderClass="border-violet-500"
                                            note="Standalone Pallet"
                                        />
                                        <PalletCard
                                            title="Miscellaneous"
                                            items={sortedMisc}
                                            colorClass="text-blue-400"
                                            borderClass="border-blue-500"
                                            note="Ordered by Priority"
                                        />
                                        <PalletCard
                                            title="Product Pallets (BX-20 / BH-20)"
                                            items={currentManifest.processedResults.Pallet2Items}
                                            colorClass="text-amber-400"
                                            borderClass="border-amber-500"
                                        />
                                        <PalletCard
                                            title="Full Pallet Items"
                                            items={currentManifest.processedResults.Pallet3Items}
                                            colorClass="text-emerald-400"
                                            borderClass="border-emerald-500"
                                            note="Dedicated Pallet"
                                        />
                                    </>
                                );
                            })()}
                        </div>
                    )}



                    {/* Original Image Section (Moved to Bottom) */}
                    {displayImage && (
                        <div className="bg-slate-800/40 p-4 rounded-xl border border-white/5 overflow-hidden mt-8">
                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                                <ImageIcon className="w-4 h-4" /> Original Image <span className="text-[10px] text-slate-500 ml-2">(Click to Enlarge)</span>
                            </h3>
                            <div className="bg-black/20 rounded-lg border border-white/5 p-2 cursor-zoom-in hover:border-violet-500/30 transition-colors" onClick={() => setExpandedImage(displayImage)}>
                                <img
                                    src={displayImage}
                                    alt="Original Manifest"
                                    referrerPolicy="no-referrer"
                                    className="w-full object-contain rounded shadow-lg max-h-[600px]"
                                />
                            </div>
                        </div>
                    )}

                </main>
            </div>

            {/* Image Modal */}
            {expandedImage && (
                <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setExpandedImage(null)}>
                    <div className="relative max-w-7xl max-h-screen">
                        <img src={expandedImage} referrerPolicy="no-referrer" className="max-w-full max-h-[95vh] rounded-lg shadow-2xl border border-white/10" alt="Expanded" />
                        <button className="absolute -top-12 right-0 md:top-4 md:right-4 bg-white/10 text-white p-2 rounded-full hover:bg-red-500/80 transition-colors backdrop-blur-md">
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
