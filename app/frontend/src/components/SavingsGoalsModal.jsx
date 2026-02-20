import { useState, useEffect, useMemo, useRef } from 'react';
import { X, Plus, Target, Trash2, Pencil, PiggyBank, Calendar, TrendingUp, TrendingDown, Check, DollarSign, History, ArrowDown, ArrowUp, AlertTriangle, Clock, StickyNote } from 'lucide-react';
import { API_URL } from "../config";
import GoalDetailsModal from './GoalDetailsModal';
import { useSnackbar } from '../context/SnackbarContext';

// Preset icons for goals
const GOAL_ICONS = ['🎯', '✈️', '🏠', '🚗', '💻', '📚', '🎓', '💍', '🏖️', '💰', '🎸', '🏋️'];
const GOAL_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

export default function SavingsGoalsModal({ isOpen, onClose, environment = "TEST", onGoalChange }) {
    const { showSnackbar } = useSnackbar();
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

    // Notes state
    const [notesGoal, setNotesGoal] = useState(null);
    const [notesData, setNotesData] = useState('');

    // UI State
    const [goalBanks, setGoalBanks] = useState([]); // Banks with contributions to current goal
    const [positiveBanks, setPositiveBanks] = useState([]); // Banks with positive balance for new contributions
    const [selectedGoal, setSelectedGoal] = useState(null); // For Detail Modal

    // Form state
    const [formData, setFormData] = useState({
        nombre: '',
        monto_objetivo: '',
        fecha_limite: '',
        frecuencia_aporte: '',
        dia_aporte: '',
        icono: '🎯',
        color: '#3b82f6'
    });

    useEffect(() => {
        if (isOpen) {
            fetchGoals();
            fetchBanks();
            fetchPositiveBanks();
            fetchCategories();
            fetchPendingWithdrawals();
            resetForm();
        }
    }, [isOpen, environment]);

    // Calculate suggested installment based on form data
    const suggestedInstallment = useMemo(() => {
        if (!formData.monto_objetivo || !formData.fecha_limite || !formData.frecuencia_aporte) return null;

        const target = parseFloat(formData.monto_objetivo.toString().replace(/\D/g, ''));
        if (isNaN(target)) return null;

        const current = editingGoal ? editingGoal.monto_actual : 0;
        const remaining = Math.max(0, target - current);
        if (remaining === 0) return 0;

        const today = new Date();
        const deadline = new Date(formData.fecha_limite);
        const diffTime = Math.abs(deadline - today);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays <= 0) return null;

        let periods = 0;
        switch (formData.frecuencia_aporte) {
            case 'Diario':
                periods = diffDays;
                break;
            case 'Semanal':
                periods = diffDays / 7;
                break;
            case 'Mensual':
                periods = diffDays / 30.44; // Average days in month
                break;
            default:
                return null;
        }

        if (periods <= 0) return null;
        return Math.ceil(remaining / periods);
    }, [formData.monto_objetivo, formData.fecha_limite, formData.frecuencia_aporte, editingGoal]);

    const fetchGoals = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/savings-goals?environment=${environment}`);
            if (res.ok) {
                const data = await res.json();
                setGoals(data);

                // If a goal is currently selected, update it with fresh data
                if (selectedGoal) {
                    const updatedSelected = data.find(g => g.id === selectedGoal.id);
                    if (updatedSelected) {
                        setSelectedGoal(updatedSelected);
                    }
                }
            }
        } catch (error) {
            console.error("Error loading goals:", error);
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
            }
        } catch (error) {
            console.error("Error loading banks:", error);
        }
    };

    const fetchPositiveBanks = async () => {
        try {
            const res = await fetch(`${API_URL}/banks/with-balance?environment=${environment}`);
            if (res.ok) {
                const data = await res.json();
                setPositiveBanks(data);
            }
        } catch (error) {
            console.error("Error loading positive banks:", error);
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
            frecuencia_aporte: '',
            dia_aporte: '',
            icono: '🎯',
            color: '#3b82f6'
        });
        setShowCreateForm(false);
        setEditingGoal(null);
        setContributingGoal(null);
        setContributionAmount('');
        setContributionBank('');
        setExecutingGoal(null);
        setNotesGoal(null);
        setNotesData('');
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
                    frecuencia_aporte: formData.frecuencia_aporte || null,
                    dia_aporte: formData.dia_aporte ? parseInt(formData.dia_aporte) : null,
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
                    frecuencia_aporte: formData.frecuencia_aporte || null,
                    dia_aporte: formData.dia_aporte ? parseInt(formData.dia_aporte) : null,
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
        const goalToDelete = goals.find(g => g.id === goalId);
        if (!goalToDelete) return; // Should not happen

        // 1. Optimistic UI: Remove from list immediately
        setGoals(prev => prev.filter(g => g.id !== goalId));

        // 2. Set timer for actual deletion
        const timerId = setTimeout(async () => {
            try {
                const res = await fetch(`${API_URL}/savings-goals/${goalId}`, {
                    method: 'DELETE'
                });
                if (res.ok) {
                    if (onGoalChange) onGoalChange();
                } else {
                    // If failed, restore (could be handled better, but rare)
                    fetchGoals();
                }
            } catch (error) {
                console.error("Error deleting goal:", error);
                fetchGoals();
            }
        }, 4000); // 4 seconds delay

        // 3. Show Snackbar with Undo
        showSnackbar(
            `Meta "${goalToDelete.nombre}" eliminada`,
            'info',
            () => {
                // UNDO ACTION: Clear timeout and restore UI
                clearTimeout(timerId);
                setGoals(prev => {
                    const restored = [...prev, goalToDelete];
                    // Optional: sort by created_at if possible, or just accept it's at end until refresh
                    return restored;
                });
            },
            4000
        );
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
                // Success!
                setContributingGoal(null);
                setContributionAmount('');
                setContributionBank('');
                fetchGoals(); // Refresh UI with new balance
                if (onGoalChange) onGoalChange();

                // Show Undo Snackbar
                showSnackbar(
                    `Aporte de ${fmt(monto)} registrado`,
                    'success',
                    async () => {
                        // UNDO Logic: Fetch latest contribution and delete it
                        try {
                            // 1. Fetch contributions
                            const cRes = await fetch(`${API_URL}/savings-goals/${goalId}/contributions`);
                            if (cRes.ok) {
                                const cData = await cRes.json();
                                if (cData.length > 0) {
                                    // Assuming index 0 is latest (server sorts DESC)
                                    const latest = cData[0];

                                    // Safety check on amount
                                    if (latest.monto === monto) {
                                        await fetch(`${API_URL}/savings-contributions/${latest.id}`, { method: 'DELETE' });
                                        fetchGoals(); // Revert UI
                                        if (onGoalChange) onGoalChange();
                                        showSnackbar("Aporte deshecho", "info");
                                    }
                                }
                            }
                        } catch (e) {
                            console.error("Error undoing contribution:", e);
                        }
                    }
                );
            }
        } catch (error) {
            console.error("Error contributing:", error);
        }
    };

    const handleSaveNotes = async (goalId) => {
        try {
            const res = await fetch(`${API_URL}/savings-goals/${goalId}/notas`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ notas: notesData })
            });

            if (res.ok) {
                setNotesGoal(null);
                fetchGoals();
                showSnackbar('Notas actualizadas', 'success');
            } else {
                showSnackbar('Error al guardar notas', 'error');
            }
        } catch (error) {
            console.error("Error saving notes:", error);
        }
    };

    const startEdit = (goal) => {
        setEditingGoal(goal);
        setFormData({
            nombre: goal.nombre,
            monto_objetivo: goal.monto_objetivo.toLocaleString('es-CL'),
            fecha_limite: goal.fecha_limite || '',
            frecuencia_aporte: goal.frecuencia_aporte || '',
            dia_aporte: goal.dia_aporte || '',
            icono: goal.icono,
            color: goal.color
        });
        setShowCreateForm(true);
    };

    // --- LOGIC: Calculate Smart Status & Next Quota ---
    const calculateGoalStatus = (goal) => {
        if (!goal.frecuencia_aporte || !goal.monto_objetivo || !goal.fecha_limite) {
            return { status: 'none', nextQuota: null, nextDate: null };
        }

        // Logic copied/adapted from GoalDetailsModal to ensure consistency
        const startDate = goal.created_at ? new Date(goal.created_at) : new Date();
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(goal.fecha_limite + 'T00:00:00');

        if (endDate <= startDate) return { status: 'none' }; // Invalid range or expired

        // Generate ideal slots
        const idealSlots = [];
        let currentDate = new Date(startDate);

        // Initial Advance
        if (goal.frecuencia_aporte === 'Diario') currentDate.setDate(currentDate.getDate() + 1);
        else if (goal.frecuencia_aporte === 'Semanal') {
            const targetDay = parseInt(goal.dia_aporte) || currentDate.getDay() || 7;
            let diff = targetDay - (currentDate.getDay() || 7);
            if (diff <= 0) diff += 7;
            currentDate.setDate(currentDate.getDate() + diff);
        } else if (goal.frecuencia_aporte === 'Mensual') {
            const targetDay = parseInt(goal.dia_aporte);
            if (targetDay) {
                if (currentDate.getDate() >= targetDay) currentDate.setMonth(currentDate.getMonth() + 1);
                currentDate.setDate(targetDay);
            } else {
                currentDate.setMonth(currentDate.getMonth() + 1);
            }
        }

        while (currentDate <= endDate) {
            idealSlots.push(new Date(currentDate));
            // Advance loop
            if (goal.frecuencia_aporte === 'Diario') currentDate.setDate(currentDate.getDate() + 1);
            else if (goal.frecuencia_aporte === 'Semanal') currentDate.setDate(currentDate.getDate() + 7);
            else if (goal.frecuencia_aporte === 'Mensual') currentDate.setMonth(currentDate.getMonth() + 1);
            else break;
        }

        if (idealSlots.length === 0) return { status: 'none' };

        const quotaAmount = Math.ceil(goal.monto_objetivo / idealSlots.length);
        let remainingSavings = goal.monto_actual;

        // Find the first UNPAID or PARTIALLY PAID slot
        for (let i = 0; i < idealSlots.length; i++) {
            const slotDate = idealSlots[i];

            if (remainingSavings >= quotaAmount) {
                remainingSavings -= quotaAmount; // Fully paid, check next
                continue;
            }

            // Found pending slot!
            const remainingToPay = quotaAmount - remainingSavings;
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            let status = 'pending'; // Default: It's coming up
            if (slotDate < today) status = 'late'; // It's in the past!
            else status = 'ontrack'; // It's in the future

            return {
                status,
                nextQuota: remainingToPay,
                nextDate: slotDate.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' }),
                fullDate: slotDate
            };
        }

        // If loop finishes, all slots are covered!
        return { status: 'completed', nextQuota: 0, nextDate: null };
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

                            {/* Frequency & Contribution Day */}
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">Frecuencia de Aporte</label>
                                <select
                                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500 text-sm"
                                    value={formData.frecuencia_aporte}
                                    onChange={(e) => setFormData({ ...formData, frecuencia_aporte: e.target.value })}
                                >
                                    <option value="">Sin frecuencia definida</option>
                                    <option value="Diario">Diario</option>
                                    <option value="Semanal">Semanal</option>
                                    <option value="Mensual">Mensual</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs text-slate-400 mb-1">
                                    {formData.frecuencia_aporte === 'Semanal' ? 'Día de la semana' : 'Día del mes'}
                                </label>
                                {formData.frecuencia_aporte === 'Semanal' ? (
                                    <select
                                        className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500 text-sm"
                                        value={formData.dia_aporte}
                                        onChange={(e) => setFormData({ ...formData, dia_aporte: e.target.value })}
                                        disabled={!formData.frecuencia_aporte}
                                    >
                                        <option value="">Selecciona día</option>
                                        <option value="1">Lunes</option>
                                        <option value="2">Martes</option>
                                        <option value="3">Miércoles</option>
                                        <option value="4">Jueves</option>
                                        <option value="5">Viernes</option>
                                        <option value="6">Sábado</option>
                                        <option value="7">Domingo</option>
                                    </select>
                                ) : (
                                    <input
                                        type="number"
                                        className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                                        placeholder={formData.frecuencia_aporte === 'Mensual' ? "Ej: 5 (día 5 de cada mes)" : "Opcional"}
                                        value={formData.dia_aporte}
                                        onChange={(e) => setFormData({ ...formData, dia_aporte: e.target.value })}
                                        min="1"
                                        max="31"
                                        disabled={!formData.frecuencia_aporte || formData.frecuencia_aporte === 'Diario'}
                                    />
                                )}
                            </div>

                            {/* Suggested Installment Display */}
                            {suggestedInstallment !== null && suggestedInstallment > 0 && (
                                <div className="col-span-1 md:col-span-2 bg-emerald-900/20 border border-emerald-500/30 rounded-lg p-3 flex items-center gap-3 animate-in fade-in">
                                    <div className="bg-emerald-500/20 p-2 rounded-full text-emerald-400">
                                        <DollarSign size={20} />
                                    </div>
                                    <div>
                                        <p className="text-xs text-emerald-400/80 uppercase font-bold">Cuota Sugerida ({formData.frecuencia_aporte})</p>
                                        <p className="text-lg font-bold text-white shadow-emerald-500/50 drop-shadow-sm">
                                            {fmt(suggestedInstallment)}
                                        </p>
                                        <p className="text-[10px] text-slate-400">
                                            Para lograr la meta el {formData.fecha_limite}
                                        </p>
                                    </div>
                                </div>
                            )}


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
                                        <div className="relative group">
                                            <input
                                                type="text"
                                                maxLength="2"
                                                className="w-8 h-8 rounded bg-slate-800 border border-slate-600 text-center text-lg focus:border-emerald-500 focus:outline-none transition-all placeholder-slate-600"
                                                placeholder="+"
                                                onChange={(e) => e.target.value && setFormData({ ...formData, icono: e.target.value })}
                                                value={GOAL_ICONS.includes(formData.icono) ? '' : formData.icono}
                                            />
                                        </div>
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
                            {goals.map(goal => {
                                // Calculate Status on the fly
                                const { status, nextQuota, nextDate } = calculateGoalStatus(goal);

                                return (
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
                                                        <div className='flex items-center gap-2'>
                                                            <h3 className="font-bold text-white group-hover:text-emerald-400 transition-colors">{goal.nombre}</h3>
                                                            {status === 'late' && (
                                                                <span className='text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded border border-red-500/30 flex items-center gap-1 font-bold animate-pulse'>
                                                                    <Clock size={10} /> Atrasado
                                                                </span>
                                                            )}
                                                            {status === 'ontrack' && (
                                                                <span className='text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/30 flex items-center gap-1 font-bold'>
                                                                    <Check size={10} /> Al día
                                                                </span>
                                                            )}
                                                            {status === 'completed' && (
                                                                <span className='text-[10px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded border border-blue-500/30 flex items-center gap-1 font-bold'>
                                                                    <Check size={10} /> Completado
                                                                </span>
                                                            )}
                                                        </div>

                                                        <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                                                            {goal.fecha_limite ? (
                                                                <>
                                                                    <Calendar size={12} /> {goal.fecha_limite}
                                                                </>
                                                            ) : 'Sin fecha límite'}
                                                            {goal.frecuencia_aporte && (
                                                                <span className="ml-2 px-1.5 py-0.5 rounded-full bg-slate-800 text-[10px] border border-slate-700 text-slate-300">
                                                                    {goal.frecuencia_aporte}
                                                                </span>
                                                            )}
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
                                                {/* SMART ACTION BUTTON */}
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setContributingGoal(contributingGoal === goal.id ? null : goal.id);
                                                        setWithdrawingGoal(null);
                                                        setExecutingGoal(null);
                                                        setNotesGoal(null);
                                                        if (nextQuota) {
                                                            setContributionAmount(nextQuota.toLocaleString('es-CL'));
                                                        }
                                                    }}
                                                    className={`p-1.5 rounded-lg transition-colors flex items-center gap-1 text-xs font-medium ${contributingGoal === goal.id
                                                        ? 'bg-emerald-600 text-white'
                                                        : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                                                        }`}
                                                    title="Aporte Rápido"
                                                >
                                                    <Plus size={14} />
                                                    {/* Smart Label Logic */}
                                                    {(status === 'late') ? (
                                                        <span className='font-bold underlinedecoration-wavy'>Pagar {fmt(nextQuota)}</span>
                                                    ) : (status === 'ontrack' && nextDate) ? (
                                                        <span>Aportar {fmt(nextQuota)}</span>
                                                    ) : (
                                                        <span>Aportar</span>
                                                    )}
                                                </button>

                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (withdrawingGoal !== goal.id) fetchGoalBanks(goal.id);
                                                        setWithdrawingGoal(withdrawingGoal === goal.id ? null : goal.id);
                                                        setContributingGoal(null);
                                                        setExecutingGoal(null);
                                                        setNotesGoal(null);
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
                                                            setNotesGoal(null);
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
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setNotesGoal(notesGoal === goal.id ? null : goal.id);
                                                        setNotesData(goal.notas || '');
                                                        setContributingGoal(null);
                                                        setWithdrawingGoal(null);
                                                        setExecutingGoal(null);
                                                    }}
                                                    className={`p-1.5 transition-colors ${notesGoal === goal.id || goal.notas
                                                        ? 'text-yellow-400 hover:text-yellow-300'
                                                        : 'text-slate-500 hover:text-yellow-400'
                                                        }`}
                                                    title={goal.notas ? "Ver Notas" : "Añadir Nota"}
                                                >
                                                    <StickyNote size={14} />
                                                </button>
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
                                        {(contributingGoal === goal.id || withdrawingGoal === goal.id || executingGoal?.id === goal.id || notesGoal === goal.id) && (
                                            <div className="p-3 bg-slate-800 border-t border-slate-700 animate-in slide-in-from-top-2">
                                                {notesGoal === goal.id && (
                                                    <div className="flex flex-col gap-2">
                                                        <div className="text-xs font-bold text-yellow-400 mb-1 flex items-center gap-1">
                                                            <StickyNote size={12} /> Notas de la Meta
                                                        </div>
                                                        <textarea
                                                            autoFocus
                                                            className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-2 text-sm text-white focus:border-yellow-500 outline-none resize-none"
                                                            placeholder="Ej: Para el dentista de los sábados..."
                                                            rows={2}
                                                            value={notesData}
                                                            onChange={(e) => setNotesData(e.target.value)}
                                                        />
                                                        <div className="flex justify-end mt-1">
                                                            <button
                                                                onClick={() => handleSaveNotes(goal.id)}
                                                                className="bg-yellow-600 hover:bg-yellow-500 text-white px-3 py-1 rounded text-xs font-bold transition-colors shadow-sm"
                                                            >
                                                                Guardar Nota
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}

                                                {contributingGoal === goal.id && (
                                                    <div className="flex flex-col gap-2">
                                                        <div className="text-xs font-bold text-emerald-400 mb-1 flex justify-between">
                                                            <span>Nuevo Aporte</span>
                                                            {status === 'late' && <span className='text-red-400 animate-pulse'>¡Cuota Atrasada!</span>}
                                                        </div>
                                                        <div className="flex gap-2">
                                                            <input
                                                                type="text"
                                                                className="flex-1 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-sm text-white focus:border-emerald-500 outline-none"
                                                                placeholder="Monto"
                                                                value={contributionAmount}
                                                                onChange={(e) => setContributionAmount(formatMonto(e.target.value))}
                                                                autoFocus
                                                            />
                                                            <select
                                                                className="flex-1 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-sm text-white focus:border-emerald-500 outline-none"
                                                                value={contributionBank}
                                                                onChange={(e) => setContributionBank(e.target.value)}
                                                            >
                                                                <option value="">Selecciona Banco</option>
                                                                {positiveBanks.map(b => (
                                                                    <option key={b.id} value={b.nombre}>{b.nombre} ({fmt(b.saldo)})</option>
                                                                ))}
                                                            </select>
                                                            <button
                                                                onClick={() => handleContribute(goal.id)}
                                                                className="bg-emerald-600 hover:bg-emerald-500 text-white p-1.5 rounded transition-colors"
                                                            >
                                                                <Check size={16} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}

                                                {withdrawingGoal === goal.id && (
                                                    <div className="flex flex-col gap-2">
                                                        <div className="text-xs font-bold text-amber-400 mb-1">Retirar Fondos de Meta (Préstamo)</div>

                                                        {/* Step 1: Banco y Monto */}
                                                        <div className="grid grid-cols-2 gap-2">
                                                            <select
                                                                className="bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-white outline-none"
                                                                value={withdrawalData.banco}
                                                                onChange={(e) => setWithdrawalData({ ...withdrawalData, banco: e.target.value })}
                                                            >
                                                                <option value="">Origen...</option>
                                                                {goalBanks.map(b => (
                                                                    <option key={b.banco} value={b.banco}>{b.banco} ({fmt(b.total || 0)})</option>
                                                                ))}
                                                            </select>
                                                            <input
                                                                type="text"
                                                                className="bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-white outline-none"
                                                                placeholder="Monto"
                                                                value={withdrawalData.monto}
                                                                onChange={(e) => setWithdrawalData({ ...withdrawalData, monto: formatMonto(e.target.value) })}
                                                            />
                                                        </div>

                                                        {/* Step 2: Motivo y Fecha */}
                                                        <div className="grid grid-cols-2 gap-2">
                                                            <input
                                                                type="text"
                                                                className="bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-white outline-none"
                                                                placeholder="Motivo (ej: Emergencia)"
                                                                value={withdrawalData.motivo}
                                                                onChange={(e) => setWithdrawalData({ ...withdrawalData, motivo: e.target.value })}
                                                            />
                                                            <input
                                                                type="date"
                                                                className="bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-white outline-none"
                                                                title="Fecha límite para reponer"
                                                                value={withdrawalData.fecha_limite_reponer}
                                                                onChange={(e) => setWithdrawalData({ ...withdrawalData, fecha_limite_reponer: e.target.value })}
                                                            />
                                                        </div>

                                                        <button
                                                            onClick={() => handleWithdraw(goal.id)}
                                                            className="w-full bg-amber-600 hover:bg-amber-500 text-white py-1 rounded text-xs font-bold mt-1"
                                                        >
                                                            Confirmar Retiro
                                                        </button>
                                                    </div>
                                                )}

                                                {executingGoal?.id === goal.id && (
                                                    <div className="flex flex-col gap-2">
                                                        <div className="text-xs font-bold text-blue-400 mb-1">Finalizar Meta (Registrar Gasto)</div>

                                                        <div className="grid grid-cols-2 gap-2">
                                                            <input
                                                                type="text"
                                                                className="bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-white outline-none"
                                                                placeholder="Monto Final"
                                                                value={executionData.monto}
                                                                onChange={(e) => setExecutionData({ ...executionData, monto: formatMonto(e.target.value) })}
                                                            />
                                                            <input
                                                                type="date"
                                                                className="bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-white outline-none"
                                                                value={executionData.fecha}
                                                                onChange={(e) => setExecutionData({ ...executionData, fecha: e.target.value })}
                                                            />
                                                        </div>

                                                        <div className="grid grid-cols-2 gap-2">
                                                            <select
                                                                className="bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-white outline-none"
                                                                value={executionData.banco}
                                                                onChange={(e) => setExecutionData({ ...executionData, banco: e.target.value })}
                                                            >
                                                                <option value="">Banco Pago...</option>
                                                                {positiveBanks.map(b => (
                                                                    <option key={b.id} value={b.nombre}>{b.nombre}</option>
                                                                ))}
                                                            </select>
                                                            <select
                                                                className="bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-white outline-none"
                                                                value={executionData.categoria}
                                                                onChange={(e) => setExecutionData({ ...executionData, categoria: e.target.value })}
                                                            >
                                                                <option value="">Categoría...</option>
                                                                {categories.map(c => (
                                                                    <option key={c.id} value={c.nombre}>{c.nombre}</option>
                                                                ))}
                                                            </select>
                                                        </div>

                                                        <input
                                                            type="text"
                                                            className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-white outline-none"
                                                            placeholder="Detalle (Opcional)"
                                                            value={executionData.detalle}
                                                            onChange={(e) => setExecutionData({ ...executionData, detalle: e.target.value })}
                                                        />

                                                        <button
                                                            onClick={() => handleExecuteGoal(goal.id)}
                                                            className="w-full bg-blue-600 hover:bg-blue-500 text-white py-1 rounded text-xs font-bold mt-1"
                                                        >
                                                            Confirmar Gasto y Finalizar
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    )}

                    {/* Pending Withdrawals (Debts) Section */}
                    {Object.keys(pendingWithdrawals).length > 0 && (
                        <div className="mt-6 border-t border-slate-700 pt-4">
                            <h3 className="text-amber-400 font-bold mb-3 flex items-center gap-2">
                                <AlertTriangle size={20} /> Retiros Pendientes de Reponer
                            </h3>
                            <div className="space-y-2">
                                {Object.entries(pendingWithdrawals).map(([goalId, withdraws]) => {
                                    const relatedGoal = goals.find(g => g.id === parseInt(goalId));
                                    return withdraws.map(w => (
                                        <div key={w.id} className="bg-slate-900/50 border border-amber-500/20 rounded-lg p-3 flex justify-between items-center">
                                            <div>
                                                <p className="text-white text-sm font-bold flex items-center gap-2">
                                                    {relatedGoal?.icono} {relatedGoal?.nombre || 'Meta eliminada'}
                                                    <span className="text-slate-500 font-normal text-xs">• {w.motivo}</span>
                                                </p>
                                                <p className="text-xs text-slate-400">
                                                    Fecha límite: <span className="text-amber-400">{w.fecha_limite_reponer}</span>
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className="text-amber-400 font-bold">{fmt(w.monto)}</span>
                                                <button
                                                    onClick={() => handleRepayWithdrawal(w.id)}
                                                    className="bg-emerald-900/40 hover:bg-emerald-900/60 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded text-xs transition-colors"
                                                >
                                                    Reponer
                                                </button>
                                            </div>
                                        </div>
                                    ));
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Goal Details Modal (Nested) */}
            <GoalDetailsModal
                isOpen={!!selectedGoal}
                onClose={() => setSelectedGoal(null)}
                goal={selectedGoal}
                environment={environment}
                onGoalUpdate={() => {
                    fetchGoals();
                    if (onGoalChange) onGoalChange();
                }}
            />
        </div>
    );
}
