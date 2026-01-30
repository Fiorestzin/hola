import { useState, useEffect } from 'react';
import { X, Save, TrendingUp, TrendingDown, Percent, Calculator } from 'lucide-react';
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

    // Net/Gross Calculator State
    const [isNetMode, setIsNetMode] = useState(false);
    const [netAmount, setNetAmount] = useState('');
    const [taxRate, setTaxRate] = useState(19); // Default IVA 19%

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

    // Calculate Gross automatically when Net or Tax changes
    useEffect(() => {
        if (isNetMode && netAmount) {
            const net = parseFloat(netAmount);
            const tax = parseFloat(taxRate) || 0;
            if (!isNaN(net)) {
                const gross = Math.round(net * (1 + tax / 100));
                setFormData(prev => ({ ...prev, monto: gross.toString() }));
            }
        }
    }, [netAmount, taxRate, isNetMode]);

    const handleNetToggle = (enabled) => {
        setIsNetMode(enabled);
        if (enabled && formData.monto) {
            // If enabling, treat current monto as net
            setNetAmount(formData.monto);
        } else if (!enabled && netAmount) {
            // If disabling, restore the original net value to the main field
            setFormData(prev => ({ ...prev, monto: netAmount }));
        }
    };

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

                    <div className="space-y-3">
                        <div className="flex justify-between items-end">
                            <div className="flex-1">
                                <label className="block text-sm text-slate-400 mb-1">Monto {isNetMode ? 'Bruto (Final)' : ''}</label>
                                <input
                                    type="number"
                                    name="monto"
                                    required
                                    autoFocus={!isNetMode}
                                    readOnly={isNetMode}
                                    className={`w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-2xl font-bold text-white focus:outline-none transition-colors ${isNetMode ? 'opacity-70 border-blue-500/50 text-blue-300' : 'focus:border-blue-500'}`}
                                    placeholder="0"
                                    value={formData.monto}
                                    onChange={(e) => {
                                        setIsNetMode(false); // Disable net mode if manual entry
                                        handleChange(e);
                                    }}
                                />
                            </div>
                        </div>

                        {/* Net Calculator Toggle */}
                        <div className="flex items-center gap-2">
                            <label className="flex items-center gap-2 cursor-pointer group">
                                <div className="relative">
                                    <input
                                        type="checkbox"
                                        className="sr-only peer"
                                        checked={isNetMode}
                                        onChange={(e) => handleNetToggle(e.target.checked)}
                                    />
                                    <div className="w-10 h-5 bg-slate-700 rounded-full peer peer-checked:bg-blue-600 transition-colors"></div>
                                    <div className="absolute left-1 top-1 w-3 h-3 bg-white rounded-full transition-transform peer-checked:translate-x-5"></div>
                                </div>
                                <span className={`text-sm font-medium transition-colors flex items-center gap-1 ${isNetMode ? 'text-blue-400' : 'text-slate-400 group-hover:text-slate-200'}`}>
                                    <Calculator size={14} /> Tratar como Monto Neto (+ IVA)
                                </span>
                            </label>
                            {isNetMode && (
                                <div className="ml-auto text-[10px] font-bold text-blue-500 uppercase tracking-widest animate-pulse">
                                    Calculando Bruto...
                                </div>
                            )}
                        </div>

                        {/* Net Options */}
                        {isNetMode && (
                            <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2 duration-200 bg-slate-900/50 p-3 rounded-xl border border-blue-500/20">
                                <div>
                                    <label className="block text-[10px] text-blue-400/70 mb-1 flex items-center gap-1 uppercase tracking-wider font-bold">
                                        Editar Neto
                                    </label>
                                    <input
                                        type="number"
                                        autoFocus
                                        className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:border-blue-500 text-lg"
                                        placeholder="Neto"
                                        value={netAmount}
                                        onChange={(e) => setNetAmount(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] text-blue-400/70 mb-1 flex items-center gap-1 uppercase tracking-wider font-bold">
                                        IVA / Impuesto %
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:border-blue-500 pr-8 text-lg"
                                            value={taxRate}
                                            onChange={(e) => setTaxRate(e.target.value)}
                                        />
                                        <Percent size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" />
                                    </div>
                                </div>
                            </div>
                        )}
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
