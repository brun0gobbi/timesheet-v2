import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell
} from 'recharts';
import { Home, Building2, Users, TrendingUp, Clock, Target, AlertTriangle, Info } from 'lucide-react';
import rawData from '../data/data.json';

// Tipos
interface Entry {
    p: string; // Pessoa
    c: string; // Cliente
    t: number; // Tempo em minutos
    e: string; // Evento/Atividade
    n?: string; // Núcleo
    d?: string; // Descrição
    l?: number; // Lag
}
interface PersonData {
    name: string;
    available: number;
    logged: number;
    entries: number;
}
interface MonthData {
    id: string;
    name: string;
    rawEntries?: Entry[];
    byPerson?: { [key: string]: PersonData };
    totals?: { available: number; logged: number };
}
interface Data {
    months: MonthData[];
}

const data: Data = rawData as unknown as Data;

// Componente de Tooltip informativo
const InfoTooltip: React.FC<{ text: string }> = ({ text }) => (
    <div className="group relative ml-1 cursor-help inline-flex">
        <Info className="w-4 h-4 text-slate-300 hover:text-blue-500 transition-colors" />
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-3 bg-slate-800 text-white text-xs rounded-xl shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 pointer-events-none">
            {text}
        </div>
    </div>
);

// Cores para gráficos
const COLORS = ['#003763', '#f4da40', '#ef4444', '#10b981', '#8b5cf6', '#ec4899', '#06b6d4', '#64748b'];

