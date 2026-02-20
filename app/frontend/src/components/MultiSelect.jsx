import { useState, useRef, useEffect } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';

export default function MultiSelect({
    options = [],
    selected = [],
    onChange,
    label = "Select",
    placeholder = "Buscar..."
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const containerRef = useRef(null);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filteredOptions = options.filter(opt =>
        opt.toString().toLowerCase().includes(searchTerm.toLowerCase())
    );

    const toggleOption = (option) => {
        const newSelected = selected.includes(option)
            ? selected.filter(item => item !== option)
            : [...selected, option];
        onChange(newSelected);
    };

    const handleSelectAll = () => {
        if (selected.length === options.length) {
            onChange([]); // Deselect all
        } else {
            onChange(options); // Select all
        }
    };

    return (
        <div className="relative" ref={containerRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center justify-between gap-2 bg-slate-900 border border-slate-700 hover:border-slate-500 text-white text-sm px-3 py-2 rounded-lg transition-all min-w-[160px] max-w-[220px]"
            >
                <div className="flex flex-col items-start truncate">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{label}</span>
                    <span className="truncate w-full text-left font-medium">
                        {selected.length === 0 ? 'Ninguno' :
                            selected.length === options.length ? 'Todos' :
                                `${selected.length} seleccionados`}
                    </span>
                </div>
                <ChevronDown size={16} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute top-full mt-2 left-0 w-64 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                    <div className="p-2 border-b border-slate-700/50 space-y-2 bg-slate-800/80 backdrop-blur-sm sticky top-0">
                        <div className="flex items-center bg-slate-900 px-2 py-1.5 rounded-lg border border-slate-700 focus-within:border-blue-500">
                            <Search size={14} className="text-slate-400 mr-2" />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder={placeholder}
                                className="bg-transparent text-white text-xs w-full focus:outline-none"
                                autoFocus
                            />
                            {searchTerm && (
                                <button onClick={() => setSearchTerm('')} className="text-slate-500 hover:text-white">
                                    <X size={14} />
                                </button>
                            )}
                        </div>
                        <button
                            onClick={handleSelectAll}
                            className="w-full text-xs font-semibold text-blue-400 hover:text-blue-300 hover:bg-blue-400/10 py-1.5 rounded transition-colors"
                        >
                            {selected.length === options.length ? 'Desmarcar Todos' : 'Marcar Todos'}
                        </button>
                    </div>

                    <div className="max-h-60 overflow-y-auto p-1 custom-scrollbar">
                        {filteredOptions.length > 0 ? (
                            filteredOptions.map((option) => {
                                const isSelected = selected.includes(option);
                                return (
                                    <div
                                        key={option}
                                        onClick={() => toggleOption(option)}
                                        className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors text-sm ${isSelected ? 'bg-blue-600/20 text-blue-100' : 'text-slate-300 hover:bg-slate-700'}`}
                                    >
                                        <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${isSelected ? 'bg-blue-500 border-blue-500' : 'border-slate-500'}`}>
                                            {isSelected && <Check size={12} className="text-white" />}
                                        </div>
                                        <span className="truncate">{option}</span>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="p-4 text-center text-xs text-slate-500">
                                No hay resultados
                            </div>
                        )}
                    </div>

                    <div className="p-2 border-t border-slate-700/50 text-[10px] text-center text-slate-500 bg-slate-900/50">
                        {selected.length} de {options.length} visibles
                    </div>
                </div>
            )}
        </div>
    );
}
