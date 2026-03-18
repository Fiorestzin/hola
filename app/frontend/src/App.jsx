import { useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Wallet, TrendingUp, TrendingDown, ArrowRightLeft, Building2, Settings, PieChart as PieIcon, Clock, LogOut, Trash2, Shield, PiggyBank, Target, Pencil, Eye, EyeOff, User } from 'lucide-react';
import { useSnackbar } from './context/SnackbarContext';
import QuickAdd from './components/QuickAdd';
import BudgetManager from './components/BudgetManager';
import AdvancedReports from './components/AdvancedReports';
import TransferModal from './components/TransferModal';
import SavingsGoalsModal from './components/SavingsGoalsModal';
import SavingsMigratorModal from './components/SavingsMigratorModal';
import EditTransactionModal from './components/EditTransactionModal';
import BankDetailsModal from './components/BankDetailsModal';
import ControlCenterModal from './components/ControlCenterModal'; // Consolidated Settings
import Login from "./components/Login";
import { API_URL, APP_ENV } from "./config";

function App() {
  const [transactions, setTransactions] = useState([]);
  const [banks, setBanks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [savingsSummary, setSavingsSummary] = useState({ total_ahorrado: 0, num_metas: 0 });
  const [savingsByBank, setSavingsByBank] = useState({}); // {banco: monto_aportado}
  const [savingsByBankAcct, setSavingsByBankAcct] = useState({}); // {banco|cuenta: monto_aportado}
  const [pendingByBank, setPendingByBank] = useState({}); // {banco: monto_pendiente_reponer}
  const [upcomingItems, setUpcomingItems] = useState([]); // Array of pending budget items
  const [budgetByBank, setBudgetByBank] = useState({}); // {banco: monto_presupuestado_pendiente}
  const [budgetByBankAcct, setBudgetByBankAcct] = useState({}); // {"banco|cuenta": monto}
  const [totalBudgetPending, setTotalBudgetPending] = useState(0); // Total presupuesto pendiente mes actual

  // Auth State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [token, setToken] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState('Gasto'); // 'Ingreso' or 'Gasto'
  const [modalInitialData, setModalInitialData] = useState(null); // Para prellenar desde presupuestos


  // Categories & Banks State (Now handled inside Control Center, but we might keep specific open states if needed for shortcuts, lets remove them for now to strictly follow plan)
  // const [isCatsOpen, setIsCatsOpen] = useState(false); // REMOVED
  // const [isBanksOpen, setIsBanksOpen] = useState(false); // REMOVED

  // Reports State
  const [isReportsOpen, setIsReportsOpen] = useState(false);

  // Settings State (Unified Control Center)
  const [isControlCenterOpen, setIsControlCenterOpen] = useState(false);

  // Transfer State
  const [isTransferOpen, setIsTransferOpen] = useState(false);

  // Savings Goals State
  const [isSavingsOpen, setIsSavingsOpen] = useState(false);

  // Budget State
  const [isBudgetOpen, setIsBudgetOpen] = useState(false);

  // Edit Transaction State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(null);

  // Bank Details State
  const [isBankDetailsOpen, setIsBankDetailsOpen] = useState(false);
  const [selectedBank, setSelectedBank] = useState(null);
  const [expandedBanks, setExpandedBanks] = useState([]);

  // Savings Migrator State
  const [isMigratorOpen, setIsMigratorOpen] = useState(false);
  const [migratorSourceBank, setMigratorSourceBank] = useState(null);

  // Privacy Mode State
  const [isPrivacyMode, setIsPrivacyMode] = useState(() => {
    const saved = localStorage.getItem('privacy_mode');
    return saved === 'true';
  });
  const [hiddenBanks, setHiddenBanks] = useState(() => {
    const saved = localStorage.getItem('hidden_banks');
    return saved ? JSON.parse(saved) : [];
  });

  // Time Zone State
  const [timeZone, setTimeZone] = useState(() => {
    return localStorage.getItem('timeZone') || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  });

  useEffect(() => {
    localStorage.setItem('timeZone', timeZone);
  }, [timeZone]);

  // Perspective consistency: whenever state changes, save to localStorage
  useEffect(() => {
    localStorage.setItem('privacy_mode', isPrivacyMode);
  }, [isPrivacyMode]);

  useEffect(() => {
    localStorage.setItem('hidden_banks', JSON.stringify(hiddenBanks));
  }, [hiddenBanks]);

  const toggleGlobalPrivacy = () => setIsPrivacyMode(!isPrivacyMode);

  const toggleBankPrivacy = (e, bankName) => {
    e.stopPropagation(); // Avoid opening details modal
    setHiddenBanks(prev =>
      prev.includes(bankName)
        ? prev.filter(name => name !== bankName)
        : [...prev, bankName]
    );
  };

  const toggleBankExpand = (e, bankName) => {
    e.stopPropagation();
    setExpandedBanks(prev =>
      prev.includes(bankName)
        ? prev.filter(b => b !== bankName)
        : [...prev, bankName]
    );
  };

  const formatPrivacy = (amount, bankName = null) => {
    const isHidden = isPrivacyMode || (bankName && hiddenBanks.includes(bankName));
    if (isHidden) return "********";
    return fmt(amount);
  };

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

  // Open edit modal for a transaction
  const handleEditTransaction = (tx) => {
    setSelectedTransaction(tx);
    setIsEditModalOpen(true);
  };

  // Fetch data function
  const fetchData = async () => {
    try {
      const txRes = await fetch(`${API_URL}/transactions?limit=20&environment=${APP_ENV}`);
      const txData = await txRes.json();
      setTransactions(txData);

      const bankRes = await fetch(`${API_URL}/summary/banks?environment=${APP_ENV}`);
      const bankDataRaw = await bankRes.json();

      const bankMap = new Map();
      bankDataRaw.forEach(item => {
        const bName = item.banco || "Sin Banco";
        if (!bankMap.has(bName)) {
          bankMap.set(bName, { banco: bName, saldo: 0, accounts: [] });
        }
        const b = bankMap.get(bName);
        b.saldo += item.saldo;
        b.accounts.push({
          cuenta: item.cuenta || 'Principal',
          saldo: item.saldo
        });
      });
      setBanks(Array.from(bankMap.values()).sort((a, b) => b.saldo - a.saldo));

      // Fetch savings summary for committed balance display
      try {
        const savingsRes = await fetch(`${API_URL}/savings-goals/summary?environment=${APP_ENV}`);
        if (savingsRes.ok) {
          const savingsData = await savingsRes.json();
          setSavingsSummary(savingsData);
        }

        // Fetch per-bank savings
        const byBankRes = await fetch(`${API_URL}/savings-goals/by-bank?environment=${APP_ENV}`);
        if (byBankRes.ok) {
          const byBankData = await byBankRes.json();
          setSavingsByBank(byBankData);
        }

        // Fetch per-account savings
        const byAccountRes = await fetch(`${API_URL}/savings-goals/by-account?environment=${APP_ENV}`);
        if (byAccountRes.ok) {
          const byAccountData = await byAccountRes.json();
          setSavingsByBankAcct(byAccountData);
        }

        const pendingRes = await fetch(`${API_URL}/savings-withdrawals/pending?environment=${APP_ENV}`);
        if (pendingRes.ok) {
          const pendingData = await pendingRes.json();
          // Group by bank
          const grouped = {};
          pendingData.forEach(w => {
            if (w.banco) {
              grouped[w.banco] = (grouped[w.banco] || 0) + w.monto;
            }
          });
          setPendingByBank(grouped);
        }

        // Fetch budgets to calculate upcoming items
        const todayForBudget = new Date();
        const yr = todayForBudget.getFullYear();
        const mo = todayForBudget.getMonth() + 1;
        const currM = `${yr}-${String(mo).padStart(2, '0')}`;

        let nextMo = mo + 1;
        let nextYr = yr;
        if (nextMo > 12) {
          nextMo = 1;
          nextYr++;
        }
        const nextM = `${nextYr}-${String(nextMo).padStart(2, '0')}`;

        const [budgetRes1, budgetRes2] = await Promise.all([
          fetch(`${API_URL}/budgets?month=${currM}&environment=${APP_ENV}`),
          fetch(`${API_URL}/budgets?month=${nextM}&environment=${APP_ENV}`)
        ]);

        const items = [];

        if (budgetRes1.ok) {
          const budgets1 = await budgetRes1.json();
          budgets1.forEach(b => {
            if (b.items && b.items.length > 0) {
              b.items.forEach(item => {
                if (!item.pagado) {
                  items.push({ ...item, category: b.category, budgetMonth: currM });
                }
              });
            }
          });
        }

        if (budgetRes2.ok) {
          const budgets2 = await budgetRes2.json();
          budgets2.forEach(b => {
            if (b.items && b.items.length > 0) {
              b.items.forEach(item => {
                if (!item.pagado) {
                  items.push({ ...item, category: b.category, budgetMonth: nextM });
                }
              });
            }
          });
        }

        const todayNoTime = new Date();
        todayNoTime.setHours(0, 0, 0, 0);

        items.forEach(item => {
          if (item.fecha_pago && item.budgetMonth) {
            const [yy, mm] = item.budgetMonth.split('-');
            const itemDate = new Date(yy, mm - 1, item.fecha_pago);
            item.daysDist = Math.ceil((itemDate - todayNoTime) / (1000 * 60 * 60 * 24));
          } else {
            item.daysDist = 1000;
          }
        });

        // Solo mostrar los que no estén pagados y ordenarlos por cercanía
        items.sort((a, b) => a.daysDist - b.daysDist);
        setUpcomingItems(items.filter(i => i.daysDist < 60)); // Ocultar cosas muy lejanas del mes 2

        // Calculate budget commitments per bank and per bank+account ONLY for Current Month
        const byBank = {};
        const byBankAcct = {};
        items.forEach(item => {
          if (item.budgetMonth === currM && item.banco_designado) {
            byBank[item.banco_designado] = (byBank[item.banco_designado] || 0) + (item.amount || 0);
            const key = `${item.banco_designado}|${item.cuenta_designada || ''}`;
            byBankAcct[key] = (byBankAcct[key] || 0) + (item.amount || 0);
          }
        });
        setBudgetByBank(byBank);
        setBudgetByBankAcct(byBankAcct);

        // Calculate total budget pending for current month (all unpaid items, regardless of bank)
        const totalBudgetCurrentMonth = items
          .filter(item => item.budgetMonth === currM)
          .reduce((acc, item) => acc + (item.amount || 0), 0);
        setTotalBudgetPending(totalBudgetCurrentMonth);
      } catch (e) {
        console.error("Error fetching extra data:", e);
      }

      setLoading(false);
      setLastUpdated(new Date());
    } catch (error) {
      console.error("Error fetching data:", error);
      setLoading(false);
    }
  };

  // useEffect for fetching data - MUST be before any early returns!
  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
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

  const handleOpenModal = (type, initialData = null) => {
    setModalType(type);
    setModalInitialData(initialData);
    setIsModalOpen(true);
  };

  // --- Undo Logic for Transactions ---
  const { showSnackbar } = useSnackbar();

  const handleSaveTransaction = async (data) => {
    try {
      const payload = { ...data, environment: APP_ENV };

      const res = await fetch(`${API_URL}/transaction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const newTx = await res.json();
        // Refresh data
        fetchData();

        // Show Snackbar with Undo
        showSnackbar(
          `${newTx.tipo} registrado`,
          'success',
          async () => {
            // UNDO: Delete the created transaction
            try {
              await fetch(`${API_URL}/transaction/${newTx.id}`, { method: 'DELETE' });
              fetchData(); // Revert UI
              showSnackbar("Movimiento deshecho", "info");
            } catch (e) {
              console.error("Error undoing transaction:", e);
            }
          }
        );
      }
    } catch (error) {
      console.error("Error saving:", error);
    }
  };

  const handleRequestDelete = (txId) => {
    const txToDelete = transactions.find(t => t.id === txId);
    if (!txToDelete) return;

    // 1. Optimistic UI: Remove immediately
    setTransactions(prev => prev.filter(t => t.id !== txId));

    // 2. Set Timer
    const timerId = setTimeout(async () => {
      try {
        await fetch(`${API_URL}/transaction/${txId}`, { method: 'DELETE' });
        // confirm delete (silent) or refresh total balance if needed
        fetchData();
      } catch (error) {
        console.error("Error deleting transaction:", error);
        fetchData(); // Restore if error
      }
    }, 4000);

    // 3. Show Snackbar
    showSnackbar(
      "Movimiento eliminado",
      "info",
      () => {
        // UNDO
        clearTimeout(timerId);
        setTransactions(prev => {
          const restored = [...prev, txToDelete];
          // Simple sort by ID/date might be needed, but appending is fine for immediate feedback
          return restored.sort((a, b) => new Date(b.fecha) - new Date(a.fecha)); // sort date desc
        });
      },
      4000
    );
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
  const totalAhorrado = savingsSummary?.total_ahorrado || 0;
  const saldoDisponible = totalSaldo - totalAhorrado - totalBudgetPending;

  // Prepare chart data (Last 20 transactions simplified)
  const chartData = [...transactions].slice(0, 20).reverse().map(t => ({
    name: t.detalle?.substring(0, 10) || '',
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
              <p className="text-sm text-slate-400">Patrimonio Neto</p>
              <div className="flex items-center gap-2 justify-center md:justify-end">
                <p className={`text-2xl font-bold ${totalSaldo >= 0 ? 'text-white' : 'text-rose-400'}`}>
                  {formatPrivacy(totalSaldo)}
                </p>
                <button
                  onClick={toggleGlobalPrivacy}
                  className="p-1.5 hover:bg-slate-700/50 rounded-lg text-slate-400 hover:text-white transition-colors"
                  title={isPrivacyMode ? "Mostrar todo" : "Ocultar todo"}
                >
                  {isPrivacyMode ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {(totalAhorrado > 0 || totalBudgetPending > 0) && (
                <div className="mt-1 flex flex-col items-end">
                  <span className="text-[10px] text-emerald-400/80 uppercase tracking-wider font-bold">Disponible Real</span>
                  <span className={`text-lg font-bold ${saldoDisponible >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                    {formatPrivacy(saldoDisponible)}
                  </span>
                </div>
              )}
            </div>

            <div className="flex gap-2 items-center">
              <button
                onClick={() => setIsReportsOpen(true)}
                className="bg-slate-700/50 hover:bg-slate-700 p-3 rounded-xl transition-colors text-slate-300 hover:text-white"
                title="Ver Reportes Avanzados"
              >
                <PieIcon size={20} />
              </button>

              {/* Consolidated Settings Button */}
              <button
                onClick={() => setIsControlCenterOpen(true)}
                className="bg-slate-700/50 hover:bg-slate-700 p-3 rounded-xl transition-colors text-slate-300 hover:text-white flex items-center gap-2"
                title="Centro de Control (Ajustes)"
              >
                <div className="bg-gradient-to-br from-cyan-500 to-blue-600 rounded-full p-1">
                  <User size={16} className="text-white" />
                </div>
                {/* <span className="hidden md:inline font-medium">Ajustes</span> */}
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
            {banks.map((bank, idx) => {
              const bankName = bank.banco || "Sin Banco";
              const aportadoDesdeBanco = savingsByBank[bankName] || 0;
              const pendingReponer = pendingByBank[bankName] || 0;
              const presuPendiente = budgetByBank[bankName] || 0;
              const disponible = bank.saldo - aportadoDesdeBanco - presuPendiente;

              return (
                <div
                  key={idx}
                  className="bg-slate-800/80 p-5 rounded-xl border border-slate-700 hover:border-blue-500/50 transition-all hover:shadow-lg hover:shadow-blue-500/10 group cursor-pointer"
                  onClick={() => {
                    setSelectedBank(bankName);
                    setIsBankDetailsOpen(true);
                  }}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex flex-col">
                      <h3 className="font-bold text-lg text-slate-200 group-hover:text-blue-300 transition-colors">{bankName}</h3>
                      <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full w-fit mt-1 ${bank.saldo >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                        {bank.saldo >= 0 ? 'Activo' : 'Deuda'}
                      </span>
                    </div>
                    <button
                      onClick={(e) => toggleBankPrivacy(e, bankName)}
                      className="p-1 hover:bg-slate-700 rounded text-slate-500 hover:text-white transition-colors"
                      title={hiddenBanks.includes(bankName) ? "Mostrar saldo" : "Ocultar saldo"}
                    >
                      {hiddenBanks.includes(bankName) || isPrivacyMode ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <div className="mt-4">
                    <p className="text-sm text-slate-500">Saldo Real</p>
                    <p className={`text-2xl font-bold truncate ${bank.saldo < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                      {formatPrivacy(bank.saldo, bankName)}
                    </p>
                  </div>

                  {/* Cuentas Desglose */}
                  {bank.accounts && (() => {
                    const activeAccounts = bank.accounts.filter(a => a.saldo !== 0);
                    if (activeAccounts.length === 0) return null;
                    return (
                      <div className="mt-3">
                        {activeAccounts.length > 1 ? (
                          <>
                            <button
                              onClick={(e) => toggleBankExpand(e, bankName)}
                              className="flex items-center justify-between w-full text-xs text-blue-400 hover:text-blue-300 transition-colors bg-blue-500/10 hover:bg-blue-500/20 px-2 py-1.5 rounded-lg font-medium"
                            >
                              <span>{expandedBanks.includes(bankName) ? 'Ocultar cuentas' : `Ver ${activeAccounts.length} cuentas`}</span>
                            </button>
                            {expandedBanks.includes(bankName) && (
                              <div className="mt-2 space-y-1.5 animate-in slide-in-from-top-2 fade-in duration-200">
                                {activeAccounts.map((acc, aIdx) => (
                                  <div key={aIdx} className="flex justify-between items-center text-xs bg-slate-900/40 p-1.5 rounded-md border border-slate-700/50">
                                    <span className="text-slate-400 truncate w-2/3" title={acc.cuenta}>{acc.cuenta}</span>
                                    <div className="flex flex-col items-end">
                                      <span className={`font-medium ${acc.saldo < 0 ? 'text-rose-400' : 'text-slate-300'}`}>
                                        {formatPrivacy(acc.saldo, bankName)}
                                      </span>
                                      {((budgetByBankAcct[`${bankName}|${acc.cuenta}`] || 0) > 0 || (savingsByBankAcct[`${bankName}|${acc.cuenta}`] || 0) > 0) && (
                                        <div className="flex flex-col items-end text-[9px] text-amber-400/80 leading-tight">
                                          {(budgetByBankAcct[`${bankName}|${acc.cuenta}`] || 0) > 0 && <span>📋 p. {formatPrivacy(budgetByBankAcct[`${bankName}|${acc.cuenta}`], bankName)}</span>}
                                          {(savingsByBankAcct[`${bankName}|${acc.cuenta}`] || 0) > 0 && <span>🐷 ah. {formatPrivacy(savingsByBankAcct[`${bankName}|${acc.cuenta}`], bankName)}</span>}
                                          <span className="text-emerald-400/90 font-bold">disp. {formatPrivacy(acc.saldo - (budgetByBankAcct[`${bankName}|${acc.cuenta}`] || 0) - (savingsByBankAcct[`${bankName}|${acc.cuenta}`] || 0), bankName)}</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </>
                        ) : (
                          activeAccounts[0].cuenta !== 'Principal' && (
                            <div className="flex justify-between items-center text-[10px] bg-slate-900/40 px-2 py-1 rounded border border-slate-700/50">
                              <span className="text-slate-500 font-mono truncate">{activeAccounts[0].cuenta}</span>
                            </div>
                          )
                        )}
                      </div>
                    );
                  })()}
                  {(aportadoDesdeBanco > 0 || presuPendiente > 0) && (
                    <div className="mt-2 pt-2 border-t border-slate-700/50">
                      {aportadoDesdeBanco > 0 && (
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-amber-400/70">🐷 Comprometido:</span>
                          <div className="flex items-center gap-2">
                            <span className="text-amber-300">{formatPrivacy(aportadoDesdeBanco, bankName)}</span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setMigratorSourceBank(bankName);
                                setIsMigratorOpen(true);
                              }}
                              className="p-1 rounded-md hover:bg-indigo-500/20 text-indigo-400/60 hover:text-indigo-300 transition-all"
                              title={`Migrar ahorros de ${bankName}`}
                            >
                              <ArrowRightLeft size={12} />
                            </button>
                          </div>
                        </div>
                      )}
                      {presuPendiente > 0 && (
                        <div className="flex justify-between items-center text-xs mt-1">
                          <span className="text-indigo-400/70">📋 Presu. pendiente:</span>
                          <span className="text-indigo-300">{formatPrivacy(presuPendiente, bankName)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm mt-1">
                        <span className="text-slate-400">Disponible:</span>
                        <span className={`font-bold ${disponible < 0 ? 'text-rose-400' : 'text-slate-200'}`}>{formatPrivacy(disponible, bankName)}</span>
                      </div>
                    </div>
                  )}
                  {pendingReponer > 0 && (
                    <div className="mt-2 p-2 bg-amber-900/30 border border-amber-600/50 rounded-lg">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-amber-400 font-semibold">⚠️ Pendiente reponer:</span>
                        <span className="text-amber-300 font-bold">{formatPrivacy(pendingReponer, bankName)}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Savings Summary Card */}
            {savingsSummary.num_metas > 0 && (
              <div className="bg-gradient-to-br from-emerald-900/50 to-teal-900/50 p-5 rounded-xl border border-emerald-700/50 hover:border-emerald-500/50 transition-all hover:shadow-lg hover:shadow-emerald-500/10 group cursor-pointer" onClick={() => setIsSavingsOpen(true)}>
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-lg text-emerald-200 group-hover:text-emerald-100 transition-colors flex items-center gap-2">
                    <PiggyBank size={18} /> Ahorros
                  </h3>
                  <span className="text-[10px] uppercase font-bold px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-300">
                    {savingsSummary.num_metas} {savingsSummary.num_metas === 1 ? 'meta' : 'metas'}
                  </span>
                </div>
                <div className="mt-4">
                  <p className="text-sm text-emerald-400/70">Total Comprometido</p>
                  <p className="text-2xl font-bold truncate text-emerald-300">
                    {formatPrivacy(savingsSummary.total_ahorrado)}
                  </p>
                </div>
                <div className="mt-2 pt-2 border-t border-emerald-700/30">
                  <p className="text-xs text-emerald-400/60">Disponible sin compromisos:</p>
                  <p className="text-sm font-semibold text-slate-300">
                    {formatPrivacy(totalSaldo - savingsSummary.total_ahorrado - totalBudgetPending)}
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Main Content Grid */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Left Column: Transactions & Alerts */}
          <div className="lg:col-span-2 space-y-6">

            {/* Upcoming Projections Alert */}
            {upcomingItems.length > 0 && (
              <div className="bg-slate-800/60 p-6 rounded-2xl border border-amber-700/50 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-amber-500"></div>
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-amber-400">
                  <Clock size={20} /> Próximos Pagos Proyectados
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {upcomingItems.slice(0, 4).map((item, idx) => {
                    const isPastDue = item.daysDist != null && item.daysDist < 0;
                    const isToday = item.daysDist === 0;
                    let textDist = '';
                    if (isPastDue) textDist = '(Atrasado)';
                    else if (isToday) textDist = '(Hoy)';
                    else if (item.daysDist <= 45) textDist = `(En ${item.daysDist} d.)`;

                    return (
                      <div key={idx} className="bg-slate-900/60 p-3 rounded-xl border border-slate-700 flex justify-between items-center group relative overflow-hidden">
                        <div>
                          <p className="text-sm font-medium text-slate-200 truncate pr-2 max-w-[120px] sm:max-w-xs">{item.nombre}</p>
                          <p className="text-[10px] text-slate-500 truncate">{item.category}</p>
                        </div>
                        <div className="text-right flex flex-col items-end group-hover:opacity-10 transition-opacity">
                          <p className="text-sm font-bold text-slate-300">{fmt(item.amount)}</p>
                          {item.fecha_pago && (
                            <p className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded flex items-center gap-1 mt-1 ${isPastDue ? 'bg-rose-500/10 text-rose-400' : (isToday ? 'bg-amber-500/10 text-amber-400' : 'bg-slate-700 text-slate-400')}`}>
                              Día {item.fecha_pago} {textDist}
                            </p>
                          )}
                        </div>
                        <div className="absolute right-0 top-0 bottom-0 w-16 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity translate-x-4 group-hover:translate-x-0 bg-gradient-to-l from-slate-900 via-slate-900/80 to-transparent">
                          <button
                            onClick={() => handleOpenModal('Gasto', {
                              categoria: item.category,
                              detalle: item.nombre,
                              banco: item.banco_designado || 'Efectivo',
                              cuenta: item.cuenta_designada || '',
                              monto: item.amount,
                              budget_item_id: item.id,
                              budget_month: item.budgetMonth
                            })}
                            className="bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-white p-2 text-xs rounded-full transition-colors font-medium border border-emerald-500/50"
                            title="Pagar ahora"
                          >
                            Pagar
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
                {upcomingItems.length > 4 && (
                  <p className="text-xs text-slate-500 mt-3 text-center">Y {upcomingItems.length - 4} más... ve a Presupuestos para ver todo.</p>
                )}
              </div>
            )}

            <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700 shadow-xl">
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
                      <th className="pb-3 text-center pr-2">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {transactions.map((tx) => (
                      <tr key={tx.id} className="border-b border-slate-700/30 hover:bg-slate-700/40 transition-colors group">
                        <td className="py-3 pl-2 text-slate-300 font-mono text-xs">{tx.fecha}</td>
                        <td className="py-3 font-medium text-slate-200 group-hover:text-white">
                          {tx.detalle || "Sin detalle"}
                          {tx.banco && (
                            <div className="text-[10px] text-slate-500 font-normal mt-0.5 flex items-center gap-1">
                              <Building2 size={10} /> {tx.banco} {tx.cuenta && tx.cuenta !== 'Principal' ? `(${tx.cuenta})` : ''}
                            </div>
                          )}
                        </td>
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
                            onClick={() => handleEditTransaction(tx)}
                            className="text-slate-400 hover:text-blue-400 transition-colors p-1 hover:bg-slate-700 rounded opacity-0 group-hover:opacity-100"
                            title="Editar"
                          >
                            <Pencil size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
                <button
                  onClick={() => setIsTransferOpen(true)}
                  className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-lg shadow-cyan-900/20 flex items-center justify-center gap-2"
                >
                  <ArrowRightLeft size={18} /> Transferencia Interna
                </button>
                <button
                  onClick={() => setIsSavingsOpen(true)}
                  className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-lg shadow-emerald-900/20 flex items-center justify-center gap-2"
                >
                  <PiggyBank size={18} /> Metas de Ahorro
                </button>
                <button
                  onClick={() => setIsBudgetOpen(true)}
                  className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-lg shadow-indigo-900/20 flex items-center justify-center gap-2"
                >
                  <Target size={18} /> Presupuestos
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
        </section >

      </div >

      {/* Modal / QuickAdd */}
      < QuickAdd
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setModalInitialData(null);
        }}
        onSave={handleSaveTransaction}
        type={modalType}
        environment={APP_ENV}
        initialData={modalInitialData}
        banksData={banks}
      />

      {/* Unified Control Center */}
      < ControlCenterModal
        isOpen={isControlCenterOpen}
        onClose={() => {
          setIsControlCenterOpen(false);
          fetchData(); // Refresh data on close (covers banks/cats changes)
        }}
        timeZone={timeZone}
        setTimeZone={setTimeZone}
        token={token}
        onCategoryChange={() => fetchData()}
        environment={APP_ENV}
      />

      {/* Advanced Reports Modal */}
      <AdvancedReports
        isOpen={isReportsOpen}
        onClose={() => setIsReportsOpen(false)}
        totalNetWorth={totalSaldo}
        environment={APP_ENV}
      />

      {/* Legacy Modals Removed/Replaced (CategoriesManager, BanksManager, SettingsPanel, SettingsModal) */}

      {/* Transfer Modal */}
      <TransferModal
        isOpen={isTransferOpen}
        onClose={() => setIsTransferOpen(false)}
        environment={APP_ENV}
        onTransferComplete={() => fetchData()}
        banksData={banks}
      />

      {/* Savings Goals Modal */}
      <SavingsGoalsModal
        isOpen={isSavingsOpen}
        onClose={() => setIsSavingsOpen(false)}
        environment={APP_ENV}
        onGoalChange={() => fetchData()}
        banksData={banks}
      />

      {/* Budget Manager Modal */}
      <BudgetManager
        isOpen={isBudgetOpen}
        onClose={() => { setIsBudgetOpen(false); fetchData(); }}
        environment={APP_ENV}
        onAddTransaction={(data) => handleOpenModal('Gasto', data)}
        savingsByBank={savingsByBank}
        banksData={banks}
      />

      {/* Edit Transaction Modal */}
      <EditTransactionModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedTransaction(null);
        }}
        transaction={selectedTransaction}
        environment={APP_ENV}
        onUpdate={() => fetchData()}
        onDelete={handleRequestDelete}
        token={token}
        banksData={banks}
      />

      {/* Bank Details Modal */}
      <BankDetailsModal
        isOpen={isBankDetailsOpen}
        onClose={() => {
          setIsBankDetailsOpen(false);
          setSelectedBank(null);
        }}
        bankName={selectedBank}
        environment={APP_ENV}
        lastUpdated={lastUpdated}
      />

      {/* Savings Migrator Modal */}
      <SavingsMigratorModal
        isOpen={isMigratorOpen}
        onClose={() => {
          setIsMigratorOpen(false);
          setMigratorSourceBank(null);
        }}
        environment={APP_ENV}
        sourceBank={migratorSourceBank}
        onComplete={() => fetchData()}
        banksData={banks}
      />
    </div >
  );
}

export default App;
