import { useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import { Wallet, TrendingUp, TrendingDown, ArrowRightLeft, Building2, Settings, PieChart as PieIcon, Clock, LogOut, Trash2, Shield } from 'lucide-react';
import QuickAdd from './components/QuickAdd';
import CategoriesManager from './components/CategoriesManager';
import BanksManager from './components/BanksManager';
import AdvancedReports from './components/AdvancedReports';
import SettingsPanel from './components/SettingsPanel';
import { EnvironmentControls } from "./components/EnvironmentControls";
import Login from "./components/Login";
import { API_URL } from "./config";

function App() {
  const [transactions, setTransactions] = useState([]);
  const [banks, setBanks] = useState([]);
  const [loading, setLoading] = useState(true);

  // Auth State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [token, setToken] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState('Gasto'); // 'Ingreso' or 'Gasto'

  // Categories State
  const [isCatsOpen, setIsCatsOpen] = useState(false);
  const [isBanksOpen, setIsBanksOpen] = useState(false);

  // Reports State
  const [isReportsOpen, setIsReportsOpen] = useState(false);

  // Settings State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Check if already logged in on startup
  useEffect(() => {
    const savedToken = localStorage.getItem("token");
    if (savedToken) {
      // Verify token is still valid
      fetch(`${API_URL}/me`, {
        headers: { "Authorization": `Bearer ${savedToken}` }
      })
        .then(res => {
          if (res.ok) {
            setToken(savedToken);
            setIsAuthenticated(true);
          } else {
            localStorage.removeItem("token");
          }
        })
        .catch(() => localStorage.removeItem("token"))
        .finally(() => setCheckingAuth(false));
    } else {
      setCheckingAuth(false);
    }
  }, []);

  const handleLoginSuccess = (newToken) => {
    setToken(newToken);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    setToken(null);
    setIsAuthenticated(false);
  };

  const handleDeleteTransaction = async (txId) => {
    const password = prompt('Ingresa tu contraseña para eliminar:');
    if (!password) return;

    // Verify password is correct (simple client-side check)
    if (password !== 'fiorestzin') {
      alert('Contraseña incorrecta');
      return;
    }

    try {
      const res = await fetch(`${API_URL}/transaction/${txId}`, { method: 'DELETE' });
      if (res.ok) {
        // Refresh all data to update totals
        fetchData();
      } else {
        alert('Error al eliminar');
      }
    } catch (e) {
      console.error('Delete failed:', e);
      alert('Error al eliminar');
    }
  };

  // Current environment state
  const [currentEnv, setCurrentEnv] = useState("TEST");

  // Fetch current environment from config
  const fetchEnv = async () => {
    try {
      const res = await fetch(`${API_URL}/config`);
      if (res.ok) {
        const data = await res.json();
        setCurrentEnv(data.env || "TEST");
      }
    } catch (e) {
      console.error("Error fetching env config:", e);
    }
  };

  // Fetch data function (defined before hooks)
  const fetchData = async (env = currentEnv) => {
    try {
      const txRes = await fetch(`${API_URL}/transactions?limit=20&environment=${env}`);
      const txData = await txRes.json();
      setTransactions(txData);

      const bankRes = await fetch(`${API_URL}/summary/banks?environment=${env}`);
      const bankData = await bankRes.json();
      setBanks(bankData);

      setLoading(false);
    } catch (error) {
      console.error("Error fetching data:", error);
      setLoading(false);
    }
  };

  // useEffect for fetching data - MUST be before any early returns!
  useEffect(() => {
    const initData = async () => {
      // First get current environment
      let env = "TEST";
      try {
        const res = await fetch(`${API_URL}/config`);
        if (res.ok) {
          const data = await res.json();
          env = data.env || "TEST";
          setCurrentEnv(env);
        }
      } catch (e) {
        console.error("Error fetching env:", e);
      }
      // Then fetch data with that environment
      await fetchData(env);
    };

    if (isAuthenticated) {
      initData();
    }
  }, [isAuthenticated]);


  // --- EARLY RETURNS (after all hooks) ---
  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  const handleOpenModal = (type) => {
    setModalType(type);
    setIsModalOpen(true);
  };

  const handleSaveTransaction = async (data) => {
    try {
      // Inject current environment into the transaction data
      const payload = { ...data, environment: currentEnv };

      const res = await fetch(`${API_URL}/transaction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        // Refresh data
        fetchData();
        // Optional: Show toast success
      }
    } catch (error) {
      console.error("Error saving:", error);
    }
  };

  // Format currency
  const fmt = (num) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(num);

  if (loading) return <div className="p-10 text-white flex items-center justify-center h-screen bg-slate-900">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
      <p>Cargando tu Imperio Financiero...</p>
    </div>
  </div>;

  const totalSaldo = banks.reduce((acc, b) => acc + (b.saldo || 0), 0);

  // Prepare chart data (Last 20 transactions simplified)
  const chartData = [...transactions].reverse().map(t => ({
    name: t.detalle.substring(0, 10),
    monto: t.tipo === 'Ingreso' ? t.ingreso : -t.gasto
  }));

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">

        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-center bg-slate-800/50 p-6 rounded-2xl border border-slate-700 backdrop-blur-sm shadow-xl">
          <div className="mb-4 md:mb-0 text-center md:text-left">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 via-indigo-400 to-emerald-400 bg-clip-text text-transparent">
              Mis Finanzas
            </h1>
            <p className="text-slate-400 mt-1 flex items-center gap-2 justify-center md:justify-start">
              <Wallet size={16} /> Panel de Control Inteligente
            </p>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-center md:text-right">
              <p className="text-sm text-slate-400">Patrimonio Neto Estimado</p>
              <p className={`text-3xl font-bold ${totalSaldo >= 0 ? 'text-white' : 'text-rose-400'}`}>{fmt(totalSaldo)}</p>
            </div>

            <div className="flex gap-2 items-center">
              <EnvironmentControls />
              <button
                onClick={() => setIsReportsOpen(true)}
                className="bg-slate-700/50 hover:bg-slate-700 p-3 rounded-xl transition-colors text-slate-300 hover:text-white"
                title="Ver Reportes Avanzados"
              >
                <PieIcon size={20} />
              </button>
              <button
                onClick={() => setIsCatsOpen(true)}
                className="bg-slate-700/50 hover:bg-slate-700 p-3 rounded-xl transition-colors text-slate-300 hover:text-white"
                title="Categorías"
              >
                <Settings size={20} />
              </button>
              <button
                onClick={() => setIsBanksOpen(true)}
                className="bg-slate-700/50 hover:bg-slate-700 p-3 rounded-xl transition-colors text-slate-300 hover:text-white"
                title="Gestionar Bancos"
              >
                <Building2 size={20} />
              </button>
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="bg-amber-900/50 hover:bg-amber-800 p-3 rounded-xl transition-colors text-amber-300 hover:text-white"
                title="Configuración de Seguridad"
              >
                <Shield size={20} />
              </button>
              <button
                onClick={handleLogout}
                className="bg-red-900/50 hover:bg-red-800 p-3 rounded-xl transition-colors text-red-300 hover:text-white"
                title="Cerrar Sesión"
              >
                <LogOut size={20} />
              </button>
            </div>
          </div>
        </header>

        {/* Bank Cards */}
        <section>
          <div className="flex justify-between items-end mb-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Building2 className="text-blue-400" /> Control de Bancos
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {banks.map((bank, idx) => (
              <div key={idx} className="bg-slate-800/80 p-5 rounded-xl border border-slate-700 hover:border-blue-500/50 transition-all hover:shadow-lg hover:shadow-blue-500/5 group">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-lg text-slate-200 group-hover:text-blue-300 transition-colors">{bank.banco || "Sin Banco"}</h3>
                  <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded-full ${bank.saldo >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                    {bank.saldo >= 0 ? 'Activo' : 'Deuda'}
                  </span>
                </div>
                <div className="mt-4">
                  <p className="text-sm text-slate-500">Saldo Calculado</p>
                  <p className={`text-2xl font-bold truncate ${bank.saldo < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {fmt(bank.saldo)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Main Content Grid */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Left Column: Transactions */}
          <div className="lg:col-span-2 bg-slate-800/50 p-6 rounded-2xl border border-slate-700 shadow-xl">
            <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
              <ArrowRightLeft className="text-purple-400" /> Últimos Movimientos
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-700/50 text-xs uppercase tracking-wider">
                    <th className="pb-3 pl-2">Fecha</th>
                    <th className="pb-3">Detalle</th>
                    <th className="pb-3 hidden md:table-cell">Categoría</th>
                    <th className="pb-3 text-right">Monto</th>
                    <th className="pb-3 text-center pr-2">🗑️</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="border-b border-slate-700/30 hover:bg-slate-700/40 transition-colors group">
                      <td className="py-3 pl-2 text-slate-300 font-mono text-xs">{tx.fecha}</td>
                      <td className="py-3 font-medium text-slate-200 group-hover:text-white">{tx.detalle || "Sin detalle"}</td>
                      <td className="py-3 text-slate-500 hidden md:table-cell">
                        <span className="bg-slate-700/50 px-2 py-1 rounded text-xs">
                          {tx.categoria}
                        </span>
                      </td>
                      <td className={`py-3 text-right font-bold ${tx.ingreso > 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}>
                        {tx.ingreso > 0 ? `+ ${fmt(tx.ingreso)}` : `- ${fmt(tx.gasto)}`}
                      </td>
                      <td className="py-3 text-center pr-2">
                        <button
                          onClick={() => handleDeleteTransaction(tx.id)}
                          className="text-slate-500 hover:text-rose-400 transition-colors opacity-0 group-hover:opacity-100"
                          title="Eliminar"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right Column: Actions & Charts */}
          <div className="space-y-6">

            {/* Action Buttons */}
            <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700 shadow-xl">
              <h3 className="font-bold text-slate-300 mb-4">Acciones Rápidas</h3>
              <div className="space-y-3">
                <button
                  onClick={() => handleOpenModal('Ingreso')}
                  className="w-full bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-lg shadow-emerald-900/20 flex items-center justify-center gap-2"
                >
                  <TrendingUp size={18} /> Registrar Ingreso
                </button>
                <button
                  onClick={() => handleOpenModal('Gasto')}
                  className="w-full bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-lg shadow-rose-900/20 flex items-center justify-center gap-2"
                >
                  <TrendingDown size={18} /> Registrar Gasto
                </button>
              </div>
            </div>

            {/* Mini Chart */}
            <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700 shadow-xl h-64 flex flex-col">
              <h3 className="font-bold text-slate-300 mb-2 flex items-center gap-2">
                <TrendingUp className="text-indigo-400" size={16} /> Tendencia
              </h3>
              <div className="flex-1 w-full -ml-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorMonto" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#818cf8" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#818cf8" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} vertical={false} />
                    <XAxis dataKey="name" hide />
                    <YAxis hide />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc' }}
                      itemStyle={{ color: '#818cf8' }}
                      formatter={(val) => fmt(val)}
                      labelStyle={{ display: 'none' }}
                    />
                    <Area type="monotone" dataKey="monto" stroke="#818cf8" strokeWidth={2} fillOpacity={1} fill="url(#colorMonto)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>
        </section>

      </div >

      {/* Modal */}
      < QuickAdd
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)
        }
        onSave={handleSaveTransaction}
        type={modalType}
        environment={currentEnv}
      />

      {/* Categories Manager */}
      < CategoriesManager
        isOpen={isCatsOpen}
        onClose={() => setIsCatsOpen(false)}
        environment={currentEnv}
      />

      {/* Banks Manager */}
      <BanksManager
        isOpen={isBanksOpen}
        onClose={() => setIsBanksOpen(false)}
        environment={currentEnv}
      />

      {/* Advanced Reports */}
      <AdvancedReports
        isOpen={isReportsOpen}
        onClose={() => setIsReportsOpen(false)}
        totalNetWorth={totalSaldo}
        environment={currentEnv}
      />

      {/* Settings Panel */}
      <SettingsPanel
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        token={token}
      />
    </div >
  );
}

export default App;
