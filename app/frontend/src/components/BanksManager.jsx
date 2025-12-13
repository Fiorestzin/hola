import { useState, useEffect } from 'react';
import { X, Plus, Trash2, Building2 } from 'lucide-react';
import { API_URL } from "../config";

export default function BanksManager({ isOpen, onClose, environment = "TEST" }) {
    const [banks, setBanks] = useState([]);
    const [newBank, setNewBank] = useState('');

    useEffect(() => {
        if (isOpen) fetchBanks();
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

    const handleAdd = async (e) => {
        e.preventDefault();
        if (!newBank.trim()) return;

        try {
            const res = await fetch(`${API_URL}/banks`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nombre: newBank, environment })
            });
            if (res.ok) {
                setNewBank('');
                fetchBanks();
            }
        } catch (error) {
            console.error("Error adding bank:", error);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('¿Seguro que quieres eliminar este banco/medio de pago?')) return;
        try {
            const res = await fetch(`${API_URL}/banks/${id}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                fetchBanks();
            }
        } catch (error) {
            console.error("Error deleting bank:", error);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">

                {/* Header */}
                <div className="p-4 flex justify-between items-center bg-slate-700/50 border-b border-slate-700">
                    <h2 className="font-bold text-xl flex items-center gap-2 text-cyan-400">
                        <Building2 size={20} /> Gestionar Bancos / Medios de Pago
                    </h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                        <X />
                    </button>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {banks.map((bank) => (
                        <div key={bank.id} className="flex justify-between items-center bg-slate-900/50 p-3 rounded-lg border border-slate-700/50 hover:border-slate-600 transition-colors">
                            <div className="flex items-center gap-3">
                                <Building2 size={16} className="text-cyan-400" />
                                <span className="text-slate-200">{bank.nombre}</span>
                            </div>
                            <button
                                onClick={() => handleDelete(bank.id)}
                                className="text-slate-500 hover:text-rose-400 p-2 transition-colors"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    ))}
                    {banks.length === 0 && <p className="text-center text-slate-500 py-4">No hay bancos registrados.</p>}
                </div>

                {/* Add Form */}
                <form onSubmit={handleAdd} className="p-4 bg-slate-700/30 border-t border-slate-700 flex gap-2">
                    <input
                        type="text"
                        className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                        placeholder="Nuevo banco o medio de pago..."
                        value={newBank}
                        onChange={(e) => setNewBank(e.target.value)}
                    />
                    <button
                        type="submit"
                        className="bg-cyan-600 hover:bg-cyan-500 text-white p-2 rounded-lg transition-colors"
                    >
                        <Plus size={20} />
                    </button>
                </form>

            </div>
        </div>
    );
}
