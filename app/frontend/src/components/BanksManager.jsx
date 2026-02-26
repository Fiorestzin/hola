import { useState, useEffect } from 'react';
import { X, Plus, Trash2, Building2, ChevronDown, ChevronRight, Link2 } from 'lucide-react';
import { API_URL } from "../config";

export default function BanksManager({ isOpen, onClose, environment = "TEST", embedded = false }) {
    const [banks, setBanks] = useState([]);
    const [newBank, setNewBank] = useState('');
    const [accounts, setAccounts] = useState([]); // Global accounts for assignment
    const [bankAccounts, setBankAccounts] = useState({}); // { bankName: [acct1, acct2] }
    const [expandedBank, setExpandedBank] = useState(null);
    const [newAccountName, setNewAccountName] = useState('');

    useEffect(() => {
        if (isOpen || embedded) {
            fetchBanks();
            fetchAccounts();
            fetchAllBankAccounts();
        }
    }, [isOpen, environment, embedded]);

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

    const fetchAllBankAccounts = async () => {
        try {
            const res = await fetch(`${API_URL}/bank-accounts/all?environment=${environment}`);
            if (res.ok) setBankAccounts(await res.json());
        } catch (error) {
            console.error("Error loading bank-accounts:", error);
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
            const res = await fetch(`${API_URL}/banks/${id}`, { method: 'DELETE' });
            if (res.ok) fetchBanks();
        } catch (error) {
            console.error("Error deleting bank:", error);
        }
    };

    const handleAssignAccount = async (bankName, accountName) => {
        try {
            const res = await fetch(`${API_URL}/banks/${encodeURIComponent(bankName)}/accounts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ account_name: accountName, environment })
            });
            if (res.ok) fetchAllBankAccounts();
        } catch (error) {
            console.error("Error assigning account:", error);
        }
    };

    const handleUnassignAccount = async (bankName, accountName) => {
        try {
            const res = await fetch(`${API_URL}/banks/${encodeURIComponent(bankName)}/accounts/${encodeURIComponent(accountName)}?environment=${environment}`, {
                method: 'DELETE'
            });
            if (res.ok) fetchAllBankAccounts();
        } catch (error) {
            console.error("Error unassigning account:", error);
        }
    };

    const handleAddNewAccount = async (bankName) => {
        if (!newAccountName.trim()) return;
        // First create the account globally if it doesn't exist
        const exists = accounts.some(a => a.nombre === newAccountName);
        if (!exists) {
            try {
                await fetch(`${API_URL}/accounts`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ nombre: newAccountName, environment })
                });
                await fetchAccounts();
            } catch (e) { console.error(e); }
        }
        // Then assign to bank
        await handleAssignAccount(bankName, newAccountName);
        setNewAccountName('');
    };

    if (!isOpen && !embedded) return null;

    const Content = (
        <div className={`${embedded ? 'h-full flex flex-col' : 'bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[80vh]'}`}>

            {/* Header */}
            <div className={`p-4 flex justify-between items-center border-b border-slate-700 ${embedded ? '' : 'bg-slate-700/50'}`}>
                <h2 className="font-bold text-xl flex items-center gap-2 text-cyan-400">
                    <Building2 size={20} /> Gestionar Bancos
                </h2>
                {!embedded && (
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                        <X />
                    </button>
                )}
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {banks.map((bank) => {
                    const assigned = bankAccounts[bank.nombre] || [];
                    const isExpanded = expandedBank === bank.nombre;
                    // Accounts available to assign (not yet assigned)
                    const availableToAssign = accounts.filter(a => !assigned.includes(a.nombre));

                    return (
                        <div key={bank.id} className="bg-slate-900/50 rounded-lg border border-slate-700/50 hover:border-slate-600 transition-colors overflow-hidden">
                            {/* Bank Row */}
                            <div className="flex justify-between items-center p-3">
                                <div
                                    className="flex items-center gap-3 cursor-pointer flex-1"
                                    onClick={() => setExpandedBank(isExpanded ? null : bank.nombre)}
                                >
                                    {isExpanded ? <ChevronDown size={14} className="text-cyan-400" /> : <ChevronRight size={14} className="text-slate-500" />}
                                    <Building2 size={16} className="text-cyan-400" />
                                    <span className="text-slate-200">{bank.nombre}</span>
                                    {assigned.length > 0 && (
                                        <span className="text-[10px] bg-cyan-500/20 text-cyan-400 px-1.5 py-0.5 rounded-full font-bold">
                                            {assigned.length} {assigned.length === 1 ? 'cuenta' : 'cuentas'}
                                        </span>
                                    )}
                                </div>
                                <button
                                    onClick={() => handleDelete(bank.id)}
                                    className="text-slate-500 hover:text-rose-400 p-2 transition-colors"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>

                            {/* Expanded: Assigned Accounts */}
                            {isExpanded && (
                                <div className="px-4 pb-3 space-y-2 border-t border-slate-700/50 pt-2 animate-in slide-in-from-top-2 fade-in duration-200">
                                    <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold flex items-center gap-1">
                                        <Link2 size={10} /> Cuentas asignadas
                                    </p>

                                    {assigned.length === 0 && (
                                        <p className="text-xs text-slate-600 italic">Sin cuentas asignadas. Agrega una abajo.</p>
                                    )}

                                    {assigned.map(acctName => (
                                        <div key={acctName} className="flex justify-between items-center bg-slate-800/80 px-3 py-1.5 rounded border border-slate-700/50">
                                            <span className="text-sm text-slate-300">{acctName}</span>
                                            <button
                                                onClick={() => handleUnassignAccount(bank.nombre, acctName)}
                                                className="text-slate-600 hover:text-rose-400 transition-colors"
                                                title="Desasignar"
                                            >
                                                <X size={14} />
                                            </button>
                                        </div>
                                    ))}

                                    {/* Assign existing or create new */}
                                    <div className="flex gap-2 mt-1">
                                        {availableToAssign.length > 0 && (
                                            <select
                                                className="flex-1 bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-white text-xs focus:outline-none focus:border-cyan-500"
                                                defaultValue=""
                                                onChange={(e) => {
                                                    if (e.target.value) {
                                                        handleAssignAccount(bank.nombre, e.target.value);
                                                        e.target.value = '';
                                                    }
                                                }}
                                            >
                                                <option value="">+ Asignar cuenta existente...</option>
                                                {availableToAssign.map(a => (
                                                    <option key={a.id} value={a.nombre}>{a.nombre}</option>
                                                ))}
                                            </select>
                                        )}
                                        <div className="flex gap-1">
                                            <input
                                                type="text"
                                                placeholder="Nueva cuenta..."
                                                value={newAccountName}
                                                onChange={(e) => setNewAccountName(e.target.value)}
                                                onKeyDown={(e) => e.key === 'Enter' && handleAddNewAccount(bank.nombre)}
                                                className="w-32 bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-white text-xs focus:outline-none focus:border-cyan-500 placeholder-slate-600"
                                            />
                                            <button
                                                onClick={() => handleAddNewAccount(bank.nombre)}
                                                className="bg-cyan-600/30 text-cyan-400 hover:bg-cyan-600 hover:text-white px-2 rounded text-xs transition-colors"
                                                title="Crear y asignar"
                                            >
                                                <Plus size={14} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
                {banks.length === 0 && <p className="text-center text-slate-500 py-4">No hay bancos registrados.</p>}
            </div>

            {/* Add Bank Form */}
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
    );

    if (embedded) return Content;

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            {Content}
        </div>
    );
}
