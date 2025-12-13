import { useState, useEffect } from 'react';
import { Save, Trash2, Plus, Target } from 'lucide-react';
import { API_URL } from "../config";

export default function BudgetManager({ isOpen, onClose, environment }) {
    const [categories, setCategories] = useState([]);
    const [budgets, setBudgets] = useState([]);
    const [formData, setFormData] = useState({ category: '', amount: '' });
    const [loading, setLoading] = useState(false);

    // Default to current month YYYY-MM
    const currentMonth = new Date().toISOString().slice(0, 7);

    useEffect(() => {
        if (isOpen) {
            fetchCategories();
            fetchBudgets();
        }
    }, [isOpen, environment]);

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
                month: currentMonth,
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
                    month: currentMonth
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
        <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700 space-y-6">
            <h3 className="text-xl font-bold text-slate-200 flex items-center gap-2">
                <Target className="text-emerald-400" /> Presupuestos Mensuales ({currentMonth})
            </h3>

            {/* Form */}
            <form onSubmit={handleSubmit} className="flex gap-4 items-end bg-slate-900/50 p-4 rounded-xl border border-slate-800">
                <div className="flex-1 space-y-1">
                    <label className="text-xs text-slate-400 font-medium">Categoría</label>
                    <select
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
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
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                    />
                </div>
                <button type="submit" className="bg-emerald-500 hover:bg-emerald-600 text-white p-2 rounded-lg transition-colors">
                    <Plus size={20} />
                </button>
            </form>

            {/* List with Progress Bars */}
            <div className="space-y-4 max-h-60 overflow-y-auto pr-2">
                {loading ? <p className="text-slate-500 text-center">Cargando...</p> : budgets.map((b) => (
                    <div key={b.id} className="bg-slate-900/30 p-3 rounded-xl border border-slate-800/50">
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
                    <div className="text-center text-slate-500 py-4 italic text-sm">
                        No has definido presupuestos para este mes.
                    </div>
                )}
            </div>
        </div>
    );
}
