import { X, AlertCircle, Calendar, Hash, DollarSign } from 'lucide-react';

export default function SubscriptionsModal({ isOpen, onClose, subscriptions }) {
    if (!isOpen) return null;

    const fmt = (num) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(num);

    const totalPaid = subscriptions.reduce((acc, sub) => acc + (sub.total_paid || 0), 0);

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl flex flex-col max-h-[90vh] shadow-2xl">

                {/* Header */}
                <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-gradient-to-r from-purple-900/30 to-slate-800/50 rounded-t-2xl">
                    <div>
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <AlertCircle className="text-purple-400" /> Detector de Suscripciones
                        </h2>
                        <p className="text-slate-400 text-sm">Gastos recurrentes detectados (3+ meses)</p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors p-2 hover:bg-slate-700 rounded-lg">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">

                    {/* Summary Card */}
                    <div className="bg-gradient-to-r from-purple-600/20 to-indigo-600/20 border border-purple-500/30 p-5 rounded-xl flex items-center justify-between">
                        <div>
                            <p className="text-purple-300 font-medium">Total Pagado</p>
                            <p className="text-xs text-purple-400/70">Suma real de los registros detectados</p>
                        </div>
                        <div className="text-2xl font-bold text-purple-300">
                            {fmt(totalPaid)}
                        </div>
                    </div>

                    <div className="space-y-3">
                        {subscriptions.map((sub, idx) => (
                            <div key={idx} className="bg-slate-800/60 p-4 rounded-xl border border-slate-700/50 hover:border-purple-500/30 transition-colors">
                                <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                        <h4 className="font-bold text-slate-100 text-lg">{sub.name}</h4>
                                        <div className="flex flex-wrap gap-2 mt-2">
                                            <span className="bg-slate-700/80 px-2 py-1 rounded-md text-xs text-emerald-300 flex items-center gap-1">
                                                <DollarSign size={12} />
                                                ~{fmt(sub.amount)} promedio
                                            </span>
                                            <span className="bg-slate-700/80 px-2 py-1 rounded-md text-xs text-cyan-300 flex items-center gap-1">
                                                <Hash size={12} />
                                                {sub.frequency} pagos
                                            </span>
                                            <span className="bg-slate-700/80 px-2 py-1 rounded-md text-xs text-amber-300 flex items-center gap-1">
                                                <Calendar size={12} />
                                                {sub.distinct_months} meses
                                            </span>
                                        </div>
                                    </div>
                                    <div className="text-right ml-4">
                                        <p className="font-bold text-xl text-purple-300">{fmt(sub.total_paid || 0)}</p>
                                        <p className="text-[10px] text-slate-500 uppercase">Total Pagado</p>
                                    </div>
                                </div>
                            </div>
                        ))}

                        {subscriptions.length === 0 && (
                            <div className="text-center py-12 text-slate-500">
                                <AlertCircle className="mx-auto mb-3 text-slate-600" size={40} />
                                <p>No hemos detectado patrones de suscripción claros aún.</p>
                                <p className="text-sm mt-1">Necesitamos al menos 3 meses de datos.</p>
                            </div>
                        )}
                    </div>

                </div>
            </div>
        </div>
    );
}
