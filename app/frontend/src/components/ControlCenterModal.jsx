import { useState, useEffect } from 'react';
import { X, Globe, Building2, Tag, Shield, Monitor, MapPin, Menu, User, Database, Replace } from 'lucide-react';
import { useSnackbar } from '../context/SnackbarContext';
import BanksManager from './BanksManager';
import AccountsManager from './AccountsManager';
import CategoriesManager from './CategoriesManager';
import SettingsPanel from './SettingsPanel';
import AccountMigratorModal from './AccountMigratorModal';

export default function ControlCenterModal({ isOpen, onClose, timeZone, setTimeZone, token, onCategoryChange }) {
    if (!isOpen) return null;

    const [activeTab, setActiveTab] = useState('general');
    const { showSnackbar } = useSnackbar();
    const [isMigratorOpen, setIsMigratorOpen] = useState(false);

    // Time Zone Logic (from old SettingsModal)
    const [detectedZone, setDetectedZone] = useState('');
    useEffect(() => {
        try {
            const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
            setDetectedZone(zone);
        } catch (e) {
            console.error("Error detecting time zone:", e);
        }
    }, []);

    const handleDetectTimeZone = () => {
        if (detectedZone) {
            setTimeZone(detectedZone);
            showSnackbar(`Zona horaria detectada: ${detectedZone}`, 'success');
        }
    };

    const commonTimeZones = [
        "America/Santiago",
        "America/Argentina/Buenos_Aires",
        "America/Bogota",
        "America/Lima",
        "America/Mexico_City",
        "America/New_York",
        "Europe/Madrid",
        "Europe/London",
        "UTC"
    ];

    // Sidebar Items
    const menuItems = [
        { id: 'general', label: 'General', icon: Globe, color: 'text-blue-400' },
        { id: 'banks', label: 'Bancos', icon: Building2, color: 'text-emerald-400' },
        { id: 'accounts', label: 'Tipos de Cuenta', icon: Database, color: 'text-purple-400' },
        { id: 'categories', label: 'Categorías', icon: Tag, color: 'text-indigo-400' },
        { id: 'security', label: 'Seguridad', icon: Shield, color: 'text-rose-400' },
        { id: 'data', label: 'Datos y Respaldo', icon: Database, color: 'text-amber-400' },
    ];

    // Render Content based on active tab
    const renderContent = () => {
        switch (activeTab) {
            case 'general':
                return (
                    <div className="space-y-6 animate-fadeIn">
                        <div className="flex items-center gap-3 border-b border-slate-700 pb-4">
                            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                                <Globe className="text-blue-400" /> General
                            </h2>
                        </div>

                        {/* Time Zone Section */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 text-blue-300 font-medium">
                                <MapPin size={18} />
                                <h3>Zona Horaria</h3>
                            </div>
                            <p className="text-sm text-slate-400">
                                Define la zona horaria para registrar tus movimientos y calculos de fechas.
                            </p>

                            <div className="bg-slate-900/50 p-5 rounded-xl border border-slate-700 space-y-4">
                                <div>
                                    <label className="block text-xs text-slate-500 mb-2 uppercase font-bold tracking-wider">Zona Actual</label>
                                    <select
                                        value={timeZone}
                                        onChange={(e) => setTimeZone(e.target.value)}
                                        className="w-full bg-slate-800 border border-slate-600 rounded-lg p-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
                                    >
                                        {commonTimeZones.map(tz => (
                                            <option key={tz} value={tz}>{tz}</option>
                                        ))}
                                        {!commonTimeZones.includes(timeZone) && <option value={timeZone}>{timeZone}</option>}
                                    </select>
                                </div>

                                <button
                                    onClick={handleDetectTimeZone}
                                    className="w-full flex items-center justify-center gap-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 py-3 rounded-lg text-sm transition-all hover:scale-[1.01]"
                                >
                                    <Monitor size={16} />
                                    Detectar Automáticamente ({detectedZone})
                                </button>
                            </div>

                            <div className="text-xs text-slate-500 text-center bg-slate-800/50 p-2 rounded">
                                Fecha actual en tu zona: {new Date().toLocaleDateString('es-CL', { timeZone: timeZone, weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </div>
                        </div>
                    </div>
                );

            case 'banks':
                return <BanksManager embedded={true} environment="TEST" />;

            case 'accounts':
                return <AccountsManager embedded={true} environment="TEST" />;

            case 'categories':
                return <CategoriesManager embedded={true} environment="TEST" onCategoryChange={onCategoryChange} />;

            case 'security':
                return <SettingsPanel embedded={true} token={token} />;

            case 'data':
                return (
                    <div className="flex flex-col items-center justify-center p-8 text-slate-400 space-y-6">
                        <Database size={64} className="opacity-20 text-amber-500" />
                        <div className="text-center max-w-md">
                            <h3 className="text-xl font-bold text-white mb-2">Herramientas de Datos (PROD & TEST)</h3>
                            <p className="text-sm">Gestión avanzada de historial y exportación.</p>
                        </div>

                        <div className="w-full max-w-sm space-y-3">
                            <button
                                onClick={() => setIsMigratorOpen(true)}
                                className="w-full bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 border border-amber-500/30 py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all"
                            >
                                <Replace size={18} /> Reasignar Cuentas Masivamente
                            </button>

                            <button className="w-full bg-slate-800 border border-slate-700 text-slate-500 py-3 px-4 rounded-xl flex items-center justify-center gap-2 cursor-not-allowed">
                                Próximamente: Importar CSV
                            </button>
                        </div>

                        <AccountMigratorModal
                            isOpen={isMigratorOpen}
                            onClose={() => setIsMigratorOpen(false)}
                            environment="TEST" // Default unless parameterized later
                            onMigrationComplete={() => showSnackbar("Migración de cuentas completada", "success")}
                        />
                    </div>
                );

            default:
                return null;
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[60] p-4 md:p-8 animate-fadeIn">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-5xl h-[85vh] shadow-2xl overflow-hidden flex flex-col md:flex-row">

                {/* Sidebar */}
                <div className="w-full md:w-64 bg-slate-900/50 border-r border-slate-700 flex flex-col">
                    <div className="p-6 border-b border-slate-700/50">
                        <h2 className="text-xl font-bold text-white flex items-center gap-3">
                            <div className="bg-gradient-to-br from-cyan-500 to-blue-600 p-2 rounded-lg">
                                <User size={20} className="text-white" />
                            </div>
                            Ajustes
                        </h2>
                    </div>

                    <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                        {menuItems.map((item) => {
                            const Icon = item.icon;
                            const isActive = activeTab === item.id;
                            return (
                                <button
                                    key={item.id}
                                    onClick={() => setActiveTab(item.id)}
                                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group text-left ${isActive
                                        ? 'bg-slate-700 text-white shadow-lg shadow-black/20'
                                        : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                                        }`}
                                >
                                    <Icon size={20} className={`${isActive ? item.color : 'text-slate-500 group-hover:text-slate-300'} transition-colors`} />
                                    <span className="font-medium">{item.label}</span>
                                    {isActive && <div className="ml-auto w-1 h-1 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.8)]"></div>}
                                </button>
                            );
                        })}
                    </nav>

                    <div className="p-4 border-t border-slate-700/50">
                        <button onClick={onClose} className="w-full flex items-center justify-center gap-2 text-slate-400 hover:text-white hover:bg-slate-800 p-2 rounded-lg transition-colors text-sm">
                            <X size={16} /> Cerrar
                        </button>
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 bg-slate-800/50 flex flex-col min-w-0">
                    {/* Mobile Header (only visible on small screens) */}
                    <div className="md:hidden p-4 border-b border-slate-700 flex justify-between items-center bg-slate-900">
                        <span className="font-bold text-slate-200">Menú</span>
                        <button onClick={onClose}><X className="text-slate-400" /></button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 md:p-8">
                        {renderContent()}
                    </div>
                </div>

            </div>
        </div>
    );
}
