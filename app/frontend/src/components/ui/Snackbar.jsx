import { useEffect, useState } from 'react';
import { X, RotateCcw, AlertCircle, CheckCircle, Info } from 'lucide-react';
import { useSnackbar } from '../../context/SnackbarContext';

export default function Snackbar() {
    const { snackbar, hideSnackbar } = useSnackbar();
    const [progress, setProgress] = useState(100);

    useEffect(() => {
        if (!snackbar) return;

        setProgress(100);
        const startTime = Date.now();
        const endTime = startTime + snackbar.duration;

        const timer = setInterval(() => {
            const now = Date.now();
            const remaining = Math.max(0, endTime - now);
            const percentage = (remaining / snackbar.duration) * 100;

            setProgress(percentage);

            if (remaining <= 0) {
                clearInterval(timer);
                hideSnackbar();
            }
        }, 50);

        return () => clearInterval(timer);
    }, [snackbar, hideSnackbar]);

    if (!snackbar) return null;

    const handleUndo = () => {
        if (snackbar.undoAction) {
            snackbar.undoAction();
            hideSnackbar();
        }
    };

    const getIcon = () => {
        switch (snackbar.type) {
            case 'success': return <CheckCircle size={20} className="text-emerald-400" />;
            case 'error': return <AlertCircle size={20} className="text-rose-400" />;
            default: return <Info size={20} className="text-blue-400" />;
        }
    };

    return (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-5 fade-in duration-300">
            <div className="bg-slate-900 border border-slate-700 text-slate-200 px-4 py-3 rounded-lg shadow-2xl flex items-center gap-4 min-w-[320px] max-w-md relative overflow-hidden group">

                {/* Progress Bar Background */}
                <div
                    className="absolute bottom-0 left-0 h-1 bg-gradient-to-r from-emerald-500 to-blue-500 transition-all duration-75 ease-linear"
                    style={{ width: `${progress}%` }}
                />

                <div className="flex items-center gap-3 flex-1">
                    {getIcon()}
                    <span className="text-sm font-medium">{snackbar.message}</span>
                </div>

                <div className="flex items-center gap-2 pl-4 border-l border-slate-700">
                    {snackbar.undoAction && (
                        <button
                            onClick={handleUndo}
                            className="text-yellow-400 hover:text-yellow-300 text-sm font-bold flex items-center gap-1.5 px-2 py-1 rounded hover:bg-slate-800 transition-colors"
                        >
                            <RotateCcw size={14} />
                            Deshacer
                        </button>
                    )}
                    <button
                        onClick={hideSnackbar}
                        className="text-slate-500 hover:text-white p-1 rounded-full hover:bg-slate-800 transition-colors"
                    >
                        <X size={16} />
                    </button>
                </div>
            </div>
        </div>
    );
}
