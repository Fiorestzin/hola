import { useState, useEffect } from 'react';
import { X, Plus, Target, Trash2, Pencil, PiggyBank, Calendar, TrendingUp, TrendingDown, Check, DollarSign, History, ArrowDown, ArrowUp, AlertTriangle } from 'lucide-react';
import { API_URL } from "../config";
import GoalDetailsModal from './GoalDetailsModal';

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

    // Execution state
    const [executingGoal, setExecutingGoal] = useState(null);
    const [executionData, setExecutionData] = useState({
        monto: '',
        banco: '',
        categoria: '',
        detalle: '',
        fecha: new Date().toISOString().split('T')[0]
    });

    // UI State
    const [goalBanks, setGoalBanks] = useState([]); // Banks with contributions to current goal
    const [selectedGoal, setSelectedGoal] = useState(null); // For Detail Modal

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

    const handleExecuteGoal = async (goalId) => {
        if (!executionData.monto || !executionData.banco || !executionData.categoria) {
            alert("Por favor completa los campos obligatorios (monto, banco y categoría)");
            return;
        }

        try {
            // 1. Create the transaction
            const txRes = await fetch(`${API_URL}/transaction`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fecha: executionData.fecha,
                    tipo: 'Gasto',
                    categoria: executionData.categoria,
                    detalle: executionData.detalle || `Ejecución meta: ${executingGoal.nombre}`,
                    banco: executionData.banco,
                    monto: parseFloat(executionData.monto.toString().replace(/\D/g, '')),
                    environment
                })
            });

            if (!txRes.ok) {
                const err = await txRes.json();
                alert(err.detail || "Error al registrar el gasto");
                return;
            }

            // 2. Complete the goal (which frees committed counts and deletes the goal)
            const completeRes = await fetch(`${API_URL}/savings-goals/${goalId}/complete`, {
                method: 'POST'
            });

            if (completeRes.ok) {
                fetchGoals();
                fetchPendingWithdrawals();
                setExecutingGoal(null);
                if (onGoalChange) onGoalChange();
                alert('🎉 ¡Gasto registrado y meta finalizada!');
            }
        } catch (error) {
            console.error("Error executing goal:", error);
            alert("Error al procesar la ejecución de la meta");
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
        setExecutingGoal(null);
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
                if (onGoalChange) onGoalChange();
            }
        } catch (error) {
            console.error("Error contributing:", error);
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
            <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

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
                    <form onSubmit={editingGoal ? handleUpdateGoal : handleCreateGoal} className="p-4 bg-slate-700/30 border-b border-slate-700 space-y-4 animate-in slide-in-from-top-2">
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

                {/* Goals Grid */}
                <div className="flex-1 overflow-y-auto p-4">
                    {loading ? (
                        <div className="text-center text-slate-500 py-8">Cargando metas...</div>
                    ) : goals.length === 0 ? (
                        <div className="text-center text-slate-500 py-8">
                            <PiggyBank size={48} className="mx-auto mb-4 opacity-50" />
                            <p>No tienes metas de ahorro aún.</p>
                            <p className="text-sm">¡Crea tu primera meta para empezar a ahorrar!</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4">
                            {goals.map(goal => (
                                <div
                                    key={goal.id}
                                    className="bg-slate-900 rounded-xl border border-slate-700/50 hover:border-slate-500 transition-all shadow-lg overflow-hidden group relative flex flex-col"
                                >
                                    {/* Card Header (Clickable) */}
                                    <div
                                        onClick={() => setSelectedGoal(goal)}
                                        className="p-4 cursor-pointer hover:bg-slate-800/30 transition-colors flex-1"
                                    >
                                        <div className="flex justify-between items-start mb-3">
                                            <div className="flex items-center gap-3">
                                                <span
                                                    className="text-2xl w-12 h-12 rounded-xl flex items-center justify-center shadow-inner"
                                                    style={{ backgroundColor: `${goal.color}15`, color: goal.color }}
                                                >
                                                    {goal.icono}
                                                </span>
                                                <div>
                                                    <h3 className="font-bold text-white group-hover:text-emerald-400 transition-colors">{goal.nombre}</h3>
                                                    <p className="text-xs text-slate-400">
                                                        {goal.fecha_limite ? `Meta: ${goal.fecha_limite}` : 'Sin fecha límite'}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-lg font-bold text-white">{fmt(goal.monto_actual)}</p>
                                                <p className="text-xs text-slate-500">de {fmt(goal.monto_objetivo)}</p>
                                            </div>
                                        </div>

                                        {/* Progress Bar */}
                                        <div className="mb-2 relative pt-2">
                                            <div className="flex justify-between text-[10px] text-slate-400 mb-1 font-mono">
                                                <span>{goal.porcentaje}%</span>
                                                <span>{fmt(Math.max(0, goal.monto_objetivo - goal.monto_actual))} falta</span>
                                            </div>
                                            <div className="h-2 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                                                <div
                                                    className="h-full rounded-full transition-all duration-700 ease-out shadow-[0_0_10px_rgba(0,0,0,0.5)]"
                                                    style={{
                                                        width: `${Math.min(goal.porcentaje, 100)}%`,
                                                        backgroundColor: goal.color
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Quick Actions Footer */}
                                    <div className="bg-slate-950/30 p-2 border-t border-slate-800 flex justify-between items-center gap-2">
                                        <div className="flex gap-1">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setContributingGoal(contributingGoal === goal.id ? null : goal.id); setWithdrawingGoal(null); }}
                                                className={`p-1.5 rounded-lg transition-colors flex items-center gap-1 text-xs font-medium ${contributingGoal === goal.id
                                                    ? 'bg-emerald-600 text-white'
                                                    : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                                                    }`}
                                                title="Aporte Rápido"
                                            >
                                                <Plus size={14} /> Aportar
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (withdrawingGoal !== goal.id) fetchGoalBanks(goal.id);
                                                    setWithdrawingGoal(withdrawingGoal === goal.id ? null : goal.id);
                                                    setContributingGoal(null);
                                                }}
                                                className={`p-1.5 rounded-lg transition-colors flex items-center gap-1 text-xs font-medium ${withdrawingGoal === goal.id
                                                    ? 'bg-amber-600 text-white'
                                                    : 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20'
                                                    }`}
                                                title="Retirar Fondos"
                                            >
                                                <ArrowUp size={14} /> Retirar
                                            </button>

                                            {goal.porcentaje >= 100 && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setExecutingGoal(executingGoal?.id === goal.id ? null : goal);
                                                        setContributingGoal(null);
                                                        setWithdrawingGoal(null);
                                                        setExecutionData({
                                                            monto: goal.monto_actual.toLocaleString('es-CL'),
                                                            banco: '',
                                                            categoria: '',
                                                            detalle: `Compra: ${goal.nombre}`,
                                                            fecha: new Date().toISOString().split('T')[0]
                                                        });
                                                    }}
                                                    className={`p-1.5 rounded-lg transition-colors flex items-center gap-1 text-xs font-bold shadow-sm ${executingGoal?.id === goal.id
                                                        ? 'bg-blue-600 text-white'
                                                        : 'bg-emerald-600 text-white hover:bg-emerald-500 animate-pulse'
                                                        }`}
                                                    title="Efectuar Gasto"
                                                >
                                                    <Check size={14} /> Efectuar Gasto
                                                </button>
                                            )}
                                        </div>

                                        <div className="flex gap-1">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); startEdit(goal); }}
                                                className="p-1.5 text-slate-500 hover:text-indigo-400 transition-colors"
                                                title="Editar"
                                            >
                                                <Pencil size={14} />
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleDeleteGoal(goal.id); }}
                                                className="p-1.5 text-slate-500 hover:text-rose-400 transition-colors"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Inline Forms (Overlay) */}
                                    {(contributingGoal === goal.id || withdrawingGoal === goal.id || executingGoal?.id === goal.id) && (
                                        <div className="p-3 bg-slate-800 border-t border-slate-700 animate-in slide-in-from-top-2">
                                            {contributingGoal === goal.id && (
                                                <div className="flex flex-col gap-2">
                                                    <div className="text-xs font-bold text-emerald-400 mb-1">Nuevo Aporte</div>
                                                    <div className="flex gap-2">
                                                        <input
                                                            type="text"
                                                            autoFocus
                                                            className="flex-1 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-white text-sm focus:border-emerald-500 outline-none"
                                                            placeholder="$ Monto"
                                                            value={contributionAmount}
                                                            onChange={(e) => setContributionAmount(formatMonto(e.target.value))}
                                                        />
                                                        <select
                                                            className="bg-slate-900 border border-slate-600 rounded px-2 py-1 text-white text-xs outline-none"
                                                            value={contributionBank}
                                                            onChange={(e) => setContributionBank(e.target.value)}
                                                        >
                                                            <option value="">Banco</option>
                                                            {banks.map(b => (
                                                                <option key={b.id} value={b.nombre}>{b.nombre}</option>
                                                            ))}
                                                        </select>
                                                        <button
                                                            onClick={() => handleContribute(goal.id)}
                                                            className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 rounded"
                                                        >
                                                            <Check size={14} />
                                                        </button>
                                                    </div>
                                                </div>
                                            )}

                                            {withdrawingGoal === goal.id && (
                                                <div className="flex flex-col gap-2">
                                                    <div className="text-xs font-bold text-amber-400 mb-1">Retirar Fondos</div>
                                                    <input
                                                        type="text"
                                                        autoFocus
                                                        className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-white text-sm focus:border-amber-500 outline-none mb-2"
                                                        placeholder="$ Monto"
                                                        value={withdrawalData.monto}
                                                        onChange={(e) => setWithdrawalData({ ...withdrawalData, monto: formatMonto(e.target.value) })}
                                                    />
                                                    <div className="flex gap-2 mb-2">
                                                        <input
                                                            type="text"
                                                            className="flex-1 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-white text-xs"
                                                            placeholder="Motivo"
                                                            value={withdrawalData.motivo}
                                                            onChange={(e) => setWithdrawalData({ ...withdrawalData, motivo: e.target.value })}
                                                        />
                                                        <select
                                                            className="bg-slate-900 border border-slate-600 rounded px-2 py-1 text-white text-xs outline-none"
                                                            value={withdrawalData.banco}
                                                            onChange={(e) => setWithdrawalData({ ...withdrawalData, banco: e.target.value })}
                                                        >
                                                            <option value="">Origen *</option>
                                                            {goalBanks.map(b => (
                                                                <option key={b.banco} value={b.banco}>{b.banco} ({fmt(b.total)})</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                    <div className="flex gap-2 items-center">
                                                        <span className="text-[10px] text-slate-400">Reponer:</span>
                                                        <input
                                                            type="date"
                                                            className="flex-1 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-white text-xs"
                                                            value={withdrawalData.fecha_limite_reponer}
                                                            onChange={(e) => setWithdrawalData({ ...withdrawalData, fecha_limite_reponer: e.target.value })}
                                                        />
                                                        <button
                                                            onClick={() => handleWithdraw(goal.id)}
                                                            className="bg-amber-600 hover:bg-amber-500 text-white px-3 rounded"
                                                        >
                                                            <Check size={14} />
                                                        </button>
                                                    </div>
                                                </div>
                                            )}

                                            {executingGoal?.id === goal.id && (
                                                <div className="flex flex-col gap-3">
                                                    <div className="text-xs font-bold text-blue-400 mb-1 flex items-center gap-2">
                                                        <TrendingDown size={14} /> Ejecutar Gasto de Meta
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-2">
                                                        <div>
                                                            <label className="text-[10px] text-slate-500 uppercase font-bold px-1">Monto</label>
                                                            <input
                                                                type="text"
                                                                className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-white text-sm focus:border-blue-500 outline-none"
                                                                value={executionData.monto}
                                                                onChange={(e) => setExecutionData({ ...executionData, monto: formatMonto(e.target.value) })}
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="text-[10px] text-slate-500 uppercase font-bold px-1">Banco Origen</label>
                                                            <select
                                                                className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-white text-sm outline-none"
                                                                value={executionData.banco}
                                                                onChange={(e) => setExecutionData({ ...executionData, banco: e.target.value })}
                                                            >
                                                                <option value="">Seleccionar...</option>
                                                                {banks.map(b => (
                                                                    <option key={b.id} value={b.nombre}>{b.nombre}</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-2">
                                                        <div>
                                                            <label className="text-[10px] text-slate-500 uppercase font-bold px-1">Categoría</label>
                                                            <select
                                                                className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-white text-sm outline-none"
                                                                value={executionData.categoria}
                                                                onChange={(e) => setExecutionData({ ...executionData, categoria: e.target.value })}
                                                            >
                                                                <option value="">Seleccionar...</option>
                                                                {categories.map(c => (
                                                                    <option key={c.id} value={c.nombre}>{c.nombre}</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                        <div>
                                                            <label className="text-[10px] text-slate-500 uppercase font-bold px-1">Fecha</label>
                                                            <input
                                                                type="date"
                                                                className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-white text-xs"
                                                                value={executionData.fecha}
                                                                onChange={(e) => setExecutionData({ ...executionData, fecha: e.target.value })}
                                                            />
                                                        </div>
                                                    </div>

                                                    <div>
                                                        <label className="text-[10px] text-slate-500 uppercase font-bold px-1">Detalle</label>
                                                        <input
                                                            type="text"
                                                            className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-white text-sm"
                                                            placeholder="Motivo del gasto"
                                                            value={executionData.detalle}
                                                            onChange={(e) => setExecutionData({ ...executionData, detalle: e.target.value })}
                                                        />
                                                    </div>

                                                    <button
                                                        onClick={() => handleExecuteGoal(goal.id)}
                                                        className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2 rounded-lg font-bold flex items-center justify-center gap-2 transition-shadow shadow-lg shadow-blue-500/20"
                                                    >
                                                        Confirmar Gasto y Finalizar Meta
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Pending Withdrawals Indicator */}
                                    {pendingWithdrawals[goal.id] && pendingWithdrawals[goal.id].length > 0 && (
                                        <div className="px-4 pb-2">
                                            <div className="text-[10px] text-amber-400 flex items-center gap-1 bg-amber-900/20 px-2 py-1 rounded border border-amber-900/50">
                                                <AlertTriangle size={10} />
                                                {pendingWithdrawals[goal.id].length} pendientes de reponer
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Sub-Modal: Detail View */}
                <GoalDetailsModal
                    isOpen={!!selectedGoal}
                    onClose={() => setSelectedGoal(null)}
                    goal={selectedGoal}
                    environment={environment}
                />
            </div>
        </div>
    );
}
