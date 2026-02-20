import { useState, useEffect } from 'react';
import { X, Plus, Trash2, Tag, Pencil, Check, XCircle } from 'lucide-react';
import { API_URL } from "../config";

export default function CategoriesManager({ isOpen, onClose, environment = "TEST", onCategoryChange, embedded = false }) {
    const [categories, setCategories] = useState([]);
    const [newCat, setNewCat] = useState('');
    const [newType, setNewType] = useState('Gasto');

    // Edit state
    const [editingId, setEditingId] = useState(null);
    const [editName, setEditName] = useState('');
    const [editType, setEditType] = useState('');

    useEffect(() => {
        if (isOpen || embedded) fetchCategories();
    }, [isOpen, environment, embedded]);

    const fetchCategories = async () => {
        try {
            const res = await fetch(`${API_URL}/categories?environment=${environment}`);
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
                body: JSON.stringify({ nombre: newCat, tipo: newType, environment })
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

    const handleStartEdit = (cat) => {
        setEditingId(cat.id);
        setEditName(cat.nombre);
        setEditType(cat.tipo);
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        setEditName('');
        setEditType('');
    };

    const handleSaveEdit = async () => {
        if (!editName.trim()) return;

        try {
            const res = await fetch(`${API_URL}/categories/${editingId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nombre: editName, tipo: editType })
            });
            if (res.ok) {
                setEditingId(null);
                setEditName('');
                setEditType('');
                fetchCategories();
                if (onCategoryChange) onCategoryChange();
            }
        } catch (error) {
            console.error("Error updating category:", error);
        }
    };

    if (!isOpen && !embedded) return null;

    const Content = (
        <div className={`${embedded ? 'h-full flex flex-col' : 'bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[80vh]'}`}>

            {/* Header */}
            <div className={`p-4 flex justify-between items-center border-b border-slate-700 ${embedded ? '' : 'bg-slate-700/50'}`}>
                <h2 className="font-bold text-xl flex items-center gap-2 text-indigo-400">
                    <Tag size={20} /> Gestionar Categorías
                </h2>
                {!embedded && (
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                        <X />
                    </button>
                )}
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {categories.map((cat) => (
                    <div key={cat.id} className="flex justify-between items-center bg-slate-900/50 p-3 rounded-lg border border-slate-700/50 hover:border-slate-600 transition-colors">
                        {editingId === cat.id ? (
                            /* Edit Mode */
                            <div className="flex-1 flex items-center gap-2">
                                <select
                                    className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-white text-sm"
                                    value={editType}
                                    onChange={(e) => setEditType(e.target.value)}
                                >
                                    <option value="Gasto">Gasto</option>
                                    <option value="Ingreso">Ingreso</option>
                                </select>
                                <input
                                    type="text"
                                    className="flex-1 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-white text-sm focus:outline-none focus:border-indigo-500"
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                    autoFocus
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleSaveEdit();
                                        if (e.key === 'Escape') handleCancelEdit();
                                    }}
                                />
                                <button
                                    onClick={handleSaveEdit}
                                    className="text-emerald-400 hover:text-emerald-300 p-1 transition-colors"
                                    title="Guardar"
                                >
                                    <Check size={18} />
                                </button>
                                <button
                                    onClick={handleCancelEdit}
                                    className="text-slate-400 hover:text-rose-400 p-1 transition-colors"
                                    title="Cancelar"
                                >
                                    <XCircle size={18} />
                                </button>
                            </div>
                        ) : (
                            /* View Mode */
                            <>
                                <div className="flex items-center gap-3">
                                    <span className={`w-2 h-2 rounded-full ${cat.tipo === 'Ingreso' ? 'bg-emerald-400' : 'bg-rose-400'}`}></span>
                                    <span className="text-slate-200">{cat.nombre}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => handleStartEdit(cat)}
                                        className="text-slate-500 hover:text-indigo-400 p-2 transition-colors"
                                        title="Editar"
                                    >
                                        <Pencil size={16} />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(cat.id)}
                                        className="text-slate-500 hover:text-rose-400 p-2 transition-colors"
                                        title="Eliminar"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </>
                        )}
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
    );

    if (embedded) return Content;

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            {Content}
        </div>
    );
}
