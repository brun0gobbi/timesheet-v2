import React, { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts';
import { Home, Briefcase, Filter, TrendingUp } from 'lucide-react';
import rawData from '../data/data.json';
import './StrategicActivity.css';

// Types
interface Entry {
    p: string; // Person
    n: string; // Nucleo
    c: string; // Client
    e: string; // Activity
    t: number; // Time in minutes
    monthId?: string; // Injected for time series
}

interface MonthData {
    id: string;
    name: string;
    rawEntries?: Entry[];
}

interface DashboardData {
    months: MonthData[];
}

const data = rawData as unknown as DashboardData;

const COLORS = ['#003763', '#f4da40', '#ef4444', '#10b981', '#8b5cf6', '#ec4899', '#06b6d4', '#64748b'];

const StrategicActivity: React.FC = () => {
    // Scroll to top on load
    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    // Top-level filters
    const availableMonths = data.months.map(m => m.id);
    const defaultEndMonth = availableMonths[availableMonths.length - 1] || '';
    const defaultStartMonth = availableMonths[0] || '';

    const [startMonth, setStartMonth] = useState(defaultStartMonth);
    const [endMonth, setEndMonth] = useState(defaultEndMonth);

    // Extracted data for the selected date range
    const rawEntries = useMemo(() => {
        const startIndex = availableMonths.indexOf(startMonth);
        const endIndex = availableMonths.indexOf(endMonth);

        // Handle invalid indices or edge cases gracefully
        if (startIndex === -1 || endIndex === -1) return [];

        const minIndex = Math.min(startIndex, endIndex);
        const maxIndex = Math.max(startIndex, endIndex);

        const selectedRange = availableMonths.slice(minIndex, maxIndex + 1);

        return selectedRange.reduce((acc, monthId) => {
            const monthData = data.months.find(m => m.id === monthId);
            if (monthData && monthData.rawEntries) {
                const enriched = monthData.rawEntries.map(e => ({ ...e, monthId }));
                return [...acc, ...enriched];
            }
            return acc;
        }, [] as Entry[]);
    }, [startMonth, endMonth, availableMonths]);

    // Data-derived filters
    const allNucleos = useMemo(() => Array.from(new Set(rawEntries.map(e => e.n))).filter(Boolean).sort(), [rawEntries]);
    const allClients = useMemo(() => Array.from(new Set(rawEntries.map(e => e.c))).filter(Boolean).sort(), [rawEntries]);
    const allPeople = useMemo(() => Array.from(new Set(rawEntries.map(e => e.p))).filter(Boolean).sort(), [rawEntries]);

    // Clean activity names for the filter list consistently
    const allActivities = useMemo(() => {
        const uniqueActs = new Set<string>();
        rawEntries.forEach(e => {
            let actName = e.e || 'Não Informado';
            if (actName.startsWith('[Timesheet] - ')) {
                actName = actName.replace('[Timesheet] - ', '');
            }
            if (actName) uniqueActs.add(actName);
        });
        return Array.from(uniqueActs).sort();
    }, [rawEntries]);

    // Active filters
    const [selectedNucleo, setSelectedNucleo] = useState<string>('');
    const [selectedClient, setSelectedClient] = useState<string>('');
    const [selectedPerson, setSelectedPerson] = useState<string>('');
    const [selectedActivity, setSelectedActivity] = useState<string>('');

    // Filter logic
    const filteredEntries = useMemo(() => {
        return rawEntries.filter(entry => {
            if (selectedNucleo && entry.n !== selectedNucleo) return false;
            if (selectedClient && entry.c !== selectedClient) return false;
            if (selectedPerson && entry.p !== selectedPerson) return false;

            // Re-apply cleaning logic for filtering by activity
            if (selectedActivity) {
                let actName = entry.e || 'Não Informado';
                if (actName.startsWith('[Timesheet] - ')) actName = actName.replace('[Timesheet] - ', '');
                if (actName !== selectedActivity) return false;
            }
            return true;
        });
    }, [rawEntries, selectedNucleo, selectedClient, selectedPerson, selectedActivity]);

    // Data Aggregation
    const activityData = useMemo(() => {
        const acc: Record<string, { activity: string; minutes: number; entries: number }> = {};

        filteredEntries.forEach(entry => {
            // Clean task name
            let actName = entry.e || 'Não Informado';
            if (actName.startsWith('[Timesheet] - ')) {
                actName = actName.replace('[Timesheet] - ', '');
            }

            if (!acc[actName]) {
                acc[actName] = { activity: actName, minutes: 0, entries: 0 };
            }
            acc[actName].minutes += entry.t;
            acc[actName].entries += 1;
        });

        return Object.values(acc)
            .map(item => ({
                ...item,
                hours: Number((item.minutes / 60).toFixed(1))
            }))
            .sort((a, b) => b.minutes - a.minutes)
            .slice(0, 20); // top 20 para performance

    }, [filteredEntries]);

    // Pie chart logic
    const pieData = useMemo(() => {
        if (activityData.length <= 8) return activityData;

        const top7 = activityData.slice(0, 7);
        const others = activityData.slice(7).reduce((acc, curr) => ({
            activity: 'Outros',
            minutes: acc.minutes + curr.minutes,
            entries: acc.entries + curr.entries,
            hours: acc.hours + curr.hours,
        }), { activity: 'Outros', minutes: 0, entries: 0, hours: 0 });

        return [...top7, others];
    }, [activityData]);

    // Time Series logic (Line Chart)
    const timeSeriesData = useMemo(() => {
        let activitiesToTrack: string[] = [];
        if (selectedActivity) {
            activitiesToTrack = [selectedActivity];
        } else {
            // Track Top 5 activities from the overall filtered period
            activitiesToTrack = activityData.slice(0, 5).map(a => a.activity);
        }

        if (activitiesToTrack.length === 0) return { data: [], lines: [] };

        const startIndex = availableMonths.indexOf(startMonth);
        const endIndex = availableMonths.indexOf(endMonth);
        if (startIndex === -1 || endIndex === -1) return { data: [], lines: [] };

        const minIndex = Math.min(startIndex, endIndex);
        const maxIndex = Math.max(startIndex, endIndex);
        const selectedRange = availableMonths.slice(minIndex, maxIndex + 1);

        const seriesMap: Record<string, any> = {};
        selectedRange.forEach(monthId => {
            seriesMap[monthId] = { name: monthId, displayName: monthId };

            // Try to make a shorter name for XAxis (e.g. "1. Janeiro 2026" -> "Jan/26")
            const parts = monthId.split(' ');
            if (parts.length >= 3) {
                seriesMap[monthId].displayName = `${parts[1].substring(0, 3)}/${parts[2].substring(2)}`;
            }

            activitiesToTrack.forEach(act => { seriesMap[monthId][act] = 0; });
        });

        filteredEntries.forEach(entry => {
            const mId = entry.monthId;
            if (!mId || !seriesMap[mId]) return;

            let actName = entry.e || 'Não Informado';
            if (actName.startsWith('[Timesheet] - ')) actName = actName.replace('[Timesheet] - ', '');

            if (activitiesToTrack.includes(actName)) {
                seriesMap[mId][actName] += entry.t;
            }
        });

        const formattedData = Object.values(seriesMap).map(dataPoint => {
            const formattedPoint = { ...dataPoint };
            activitiesToTrack.forEach(act => {
                formattedPoint[act] = Number((formattedPoint[act] / 60).toFixed(1));
            });
            return formattedPoint;
        });

        return { data: formattedData, lines: activitiesToTrack };
    }, [filteredEntries, activityData, selectedActivity, startMonth, endMonth, availableMonths]);

    const formatHours = (min: number) => `${Math.floor(min / 60)}h ${min % 60}m`;
    const totalFilteredMinutes = filteredEntries.reduce((sum, e) => sum + e.t, 0);

    return (
        <div className="min-h-screen bg-slate-50 font-['Texta'] text-slate-800 pb-10">
            <nav className="bg-slate-900 text-white shadow-md p-4 sticky top-0 z-50">
                <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center space-x-4">
                        <Link to="/" className="hover:text-blue-400 transition-colors" title="Voltar para a página inicial">
                            <Home size={24} />
                        </Link>
                        <h1 className="text-xl font-bold truncate">Análise de Atividades</h1>
                    </div>
                    <Link
                        to="/"
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors text-sm whitespace-nowrap ml-auto"
                    >
                        Voltar para Home
                    </Link>
                </div>
            </nav>

            <main className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8 space-y-6">

                {/* Header & Global Filters */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <div className="flex flex-col md:flex-row gap-6">
                        <div className="flex-1 flex flex-col md:flex-row gap-4">
                            <div className="flex-1">
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Mês Inicial</label>
                                <select
                                    title="Selecione o mês de início da análise"
                                    value={startMonth}
                                    onChange={(e) => setStartMonth(e.target.value)}
                                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:ring-2 focus:ring-brand-blue/20 outline-none"
                                >
                                    {availableMonths.map(m => (
                                        <option key={m} value={m}>{m}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex-1">
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Mês Final</label>
                                <select
                                    title="Selecione o mês de fim da análise"
                                    value={endMonth}
                                    onChange={(e) => setEndMonth(e.target.value)}
                                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:ring-2 focus:ring-brand-blue/20 outline-none"
                                >
                                    {availableMonths.map(m => (
                                        <option key={m} value={m}>{m}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="flex-1 flex gap-4">
                            <div className="flex-1 bg-brand-blue/5 rounded-lg p-4 border border-brand-blue/10">
                                <p className="text-sm font-medium text-slate-500 mb-1">Total (Filtro)</p>
                                <p className="text-2xl font-bold text-brand-blue">{formatHours(totalFilteredMinutes)}</p>
                            </div>
                            <div className="flex-1 bg-brand-yellow/10 rounded-lg p-4 border border-brand-yellow/20">
                                <p className="text-sm font-medium text-slate-500 mb-1">Lançamentos</p>
                                <p className="text-2xl font-bold text-slate-800">{filteredEntries.length}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Detailed Filters */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <div className="flex items-center gap-2 mb-4 text-brand-blue">
                        <Filter size={20} />
                        <h2 className="text-lg font-bold">Filtros de Cruzamento</h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Núcleo</label>
                            <div className="relative">
                                <select
                                    title="Filtrar por núcleo"
                                    value={selectedNucleo}
                                    onChange={(e) => setSelectedNucleo(e.target.value)}
                                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                                >
                                    <option value="">Todos os Núcleos</option>
                                    {allNucleos.map(n => <option key={n} value={n}>{n}</option>)}
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Cliente</label>
                            <div className="relative">
                                <select
                                    title="Filtrar por cliente"
                                    value={selectedClient}
                                    onChange={(e) => setSelectedClient(e.target.value)}
                                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                                >
                                    <option value="">Todos os Clientes</option>
                                    {allClients.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Colaborador</label>
                            <div className="relative">
                                <select
                                    title="Filtrar por colaborador"
                                    value={selectedPerson}
                                    onChange={(e) => setSelectedPerson(e.target.value)}
                                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                                >
                                    <option value="">Todos os Colaboradores</option>
                                    {allPeople.map(p => <option key={p} value={p}>{p}</option>)}
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Atividade</label>
                            <div className="relative">
                                <select
                                    title="Filtrar por atividade específica"
                                    value={selectedActivity}
                                    onChange={(e) => setSelectedActivity(e.target.value)}
                                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                                >
                                    <option value="">Todas as Atividades</option>
                                    {allActivities.map(a => <option key={a} value={a}>{a}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Charts Area */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Bar Chart */}
                    <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col">
                        <div className="flex items-center gap-2 mb-6 text-brand-blue shrink-0">
                            <Briefcase size={20} />
                            <h2 className="text-lg font-bold">Top Atividades (Horas)</h2>
                        </div>
                        <div className="flex-1 w-full min-h-[400px]">
                            {activityData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%" minHeight={400}>
                                    <BarChart data={activityData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                                        <XAxis type="number" hide />
                                        <YAxis
                                            dataKey="activity"
                                            type="category"
                                            width={180}
                                            tick={{ fontSize: 11 }}
                                            tickFormatter={(value) => value.length > 25 ? `${value.substring(0, 22)}...` : value}
                                        />
                                        <Tooltip formatter={(value) => [`${value} horas`, 'Tempo Gasto']} />
                                        <Bar dataKey="hours" fill="#003763" radius={[0, 4, 4, 0]}>
                                            {activityData.map((_, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-full flex items-center justify-center text-slate-400">Nenhuma atividade com este filtro.</div>
                            )}
                        </div>
                    </div>

                    {/* Pie Chart */}
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col">
                        <h2 className="text-lg font-bold text-brand-blue mb-6 shrink-0">Distribuição</h2>
                        <div className="flex-1 w-full min-h-[300px]">
                            {pieData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%" minHeight={300}>
                                    <PieChart>
                                        <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="hours" nameKey="activity">
                                            {pieData.map((_, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip formatter={(value) => [`${value} horas`, 'Tempo Gasto']} />
                                    </PieChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-full flex items-center justify-center text-slate-400 text-sm">Sem dados.</div>
                            )}
                        </div>
                        <div className="mt-4 space-y-2 max-h-[140px] overflow-y-auto pr-2">
                            {pieData.map((item, index) => (
                                <div key={index} className="flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-2 max-w-[70%]">
                                        <div className="strategic-activity-color-box" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                                        <span className="truncate text-slate-600" title={item.activity}>{item.activity}</span>
                                    </div>
                                    <span className="font-semibold text-slate-800">{item.hours}h</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Line Chart Area */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
                        <div className="flex items-center gap-2 text-brand-blue">
                            <TrendingUp size={20} />
                            <h2 className="text-lg font-bold">Evolução Temporal</h2>
                        </div>
                        <p className="text-sm font-medium text-slate-500 bg-slate-50 px-3 py-1 rounded-full border border-slate-200">
                            {selectedActivity ? `Mostrando: ${selectedActivity}` : 'Mostrando: Top 5 Atividades'}
                        </p>
                    </div>
                    <div className="w-full min-h-[350px]">
                        {timeSeriesData.data.length > 1 ? (
                            <ResponsiveContainer width="100%" height="100%" minHeight={350}>
                                <LineChart data={timeSeriesData.data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                    <XAxis dataKey="displayName" tick={{ fontSize: 12 }} />
                                    <YAxis tick={{ fontSize: 12 }} tickFormatter={(value) => `${value}h`} />
                                    <Tooltip formatter={(value) => [`${value} horas`, 'Tempo']} />
                                    <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                                    {timeSeriesData.lines.map((lineName, index) => (
                                        <Line
                                            key={lineName}
                                            type="monotone"
                                            dataKey={lineName}
                                            stroke={COLORS[index % COLORS.length]}
                                            strokeWidth={3}
                                            dot={{ r: 4, strokeWidth: 2 }}
                                            activeDot={{ r: 6 }}
                                        />
                                    ))}
                                </LineChart>
                            </ResponsiveContainer>
                        ) : timeSeriesData.data.length === 1 ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2">
                                <TrendingUp size={32} className="text-slate-300" />
                                <p>Selecione um período maior que 1 mês para visualizar a evolução temporal.</p>
                            </div>
                        ) : (
                            <div className="h-full flex items-center justify-center text-slate-400">Sem dados temporais para exibir.</div>
                        )}
                    </div>
                </div>

                {/* Data Table */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                        <h2 className="text-lg font-bold text-brand-blue">Detalhamento de Atividades</h2>
                    </div>
                    <div className="overflow-x-auto max-h-[500px]">
                        <table className="w-full text-left text-sm text-slate-600">
                            <thead className="text-xs text-slate-400 bg-slate-50/50 sticky top-0 uppercase z-10">
                                <tr>
                                    <th className="px-6 py-4 font-semibold">Atividade</th>
                                    <th className="px-6 py-4 font-semibold text-right">Lançamentos</th>
                                    <th className="px-6 py-4 font-semibold text-right">Horas</th>
                                    <th className="px-6 py-4 font-semibold text-right">Progressão</th>
                                </tr>
                            </thead>
                            <tbody>
                                {activityData.map((row, idx) => {
                                    const maxOut = activityData[0]?.hours || 1;
                                    const percent = (row.hours / maxOut) * 100;
                                    return (
                                        <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50/50">
                                            <td className="px-6 py-4 font-medium text-slate-800">{row.activity}</td>
                                            <td className="px-6 py-4 text-right">{row.entries}</td>
                                            <td className="px-6 py-4 text-right font-semibold text-brand-blue">{row.hours}h</td>
                                            <td className="px-6 py-4 w-48">
                                                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                                    <div className="strategic-activity-progress-bar" style={{ width: `${percent}%`, backgroundColor: COLORS[idx % COLORS.length] }} />
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

            </main>
        </div>
    );
};

export default StrategicActivity;
