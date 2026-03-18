import { useState, useEffect } from 'react';
import { Save, Trash2, Plus, Target, X, ChevronLeft, ChevronRight, Edit2, AlertTriangle, Check, XCircle, CreditCard, Calendar, Repeat, ArrowRightCircle, BarChart3, List } from 'lucide-react';
import { API_URL } from "../config";

const FREQ_LABELS = {
    unavez: '⚡ Una vez',
    diario: '📆 Diario',
    mensual: '🔄 Mensual',
    anual: '📅 Anual'
};

const FREQ_COLORS = {
    unavez: 'bg-slate-500/20 text-slate-400',
    diario: 'bg-amber-500/20 text-amber-400',
    mensual: 'bg-indigo-500/20 text-indigo-400',
    anual: 'bg-purple-500/20 text-purple-400'
};

export default function BudgetManager({ isOpen, onClose, environment, onAddTransaction, savingsByBank = {}, banksData = [] }) {
    const [categories, setCategories] = useState([]);
    const [banks, setBanks] = useState([]);
    const [budgets, setBudgets] = useState([]);
    const [bankAccountsMap, setBankAccountsMap] = useState({}); // { "Santander": ["Cta Corriente", "Visa"], ... }
    const [formData, setFormData] = useState({
        category: '',
        items: [{ nombre: '', monto: '', fecha_pago: '', frecuencia: 'mensual', banco_designado: '', cuenta_designada: '' }]
    });
    const [loading, setLoading] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [editData, setEditData] = useState({ amount: '', banco_designado: '', cuenta_designada: '', fecha_pago: '', frecuencia: 'unavez', scope: 'global', original_month: '', is_recurrent: false, nombre: '' });
    const [deletingItem, setDeletingItem] = useState(null);
    const [successMessage, setSuccessMessage] = useState('');

    // View toggle: 'list' or 'matrix'
    const [viewMode, setViewMode] = useState('list');
    const [matrixData, setMatrixData] = useState(null);
    const [matrixLoading, setMatrixLoading] = useState(false);

    // Selected month state (default to current month)
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));

    const fmt = (num) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(num);

    useEffect(() => {
        if (isOpen) {
            fetchCategories();
            fetchBanks();
            fetchBudgets();
            fetchBankAccountsMap();
        }
    }, [isOpen, environment, selectedMonth]);

    // Fetch matrix when switching to matrix view
    useEffect(() => {
        if (isOpen && viewMode === 'matrix') {
            fetchAnnualProjection();
        }
    }, [isOpen, viewMode, selectedMonth]);

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

    const fetchBanks = async () => {
        try {
            const res = await fetch(`${API_URL}/summary/banks?environment=${environment || 'PROD'}`);
            const data = await res.json();
            setBanks(data.filter(b => b.saldo > 0));
        } catch (e) {
            console.error("Failed to fetch banks", e);
        }
    };

    const fetchBankAccountsMap = async () => {
        try {
            const res = await fetch(`${API_URL}/bank-accounts/all?environment=${environment || 'PROD'}`);
            if (res.ok) setBankAccountsMap(await res.json());
        } catch (e) {
            console.error("Failed to fetch bank-accounts map", e);
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

    const fetchAnnualProjection = async () => {
        setMatrixLoading(true);
        try {
            const year = selectedMonth.split('-')[0];
            const res = await fetch(`${API_URL}/budgets/annual-projection?year=${year}&environment=${environment || 'PROD'}`);
            const data = await res.json();
            setMatrixData(data);
        } catch (e) {
            console.error("Failed to fetch annual projection", e);
        } finally {
            setMatrixLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.category || formData.items.length === 0) return;

        try {
            const payload = {
                category: formData.category,
                month: selectedMonth,
                environment: environment || 'PROD',
                items: formData.items.map(item => ({
                    nombre: item.nombre,
                    monto: parseFloat(item.monto) || 0,
                    fecha_pago: item.fecha_pago === '' ? null : parseInt(item.fecha_pago),
                    frecuencia: item.frecuencia,
                    banco_designado: item.banco_designado === '' ? null : item.banco_designado,
                    cuenta_designada: item.cuenta_designada === '' ? null : item.cuenta_designada
                }))
            };

            const res = await fetch(`${API_URL}/budgets`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                fetchBudgets();
                setFormData({ category: '', items: [{ nombre: '', monto: '', fecha_pago: '', frecuencia: 'mensual', banco_designado: '', cuenta_designada: '' }] });
                setSuccessMessage('Ítems presupuestados creados');
                if (viewMode === 'matrix') fetchAnnualProjection();
            } else {
                const err = await res.json();
                setSuccessMessage(`⚠️ ${err.detail || 'Error al crear'}`);
            }
        } catch (e) {
            console.error("Error saving budget", e);
        }
    };

    const handleEdit = (item, budgetCatMonth) => {
        setEditingId(item.id);
        const isRecurrent = item.frecuencia && item.frecuencia !== 'unavez';
        setEditData({
            nombre: item.nombre || 'General',
            amount: (item.amount_original || item.amount).toString(),
            banco_designado: item.banco_designado || '',
            cuenta_designada: item.cuenta_designada || '',
            fecha_pago: item.fecha_pago || '',
            frecuencia: item.frecuencia || 'unavez',
            scope: 'global',
            original_month: budgetCatMonth,
            is_recurrent: isRecurrent,
            category: item.category || budgetCatMonth // Assuming we can pass category
        });
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        setEditData({ nombre: '', amount: '', banco_designado: '', cuenta_designada: '', fecha_pago: '', frecuencia: 'unavez', scope: 'global', original_month: '', is_recurrent: false });
    };

    const handleSaveEdit = async (budgetId) => {
        if (!editData.amount || parseFloat(editData.amount) < 0) return;

        try {
            let res;
            if (editData.scope === 'global' || !editData.is_recurrent) {
                // Update original globally
                res = await fetch(`${API_URL}/budgets/${budgetId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        nombre: editData.nombre,
                        amount: parseFloat(editData.amount),
                        banco_designado: editData.banco_designado || null,
                        cuenta_designada: editData.cuenta_designada || null,
                        fecha_pago: editData.fecha_pago || null,
                        frecuencia: editData.frecuencia
                    })
                });
            } else {
                // Create a new exception
                const payload = {
                    category: editData.category,
                    month: selectedMonth,
                    environment: environment || 'PROD',
                    items: [{
                        nombre: editData.nombre,
                        monto: parseFloat(editData.amount),
                        fecha_pago: editData.fecha_pago || null,
                        frecuencia: editData.scope === 'this_month' ? 'unavez' : editData.frecuencia,
                        banco_designado: editData.banco_designado || null,
                        cuenta_designada: editData.cuenta_designada || null
                    }]
                };
                res = await fetch(`${API_URL}/budgets`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
            }
            if (res.ok) {
                fetchBudgets();
                setEditingId(null);
                setEditData({ nombre: '', amount: '', banco_designado: '', cuenta_designada: '', fecha_pago: '', frecuencia: 'unavez', scope: 'global', original_month: '', is_recurrent: false });
                setSuccessMessage(editData.scope === 'global' ? 'Ítem actualizado' : 'Excepción guardada');
                if (viewMode === 'matrix') fetchAnnualProjection();
            } else {
                const err = await res.json();
                setSuccessMessage(`⚠️ ${err.detail || 'Error al actualizar'}`);
            }
        } catch (e) {
            console.error("Error updating budget item", e);
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

    const confirmDelete = async (item, scope) => {
        try {
            if (scope === 'global') {
                await fetch(`${API_URL}/budgets/${item.id}`, { method: 'DELETE' });
            } else if (scope === 'this_month' || scope === 'forward') {
                // To delete this month, we create an exception with amount=0
                // For forward, we create a recurring rule with amount=0 from this month onwards
                const payload = {
                    category: item.category || 'Varios',
                    month: selectedMonth,
                    environment: environment || 'PROD',
                    items: [{
                        nombre: item.nombre,
                        monto: 0,
                        frecuencia: scope === 'forward' ? item.frecuencia : 'unavez',
                        fecha_pago: null,
                        banco_designado: null,
                        cuenta_designada: null
                    }]
                };
                await fetch(`${API_URL}/budgets`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
            }
            fetchBudgets();
            setSuccessMessage('Ítem eliminado correctamente');
            if (viewMode === 'matrix') fetchAnnualProjection();
        } catch (e) {
            console.error("Error deleting budget item", e);
        } finally {
            setDeletingItem(null);
        }
    };

    // Calculate totals
    const totalBudgeted = budgets.reduce((sum, b) => sum + b.amount, 0);
    const totalSpent = budgets.reduce((sum, b) => sum + b.spent, 0);
    const exceededCount = budgets.filter(b => b.exceeded).length;

    // Get all 'Gasto' categories
    const availableCategories = categories.filter(c => c.tipo === 'Gasto');

    const MONTH_ABBR = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

    // Validation for enabling the Save button
    const isFormValid = formData.category && formData.items.length > 0 && formData.items.every(item =>
        item.nombre.trim() !== '' &&
        item.monto !== '' && parseFloat(item.monto) > 0 &&
        item.fecha_pago !== '' &&
        item.banco_designado !== '' &&
        item.cuenta_designada !== ''
    );

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
                style={viewMode === 'matrix' ? { maxWidth: '95vw', width: '1100px' } : {}}>

                {/* Header */}
                <div className="p-4 bg-gradient-to-r from-indigo-600/20 to-purple-600/20 border-b border-slate-700">
                    <div className="flex justify-between items-center mb-3">
                        <h2 className="font-bold text-xl flex items-center gap-2 text-indigo-400">
                            <Target size={24} /> Presupuestos
                        </h2>
                        <div className="flex items-center gap-2">
                            {/* View Toggle */}
                            <div className="flex bg-slate-900/60 rounded-lg p-0.5 border border-slate-700">
                                <button
                                    onClick={() => setViewMode('list')}
                                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${viewMode === 'list'
                                        ? 'bg-indigo-600 text-white shadow-lg'
                                        : 'text-slate-400 hover:text-white'
                                        }`}
                                >
                                    <List size={14} /> Lista
                                </button>
                                <button
                                    onClick={() => setViewMode('matrix')}
                                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${viewMode === 'matrix'
                                        ? 'bg-indigo-600 text-white shadow-lg'
                                        : 'text-slate-400 hover:text-white'
                                        }`}
                                >
                                    <BarChart3 size={14} /> Matriz Anual
                                </button>
                            </div>
                            <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                                <X size={24} />
                            </button>
                        </div>
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

                {/* =============== LIST VIEW =============== */}
                {viewMode === 'list' && (
                    <>
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
                            <form onSubmit={handleSubmit} className="flex flex-col gap-4 bg-slate-900/50 p-4 rounded-xl border border-slate-700">
                                {/* Category Selection */}
                                <div className="flex gap-3 items-end">
                                    <div className="flex-1 space-y-1">
                                        <label className="text-xs text-slate-400 font-medium">Categoría del Presupuesto</label>
                                        <div className="flex gap-2">
                                            <select
                                                value={formData.category}
                                                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                                            >
                                                <option value="">Seleccionar Categoría...</option>
                                                {availableCategories.map(c => (
                                                    <option key={c.id} value={c.nombre}>{c.nombre}</option>
                                                ))}
                                            </select>
                                            <button
                                                type="submit"
                                                disabled={!isFormValid}
                                                className={`px-6 rounded-lg transition-colors flex items-center justify-center font-medium shadow-lg
                                                    ${isFormValid
                                                        ? 'bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer'
                                                        : 'bg-slate-700 text-slate-400 cursor-not-allowed opacity-70'}`}
                                            >
                                                Guardar
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Dynamic Items List */}
                                <div className="space-y-3 mt-1 border-t border-slate-700/50 pt-3">
                                    <div className="flex justify-between items-center">
                                        <label className="text-sm text-indigo-300 font-semibold flex items-center gap-2">
                                            Ítems Presupuestados
                                        </label>
                                        <button
                                            type="button"
                                            onClick={() => setFormData({ ...formData, items: [...formData.items, { nombre: '', monto: '', fecha_pago: '', frecuencia: 'mensual', banco_designado: '', cuenta_designada: '' }] })}
                                            className="text-xs text-indigo-400 hover:text-white flex items-center gap-1 bg-indigo-500/20 hover:bg-indigo-500 transition-colors px-3 py-1.5 rounded-md font-medium"
                                        >
                                            <Plus size={14} /> Agregar Ítem
                                        </button>
                                    </div>
                                    <div className="space-y-2">
                                        {formData.items.map((item, idx) => (
                                            <div key={idx} className="flex flex-col gap-2 bg-slate-800/80 p-3 rounded-lg border border-slate-700 shadow-md relative group">
                                                <div className="flex gap-2 items-center w-full">
                                                    <input
                                                        type="text"
                                                        placeholder="Nombre del Ítem (Ej. Netflix)"
                                                        value={item.nombre}
                                                        onChange={(e) => {
                                                            const newItems = [...formData.items];
                                                            newItems[idx].nombre = e.target.value;
                                                            setFormData({ ...formData, items: newItems });
                                                        }}
                                                        className="flex-1 bg-slate-900 border border-slate-600 rounded px-3 py-1.5 text-white text-sm focus:outline-none focus:border-indigo-500"
                                                    />
                                                    <div className="relative">
                                                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                                                        <input
                                                            type="number"
                                                            placeholder="Monto"
                                                            value={item.monto}
                                                            onChange={(e) => {
                                                                const newItems = [...formData.items];
                                                                newItems[idx].monto = e.target.value;
                                                                setFormData({ ...formData, items: newItems });
                                                            }}
                                                            className="w-28 bg-slate-900 border border-slate-600 rounded px-2 py-1.5 pl-6 text-white text-sm focus:outline-none focus:border-indigo-500"
                                                        />
                                                    </div>
                                                </div>

                                                <div className="flex gap-2 items-center w-full">
                                                    <select
                                                        value={item.frecuencia}
                                                        onChange={(e) => {
                                                            const newItems = [...formData.items];
                                                            newItems[idx].frecuencia = e.target.value;
                                                            setFormData({ ...formData, items: newItems });
                                                        }}
                                                        className="w-32 bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-white text-xs focus:outline-none focus:border-indigo-500"
                                                    >
                                                        <option value="unavez">Una vez</option>
                                                        <option value="diario">Diario</option>
                                                        <option value="mensual">Mensual</option>
                                                        <option value="anual">Anual</option>
                                                    </select>
                                                    <select
                                                        value={item.banco_designado || ''}
                                                        onChange={(e) => {
                                                            const newItems = [...formData.items];
                                                            newItems[idx].banco_designado = e.target.value;
                                                            newItems[idx].cuenta_designada = '';
                                                            setFormData({ ...formData, items: newItems });
                                                        }}
                                                        className="flex-1 bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-white text-xs focus:outline-none focus:border-indigo-500"
                                                    >
                                                        <option value="">Banco...</option>
                                                        {banks.map(b => (
                                                            <option key={`${b.banco}-${b.cuenta}`} value={b.banco}>
                                                                {b.banco} ({fmt(b.saldo)})
                                                            </option>
                                                        ))}
                                                    </select>
                                                    {item.banco_designado && (bankAccountsMap[item.banco_designado] || []).length > 0 && (() => {
                                                        const bankInfo = banksData.find(b => b.banco === item.banco_designado);
                                                        let accountList = [];
                                                        if (bankInfo && bankInfo.accounts) {
                                                            accountList = bankInfo.accounts.map(a => ({ nombre: a.cuenta, saldoInfo: `(${fmt(a.saldo)})` }));
                                                        } else {
                                                            const assignedAccounts = bankAccountsMap[item.banco_designado] || [];
                                                            accountList = assignedAccounts.map(name => ({ nombre: name, saldoInfo: '' }));
                                                        }
                                                        return (
                                                            <select
                                                                value={item.cuenta_designada || ''}
                                                                onChange={(e) => {
                                                                    const newItems = [...formData.items];
                                                                    newItems[idx].cuenta_designada = e.target.value;
                                                                    setFormData({ ...formData, items: newItems });
                                                                }}
                                                                className="w-32 bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-white text-xs focus:outline-none focus:border-indigo-500"
                                                            >
                                                                <option value="">Cuenta...</option>
                                                                {accountList.map(acct => (
                                                                    <option key={acct.nombre} value={acct.nombre}>{acct.nombre} {acct.saldoInfo}</option>
                                                                ))}
                                                            </select>
                                                        );
                                                    })()}
                                                    <input
                                                        type="number"
                                                        placeholder="Día"
                                                        min="1" max="31"
                                                        value={item.fecha_pago}
                                                        onChange={(e) => {
                                                            const newItems = [...formData.items];
                                                            newItems[idx].fecha_pago = e.target.value;
                                                            setFormData({ ...formData, items: newItems });
                                                        }}
                                                        className="w-16 bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-white text-xs focus:outline-none focus:border-indigo-500"
                                                        title="Día de pago"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const newItems = formData.items.filter((_, i) => i !== idx);
                                                            setFormData({ ...formData, items: newItems });
                                                        }}
                                                        className="text-slate-500 hover:text-rose-400 p-1.5 ml-1 transition-colors"
                                                        title="Quitar ítem"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                        {formData.items.length === 0 && (
                                            <p className="text-center text-slate-500 text-sm py-4 italic">No has agregado ningún ítem. Presiona "Agregar Ítem".</p>
                                        )}
                                    </div>
                                </div>
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

                                        <div className="h-3 w-full bg-slate-800 rounded-full overflow-hidden shadow-inner mb-3">
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

                                        {/* Items List */}
                                        {b.items && b.items.length > 0 && (
                                            <div className="space-y-2 mt-3 pt-2 border-t border-slate-700/50">
                                                {b.items.map(item => {
                                                    const isEditing = editingId === item.id;
                                                    const isDeleting = deletingItem?.id === item.id;

                                                    return (
                                                        <div key={item.id} className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-700">

                                                            {/* EDIT MODE */}
                                                            {isEditing ? (
                                                                <div className="space-y-2">
                                                                    <div className="flex gap-2">
                                                                        <input
                                                                            type="text"
                                                                            value={editData.nombre}
                                                                            onChange={(e) => setEditData({ ...editData, nombre: e.target.value })}
                                                                            className="flex-1 bg-slate-800 border-none rounded px-2 py-1 text-white text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                                                            placeholder="Nombre"
                                                                            autoFocus
                                                                        />
                                                                        <input
                                                                            type="number"
                                                                            value={editData.amount}
                                                                            onChange={(e) => setEditData({ ...editData, amount: e.target.value })}
                                                                            className="w-20 bg-slate-800 border-none rounded px-2 py-1 text-white text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                                                            placeholder="Monto"
                                                                        />
                                                                    </div>
                                                                    <div className="flex gap-2">
                                                                        <select
                                                                            value={editData.frecuencia}
                                                                            onChange={(e) => setEditData({ ...editData, frecuencia: e.target.value })}
                                                                            className="w-24 bg-slate-800 border-none rounded px-1 py-1 text-white text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                                                        >
                                                                            <option value="unavez">Una vez</option>
                                                                            <option value="diario">Diario</option>
                                                                            <option value="mensual">Mensual</option>
                                                                            <option value="anual">Anual</option>
                                                                        </select>
                                                                        <select
                                                                            value={editData.banco_designado || ''}
                                                                            onChange={(e) => setEditData({ ...editData, banco_designado: e.target.value, cuenta_designada: '' })}
                                                                            className="flex-1 bg-slate-800 border-none rounded px-1 py-1 text-white text-[10px] focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                                                        >
                                                                            <option value="">Banco...</option>
                                                                            {banks.map(bk => (
                                                                                <option key={`${bk.banco}-${bk.cuenta}`} value={bk.banco}>
                                                                                    {bk.banco} ({fmt(bk.saldo)})
                                                                                </option>
                                                                            ))}
                                                                        </select>
                                                                        {editData.banco_designado && (bankAccountsMap[editData.banco_designado] || []).length > 0 && (
                                                                            <select
                                                                                value={editData.cuenta_designada || ''}
                                                                                onChange={(e) => setEditData({ ...editData, cuenta_designada: e.target.value })}
                                                                                className="w-24 bg-slate-800 border-none rounded px-1 py-1 text-white text-[10px] focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                                                            >
                                                                                <option value="">Cuenta...</option>
                                                                                {(bankAccountsMap[editData.banco_designado] || []).map(acct => (
                                                                                    <option key={acct} value={acct}>{acct}</option>
                                                                                ))}
                                                                            </select>
                                                                        )}
                                                                        <input
                                                                            type="number"
                                                                            placeholder="Día"
                                                                            min="1" max="31"
                                                                            value={editData.fecha_pago}
                                                                            onChange={(e) => setEditData({ ...editData, fecha_pago: e.target.value })}
                                                                            className="w-12 bg-slate-800 border-none rounded px-1 py-1 text-white text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                                                        />
                                                                    </div>
                                                                    <div className="flex justify-between items-center mt-2 border-t border-slate-700 pt-2">
                                                                        {editData.is_recurrent ? (
                                                                            <select
                                                                                value={editData.scope}
                                                                                onChange={(e) => setEditData({ ...editData, scope: e.target.value })}
                                                                                className="w-28 bg-indigo-500/20 text-indigo-300 border-none rounded px-2 py-1 text-[10px] focus:outline-none"
                                                                            >
                                                                                <option value="global">Modificar Global</option>
                                                                                <option value="this_month">Sólo este mes</option>
                                                                                <option value="forward">En adelante</option>
                                                                            </select>
                                                                        ) : <span />}
                                                                        <div className="flex items-center gap-2">
                                                                            <button onClick={() => handleSaveEdit(item.id)} className="bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded text-xs hover:bg-emerald-500 hover:text-white transition-colors">Guardar</button>
                                                                            <button onClick={handleCancelEdit} className="text-slate-400 hover:text-slate-300 px-2 text-xs">Cancelar</button>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            ) : isDeleting ? (

                                                                /* DELETE CONFIRM MODE */
                                                                <div className="flex flex-col gap-2">
                                                                    <p className="text-sm text-slate-300">¿Eliminar "{item.nombre}"?</p>
                                                                    <div className="flex gap-2 justify-end">
                                                                        {(item.frecuencia && item.frecuencia !== 'unavez') && (
                                                                            <>
                                                                                <button onClick={() => confirmDelete(item, 'this_month')} className="bg-amber-500/20 text-amber-400 px-2 py-1 rounded text-xs hover:bg-amber-500 hover:text-white transition-colors" title="Eliminar sólo para este mes">Sólo este mes</button>
                                                                                <button onClick={() => confirmDelete(item, 'forward')} className="bg-rose-500/20 text-rose-400 px-2 py-1 rounded text-xs hover:bg-rose-500 hover:text-white transition-colors" title="Eliminar de aquí en adelante">En adelante</button>
                                                                            </>
                                                                        )}
                                                                        <button onClick={() => confirmDelete(item, 'global')} className="bg-red-600/30 text-red-400 px-2 py-1 rounded text-xs hover:bg-red-600 hover:text-white transition-colors" title="Eliminar regla original completa">{(item.frecuencia && item.frecuencia !== 'unavez') ? "Global" : "Sí, Eliminar"}</button>
                                                                        <button onClick={() => setDeletingItem(null)} className="text-slate-400 hover:text-slate-300 px-2 text-xs">Cancelar</button>
                                                                    </div>
                                                                </div>

                                                            ) : (

                                                                /* VIEW MODE */
                                                                <div className="flex justify-between flex-wrap gap-2">
                                                                    <div className="flex flex-col justify-center">
                                                                        <div className="flex items-center gap-2">
                                                                            <div className={`w-2 h-2 rounded-full ${item.pagado ? 'bg-emerald-500' : 'bg-amber-500'}`}></div>
                                                                            <span className={`text-sm font-medium ${item.pagado ? 'text-slate-500 line-through' : 'text-slate-300'}`}>{item.nombre}</span>
                                                                            {item.frecuencia && item.frecuencia !== 'unavez' && (
                                                                                <span className={`text-[9px] px-1.5 py-[1px] rounded flex font-bold uppercase tracking-wider ${FREQ_COLORS[item.frecuencia] || ''}`}>
                                                                                    {item.frecuencia}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                        <div className="flex items-center gap-3 mt-1 pl-4">
                                                                            <span className={`text-[11px] font-bold ${item.pagado ? 'text-slate-500' : 'text-slate-300'}`}>{fmt(item.amount)}</span>
                                                                            {item.fecha_pago && (
                                                                                <span className="text-[10px] text-slate-400 flex items-center gap-0.5"><Calendar size={10} /> Día {item.fecha_pago}</span>
                                                                            )}
                                                                            {item.banco_designado && (
                                                                                <span className="text-[10px] text-slate-400 flex items-center gap-0.5" title="Cuenta designada">
                                                                                    <CreditCard size={10} /> {item.banco_designado} {item.cuenta_designada ? `- ${item.cuenta_designada}` : ''}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </div>

                                                                    {/* Actions */}
                                                                    <div className="flex items-center gap-2 ml-auto">
                                                                        {!item.pagado && (
                                                                            <button
                                                                                onClick={() => {
                                                                                    if (onAddTransaction) {
                                                                                        onAddTransaction({
                                                                                            tipo: 'Gasto',
                                                                                            categoria: b.category,
                                                                                            detalle: item.nombre,
                                                                                            banco: item.banco_designado || '',
                                                                                            cuenta: item.cuenta_designada || '',
                                                                                            monto: item.amount,
                                                                                            budget_item_id: item.id,
                                                                                            budget_month: selectedMonth
                                                                                        });
                                                                                        onClose();
                                                                                    }
                                                                                }}
                                                                                className="text-emerald-400 hover:bg-emerald-500/20 p-1.5 rounded transition-colors"
                                                                                title="Pagar ítem"
                                                                            >
                                                                                <ArrowRightCircle size={16} />
                                                                            </button>
                                                                        )}
                                                                        {item.pagado && (
                                                                            <span className="text-emerald-500 mr-1" title="Pagado"><Check size={16} /></span>
                                                                        )}
                                                                        <button onClick={() => handleEdit(item, selectedMonth)} className="text-slate-500 hover:text-indigo-400 p-1 transition-colors">
                                                                            <Edit2 size={14} />
                                                                        </button>
                                                                        <button onClick={() => setDeletingItem(item)} className="text-slate-500 hover:text-red-400 p-1 transition-colors">
                                                                            <Trash2 size={14} />
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            )}

                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                ))}

                                {budgets.length === 0 && !loading && (
                                    <div className="text-center py-12">
                                        <Target size={48} className="text-slate-600 mx-auto mb-3" />
                                        <p className="text-slate-500 text-sm">
                                            No hay presupuestos para {formatMonthDisplay(selectedMonth)}.
                                        </p>
                                        <p className="text-slate-600 text-xs mt-1">
                                            Agrega uno usando el formulario de arriba, o crea una regla recurrente (Mensual/Anual).
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                )}

                {/* =============== MATRIX VIEW =============== */}
                {viewMode === 'matrix' && (
                    <div className="flex-1 overflow-auto p-4">
                        {matrixLoading ? (
                            <p className="text-slate-500 text-center py-8">Cargando proyección anual...</p>
                        ) : matrixData && matrixData.categories.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs border-collapse">
                                    <thead>
                                        <tr className="border-b border-slate-600">
                                            <th className="text-left py-2 px-3 text-slate-400 font-semibold sticky left-0 bg-slate-800 z-10 min-w-[120px]">
                                                Categoría
                                            </th>
                                            {MONTH_ABBR.map((m, i) => {
                                                const monthKey = `${matrixData.year}-${String(i + 1).padStart(2, '0')}`;
                                                const isCurrent = monthKey === selectedMonth;
                                                return (
                                                    <th key={m} className={`text-center py-2 px-2 font-semibold min-w-[75px] ${isCurrent ? 'text-indigo-400 bg-indigo-500/10' : 'text-slate-400'
                                                        }`}>
                                                        {m}
                                                    </th>
                                                );
                                            })}
                                            <th className="text-center py-2 px-3 text-indigo-400 font-bold min-w-[90px]">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {matrixData.categories.map((cat) => (
                                            <tr key={cat} className="border-b border-slate-700/50 hover:bg-slate-700/20 transition-colors">
                                                <td className="py-2 px-3 text-slate-300 font-medium sticky left-0 bg-slate-800 z-10">{cat}</td>
                                                {MONTH_ABBR.map((_, i) => {
                                                    const monthKey = `${matrixData.year}-${String(i + 1).padStart(2, '0')}`;
                                                    const val = matrixData.months[monthKey]?.[cat] || 0;
                                                    const isCurrent = monthKey === selectedMonth;
                                                    return (
                                                        <td key={monthKey} className={`text-center py-2 px-2 ${val > 0 ? 'text-slate-200' : 'text-slate-600'
                                                            } ${isCurrent ? 'bg-indigo-500/10' : ''}`}>
                                                            {val > 0 ? fmt(val) : '—'}
                                                        </td>
                                                    );
                                                })}
                                                <td className="text-center py-2 px-3 text-indigo-300 font-bold">
                                                    {fmt(matrixData.totals_by_category[cat] || 0)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr className="border-t-2 border-slate-500">
                                            <td className="py-2 px-3 text-slate-300 font-bold sticky left-0 bg-slate-800 z-10">Total</td>
                                            {MONTH_ABBR.map((_, i) => {
                                                const monthKey = `${matrixData.year}-${String(i + 1).padStart(2, '0')}`;
                                                const total = matrixData.totals_by_month[monthKey] || 0;
                                                const isCurrent = monthKey === selectedMonth;
                                                return (
                                                    <td key={monthKey} className={`text-center py-2 px-2 font-bold ${isCurrent ? 'text-indigo-400 bg-indigo-500/10' : 'text-slate-300'
                                                        }`}>
                                                        {total > 0 ? fmt(total) : '—'}
                                                    </td>
                                                );
                                            })}
                                            <td className="text-center py-2 px-3 text-indigo-400 font-extrabold">
                                                {fmt(Object.values(matrixData.totals_by_month).reduce((a, b) => a + b, 0))}
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        ) : (
                            <div className="text-center py-12">
                                <BarChart3 size={48} className="text-slate-600 mx-auto mb-3" />
                                <p className="text-slate-500 text-sm">No hay presupuestos proyectados para {matrixData?.year || selectedMonth.split('-')[0]}.</p>
                                <p className="text-slate-600 text-xs mt-1">Crea presupuestos con frecuencia Mensual o Anual para ver la proyección.</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div >
    );
}
