import { useState, useEffect } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend, LineChart, Line
} from 'recharts';
import {
    X, Calendar, PieChart as PieIcon, BarChart3, Hourglass,
    PiggyBank, Flame, TrendingUp, List, CreditCard, Target, AlertCircle, Download
} from 'lucide-react';
import DrillDownModal from './DrillDownModal';
import BudgetManager from './BudgetManager';
import SubscriptionsModal from './SubscriptionsModal';
import { API_URL } from "../config";

const COLORS = ['#818cf8', '#34d399', '#f472b6', '#fbbf24', '#60a5fa', '#a78bfa', '#f87171'];
const BARS_COLORS = ['#38bdf8', '#34d399', '#f472b6', '#fbbf24'];

export default function AdvancedReports({ isOpen, onClose, totalNetWorth = 0, environment = "TEST" }) {
    const [dateRange, setDateRange] = useState({
        start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0], // First day of current month
        end: new Date().toISOString().split('T')[0]
    });

    // Data States
    const [data, setData] = useState({ pie_data: [], bar_data: [] });
    const [analysisData, setAnalysisData] = useState({ top_expenses: [], payment_methods: [] });
    const [forecastData, setForecastData] = useState([]);
    const [subsData, setSubsData] = useState([]);
    const [subModalOpen, setSubModalOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('summary'); // summary, trends, breakdown
    const [comparisonData, setComparisonData] = useState(null);

    // Drill Down State
    const [ddOpen, setDdOpen] = useState(false);
    const [ddTitle, setDdTitle] = useState('');
    const [ddTransactions, setDdTransactions] = useState([]);
    const [ddEvolution, setDdEvolution] = useState([]);

    const formatMonth = (dateStr) => {
        if (!dateStr || dateStr === 'Desconocido') return dateStr;
        const [year, month] = dateStr.split('-');
        const date = new Date(year, month - 1);
        return date.toLocaleDateString('es-CL', { month: 'short', year: '2-digit' });
    };

    useEffect(() => {
        if (isOpen) {
            fetchReports();
            fetchAnalysis();
            fetchForecast();
            fetchSubscriptions();
            fetchComparison();
        }
    }, [isOpen, dateRange, environment]);

    const fetchReports = async () => {
        setLoading(true);
        try {
            const query = new URLSearchParams({
                start_date: dateRange.start,
                end_date: dateRange.end,
                environment: environment
            });

            const res = await fetch(`${API_URL}/reports?${query}`);
            const json = await res.json();
            setData(json);
        } catch (error) {
            console.error("Error fetching reports:", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchAnalysis = async () => {
        try {
            const query = new URLSearchParams({
                start_date: dateRange.start,
                end_date: dateRange.end,
                environment: environment
            });
            const res = await fetch(`${API_URL}/analysis?${query}`);
            const json = await res.json();
            setAnalysisData(json);
        } catch (error) {
            console.error("Error fetching analysis:", error);
        }
    };

    const fetchForecast = async () => {
        try {
            const res = await fetch(`${API_URL}/forecasting`);
            const json = await res.json();
            setForecastData(json);
        } catch (error) {
            console.error("Error fetching forecast:", error);
        }
    };

    const fetchSubscriptions = async () => {
        try {
            const res = await fetch(`${API_URL}/subscriptions?environment=${environment}`);
            const json = await res.json();
            setSubsData(json);
        } catch (error) {
            console.error("Error fetching subscriptions:", error);
        }
    };

    const fetchComparison = async () => {
        try {
            const query = new URLSearchParams({
                start_date: dateRange.start,
                end_date: dateRange.end,
                environment: environment
            });
            const res = await fetch(`${API_URL}/comparison?${query}`);
            const json = await res.json();
            setComparisonData(json);
        } catch (error) {
            console.error("Error fetching comparison:", error);
        }
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
        // Merge filters with current date range
        const params = new URLSearchParams(filters);

        // If not specific specific dates passed (like for monthly bar), use global range
        if (!filters.start_date && !filters.end_date) {
            params.append('start_date', dateRange.start);
            params.append('end_date', dateRange.end);
        }

        try {
            const res = await fetch(`${API_URL}/transactions?${params}&limit=0&environment=${environment}`);
            const json = await res.json();
            setDdTransactions(json);
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
            const params = new URLSearchParams({
                start_date: startDate,
                end_date: endDate,
                environment: environment,
                limit: 0
            });
            const res = await fetch(`${API_URL}/transactions?${params}`);
            const json = await res.json();

            // Filter by tipo (Ingreso has ingreso > 0, Gasto has gasto > 0)
            const filtered = json.filter(tx =>
                tipo === 'Ingreso' ? tx.ingreso > 0 : tx.gasto > 0
            );

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

        // Fetch History
        try {
            const query = new URLSearchParams({
                start_date: dateRange.start,
                end_date: dateRange.end,
                filter_col: 'detalle',
                filter_val: itemName
            });
            const res = await fetch(`${API_URL}/history?${query}`);
            const hist = await res.json();
            setDdEvolution(hist);
        } catch (e) {
            console.error("History fetch failed", e);
            setDdEvolution([]);
        }

        fetchDrillDown({ detalle: itemName }, `Detalle: ${itemName}`);
    };

    const handleBankClick = (data) => {
        if (!data) return;
        fetchDrillDown({ bank: data.name }, `Transacciones: ${data.name}`);
    };


    const fmt = (num) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(num);

    // --- KPI Calculations ---
    const barData = Array.isArray(data.bar_data) ? data.bar_data : [];
    const pieData = Array.isArray(data.pie_data) ? data.pie_data : [];
    const topExpenses = analysisData && Array.isArray(analysisData.top_expenses) ? analysisData.top_expenses : [];
    const paymentMethods = analysisData && Array.isArray(analysisData.payment_methods) ? analysisData.payment_methods : [];
    const forecast = Array.isArray(forecastData) ? forecastData : [];

    const totalIncome = barData.reduce((acc, curr) => acc + (curr.ingreso || 0), 0);
    const totalExpense = barData.reduce((acc, curr) => acc + (curr.gasto || 0), 0);

    const start = new Date(dateRange.start);
    const end = new Date(dateRange.end);
    const diffTime = Math.abs(end - start);
    const diffDays = Math.max(Math.ceil(diffTime / (1000 * 60 * 60 * 24)), 1);

    // 1. Runway (Months)
    const monthlyExpenseAvg = totalExpense / (diffDays / 30);
    const runway = monthlyExpenseAvg > 0 ? (totalNetWorth / monthlyExpenseAvg).toFixed(1) : "∞";

    // 2. Savings Rate
    const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome) * 100 : 0;

    // 3. Burn Rate (Daily)
    const burnRate = totalExpense / diffDays;

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900 z-40 overflow-y-auto">
            <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-8">

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
                                onClick={() => setSubModalOpen(true)}
                                className="bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 px-3 py-2 rounded-lg border border-purple-500/50 transition-all text-sm flex items-center gap-2"
                                title="Detecta gastos recurrentes automáticos (Netflix, Spotify, etc.)"
                            >
                                <AlertCircle size={16} />
                                <span className="hidden md:inline">{subsData.length > 0 ? `${subsData.length} Subs` : 'Detector'}</span>
                            </button>
                            <button
                                onClick={handleExport}
                                className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 px-3 py-2 rounded-lg border border-emerald-500/50 transition-all text-sm flex items-center gap-2"
                                title="Exportar a Excel"
                            >
                                <Download size={16} />
                                <span className="hidden md:inline">Excel</span>
                            </button>
                        </div>

                        {/* Date Picker */}
                        <div className="flex items-center gap-2 bg-slate-900 p-2 rounded-lg border border-slate-700">
                            <Calendar size={16} className="text-slate-400" />
                            <input
                                type="date"
                                value={dateRange.start}
                                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                                className="bg-transparent text-white text-sm focus:outline-none w-24"
                            />
                            <span className="text-slate-600">-</span>
                            <input
                                type="date"
                                value={dateRange.end}
                                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                                className="bg-transparent text-white text-sm focus:outline-none w-24"
                            />
                        </div>

                        {/* Tabs Navigation */}
                        <div className="flex bg-slate-900/50 p-1 rounded-lg border border-slate-700 overflow-x-auto max-w-[300px] md:max-w-none">
                            <button
                                onClick={() => setActiveTab('summary')}
                                className={`px-3 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap ${activeTab === 'summary' ? 'bg-indigo-500 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                            >
                                <div className="flex items-center gap-2">
                                    <PieIcon size={16} /> <span className="hidden sm:inline">Resumen</span>
                                </div>
                            </button>
                            <button
                                onClick={() => setActiveTab('trends')}
                                className={`px-3 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap ${activeTab === 'trends' ? 'bg-indigo-500 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                            >
                                <div className="flex items-center gap-2">
                                    <TrendingUp size={16} /> <span className="hidden sm:inline">Tendencia</span>
                                </div>
                            </button>
                            <button
                                onClick={() => setActiveTab('breakdown')}
                                className={`px-3 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap ${activeTab === 'breakdown' ? 'bg-indigo-500 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                            >
                                <div className="flex items-center gap-2">
                                    <List size={16} /> <span className="hidden sm:inline">Desglose</span>
                                </div>
                            </button>
                            <button
                                onClick={() => setActiveTab('budgets')}
                                className={`px-3 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap ${activeTab === 'budgets' ? 'bg-indigo-500 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                            >
                                <div className="flex items-center gap-2">
                                    <Target size={16} /> <span className="hidden sm:inline">Metas</span>
                                </div>
                            </button>
                        </div>

                        <button onClick={onClose} className="p-2 bg-slate-700 rounded-lg hover:bg-slate-600 transition-colors text-white">
                            <X size={24} />
                        </button>
                    </div>
                </header>

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
                                {/* KPI Cards */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <KpiCard
                                        title="Runway"
                                        value={`${runway} meses`}
                                        sub="Libertad financiera teórica"
                                        icon={<Hourglass size={20} />}
                                        color="indigo"
                                    />
                                    <KpiCard
                                        title="Tasa de Ahorro"
                                        value={`${savingsRate.toFixed(1)}%`}
                                        sub="% Ingresos retenidos"
                                        icon={<PiggyBank size={20} />}
                                        color={savingsRate >= 20 ? 'emerald' : 'yellow'}
                                    />
                                    <KpiCard
                                        title="Burn Rate Diario"
                                        value={fmt(burnRate)}
                                        sub="Gasto promedio por día"
                                        icon={<Flame size={20} />}
                                        color="rose"
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <ChartCard title="Distribución de Gastos" icon={<PieIcon className="text-pink-400" size={20} />}>
                                        {pieData.length > 0 ? (
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Pie
                                                        data={pieData}
                                                        cx="50%"
                                                        cy="50%"
                                                        innerRadius={60}
                                                        outerRadius={100}
                                                        paddingAngle={5}
                                                        dataKey="value"
                                                        onClick={handlePieClick}
                                                        className="cursor-pointer focus:outline-none"
                                                    >
                                                        {pieData.map((entry, index) => (
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
                                        ) : (
                                            <div className="absolute inset-0 flex items-center justify-center text-slate-500 border border-dashed border-slate-700 rounded-xl">
                                                No hay gastos en este periodo
                                            </div>
                                        )}
                                    </ChartCard>

                                    <ChartCard title="Histórico Mensual" icon={<BarChart3 className="text-purple-400" size={20} />}>
                                        {barData.length > 0 ? (
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={barData} onClick={handleBarClick} className="cursor-pointer">
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} vertical={false} />
                                                    <XAxis dataKey="month" stroke="#94a3b8" tick={{ fontSize: 12 }} tickFormatter={formatMonth} />
                                                    <YAxis stroke="#94a3b8" tickFormatter={(val) => `$${val / 1000}k`} tick={{ fontSize: 12 }} />
                                                    <Tooltip
                                                        contentStyle={{
                                                            backgroundColor: '#0f172a',
                                                            borderColor: '#334155',
                                                            borderRadius: '12px',
                                                            boxShadow: '0 10px 40px rgba(0,0,0,0.5)'
                                                        }}
                                                        labelStyle={{ color: '#94a3b8', fontWeight: 'bold' }}
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
                                                        onClick={(data) => handleIngresoBarClick(data, data?.month)}
                                                        className="cursor-pointer hover:opacity-80"
                                                    />
                                                    <Bar
                                                        dataKey="gasto"
                                                        name="Gastos"
                                                        fill="#f87171"
                                                        radius={[4, 4, 0, 0]}
                                                        onClick={(data) => handleGastoBarClick(data, data?.month)}
                                                        className="cursor-pointer hover:opacity-80"
                                                    />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        ) : (
                                            <div className="absolute inset-0 flex items-center justify-center text-slate-500 border border-dashed border-slate-700 rounded-xl">
                                                No hay datos históricos
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
                                                                backgroundColor: '#0f172a',
                                                                borderColor: '#334155',
                                                                borderRadius: '12px',
                                                                boxShadow: '0 10px 40px rgba(0,0,0,0.5)'
                                                            }}
                                                            cursor={{ fill: 'transparent' }}
                                                            formatter={(val) => fmt(val)}
                                                            labelStyle={{ color: '#f1f5f9' }}
                                                        />
                                                        <Legend />
                                                        <Bar
                                                            dataKey="actual"
                                                            name="Periodo Actual"
                                                            radius={[6, 6, 0, 0]}
                                                        >
                                                            {[
                                                                { color: '#10b981' },
                                                                { color: '#f43f5e' },
                                                                { color: '#3b82f6' }
                                                            ].map((entry, index) => (
                                                                <Cell key={`cell-actual-${index}`} fill={entry.color} />
                                                            ))}
                                                        </Bar>
                                                        <Bar
                                                            dataKey="anterior"
                                                            name="Periodo Anterior"
                                                            radius={[6, 6, 0, 0]}
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

                        {/* --- TAB: BREAKDOWN --- */}
                        {activeTab === 'breakdown' && (
                            <div className="space-y-8 animate-in fade-in zoom-in duration-300">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

                                    {/* Top 10 Expenses */}
                                    <ChartCard title="Top 10 Gastos Individuales" icon={<List className="text-yellow-400" size={20} />}>
                                        {topExpenses.length > 0 ? (
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart
                                                    layout="vertical"
                                                    data={topExpenses}
                                                    className="cursor-pointer"
                                                    margin={{ left: 20 }} // Space for strict labels
                                                >
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} horizontal={false} />
                                                    <XAxis type="number" stroke="#94a3b8" hide />
                                                    <YAxis
                                                        dataKey="name"
                                                        type="category"
                                                        stroke="#cbd5e1"
                                                        width={100}
                                                        tick={{ fontSize: 11 }}
                                                    />
                                                    <Tooltip
                                                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', boxShadow: '0 10px 40px rgba(0,0,0,0.5)' }}
                                                        labelStyle={{ color: '#94a3b8', fontWeight: 'bold' }}
                                                        itemStyle={{ color: '#f8fafc' }}
                                                        formatter={(val) => fmt(val)}
                                                        cursor={{ fill: 'transparent' }}
                                                    />
                                                    <Bar dataKey="value" fill="#fbbf24" radius={[0, 4, 4, 0]} onClick={handleTopItemClick}>
                                                        {topExpenses.map((entry, index) => (
                                                            <Cell key={`cell-${index}`} fill={BARS_COLORS[index % BARS_COLORS.length]} />
                                                        ))}
                                                    </Bar>
                                                </BarChart>
                                            </ResponsiveContainer>
                                        ) : (
                                            <div className="absolute inset-0 flex items-center justify-center text-slate-500 border border-dashed border-slate-700 rounded-xl">
                                                No hay gastos individuales significativos
                                            </div>
                                        )}
                                    </ChartCard>

                                    {/* Payment Methods */}
                                    <ChartCard title="Medios de Pago" icon={<CreditCard className="text-blue-400" size={20} />}>
                                        {paymentMethods.length > 0 ? (
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Pie
                                                        data={paymentMethods}
                                                        cx="50%"
                                                        cy="50%"
                                                        innerRadius={60}
                                                        outerRadius={100}
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
                                        ) : (
                                            <div className="absolute inset-0 flex items-center justify-center text-slate-500 border border-dashed border-slate-700 rounded-xl">
                                                No hay datos de medios de pago
                                            </div>
                                        )}
                                    </ChartCard>
                                </div>
                            </div>
                        )}

                        {/* --- TAB: BUDGETS --- */}
                        {activeTab === 'budgets' && (
                            <div className="animate-in fade-in zoom-in duration-300">
                                <BudgetManager isOpen={true} environment={environment} />
                            </div>
                        )}

                    </div>
                )}

                <DrillDownModal
                    isOpen={ddOpen}
                    onClose={() => setDdOpen(false)}
                    title={ddTitle}
                    transactions={ddTransactions}
                    evolutionData={ddEvolution}
                />

                <SubscriptionsModal
                    isOpen={subModalOpen}
                    onClose={() => setSubModalOpen(false)}
                    subscriptions={subsData}
                />
            </div>
        </div>
    );
}

// Helper Components for Cleaner JSX
function KpiCard({ title, value, sub, icon, color }) {
    const colorClasses = {
        indigo: 'text-indigo-400 bg-indigo-500/20 hover:border-indigo-500/50',
        emerald: 'text-emerald-400 bg-emerald-500/20 hover:border-emerald-500/50',
        yellow: 'text-yellow-400 bg-yellow-500/20 hover:border-yellow-500/50',
        rose: 'text-rose-400 bg-rose-500/20 hover:border-rose-500/50',
    };

    return (
        <div className={`bg-slate-800/50 p-6 rounded-2xl border border-slate-700 relative overflow-hidden group transition-all ${colorClasses[color] ? colorClasses[color].split(' ')[2] : ''}`}>
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                {icon}
            </div>
            <div className="flex items-center gap-3 mb-2">
                <div className={`p-2 rounded-lg ${colorClasses[color] ? colorClasses[color].split(' ')[0] + ' ' + colorClasses[color].split(' ')[1] : ''}`}>
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
