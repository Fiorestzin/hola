import { useState, useEffect } from 'react';
import { X, Plus, Target, Trash2, Pencil, PiggyBank, Calendar, TrendingUp, Check, XCircle, DollarSign, History, ArrowDown, ArrowUp, ChevronDown, ChevronUp, BarChart3, AlertTriangle } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { API_URL } from "../config";

// Preset icons for goals
const GOAL_ICONS = ['🎯', '✈️', '🏠', '🚗', '💻', '📚', '🎓', '💍', '🏖️', '💰', '🎸', '🏋️'];
const GOAL_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

export default function SavingsGoalsModal({ isOpen, onClose, environment = "TEST", onGoalChange }) {
    const [goals, setGoals] = useState([]);
    const [banks, setBanks] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [editingGoal, setEditingGoal] = useState(null);

    // Contribution state
    const [contributingGoal, setContributingGoal] = useState(null);
    const [contributionAmount, setContributionAmount] = useState('');
    const [contributionBank, setContributionBank] = useState('');

    // Withdrawal state
    const [withdrawingGoal, setWithdrawingGoal] = useState(null);
    const [withdrawalData, setWithdrawalData] = useState({
        monto: '',
        motivo: '',
        categoria: '',
        banco: '',
        fecha_limite_reponer: ''
    });
    const [pendingWithdrawals, setPendingWithdrawals] = useState({});
    const [goalBanks, setGoalBanks] = useState([]); // Banks with contributions to current goal

    // History state
    const [expandedHistory, setExpandedHistory] = useState(null);
    const [contributions, setContributions] = useState({});

    // Chart state
    const [showChart, setShowChart] = useState(null);

    // Form state
    const [formData, setFormData] = useState({
        nombre: '',
        monto_objetivo: '',
        fecha_limite: '',
        icono: '🎯',
        color: '#3b82f6'
    });

    useEffect(() => {
        if (isOpen) {
            fetchGoals();
            fetchBanks();
            fetchCategories();
            fetchPendingWithdrawals();
            resetForm();
        }
    }, [isOpen, environment]);

    const fetchGoals = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/savings-goals?environment=${environment}`);
            if (res.ok) {
                const data = await res.json();
                setGoals(data);
            }
        } catch (error) {
            console.error("Error loading goals:", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchBanks = async () => {
        try {
            const res = await fetch(`${API_URL}/banks?environment=${environment}`);
            if (res.ok) {
                const data = await res.json();
                setBanks(data);
            }
        } catch (error) {
            console.error("Error loading banks:", error);
        }
    };

    const fetchContributions = async (goalId) => {
        try {
            const res = await fetch(`${API_URL}/savings-goals/${goalId}/contributions`);
            if (res.ok) {
                const data = await res.json();
                setContributions(prev => ({ ...prev, [goalId]: data }));
            }
        } catch (error) {
            console.error("Error loading contributions:", error);
        }
    };

    const fetchCategories = async () => {
        try {
            const res = await fetch(`${API_URL}/categories`);
            if (res.ok) {
                const data = await res.json();
                setCategories(data.filter(c => c.tipo === 'Gasto'));
            }
        } catch (error) {
            console.error("Error loading categories:", error);
        }
    };

    const fetchPendingWithdrawals = async () => {
        try {
            const res = await fetch(`${API_URL}/savings-withdrawals/pending?environment=${environment}`);
            if (res.ok) {
                const data = await res.json();
                // Group by goal_id
                const grouped = {};
                data.forEach(w => {
                    if (!grouped[w.goal_id]) grouped[w.goal_id] = [];
                    grouped[w.goal_id].push(w);
                });
                setPendingWithdrawals(grouped);
            }
        } catch (error) {
            console.error("Error loading pending withdrawals:", error);
        }
    };

    const fetchGoalBanks = async (goalId) => {
        try {
            const res = await fetch(`${API_URL}/savings-goals/${goalId}/banks`);
            if (res.ok) {
                const data = await res.json();
                setGoalBanks(data);
            }
        } catch (error) {
            console.error("Error loading goal banks:", error);
        }
    };

    const handleWithdraw = async (goalId) => {
        if (!withdrawalData.monto || !withdrawalData.fecha_limite_reponer || !withdrawalData.banco) {
            alert("Ingresa monto, banco origen y fecha límite para reponer");
            return;
        }
        try {
            const res = await fetch(`${API_URL}/savings-goals/${goalId}/withdraw?environment=${environment}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    monto: parseFloat(withdrawalData.monto.replace(/\D/g, '')),
                    motivo: withdrawalData.motivo,
                    categoria: withdrawalData.categoria || 'Otros',
                    banco: withdrawalData.banco,
                    fecha_limite_reponer: withdrawalData.fecha_limite_reponer
                })
            });
            if (res.ok) {
                fetchGoals();
                fetchPendingWithdrawals();
                setWithdrawingGoal(null);
                setWithdrawalData({ monto: '', motivo: '', categoria: '', banco: '', fecha_limite_reponer: '' });
                if (onGoalChange) onGoalChange();
            } else {
                const err = await res.json();
                alert(err.detail || "Error al crear retiro");
            }
        } catch (error) {
            console.error("Error creating withdrawal:", error);
        }
    };

    const handleRepayWithdrawal = async (withdrawalId) => {
        if (!confirm('¿Marcar este retiro como repuesto? Se añadirá el monto de vuelta a la meta.')) return;
        try {
            const res = await fetch(`${API_URL}/savings-withdrawals/${withdrawalId}/repay`, { method: 'PUT' });
            if (res.ok) {
                fetchGoals();
                fetchPendingWithdrawals();
                if (onGoalChange) onGoalChange();
            }
        } catch (error) {
            console.error("Error repaying withdrawal:", error);
        }
    };

    const handleCompleteGoal = async (goalId, goalName) => {
        if (!confirm(`¿Completar la meta "${goalName}"?\n\nEsto liberará los comprometidos de todos los bancos y archivará la meta.`)) return;
        try {
            const res = await fetch(`${API_URL}/savings-goals/${goalId}/complete`, { method: 'POST' });
            if (res.ok) {
                fetchGoals();
                fetchPendingWithdrawals();
                if (onGoalChange) onGoalChange();
                alert('🎉 ¡Meta completada! Los comprometidos han sido liberados.');
            } else {
                const err = await res.json();
                alert(err.detail || 'Error al completar la meta');
            }
        } catch (error) {
            console.error("Error completing goal:", error);
        }
    };

    const resetForm = () => {
        setFormData({
            nombre: '',
            monto_objetivo: '',
            fecha_limite: '',
            icono: '🎯',
            color: '#3b82f6'
        });
        setShowCreateForm(false);
        setEditingGoal(null);
        setContributingGoal(null);
        setContributionAmount('');
        setContributionBank('');
    };

    const handleCreateGoal = async (e) => {
        e.preventDefault();
        if (!formData.nombre || !formData.monto_objetivo) return;

        try {
            const res = await fetch(`${API_URL}/savings-goals`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...formData,
                    monto_objetivo: parseFloat(formData.monto_objetivo.replace(/\D/g, '')),
                    fecha_limite: formData.fecha_limite,
                    environment
                })
            });
            if (res.ok) {
                fetchGoals();
                resetForm();
                if (onGoalChange) onGoalChange();
            }
        } catch (error) {
            console.error("Error creating goal:", error);
        }
    };

    const handleUpdateGoal = async (e) => {
        e.preventDefault();
        if (!formData.nombre || !formData.monto_objetivo) return;

        try {
            const res = await fetch(`${API_URL}/savings-goals/${editingGoal.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    nombre: formData.nombre,
                    monto_objetivo: parseFloat(formData.monto_objetivo.toString().replace(/\D/g, '')),
                    fecha_limite: formData.fecha_limite,
                    icono: formData.icono,
                    color: formData.color
                })
            });
            if (res.ok) {
                fetchGoals();
                resetForm();
                if (onGoalChange) onGoalChange();
            }
        } catch (error) {
            console.error("Error updating goal:", error);
        }
    };

    const handleDeleteGoal = async (goalId) => {
        if (!confirm('¿Seguro que quieres eliminar esta meta? Se perderá todo el historial de aportes.')) return;

        try {
            const res = await fetch(`${API_URL}/savings-goals/${goalId}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                fetchGoals();
                if (onGoalChange) onGoalChange();
            }
        } catch (error) {
            console.error("Error deleting goal:", error);
        }
    };

    const handleContribute = async (goalId) => {
        if (!contributionAmount) return;

        const monto = parseFloat(contributionAmount.replace(/\D/g, ''));
        if (monto <= 0) return;

        try {
            const res = await fetch(`${API_URL}/savings-goals/${goalId}/contribute`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    monto,
                    banco: contributionBank || null
                })
            });
            if (res.ok) {
                fetchGoals();
                setContributingGoal(null);
                setContributionAmount('');
                setContributionBank('');
                // Refresh contributions if history is expanded
                if (expandedHistory === goalId) {
                    fetchContributions(goalId);
                }
                if (onGoalChange) onGoalChange();
            }
        } catch (error) {
            console.error("Error contributing:", error);
        }
    };

    const toggleHistory = (goalId) => {
        if (expandedHistory === goalId) {
            setExpandedHistory(null);
        } else {
            setExpandedHistory(goalId);
            if (!contributions[goalId]) {
                fetchContributions(goalId);
            }
        }
    };

    const startEdit = (goal) => {
        setEditingGoal(goal);
        setFormData({
            nombre: goal.nombre,
            monto_objetivo: goal.monto_objetivo.toLocaleString('es-CL'),
            fecha_limite: goal.fecha_limite || '',
            icono: goal.icono,
            color: goal.color
        });
        setShowCreateForm(true);
    };

    const formatMonto = (value) => {
        const num = value.toString().replace(/\D/g, '');
        return num ? parseInt(num).toLocaleString('es-CL') : '';
    };

    const fmt = (num) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(num);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="p-4 flex justify-between items-center bg-gradient-to-r from-emerald-600/20 to-teal-600/20 border-b border-slate-700">
                    <h2 className="font-bold text-xl flex items-center gap-2 text-emerald-400">
                        <PiggyBank size={24} /> Metas de Ahorro
                    </h2>
                    <div className="flex items-center gap-2">
                        {!showCreateForm && (
                            <button
                                onClick={() => setShowCreateForm(true)}
                                className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg text-sm flex items-center gap-1 transition-colors"
                            >
                                <Plus size={16} /> Nueva Meta
                            </button>
                        )}
                        <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                            <X />
                        </button>
                    </div>
                </div>

                {/* Create/Edit Form */}
                {showCreateForm && (
                    <form onSubmit={editingGoal ? handleUpdateGoal : handleCreateGoal} className="p-4 bg-slate-700/30 border-b border-slate-700 space-y-4">
                        <div className="flex items-center gap-2 text-slate-200 font-semibold mb-2">
                            <Target size={16} className="text-emerald-400" />
                            {editingGoal ? 'Editar Meta' : 'Nueva Meta de Ahorro'}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Name */}
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">Nombre de la meta</label>
                                <input
                                    type="text"
                                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                                    placeholder="Ej: Viaje a Europa"
                                    value={formData.nombre}
                                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                                    required
                                />
                            </div>

                            {/* Target Amount */}
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">Monto objetivo</label>
                                <input
                                    type="text"
                                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                                    placeholder="$500,000"
                                    value={formData.monto_objetivo}
                                    onChange={(e) => setFormData({ ...formData, monto_objetivo: formatMonto(e.target.value) })}
                                    required
                                />
                            </div>

                            {/* Deadline */}
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">Fecha límite</label>
                                <input
                                    type="date"
                                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                                    value={formData.fecha_limite}
                                    onChange={(e) => setFormData({ ...formData, fecha_limite: e.target.value })}
                                    required
                                />
                            </div>

                            {/* Icon & Color */}
                            <div className="flex gap-4">
                                <div className="flex-1">
                                    <label className="block text-xs text-slate-400 mb-1">Icono</label>
                                    <div className="flex flex-wrap gap-1">
                                        {GOAL_ICONS.map(icon => (
                                            <button
                                                key={icon}
                                                type="button"
                                                onClick={() => setFormData({ ...formData, icono: icon })}
                                                className={`w-8 h-8 rounded flex items-center justify-center text-lg transition-all ${formData.icono === icon
                                                    ? 'bg-emerald-600 scale-110'
                                                    : 'bg-slate-700 hover:bg-slate-600'
                                                    }`}
                                            >
                                                {icon}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1">Color</label>
                                    <div className="flex flex-wrap gap-1">
                                        {GOAL_COLORS.map(color => (
                                            <button
                                                key={color}
                                                type="button"
                                                onClick={() => setFormData({ ...formData, color: color })}
                                                className={`w-6 h-6 rounded-full transition-all ${formData.color === color ? 'ring-2 ring-white scale-110' : ''
                                                    }`}
                                                style={{ backgroundColor: color }}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={resetForm}
                                className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
                            >
                                <Check size={16} />
                                {editingGoal ? 'Guardar Cambios' : 'Crear Meta'}
                            </button>
                        </div>
                    </form>
                )}

                {/* Goals List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {loading ? (
                        <div className="text-center text-slate-500 py-8">Cargando metas...</div>
                    ) : goals.length === 0 ? (
                        <div className="text-center text-slate-500 py-8">
                            <PiggyBank size={48} className="mx-auto mb-4 opacity-50" />
                            <p>No tienes metas de ahorro aún.</p>
                            <p className="text-sm">¡Crea tu primera meta para empezar a ahorrar!</p>
                        </div>
                    ) : (
                        goals.map(goal => (
                            <div
                                key={goal.id}
                                className="bg-slate-900/50 rounded-xl border border-slate-700/50 p-4 hover:border-slate-600 transition-all"
                            >
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex items-center gap-3">
                                        <span
                                            className="text-2xl w-10 h-10 rounded-lg flex items-center justify-center"
                                            style={{ backgroundColor: `${goal.color}20` }}
                                        >
                                            {goal.icono}
                                        </span>
                                        <div>
                                            <h3 className="font-semibold text-white">{goal.nombre}</h3>
                                            {goal.fecha_limite && (
                                                <p className="text-xs text-slate-400 flex items-center gap-1">
                                                    <Calendar size={10} /> Meta: {goal.fecha_limite}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => setContributingGoal(contributingGoal === goal.id ? null : goal.id)}
                                            className={`p-2 rounded transition-colors ${contributingGoal === goal.id ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-emerald-400'}`}
                                            title="Hacer aporte"
                                        >
                                            <DollarSign size={14} />
                                        </button>
                                        <button
                                            onClick={() => {
                                                if (withdrawingGoal !== goal.id) {
                                                    fetchGoalBanks(goal.id);
                                                }
                                                setWithdrawingGoal(withdrawingGoal === goal.id ? null : goal.id);
                                                setContributingGoal(null);
                                            }}
                                            className={`p-2 rounded transition-colors ${withdrawingGoal === goal.id ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-amber-400'}`}
                                            title="Retirar fondos"
                                        >
                                            <ArrowUp size={14} />
                                        </button>
                                        <button
                                            onClick={() => toggleHistory(goal.id)}
                                            className={`p-2 rounded transition-colors ${expandedHistory === goal.id ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-indigo-400'}`}
                                            title="Ver historial"
                                        >
                                            <History size={14} />
                                        </button>
                                        <button
                                            onClick={() => startEdit(goal)}
                                            className="p-2 text-slate-400 hover:text-indigo-400 transition-colors"
                                            title="Editar"
                                        >
                                            <Pencil size={14} />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteGoal(goal.id)}
                                            className="p-2 text-slate-400 hover:text-rose-400 transition-colors"
                                            title="Eliminar"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>

                                {/* Contribution Form */}
                                {contributingGoal === goal.id && (
                                    <div className="mb-3 p-3 bg-emerald-900/20 border border-emerald-700/30 rounded-lg">
                                        <div className="flex items-center gap-2 mb-2 text-sm text-emerald-400">
                                            <ArrowDown size={14} /> Nuevo aporte
                                        </div>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                                                placeholder="Monto"
                                                value={contributionAmount}
                                                onChange={(e) => setContributionAmount(formatMonto(e.target.value))}
                                            />
                                            <select
                                                className="bg-slate-800 border border-slate-600 rounded-lg px-2 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
                                                value={contributionBank}
                                                onChange={(e) => setContributionBank(e.target.value)}
                                            >
                                                <option value="">Sin banco</option>
                                                {banks.map(b => (
                                                    <option key={b.id} value={b.nombre}>{b.nombre}</option>
                                                ))}
                                            </select>
                                            <button
                                                onClick={() => handleContribute(goal.id)}
                                                className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg transition-colors"
                                            >
                                                <Check size={16} />
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Withdrawal Form */}
                                {withdrawingGoal === goal.id && (
                                    <div className="mb-3 p-3 bg-amber-900/20 border border-amber-700/30 rounded-lg">
                                        <div className="flex items-center gap-2 mb-2 text-sm text-amber-400">
                                            <ArrowUp size={14} /> Retirar fondos
                                        </div>
                                        <div className="space-y-2">
                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                                                    placeholder="Monto"
                                                    value={withdrawalData.monto}
                                                    onChange={(e) => setWithdrawalData({ ...withdrawalData, monto: formatMonto(e.target.value) })}
                                                />
                                                <select
                                                    className="bg-slate-800 border border-slate-600 rounded-lg px-2 py-2 text-white text-sm focus:outline-none focus:border-amber-500"
                                                    value={withdrawalData.categoria}
                                                    onChange={(e) => setWithdrawalData({ ...withdrawalData, categoria: e.target.value })}
                                                >
                                                    <option value="">Categoría</option>
                                                    {categories.map(c => (
                                                        <option key={c.id} value={c.nombre}>{c.nombre}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                                                    placeholder="Motivo (ej: Emergencia médica)"
                                                    value={withdrawalData.motivo}
                                                    onChange={(e) => setWithdrawalData({ ...withdrawalData, motivo: e.target.value })}
                                                />
                                                <select
                                                    className="bg-slate-800 border border-slate-600 rounded-lg px-2 py-2 text-white text-sm focus:outline-none focus:border-amber-500"
                                                    value={withdrawalData.banco}
                                                    onChange={(e) => setWithdrawalData({ ...withdrawalData, banco: e.target.value })}
                                                    required
                                                >
                                                    <option value="">Banco origen *</option>
                                                    {goalBanks.map(b => (
                                                        <option key={b.banco} value={b.banco}>{b.banco} (${b.total.toLocaleString('es-CL')})</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="flex gap-2 items-center">
                                                <label className="text-xs text-slate-400">Reponer antes de:</label>
                                                <input
                                                    type="date"
                                                    className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                                                    value={withdrawalData.fecha_limite_reponer}
                                                    onChange={(e) => setWithdrawalData({ ...withdrawalData, fecha_limite_reponer: e.target.value })}
                                                    required
                                                />
                                                <button
                                                    onClick={() => handleWithdraw(goal.id)}
                                                    className="bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 rounded-lg transition-colors"
                                                >
                                                    <Check size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Pending Withdrawals Alert */}
                                {pendingWithdrawals[goal.id] && pendingWithdrawals[goal.id].length > 0 && (
                                    <div className="mb-3 p-3 bg-amber-900/30 border border-amber-600/50 rounded-lg">
                                        <div className="flex items-center gap-2 mb-2 text-sm text-amber-400 font-semibold">
                                            <AlertTriangle size={14} /> Retiros pendientes de reponer
                                        </div>
                                        <div className="space-y-2">
                                            {pendingWithdrawals[goal.id].map(w => (
                                                <div key={w.id} className="flex items-center justify-between text-xs bg-slate-800/50 p-2 rounded">
                                                    <div>
                                                        <span className="text-amber-300 font-bold">{fmt(w.monto)}</span>
                                                        <span className="text-slate-400 ml-2">{w.motivo || 'Sin motivo'}</span>
                                                        <span className="text-slate-500 ml-2">Límite: {w.fecha_limite_reponer}</span>
                                                    </div>
                                                    <button
                                                        onClick={() => handleRepayWithdrawal(w.id)}
                                                        className="bg-emerald-600 hover:bg-emerald-500 text-white px-2 py-1 rounded text-xs"
                                                    >
                                                        Reponer
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Progress Bar */}
                                <div className="mb-2">
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="text-slate-400">
                                            {fmt(goal.monto_actual)} de {fmt(goal.monto_objetivo)}
                                        </span>
                                        <span
                                            className="font-bold"
                                            style={{ color: goal.color }}
                                        >
                                            {goal.porcentaje}%
                                        </span>
                                    </div>
                                    <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                                        <div
                                            className="h-full rounded-full transition-all duration-500"
                                            style={{
                                                width: `${Math.min(goal.porcentaje, 100)}%`,
                                                backgroundColor: goal.color
                                            }}
                                        />
                                    </div>
                                </div>

                                {/* Quick Stats */}
                                <div className="flex items-center justify-between text-xs text-slate-500">
                                    <span>Faltan: {fmt(goal.monto_objetivo - goal.monto_actual)}</span>
                                    {goal.porcentaje >= 100 && (
                                        <span className="text-emerald-400 font-bold flex items-center gap-1">
                                            <Check size={12} /> ¡Meta alcanzada!
                                        </span>
                                    )}
                                </div>

                                {/* Complete Goal Button */}
                                {goal.porcentaje >= 100 && (
                                    <button
                                        onClick={() => handleCompleteGoal(goal.id, goal.nombre)}
                                        className="mt-3 w-full py-2 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-lg transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
                                    >
                                        🎉 Completar Meta
                                    </button>
                                )}

                                {/* Projection Calculator */}
                                {goal.porcentaje < 100 && (
                                    <div className="mt-2 p-2 bg-slate-800/50 rounded-lg">
                                        <div className="text-xs text-slate-400 mb-1 flex items-center gap-1">
                                            <TrendingUp size={10} /> Para alcanzar tu meta necesitas:
                                        </div>
                                        {(() => {
                                            const restante = goal.monto_objetivo - goal.monto_actual;
                                            const hoy = new Date();

                                            // If there's a deadline, calculate based on that
                                            let diasRestantes = 365; // Default 1 year
                                            if (goal.fecha_limite) {
                                                const limite = new Date(goal.fecha_limite);
                                                diasRestantes = Math.max(1, Math.ceil((limite - hoy) / (1000 * 60 * 60 * 24)));
                                            }

                                            const diario = restante / diasRestantes;
                                            const semanal = diasRestantes >= 7 ? (restante / diasRestantes) * 7 : null;
                                            const mensual = diasRestantes >= 30 ? (restante / diasRestantes) * 30 : null;

                                            // Determinar cuántas columnas mostrar
                                            const showSemanal = semanal !== null;
                                            const showMensual = mensual !== null;
                                            const cols = 1 + (showSemanal ? 1 : 0) + (showMensual ? 1 : 0);

                                            return (
                                                <div className={`grid gap-2`} style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
                                                    <div className="text-center">
                                                        <div className="text-lg font-bold" style={{ color: goal.color }}>
                                                            {fmt(diario)}
                                                        </div>
                                                        <div className="text-xs text-slate-500">diario</div>
                                                    </div>
                                                    {showSemanal && (
                                                        <div className="text-center border-x border-slate-700">
                                                            <div className="text-lg font-bold" style={{ color: goal.color }}>
                                                                {fmt(semanal)}
                                                            </div>
                                                            <div className="text-xs text-slate-500">semanal</div>
                                                        </div>
                                                    )}
                                                    {showMensual && (
                                                        <div className={`text-center ${!showSemanal ? 'border-l border-slate-700' : ''}`}>
                                                            <div className="text-lg font-bold" style={{ color: goal.color }}>
                                                                {fmt(mensual)}
                                                            </div>
                                                            <div className="text-xs text-slate-500">mensual</div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })()}
                                        <div className="text-xs text-center text-slate-500 mt-1">
                                            {(() => {
                                                const hoy = new Date();
                                                const limite = new Date(goal.fecha_limite);
                                                const dias = Math.max(0, Math.ceil((limite - hoy) / (1000 * 60 * 60 * 24)));
                                                return `${dias} días restantes hasta ${goal.fecha_limite}`;
                                            })()}
                                        </div>
                                    </div>
                                )}

                                {/* Contributions History */}
                                {expandedHistory === goal.id && (
                                    <div className="mt-3 pt-3 border-t border-slate-700">
                                        <div className="text-xs text-slate-400 mb-2 flex items-center gap-1">
                                            <History size={12} /> Historial de aportes
                                        </div>
                                        {!contributions[goal.id] ? (
                                            <div className="text-xs text-slate-500">Cargando...</div>
                                        ) : contributions[goal.id].length === 0 ? (
                                            <div className="text-xs text-slate-500">Sin aportes aún</div>
                                        ) : (
                                            <>
                                                {/* Progress Chart */}
                                                <div className="h-40 mb-3">
                                                    <ResponsiveContainer width="100%" height="100%">
                                                        <AreaChart
                                                            data={(() => {
                                                                // Sort contributions by date and calculate cumulative
                                                                const sorted = [...contributions[goal.id]].sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
                                                                let acumulado = 0;
                                                                return sorted.map(c => {
                                                                    acumulado += c.monto;
                                                                    return {
                                                                        fecha: c.fecha.substring(5), // Show MM-DD
                                                                        acumulado,
                                                                        meta: goal.monto_objetivo
                                                                    };
                                                                });
                                                            })()}
                                                            margin={{ top: 5, right: 5, left: 0, bottom: 5 }}
                                                        >
                                                            <defs>
                                                                <linearGradient id={`gradient-${goal.id}`} x1="0" y1="0" x2="0" y2="1">
                                                                    <stop offset="5%" stopColor={goal.color} stopOpacity={0.4} />
                                                                    <stop offset="95%" stopColor={goal.color} stopOpacity={0} />
                                                                </linearGradient>
                                                            </defs>
                                                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                                            <XAxis dataKey="fecha" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                                                            <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                                                            <Tooltip
                                                                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }}
                                                                labelStyle={{ color: '#e2e8f0' }}
                                                                formatter={(value) => [`$${value.toLocaleString('es-CL')}`, 'Acumulado']}
                                                            />
                                                            <ReferenceLine y={goal.monto_objetivo} stroke="#f59e0b" strokeDasharray="5 5" label={{ value: 'Meta', fill: '#f59e0b', fontSize: 10 }} />
                                                            <Area type="monotone" dataKey="acumulado" stroke={goal.color} fillOpacity={1} fill={`url(#gradient-${goal.id})`} strokeWidth={2} />
                                                        </AreaChart>
                                                    </ResponsiveContainer>
                                                </div>

                                                {/* List */}
                                                <div className="space-y-1 max-h-24 overflow-y-auto">
                                                    {contributions[goal.id].map(c => (
                                                        <div key={c.id} className="flex justify-between items-center text-xs bg-slate-800/50 px-2 py-1 rounded">
                                                            <span className="text-slate-400">{c.fecha}</span>
                                                            <div className="flex items-center gap-2">
                                                                {c.banco && <span className="text-slate-500">{c.banco}</span>}
                                                                <span className="text-emerald-400 font-semibold">{fmt(c.monto)}</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
