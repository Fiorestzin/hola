import { useState, useEffect } from 'react';
import { X, Plus, Trash2, FileText } from 'lucide-react';
import { API_URL } from "../config";

export default function AccountsManager({ isOpen, onClose, environment = "TEST", embedded = false }) {
    const [accounts, setAccounts] = useState([]);
    const [newAccount, setNewAccount] = useState('');

    useEffect(() => {
        if (isOpen || embedded) fetchAccounts();
    }, [isOpen, environment, embedded]);

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

    const handleAdd = async (e) => {
        e.preventDefault();
        if (!newAccount.trim()) return;

        try {
            const res = await fetch(`${API_URL}/accounts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nombre: newAccount, environment })
            });
            if (res.ok) {
                setNewAccount('');
                fetchAccounts();
            }
        } catch (error) {
            console.error("Error adding account:", error);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('¿Seguro que quieres eliminar este tipo de cuenta?')) return;
        try {
            const res = await fetch(`${API_URL}/accounts/${id}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                fetchAccounts();
            }
        } catch (error) {
            console.error("Error deleting account:", error);
        }
    };

    if (!isOpen && !embedded) return null;

    const Content = (
        <div className={`${embedded ? 'h-full flex flex-col' : 'bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[80vh]'}`}>

            {/* Header */}
            <div className={`p-4 flex justify-between items-center border-b border-slate-700 ${embedded ? '' : 'bg-slate-700/50'}`}>
                <h2 className="font-bold text-xl flex items-center gap-2 text-blue-400">
                    <FileText size={20} /> Gestionar Cuentas
                </h2>
                {!embedded && (
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                        <X />
                    </button>
                )}
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {accounts.map((account) => (
                    <div key={account.id} className="flex justify-between items-center bg-slate-900/50 p-3 rounded-lg border border-slate-700/50 hover:border-slate-600 transition-colors">
                        <div className="flex items-center gap-3">
                            <FileText size={16} className="text-blue-400" />
                            <span className="text-slate-200">{account.nombre}</span>
                        </div>
                        <button
                            onClick={() => handleDelete(account.id)}
                            className="text-slate-500 hover:text-rose-400 p-2 transition-colors"
                        >
                            <Trash2 size={16} />
                        </button>
                    </div>
                ))}
                {accounts.length === 0 && <p className="text-center text-slate-500 py-4">No hay cuentas registradas.</p>}
            </div>

            {/* Add Form */}
            <form onSubmit={handleAdd} className="p-4 bg-slate-700/30 border-t border-slate-700 flex gap-2">
                <input
                    type="text"
                    className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    placeholder="Nuevo nombre de cuenta..."
                    value={newAccount}
                    onChange={(e) => setNewAccount(e.target.value)}
                />
                <button
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-500 text-white p-2 rounded-lg transition-colors"
                >
                    <Plus size={20} />
                </button>
            </form>

        </div>
    );

    if (embedded) return Content;

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            {Content}
        </div>
    );
}
