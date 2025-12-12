import { useState, useEffect } from 'react';
import { X, Download, TrendingUp, ArrowDownUp } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function DrillDownModal({ isOpen, onClose, title, transactions, evolutionData = [] }) {
    const [sortConfig, setSortConfig] = useState({ key: 'fecha', direction: 'desc' });

    if (!isOpen) return null;

    const fmt = (num) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(num);

    const sortedTx = [...transactions].sort((a, b) => {
        let aVal = a[sortConfig.key];
        let bVal = b[sortConfig.key];

        // Special handling for amount
        if (sortConfig.key === 'monto') {
            aVal = a.ingreso || a.gasto;
            bVal = b.ingreso || b.gasto;
        }

        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
    });

    const requestSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const downloadCSV = () => {
        const headers = ['Fecha', 'Categoria', 'Detalle', 'Banco', 'Ingreso', 'Gasto'];
        const rows = sortedTx.map(t => [
            t.fecha, t.categoria, t.detalle, t.banco, t.ingreso, t.gasto
        ]);
        const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `reporte_financiero.csv`;
        a.click();
    };

    return (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-slate-900 w-full max-w-4xl max-h-[90vh] rounded-2xl border border-slate-700 shadow-2xl flex flex-col">

                {/* Header */}
                <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-slate-800/50 rounded-t-2xl">
                    <div>
                        <h2 className="text-xl font-bold text-white">{title}</h2>
                        <p className="text-slate-400 text-sm">{transactions.length} movimientos encontrados</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={downloadCSV}
                            className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-slate-200 px-3 py-2 rounded-lg transition-colors text-sm font-medium"
                        >
                            <Download size={16} /> Exportar CSV
                        </button>
                        <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-full transition-colors text-slate-400 hover:text-white">
                            <X size={24} />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">

                    {/* Evolution Chart (Optional) */}
                    {evolutionData && evolutionData.length > 0 && (
                        <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
                            <h3 className="text-sm font-bold text-slate-400 mb-4 flex items-center gap-2">
                                <TrendingUp size={16} className="text-cyan-400" /> Evolución Mensual
                            </h3>
                            <div className="h-48 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={evolutionData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                                        <XAxis dataKey="month" stroke="#94a3b8" tick={{ fontSize: 10 }} />
                                        <YAxis stroke="#94a3b8" tickFormatter={(val) => `$${val / 1000}k`} tick={{ fontSize: 10 }} />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc' }}
                                            formatter={(val) => fmt(val)}
                                        />
                                        <Line type="monotone" dataKey="gasto" stroke="#f472b6" strokeWidth={3} dot={{ r: 3 }} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}

                    {/* Table */}
                    <div className="overflow-x-auto rounded-lg border border-slate-700">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-900/50 sticky top-0 backdrop-blur-sm">
                                <tr className="text-slate-400 font-semibold border-b border-slate-700">
                                    <th
                                        className="p-4 cursor-pointer hover:text-white transition-colors"
                                        onClick={() => requestSort('fecha')}
                                    >
                                        <div className="flex items-center gap-1">Fecha <ArrowDownUp size={14} /></div>
                                    </th>
                                    <th className="p-4">Detalle</th>
                                    <th className="p-4">Categoría</th>
                                    <th
                                        className="p-4 text-right cursor-pointer hover:text-white transition-colors"
                                        onClick={() => requestSort('monto')}
                                    >
                                        <div className="flex items-center justify-end gap-1">Monto <ArrowDownUp size={14} /></div>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700/50">
                                {sortedTx.map((tx, idx) => (
                                    <tr key={tx.id || idx} className="hover:bg-slate-700/30 transition-colors">
                                        <td className="p-4 font-mono text-slate-300">{tx.fecha}</td>
                                        <td className="p-4 text-slate-200">
                                            <div className="font-medium">{tx.detalle || 'Sin detalle'}</div>
                                            <div className="text-xs text-slate-500">{tx.banco}</div>
                                        </td>
                                        <td className="p-4 text-slate-400">
                                            <span className="bg-slate-700/50 px-2 py-1 rounded text-xs border border-slate-600">
                                                {tx.categoria}
                                            </span>
                                        </td>
                                        <td className={`p-4 text-right font-bold ${tx.ingreso > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                            {tx.ingreso > 0 ? `+ ${fmt(tx.ingreso)}` : `- ${fmt(tx.gasto)}`}
                                        </td>
                                    </tr>
                                ))}
                                {sortedTx.length === 0 && (
                                    <tr>
                                        <td colSpan="4" className="p-8 text-center text-slate-500">
                                            No se encontraron movimientos para esta selección.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
