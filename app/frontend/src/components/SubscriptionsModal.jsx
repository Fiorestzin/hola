import { X, AlertCircle } from 'lucide-react';

export default function SubscriptionsModal({ isOpen, onClose, subscriptions }) {
    if (!isOpen) return null;

    const fmt = (num) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(num);

    const totalAnnual = subscriptions.reduce((acc, sub) => acc + sub.annual_cost, 0);

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl flex flex-col max-h-[90vh] shadow-2xl">

                {/* Header */}
                <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-slate-800/50 rounded-t-2xl">
                    <div>
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <AlertCircle className="text-purple-400" /> Detector de Suscripciones
                        </h2>
                        <p className="text-slate-400 text-sm">Gastos recurrentes detectados automáticamente</p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors p-2 hover:bg-slate-700 rounded-lg">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">

                    {/* Summary Card */}
                    <div className="bg-purple-500/10 border border-purple-500/30 p-4 rounded-xl flex items-center justify-between">
                        <div>
                            <p className="text-purple-300 font-medium">Costo Anual Estimado</p>
                            <p className="text-xs text-purple-400/70">Solo de lo detectado aquí</p>
                        </div>
                        <div className="text-2xl font-bold text-purple-300">
                            {fmt(totalAnnual)}
                        </div>
                    </div>

                    <div className="space-y-3">
                        {subscriptions.map((sub, idx) => (
                            <div key={idx} className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50 flex justify-between items-center">
                                <div>
                                    <h4 className="font-bold text-slate-200">{sub.name}</h4>
                                    <div className="flex gap-3 text-xs text-slate-400 mt-1">
                                        <span className="bg-slate-700 px-2 py-0.5 rounded text-slate-300">
                                            {fmt(sub.amount)} / mes
                                        </span>
                                        <span>
                                            Detectado {sub.frequency} veces
                                        </span>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="font-bold text-slate-300">{fmt(sub.annual_cost)}</p>
                                    <p className="text-[10px] text-slate-500 uppercase">Anual</p>
                                </div>
                            </div>
                        ))}

                        {subscriptions.length === 0 && (
                            <div className="text-center py-12 text-slate-500">
                                No hemos detectado patrones de suscripción claros aún.
                            </div>
                        )}
                    </div>

                </div>
            </div>
        </div>
    );
}
