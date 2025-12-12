import { useState, useEffect } from 'react';
import { X, Plus, Trash2, Tag } from 'lucide-react';
import { API_URL } from "../config";

export default function CategoriesManager({ isOpen, onClose }) {
    const [categories, setCategories] = useState([]);
    const [newCat, setNewCat] = useState('');
    const [newType, setNewType] = useState('Gasto');

    useEffect(() => {
        if (isOpen) fetchCategories();
    }, [isOpen]);

    const fetchCategories = async () => {
        try {
            const res = await fetch(`${API_URL}/categories`);
            if (res.ok) {
                const data = await res.json();
                setCategories(data);
            }
        } catch (error) {
            console.error("Error loading categories:", error);
        }
    };

    const handleAdd = async (e) => {
        e.preventDefault();
        if (!newCat.trim()) return;

        try {
            const res = await fetch(`${API_URL}/categories`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nombre: newCat, tipo: newType })
            });
            if (res.ok) {
                setNewCat('');
                fetchCategories();
            }
        } catch (error) {
            console.error("Error adding category:", error);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('¿Seguro que quieres eliminar esta categoría?')) return;
        try {
            const res = await fetch(`${API_URL}/categories/${id}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                fetchCategories();
            }
        } catch (error) {
            console.error("Error deleting category:", error);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">

                {/* Header */}
                <div className="p-4 flex justify-between items-center bg-slate-700/50 border-b border-slate-700">
                    <h2 className="font-bold text-xl flex items-center gap-2 text-indigo-400">
                        <Tag size={20} /> Gestionar Categorías
                    </h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                        <X />
                    </button>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {categories.map((cat) => (
                        <div key={cat.id} className="flex justify-between items-center bg-slate-900/50 p-3 rounded-lg border border-slate-700/50 hover:border-slate-600 transition-colors">
                            <div className="flex items-center gap-3">
                                <span className={`w-2 h-2 rounded-full ${cat.tipo === 'Ingreso' ? 'bg-emerald-400' : 'bg-rose-400'}`}></span>
                                <span className="text-slate-200">{cat.nombre}</span>
                            </div>
                            <button
                                onClick={() => handleDelete(cat.id)}
                                className="text-slate-500 hover:text-rose-400 p-2 transition-colors"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    ))}
                    {categories.length === 0 && <p className="text-center text-slate-500 py-4">No hay categorías aun.</p>}
                </div>

                {/* Add Form */}
                <form onSubmit={handleAdd} className="p-4 bg-slate-700/30 border-t border-slate-700 flex gap-2">
                    <select
                        className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
                        value={newType}
                        onChange={(e) => setNewType(e.target.value)}
                    >
                        <option value="Gasto">Gasto</option>
                        <option value="Ingreso">Ingreso</option>
                    </select>
                    <input
                        type="text"
                        className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                        placeholder="Nueva categoría..."
                        value={newCat}
                        onChange={(e) => setNewCat(e.target.value)}
                    />
                    <button
                        type="submit"
                        className="bg-indigo-600 hover:bg-indigo-500 text-white p-2 rounded-lg transition-colors"
                    >
                        <Plus size={20} />
                    </button>
                </form>

            </div>
        </div>
    );
}
