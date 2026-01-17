import { useState, useEffect } from 'react';
import { X, Calendar, TrendingUp, TrendingDown, Building2, Filter, ArrowUpDown } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { API_URL } from "../config";

export default function BankDetailsModal({ isOpen, onClose, bankName, environment = 'TEST' }) {
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [chartData, setChartData] = useState([]);
    const [totals, setTotals] = useState({ ingresos: 0, gastos: 0, saldo: 0 });
    const [chartView, setChartView] = useState('monthly'); // 'monthly' or 'yearly'

    useEffect(() => {
        if (isOpen && bankName) {
            fetchTransactions();
        }
    }, [isOpen, bankName, startDate, endDate, environment]);

    useEffect(() => {
        if (transactions.length > 0) {
            processChartData(transactions);
        }
    }, [chartView, transactions]);

    const fetchTransactions = async () => {
        setLoading(true);
        try {
            let url = `${API_URL}/transactions?limit=0&bank=${encodeURIComponent(bankName)}&environment=${environment}`;
            if (startDate) url += `&start_date=${startDate}`;
            if (endDate) url += `&end_date=${endDate}`;

            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                setTransactions(data);
                processChartData(data);
                calculateTotals(data);
            }
        } catch (error) {
            console.error('Error fetching bank transactions:', error);
        } finally {
            setLoading(false);
        }
    };

    const calculateTotals = (data) => {
        const ingresos = data.reduce((sum, tx) => sum + (tx.ingreso || 0), 0);
        const gastos = data.reduce((sum, tx) => sum + (tx.gasto || 0), 0);
        setTotals({ ingresos, gastos, saldo: ingresos - gastos });
    };

    const processChartData = (data) => {
        if (chartView === 'yearly') {
            // Group by year
            const yearlyData = {};
            data.forEach(tx => {
                const year = tx.fecha?.substring(0, 4) || 'Sin año';
                if (!yearlyData[year]) {
                    yearlyData[year] = { period: year, ingresos: 0, gastos: 0 };
                }
                yearlyData[year].ingresos += tx.ingreso || 0;
                yearlyData[year].gastos += tx.gasto || 0;
            });
            const sortedData = Object.values(yearlyData).sort((a, b) => a.period.localeCompare(b.period));
            setChartData(sortedData);
        } else {
            // Group by month (last 12 months)
            const monthlyData = {};
            data.forEach(tx => {
                const month = tx.fecha?.substring(0, 7) || 'Sin fecha';
                if (!monthlyData[month]) {
                    monthlyData[month] = { period: month, ingresos: 0, gastos: 0 };
                }
                monthlyData[month].ingresos += tx.ingreso || 0;
                monthlyData[month].gastos += tx.gasto || 0;
            });
            const sortedData = Object.values(monthlyData)
                .sort((a, b) => a.period.localeCompare(b.period))
                .slice(-12);
            setChartData(sortedData);
        }
    };

    const clearFilters = () => {
        setStartDate('');
        setEndDate('');
    };

    const fmt = (num) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(num);

    const formatPeriod = (period) => {
        if (!period || period === 'Sin fecha' || period === 'Sin año') return period;
        if (chartView === 'yearly') return period;
        const [year, m] = period.split('-');
        const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        return `${months[parseInt(m) - 1]} ${year.slice(2)}`;
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-start justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-4xl shadow-2xl my-8">

                {/* Header */}
                <div className="p-5 flex justify-between items-center bg-gradient-to-r from-blue-600/20 to-indigo-600/20 border-b border-slate-700 rounded-t-2xl">
                    <div>
                        <h2 className="font-bold text-2xl flex items-center gap-2 text-blue-400">
                            <Building2 size={24} /> {bankName}
                        </h2>
                        <p className="text-slate-400 text-sm mt-1">Historial de movimientos</p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors p-2 hover:bg-slate-700 rounded-lg">
                        <X size={24} />
                    </button>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-3 gap-4 p-5 border-b border-slate-700">
                    <div className="bg-emerald-900/30 border border-emerald-700/50 rounded-xl p-4">
                        <p className="text-emerald-400/70 text-sm flex items-center gap-1"><TrendingUp size={14} /> Total Ingresos</p>
                        <p className="text-2xl font-bold text-emerald-400">{fmt(totals.ingresos)}</p>
                    </div>
                    <div className="bg-rose-900/30 border border-rose-700/50 rounded-xl p-4">
                        <p className="text-rose-400/70 text-sm flex items-center gap-1"><TrendingDown size={14} /> Total Gastos</p>
                        <p className="text-2xl font-bold text-rose-400">{fmt(totals.gastos)}</p>
                    </div>
                    <div className={`${totals.saldo >= 0 ? 'bg-blue-900/30 border-blue-700/50' : 'bg-amber-900/30 border-amber-700/50'} border rounded-xl p-4`}>
                        <p className={`${totals.saldo >= 0 ? 'text-blue-400/70' : 'text-amber-400/70'} text-sm flex items-center gap-1`}><ArrowUpDown size={14} /> Balance</p>
                        <p className={`text-2xl font-bold ${totals.saldo >= 0 ? 'text-blue-400' : 'text-amber-400'}`}>{fmt(totals.saldo)}</p>
                    </div>
                </div>

                {/* Filters */}
                <div className="p-5 border-b border-slate-700 flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2 text-slate-400">
                        <Filter size={16} />
                        <span className="text-sm font-semibold">Filtrar por fecha:</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-blue-500"
                            placeholder="Desde"
                        />
                        <span className="text-slate-500">—</span>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-blue-500"
                            placeholder="Hasta"
                        />
                    </div>
                    {(startDate || endDate) && (
                        <button
                            onClick={clearFilters}
                            className="text-sm text-slate-400 hover:text-white underline"
                        >
                            Limpiar filtros
                        </button>
                    )}
                    <span className="text-slate-500 text-sm ml-auto">
                        {transactions.length} movimientos
                    </span>
                </div>

                {/* Chart */}
                {chartData.length > 0 && (
                    <div className="p-5 border-b border-slate-700">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-sm font-semibold text-slate-400">
                                Comparativa Ingresos vs Gastos {chartView === 'yearly' ? 'por Año' : '(Últimos 12 meses)'}
                            </h3>
                            <div className="flex gap-1 bg-slate-900 rounded-lg p-1">
                                <button
                                    onClick={() => setChartView('monthly')}
                                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${chartView === 'monthly'
                                            ? 'bg-blue-600 text-white'
                                            : 'text-slate-400 hover:text-white'
                                        }`}
                                >
                                    Mensual
                                </button>
                                <button
                                    onClick={() => setChartView('yearly')}
                                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${chartView === 'yearly'
                                            ? 'bg-blue-600 text-white'
                                            : 'text-slate-400 hover:text-white'
                                        }`}
                                >
                                    Anual
                                </button>
                            </div>
                        </div>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                                    <XAxis
                                        dataKey="period"
                                        tick={{ fill: '#94a3b8', fontSize: 12 }}
                                        tickFormatter={formatPeriod}
                                    />
                                    <YAxis
                                        tick={{ fill: '#94a3b8', fontSize: 12 }}
                                        tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                                    />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '8px' }}
                                        labelFormatter={formatPeriod}
                                        formatter={(value, name) => [fmt(value), name === 'ingresos' ? 'Ingresos' : 'Gastos']}
                                    />
                                    <Legend
                                        formatter={(value) => value === 'ingresos' ? 'Ingresos' : 'Gastos'}
                                    />
                                    <Bar dataKey="ingresos" fill="#10b981" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="gastos" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}

                {/* Transactions Table */}
                <div className="p-5 max-h-96 overflow-y-auto">
                    <h3 className="text-sm font-semibold text-slate-400 mb-4">Movimientos</h3>
                    {loading ? (
                        <div className="flex items-center justify-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                        </div>
                    ) : transactions.length === 0 ? (
                        <p className="text-slate-500 text-center py-8">No hay movimientos para este banco</p>
                    ) : (
                        <table className="w-full text-left">
                            <thead>
                                <tr className="text-slate-400 border-b border-slate-700/50 text-xs uppercase tracking-wider">
                                    <th className="pb-3">Fecha</th>
                                    <th className="pb-3">Detalle</th>
                                    <th className="pb-3">Categoría</th>
                                    <th className="pb-3 text-right">Monto</th>
                                </tr>
                            </thead>
                            <tbody className="text-sm">
                                {transactions.map((tx) => (
                                    <tr key={tx.id} className="border-b border-slate-700/30 hover:bg-slate-700/40 transition-colors">
                                        <td className="py-3 text-slate-300 font-mono text-xs">{tx.fecha}</td>
                                        <td className="py-3 text-slate-200">{tx.detalle || 'Sin detalle'}</td>
                                        <td className="py-3">
                                            <span className="bg-slate-700/50 px-2 py-1 rounded text-xs text-slate-400">
                                                {tx.categoria}
                                            </span>
                                        </td>
                                        <td className={`py-3 text-right font-bold ${tx.ingreso > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                            {tx.ingreso > 0 ? `+${fmt(tx.ingreso)}` : `-${fmt(tx.gasto)}`}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

            </div>
        </div>
    );
}
