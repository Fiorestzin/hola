import { useState, useEffect, useMemo } from 'react';
import { X, TrendingUp, TrendingDown, Target, Search, Filter, ArrowUp, ArrowDown, PiggyBank, History } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { API_URL } from "../config";

export default function GoalDetailsModal({ isOpen, onClose, goal, environment = 'TEST' }) {
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [chartData, setChartData] = useState([]);

    // Filters
    const [filterDetail, setFilterDetail] = useState('');
    const [filterMinAmount, setFilterMinAmount] = useState('');

    useEffect(() => {
        if (isOpen && goal) {
            fetchHistory();
        }
    }, [isOpen, goal, environment]);

    const fetchHistory = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/savings-goals/${goal.id}/history`);
            if (res.ok) {
                const data = await res.json();
                setTransactions(data);
                processChartData(data);
            }
        } catch (error) {
            console.error('Error fetching goal history:', error);
        } finally {
            setLoading(false);
        }
    };

    const processChartData = (data) => {
        // Sort ascending for chart
        const sorted = [...data].sort((a, b) => a.fecha.localeCompare(b.fecha));

        // Calculate cumulative balance over time
        let balance = 0;
        const evolution = sorted.map(tx => {
            balance += tx.monto;
            return {
                fecha: tx.fecha,
                balance: balance,
                monto: tx.monto
            };
        });

        // Ensure we start from 0 if no data
        if (evolution.length === 0) {
            setChartData([{ fecha: 'Inicio', balance: 0 }]);
        } else {
            // Add initial point if needed, or just show evolution
            // Better to show evolution directly
            setChartData(evolution);
        }
    };

    const filteredTransactions = useMemo(() => {
        return transactions.filter(tx => {
            const textMatch = !filterDetail ||
                (tx.detalle || '').toLowerCase().includes(filterDetail.toLowerCase()) ||
                (tx.banco || '').toLowerCase().includes(filterDetail.toLowerCase()) ||
                (tx.tipo || '').toLowerCase().includes(filterDetail.toLowerCase());

            const amount = Math.abs(tx.monto);
            const amountMatch = !filterMinAmount || amount >= parseFloat(filterMinAmount);

            return textMatch && amountMatch;
        });
    }, [transactions, filterDetail, filterMinAmount]);

    const fmt = (num) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(num);

    if (!isOpen || !goal) return null;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-start justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl shadow-2xl my-8 flex flex-col">

                {/* Header */}
                <div className="p-6 flex justify-between items-start bg-slate-800/50 border-b border-slate-700 rounded-t-2xl">
                    <div className="flex items-center gap-4">
                        <span
                            className="text-3xl w-14 h-14 rounded-xl flex items-center justify-center shadow-lg"
                            style={{ backgroundColor: `${goal.color}20` }}
                        >
                            {goal.icono}
                        </span>
                        <div>
                            <h2 className="font-bold text-2xl text-white">{goal.nombre}</h2>
                            <div className="flex items-center gap-2 text-slate-400 text-sm mt-1">
                                <Target size={14} /> Meta: {fmt(goal.monto_objetivo)}
                                {goal.fecha_limite && <span className="text-slate-500">• Límite: {goal.fecha_limite}</span>}
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors p-2 hover:bg-slate-700 rounded-lg">
                        <X size={24} />
                    </button>
                </div>

                {/* Summary Stats */}
                <div className="grid grid-cols-3 gap-4 p-6 border-b border-slate-800">
                    <div className="bg-emerald-900/20 border border-emerald-700/30 rounded-xl p-4">
                        <p className="text-emerald-400/70 text-xs uppercase font-bold flex items-center gap-1 mb-1">
                            <PiggyBank size={14} /> Ahorrado
                        </p>
                        <p className="text-2xl font-bold text-emerald-400">{fmt(goal.monto_actual)}</p>
                        <p className="text-xs text-emerald-500/50 mt-1">{goal.porcentaje}% completado</p>
                    </div>
                    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                        <p className="text-slate-400/70 text-xs uppercase font-bold flex items-center gap-1 mb-1">
                            <Target size={14} /> Meta Total
                        </p>
                        <p className="text-2xl font-bold text-white">{fmt(goal.monto_objetivo)}</p>
                    </div>
                    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                        <p className="text-slate-400/70 text-xs uppercase font-bold flex items-center gap-1 mb-1">
                            <History size={14} /> Falta
                        </p>
                        <p className="text-2xl font-bold text-slate-300">{fmt(Math.max(0, goal.monto_objetivo - goal.monto_actual))}</p>
                    </div>
                </div>

                {/* Evolution Chart */}
                <div className="p-6 border-b border-slate-800 h-64">
                    <h3 className="text-sm font-bold text-slate-400 mb-4 flex items-center gap-2">
                        <TrendingUp size={16} /> Evolución del Ahorro
                    </h3>
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={goal.color} stopOpacity={0.3} />
                                    <stop offset="95%" stopColor={goal.color} stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} vertical={false} />
                            <XAxis
                                dataKey="fecha"
                                stroke="#64748b"
                                tick={{ fontSize: 10 }}
                                tickFormatter={(val) => val ? val.slice(5) : ''}
                            />
                            <YAxis hide />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px' }}
                                itemStyle={{ color: '#f8fafc' }}
                                formatter={(value) => [fmt(value), 'Saldo']}
                                labelStyle={{ color: '#94a3b8' }}
                            />
                            <Area
                                type="monotone"
                                dataKey="balance"
                                stroke={goal.color}
                                fillOpacity={1}
                                fill="url(#colorBalance)"
                                strokeWidth={2}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>

                {/* Transactions */}
                <div className="p-6 flex-1 bg-slate-900">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-sm font-bold text-slate-400">Historial de Movimientos</h3>

                        {/* Filters */}
                        <div className="flex gap-2">
                            <div className="flex items-center bg-slate-800 border border-slate-700 rounded-lg px-2 py-1">
                                <Search size={14} className="text-slate-400 mr-2" />
                                <input
                                    type="text"
                                    value={filterDetail}
                                    onChange={(e) => setFilterDetail(e.target.value)}
                                    placeholder="Buscar..."
                                    className="bg-transparent text-xs text-white focus:outline-none w-24 sm:w-32"
                                />
                            </div>
                            <div className="flex items-center bg-slate-800 border border-slate-700 rounded-lg px-2 py-1">
                                <Filter size={14} className="text-slate-400 mr-2" />
                                <input
                                    type="number"
                                    value={filterMinAmount}
                                    onChange={(e) => setFilterMinAmount(e.target.value)}
                                    placeholder="Min $"
                                    className="bg-transparent text-xs text-white focus:outline-none w-20"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="overflow-hidden rounded-xl border border-slate-800">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-800/50">
                                <tr className="text-slate-400 text-xs uppercase">
                                    <th className="p-3">Fecha</th>
                                    <th className="p-3">Tipo</th>
                                    <th className="p-3">Detalle / Banco</th>
                                    <th className="p-3 text-right">Monto</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {loading ? (
                                    <tr><td colSpan="4" className="p-4 text-center text-slate-500">Cargando...</td></tr>
                                ) : filteredTransactions.length === 0 ? (
                                    <tr><td colSpan="4" className="p-4 text-center text-slate-500">No hay movimientos</td></tr>
                                ) : (
                                    filteredTransactions.map((tx) => (
                                        <tr key={tx.id} className="hover:bg-slate-800/50 transition-colors">
                                            <td className="p-3 text-slate-400 font-mono text-xs">{tx.fecha}</td>
                                            <td className="p-3">
                                                <span className={`text-xs px-2 py-1 rounded-full ${tx.tipo === 'Aporte'
                                                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                                        : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                                    }`}>
                                                    {tx.tipo}
                                                </span>
                                            </td>
                                            <td className="p-3 text-slate-300">
                                                <div className="flex items-center gap-1">
                                                    {tx.detalle}
                                                    {tx.banco && <span className="text-slate-500 text-xs ml-1">({tx.banco})</span>}
                                                </div>
                                            </td>
                                            <td className={`p-3 text-right font-bold ${tx.monto >= 0 ? 'text-emerald-400' : 'text-amber-400'
                                                }`}>
                                                {tx.monto >= 0 ? '+' : ''}{fmt(tx.monto)}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>
        </div>
    );
}
