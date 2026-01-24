import { useState, useEffect } from 'react';
import { Save, Trash2, Plus, Target, X, ChevronLeft, ChevronRight, Edit2, AlertTriangle, Check, XCircle } from 'lucide-react';
import { API_URL } from "../config";

export default function BudgetManager({ isOpen, onClose, environment }) {
    const [categories, setCategories] = useState([]);
    const [budgets, setBudgets] = useState([]);
    const [formData, setFormData] = useState({ category: '', amount: '' });
    const [loading, setLoading] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [editAmount, setEditAmount] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    // Selected month state (default to current month)
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));

    useEffect(() => {
        if (isOpen) {
            fetchCategories();
            fetchBudgets();
        }
    }, [isOpen, environment, selectedMonth]);

    // Clear success message after 3 seconds
    useEffect(() => {
        if (successMessage) {
            const timer = setTimeout(() => setSuccessMessage(''), 3000);
            return () => clearTimeout(timer);
        }
    }, [successMessage]);

    const fetchCategories = async () => {
        try {
            const res = await fetch(`${API_URL}/categories?environment=${environment || 'PROD'}`);
            const data = await res.json();
            setCategories(data);
        } catch (e) {
            console.error("Failed to fetch categories", e);
        }
    };

    const fetchBudgets = async () => {
        setLoading(true);
        try {
            const query = new URLSearchParams({
                month: selectedMonth,
                environment: environment || 'PROD'
            });
            const res = await fetch(`${API_URL}/budgets?${query}`);
            const data = await res.json();
            setBudgets(data);
        } catch (e) {
            console.error("Failed to fetch budgets", e);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.category || !formData.amount) return;

        try {
            const res = await fetch(`${API_URL}/budgets`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    category: formData.category,
                    amount: parseFloat(formData.amount),
                    month: selectedMonth,
                    environment: environment || 'PROD'
                })
            });
            if (res.ok) {
                fetchBudgets();
                setFormData({ category: '', amount: '' });
                setSuccessMessage('Presupuesto creado correctamente');
            }
        } catch (e) {
            console.error("Error saving budget", e);
        }
    };

    const handleEdit = (budget) => {
        setEditingId(budget.id);
        setEditAmount(budget.amount.toString());
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        setEditAmount('');
    };

    const handleSaveEdit = async (budgetId) => {
        if (!editAmount || parseFloat(editAmount) <= 0) return;

        try {
            const res = await fetch(`${API_URL}/budgets/${budgetId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    amount: parseFloat(editAmount)
                })
            });
            if (res.ok) {
                fetchBudgets();
                setEditingId(null);
                setEditAmount('');
                setSuccessMessage('Presupuesto actualizado');
            }
        } catch (e) {
            console.error("Error updating budget", e);
        }
    };

    // Month navigation functions
    const goToPreviousMonth = () => {
        const [year, month] = selectedMonth.split('-').map(Number);
        const newDate = new Date(year, month - 2, 1);
        setSelectedMonth(newDate.toISOString().slice(0, 7));
    };

    const goToNextMonth = () => {
        const [year, month] = selectedMonth.split('-').map(Number);
        const newDate = new Date(year, month, 1);
        setSelectedMonth(newDate.toISOString().slice(0, 7));
    };

    const formatMonthDisplay = (monthStr) => {
        const [year, month] = monthStr.split('-');
        const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
            'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        return `${months[parseInt(month) - 1]} ${year}`;
    };

    const handleDelete = async (id) => {
        if (!confirm('¿Eliminar este presupuesto?')) return;
        try {
            await fetch(`${API_URL}/budgets/${id}`, { method: 'DELETE' });
            fetchBudgets();
            setSuccessMessage('Presupuesto eliminado');
        } catch (e) {
            console.error("Error deleting budget", e);
        }
    };

    const fmt = (num) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(num);

    // Calculate totals
    const totalBudgeted = budgets.reduce((sum, b) => sum + b.amount, 0);
    const totalSpent = budgets.reduce((sum, b) => sum + b.spent, 0);
    const exceededCount = budgets.filter(b => b.exceeded).length;

    // Get categories that don't have budgets yet
    const budgetedCategories = budgets.map(b => b.category);
    const availableCategories = categories.filter(c => c.tipo === 'Gasto' && !budgetedCategories.includes(c.nombre));

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">

                {/* Header */}
                <div className="p-4 bg-gradient-to-r from-indigo-600/20 to-purple-600/20 border-b border-slate-700">
                    <div className="flex justify-between items-center mb-3">
                        <h2 className="font-bold text-xl flex items-center gap-2 text-indigo-400">
                            <Target size={24} /> Presupuestos Mensuales
                        </h2>
                        <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                            <X size={24} />
                        </button>
                    </div>

                    {/* Month Selector */}
                    <div className="flex items-center justify-center gap-3">
                        <button
                            onClick={goToPreviousMonth}
                            className="p-2 bg-slate-700/50 hover:bg-slate-600 rounded-lg transition-colors text-slate-300"
                        >
                            <ChevronLeft size={20} />
                        </button>
                        <div className="flex items-center gap-2">
                            <input
                                type="month"
                                value={selectedMonth}
                                onChange={(e) => setSelectedMonth(e.target.value)}
                                className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500 text-center"
                            />
                        </div>
                        <button
                            onClick={goToNextMonth}
                            className="p-2 bg-slate-700/50 hover:bg-slate-600 rounded-lg transition-colors text-slate-300"
                        >
                            <ChevronRight size={20} />
                        </button>
                    </div>
                    <p className="text-center text-slate-400 text-sm mt-2">{formatMonthDisplay(selectedMonth)}</p>
                </div>

                {/* Success Message */}
                {successMessage && (
                    <div className="mx-4 mt-4 px-4 py-2 bg-emerald-500/20 border border-emerald-500/30 rounded-lg text-emerald-400 text-sm text-center animate-pulse">
                        ✓ {successMessage}
                    </div>
                )}

                {/* Summary Card */}
                {budgets.length > 0 && (
                    <div className="mx-4 mt-4 p-3 bg-slate-900/50 rounded-xl border border-slate-700 grid grid-cols-3 gap-2 text-center">
                        <div>
                            <p className="text-xs text-slate-500">Presupuestado</p>
                            <p className="text-sm font-bold text-slate-300">{fmt(totalBudgeted)}</p>
                        </div>
                        <div>
                            <p className="text-xs text-slate-500">Gastado</p>
                            <p className={`text-sm font-bold ${totalSpent > totalBudgeted ? 'text-red-400' : 'text-emerald-400'}`}>
                                {fmt(totalSpent)}
                            </p>
                        </div>
                        <div>
                            <p className="text-xs text-slate-500">Excedidos</p>
                            <p className={`text-sm font-bold ${exceededCount > 0 ? 'text-amber-400' : 'text-slate-300'}`}>
                                {exceededCount} / {budgets.length}
                            </p>
                        </div>
                    </div>
                )}

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {/* Form */}
                    <form onSubmit={handleSubmit} className="flex gap-3 items-end bg-slate-900/50 p-4 rounded-xl border border-slate-700">
                        <div className="flex-1 space-y-1">
                            <label className="text-xs text-slate-400 font-medium">Categoría</label>
                            <select
                                value={formData.category}
                                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                            >
                                <option value="">Seleccionar...</option>
                                {availableCategories.map(c => (
                                    <option key={c.id} value={c.nombre}>{c.nombre}</option>
                                ))}
                            </select>
                        </div>
                        <div className="w-28 space-y-1">
                            <label className="text-xs text-slate-400 font-medium">Límite $</label>
                            <input
                                type="number"
                                placeholder="0"
                                min="0"
                                value={formData.amount}
                                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={!formData.category || !formData.amount}
                            className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white p-2.5 rounded-lg transition-colors"
                        >
                            <Plus size={20} />
                        </button>
                    </form>

                    {/* List with Progress Bars */}
                    <div className="space-y-3">
                        {loading ? (
                            <p className="text-slate-500 text-center py-4">Cargando...</p>
                        ) : budgets.map((b) => (
                            <div
                                key={b.id}
                                className={`p-3 rounded-xl border transition-all ${b.exceeded
                                    ? 'bg-red-900/20 border-red-500/30'
                                    : 'bg-slate-900/30 border-slate-700/50'
                                    }`}
                            >
                                {/* Header Row */}
                                <div className="flex justify-between items-center mb-2">
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-slate-300">{b.category}</span>
                                        {b.exceeded && (
                                            <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full flex items-center gap-1">
                                                <AlertTriangle size={12} /> Excedido
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {editingId === b.id ? (
                                            <>
                                                <input
                                                    type="number"
                                                    value={editAmount}
                                                    onChange={(e) => setEditAmount(e.target.value)}
                                                    className="w-24 bg-slate-800 border border-indigo-500 rounded px-2 py-1 text-white text-sm focus:outline-none"
                                                    autoFocus
                                                />
                                                <button
                                                    onClick={() => handleSaveEdit(b.id)}
                                                    className="text-emerald-400 hover:text-emerald-300"
                                                >
                                                    <Check size={16} />
                                                </button>
                                                <button
                                                    onClick={handleCancelEdit}
                                                    className="text-slate-400 hover:text-slate-300"
                                                >
                                                    <XCircle size={16} />
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <button
                                                    onClick={() => handleEdit(b)}
                                                    className="text-slate-500 hover:text-indigo-400 transition-colors"
                                                >
                                                    <Edit2 size={14} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(b.id)}
                                                    className="text-slate-500 hover:text-red-400 transition-colors"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Amount Info */}
                                <div className="flex justify-between items-center text-xs text-slate-400 mb-2">
                                    <span>
                                        Gastado: <span className="text-slate-200">{fmt(b.spent)}</span>
                                    </span>
                                    <span>
                                        Límite: <span className="text-slate-200">{fmt(b.amount)}</span>
                                    </span>
                                </div>

                                {/* Progress Bar */}
                                <div className="h-3 w-full bg-slate-800 rounded-full overflow-hidden shadow-inner">
                                    <div
                                        className={`h-full rounded-full transition-all duration-700 ease-out shadow-lg ${b.percentage > 100
                                            ? 'bg-gradient-to-r from-red-600 to-red-500 shadow-red-500/50'
                                            : b.percentage > 80
                                                ? 'bg-gradient-to-r from-amber-500 to-yellow-400 shadow-yellow-500/50'
                                                : 'bg-gradient-to-r from-emerald-600 to-teal-400 shadow-emerald-500/50'
                                            }`}
                                        style={{ width: `${Math.min(b.percentage, 100)}%` }}
                                    ></div>
                                </div>

                                {/* Footer */}
                                <div className="flex justify-between mt-2 text-xs">
                                    <span className={`font-medium ${b.exceeded ? 'text-red-400' : 'text-emerald-400'}`}>
                                        {b.exceeded
                                            ? `Excedido por ${fmt(b.spent - b.amount)}`
                                            : `Disponible: ${fmt(b.remaining)}`
                                        }
                                    </span>
                                    <span className={`font-bold ${b.percentage > 100 ? 'text-red-400' :
                                        b.percentage > 80 ? 'text-amber-400' : 'text-slate-400'
                                        }`}>
                                        {b.percentage.toFixed(0)}%
                                    </span>
                                </div>
                            </div>
                        ))}

                        {budgets.length === 0 && !loading && (
                            <div className="text-center py-12">
                                <Target size={48} className="text-slate-600 mx-auto mb-3" />
                                <p className="text-slate-500 text-sm">
                                    No has definido presupuestos para {formatMonthDisplay(selectedMonth)}.
                                </p>
                                <p className="text-slate-600 text-xs mt-1">
                                    Agrega uno usando el formulario de arriba.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
