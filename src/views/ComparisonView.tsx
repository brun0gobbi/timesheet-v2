import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { Home, TrendingUp, ChevronDown, Check, X, Filter, BarChart3 } from 'lucide-react';
import rawData from '../data/data.json';

// Types
interface Entry {
    p: string;
    n: string;
    c: string;
    e: string;
    t: number;
    l?: number;
}

interface PersonData {
    name: string;
    available: number;
    logged: number;
    entries: number;
    fragments?: number;
    fragmentTime?: number;
    totalLag?: number;
    lagCount?: number;
}

interface NucleoData {
    name: string;
    logged: number;
}

interface MonthData {
    id: string;
    name: string;
    totalAvailable: number;
    totalLogged: number;
    byPerson: Record<string, PersonData>;
    byNucleo: Record<string, NucleoData>;
    rawEntries: Entry[];
}

interface DashboardData {
    months: MonthData[];
}

const data = rawData as unknown as DashboardData;

// Available metrics for selection
type MetricKey =
    | 'totalHours'
    | 'collaboratorCount'
    | 'avgHoursPerPerson'
    | 'fragmentationRate'
    | 'avgLag'
    | 'byNucleo'
    | 'topCollaborators'
    | 'topActivities';

interface MetricConfig {
    key: MetricKey;
    label: string;
    icon: string;
    type: 'card' | 'chart';
}

const AVAILABLE_METRICS: MetricConfig[] = [
    { key: 'totalHours', label: 'Total de Horas', icon: '⏱️', type: 'card' },
    { key: 'collaboratorCount', label: 'Colaboradores Ativos', icon: '👥', type: 'card' },
    { key: 'avgHoursPerPerson', label: 'Média por Colaborador', icon: '📊', type: 'card' },
    { key: 'fragmentationRate', label: 'Taxa de Fragmentação', icon: '🧩', type: 'card' },
    { key: 'avgLag', label: 'Lag Médio (dias)', icon: '⚡', type: 'card' },
    { key: 'byNucleo', label: 'Por Núcleo', icon: '🏢', type: 'chart' },
    { key: 'topCollaborators', label: 'Top Colaboradores', icon: '🏆', type: 'chart' },
    { key: 'topActivities', label: 'Top Atividades', icon: '📋', type: 'chart' },
];

const MONTH_COLORS = ['#003763', '#f4da40', '#10b981', '#ec4899', '#8b5cf6'];

