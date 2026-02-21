import { useState, useEffect } from 'react';
import { X, ArrowRightLeft, Send, Calendar, DollarSign, FileText } from 'lucide-react';
import { API_URL } from "../config";

export default function TransferModal({ isOpen, onClose, environment = "TEST", onTransferComplete }) {
    const [banks, setBanks] = useState([]);
    const [bancoOrigen, setBancoOrigen] = useState('');
    const [cuentaOrigen, setCuentaOrigen] = useState('');
    const [bancoDestino, setBancoDestino] = useState('');
    const [cuentaDestino, setCuentaDestino] = useState('');
    const [accounts, setAccounts] = useState([]);
    const [monto, setMonto] = useState('');
    const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
    const [detalle, setDetalle] = useState('Transferencia interna');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen) {
            fetchBanks();
            fetchAccounts();
            // Reset form
            setBancoOrigen('');
            setCuentaOrigen('');
            setBancoDestino('');
            setCuentaDestino('');
            setMonto('');
            setFecha(new Date().toISOString().split('T')[0]);
            setDetalle('Transferencia interna');
            setError('');
        }
    }, [isOpen, environment]);

    const fetchBanks = async () => {
        try {
            const res = await fetch(`${API_URL}/banks?environment=${environment}`);
            if (res.ok) {
                const data = await res.json();
                setBanks(data);
            }
        } catch (error) {
            console.error("Error loading banks:", error);
        }
    };

    const fetchAccounts = async () => {
        try {
            const res = await fetch(`${API_URL}/accounts?environment=${environment}`);
            if (res.ok) {
                const data = await res.json();
                setAccounts(data);
            }
        } catch (error) {
            console.error("Error loading accounts:", error);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!bancoOrigen || !bancoDestino) {
            setError('Selecciona ambos bancos');
            return;
        }

        if (bancoOrigen !== 'Efectivo' && !cuentaOrigen) {
            setError('Selecciona cuenta de origen');
            return;
        }

        if (bancoDestino !== 'Efectivo' && !cuentaDestino) {
            setError('Selecciona cuenta de destino');
            return;
        }

        if (bancoOrigen === bancoDestino && cuentaOrigen === cuentaDestino) {
            setError('Origen y destino no pueden ser exactamente iguales');
            return;
        }

        if (!monto || parseFloat(monto) <= 0) {
            setError('Ingresa un monto válido');
            return;
        }

        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/transfer`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fecha,
                    banco_origen: bancoOrigen,
                    cuenta_origen: bancoOrigen === 'Efectivo' ? '' : cuentaOrigen,
                    banco_destino: bancoDestino,
                    cuenta_destino: bancoDestino === 'Efectivo' ? '' : cuentaDestino,
                    monto: parseFloat(monto),
                    detalle,
                    environment
                })
            });

            if (res.ok) {
                if (onTransferComplete) onTransferComplete();
                onClose();
            } else {
                const data = await res.json();
                setError(data.detail || 'Error al realizar transferencia');
            }
        } catch (error) {
            console.error("Error creating transfer:", error);
            setError('Error de conexión');
        } finally {
            setLoading(false);
        }
    };

    // Format number with Chilean peso formatting
    const formatMonto = (value) => {
        const num = value.replace(/\D/g, '');
        return num ? parseInt(num).toLocaleString('es-CL') : '';
    };

    const handleMontoChange = (e) => {
        const raw = e.target.value.replace(/\D/g, '');
        setMonto(raw);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">

                {/* Header */}
                <div className="p-4 flex justify-between items-center bg-gradient-to-r from-cyan-600/20 to-blue-600/20 border-b border-slate-700">
                    <h2 className="font-bold text-xl flex items-center gap-2 text-cyan-400">
                        <ArrowRightLeft size={20} /> Transferencia Interna
                    </h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                        <X />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-5 space-y-4">

                    {/* Bank Origin */}
                    <div className="flex gap-2">
                        <div className="flex-1">
                            <label className="block text-sm text-slate-400 mb-1">Desde</label>
                            <select
                                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-cyan-500"
                                value={bancoOrigen}
                                onChange={(e) => setBancoOrigen(e.target.value)}
                                required
                            >
                                <option value="">Banco origen...</option>
                                {banks.map((bank) => (
                                    <option key={bank.id} value={bank.nombre}>
                                        {bank.nombre}
                                    </option>
                                ))}
                            </select>
                        </div>
                        {bancoOrigen !== 'Efectivo' && (
                            <div className="flex-1">
                                <label className="block text-sm text-slate-400 mb-1">Cuenta origen</label>
                                <select
                                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-cyan-500"
                                    value={cuentaOrigen}
                                    onChange={(e) => setCuentaOrigen(e.target.value)}
                                    required={bancoOrigen !== 'Efectivo'}
                                >
                                    <option value="">Seleccionar...</option>
                                    {accounts.map(a => (
                                        <option key={a.id} value={a.nombre}>{a.nombre}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>

                    {/* Arrow indicator */}
                    <div className="flex justify-center text-cyan-400">
                        <ArrowRightLeft className="rotate-90" size={24} />
                    </div>

                    {/* Bank Destination */}
                    <div className="flex gap-2">
                        <div className="flex-1">
                            <label className="block text-sm text-slate-400 mb-1">Hacia</label>
                            <select
                                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-cyan-500"
                                value={bancoDestino}
                                onChange={(e) => setBancoDestino(e.target.value)}
                                required
                            >
                                <option value="">Banco destino...</option>
                                {banks.map((bank) => (
                                    <option key={bank.id} value={bank.nombre}>
                                        {bank.nombre}
                                    </option>
                                ))}
                            </select>
                        </div>
                        {bancoDestino !== 'Efectivo' && (
                            <div className="flex-1">
                                <label className="block text-sm text-slate-400 mb-1">Cuenta destino</label>
                                <select
                                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-cyan-500"
                                    value={cuentaDestino}
                                    onChange={(e) => setCuentaDestino(e.target.value)}
                                    required={bancoDestino !== 'Efectivo'}
                                >
                                    <option value="">Seleccionar...</option>
                                    {accounts.map(a => (
                                        <option key={a.id} value={a.nombre}>{a.nombre}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>

                    {/* Amount */}
                    <div>
                        <label className="block text-sm text-slate-400 mb-1 flex items-center gap-1">
                            <DollarSign size={14} /> Monto
                        </label>
                        <input
                            type="text"
                            className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2.5 text-white text-lg font-bold focus:outline-none focus:border-cyan-500"
                            placeholder="0"
                            value={formatMonto(monto)}
                            onChange={handleMontoChange}
                            required
                        />
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="bg-rose-900/50 border border-rose-700 text-rose-300 px-3 py-2 rounded-lg text-sm">
                            {error}
                        </div>
                    )}

                    {/* Submit */}
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:from-slate-600 disabled:to-slate-600 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2"
                    >
                        <Send size={18} />
                        {loading ? 'Transfiriendo...' : 'Realizar Transferencia'}
                    </button>
                </form>

            </div>
        </div>
    );
}
