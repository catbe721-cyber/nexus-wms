import React, { useMemo } from 'react';
import { InventoryItem, Transaction, Product } from '../types';
import { AREA_CONFIG } from '../consts/warehouse';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, AreaChart, Area, CartesianGrid } from 'recharts';
import { format } from 'date-fns';

interface DashboardChartsProps {
    inventory: InventoryItem[];
    transactions: Transaction[];
    products: Product[];
    topMovers: any[];
    deadStock: any[];
}

const COLORS = ['#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#6366f1'];
const RADIAN = Math.PI / 180;

const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, index }: any) => {
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
        <text x={x} y={y} fill="white" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" className="text-[10px] font-bold">
            {`${(percent * 100).toFixed(0)}%`}
        </text>
    );
};

const DashboardCharts: React.FC<DashboardChartsProps> = ({ inventory, transactions, products, topMovers, deadStock }) => {

    // 1. Slot Distribution Data (Count of locations/pallets instead of raw qty)
    const categoryData = useMemo(() => {
        const counts: Record<string, number> = {};
        inventory.forEach(item => {
            const cat = item.category || 'OTH';
            counts[cat] = (counts[cat] || 0) + item.locations.length;
        });
        return Object.entries(counts)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);
    }, [inventory]);

    // 2. Department Data (New)
    const deptData = useMemo(() => {
        const counts: Record<string, number> = {};
        inventory.forEach(item => {
            const product = products.find(p => p.productCode === item.productCode);
            const dept = product?.department || 'Unknown';
            counts[dept] = (counts[dept] || 0) + item.locations.length;
        });
        return Object.entries(counts)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);
    }, [inventory, products]);

    // 3. Rack Utilization Data
    const rackData = useMemo(() => {
        const counts: Record<string, number> = {};

        // Use updated keys from AREA_CONFIG (S, R, Z are already in there)
        const racks = Object.keys(AREA_CONFIG).sort((a, b) => {
            // Optional: Custom sort to put S, R, Z first or alphabetical
            const priority = ['S', 'R', 'Z'];
            const idxA = priority.indexOf(a);
            const idxB = priority.indexOf(b);
            if (idxA !== -1 && idxB !== -1) return idxA - idxB;
            if (idxA !== -1) return -1;
            if (idxB !== -1) return 1;
            return a.localeCompare(b);
        });

        racks.forEach(r => counts[r] = 0); // Init

        inventory.forEach(item => {
            item.locations.forEach(loc => {
                let rack = loc.rack;
                // Normalize legacy codes
                if (rack === 'STG') rack = 'S';
                if (rack === 'ADJ') rack = 'R';
                if (rack === 'RSV') rack = 'Z';

                if (counts[rack] !== undefined) {
                    counts[rack]++;
                }
            });
        });

        return racks.map(rack => ({ name: rack, count: counts[rack] }));
    }, [inventory]);

    // 4. Activity Trends Data (Last 7 Days)
    const activityData = useMemo(() => {
        const days = 7;
        const data: Record<string, { date: string, inbound: number, outbound: number }> = {};

        // Init last 7 days
        for (let i = days - 1; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toLocaleDateString();
            data[dateStr] = { date: format(d, 'MMM dd'), inbound: 0, outbound: 0 };
        }

        transactions.forEach(t => {
            const d = new Date(t.date).toLocaleDateString();
            if (data[d]) {
                if (t.type === 'INBOUND') data[d].inbound += 1;
                if (t.type === 'OUTBOUND') data[d].outbound += 1;
            }
        });

        return Object.values(data);
    }, [transactions]);

    return (
        <div className="space-y-6 mt-6">
            {/* Row 1: Pies & Trends */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Activity Trends Chart */}
                <div className="bg-slate-900/60 p-6 rounded-xl border border-white/10 backdrop-blur-md lg:col-span-1 shadow-[0_0_15px_rgba(0,0,0,0.3)]">
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Volume Trends (7 Days)</h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={activityData}>
                                <defs>
                                    <linearGradient id="colorIn" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorOut" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <XAxis dataKey="date" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                                <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} vertical={false} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#fff' }}
                                />
                                <Area type="monotone" dataKey="inbound" stroke="#10b981" fillOpacity={1} fill="url(#colorIn)" />
                                <Area type="monotone" dataKey="outbound" stroke="#ef4444" fillOpacity={1} fill="url(#colorOut)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Category Chart */}
                <div className="bg-slate-900/60 p-6 rounded-xl border border-white/10 backdrop-blur-md shadow-[0_0_15px_rgba(0,0,0,0.3)]">
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Slot Category</h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={categoryData}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    label={renderCustomizedLabel}
                                    outerRadius={80}
                                    fill="#8884d8"
                                    dataKey="value"
                                >
                                    {categoryData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#fff' }}
                                    itemStyle={{ color: '#fff' }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="flex flex-wrap gap-2 justify-center mt-2">
                        {categoryData.slice(0, 5).map((entry, index) => (
                            <div key={entry.name} className="flex items-center gap-1 text-xs text-slate-400">
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                                {entry.name}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Department Chart */}
                <div className="bg-slate-900/60 p-6 rounded-xl border border-white/10 backdrop-blur-md shadow-[0_0_15px_rgba(0,0,0,0.3)]">
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Slot Dept</h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={deptData}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    label={renderCustomizedLabel}
                                    outerRadius={80}
                                    fill="#2dd4bf"
                                    dataKey="value"
                                >
                                    {deptData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#fff' }}
                                    itemStyle={{ color: '#fff' }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="flex flex-wrap gap-2 justify-center mt-2">
                        {deptData.slice(0, 5).map((entry, index) => (
                            <div key={entry.name} className="flex items-center gap-1 text-xs text-slate-400">
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[(index + 2) % COLORS.length] }}></div>
                                {entry.name}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Row 2: Bars */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Rack Utilization Chart */}
                <div className="bg-slate-900/60 p-6 rounded-xl border border-white/10 backdrop-blur-md shadow-[0_0_15px_rgba(0,0,0,0.3)]">
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Slot Occupancy</h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={rackData}>
                                <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                                <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                                <Tooltip
                                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                    contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#fff' }}
                                />
                                <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Top Movers Bar Chart */}
                <div className="bg-slate-900/60 p-6 rounded-xl border border-white/10 backdrop-blur-md shadow-[0_0_15px_rgba(0,0,0,0.3)]">
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Top Movers</h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart layout="vertical" data={topMovers.slice(0, 5).map(i => ({ name: i.name.substring(0, 10) + '...', qty: i.qty }))}>
                                <XAxis type="number" dataKey="qty" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                                <YAxis type="category" dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} width={80} />
                                <Tooltip
                                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                    contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#fff' }}
                                />
                                <Bar dataKey="qty" fill="#10b981" radius={[0, 4, 4, 0]} name="Quantity" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Stagnant Stock Bar Chart */}
                <div className="bg-slate-900/60 p-6 rounded-xl border border-white/10 backdrop-blur-md shadow-[0_0_15px_rgba(0,0,0,0.3)]">
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Stagnant Stock (Age)</h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart layout="vertical" data={deadStock.slice(0, 5).map((i: any) => ({ name: i.productName.substring(0, 10) + '...', days: Math.floor((Date.now() - i.updatedAt) / (1000 * 60 * 60 * 24)) }))}>
                                <XAxis type="number" dataKey="days" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                                <YAxis type="category" dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} width={80} />
                                <Tooltip
                                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                    contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#fff' }}
                                />
                                <Bar dataKey="days" fill="#ef4444" radius={[0, 4, 4, 0]} name="Days Old" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DashboardCharts;