function ComparisonView() {
    // State
    const [selectedMonths, setSelectedMonths] = useState<string[]>(() => {
        // Default: last 3 months
        const monthIds = data.months.map(m => m.id);
        return monthIds.slice(-3);
    });
    const [selectedMetrics, setSelectedMetrics] = useState<MetricKey[]>([
        'totalHours', 'collaboratorCount', 'avgHoursPerPerson', 'byNucleo'
    ]);
    const [nucleoFilter, setNucleoFilter] = useState<string>('');
    const [showMonthDropdown, setShowMonthDropdown] = useState(false);

    // Get all nucleos for filter
    const allNucleos = useMemo(() => {
        const nucleos = new Set<string>();
        data.months.forEach(m => {
            Object.keys(m.byNucleo || {}).forEach(n => nucleos.add(n));
        });
        return Array.from(nucleos).sort();
    }, []);

    // Get selected month data
    const selectedMonthData = useMemo(() => {
        return data.months.filter(m => selectedMonths.includes(m.id));
    }, [selectedMonths]);

    // Calculate metrics for each month
    const monthMetrics = useMemo(() => {
        return selectedMonthData.map(month => {
            const entries = month.rawEntries || [];
            const filteredEntries = nucleoFilter
                ? entries.filter(e => e.n === nucleoFilter)
                : entries;

            const byPerson = month.byPerson || {};
            const filteredPersons = nucleoFilter
                ? Object.values(byPerson).filter(p =>
                    entries.some(e => e.p === p.name && e.n === nucleoFilter))
                : Object.values(byPerson);

            // Total hours
            const totalMinutes = filteredEntries.reduce((sum, e) => sum + e.t, 0);
            const totalHours = totalMinutes / 60;

            // Collaborator count
            const collaborators = new Set(filteredEntries.map(e => e.p));
            const collaboratorCount = collaborators.size;

            // Average hours per person
            const avgHoursPerPerson = collaboratorCount > 0 ? totalHours / collaboratorCount : 0;

            // Fragmentation rate
            const fragmentedEntries = filteredEntries.filter(e => e.t < 9).length;
            const fragmentationRate = filteredEntries.length > 0
                ? (fragmentedEntries / filteredEntries.length) * 100
                : 0;

            // Average lag
            let totalLag = 0;
            let lagCount = 0;
            filteredPersons.forEach(p => {
                if (p.totalLag !== undefined && p.lagCount) {
                    totalLag += p.totalLag;
                    lagCount += p.lagCount;
                }
            });
            const avgLag = lagCount > 0 ? totalLag / lagCount : 0;

            // By nucleo
            const byNucleo: Record<string, number> = {};
            filteredEntries.forEach(e => {
                if (!byNucleo[e.n]) byNucleo[e.n] = 0;
                byNucleo[e.n] += e.t / 60;
            });

            // Top collaborators
            const collabHours: Record<string, number> = {};
            filteredEntries.forEach(e => {
                if (!collabHours[e.p]) collabHours[e.p] = 0;
                collabHours[e.p] += e.t / 60;
            });
            const topCollaborators = Object.entries(collabHours)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10);

            // Top activities
            const activityHours: Record<string, number> = {};
            filteredEntries.forEach(e => {
                const cleanActivity = e.e.replace(/\[.*?\]\s*-?\s*/g, '').trim();
                if (!activityHours[cleanActivity]) activityHours[cleanActivity] = 0;
                activityHours[cleanActivity] += e.t / 60;
            });
            const topActivities = Object.entries(activityHours)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10);

            return {
                monthId: month.id,
                monthName: month.name,
                totalHours,
                collaboratorCount,
                avgHoursPerPerson,
                fragmentationRate,
                avgLag,
                byNucleo,
                topCollaborators,
                topActivities
            };
        });
    }, [selectedMonthData, nucleoFilter]);

    // Toggle month selection
    const toggleMonth = (monthId: string) => {
        setSelectedMonths(prev => {
            if (prev.includes(monthId)) {
                return prev.length > 2 ? prev.filter(id => id !== monthId) : prev;
            }
            return prev.length < 4 ? [...prev, monthId] : prev;
        });
    };

    // Toggle metric selection
    const toggleMetric = (metricKey: MetricKey) => {
        setSelectedMetrics(prev => {
            if (prev.includes(metricKey)) {
                return prev.length > 1 ? prev.filter(k => k !== metricKey) : prev;
            }
            return [...prev, metricKey];
        });
    };

    // Format number
    const formatNumber = (n: number, decimals = 1) => {
        return n.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    };

    // Calculate variation between first and last selected month
    const getVariation = (key: 'totalHours' | 'collaboratorCount' | 'avgHoursPerPerson' | 'fragmentationRate' | 'avgLag') => {
        if (monthMetrics.length < 2) return null;
        const first = monthMetrics[0][key];
        const last = monthMetrics[monthMetrics.length - 1][key];
        if (first === 0) return null;
        const variation = ((last - first) / first) * 100;
        return variation;
    };

    // Prepare chart data for grouped bar chart
    const prepareChartData = (type: 'byNucleo' | 'topCollaborators' | 'topActivities') => {
        // Get all unique keys across months
        const allKeys = new Set<string>();
        monthMetrics.forEach(m => {
            if (type === 'byNucleo') {
                Object.keys(m.byNucleo).forEach(k => allKeys.add(k));
            } else if (type === 'topCollaborators') {
                m.topCollaborators.forEach(([name]) => allKeys.add(name));
            } else {
                m.topActivities.forEach(([name]) => allKeys.add(name));
            }
        });

        // Build chart data
        return Array.from(allKeys).slice(0, 10).map(key => {
            const dataPoint: Record<string, string | number> = { name: key };
            monthMetrics.forEach(m => {
                let value = 0;
                if (type === 'byNucleo') {
                    value = m.byNucleo[key] || 0;
                } else if (type === 'topCollaborators') {
                    const found = m.topCollaborators.find(([n]) => n === key);
                    value = found ? found[1] : 0;
                } else {
                    const found = m.topActivities.find(([n]) => n === key);
                    value = found ? found[1] : 0;
                }
                dataPoint[m.monthName] = Math.round(value);
            });
            return dataPoint;
        }).sort((a, b) => {
            // Sort by total across all months
            const totalA = Object.values(a).filter(v => typeof v === 'number').reduce((s, v) => s + (v as number), 0);
            const totalB = Object.values(b).filter(v => typeof v === 'number').reduce((s, v) => s + (v as number), 0);
            return totalB - totalA;
        });
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-8">
            {/* Header */}
            <div className="max-w-7xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <Link to="/" className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                            <Home className="w-5 h-5" />
                        </Link>
                        <div>
                            <h1 className="text-3xl font-bold flex items-center gap-3">
                                <TrendingUp className="w-8 h-8 text-brand-secondary" />
                                Comparativo de Meses
                            </h1>
                            <p className="text-slate-400 mt-1">Compare métricas entre diferentes períodos</p>
                        </div>
                    </div>
                </div>

                {/* Controls */}
                <div className="bg-slate-800/50 rounded-2xl p-6 mb-8 border border-white/5">
                    <div className="grid md:grid-cols-3 gap-6">
                        {/* Month Selector */}
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                Meses para Comparar (2-4)
                            </label>
                            <div className="relative">
                                <button
                                    onClick={() => setShowMonthDropdown(!showMonthDropdown)}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-left flex items-center justify-between hover:border-slate-600 transition-colors"
                                >
                                    <span>{selectedMonths.length} meses selecionados</span>
                                    <ChevronDown className={`w-5 h-5 transition-transform ${showMonthDropdown ? 'rotate-180' : ''}`} />
                                </button>
                                {showMonthDropdown && (
                                    <div className="absolute z-20 mt-2 w-full bg-slate-800 border border-slate-700 rounded-lg shadow-xl max-h-64 overflow-y-auto">
                                        {data.months.map(month => (
                                            <button
                                                key={month.id}
                                                onClick={() => toggleMonth(month.id)}
                                                className={`w-full px-4 py-2 text-left flex items-center justify-between hover:bg-slate-700/50 transition-colors ${selectedMonths.includes(month.id) ? 'bg-brand-primary/20' : ''
                                                    }`}
                                            >
                                                <span>{month.name}</span>
                                                {selectedMonths.includes(month.id) && (
                                                    <Check className="w-4 h-4 text-green-400" />
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div className="flex flex-wrap gap-2 mt-2">
                                {selectedMonths.map((id, idx) => {
                                    const month = data.months.find(m => m.id === id);
                                    return (
                                        <span
                                            key={id}
                                            className="px-3 py-1 rounded-full text-sm font-medium"
                                            style={{ backgroundColor: MONTH_COLORS[idx] + '30', color: MONTH_COLORS[idx] }}
                                        >
                                            {month?.name}
                                        </span>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Metric Selector */}
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                Métricas a Exibir
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                                {AVAILABLE_METRICS.map(metric => (
                                    <button
                                        key={metric.key}
                                        onClick={() => toggleMetric(metric.key)}
                                        className={`px-3 py-2 rounded-lg text-sm text-left flex items-center gap-2 transition-colors ${selectedMetrics.includes(metric.key)
                                            ? 'bg-brand-primary/20 border border-brand-primary/50 text-white'
                                            : 'bg-slate-900 border border-slate-700 text-slate-400 hover:border-slate-600'
                                            }`}
                                    >
                                        <span>{metric.icon}</span>
                                        <span className="truncate">{metric.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Nucleo Filter */}
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                <Filter className="w-4 h-4 inline mr-1" />
                                Filtro por Núcleo (opcional)
                            </label>
                            <select
                                value={nucleoFilter}
                                onChange={(e) => setNucleoFilter(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:border-brand-primary outline-none"
                                aria-label="Filtro por núcleo"
                            >
                                <option value="">Todos os Núcleos</option>
                                {allNucleos.map(n => (
                                    <option key={n} value={n}>{n}</option>
                                ))}
                            </select>
                            {nucleoFilter && (
                                <button
                                    onClick={() => setNucleoFilter('')}
                                    className="mt-2 text-sm text-red-400 hover:text-red-300 flex items-center gap-1"
                                >
                                    <X className="w-4 h-4" /> Limpar filtro
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Card Metrics */}
                {selectedMetrics.some(m => ['totalHours', 'collaboratorCount', 'avgHoursPerPerson', 'fragmentationRate', 'avgLag'].includes(m)) && (
                    <div className="grid md:grid-cols-5 gap-4 mb-8">
                        {selectedMetrics.includes('totalHours') && (
                            <div className="bg-slate-800/50 rounded-2xl p-6 border border-white/5">
                                <h3 className="text-sm text-slate-400 mb-3 flex items-center gap-2">
                                    <BarChart3 className="w-4 h-4" /> Total de Horas
                                </h3>
                                {monthMetrics.map((m, idx) => (
                                    <div key={m.monthId} className="flex justify-between items-center mb-2">
                                        <span className="text-sm" style={{ color: MONTH_COLORS[idx] }}>{m.monthName}</span>
                                        <span className="font-bold">{formatNumber(m.totalHours)}h</span>
                                    </div>
                                ))}
                                {getVariation('totalHours') !== null && (
                                    <div className={`text-xs mt-2 pt-2 border-t border-white/10 ${getVariation('totalHours')! >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                        {getVariation('totalHours')! >= 0 ? '↑' : '↓'} {formatNumber(Math.abs(getVariation('totalHours')!))}% vs primeiro mês
                                    </div>
                                )}
                            </div>
                        )}

                        {selectedMetrics.includes('collaboratorCount') && (
                            <div className="bg-slate-800/50 rounded-2xl p-6 border border-white/5">
                                <h3 className="text-sm text-slate-400 mb-3">👥 Colaboradores Ativos</h3>
                                {monthMetrics.map((m, idx) => (
                                    <div key={m.monthId} className="flex justify-between items-center mb-2">
                                        <span className="text-sm" style={{ color: MONTH_COLORS[idx] }}>{m.monthName}</span>
                                        <span className="font-bold">{m.collaboratorCount}</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {selectedMetrics.includes('avgHoursPerPerson') && (
                            <div className="bg-slate-800/50 rounded-2xl p-6 border border-white/5">
                                <h3 className="text-sm text-slate-400 mb-3">📊 Média por Pessoa</h3>
                                {monthMetrics.map((m, idx) => (
                                    <div key={m.monthId} className="flex justify-between items-center mb-2">
                                        <span className="text-sm" style={{ color: MONTH_COLORS[idx] }}>{m.monthName}</span>
                                        <span className="font-bold">{formatNumber(m.avgHoursPerPerson)}h</span>
                                    </div>
                                ))}
                                {getVariation('avgHoursPerPerson') !== null && (
                                    <div className={`text-xs mt-2 pt-2 border-t border-white/10 ${getVariation('avgHoursPerPerson')! >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                        {getVariation('avgHoursPerPerson')! >= 0 ? '↑' : '↓'} {formatNumber(Math.abs(getVariation('avgHoursPerPerson')!))}%
                                    </div>
                                )}
                            </div>
                        )}

                        {selectedMetrics.includes('fragmentationRate') && (
                            <div className="bg-slate-800/50 rounded-2xl p-6 border border-white/5">
                                <h3 className="text-sm text-slate-400 mb-3">🧩 Fragmentação</h3>
                                {monthMetrics.map((m, idx) => (
                                    <div key={m.monthId} className="flex justify-between items-center mb-2">
                                        <span className="text-sm" style={{ color: MONTH_COLORS[idx] }}>{m.monthName}</span>
                                        <span className="font-bold">{formatNumber(m.fragmentationRate)}%</span>
                                    </div>
                                ))}
                                {getVariation('fragmentationRate') !== null && (
                                    <div className={`text-xs mt-2 pt-2 border-t border-white/10 ${getVariation('fragmentationRate')! <= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                        {getVariation('fragmentationRate')! <= 0 ? '↓' : '↑'} {formatNumber(Math.abs(getVariation('fragmentationRate')!))}%
                                    </div>
                                )}
                            </div>
                        )}

                        {selectedMetrics.includes('avgLag') && (
                            <div className="bg-slate-800/50 rounded-2xl p-6 border border-white/5">
                                <h3 className="text-sm text-slate-400 mb-3">⚡ Lag Médio</h3>
                                {monthMetrics.map((m, idx) => (
                                    <div key={m.monthId} className="flex justify-between items-center mb-2">
                                        <span className="text-sm" style={{ color: MONTH_COLORS[idx] }}>{m.monthName}</span>
                                        <span className="font-bold">{formatNumber(m.avgLag)} dias</span>
                                    </div>
                                ))}
                                {getVariation('avgLag') !== null && (
                                    <div className={`text-xs mt-2 pt-2 border-t border-white/10 ${getVariation('avgLag')! <= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                        {getVariation('avgLag')! <= 0 ? '↓' : '↑'} {formatNumber(Math.abs(getVariation('avgLag')!))}%
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Chart Metrics */}
                <div className="grid md:grid-cols-2 gap-8">
                    {selectedMetrics.includes('byNucleo') && (
                        <div className="bg-slate-800/50 rounded-2xl p-6 border border-white/5">
                            <h3 className="text-lg font-bold mb-4">🏢 Horas por Núcleo</h3>
                            <div className="h-80">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={prepareChartData('byNucleo')} layout="vertical">
                                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                        <XAxis type="number" stroke="#94a3b8" />
                                        <YAxis type="category" dataKey="name" stroke="#94a3b8" width={100} tick={{ fontSize: 11 }} />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }}
                                            labelStyle={{ color: '#f8fafc' }}
                                        />
                                        <Legend />
                                        {monthMetrics.map((m, idx) => (
                                            <Bar key={m.monthId} dataKey={m.monthName} fill={MONTH_COLORS[idx]} />
                                        ))}
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}

                    {selectedMetrics.includes('topCollaborators') && (
                        <div className="bg-slate-800/50 rounded-2xl p-6 border border-white/5">
                            <h3 className="text-lg font-bold mb-4">🏆 Top Colaboradores</h3>
                            <div className="h-80">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={prepareChartData('topCollaborators')} layout="vertical">
                                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                        <XAxis type="number" stroke="#94a3b8" />
                                        <YAxis type="category" dataKey="name" stroke="#94a3b8" width={120} tick={{ fontSize: 10 }} />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }}
                                            labelStyle={{ color: '#f8fafc' }}
                                        />
                                        <Legend />
                                        {monthMetrics.map((m, idx) => (
                                            <Bar key={m.monthId} dataKey={m.monthName} fill={MONTH_COLORS[idx]} />
                                        ))}
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}

                    {selectedMetrics.includes('topActivities') && (
                        <div className="bg-slate-800/50 rounded-2xl p-6 border border-white/5 md:col-span-2">
                            <h3 className="text-lg font-bold mb-4">📋 Top Atividades</h3>
                            <div className="h-80">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={prepareChartData('topActivities')} layout="vertical">
                                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                        <XAxis type="number" stroke="#94a3b8" />
                                        <YAxis type="category" dataKey="name" stroke="#94a3b8" width={200} tick={{ fontSize: 10 }} />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }}
                                            labelStyle={{ color: '#f8fafc' }}
                                        />
                                        <Legend />
                                        {monthMetrics.map((m, idx) => (
                                            <Bar key={m.monthId} dataKey={m.monthName} fill={MONTH_COLORS[idx]} />
                                        ))}
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default ComparisonView;
