import { useState, useEffect, useMemo } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend, LineChart, Line
} from 'recharts';
import {
    X, Calendar, PieChart as PieIcon, BarChart3, Hourglass,
    PiggyBank, Flame, TrendingUp, List, CreditCard, AlertCircle, Download
} from 'lucide-react';
import EditTransactionModal from './EditTransactionModal';
import DrillDownModal from './DrillDownModal';
import { useSnackbar } from '../context/SnackbarContext';
import MultiSelect from './MultiSelect';
import { API_URL } from "../config";
// force refresh mechanism


const COLORS = ['#818cf8', '#34d399', '#f472b6', '#fbbf24', '#60a5fa', '#a78bfa', '#f87171'];
const BARS_COLORS = ['#38bdf8', '#34d399', '#f472b6', '#fbbf24'];

export default function AdvancedReports({ isOpen, onClose, totalNetWorth = 0, environment = "TEST" }) {
    // Default to show ALL data (since 2000)
    const [dateRange, setDateRange] = useState({
        start: '2000-01-01',
        end: new Date().toISOString().split('T')[0]
    });

    // Category and Bank filters
    // Global Filter State (Multi-select)
    const [selectedCategories, setSelectedCategories] = useState([]);
    const [selectedBanks, setSelectedBanks] = useState([]);
    const [searchFilter, setSearchFilter] = useState('');

    // Available Options
    const [apiCategories, setApiCategories] = useState([]);
    const [availableBanks, setAvailableBanks] = useState([]);

    // Raw Data State (All transactions for the period)
    const [rawTransactions, setRawTransactions] = useState([]);

    // Data States
    const [data, setData] = useState({ pie_data: [], bar_data: [] });
    const [analysisData, setAnalysisData] = useState({ top_expenses: [], payment_methods: [] });
    const [forecastData, setForecastData] = useState([]);

    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('summary'); // summary, trends, breakdown
    const [historyView, setHistoryView] = useState('monthly'); // 'monthly' or 'yearly' for Histórico chart

    // Drill Down State
    const [ddOpen, setDdOpen] = useState(false);
    const [ddTitle, setDdTitle] = useState('');
    const [ddTransactions, setDdTransactions] = useState([]);
    const [ddEvolution, setDdEvolution] = useState([]);

    // Editing State
    const [editingTx, setEditingTx] = useState(null);
    const { showSnackbar } = useSnackbar();

    const formatMonth = (dateStr) => {
        if (!dateStr || dateStr === 'Desconocido') return dateStr;
        const [year, month] = dateStr.split('-');
        const date = new Date(year, month - 1);
        return date.toLocaleDateString('es-CL', { month: 'short', year: '2-digit' });
    };

    const fetchAllData = async () => {
        setLoading(true);
        try {
            const query = new URLSearchParams({
                start_date: dateRange.start,
                end_date: dateRange.end,
                limit: 0, // Get all
                include_transfers: true, // Include Transferencia for reports filtering
                environment: environment
            });
            const res = await fetch(`${API_URL}/transactions?${query}`);
            const json = await res.json();
            setRawTransactions(Array.isArray(json) ? json : []);
        } catch (error) {
            console.error("Error fetching raw data:", error);
        } finally {
            setLoading(false);
        }
    };

    // Load Initial Data (Banks and Categories + Transactions)
    useEffect(() => {
        if (isOpen) {
            fetchBanks();
            fetchCategories();
            fetchAllData();
        }
    }, [isOpen, dateRange, environment]);

    // Update available categories: merge API categories + transaction categories + known hidden ones like 'Transferencia'
    // Note: The backend excludes 'Transferencia' from /transactions AND it may not exist in /categories table,
    // so we must inject it manually to make it selectable as a filter.
    const ALWAYS_AVAILABLE_CATEGORIES = ['Transferencia'];
    const availableCategories = useMemo(() => {
        const txCats = rawTransactions.map(t => t.categoria).filter(Boolean);
        return [...new Set([...apiCategories, ...txCats, ...ALWAYS_AVAILABLE_CATEGORIES])].sort();
    }, [apiCategories, rawTransactions]);

    // Reset filters when range changes significantly or on open (optional, keeps filters persistent for now)
    // useEffect(() => { setSelectedCategories([]); setSelectedBanks([]); }, [isOpen]);

    // --- CLIENT-SIDE FILTERING ENGINE ---
    const processedData = (() => {
        if (!rawTransactions.length) return { pie: [], history: [], kpis: {}, list: [] };

        // 1. Filter Transactions
        const filtered = rawTransactions.filter(tx => {
            // Category Filter
            if (selectedCategories.length > 0 && !selectedCategories.includes(tx.categoria)) return false;
            // Bank Filter
            if (selectedBanks.length > 0 && !selectedBanks.includes(tx.banco)) return false;
            // Search Filter
            if (searchFilter) {
                const searchLower = searchFilter.toLowerCase();
                const match = (tx.detalle || '').toLowerCase().includes(searchLower) ||
                    (tx.banco || '').toLowerCase().includes(searchLower) ||
                    (tx.categoria || '').toLowerCase().includes(searchLower);
                if (!match) return false;
            }
            return true;
        });

        // Determine if user is explicitly filtering for Transferencia
        const isFilteringTransfers = selectedCategories.includes('Transferencia');

        // For aggregates (KPIs, pie, history), exclude transfers unless explicitly selected
        // This prevents internal money movements from inflating income/expense totals
        const aggregateFiltered = isFilteringTransfers
            ? filtered
            : filtered.filter(tx => tx.categoria !== 'Transferencia');

        // 2. Compute Aggregates
        // Pie Chart Data (Expenses by Category)
        const catMap = {};
        aggregateFiltered.filter(tx => tx.gasto > 0).forEach(tx => {
            catMap[tx.categoria] = (catMap[tx.categoria] || 0) + tx.gasto;
        });
        const pieData = Object.entries(catMap).map(([name, value]) => ({ name, value }));

        // History Data (Monthly bars)
        const historyMap = {};
        aggregateFiltered.forEach(tx => {
            const month = tx.fecha.substring(0, 7); // YYYY-MM
            if (!historyMap[month]) historyMap[month] = { period: month, ingreso: 0, gasto: 0 };
            historyMap[month].ingreso += (tx.ingreso || 0);
            historyMap[month].gasto += (tx.gasto || 0);
        });
        const historyData = Object.values(historyMap).sort((a, b) => a.period.localeCompare(b.period));

        // KPIs
        const totalIncome = aggregateFiltered.reduce((acc, tx) => acc + (tx.ingreso || 0), 0);
        const totalExpense = aggregateFiltered.reduce((acc, tx) => acc + (tx.gasto || 0), 0);
        const net = totalIncome - totalExpense;


        // Payment Methods (Top Banks by Amount) - also exclude transfers unless filtering for them
        const bankMap = {};
        aggregateFiltered.forEach(tx => {
            if (tx.gasto > 0) {
                const bank = tx.banco || 'Efectivo/Otro';
                bankMap[bank] = (bankMap[bank] || 0) + (tx.gasto || 0);
            }
        });
        const paymentMethodsData = Object.entries(bankMap)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);

        return {
            list: filtered,
            pie: pieData,
            history: historyData,
            paymentMethods: paymentMethodsData,
            kpis: { totalIncome, totalExpense, net }
        };
    })();

    // Helper for DrillDown
    const fetchCategories = async () => {
        try {
            const res = await fetch(`${API_URL}/categories?environment=${environment}`);
            const cats = await res.json();
            setApiCategories(cats.map(c => c.nombre));
        } catch (error) { console.error(error); }
    };

    const fetchBanks = async () => {
        try {
            const res = await fetch(`${API_URL}/banks?environment=${environment}`);
            const banks = await res.json();
            setAvailableBanks(banks.map(b => b.nombre));
        } catch (error) { console.error(error); }
    };

    const handleExport = async () => {
        try {
            // Fetch all transactions for current range
            const query = new URLSearchParams({
                start_date: dateRange.start,
                end_date: dateRange.end,
                limit: 0, // No limit
                environment: environment
            });
            const res = await fetch(`${API_URL}/transactions?${query}`);
            const transactions = await res.json();

            if (!transactions || transactions.length === 0) {
                alert("No hay transacciones para exportar en este período.");
                return;
            }

            // Convert to CSV
            const headers = ['ID', 'Fecha', 'Tipo', 'Categoría', 'Detalle', 'Banco', 'Monto'];
            const csvRows = [headers.join(',')];

            transactions.forEach(tx => {
                const row = [
                    tx.id,
                    tx.fecha,
                    tx.tipo,
                    `"${(tx.categoria || '').replace(/"/g, '""')}"`, // Escape quotes
                    `"${(tx.detalle || '').replace(/"/g, '""')}"`,
                    tx.banco,
                    tx.monto
                ];
                csvRows.push(row.join(','));
            });

            const csvContent = "data:text/csv;charset=utf-8," + csvRows.join("\n");
            const encodedUri = encodeURI(csvContent);

            // Create download link and trigger
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", `finanzas_export_${dateRange.start}_${dateRange.end}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

        } catch (error) {
            console.error("Error exporting report:", error);
            alert("Error al exportar");
        }
    };

    const fetchDrillDown = async (filters, title) => {
        try {
            // Use client-side filtered data (respects all active filters)
            const startDate = filters.start_date || dateRange.start;
            const endDate = filters.end_date || dateRange.end;
            const category = filters.category || null;
            const banco = filters.banco || null;

            const filtered = processedData.list.filter(tx => {
                if (tx.fecha < startDate || tx.fecha > endDate) return false;
                if (category && tx.categoria !== category) return false;
                if (banco && tx.banco !== banco) return false;
                return true;
            });

            setDdTransactions(filtered);
            setDdTitle(title);
            setDdOpen(true);
        } catch (error) {
            console.error("Drilldown error:", error);
        }
    };

    const handlePieClick = (data) => {
        if (!data) return;
        const category = data.name;
        fetchDrillDown({ category }, `Gastos en ${category}`);
    };

    const handleBarClick = (data, index, event) => {
        if (!data || !data.activePayload) return;

        const payload = data.activePayload[0].payload;
        const monthStr = payload.month;
        if (monthStr === 'Desconocido') return;

        // Detect which bar was clicked based on the dataKey
        const clickedBar = data.activeTooltipIndex !== undefined && data.activePayload.length > 0
            ? data.activePayload.find(p => {
                // Check which bar's area contains the click
                const xPos = event?.nativeEvent?.offsetX || 0;
                return p.dataKey; // We'll use a different approach
            })
            : null;

        // Use the actual click target - determine from the color or position
        // Simpler: detect from the tooltip index and bar names
        let tipoFilter = null;
        let tipoTitle = '';

        // Check if clicked on Ingreso or Gasto bar based on activeLabel or use tooltip
        // For grouped bars, we need to check which specific bar was clicked
        if (data.activePayload.length >= 2) {
            // Check mouse position relative to bars - simpler: let user click and show both
            // But user wants specific filtering, so let's add separate click handlers via Bar onClick
            tipoFilter = null; // Will show all for now, we'll add bar-specific handlers
        }

        const [year, month] = monthStr.split('-');
        const startDate = `${year}-${month}-01`;
        const lastDay = new Date(year, month, 0).getDate();
        const endDate = `${year}-${month}-${lastDay}`;

        setDdEvolution([]);
        fetchDrillDown({ start_date: startDate, end_date: endDate }, `Resumen ${formatMonth(monthStr)}`);
    };

    // Separate handlers for each bar type
    const handleIngresoBarClick = (data, monthStr) => {
        if (!monthStr || monthStr === 'Desconocido') return;

        const [year, month] = monthStr.split('-');
        const startDate = `${year}-${month}-01`;
        const lastDay = new Date(year, month, 0).getDate();
        const endDate = `${year}-${month}-${lastDay}`;

        setDdEvolution([]);
        // Filter by detalle containing ingreso-related or by tipo
        fetchDrillDownByType(startDate, endDate, 'Ingreso', `Ingresos ${formatMonth(monthStr)}`);
    };

    const handleGastoBarClick = (data, monthStr) => {
        if (!monthStr || monthStr === 'Desconocido') return;

        const [year, month] = monthStr.split('-');
        const startDate = `${year}-${month}-01`;
        const lastDay = new Date(year, month, 0).getDate();
        const endDate = `${year}-${month}-${lastDay}`;

        setDdEvolution([]);
        fetchDrillDownByType(startDate, endDate, 'Gasto', `Gastos ${formatMonth(monthStr)}`);
    };

    const fetchDrillDownByType = async (startDate, endDate, tipo, title) => {
        try {
            // Use client-side filtered data (respects all active filters: categories, banks, search)
            const filtered = processedData.list.filter(tx => {
                // Date range filter
                if (tx.fecha < startDate || tx.fecha > endDate) return false;
                // Type filter (Ingreso has ingreso > 0, Gasto has gasto > 0)
                if (tipo === 'Ingreso' && !(tx.ingreso > 0)) return false;
                if (tipo === 'Gasto' && !(tx.gasto > 0)) return false;
                return true;
            });

            setDdTransactions(filtered);
            setDdTitle(title);
            setDdOpen(true);
        } catch (error) {
            console.error("Drilldown error:", error);
        }
    };

    const handleTopItemClick = async (data) => {
        if (!data) return;

        const itemName = data.name; // When clicking Bar, data is the item { name, value }

        // Fetch History by categoria
        try {
            const query = new URLSearchParams({
                start_date: dateRange.start,
                end_date: dateRange.end,
                filter_col: 'categoria',
                filter_val: itemName
            });
            const res = await fetch(`${API_URL}/history?${query}`);
            const hist = await res.json();
            setDdEvolution(hist);
        } catch (e) {
            console.error("History fetch failed", e);
            setDdEvolution([]);
        }

        fetchDrillDown({ category: itemName }, `Categoría: ${itemName}`);
    };

    const handleBankClick = (data) => {
        if (!data) return;
        const filters = { bank: data.name };
        // Similar to categoryFilter above, this `categoryFilter` is undefined.
        // If it's meant to apply the currently selected categories, it should use `selectedCategories`.
        // For now, I'll remove it to avoid error.
        // if (categoryFilter) filters.category = categoryFilter;
        const title = `Transacciones: ${data.name}`; // Simplified title
        fetchDrillDown(filters, title);
    };

    // Handle history chart bar clicks
    const handleHistoryBarClick = (data, tipo) => {
        if (!data || !data.period) return;

        const period = data.period;
        let startDate, endDate, title;

        if (historyView === 'yearly') {
            // Period is just the year (e.g., "2024")
            startDate = `${period}-01-01`;
            endDate = `${period}-12-31`;
            title = `${tipo} del año ${period}`;
        } else {
            // Period is YYYY-MM format
            const [year, month] = period.split('-');
            startDate = `${year}-${month}-01`;
            const lastDay = new Date(year, parseInt(month), 0).getDate();
            endDate = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
            const monthName = new Date(year, parseInt(month) - 1).toLocaleDateString('es-CL', { month: 'long' });
            title = `${tipo} de ${monthName} ${year}`;
        }

        // Fetch transactions filtered by type and date range
        const tipoDb = tipo === 'Ingresos' ? 'Ingreso' : 'Gasto';
        fetchDrillDownByType(startDate, endDate, tipoDb, title);
    };

    const formatHistoryPeriod = (val) => {
        if (!val) return '';
        // If the data is already yearly (e.g. "2024"), returns it as is
        if (historyView === 'yearly' && !val.includes('-')) return val;
        return formatMonth(val);
    };


    const fmt = (num) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(num);

    // --- KPI Calculations (Use Processed Data) ---
    // const barData = Array.isArray(data.bar_data) ? data.bar_data : []; // OLD
    const pieData = processedData.pie;
    const historyChartData = processedData.history; // Monthly only for now, can adapt logic for yearly easily

    // --- Editing Handlers ---
    const handleEditTransaction = (tx) => {
        setEditingTx(tx);
    };

    // Unified Update Handler (Optimistic UI Update)
    const handleTransactionUpdate = (updatedTx) => {
        if (!updatedTx) {
            // If for some reason updatedTx is not passed, fetch all
            fetchAllData();
            return;
        }

        // 1. Update Raw Transactions (will trigger processedData re-calc)
        setRawTransactions(prev => prev.map(t => t.id === updatedTx.id ? updatedTx : t));

        // 2. Update Drill Down List if open
        if (ddOpen) {
            setDdTransactions(prev => prev.map(t => t.id === updatedTx.id ? updatedTx : t));
        }

        showSnackbar('Transacción actualizada', 'success');
        setEditingTx(null);
    };

    // Also need to handle delete if EditModal supports it (it usually does via a separate button, 
    // but if it's just save/cancel, we are good. If EditModal has delete, we need a handler).
    // Checking EditTransactionModal usage... it usually takes onSave and onClose. 
    // If it has onDelete, we should add it.
    const handleDeleteTransaction = async (id) => {
        if (!window.confirm("¿Seguro que deseas eliminar esta transacción?")) return;

        try {
            const res = await fetch(`${API_URL}/transactions/${id}?environment=${environment}`, {
                method: 'DELETE'
            });

            if (res.ok) {
                showSnackbar('Transacción eliminada', 'success');
                setEditingTx(null);
                await fetchAllData();
                setDdTransactions(prev => prev.filter(t => t.id !== id));
            } else {
                showSnackbar('Error al eliminar', 'error');
            }
        } catch (error) {
            console.error(error);
            showSnackbar('Error de conexión', 'error');
        }
    };


    // Note: Top Expenses and Payment Methods analysis might be lost with simple client-side logic unless re-implemented. 
    // For now, let's keep the core KPIs working.
    // const topExpenses = ...

    const { totalIncome, totalExpense } = processedData.kpis;
    // Use calculated payment methods from processedData instead of analysisData
    const paymentMethods = processedData.paymentMethods || [];
    const forecast = Array.isArray(forecastData) ? forecastData : [];

    // --- CLIENT-SIDE COMPARISON DATA ---
    // Compute comparisonData from filtered transactions so Trends tab respects all active filters
    const comparisonData = useMemo(() => {
        const filtered = processedData.list;
        if (!filtered || filtered.length === 0) return null;

        const startMs = new Date(dateRange.start).getTime();
        const endMs = new Date(dateRange.end).getTime();
        const totalMs = endMs - startMs;
        if (totalMs <= 0) return null;

        // Split range in half: first half = previous, second half = current
        const midMs = startMs + Math.floor(totalMs / 2);
        const midDate = new Date(midMs);
        const midStr = midDate.toISOString().split('T')[0];

        const prevStart = dateRange.start;
        const prevEnd = midStr;
        const currStart = new Date(midMs + 86400000).toISOString().split('T')[0]; // day after mid
        const currEnd = dateRange.end;

        const prevDays = Math.max(Math.ceil((new Date(prevEnd) - new Date(prevStart)) / 86400000) + 1, 1);
        const currDays = Math.max(Math.ceil((new Date(currEnd) - new Date(currStart)) / 86400000) + 1, 1);

        // Exclude transfers from comparison unless explicitly filtering for them
        const isFilteringTransfers = selectedCategories.includes('Transferencia');
        const compFiltered = isFilteringTransfers
            ? filtered
            : filtered.filter(tx => tx.categoria !== 'Transferencia');

        const prevTx = compFiltered.filter(tx => tx.fecha >= prevStart && tx.fecha <= prevEnd);
        const currTx = compFiltered.filter(tx => tx.fecha >= currStart && tx.fecha <= currEnd);

        const sum = (txs, field) => txs.reduce((acc, tx) => acc + (tx[field] || 0), 0);

        const prevIngreso = sum(prevTx, 'ingreso');
        const prevGasto = sum(prevTx, 'gasto');
        const currIngreso = sum(currTx, 'ingreso');
        const currGasto = sum(currTx, 'gasto');

        const pctChange = (curr, prev) => {
            if (prev === 0) return curr > 0 ? 100 : 0;
            return Math.round(((curr - prev) / prev) * 1000) / 10;
        };

        return {
            current: { start: currStart, end: currEnd, days: currDays, ingreso: currIngreso, gasto: currGasto, balance: currIngreso - currGasto, transactions: currTx.length },
            previous: { start: prevStart, end: prevEnd, days: prevDays, ingreso: prevIngreso, gasto: prevGasto, balance: prevIngreso - prevGasto, transactions: prevTx.length },
            changes: {
                ingreso_pct: pctChange(currIngreso, prevIngreso),
                gasto_pct: pctChange(currGasto, prevGasto),
                balance_diff: (currIngreso - currGasto) - (prevIngreso - prevGasto)
            }
        };
    }, [processedData.list, dateRange, selectedCategories]);

    const start = new Date(dateRange.start);
    const end = new Date(dateRange.end);
    const diffTime = Math.abs(end - start);
    const diffDays = Math.max(Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1, 1); // +1 para incluir ambos extremos

    // Función helper para formatear días de libertad en formato legible
    const formatDaysOfFreedom = (days) => {
        if (days === "∞" || days === "N/A") return days;
        const numDays = parseFloat(days);
        if (isNaN(numDays) || numDays < 0) return "N/A";

        if (numDays < 30) {
            return `${Math.round(numDays)} días`;
        } else if (numDays < 365) {
            const months = Math.floor(numDays / 30);
            const remainingDays = Math.round(numDays % 30);
            if (remainingDays > 0) {
                return `${months} mes${months !== 1 ? 'es' : ''}, ${remainingDays} días`;
            }
            return `${months} mes${months !== 1 ? 'es' : ''}`;
        } else {
            const years = Math.floor(numDays / 365);
            const remainingMonths = Math.floor((numDays % 365) / 30);
            let result = `${years} año${years !== 1 ? 's' : ''}`;
            if (remainingMonths > 0) {
                result += `, ${remainingMonths} mes${remainingMonths !== 1 ? 'es' : ''}`;
            }
            return result;
        }
    };

    // 1. Libertad Financiera - Ahorro del periodo / Gasto diario
    // Fórmula: (Ingresos - Gastos del periodo) / (Gastos / Días) = Días de libertad
    const periodSavings = totalIncome - totalExpense; // Ahorro del periodo
    let runway = "N/A";
    if (totalExpense > 0 && periodSavings > 0) {
        const dailyExpense = totalExpense / diffDays;
        const daysOfFreedom = periodSavings / dailyExpense;
        runway = daysOfFreedom > 36500 ? "∞" : formatDaysOfFreedom(daysOfFreedom);
    } else if (periodSavings > 0 && totalExpense === 0) {
        runway = "∞";
    } else if (periodSavings <= 0) {
        runway = "0 días"; // Si no hubo ahorro o hubo pérdida
    }

    // 2. Savings Rate - Capped between -100% and 100% for sensible display
    let savingsRate = 0;
    if (totalIncome > 0) {
        const rawRate = ((totalIncome - totalExpense) / totalIncome) * 100;
        savingsRate = Math.max(-100, Math.min(100, rawRate));
    } else if (totalExpense > 0) {
        savingsRate = -100; // If no income but expenses, worst case
    }

    // 3. Burn Rate (Daily) - Usando días reales del periodo
    const burnRate = diffDays > 0 ? totalExpense / diffDays : 0;

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-950 text-slate-200 overflow-hidden flex flex-col font-sans selection:bg-cyan-500/30">
            <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-8 overflow-y-auto flex-1">

                {/* Header & Controls */}
                <header className="flex flex-col md:flex-row justify-between items-center bg-slate-800/50 p-6 rounded-2xl border border-slate-700 sticky top-4 backdrop-blur-md z-50 shadow-xl gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400">
                            Dashboard Financiero
                        </h1>
                        <p className="text-slate-400 text-sm">Visión 360° de tu economía</p>
                    </div>

                    <div className="flex flex-col xl:flex-row items-center gap-4">
                        {/* Action Buttons */}
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleExport}
                                className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 px-3 py-2 rounded-lg border border-emerald-500/50 transition-all text-sm flex items-center gap-2"
                                title="Exportar a Excel"
                            >
                                <Download size={16} />
                                <span className="hidden md:inline">Excel</span>
                            </button>
                        </div>

                        {/* Filters Row */}
                        <div className="flex flex-wrap items-center gap-2">
                            {/* Date Picker */}
                            <div className="flex items-center gap-2 bg-slate-900 p-2 rounded-lg border border-slate-700">
                                <Calendar size={16} className="text-slate-400" />
                                <input
                                    type="date"
                                    value={dateRange.start}
                                    onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                                    className="bg-transparent text-white text-sm focus:outline-none w-28"
                                />
                                <span className="text-slate-600">-</span>
                                <input
                                    type="date"
                                    value={dateRange.end}
                                    onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                                    className="bg-transparent text-white text-sm focus:outline-none w-28"
                                />
                            </div>

                            {/* Category Filter */}
                            <MultiSelect
                                options={availableCategories}
                                selected={selectedCategories}
                                onChange={setSelectedCategories}
                                label="Categorías"
                                placeholder="Buscar categoría..."
                            />

                            {/* Bank Filter */}
                            <MultiSelect
                                options={availableBanks}
                                selected={selectedBanks}
                                onChange={setSelectedBanks}
                                label="Bancos"
                                placeholder="Buscar banco..."
                            />

                            {/* Search Filter */}
                            <div className="flex items-center bg-slate-900 px-3 py-2 rounded-lg border border-slate-700 focus-within:border-blue-500">
                                <List size={14} className="text-slate-400 mr-2" />
                                <input
                                    type="text"
                                    value={searchFilter}
                                    onChange={(e) => setSearchFilter(e.target.value)}
                                    placeholder="Buscar detalle..."
                                    className="bg-transparent text-white text-sm focus:outline-none w-32 md:w-40"
                                />
                            </div>

                            {/* Clear Filters Button */}
                            <button
                                onClick={() => {
                                    setDateRange({ start: '2000-01-01', end: new Date().toISOString().split('T')[0] });
                                    setSelectedCategories([]);
                                    setSelectedBanks([]);
                                    setSearchFilter('');
                                }}
                                className="bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1"
                                title="Limpiar todos los filtros"
                            >
                                <X size={14} />
                                Limpiar
                            </button>
                        </div>

                        {/* Tabs Navigation */}
                        <div className="flex bg-slate-800/80 p-1.5 rounded-xl border border-slate-600/50 gap-1 shadow-inner" style={{ scrollbarWidth: 'none' }}>
                            <button
                                onClick={() => setActiveTab('summary')}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'summary' ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'}`}
                            >
                                <PieIcon size={16} /> <span className="hidden sm:inline">Resumen</span>
                            </button>
                            <button
                                onClick={() => setActiveTab('trends')}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'trends' ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'}`}
                            >
                                <TrendingUp size={16} /> <span className="hidden sm:inline">Tendencia</span>
                            </button>
                        </div>

                        <button onClick={onClose} className="p-2 bg-slate-700 rounded-lg hover:bg-slate-600 transition-colors text-white">
                            <X size={24} />
                        </button>
                    </div>
                </header>

                {/* Filter Summary Badge */}
                {(selectedCategories.length > 0 || selectedBanks.length > 0 || searchFilter) && (
                    <div className="flex flex-wrap items-center gap-3 bg-indigo-500/10 border border-indigo-500/30 p-4 rounded-xl animate-in slide-in-from-top-2 duration-300">
                        <div className="bg-indigo-500/20 p-2 rounded-lg">
                            <List className="text-indigo-400" size={20} />
                        </div>
                        <div>
                            <p className="text-xs text-indigo-300 font-bold uppercase tracking-wider">Filtro Activo (Segmentación)</p>
                            <div className="flex flex-wrap items-center gap-x-6 gap-y-1 mt-1">
                                {processedData.kpis.totalIncome > 0 && (
                                    <div className="flex items-center gap-2">
                                        <span className="text-slate-400 text-sm">Total Ingresos:</span>
                                        <span className="text-emerald-400 font-bold">{fmt(processedData.kpis.totalIncome)}</span>
                                    </div>
                                )}
                                {processedData.kpis.totalExpense > 0 && (
                                    <div className="flex items-center gap-2">
                                        <span className="text-slate-400 text-sm">Total Gastos:</span>
                                        <span className="text-rose-400 font-bold">{fmt(processedData.kpis.totalExpense)}</span>
                                    </div>
                                )}
                                <div className="flex items-center gap-2">
                                    <span className="text-slate-400 text-sm">Balance:</span>
                                    <span className={`font-bold ${processedData.kpis.net >= 0 ? 'text-cyan-400' : 'text-amber-400'}`}>
                                        {fmt(processedData.kpis.net)}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div className="ml-auto flex flex-col gap-1 items-end">
                            {selectedCategories.length > 0 && <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-1 rounded-md border border-indigo-500/30">{selectedCategories.length} categorías</span>}
                            {selectedBanks.length > 0 && <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-1 rounded-md border border-emerald-500/30">{selectedBanks.length} bancos</span>}
                        </div>
                    </div>
                )}

                {loading ? (
                    <div className="h-64 flex items-center justify-center text-slate-500">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500 mr-2"></div>
                        Analizando finanzas...
                    </div>
                ) : (
                    <div className="min-h-[600px]">

                        {/* --- TAB: SUMMARY --- */}
                        {activeTab === 'summary' && (
                            <div className="space-y-8 animate-in fade-in zoom-in duration-300">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <ChartCard title="Distribución de Gastos" icon={<BarChart3 className="text-pink-400" size={20} />}>
                                        {pieData.length > 0 ? (
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Pie
                                                        data={[...pieData].sort((a, b) => b.value - a.value)}
                                                        dataKey="value"
                                                        nameKey="name"
                                                        cx="50%"
                                                        cy="50%"
                                                        outerRadius={100}
                                                        innerRadius={60}
                                                        onClick={handlePieClick}
                                                        className="cursor-pointer"
                                                    >
                                                        {[...pieData].sort((a, b) => b.value - a.value).map((entry, index) => (
                                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="#1e293b" strokeWidth={2} />
                                                        ))}
                                                    </Pie>
                                                    <Tooltip
                                                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', boxShadow: '0 10px 40px rgba(0,0,0,0.5)' }}
                                                        itemStyle={{ color: '#f8fafc' }}
                                                        formatter={(val) => fmt(val)}
                                                    />
                                                    <Legend
                                                        layout="vertical"
                                                        verticalAlign="middle"
                                                        align="right"
                                                        wrapperStyle={{ fontSize: '12px', color: '#94a3b8' }}
                                                    />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        ) : (
                                            <div className="absolute inset-0 flex items-center justify-center text-slate-500 border border-dashed border-slate-700 rounded-xl">
                                                No hay gastos en este periodo
                                            </div>
                                        )}
                                    </ChartCard>

                                    {/* Histórico with Toggle */}
                                    <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700 shadow-xl h-[320px] relative">
                                        <div className="flex justify-between items-center mb-4">
                                            <h3 className="text-lg font-bold text-slate-200 flex items-center gap-2">
                                                <BarChart3 className="text-purple-400" size={20} />
                                                {historyView === 'yearly' ? 'Histórico Anual' : 'Histórico Mensual (Últimos 12)'}
                                            </h3>
                                            <div className="flex gap-1 bg-slate-900 rounded-lg p-1">
                                                <button
                                                    onClick={() => setHistoryView('monthly')}
                                                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${historyView === 'monthly'
                                                        ? 'bg-blue-600 text-white'
                                                        : 'text-slate-400 hover:text-white'
                                                        }`}
                                                >
                                                    Mensual
                                                </button>
                                                <button
                                                    onClick={() => setHistoryView('yearly')}
                                                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${historyView === 'yearly'
                                                        ? 'bg-blue-600 text-white'
                                                        : 'text-slate-400 hover:text-white'
                                                        }`}
                                                >
                                                    Anual
                                                </button>
                                            </div>
                                        </div>
                                        <div className="h-[240px]">
                                            {historyChartData.length > 0 ? (
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <BarChart data={historyChartData} className="cursor-pointer">
                                                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} vertical={false} />
                                                        <XAxis dataKey="period" stroke="#94a3b8" tick={{ fontSize: 12 }} tickFormatter={formatHistoryPeriod} />
                                                        <YAxis stroke="#94a3b8" tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`} tick={{ fontSize: 12 }} />
                                                        <Tooltip
                                                            contentStyle={{
                                                                backgroundColor: '#0f172a',
                                                                borderColor: '#334155',
                                                                borderRadius: '12px',
                                                                boxShadow: '0 10px 40px rgba(0,0,0,0.5)'
                                                            }}
                                                            labelStyle={{ color: '#94a3b8', fontWeight: 'bold' }}
                                                            labelFormatter={formatHistoryPeriod}
                                                            itemStyle={{ color: '#f8fafc' }}
                                                            formatter={(val) => fmt(val)}
                                                            cursor={{ fill: 'rgba(148, 163, 184, 0.1)' }}
                                                        />
                                                        <Legend />
                                                        <Bar
                                                            dataKey="ingreso"
                                                            name="Ingresos"
                                                            fill="#34d399"
                                                            radius={[4, 4, 0, 0]}
                                                            className="cursor-pointer hover:opacity-80"
                                                            onClick={(data) => handleHistoryBarClick(data, 'Ingresos')}
                                                            style={{ cursor: 'pointer' }}
                                                        />
                                                        <Bar
                                                            dataKey="gasto"
                                                            name="Gastos"
                                                            fill="#f87171"
                                                            radius={[4, 4, 0, 0]}
                                                            className="cursor-pointer hover:opacity-80"
                                                            onClick={(data) => handleHistoryBarClick(data, 'Gastos')}
                                                            style={{ cursor: 'pointer' }}
                                                        />
                                                    </BarChart>
                                                </ResponsiveContainer>
                                            ) : (
                                                <div className="h-full flex items-center justify-center text-slate-500 border border-dashed border-slate-700 rounded-xl">
                                                    No hay datos históricos
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Payment Methods Chart */}
                                <div className="mt-8">
                                    <ChartCard title="Medios de Pago" icon={<CreditCard className="text-blue-400" size={20} />}>
                                        {paymentMethods.length > 0 ? (
                                            <div className="h-[350px]">
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <PieChart>
                                                        <Pie
                                                            data={paymentMethods}
                                                            cx="50%"
                                                            cy="50%"
                                                            innerRadius={80}
                                                            outerRadius={120}
                                                            paddingAngle={5}
                                                            dataKey="value"
                                                            onClick={handleBankClick}
                                                            className="cursor-pointer"
                                                        >
                                                            {paymentMethods.map((entry, index) => (
                                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="rgba(0,0,0,0.2)" className="hover:opacity-80 transition-opacity" />
                                                            ))}
                                                        </Pie>
                                                        <Tooltip
                                                            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', boxShadow: '0 10px 40px rgba(0,0,0,0.5)' }}
                                                            labelStyle={{ color: '#94a3b8', fontWeight: 'bold' }}
                                                            itemStyle={{ color: '#f8fafc' }}
                                                            formatter={(val) => fmt(val)}
                                                            cursor={{ fill: 'transparent' }}
                                                        />
                                                        <Legend />
                                                    </PieChart>
                                                </ResponsiveContainer>
                                            </div>
                                        ) : (
                                            <div className="h-[300px] flex items-center justify-center text-slate-500 border border-dashed border-slate-700 rounded-xl">
                                                No hay datos de medios de pago
                                            </div>
                                        )}
                                    </ChartCard>
                                </div>
                            </div>
                        )}

                        {/* --- TAB: TRENDS (Real Comparison) --- */}
                        {activeTab === 'trends' && (
                            <div className="space-y-8 animate-in fade-in zoom-in duration-300">
                                <h2 className="text-2xl font-bold text-white text-center">📊 Comparativa de Periodos</h2>

                                {comparisonData ? (
                                    <>
                                        {/* Period Labels */}
                                        <div className="grid grid-cols-2 gap-4 text-center">
                                            <div className="bg-cyan-900/30 p-4 rounded-xl border border-cyan-700/50">
                                                <p className="text-cyan-400 text-sm font-bold">PERIODO ACTUAL</p>
                                                <p className="text-white text-lg">{comparisonData.current.start}</p>
                                                <p className="text-slate-400 text-sm">al {comparisonData.current.end}</p>
                                                <p className="text-cyan-300 text-xs mt-1">{comparisonData.current.days} días</p>
                                            </div>
                                            <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                                                <p className="text-slate-400 text-sm font-bold">PERIODO ANTERIOR</p>
                                                <p className="text-white text-lg">{comparisonData.previous.start}</p>
                                                <p className="text-slate-400 text-sm">al {comparisonData.previous.end}</p>
                                                <p className="text-slate-500 text-xs mt-1">{comparisonData.previous.days} días</p>
                                            </div>
                                        </div>

                                        {/* Comparison Cards */}
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                            {/* Ingresos Comparison */}
                                            <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700 hover:border-emerald-500/50 transition-colors">
                                                <h4 className="text-emerald-400 text-sm mb-4 font-bold">💰 INGRESOS</h4>
                                                <div className="space-y-3">
                                                    <div
                                                        className="flex justify-between cursor-pointer hover:bg-emerald-900/20 p-2 rounded-lg -m-2 transition-colors"
                                                        onClick={() => fetchDrillDownByType(comparisonData.current.start, comparisonData.current.end, 'Ingreso', `Ingresos Periodo Actual (${comparisonData.current.start} - ${comparisonData.current.end})`)}
                                                        title="Click para ver detalles"
                                                    >
                                                        <span className="text-slate-400">Actual:</span>
                                                        <span className="text-emerald-400 font-bold underline">{fmt(comparisonData.current.ingreso)}</span>
                                                    </div>
                                                    <div
                                                        className="flex justify-between cursor-pointer hover:bg-slate-700/30 p-2 rounded-lg -m-2 transition-colors"
                                                        onClick={() => fetchDrillDownByType(comparisonData.previous.start, comparisonData.previous.end, 'Ingreso', `Ingresos Periodo Anterior (${comparisonData.previous.start} - ${comparisonData.previous.end})`)}
                                                        title="Click para ver detalles"
                                                    >
                                                        <span className="text-slate-500">Anterior:</span>
                                                        <span className="text-slate-300 underline">{fmt(comparisonData.previous.ingreso)}</span>
                                                    </div>
                                                    <hr className="border-slate-700" />
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-slate-400">Cambio:</span>
                                                        <span className={`font-bold text-lg ${comparisonData.changes.ingreso_pct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                            {comparisonData.changes.ingreso_pct >= 0 ? '↑' : '↓'} {Math.abs(comparisonData.changes.ingreso_pct)}%
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Gastos Comparison */}
                                            <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700 hover:border-rose-500/50 transition-colors">
                                                <h4 className="text-rose-400 text-sm mb-4 font-bold">💸 GASTOS</h4>
                                                <div className="space-y-3">
                                                    <div
                                                        className="flex justify-between cursor-pointer hover:bg-rose-900/20 p-2 rounded-lg -m-2 transition-colors"
                                                        onClick={() => fetchDrillDownByType(comparisonData.current.start, comparisonData.current.end, 'Gasto', `Gastos Periodo Actual (${comparisonData.current.start} - ${comparisonData.current.end})`)}
                                                        title="Click para ver detalles"
                                                    >
                                                        <span className="text-slate-400">Actual:</span>
                                                        <span className="text-rose-400 font-bold underline">{fmt(comparisonData.current.gasto)}</span>
                                                    </div>
                                                    <div
                                                        className="flex justify-between cursor-pointer hover:bg-slate-700/30 p-2 rounded-lg -m-2 transition-colors"
                                                        onClick={() => fetchDrillDownByType(comparisonData.previous.start, comparisonData.previous.end, 'Gasto', `Gastos Periodo Anterior (${comparisonData.previous.start} - ${comparisonData.previous.end})`)}
                                                        title="Click para ver detalles"
                                                    >
                                                        <span className="text-slate-500">Anterior:</span>
                                                        <span className="text-slate-300 underline">{fmt(comparisonData.previous.gasto)}</span>
                                                    </div>
                                                    <hr className="border-slate-700" />
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-slate-400">Cambio:</span>
                                                        <span className={`font-bold text-lg ${comparisonData.changes.gasto_pct <= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                            {comparisonData.changes.gasto_pct >= 0 ? '↑' : '↓'} {Math.abs(comparisonData.changes.gasto_pct)}%
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Balance Comparison */}
                                            <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700">
                                                <h4 className="text-blue-400 text-sm mb-4 font-bold">⚖️ BALANCE</h4>
                                                <div className="space-y-3">
                                                    <div className="flex justify-between">
                                                        <span className="text-slate-400">Actual:</span>
                                                        <span className={`font-bold ${comparisonData.current.balance >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                            {fmt(comparisonData.current.balance)}
                                                        </span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-slate-500">Anterior:</span>
                                                        <span className={`${comparisonData.previous.balance >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                                                            {fmt(comparisonData.previous.balance)}
                                                        </span>
                                                    </div>
                                                    <hr className="border-slate-700" />
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-slate-400">Diferencia:</span>
                                                        <span className={`font-bold text-lg ${comparisonData.changes.balance_diff >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                            {comparisonData.changes.balance_diff >= 0 ? '+' : ''}{fmt(comparisonData.changes.balance_diff)}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Visual Bar Comparison */}
                                        <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700">
                                            <h3 className="text-lg font-bold text-slate-200 mb-6">Comparación Visual</h3>
                                            <p className="text-xs text-slate-500 mb-4">💡 Click en las barras para ver detalles</p>
                                            <div className="h-[250px]">
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <BarChart
                                                        data={[
                                                            {
                                                                name: 'Ingresos',
                                                                actual: comparisonData.current.ingreso,
                                                                anterior: comparisonData.previous.ingreso,
                                                                tipo: 'Ingreso',
                                                                color: '#10b981'
                                                            },
                                                            {
                                                                name: 'Gastos',
                                                                actual: comparisonData.current.gasto,
                                                                anterior: comparisonData.previous.gasto,
                                                                tipo: 'Gasto',
                                                                color: '#f43f5e'
                                                            },
                                                            {
                                                                name: 'Balance',
                                                                actual: comparisonData.current.balance,
                                                                anterior: comparisonData.previous.balance,
                                                                tipo: 'Balance',
                                                                color: '#3b82f6'
                                                            }
                                                        ]}
                                                        onClick={(data) => {
                                                            if (data && data.activePayload && data.activePayload[0]) {
                                                                const payload = data.activePayload[0].payload;
                                                                if (payload.tipo !== 'Balance') {
                                                                    fetchDrillDownByType(
                                                                        comparisonData.current.start,
                                                                        comparisonData.current.end,
                                                                        payload.tipo,
                                                                        `${payload.name} Periodo Actual`
                                                                    );
                                                                }
                                                            }
                                                        }}
                                                        style={{ cursor: 'pointer' }}
                                                    >
                                                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                                                        <XAxis dataKey="name" stroke="#94a3b8" />
                                                        <YAxis stroke="#94a3b8" tickFormatter={(val) => `$${Math.round(val / 1000)}k`} />
                                                        <Tooltip
                                                            contentStyle={{
                                                                backgroundColor: 'rgba(15, 23, 42, 0.95)', // Slate-900 casi opaco
                                                                borderColor: '#475569',
                                                                borderRadius: '12px',
                                                                color: '#ffffff',
                                                                boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
                                                                padding: '12px'
                                                            }}
                                                            itemStyle={{ color: '#e2e8f0', fontSize: '14px', padding: '2px 0' }}
                                                            labelStyle={{ color: '#ffffff', fontWeight: 'bold', marginBottom: '8px', fontSize: '15px' }}
                                                            cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                                            formatter={(val) => [fmt(val), null]}
                                                        />
                                                        <Legend />
                                                        <Bar
                                                            dataKey="actual"
                                                            name="Periodo Actual"
                                                            radius={[6, 6, 0, 0]}
                                                            onClick={(data) => {
                                                                if (data && data.tipo !== 'Balance') {
                                                                    fetchDrillDownByType(
                                                                        comparisonData.current.start,
                                                                        comparisonData.current.end,
                                                                        data.tipo,
                                                                        `${data.name} Periodo Actual`
                                                                    );
                                                                }
                                                            }}
                                                            style={{ cursor: 'pointer', outline: 'none' }}
                                                        >
                                                            {[
                                                                { color: '#10b981' },
                                                                { color: '#f43f5e' },
                                                                { color: '#3b82f6' }
                                                            ].map((entry, index) => (
                                                                <Cell key={`cell-actual-${index}`} fill={entry.color} style={{ outline: 'none' }} />
                                                            ))}
                                                        </Bar>
                                                        <Bar
                                                            dataKey="anterior"
                                                            name="Periodo Anterior"
                                                            radius={[6, 6, 0, 0]}
                                                            onClick={(data) => {
                                                                if (data && data.tipo !== 'Balance') {
                                                                    fetchDrillDownByType(
                                                                        comparisonData.previous.start,
                                                                        comparisonData.previous.end,
                                                                        data.tipo,
                                                                        `${data.name} Periodo Anterior`
                                                                    );
                                                                }
                                                            }}
                                                            style={{ cursor: 'pointer', outline: 'none' }}
                                                            fillOpacity={0.5}
                                                        >
                                                            {[
                                                                { color: '#10b98155' },
                                                                { color: '#f43f5e55' },
                                                                { color: '#3b82f655' }
                                                            ].map((entry, index) => (
                                                                <Cell key={`cell-anterior-${index}`} fill={entry.color} />
                                                            ))}
                                                        </Bar>
                                                    </BarChart>
                                                </ResponsiveContainer>
                                            </div>
                                        </div>

                                        {/* Summary Message */}
                                        <div className={`p-4 rounded-xl text-center ${comparisonData.changes.balance_diff >= 0 ? 'bg-emerald-900/30 border border-emerald-700/50' : 'bg-rose-900/30 border border-rose-700/50'}`}>
                                            <p className="text-lg">
                                                {comparisonData.changes.balance_diff >= 0
                                                    ? '✅ ¡Mejoraste respecto al periodo anterior!'
                                                    : '⚠️ Tu balance empeoró respecto al periodo anterior'}
                                            </p>
                                            <p className="text-slate-400 text-sm mt-1">
                                                Diferencia de balance: <strong className={comparisonData.changes.balance_diff >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                                                    {comparisonData.changes.balance_diff >= 0 ? '+' : ''}{fmt(comparisonData.changes.balance_diff)}
                                                </strong>
                                            </p>
                                        </div>
                                    </>
                                ) : (
                                    <div className="text-center text-slate-500 py-20">
                                        <p>Cargando comparación...</p>
                                    </div>
                                )}
                            </div>
                        )}
                        {/* Closes min-h-[600px] */}
                    </div>
                )}

                {/* Drill Down Modal */}
                <DrillDownModal
                    isOpen={ddOpen}
                    onClose={() => setDdOpen(false)}
                    title={ddTitle}
                    transactions={ddTransactions}
                    evolutionData={ddEvolution}
                    onEditTransaction={handleEditTransaction}
                />

                {/* Edit Transaction Modal */}
                {editingTx && (
                    <EditTransactionModal
                        isOpen={!!editingTx}
                        onClose={() => setEditingTx(null)}
                        transaction={editingTx}
                        onUpdate={handleTransactionUpdate}
                        onDelete={handleDeleteTransaction}
                        environment={environment}
                    />
                )}
            </div>
        </div>
    );
}

// Helper Components for Cleaner JSX
function KpiCard({ title, value, sub, icon, color }) {
    const colorClasses = {
        indigo: 'text-indigo-400',
        emerald: 'text-emerald-400',
        yellow: 'text-yellow-400',
        rose: 'text-rose-400',
        cyan: 'text-cyan-400'
    };

    const bgClasses = {
        indigo: 'bg-indigo-500/20 border-indigo-500/30',
        emerald: 'bg-emerald-500/20 border-emerald-500/30',
        yellow: 'bg-yellow-500/20 border-yellow-500/30',
        rose: 'bg-rose-500/20 border-rose-500/30',
        cyan: 'bg-cyan-500/20 border-cyan-500/30'
    };

    const textColor = colorClasses[color] || 'text-slate-400';
    const bgColor = bgClasses[color] || 'bg-slate-800/50 border-slate-700';

    return (
        <div className={`p-6 rounded-2xl border relative overflow-hidden group transition-all ${bgColor}`}>
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                {icon}
            </div>
            <div className="flex items-center gap-3 mb-2">
                <div className={`p-2 rounded-lg bg-black/20 ${textColor}`}>
                    {icon}
                </div>
                <h3 className="font-bold text-slate-300">{title}</h3>
            </div>
            <p className="text-4xl font-bold text-white mb-1">{value}</p>
            <p className="text-xs text-slate-400">{sub}</p>
        </div>
    );
}

function ChartCard({ title, icon, children }) {
    return (
        <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700 shadow-xl min-h-[400px] flex flex-col">
            <h3 className="font-bold text-slate-200 mb-6 flex items-center gap-2">
                {icon} {title}
            </h3>
            <div className="flex-1 w-full relative">
                {children}
            </div>
        </div>
    );
}
