import { useState } from 'react';
import { X, Key, Shield, Eye, EyeOff, Save, AlertCircle } from 'lucide-react';
import { API_URL } from "../config";

export default function SettingsPanel({ isOpen, onClose, token }) {
    // Password change form
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPasswords, setShowPasswords] = useState(false);
    const [passwordMessage, setPasswordMessage] = useState({ type: '', text: '' });
    const [passwordLoading, setPasswordLoading] = useState(false);

    // Delete phrase change form
    const [currentPhrase, setCurrentPhrase] = useState('');
    const [newPhrase, setNewPhrase] = useState('');
    const [confirmPhrase, setConfirmPhrase] = useState('');
    const [phraseMessage, setPhraseMessage] = useState({ type: '', text: '' });
    const [phraseLoading, setPhraseLoading] = useState(false);

    const handlePasswordChange = async (e) => {
        e.preventDefault();
        setPasswordMessage({ type: '', text: '' });

        if (newPassword !== confirmPassword) {
            setPasswordMessage({ type: 'error', text: 'Las contraseñas nuevas no coinciden' });
            return;
        }

        if (newPassword.length < 4) {
            setPasswordMessage({ type: 'error', text: 'La contraseña debe tener al menos 4 caracteres' });
            return;
        }

        setPasswordLoading(true);
        try {
            const res = await fetch(`${API_URL}/settings/change-password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    current_password: currentPassword,
                    new_password: newPassword
                })
            });

            const data = await res.json();

            if (res.ok) {
                setPasswordMessage({ type: 'success', text: '¡Contraseña actualizada! Deberás usarla la próxima vez que inicies sesión.' });
                setCurrentPassword('');
                setNewPassword('');
                setConfirmPassword('');
            } else {
                setPasswordMessage({ type: 'error', text: data.detail || 'Error al cambiar contraseña' });
            }
        } catch (error) {
            setPasswordMessage({ type: 'error', text: 'Error de conexión' });
        } finally {
            setPasswordLoading(false);
        }
    };

    const handlePhraseChange = async (e) => {
        e.preventDefault();
        setPhraseMessage({ type: '', text: '' });

        if (newPhrase !== confirmPhrase) {
            setPhraseMessage({ type: 'error', text: 'Las frases nuevas no coinciden' });
            return;
        }

        if (newPhrase.length < 3) {
            setPhraseMessage({ type: 'error', text: 'La frase debe tener al menos 3 caracteres' });
            return;
        }

        setPhraseLoading(true);
        try {
            const res = await fetch(`${API_URL}/settings/change-delete-phrase`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    current_phrase: currentPhrase,
                    new_phrase: newPhrase
                })
            });

            const data = await res.json();

            if (res.ok) {
                setPhraseMessage({ type: 'success', text: '¡Frase de confirmación actualizada!' });
                setCurrentPhrase('');
                setNewPhrase('');
                setConfirmPhrase('');
            } else {
                setPhraseMessage({ type: 'error', text: data.detail || 'Error al cambiar frase' });
            }
        } catch (error) {
            setPhraseMessage({ type: 'error', text: 'Error de conexión' });
        } finally {
            setPhraseLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="p-4 flex justify-between items-center bg-slate-700/50 border-b border-slate-700">
                    <h2 className="font-bold text-xl flex items-center gap-2 text-amber-400">
                        <Shield size={20} /> Configuración de Seguridad
                    </h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                        <X />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-5 space-y-6">

                    {/* Password Change Section */}
                    <form onSubmit={handlePasswordChange} className="space-y-4">
                        <div className="flex items-center gap-2 text-slate-200 font-semibold">
                            <Key size={16} className="text-blue-400" />
                            Cambiar Contraseña de Login
                        </div>

                        <div className="space-y-3">
                            <div className="relative">
                                <input
                                    type={showPasswords ? "text" : "password"}
                                    placeholder="Contraseña actual"
                                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                                    value={currentPassword}
                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                    required
                                />
                            </div>
                            <input
                                type={showPasswords ? "text" : "password"}
                                placeholder="Nueva contraseña"
                                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                required
                            />
                            <input
                                type={showPasswords ? "text" : "password"}
                                placeholder="Confirmar nueva contraseña"
                                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                            />
                        </div>

                        <div className="flex items-center justify-between">
                            <button
                                type="button"
                                onClick={() => setShowPasswords(!showPasswords)}
                                className="text-sm text-slate-400 hover:text-white flex items-center gap-1"
                            >
                                {showPasswords ? <EyeOff size={14} /> : <Eye size={14} />}
                                {showPasswords ? 'Ocultar' : 'Mostrar'}
                            </button>
                            <button
                                type="submit"
                                disabled={passwordLoading}
                                className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
                            >
                                <Save size={16} />
                                {passwordLoading ? 'Guardando...' : 'Guardar'}
                            </button>
                        </div>

                        {passwordMessage.text && (
                            <div className={`p-3 rounded-lg text-sm flex items-center gap-2 ${passwordMessage.type === 'error'
                                    ? 'bg-rose-900/50 text-rose-300 border border-rose-700'
                                    : 'bg-emerald-900/50 text-emerald-300 border border-emerald-700'
                                }`}>
                                <AlertCircle size={14} />
                                {passwordMessage.text}
                            </div>
                        )}
                    </form>

                    <hr className="border-slate-700" />

                    {/* Delete Phrase Change Section */}
                    <form onSubmit={handlePhraseChange} className="space-y-4">
                        <div className="flex items-center gap-2 text-slate-200 font-semibold">
                            <Shield size={16} className="text-rose-400" />
                            Cambiar Frase de Eliminación
                        </div>
                        <p className="text-xs text-slate-400">
                            Esta frase se requiere para confirmar la eliminación de movimientos. Por defecto: "fiorestzin"
                        </p>

                        <div className="space-y-3">
                            <input
                                type="text"
                                placeholder="Frase actual"
                                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
                                value={currentPhrase}
                                onChange={(e) => setCurrentPhrase(e.target.value)}
                                required
                            />
                            <input
                                type="text"
                                placeholder="Nueva frase"
                                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
                                value={newPhrase}
                                onChange={(e) => setNewPhrase(e.target.value)}
                                required
                            />
                            <input
                                type="text"
                                placeholder="Confirmar nueva frase"
                                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
                                value={confirmPhrase}
                                onChange={(e) => setConfirmPhrase(e.target.value)}
                                required
                            />
                        </div>

                        <div className="flex justify-end">
                            <button
                                type="submit"
                                disabled={phraseLoading}
                                className="bg-rose-600 hover:bg-rose-500 disabled:bg-slate-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
                            >
                                <Save size={16} />
                                {phraseLoading ? 'Guardando...' : 'Guardar'}
                            </button>
                        </div>

                        {phraseMessage.text && (
                            <div className={`p-3 rounded-lg text-sm flex items-center gap-2 ${phraseMessage.type === 'error'
                                    ? 'bg-rose-900/50 text-rose-300 border border-rose-700'
                                    : 'bg-emerald-900/50 text-emerald-300 border border-emerald-700'
                                }`}>
                                <AlertCircle size={14} />
                                {phraseMessage.text}
                            </div>
                        )}
                    </form>

                </div>
            </div>
        </div>
    );
}
