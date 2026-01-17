import { useState, useEffect } from 'react';
import { X, Save, Trash2, AlertTriangle, TrendingUp, TrendingDown, Calendar, DollarSign, Tag, Building2, FileText } from 'lucide-react';
import { API_URL } from "../config";

export default function EditTransactionModal({
    isOpen,
    onClose,
    transaction,
    environment = 'TEST',
    onUpdate,
    onDelete,
    token
}) {
    const [formData, setFormData] = useState({
        fecha: '',
        monto: '',
        categoria: '',
        detalle: '',
        banco: '',
        tipo: 'Gasto'
    });

    const [categories, setCategories] = useState([]);
    const [banks, setBanks] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deletePhrase, setDeletePhrase] = useState('');

    // Load transaction data when modal opens
    useEffect(() => {
        if (isOpen && transaction) {
            setFormData({
                fecha: transaction.fecha || '',
                monto: transaction.ingreso > 0 ? transaction.ingreso : transaction.gasto,
                categoria: transaction.categoria || '',
                detalle: transaction.detalle || '',
                banco: transaction.banco || '',
                tipo: transaction.ingreso > 0 ? 'Ingreso' : 'Gasto'
            });
            setError('');
            setShowDeleteConfirm(false);
            setDeletePhrase('');

            // Fetch categories and banks
            fetchCategories();
            fetchBanks();
        }
    }, [isOpen, transaction, environment]);

    const fetchCategories = async () => {
        try {
            const res = await fetch(`${API_URL}/categories?environment=${environment}`);
            if (res.ok) {
                const data = await res.json();
                setCategories(data);
            }
        } catch (err) {
            console.error('Error fetching categories:', err);
        }
    };

    const fetchBanks = async () => {
        try {
            const res = await fetch(`${API_URL}/banks?environment=${environment}`);
            if (res.ok) {
                const data = await res.json();
                setBanks(data);
            }
        } catch (err) {
            console.error('Error fetching banks:', err);
        }
    };

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const res = await fetch(`${API_URL}/transaction/${transaction.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fecha: formData.fecha,
                    tipo: formData.tipo,
                    categoria: formData.categoria,
                    detalle: formData.detalle,
                    banco: formData.banco,
                    monto: parseFloat(formData.monto)
                })
            });

            if (res.ok) {
                if (onUpdate) onUpdate();
                onClose();
            } else {
                const data = await res.json();
                setError(data.detail || 'Error al actualizar');
            }
        } catch (err) {
            console.error('Error updating transaction:', err);
            setError('Error de conexión');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!showDeleteConfirm) {
            setShowDeleteConfirm(true);
            return;
        }

        // Verify delete phrase
        try {
            const phraseRes = await fetch(`${API_URL}/settings/delete-phrase`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (phraseRes.ok) {
                const data = await phraseRes.json();
                if (deletePhrase !== data.phrase) {
                    setError('Frase de confirmación incorrecta');
                    return;
                }
            } else {
                setError('Error al verificar frase');
                return;
            }
        } catch (err) {
            setError('Error de conexión');
            return;
        }

        // Proceed with delete
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/transaction/${transaction.id}`, {
                method: 'DELETE'
            });

            if (res.ok) {
                if (onDelete) onDelete();
                onClose();
            } else {
                setError('Error al eliminar');
            }
        } catch (err) {
            setError('Error de conexión');
        } finally {
            setLoading(false);
        }
    };

    const formatMonto = (value) => {
        const num = String(value).replace(/\D/g, '');
        return num ? parseInt(num).toLocaleString('es-CL') : '';
    };

    const handleMontoChange = (e) => {
        const raw = e.target.value.replace(/\D/g, '');
        setFormData({ ...formData, monto: raw });
    };

    if (!isOpen || !transaction) return null;

    const isIngreso = formData.tipo === 'Ingreso';
    const typeCats = categories.filter(c => c.tipo === formData.tipo);

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">

                {/* Header */}
                <div className={`p-4 flex justify-between items-center ${isIngreso ? 'bg-emerald-500/10' : 'bg-rose-500/10'} border-b border-slate-700`}>
                    <h2 className={`font-bold text-xl flex items-center gap-2 ${isIngreso ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {isIngreso ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
                        Editar Movimiento
                    </h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                        <X />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-5 space-y-4">

                    {/* Type Toggle */}
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => setFormData({ ...formData, tipo: 'Ingreso', categoria: '' })}
                            className={`flex-1 py-2 rounded-lg font-bold transition-all ${isIngreso
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                                }`}
                        >
                            <TrendingUp size={16} className="inline mr-1" /> Ingreso
                        </button>
                        <button
                            type="button"
                            onClick={() => setFormData({ ...formData, tipo: 'Gasto', categoria: '' })}
                            className={`flex-1 py-2 rounded-lg font-bold transition-all ${!isIngreso
                                    ? 'bg-rose-600 text-white'
                                    : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                                }`}
                        >
                            <TrendingDown size={16} className="inline mr-1" /> Gasto
                        </button>
                    </div>

                    {/* Amount */}
                    <div>
                        <label className="block text-sm text-slate-400 mb-1 flex items-center gap-1">
                            <DollarSign size={14} /> Monto
                        </label>
                        <input
                            type="text"
                            className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2.5 text-white text-xl font-bold focus:outline-none focus:border-blue-500"
                            placeholder="0"
                            value={formatMonto(formData.monto)}
                            onChange={handleMontoChange}
                            required
                        />
                    </div>

                    {/* Date and Bank */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm text-slate-400 mb-1 flex items-center gap-1">
                                <Calendar size={14} /> Fecha
                            </label>
                            <input
                                type="date"
                                name="fecha"
                                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                                value={formData.fecha}
                                onChange={handleChange}
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-slate-400 mb-1 flex items-center gap-1">
                                <Building2 size={14} /> Banco
                            </label>
                            <select
                                name="banco"
                                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                                value={formData.banco}
                                onChange={handleChange}
                            >
                                <option value="">Sin banco</option>
                                {banks.map(b => (
                                    <option key={b.id} value={b.nombre}>{b.nombre}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Category */}
                    <div>
                        <label className="block text-sm text-slate-400 mb-1 flex items-center gap-1">
                            <Tag size={14} /> Categoría
                        </label>
                        <select
                            name="categoria"
                            className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                            value={formData.categoria}
                            onChange={handleChange}
                            required
                        >
                            <option value="">Selecciona...</option>
                            {typeCats.map(c => (
                                <option key={c.id} value={c.nombre}>{c.nombre}</option>
                            ))}
                        </select>
                    </div>

                    {/* Detail */}
                    <div>
                        <label className="block text-sm text-slate-400 mb-1 flex items-center gap-1">
                            <FileText size={14} /> Detalle
                        </label>
                        <input
                            type="text"
                            name="detalle"
                            className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                            placeholder="Descripción del movimiento..."
                            value={formData.detalle}
                            onChange={handleChange}
                        />
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="bg-rose-900/50 border border-rose-700 text-rose-300 px-3 py-2 rounded-lg text-sm flex items-center gap-2">
                            <AlertTriangle size={16} /> {error}
                        </div>
                    )}

                    {/* Delete Confirmation */}
                    {showDeleteConfirm && (
                        <div className="bg-amber-900/30 border border-amber-600/50 rounded-lg p-3 space-y-2">
                            <p className="text-amber-300 text-sm flex items-center gap-2">
                                <AlertTriangle size={16} /> Ingresa la frase de confirmación para eliminar:
                            </p>
                            <input
                                type="text"
                                className="w-full bg-slate-900 border border-amber-600/50 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                                placeholder="Frase de confirmación..."
                                value={deletePhrase}
                                onChange={(e) => setDeletePhrase(e.target.value)}
                            />
                        </div>
                    )}

                    {/* Buttons */}
                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={handleDelete}
                            disabled={loading}
                            className="flex-1 bg-rose-900/50 hover:bg-rose-800 border border-rose-700 text-rose-300 hover:text-white font-bold py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2"
                        >
                            <Trash2 size={18} />
                            {showDeleteConfirm ? 'Confirmar' : 'Eliminar'}
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className={`flex-1 font-bold py-3 px-4 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 ${isIngreso
                                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-500/20'
                                    : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/20'
                                }`}
                        >
                            <Save size={18} />
                            {loading ? 'Guardando...' : 'Guardar'}
                        </button>
                    </div>

                </form>
            </div>
        </div>
    );
}
