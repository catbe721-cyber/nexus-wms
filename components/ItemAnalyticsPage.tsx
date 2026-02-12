import React, { useState, useMemo } from 'react';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    ChartData,
    ChartOptions,
    Filler
} from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { Bar, Line, Chart } from 'react-chartjs-2';
import { InventoryItem, Transaction, Product } from '../types';
import { Search, RotateCcw, X, Calendar, ArrowUp, ArrowDown, Box, AlertTriangle } from 'lucide-react';
import { format, subDays, startOfDay, isSameDay, addDays, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, subWeeks, subMonths, subYears, getQuarter, getYear, startOfYear } from 'date-fns';
import { smartSearch, getEmbedLink } from '../utils';

type TimeRange = 'mtd' | 'ytd' | '1y' | '5y' | 'max';
type ViewMode = 'daily' | 'monthly' | 'quarterly' | 'yearly';

// Register ChartJS components
ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    LineElement,
    PointElement,
    Title,
    Tooltip,
    Legend,
    ChartDataLabels,
    Filler
);

interface ItemAnalyticsPageProps {
    inventory: InventoryItem[];
    transactions: Transaction[];
    products: Product[];
}

const ItemAnalyticsPage: React.FC<ItemAnalyticsPageProps> = ({ inventory = [], transactions = [], products = [] }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [timeRange, setTimeRange] = useState<TimeRange>('mtd');
    const [viewMode, setViewMode] = useState<ViewMode>('daily');

    // -- 1. Search & Filter Logic --

    // Filter products based on search
    const filteredProducts = useMemo(() => {
        if (!searchTerm) return [];
        return products.filter(p =>
            smartSearch(p, ['productCode', 'name'], searchTerm)
        ).slice(0, 10);
    }, [searchTerm, products]);

    const handleSelectProduct = (product: Product) => {
        setSelectedProduct(product);
        setSearchTerm(`${product.productCode} - ${product.name}`);
    };

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const term = e.target.value;
        setSearchTerm(term);
        // If user clears input or types something new, reset selection
        if (selectedProduct && term !== `${selectedProduct.productCode} - ${selectedProduct.name}`) {
            setSelectedProduct(null);
        }
    };

    const clearSearch = () => {
        setSearchTerm('');
        setSelectedProduct(null);
    };

    // Helper: Get filtered data
    const dashboardData = useMemo(() => {
        if (!selectedProduct) return null;

        // 1. Current Stock (Closing Stock)
        const currentStockItems = inventory.filter(i => i.productCode === selectedProduct.productCode);
        const currentStockQty = currentStockItems.reduce((acc, i) => acc + i.quantity, 0);

        // 2. Transaction History (Based on Time Range)
        const today = startOfDay(new Date());
        let startDate = subDays(today, 30);
        let endDate = today;

        switch (timeRange) {
            case 'mtd':
                startDate = startOfMonth(today);
                endDate = today;
                break;
            case 'ytd':
                startDate = startOfYear(today);
                endDate = today;
                break;
            case '1y':
                startDate = subYears(today, 1);
                endDate = today;
                break;
            case '5y':
                startDate = subYears(today, 5);
                endDate = today;
                break;
            case 'max':
                startDate = new Date(2018, 0, 1); // Jan 1, 2018
                endDate = today;
                break;
        }

        // Global constraint: Data starts from 2018
        const minDataDate = new Date(2018, 0, 1);
        if (startDate < minDataDate) {
            startDate = minDataDate;
        }

        const relevantTransactions = transactions.filter(t => {
            // Safety check for valid dates to prevent date-fns crashes
            if (!t || !t.date) return false;
            const d = new Date(t.date);
            if (isNaN(d.getTime())) return false;

            return t.productCode === selectedProduct.productCode &&
                t.date >= startDate.getTime() &&
                t.date <= endDate.getTime() + 86400000; // Include full end date
        }).sort((a, b) => a.date - b.date);

        // 3. Construct Daily Data (Base Layer)
        const dailyStats: Record<string, { date: Date, in: number, out: number, adj: number, balance: number }> = {};
        const intervalDays = eachDayOfInterval({ start: startDate, end: endDate });

        // Metrics Accumulators
        let mIn = 0;
        let mOut = 0;

        intervalDays.forEach(d => {
            const key = format(d, 'yyyy-MM-dd');
            dailyStats[key] = { date: d, in: 0, out: 0, adj: 0, balance: 0 };
        });

        relevantTransactions.forEach(t => {
            const key = format(new Date(t.date), 'yyyy-MM-dd');

            // Track totals for the period
            if (t.type === 'INBOUND') mIn += t.quantity;
            else if (t.type === 'OUTBOUND') mOut += Math.abs(t.quantity);
            // We don't usually count ADJ/DELETE as "In/Out" flow, but as adjustments.

            if (dailyStats[key]) {
                if (t.type === 'INBOUND') dailyStats[key].in += t.quantity;
                else if (t.type === 'OUTBOUND') dailyStats[key].out += Math.abs(t.quantity);
                else if (t.type === 'ADJUSTMENT' || t.type === 'COUNT' || t.type === 'DELETE') dailyStats[key].adj += t.quantity;
            }
        });

        // 4. Calculate Daily Balances (Backwards from Current Stock)
        let runningBalance = currentStockQty;

        const gapTransactions = transactions.filter(t => {
            if (!t || !t.date) return false;
            return t.productCode === selectedProduct.productCode &&
                t.date > endDate.getTime() + 86400000;
        });

        // Reverse-play gap
        gapTransactions.forEach(t => {
            if (t.type === 'INBOUND') runningBalance -= t.quantity;
            else if (t.type === 'OUTBOUND') runningBalance += Math.abs(t.quantity);
            else if (t.type === 'ADJUSTMENT' || t.type === 'COUNT' || t.type === 'DELETE') runningBalance -= t.quantity;
        });

        // Now runningBalance is the Balance at the END of the interval.
        // We can now work backwards through the interval days.

        const sortedDailyKeys = Object.keys(dailyStats).sort(); // Ascending
        const dailyArray = sortedDailyKeys.map(k => dailyStats[k]);

        // Work backwards
        for (let i = dailyArray.length - 1; i >= 0; i--) {
            const day = dailyArray[i];
            day.balance = runningBalance;

            // Prepare balance for previous day
            runningBalance = runningBalance - day.in + day.out - day.adj;
        }

        const openingStock = runningBalance;

        // 5. Aggregate based on ViewMode
        if (viewMode === 'daily') {
            const totalIn = dailyArray.reduce((sum, d) => sum + d.in, 0);
            const totalOut = dailyArray.reduce((sum, d) => sum + d.out, 0);
            const totalAdj = dailyArray.reduce((sum, d) => sum + d.adj, 0);

            return {
                stats: dailyArray,
                waterfall: { inventoryStart: openingStock, totalIn, totalOut, totalAdj, inventoryEnd: dailyArray[dailyArray.length - 1].balance },
                periodMetrics: { in: mIn, out: mOut }
            };
        } else {
            // Aggregation Logic
            const groups: Record<string, { date: Date, in: number, out: number, adj: number, balance: number, startBalance: number }> = {};

            let groupStartBalance = openingStock; // Initial start

            dailyArray.forEach(day => {
                let key = '';
                if (viewMode === 'monthly') key = format(day.date, 'yyyy-MM');
                else if (viewMode === 'quarterly') key = `${getYear(day.date)}-Q${getQuarter(day.date)}`;
                else if (viewMode === 'yearly') key = format(day.date, 'yyyy');

                if (!groups[key]) {
                    groups[key] = {
                        date: day.date, // Start date of group
                        in: 0,
                        out: 0,
                        adj: 0,
                        balance: 0,
                        startBalance: groupStartBalance
                    };
                }

                const g = groups[key];
                g.in += day.in;
                g.out += day.out;
                g.adj += day.adj;
                g.balance = day.balance; // Update to latest day's balance

                // The start balance for the NEXT group will be this day's balance
                groupStartBalance = day.balance;
            });

            // Re-calc start balances strictly
            const groupedArray = Object.values(groups).sort((a, b) => a.date.getTime() - b.date.getTime());

            let currentStart = openingStock;
            groupedArray.forEach(g => {
                g.startBalance = currentStart;
                currentStart = g.balance;
            });

            return {
                stats: groupedArray,
                waterfall: { inventoryStart: openingStock, inventoryEnd: currentStart },
                periodMetrics: { in: mIn, out: mOut }
            };
        }

    }, [selectedProduct, inventory, transactions, timeRange, viewMode]);

    // -- Charts Configuration --

    // Daily Waterfall Chart
    // Visualizes the daily movements starting from Opening Stock
    // Each bar spans from [Start Balance] to [End Balance]

    // 6. Calculate Summary Metrics
    const openingBalance = dashboardData?.waterfall.inventoryStart || 0;

    const waterfallDatasets = useMemo(() => {
        if (!dashboardData) return { data: [], bg: [] };

        const dataPoints: [number, number][] = [];
        const backgroundColors: string[] = [];

        // Re-do loop simply
        let prevBalance = openingBalance;
        const stats = dashboardData.stats;

        stats.forEach((day: any) => {
            const start = prevBalance;
            const end = day.balance;
            dataPoints.push([start, end]);

            if (end > start) backgroundColors.push('#10b981');
            else if (end < start) backgroundColors.push('#ef4444');
            else backgroundColors.push('#94a3b8');

            prevBalance = end;
        });

        return { data: dataPoints, bg: backgroundColors };
    }, [dashboardData, openingBalance]);
    const summaryMetrics = useMemo(() => {
        if (!dashboardData) return null;
        return dashboardData.periodMetrics;
    }, [dashboardData]);

    const dailyWaterfallData: ChartData<'bar' | 'line'> = {
        labels: dashboardData?.stats.map((d: any) => {
            if (viewMode === 'daily') return format(d.date, 'MMM dd');
            if (viewMode === 'monthly') return format(d.date, 'MMM yyyy');
            if (viewMode === 'quarterly') return `Q${getQuarter(d.date)} ${getYear(d.date)}`;
            if (viewMode === 'yearly') return format(d.date, 'yyyy');
            return format(d.date, 'MMM dd');
        }) || [],
        datasets: [
            {
                type: 'line' as const,
                label: 'Balance Line',
                // FIX: Clamp negative values to 0 as per user request
                data: dashboardData?.stats.map((d: any) => Math.max(0, d.balance)) || [],
                borderColor: '#3b82f6', // Blue
                borderWidth: 2,
                pointRadius: 3,
                pointBackgroundColor: '#3b82f6',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                tension: 0.1,
                order: 0,
                datalabels: {
                    display: true,
                    align: 'top',
                    anchor: 'start',
                    offset: 8,
                    color: '#f1f5f9',
                    backgroundColor: 'rgba(15, 23, 42, 0.7)',
                    borderRadius: 4,
                    padding: { top: 4, bottom: 4, left: 6, right: 6 },
                    font: { weight: 'bold', size: 12 },
                    formatter: (value) => value
                }
            },
            {
                type: 'line' as const,
                label: 'Safety Stock',
                data: dashboardData?.stats.map(() => selectedProduct?.minStockLevel || 0) || [],
                borderColor: '#f87171',
                borderWidth: 2,
                borderDash: [6, 4],
                pointRadius: 0,
                order: 0,
                datalabels: {
                    display: true,
                    align: 'right',
                    anchor: 'end',
                    color: '#f87171',
                    font: { weight: 'bold', size: 11 },
                    formatter: (value, context) => context.dataIndex === context.dataset.data.length - 1 ? `Safety: ${value}` : ''
                }
            },
            {
                type: 'bar' as const,
                label: 'Stock Level',
                // FIX: Clamp negative bar starts/ends to 0
                data: waterfallDatasets.data.map(([start, end]) => [Math.max(0, start), Math.max(0, end)]),
                backgroundColor: waterfallDatasets.bg,
                borderWidth: 0,
                barPercentage: 0.9,
                categoryPercentage: 0.9,
                order: 1,
                datalabels: { display: false }
            }
        ]
    };

    const waterfallOptions: ChartOptions<'bar' | 'line'> = {
        responsive: true,
        layout: {
            padding: {
                top: 30,
                right: 20,
                left: 20
            }
        },
        interaction: {
            mode: 'index',
            intersect: false,
        },
        plugins: {
            legend: { display: false },
            // @ts-ignore
            datalabels: { display: false },
            tooltip: {
                callbacks: {
                    label: (context) => {
                        if (context.dataset.label === 'Safety Stock') return '';
                        if (context.dataset.type === 'line') {
                            return `Balance: ${context.raw}`;
                        }
                        const raw = context.raw as [number, number];
                        const start = raw[0];
                        const end = raw[1];
                        const diff = end - start;
                        return `Change: ${diff > 0 ? '+' : ''}${diff}`;
                    },
                    afterLabel: (context) => {
                        if (context.dataset.type === 'line') return '';
                        const idx = context.dataIndex;
                        const day = dashboardData?.stats[idx];
                        if (!day) return '';
                        return `In: ${day.in} | Out: ${day.out} | Adj: ${day.adj}`;
                    }
                },
                filter: (item) => item.dataset.label !== 'Safety Stock'
            }
        },
        scales: {
            y: {
                type: 'linear' as const,
                display: true,
                grace: '10%',
                min: 0, // Ensure axis starts at 0
                title: {
                    display: true,
                    text: 'Stock Level',
                    color: '#cbd5e1',
                    font: { size: 13, weight: 'bold' }
                },
                grid: {
                    display: false,
                },
                ticks: {
                    color: '#94a3b8',
                    font: { size: 11 }
                },
                border: { display: false }
            },
            x: {
                grid: { display: false },
                ticks: {
                    color: '#cbd5e1',
                    font: { size: 12, weight: 'bold' }
                }
            }
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-10">
            <div className="flex justify-between items-end">
                <h2 className="text-3xl font-bold text-white font-display tracking-tight">Item Analytics</h2>
            </div>
            {/* Search Section */}
            <div className="bg-slate-900/60 p-6 rounded-xl border border-white/10 backdrop-blur-md shadow-[0_0_15px_rgba(0,0,0,0.3)]">

                <div className="max-w-xl relative">
                    {/* Removed mx-auto to align left */}
                    <label className="block text-sm font-bold text-slate-400 mb-1 uppercase tracking-wider">Product Search</label>
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5 pointer-events-none" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={handleSearchChange}
                            placeholder="Search item or code..."
                            className="w-full bg-slate-900/80 border border-slate-700 rounded-lg py-3 pl-12 pr-10 text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-slate-500 font-display"
                        />
                        {searchTerm && (
                            <button
                                onClick={clearSearch}
                                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-500 hover:text-white"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}

                        {/* Dropdown */}
                        {searchTerm && !selectedProduct && filteredProducts.length > 0 && (
                            <div className="absolute z-50 w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl max-h-60 overflow-y-auto">
                                {filteredProducts.map(p => (
                                    <div
                                        key={p.productCode}
                                        onClick={() => handleSelectProduct(p)}
                                        className="px-4 py-2 hover:bg-slate-800 cursor-pointer border-b border-slate-800 last:border-0"
                                    >
                                        <div className="flex items-center gap-3">
                                            {p.image && (
                                                <div className="w-8 h-8 rounded bg-slate-800 border border-white/10 overflow-hidden flex-shrink-0 flex items-center justify-center">
                                                    <img src={getEmbedLink(p.image)} alt={p.name} className="w-full h-full object-contain" />
                                                </div>
                                            )}
                                            <div>
                                                <span className="font-bold text-slate-200">{p.name}</span>
                                                <br />
                                                <span className="text-xs text-slate-500">{p.productCode}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
                {/* Selection Indicator */}
                {selectedProduct && (
                    <div className="flex justify-between items-end mt-4 animate-in fade-in">
                        <div className="text-left">
                            <p className="text-slate-400 text-sm uppercase tracking-wider">Analyzing</p>
                            <h2 className="text-2xl font-bold text-white font-display">{selectedProduct.name}</h2>
                            <p className="text-primary font-mono text-sm">{selectedProduct.productCode}</p>
                        </div>

                        {/* Time Range Selector */}
                        <div className="flex flex-col gap-2 items-end">
                            <div className="flex bg-slate-900/50 p-1 rounded-lg border border-white/5 flex-wrap justify-end max-w-lg gap-1">
                                {(['mtd', 'ytd', '1y', '5y', 'max'] as TimeRange[]).map((range) => (
                                    <button
                                        key={range}
                                        onClick={() => setTimeRange(range)}
                                        className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${timeRange === range
                                            ? 'bg-primary text-white shadow-lg'
                                            : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                                            }`}
                                    >
                                        {range.toUpperCase()}
                                    </button>
                                ))}
                            </div>
                            {/* Granularity Selector */}
                            <div className="flex bg-slate-900/50 p-1 rounded-lg border border-white/5">
                                {(['daily', 'monthly', 'quarterly', 'yearly'] as ViewMode[]).map((mode) => (
                                    <button
                                        key={mode}
                                        onClick={() => setViewMode(mode)}
                                        className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${viewMode === mode
                                            ? 'bg-emerald-600 text-white shadow-lg'
                                            : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                                            }`}
                                    >
                                        {mode.charAt(0).toUpperCase() + mode.slice(1)}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {selectedProduct ? (
                <div className="animate-in slide-in-from-bottom-4 duration-500 space-y-6">

                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        {/* Current Balance */}
                        <div className="bg-slate-900/60 p-4 rounded-xl border border-white/10 backdrop-blur-md shadow">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-blue-500/20 rounded-lg">
                                    <Box className="w-5 h-5 text-blue-400" />
                                </div>
                                <span className="text-slate-400 text-sm font-bold uppercase tracking-wider">Current Balance</span>
                            </div>
                            <div className="text-2xl font-bold text-white font-display">
                                {inventory.filter(i => i.productCode === selectedProduct.productCode).reduce((a, b) => a + b.quantity, 0)}
                                <span className="text-sm font-light text-slate-500 ml-1">{selectedProduct.defaultUnit || 'Units'}</span>
                            </div>
                        </div>

                        {/* Min Stock Level */}
                        <div className="bg-slate-900/60 p-4 rounded-xl border border-white/10 backdrop-blur-md shadow">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-amber-500/20 rounded-lg">
                                    <AlertTriangle className="w-5 h-5 text-amber-400" />
                                </div>
                                <span className="text-slate-400 text-sm font-bold uppercase tracking-wider">Min Stock</span>
                            </div>
                            <div className="text-2xl font-bold text-white font-display">
                                {selectedProduct.minStockLevel || 0}
                                <span className="text-sm font-light text-slate-500 ml-1">Threshold</span>
                            </div>
                        </div>

                        {/* Period Inbound */}
                        <div className="bg-slate-900/60 p-4 rounded-xl border border-white/10 backdrop-blur-md shadow">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-emerald-500/20 rounded-lg">
                                    <ArrowUp className="w-5 h-5 text-emerald-400" />
                                </div>
                                <span className="text-slate-400 text-sm font-bold uppercase tracking-wider">Period In</span>
                            </div>
                            <div className="text-2xl font-bold text-emerald-400 font-display">
                                +{summaryMetrics?.in || 0}
                            </div>
                        </div>

                        {/* Period Outbound */}
                        <div className="bg-slate-900/60 p-4 rounded-xl border border-white/10 backdrop-blur-md shadow">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-red-500/20 rounded-lg">
                                    <ArrowDown className="w-5 h-5 text-red-400" />
                                </div>
                                <span className="text-slate-400 text-sm font-bold uppercase tracking-wider">Period Out</span>
                            </div>
                            <div className="text-2xl font-bold text-red-400 font-display">
                                -{summaryMetrics?.out || 0}
                            </div>
                        </div>
                    </div>

                    {/* Chart 1: Daily Waterfall */}
                    <div className="bg-slate-900/60 p-6 rounded-xl border border-white/10 backdrop-blur-md shadow-[0_0_15px_rgba(0,0,0,0.3)]">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-bold text-slate-200 font-display">Daily Inventory Waterfall</h3>
                            <div className="flex gap-4 text-xs">
                                <span className="flex items-center gap-1 text-slate-400"><div className="w-3 h-3 bg-emerald-500 rounded-sm"></div> Net Increase</span>
                                <span className="flex items-center gap-1 text-slate-400"><div className="w-3 h-3 bg-red-500 rounded-sm"></div> Net Decrease</span>
                            </div>
                        </div>
                        <div className="h-96">
                            <Chart type='bar' data={dailyWaterfallData} options={waterfallOptions} />
                        </div>
                    </div>
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center p-20 text-slate-500 border border-dashed border-slate-700 rounded-xl bg-slate-800/20">
                    <Search className="w-12 h-12 mb-4 opacity-50" />
                    <p className="text-lg font-medium">Search for an item to view detailed analytics</p>
                    <p className="text-sm opacity-70">Enter SKU or Name above</p>
                </div>
            )}
        </div>
    );
};

export default ItemAnalyticsPage;
