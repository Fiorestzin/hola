import { useState, useEffect } from 'react';
import { X, ArrowRightLeft, Check, AlertCircle, Building2, PiggyBank } from 'lucide-react';
import { API_URL } from "../config";
import { useSnackbar } from '../context/SnackbarContext';

export default function SavingsMigratorModal({ isOpen, onClose, environment = "TEST", sourceBank, onComplete }) {
    const { showSnackbar } = useSnackbar();
    const [targetBank, setTargetBank] = useState('');
    const [banks, setBanks] = useState([]);
    const [metas, setMetas] = useState([]);
    const [selectedMetas, setSelectedMetas] = useState([]); // IDs of metas to move
    const [loading, setLoading] = useState(false);
    const [mode, setMode] = useState('all'); // 'all' or 'select'

    useEffect(() => {
        if (isOpen) {
            fetchBanks();
            fetchGoals();
            setTargetBank('');
            setSelectedMetas([]);
            setMode('all');
        }
    }, [isOpen, sourceBank]);

    const fetchBanks = async () => {
        try {
            const res = await fetch(`${API_URL}/banks/with-balance?environment=${environment}`);
            if (res.ok) {
                const data = await res.json();
                // Filter out the source bank
                setBanks(data.filter(b => b.nombre !== sourceBank));
            }
        } catch (error) {
            console.error("Error loading banks:", error);
        }
    };

    const fetchGoals = async () => {
        try {
            const res = await fetch(`${API_URL}/savings-goals?environment=${environment}`);
            if (res.ok) {
                const data = await res.json();
                // We only care about goals that HAVE balance
                setMetas(data.filter(g => g.monto_actual > 0));
            }
        } catch (error) {
            console.error("Error loading goals:", error);
        }
    };

    const handleTransfer = async () => {
        if (!targetBank) {
            showSnackbar("Selecciona un banco destino", "error");
            return;
        }

        if (mode === 'select' && selectedMetas.length === 0) {
            showSnackbar("Selecciona al menos una meta", "error");
            return;
        }

        setLoading(true);
        try {
            const payload = {
                banco_origen: sourceBank,
                banco_destino: targetBank,
                goal_ids: mode === 'all' ? null : selectedMetas,
                environment
            };

            const res = await fetch(`${API_URL}/savings/transfer-between-banks`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                const data = await res.json();
                showSnackbar(`¡Migración exitosa! ${data.updated_count} registros movidos.`, "success");
                if (onComplete) onComplete();
                onClose();
            } else {
                const err = await res.json();
                showSnackbar(err.detail || "Error al migrar ahorros", "error");
            }
        } catch (error) {
            console.error("Migration error:", error);
            showSnackbar("Error de conexión", "error");
        } finally {
            setLoading(false);
        }
    };

    const toggleMeta = (id) => {
        setSelectedMetas(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const fmt = (num) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(num);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[60] p-4">
            <div className="bg-slate-800 border border-slate-700 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="p-6 bg-gradient-to-br from-indigo-600/20 to-blue-600/20 border-b border-white/5">
                    <div className="flex justify-between items-start">
                        <div>
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                <ArrowRightLeft className="text-indigo-400" /> Migrar Ahorros
                            </h2>
                            <p className="text-slate-400 text-sm mt-1">
                                Mueve el compromiso conceptual de tus ahorros.
                            </p>
                        </div>
                        <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
                            <X size={24} />
                        </button>
                    </div>
                </div>

                <div className="p-6 space-y-6">
                    {/* Source Indicator */}
                    <div className="flex items-center justify-center gap-4 py-4 bg-slate-900/50 rounded-2xl border border-white/5">
                        <div className="text-center">
                            <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Origen</p>
                            <span className="text-indigo-300 font-semibold">{sourceBank}</span>
                        </div>
                        <ArrowRightLeft className="text-slate-700" size={20} />
                        <div className="text-center">
                            <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Destino</p>
                            <select
                                className="bg-transparent text-emerald-400 font-semibold focus:outline-none cursor-pointer"
                                value={targetBank}
                                onChange={(e) => setTargetBank(e.target.value)}
                            >
                                <option value="" disabled className="bg-slate-800 text-slate-500">Seleccionar...</option>
                                {banks.map(b => (
                                    <option key={b.nombre} value={b.nombre} className="bg-slate-800 text-white">
                                        {b.nombre}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Mode Toggle */}
                    <div className="flex bg-slate-900/80 p-1 rounded-xl border border-white/5">
                        <button
                            onClick={() => setMode('all')}
                            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${mode === 'all' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            Mover Todo
                        </button>
                        <button
                            onClick={() => setMode('select')}
                            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${mode === 'select' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            Seleccionar Metas
                        </button>
                    </div>

                    {/* Goals List (if select mode) */}
                    {mode === 'select' && (
                        <div className="max-h-48 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                            {metas.map(meta => (
                                <label
                                    key={meta.id}
                                    className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${selectedMetas.includes(meta.id) ? 'bg-indigo-500/10 border-indigo-500/50' : 'bg-slate-900/30 border-white/5 hover:border-white/10'}`}
                                >
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="checkbox"
                                            className="hidden"
                                            checked={selectedMetas.includes(meta.id)}
                                            onChange={() => toggleMeta(meta.id)}
                                        />
                                        <div className={`w-5 h-5 rounded flex items-center justify-center border transition-all ${selectedMetas.includes(meta.id) ? 'bg-indigo-500 border-indigo-500' : 'border-slate-600'}`}>
                                            {selectedMetas.includes(meta.id) && <Check size={14} className="text-white" />}
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-slate-200">{meta.icono} {meta.nombre}</p>
                                            <p className="text-[10px] text-slate-500">Saldo: {fmt(meta.monto_actual)}</p>
                                        </div>
                                    </div>
                                    <span className="text-xs font-mono text-indigo-400">{fmt(meta.monto_actual)}</span>
                                </label>
                            ))}
                        </div>
                    )}

                    {/* Notice */}
                    <div className="flex gap-3 p-4 bg-amber-500/5 border border-amber-500/20 rounded-2xl">
                        <AlertCircle className="text-amber-500 shrink-0" size={20} />
                        <p className="text-xs text-amber-200/70 leading-relaxed">
                            Esta acción es <span className="text-amber-400 font-bold italic">conceptual</span>. Se moverá la etiqueta de ahorro pero no se generará una transferencia real bancaria.
                        </p>
                    </div>

                    <button
                        onClick={handleTransfer}
                        disabled={loading || !targetBank}
                        className={`w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all ${loading || !targetBank ? 'bg-slate-700 text-slate-500 cursor-not-allowed' : 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-xl shadow-indigo-900/20 hover:scale-[1.02] active:scale-95'}`}
                    >
                        {loading ? (
                            <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        ) : (
                            <>
                                <Check size={20} /> Confirmar Migración
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
