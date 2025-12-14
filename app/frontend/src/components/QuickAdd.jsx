import { useState, useEffect } from 'react';
import { X, Save, TrendingUp, TrendingDown } from 'lucide-react';
import { API_URL } from "../config";

export default function QuickAdd({ isOpen, onClose, onSave, type = 'Gasto', environment = 'TEST' }) {
    if (!isOpen) return null;

    const [formData, setFormData] = useState({
        fecha: new Date().toISOString().split('T')[0],
        monto: '',
        categoria: '',
        detalle: '',
        banco: 'Efectivo' // Default
    });

    // Fetch categories on mount
    const [categories, setCategories] = useState([]);
    const [banks, setBanks] = useState([]);

    useEffect(() => {
        if (isOpen) {
            fetch(`${API_URL}/categories?environment=${environment}`)
                .then(res => res.json())
                .then(data => setCategories(data))
                .catch(err => console.error(err));

            fetch(`${API_URL}/banks?environment=${environment}`)
                .then(res => res.json())
                .then(data => setBanks(data))
                .catch(err => console.error(err));
        }
    }, [isOpen, environment]);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave({ ...formData, tipo: type });
        onClose();
    };

    // Filter categories by type
    const typeCats = categories.filter(c => c.tipo === type);

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">

                {/* Header */}
                <div className={`p-4 flex justify-between items-center ${type === 'Ingreso' ? 'bg-emerald-500/10' : 'bg-rose-500/10'}`}>
                    <h2 className={`font-bold text-xl flex items-center gap-2 ${type === 'Ingreso' ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {type === 'Ingreso' ? <TrendingUp /> : <TrendingDown />}
                        Registrar {type}
                    </h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                        <X />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">

                    <div>
                        <label className="block text-sm text-slate-400 mb-1">Monto</label>
                        <input
                            type="number"
                            name="monto"
                            required
                            autoFocus
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-2xl font-bold text-white focus:outline-none focus:border-blue-500 transition-colors"
                            placeholder="0"
                            value={formData.monto}
                            onChange={handleChange}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm text-slate-400 mb-1">Fecha</label>
                            <input
                                type="date"
                                name="fecha"
                                required
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white"
                                value={formData.fecha}
                                onChange={handleChange}
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-slate-400 mb-1">Banco / Cuenta</label>
                            <select
                                name="banco"
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white"
                                value={formData.banco}
                                onChange={handleChange}
                            >
                                {banks.map(b => (
                                    <option key={b.id} value={b.nombre}>{b.nombre}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm text-slate-400 mb-1">Categoría</label>
                        <select
                            name="categoria"
                            required
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white"
                            value={formData.categoria}
                            onChange={handleChange}
                        >
                            <option value="">Selecciona...</option>
                            {typeCats.map(c => (
                                <option key={c.id} value={c.nombre}>{c.nombre}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm text-slate-400 mb-1">Detalle (Opcional)</label>
                        <input
                            type="text"
                            name="detalle"
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white"
                            placeholder="Ej: Almuerzo en..."
                            value={formData.detalle}
                            onChange={handleChange}
                        />
                    </div>

                    <button
                        type="submit"
                        className={`w-full py-3 rounded-lg font-bold flex items-center justify-center gap-2 mt-4 
            ${type === 'Ingreso'
                                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                                : 'bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-500/20'}`}
                    >
                        <Save size={18} /> Guardar Movimiento
                    </button>

                </form>
            </div>
        </div>
    );
}
