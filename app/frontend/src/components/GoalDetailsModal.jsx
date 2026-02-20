import { useState, useEffect, useMemo } from 'react';
import { X, TrendingUp, TrendingDown, Target, Search, Filter, ArrowUp, ArrowDown, PiggyBank, History, ArrowLeft, Pencil, Trash2, Check, Calendar, DollarSign } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { API_URL } from "../config";

export default function GoalDetailsModal({ isOpen, onClose, goal, environment = 'TEST', onGoalUpdate }) {
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [chartData, setChartData] = useState([]);

    // Filters
    const [filterDetail, setFilterDetail] = useState('');
    const [filterMinAmount, setFilterMinAmount] = useState('');

    // For editing movements
    const [editingTx, setEditingTx] = useState(null);
    const [editAmount, setEditAmount] = useState('');
    const [editDate, setEditDate] = useState('');
    const [editBank, setEditBank] = useState('');

    // Tabs
    const [activeTab, setActiveTab] = useState('history'); // 'history' | 'plan'

    // Payment Logic
    const [payAmount, setPayAmount] = useState('');
    const [payBank, setPayBank] = useState('');
    const [banks, setBanks] = useState([]);
    const [payingIndex, setPayingIndex] = useState(null);

    useEffect(() => {
        if (isOpen && goal) {
            fetchHistory();
            fetchBanks();
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

    const fetchBanks = async () => {
        try {
            const res = await fetch(`${API_URL}/banks/with-balance?environment=${environment}`);
            if (res.ok) {
                const data = await res.json();
                setBanks(data);
                if (data.length > 0) setPayBank(data[0].nombre);
            }
        } catch (error) {
            console.error('Error fetching banks:', error);
        }
    };

    const handleDelete = async (tx) => {
        if (!confirm(`¿Seguro que quieres eliminar este ${tx.tipo.toLowerCase()}?`)) return;

        const endpoint = tx.tipo === 'Aporte'
            ? `savings-contributions/${tx.original_id}`
            : `savings-withdrawals/${tx.original_id}`;

        try {
            const res = await fetch(`${API_URL}/${endpoint}`, { method: 'DELETE' });
            if (res.ok) {
                fetchHistory();
                if (onGoalUpdate) onGoalUpdate();
            }
        } catch (error) {
            console.error('Error deleting transaction:', error);
        }
    };

    const startEdit = (tx) => {
        setEditingTx(tx);
        setEditAmount(Math.abs(tx.monto).toString());
        setEditDate(tx.fecha);
        setEditBank(tx.banco || '');
    };

    const handleUpdate = async () => {
        if (!editAmount) return;

        const endpoint = editingTx.tipo === 'Aporte'
            ? `savings-contributions/${editingTx.original_id}`
            : `savings-withdrawals/${editingTx.original_id}`;

        if (editingTx.tipo === 'Retiro') {
            alert('Por ahora los retiros solo pueden ser eliminados y recreados para mantener consistencia.');
            return;
        }

        try {
            const res = await fetch(`${API_URL}/${endpoint}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    monto: parseFloat(editAmount),
                    fecha: editDate,
                    banco: editBank
                })
            });
            if (res.ok) {
                setEditingTx(null);
                fetchHistory();
                if (onGoalUpdate) onGoalUpdate();
            }
        } catch (error) {
            console.error('Error updating transaction:', error);
        }
    };

    const handlePayInstallment = async (amount, date, index) => {
        if (!payBank) {
            alert('Por favor selecciona un banco');
            return;
        }

        setPayingIndex(index);

        try {
            const res = await fetch(`${API_URL}/savings-goals/${goal.id}/contribute`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    monto: amount,
                    fecha: date,
                    banco: payBank
                })
            });
            if (res.ok) {
                // Show success state briefly before refreshing
                setTimeout(() => {
                    fetchHistory();
                    if (onGoalUpdate) onGoalUpdate();
                    setPayingIndex(null);
                }, 1000);
            } else {
                setPayingIndex(null);
            }
        } catch (error) {
            console.error('Error paying installment:', error);
            setPayingIndex(null);
        }
    };

    const processChartData = (data) => {
        const sorted = [...data].sort((a, b) => a.fecha.localeCompare(b.fecha));
        let balance = 0;
        const evolution = sorted.map(tx => {
            balance += tx.monto;
            return {
                fecha: tx.fecha,
                balance: balance,
                monto: tx.monto
            };
        });
        if (evolution.length === 0) {
            setChartData([{ fecha: 'Inicio', balance: 0 }]);
        } else {
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

    // Smart Schedule Calculation (Bucket Filling Logic)
    const schedule = useMemo(() => {
        if (!goal || !goal.frecuencia_aporte || !goal.monto_objetivo) return [];

        // 1. Determine Start Date and Total Slots
        // Use created_at or fallback to today. 
        // Note: new Date(goal.created_at) might be invalid if format is weird.
        // Backend returns ISO string or similar? SQLite stores TEXT. 
        // If it's YYYY-MM-DD, new Date() works.
        const startDate = goal.created_at ? new Date(goal.created_at) : new Date();
        startDate.setHours(0, 0, 0, 0);

        let endDate;
        if (goal.fecha_limite) {
            endDate = new Date(goal.fecha_limite + 'T00:00:00');
        } else {
            return [];
        }

        if (endDate <= startDate) return [];

        // 2. Generate All Ideal Slots (The "Plan")
        const idealSlots = [];
        let currentDate = new Date(startDate);

        // Safety: Prevent infinite loops if frequency is broken
        let safety = 0;

        // Advance to first valid slot
        if (goal.frecuencia_aporte === 'Diario') {
            currentDate.setDate(currentDate.getDate() + 1);
        } else if (goal.frecuencia_aporte === 'Semanal') {
            const targetDay = parseInt(goal.dia_aporte);
            if (targetDay) {
                let day = currentDate.getDay() || 7;
                let diff = targetDay - day;
                if (diff <= 0) diff += 7;
                currentDate.setDate(currentDate.getDate() + diff);
            } else {
                currentDate.setDate(currentDate.getDate() + 7);
            }
        } else if (goal.frecuencia_aporte === 'Mensual') {
            const targetDay = parseInt(goal.dia_aporte);
            if (targetDay) {
                if (currentDate.getDate() >= targetDay) {
                    currentDate.setMonth(currentDate.getMonth() + 1);
                }
                currentDate.setDate(targetDay);
            } else {
                currentDate.setMonth(currentDate.getMonth() + 1);
            }
        }

        while (currentDate <= endDate && safety < 1000) {
            idealSlots.push(new Date(currentDate));
            safety++;

            // Advance
            if (goal.frecuencia_aporte === 'Diario') {
                currentDate.setDate(currentDate.getDate() + 1);
            } else if (goal.frecuencia_aporte === 'Semanal') {
                currentDate.setDate(currentDate.getDate() + 7);
            } else if (goal.frecuencia_aporte === 'Mensual') {
                currentDate.setMonth(currentDate.getMonth() + 1);
            } else {
                break;
            }
        }

        if (idealSlots.length === 0) return [];

        // 3. Calculate Fixed Quota Amount
        const fixedQuotaParams = Math.ceil(goal.monto_objetivo / idealSlots.length);

        // 4. Fill Buckets with Current Savings
        let remainingSavings = goal.monto_actual;

        return idealSlots.map((date, index) => {
            const quotaAmount = fixedQuotaParams;
            let status = 'pending';
            let paidAmount = 0;

            if (remainingSavings >= quotaAmount) {
                status = 'paid';
                paidAmount = quotaAmount;
                remainingSavings -= quotaAmount;
            } else if (remainingSavings > 0) {
                status = 'partial';
                paidAmount = remainingSavings;
                remainingSavings = 0;
            } else {
                status = 'pending';
                paidAmount = 0;
            }

            return {
                id: index,
                fecha: date.toISOString().split('T')[0],
                monto: quotaAmount,
                status: status, // paid, partial, pending
                paidAmount: paidAmount
            };
        });

    }, [goal]);


    const fmt = (num) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(num);

    if (!isOpen || !goal) return null;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-start justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl shadow-2xl my-8 flex flex-col">
                <div className="p-6 flex justify-between items-start bg-slate-800/50 border-b border-slate-700 rounded-t-2xl">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={onClose}
                            className="bg-slate-800 hover:bg-slate-700 text-slate-300 p-2 rounded-lg border border-slate-700 transition-colors"
                            title="Volver"
                        >
                            <ArrowLeft size={20} />
                        </button>
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

                <div className="flex-1 bg-slate-900 flex flex-col min-h-0">
                    {/* Tabs */}
                    <div className="flex border-b border-slate-800 px-6">
                        <button
                            onClick={() => setActiveTab('history')}
                            className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${activeTab === 'history'
                                ? 'border-emerald-500 text-emerald-400'
                                : 'border-transparent text-slate-400 hover:text-slate-200'
                                }`}
                        >
                            Historial
                        </button>
                        <button
                            onClick={() => setActiveTab('plan')}
                            className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${activeTab === 'plan'
                                ? 'border-emerald-500 text-emerald-400'
                                : 'border-transparent text-slate-400 hover:text-slate-200'
                                }`}
                        >
                            Plan de Pagos (Proyección)
                        </button>
                    </div>

                    {activeTab === 'history' ? (
                        <>
                            <div className="flex justify-between items-center p-4 border-b border-slate-800 bg-slate-800/20">
                                <h3 className="text-sm font-bold text-slate-400">Movimientos Realizados</h3>
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

                            <div className="overflow-hidden rounded-xl border border-slate-800 m-4">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-slate-800/50">
                                        <tr className="text-slate-400 text-xs uppercase">
                                            <th className="p-3">Fecha</th>
                                            <th className="p-3">Tipo</th>
                                            <th className="p-3">Detalle / Banco</th>
                                            <th className="p-3 text-right">Monto</th>
                                            <th className="p-3 text-center">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800">
                                        {loading ? (
                                            <tr><td colSpan="5" className="p-4 text-center text-slate-500">Cargando...</td></tr>
                                        ) : filteredTransactions.length === 0 ? (
                                            <tr><td colSpan="5" className="p-4 text-center text-slate-500">No hay movimientos</td></tr>
                                        ) : (
                                            filteredTransactions.map((tx) => (
                                                <tr key={tx.id} className="hover:bg-slate-800/50 transition-colors">
                                                    {editingTx?.id === tx.id ? (
                                                        <>
                                                            <td className="p-3">
                                                                <input
                                                                    type="date"
                                                                    className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white w-full"
                                                                    value={editDate}
                                                                    onChange={(e) => setEditDate(e.target.value)}
                                                                />
                                                            </td>
                                                            <td className="p-3">
                                                                <span className="text-xs px-2 py-1 rounded-full bg-slate-800 text-slate-400">
                                                                    {tx.tipo}
                                                                </span>
                                                            </td>
                                                            <td className="p-3">
                                                                <input
                                                                    type="text"
                                                                    className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white w-full"
                                                                    value={editBank}
                                                                    onChange={(e) => setEditBank(e.target.value)}
                                                                    placeholder="Banco"
                                                                />
                                                            </td>
                                                            <td className="p-3">
                                                                <input
                                                                    type="number"
                                                                    className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white w-full text-right"
                                                                    value={editAmount}
                                                                    onChange={(e) => setEditAmount(e.target.value)}
                                                                />
                                                            </td>
                                                            <td className="p-3 text-center">
                                                                <div className="flex items-center justify-center gap-2">
                                                                    <button onClick={handleUpdate} className="text-emerald-400 hover:text-emerald-300">
                                                                        <Check size={16} />
                                                                    </button>
                                                                    <button onClick={() => setEditingTx(null)} className="text-slate-400 hover:text-white">
                                                                        <X size={16} />
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </>
                                                    ) : (
                                                        <>
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
                                                            <td className="p-3 text-center">
                                                                <div className="flex items-center justify-center gap-2">
                                                                    <button
                                                                        onClick={() => startEdit(tx)}
                                                                        className="text-slate-500 hover:text-indigo-400 transition-colors"
                                                                        title="Editar"
                                                                    >
                                                                        <Pencil size={14} />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleDelete(tx)}
                                                                        className="text-slate-500 hover:text-rose-400 transition-colors"
                                                                        title="Eliminar"
                                                                    >
                                                                        <Trash2 size={14} />
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </>
                                                    )}
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    ) : (
                        <div className="p-4">
                            <div className="bg-slate-800/40 rounded-xl border border-slate-700 p-4 mb-4">
                                <p className="text-xs text-slate-400 mb-2">
                                    Este plan se recalcula automáticamente si aportas o <b>retiras</b> dinero.
                                    ¡Tu saldo actual define las cuotas futuras!
                                </p>
                                <div className="flex items-center gap-2">
                                    <label className="text-xs text-slate-300">Banco para pagos:</label>
                                    <select
                                        className="bg-slate-900 border border-slate-600 rounded px-2 py-1 text-white text-xs outline-none flex-1 max-w-xs"
                                        value={payBank}
                                        onChange={(e) => setPayBank(e.target.value)}
                                    >
                                        <option value="">Selecciona un banco</option>
                                        {banks.map(b => (
                                            <option key={b.id} value={b.nombre}>{b.nombre} ({fmt(b.saldo)})</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {schedule.length === 0 ? (
                                <div className="text-center text-slate-500 py-10">
                                    <Check size={48} className="mx-auto mb-4 text-emerald-500/50" />
                                    <p>¡No hay cuotas pendientes!</p>
                                    <p className="text-xs">Has alcanzado tu meta o no has configurado una fecha límite/frecuencia.</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {schedule.map((item, index) => (
                                        <div key={index} className={`border rounded-lg p-3 flex justify-between items-center transition-colors ${item.status === 'paid'
                                            ? 'bg-emerald-900/10 border-emerald-500/30'
                                            : 'bg-slate-800 border-slate-700 hover:border-slate-600'
                                            }`}>
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${item.status === 'paid' ? 'bg-emerald-500 text-white' : 'bg-slate-700 text-slate-300'
                                                    }`}>
                                                    {item.status === 'paid' ? <Check size={14} /> : `#${index + 1}`}
                                                </div>
                                                <div>
                                                    <p className={`font-bold ${item.status === 'paid' ? 'text-emerald-400' : 'text-white'}`}>
                                                        {fmt(item.monto)}
                                                    </p>
                                                    <p className="text-xs text-slate-400 flex items-center gap-1">
                                                        <Calendar size={10} /> {item.fecha}
                                                        {item.status === 'partial' && <span className="text-amber-400 ml-1">(Parcial: {fmt(item.paidAmount)})</span>}
                                                    </p>
                                                </div>
                                            </div>

                                            {item.status === 'paid' ? (
                                                <span className="text-emerald-400 text-xs font-bold flex items-center gap-1 bg-emerald-900/30 px-3 py-1.5 rounded-lg border border-emerald-500/30">
                                                    <Check size={14} /> ¡Aportado!
                                                </span>
                                            ) : payingIndex === index ? (
                                                <span className="text-emerald-400 text-xs font-bold flex items-center gap-1 bg-emerald-900/30 px-3 py-1.5 rounded-lg border border-emerald-500/30">
                                                    <Check size={14} /> Procesando...
                                                </span>
                                            ) : (
                                                <button
                                                    onClick={() => handlePayInstallment(item.monto - item.paidAmount, item.fecha, index)}
                                                    disabled={payingIndex !== null}
                                                    className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    <DollarSign size={14} /> Pagar {item.status === 'partial' ? 'Resto' : ''}
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