const ClientView: React.FC = () => {
    // Lista de todos os clientes únicos
    const allClients = useMemo(() => {
        const clientSet = new Set<string>();
        data.months.forEach(m => {
            m.rawEntries?.forEach(e => clientSet.add(e.c));
        });
        return Array.from(clientSet).sort();
    }, []);

    const [selectedClient, setSelectedClient] = useState<string>(allClients[0] || '');
    const [selectedMonthId, setSelectedMonthId] = useState<string>('ALL');

    // Meses relevantes (filtro)
    const relevantMonths = useMemo(() => {
        if (selectedMonthId === 'ALL') return data.months;
        return data.months.filter(m => m.id === selectedMonthId);
    }, [selectedMonthId]);

    // Todas as entries do cliente selecionado (filtrado por mês)
    const clientEntries = useMemo(() => {
        const entries: Entry[] = [];
        relevantMonths.forEach(m => {
            m.rawEntries?.filter(e => e.c === selectedClient).forEach(e => entries.push(e));
        });
        return entries;
    }, [selectedClient, relevantMonths]);

    // Função para limpar nome de tarefa (memoizada)
    const cleanTaskName = React.useCallback((name: string) => name.replace(/\[.*?\]\s*-?\s*/g, '').trim(), []);

    // ========== KPIs ==========
    const kpis = useMemo(() => {
        // Horas totais do cliente
        const totalMinutes = clientEntries.reduce((acc, e) => acc + e.t, 0);
        const totalHours = Math.round(totalMinutes / 60);

        // Total geral do escritório (para calcular share)
        let totalOfficeMinutes = 0;
        relevantMonths.forEach(m => {
            m.rawEntries?.forEach(e => { totalOfficeMinutes += e.t; });
        });
        const share = totalOfficeMinutes > 0 ? Math.round((totalMinutes / totalOfficeMinutes) * 100) : 0;

        // Pessoas distintas que trabalharam pro cliente
        const peopleSet = new Set<string>();
        clientEntries.forEach(e => peopleSet.add(e.p));
        const teamSize = peopleSet.size;

        // Número de lançamentos
        const entries = clientEntries.length;

        return { totalHours, share, teamSize, entries };
    }, [clientEntries, relevantMonths]);

    // ========== Squad Virtual (Top Colaboradores) ==========
    const topCollaborators = useMemo(() => {
        const map = new Map<string, number>();
        clientEntries.forEach(e => {
            map.set(e.p, (map.get(e.p) || 0) + e.t);
        });
        return Array.from(map.entries())
            .map(([name, val]) => ({
                name: name.length > 25 ? name.substring(0, 25) + '...' : name,
                Horas: Math.round(val / 60)
            }))
            .sort((a, b) => b.Horas - a.Horas)
            .slice(0, 8);
    }, [clientEntries]);

    // ========== Perfil de Demanda (Atividades) ==========
    const demandProfile = useMemo(() => {
        const map = new Map<string, number>();
        clientEntries.forEach(e => {
            const name = cleanTaskName(e.e);
            map.set(name, (map.get(name) || 0) + e.t);
        });
        return Array.from(map.entries())
            .map(([name, val]) => ({
                name: name.length > 30 ? name.substring(0, 30) + '...' : name,
                Horas: Math.round(val / 60)
            }))
            .sort((a, b) => b.Horas - a.Horas)
            .slice(0, 8);
    }, [clientEntries, cleanTaskName]);

    // ========== Evolução Anual ==========
    const evolutionData = useMemo(() => {
        return data.months.map(m => {
            const entries = m.rawEntries?.filter(e => e.c === selectedClient) || [];
            const totalMinutes = entries.reduce((acc, e) => acc + e.t, 0);
            return {
                name: m.name.substring(0, 3),
                fullMonth: m.name,
                Horas: Math.round(totalMinutes / 60)
            };
        });
    }, [selectedClient]);

    // ========== Matriz de Dependência (Concentração) ==========
    const dependencyMatrix = useMemo(() => {
        // Calcular quanto cada pessoa representa do total do cliente
        const totalMinutes = clientEntries.reduce((acc, e) => acc + e.t, 0);
        const personMap = new Map<string, number>();
        clientEntries.forEach(e => {
            personMap.set(e.p, (personMap.get(e.p) || 0) + e.t);
        });

        const sorted = Array.from(personMap.entries()).sort((a, b) => b[1] - a[1]);
        const top1Share = totalMinutes > 0 ? Math.round((sorted[0]?.[1] || 0) / totalMinutes * 100) : 0;
        const top3Share = totalMinutes > 0 ? Math.round((sorted.slice(0, 3).reduce((acc, [, v]) => acc + v, 0)) / totalMinutes * 100) : 0;

        // Classificação de risco
        let riskLevel: 'low' | 'medium' | 'high' = 'low';
        let riskLabel = 'Diversificado';
        if (top1Share > 60) {
            riskLevel = 'high';
            riskLabel = 'Alta Dependência';
        } else if (top1Share > 40) {
            riskLevel = 'medium';
            riskLabel = 'Concentrado';
        }

        return {
            pieData: sorted.slice(0, 5).map(([name, val], i) => ({
                name: name.split(' ')[0], // Primeiro nome
                value: Math.round(val / 60),
                fill: COLORS[i % COLORS.length]
            })),
            top1Share,
            top3Share,
            topPerson: sorted[0]?.[0] || '-',
            riskLevel,
            riskLabel,
            totalPeople: personMap.size
        };
    }, [clientEntries]);

    // ========== Heatmap de Atendimento (Pessoa x Atividade) ==========
    const heatmapData = useMemo(() => {
        // Criar matriz: linhas = pessoas, colunas = atividades
        const personSet = new Set<string>();
        const activitySet = new Set<string>();
        const matrix = new Map<string, Map<string, number>>();

        clientEntries.forEach(e => {
            const actName = cleanTaskName(e.e);
            personSet.add(e.p);
            activitySet.add(actName);

            if (!matrix.has(e.p)) matrix.set(e.p, new Map());
            const personRow = matrix.get(e.p)!;
            personRow.set(actName, (personRow.get(actName) || 0) + e.t);
        });

        // Limitar a top 5 pessoas e top 5 atividades
        const topPeople = Array.from(personSet)
            .map(p => ({ name: p, total: clientEntries.filter(e => e.p === p).reduce((acc, e) => acc + e.t, 0) }))
            .sort((a, b) => b.total - a.total)
            .slice(0, 5)
            .map(p => p.name);

        const topActivities = Array.from(activitySet)
            .map(a => ({ name: a, total: clientEntries.filter(e => cleanTaskName(e.e) === a).reduce((acc, e) => acc + e.t, 0) }))
            .sort((a, b) => b.total - a.total)
            .slice(0, 5)
            .map(a => a.name);

        // Encontrar max para escala de cores
        let maxVal = 0;
        topPeople.forEach(p => {
            topActivities.forEach(a => {
                const val = matrix.get(p)?.get(a) || 0;
                if (val > maxVal) maxVal = val;
            });
        });

        return {
            people: topPeople,
            activities: topActivities,
            matrix,
            maxVal
        };
    }, [clientEntries, cleanTaskName]);

    // Função para cor do heatmap
    const getHeatmapColor = (value: number, max: number) => {
        if (value === 0) return 'bg-slate-100';
        const intensity = Math.min(value / max, 1);
        if (intensity < 0.25) return 'bg-blue-100 text-blue-800';
        if (intensity < 0.5) return 'bg-blue-200 text-blue-900';
        if (intensity < 0.75) return 'bg-blue-400 text-white';
        return 'bg-blue-600 text-white';
    };

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 font-sans p-6 md:p-10">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
                <div className="flex items-center gap-4">
                    <Link to="/" className="p-2 rounded-xl bg-white shadow-sm border border-slate-100 hover:bg-slate-50 transition-colors">
                        <Home className="w-5 h-5 text-slate-600" />
                    </Link>
                    <h1 className="text-3xl font-extrabold text-slate-900">Raio-X do <span className="text-brand-secondary">Cliente</span></h1>
                </div>
                <div className="flex flex-wrap gap-2 bg-white p-2 rounded-2xl shadow-sm border border-slate-100">
                    <select
                        value={selectedMonthId}
                        onChange={e => setSelectedMonthId(e.target.value)}
                        className="bg-transparent px-3 py-2 rounded-lg border border-slate-200 text-sm font-medium"
                        title="Filtrar por mês"
                    >
                        <option value="ALL">Todo o Período</option>
                        {data.months.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                    <select
                        value={selectedClient}
                        onChange={e => setSelectedClient(e.target.value)}
                        className="bg-transparent px-3 py-2 rounded-lg border border-slate-200 text-sm font-medium min-w-[250px]"
                        title="Selecionar cliente"
                    >
                        {allClients.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                    <div className="flex items-center gap-2 text-slate-400 mb-2">
                        <Clock className="w-4 h-4" />
                        <span className="text-xs uppercase flex items-center">
                            Horas Totais
                            <InfoTooltip text="Volume total de horas consumidas por este cliente." />
                        </span>
                    </div>
                    <h3 className="text-2xl font-bold text-blue-600">{kpis.totalHours}h</h3>
                </div>
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                    <div className="flex items-center gap-2 text-slate-400 mb-2">
                        <Target className="w-4 h-4" />
                        <span className="text-xs uppercase flex items-center">
                            Share of Attention
                            <InfoTooltip text="Quanto este cliente representa do tempo total do escritório." />
                        </span>
                    </div>
                    <h3 className="text-2xl font-bold text-emerald-600">{kpis.share}%</h3>
                </div>
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                    <div className="flex items-center gap-2 text-slate-400 mb-2">
                        <Users className="w-4 h-4" />
                        <span className="text-xs uppercase flex items-center">
                            Equipe Alocada
                            <InfoTooltip text="Número de pessoas distintas que trabalharam para este cliente." />
                        </span>
                    </div>
                    <h3 className="text-2xl font-bold text-purple-600">{kpis.teamSize} pessoas</h3>
                </div>
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                    <div className="flex items-center gap-2 text-slate-400 mb-2">
                        <Building2 className="w-4 h-4" />
                        <span className="text-xs uppercase flex items-center">
                            Lançamentos
                            <InfoTooltip text="Número total de registros de atividades para este cliente." />
                        </span>
                    </div>
                    <h3 className="text-2xl font-bold text-amber-600">{kpis.entries}</h3>
                </div>
            </div>

            {/* Gráficos: Squad e Demanda */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
                {/* Squad Virtual */}
                <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
                    <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                        <Users className="w-5 h-5 text-purple-500" />
                        Squad Virtual (Quem Atende?)
                        <InfoTooltip text="Ranking dos colaboradores que mais dedicam tempo a este cliente." />
                    </h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={topCollaborators} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis type="number" />
                            <YAxis
                                dataKey="name"
                                type="category"
                                width={140}
                                tick={{ fontSize: 10 }}
                                tickFormatter={(value) => value.length > 18 ? value.substring(0, 18) + '...' : value}
                            />
                            <Tooltip formatter={(value) => `${value}h`} />
                            <Bar dataKey="Horas" fill="#003763" radius={[0, 4, 4, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* Perfil de Demanda */}
                <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
                    <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                        Perfil de Demanda (O Que Pede?)
                        <InfoTooltip text="As atividades que mais consomem tempo deste cliente." />
                    </h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={demandProfile} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis type="number" />
                            <YAxis dataKey="name" type="category" width={150} tick={{ fontSize: 10 }} />
                            <Tooltip formatter={(value) => `${value}h`} />
                            <Bar dataKey="Horas" fill="#10b981" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Evolução Anual */}
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 mb-10">
                <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-blue-500" />
                    Evolução Anual da Demanda
                    <InfoTooltip text="Histórico mensal de horas consumidas por este cliente." />
                </h3>
                <ResponsiveContainer width="100%" height={250}>
                    <AreaChart data={evolutionData}>
                        <defs>
                            <linearGradient id="colorClient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#003763" stopOpacity={0.8} />
                                <stop offset="95%" stopColor="#003763" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                        <Tooltip />
                        <Area type="monotone" dataKey="Horas" stroke="#003763" fillOpacity={1} fill="url(#colorClient)" />
                    </AreaChart>
                </ResponsiveContainer>
            </div>

            {/* Seção de Inteligência */}
            <h3 className="font-bold text-lg mb-6 flex items-center gap-2 text-slate-800">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                Análise de Dependência & Risco
            </h3>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
                {/* Matriz de Dependência */}
                <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
                    <h4 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                        Concentração de Atendimento
                        <InfoTooltip text="Mostra se o cliente depende muito de uma única pessoa (risco)." />
                    </h4>
                    <div className="flex items-center gap-6">
                        <div className="w-48 h-48">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={dependencyMatrix.pieData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={40}
                                        outerRadius={70}
                                        dataKey="value"
                                        label={({ name }) => name}
                                    >
                                        {dependencyMatrix.pieData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.fill} />
                                        ))}
                                    </Pie>
                                    <Tooltip formatter={(value) => `${value}h`} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="flex-1 space-y-4">
                            <div className={`p-4 rounded-xl ${dependencyMatrix.riskLevel === 'high' ? 'bg-red-50 border border-red-200' :
                                dependencyMatrix.riskLevel === 'medium' ? 'bg-amber-50 border border-amber-200' :
                                    'bg-emerald-50 border border-emerald-200'
                                }`}>
                                <p className={`font-bold text-sm ${dependencyMatrix.riskLevel === 'high' ? 'text-red-700' :
                                    dependencyMatrix.riskLevel === 'medium' ? 'text-amber-700' :
                                        'text-emerald-700'
                                    }`}>
                                    {dependencyMatrix.riskLabel}
                                </p>
                                <p className="text-xs text-slate-600 mt-1">
                                    {dependencyMatrix.topPerson.split(' ')[0]} representa <strong>{dependencyMatrix.top1Share}%</strong> do atendimento
                                </p>
                            </div>
                            <div className="text-sm text-slate-500">
                                <p>Top 3 = <strong>{dependencyMatrix.top3Share}%</strong></p>
                                <p>Total de {dependencyMatrix.totalPeople} pessoas atuam</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Heatmap de Atendimento */}
                <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
                    <h4 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                        Heatmap: Quem Faz O Quê
                        <InfoTooltip text="Intensidade de cores mostra a distribuição de atividades por pessoa." />
                    </h4>
                    {heatmapData.people.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr>
                                        <th className="p-2 text-left text-slate-500"></th>
                                        {heatmapData.activities.map(a => (
                                            <th key={a} className="p-2 text-center text-slate-500 max-w-[80px] truncate" title={a}>
                                                {a.length > 12 ? a.substring(0, 12) + '...' : a}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {heatmapData.people.map(p => (
                                        <tr key={p}>
                                            <td className="p-2 text-left text-slate-700 font-medium max-w-[100px] truncate" title={p}>
                                                {p.split(' ')[0]}
                                            </td>
                                            {heatmapData.activities.map(a => {
                                                const val = heatmapData.matrix.get(p)?.get(a) || 0;
                                                const hours = Math.round(val / 60);
                                                return (
                                                    <td
                                                        key={a}
                                                        className={`p-2 text-center font-bold rounded ${getHeatmapColor(val, heatmapData.maxVal)}`}
                                                        title={`${p} - ${a}: ${hours}h`}
                                                    >
                                                        {hours > 0 ? hours : '-'}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <p className="text-slate-400 text-sm">Sem dados suficientes para gerar o heatmap.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ClientView;
