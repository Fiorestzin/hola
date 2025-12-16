import { useState, useEffect } from 'react';
import { Save, Trash2, Plus, Target, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { API_URL } from "../config";

export default function BudgetManager({ isOpen, onClose, environment }) {
    const [categories, setCategories] = useState([]);
    const [budgets, setBudgets] = useState([]);
    const [formData, setFormData] = useState({ category: '', amount: '' });
    const [loading, setLoading] = useState(false);

    // Selected month state (default to current month)
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));

    useEffect(() => {
        if (isOpen) {
            fetchCategories();
            fetchBudgets();
        }
    }, [isOpen, environment, selectedMonth]);

    const fetchCategories = async () => {
        try {
            const res = await fetch(`${API_URL}/categories`);
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
                environment: environment || 'TEST'
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
                    month: selectedMonth
                })
            });
            if (res.ok) {
                fetchBudgets();
                setFormData({ category: '', amount: '' });
            }
        } catch (e) {
            console.error("Error saving budget", e);
        }
    };

    // Month navigation functions
    const goToPreviousMonth = () => {
        const [year, month] = selectedMonth.split('-').map(Number);
        const newDate = new Date(year, month - 2, 1); // month-2 because month is 1-indexed and we want previous
        setSelectedMonth(newDate.toISOString().slice(0, 7));
    };

    const goToNextMonth = () => {
        const [year, month] = selectedMonth.split('-').map(Number);
        const newDate = new Date(year, month, 1); // month is already correct for next month
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
        } catch (e) {
            console.error("Error deleting budget", e);
        }
    };

    const fmt = (num) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(num);

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

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 space-y-6">
                    {/* Form */}
                    <form onSubmit={handleSubmit} className="flex gap-4 items-end bg-slate-900/50 p-4 rounded-xl border border-slate-700">
                        <div className="flex-1 space-y-1">
                            <label className="text-xs text-slate-400 font-medium">Categoría</label>
                            <select
                                value={formData.category}
                                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                            >
                                <option value="">Seleccionar...</option>
                                {categories.filter(c => c.tipo === 'Gasto').map(c => (
                                    <option key={c.id} value={c.nombre}>{c.nombre}</option>
                                ))}
                            </select>
                        </div>
                        <div className="w-32 space-y-1">
                            <label className="text-xs text-slate-400 font-medium">Límite</label>
                            <input
                                type="number"
                                placeholder="0"
                                value={formData.amount}
                                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                            />
                        </div>
                        <button type="submit" className="bg-indigo-600 hover:bg-indigo-500 text-white p-2 rounded-lg transition-colors">
                            <Plus size={20} />
                        </button>
                    </form>

                    {/* List with Progress Bars */}
                    <div className="space-y-4">
                        {loading ? <p className="text-slate-500 text-center">Cargando...</p> : budgets.map((b) => (
                            <div key={b.id} className="bg-slate-900/30 p-3 rounded-xl border border-slate-700/50">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="font-bold text-slate-300">{b.category}</span>
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs text-slate-400">
                                            {fmt(b.spent)} / <span className="text-slate-200">{fmt(b.amount)}</span>
                                        </span>
                                        <button onClick={() => handleDelete(b.id)} className="text-slate-600 hover:text-red-400">
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>

                                {/* Progress Bar */}
                                <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all duration-500 ${b.percentage > 100 ? 'bg-red-500' : b.percentage > 80 ? 'bg-yellow-500' : 'bg-emerald-500'}`}
                                        style={{ width: `${Math.min(b.percentage, 100)}%` }}
                                    ></div>
                                </div>
                                <div className="text-right mt-1">
                                    <span className={`text-[10px] font-bold ${b.percentage > 100 ? 'text-red-400' : 'text-slate-500'}`}>
                                        {b.percentage.toFixed(0)}%
                                    </span>
                                </div>
                            </div>
                        ))}

                        {budgets.length === 0 && !loading && (
                            <div className="text-center text-slate-500 py-8 italic text-sm">
                                No has definido presupuestos para este mes.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

