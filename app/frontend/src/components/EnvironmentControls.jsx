import { useState, useEffect } from "react";
import { AlertTriangle, Settings, RefreshCw, Trash2, CheckCircle } from "lucide-react";
import { API_URL } from "../config";

export function EnvironmentControls() {
    const [config, setConfig] = useState({ env: "LOADING", db: "" });
    const [isOpen, setIsOpen] = useState(false);
    const [resetPhrase, setResetPhrase] = useState("");
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState(null);

    const fetchConfig = async () => {
        try {
            const res = await fetch(`${API_URL}/config`);
            if (res.ok) {
                const data = await res.json();
                setConfig(data);
            }
        } catch (e) {
            console.error("Error fetching config", e);
        }
    };

    useEffect(() => {
        fetchConfig();
    }, []);

    const handleSwitch = async () => {
        const targetEnv = config.env === "TEST" ? "PROD" : "TEST";
        if (!confirm(`¿Cambiar a entorno ${targetEnv}?`)) return;

        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/config/switch`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ env: targetEnv }),
            });
            if (res.ok) {
                await fetchConfig();
                window.location.reload(); // Refresh to clear frontend state if needed
            }
        } catch (e) {
            alert("Error switching environment");
        } finally {
            setLoading(false);
        }
    };

    const handleReset = async () => {
        if (resetPhrase !== "fiorestzin") {
            alert("Frase de confirmación incorrecta.");
            return;
        }

        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/config/reset`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ confirmation: resetPhrase }),
            });

            if (res.ok) {
                setMessage({ type: "success", text: "¡Datos eliminados correctamente!" });
                setResetPhrase("");
                window.location.reload();
            } else {
                const err = await res.json();
                setMessage({ type: "error", text: err.detail || "Error al reiniciar" });
            }
        } catch (e) {
            setMessage({ type: "error", text: "Error de conexión" });
        } finally {
            setLoading(false);
        }
    };

    const isProd = config.env === "PROD";
    const badgeColor = isProd ? "bg-blue-600" : "bg-red-600";
    const badgeText = isProd ? "💼 MODO REAL" : "🛠️ MODO PRUEBA";

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                className={`${badgeColor} text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 hover:opacity-90 transition-opacity`}
            >
                {isProd ? <CheckCircle size={12} /> : <Settings size={12} />}
                {badgeText}
            </button>

            {isOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
                    <div className="bg-[#1e293b] p-6 rounded-2xl w-full max-w-md shadow-2xl border border-slate-700">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                <Settings className="text-blue-400" /> Configuración de Entorno
                            </h2>
                            <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-white">✕</button>
                        </div>

                        <div className="space-y-6">
                            {/* CURRENT STATUS */}
                            <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                                <p className="text-slate-400 text-sm mb-1">Entorno Actual</p>
                                <div className="flex justify-between items-center">
                                    <span className={`text-lg font-bold ${isProd ? "text-blue-400" : "text-red-400"}`}>
                                        {badgeText}
                                    </span>
                                    <span className="text-xs text-slate-500 font-mono">{config.db}</span>
                                </div>
                            </div>

                            {/* ACTION: SWITCH */}
                            <button
                                onClick={handleSwitch}
                                disabled={loading}
                                className="w-full bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-xl flex items-center justify-center gap-2 transition-colors"
                            >
                                <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
                                Cambiar a {isProd ? "MODO PRUEBA" : "MODO REAL"}
                            </button>

                            <hr className="border-slate-700" />

                            {/* ACTION: RESET */}
                            <div className="space-y-2">
                                <h3 className="text-red-400 font-bold flex items-center gap-2">
                                    <AlertTriangle size={18} /> Zona de Peligro
                                </h3>
                                <p className="text-slate-400 text-sm">
                                    Esto borrará <strong>todas las transacciones y presupuestos</strong> del entorno actual.
                                    Las categorías se mantendrán.
                                </p>

                                <input
                                    type="text"
                                    placeholder='Escribe "fiorestzin" para confirmar'
                                    value={resetPhrase}
                                    onChange={(e) => setResetPhrase(e.target.value)}
                                    className="w-full bg-slate-900 border border-red-900/50 text-white px-4 py-2 rounded-lg focus:outline-none focus:border-red-500 placeholder-slate-600"
                                />

                                <button
                                    onClick={handleReset}
                                    disabled={loading || resetPhrase !== "fiorestzin"}
                                    className={`w-full py-3 rounded-xl flex items-center justify-center gap-2 transition-colors font-bold ${resetPhrase === "fiorestzin"
                                        ? "bg-red-600 hover:bg-red-700 text-white cursor-pointer"
                                        : "bg-slate-800 text-slate-500 cursor-not-allowed"
                                        }`}
                                >
                                    <Trash2 size={18} />
                                    ELIMINAR DATOS (RESET)
                                </button>
                            </div>

                            {message && (
                                <div className={`p-3 rounded-lg text-sm text-center ${message.type === 'success' ? 'bg-green-900/50 text-green-300' : 'bg-red-900/50 text-red-300'}`}>
                                    {message.text}
                                </div>
                            )}

                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
