import { useState, useEffect } from 'react';
import { X, ArrowRight, Save, AlertTriangle, Replace } from 'lucide-react';
import { API_URL } from "../config";

export default function AccountMigratorModal({ isOpen, onClose, environment = "TEST", onMigrationComplete }) {
    const [banks, setBanks] = useState([]);
    const [accounts, setAccounts] = useState([]);

    const [banco, setBanco] = useState('');
    const [cuentaOrigen, setCuentaOrigen] = useState('');
    const [cuentaDestino, setCuentaDestino] = useState('');

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    useEffect(() => {
        if (isOpen) {
            fetchBanks();
            fetchAccounts();
            setBanco('');
            setCuentaOrigen('Principal');
            setCuentaDestino('');
            setError('');
            setSuccessMsg('');
        }
    }, [isOpen, environment]);

    const fetchBanks = async () => {
        try {
            const res = await fetch(`${API_URL}/banks?environment=${environment}`);
            if (res.ok) setBanks(await res.json());
        } catch (error) {
            console.error("Error loading banks:", error);
        }
    };

    const fetchAccounts = async () => {
        try {
            const res = await fetch(`${API_URL}/accounts?environment=${environment}`);
            if (res.ok) setAccounts(await res.json());
        } catch (error) {
            console.error("Error loading accounts:", error);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccessMsg('');

        if (!banco) {
            setError('Selecciona un banco');
            return;
        }

        if (!cuentaDestino) {
            setError('Selecciona la cuenta de destino (nueva)');
            return;
        }

        if (cuentaOrigen === cuentaDestino) {
            setError('La cuenta de origen y destino no pueden ser la misma');
            return;
        }

        if (!confirm(`¿Estás seguro de migrar TODAS las transacciones antiguas de ${banco} (${cuentaOrigen || 'Sin cuenta'}) hacia la cuenta ${cuentaDestino}? Esta acción es irreversible en bloque.`)) {
            return;
        }

        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/migrate-account`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    banco,
                    cuenta_origen: cuentaOrigen || '',
                    cuenta_destino: cuentaDestino,
                    environment
                })
            });

            const data = await res.json();
            if (res.ok) {
                setSuccessMsg(data.message);
                if (onMigrationComplete) onMigrationComplete();
                setTimeout(() => {
                    onClose();
                }, 2500);
            } else {
                setError(data.detail || 'Error al migrar cuentas');
            }
        } catch (error) {
            console.error("Error migrating:", error);
            setError('Error de conexión al servidor');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
                <div className="p-4 flex justify-between items-center bg-amber-500/10 border-b border-slate-700">
                    <h2 className="font-bold text-xl flex items-center gap-2 text-amber-400">
                        <Replace size={20} /> Migrar Cuentas (Historial)
                    </h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                        <X />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                    <div className="bg-amber-900/20 text-amber-200/80 p-3 rounded-lg text-sm mb-2 border border-amber-500/20 flex gap-2">
                        <div><AlertTriangle size={16} className="text-amber-400 mt-0.5" /></div>
                        <div>Esta herramienta cambiará la cuenta de múltiples transacciones a la vez. Úsala para limpiar tu historial re-asignando la cuenta "Principal" a las cuentas reales.</div>
                    </div>

                    <div>
                        <label className="block text-sm text-slate-400 mb-1">Banco afectado</label>
                        <select
                            className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                            value={banco}
                            onChange={(e) => setBanco(e.target.value)}
                            required
                        >
                            <option value="">Seleccionar banco...</option>
                            {banks.map(b => (
                                <option key={b.id} value={b.nombre}>{b.nombre}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex items-end gap-3">
                        <div className="flex-1">
                            <label className="block text-sm text-slate-400 mb-1">Cuenta antigua</label>
                            <select
                                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                                value={cuentaOrigen}
                                onChange={(e) => setCuentaOrigen(e.target.value)}
                            >
                                <option value="">Sin cuenta (Vacio)</option>
                                <option value="Principal">Principal</option>
                                {accounts.map(a => (
                                    <option key={a.id} value={a.nombre}>{a.nombre}</option>
                                ))}
                            </select>
                        </div>

                        <div className="pb-2 text-slate-500">
                            <ArrowRight size={20} />
                        </div>

                        <div className="flex-1">
                            <label className="block text-sm text-slate-400 mb-1">Cuenta nueva</label>
                            <select
                                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                                value={cuentaDestino}
                                onChange={(e) => setCuentaDestino(e.target.value)}
                                required
                            >
                                <option value="">Seleccionar...</option>
                                {accounts.map(a => (
                                    <option key={a.id} value={a.nombre}>{a.nombre}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {error && (
                        <div className="text-rose-400 text-sm mt-2">{error}</div>
                    )}
                    {successMsg && (
                        <div className="text-emerald-400 text-sm mt-2 font-bold bg-emerald-900/30 p-2 rounded">{successMsg}</div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full mt-4 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-700 text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors"
                    >
                        <Save size={18} />
                        {loading ? 'Procesando...' : 'Re-asignar Transacciones'}
                    </button>
                </form>
            </div>
        </div>
    );
}
