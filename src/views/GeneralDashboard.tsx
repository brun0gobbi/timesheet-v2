import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import { Home } from 'lucide-react';
import rawData from '../data/data.json';

// Tipos para os dados
interface Entry {
    p: string; // pessoa
    n: string; // núcleo
    c: string; // cliente
    e: string; // evento/tarefa
    t: number; // tempo em minutos
}

interface PersonData {
    name: string;
    available: number;
    logged: number;
    entries: number;
    fragments?: number;
    fragmentTime?: number;
}

interface MonthData {
    id: string;
    name: string;
    totalAvailable: number;
    totalLogged: number;
    byPerson: Record<string, PersonData>;
    byNucleo: Record<string, unknown>;
    byClient: Record<string, unknown>;
    rawEntries: Entry[];
}
interface DashboardData { months: MonthData[]; }
const data = rawData as unknown as DashboardData;

const GeneralDashboard: React.FC = () => {
    const [selectedMonthId, setSelectedMonthId] = useState<string>(data.months.length > 0 ? data.months[data.months.length - 1].id : "");
    const [selectedNucleo, setSelectedNucleo] = useState<string>('Todos');
    const [selectedPerson, setSelectedPerson] = useState<string>('Todos');
    const [selectedClient, setSelectedClient] = useState<string>('Todos');

    const selectedMonth = useMemo(() => {
        if (selectedMonthId === 'ALL') {
            const aggregated: MonthData = {
                id: 'ALL', name: 'Acumulado', totalAvailable: 0, totalLogged: 0, rawEntries: [] as Entry[], byPerson: {} as Record<string, PersonData>, byNucleo: {}, byClient: {}
            };
            data.months.forEach(m => {
                aggregated.totalAvailable += (m.totalAvailable || 0);
                aggregated.totalLogged += (m.totalLogged || 0);
                if (m.rawEntries) aggregated.rawEntries = aggregated.rawEntries.concat(m.rawEntries);
                // ByPerson Aggregation Logic
                if (m.byPerson) {
                    Object.values(m.byPerson).forEach((p) => {
                        if (!aggregated.byPerson[p.name]) {
                            aggregated.byPerson[p.name] = { name: p.name, available: 0, logged: 0, entries: 0, fragments: 0, fragmentTime: 0 };
                        }
                        const target = aggregated.byPerson[p.name];
                        target.available += (p.available || 0);
                        target.logged += (p.logged || 0);
                        target.entries += (p.entries || 0);
                    });
                }
            });
            return aggregated;
        }
        return data.months.find((m) => m.id === selectedMonthId) || null;
    }, [selectedMonthId]);

    const globalFilteredEntries = useMemo(() => {
        if (!selectedMonth) return [];
        let entries = selectedMonth.rawEntries || [];
        if (selectedNucleo !== 'Todos') entries = entries.filter((e) => e.n === selectedNucleo);
        if (selectedPerson !== 'Todos') entries = entries.filter((e) => e.p === selectedPerson);
        if (selectedClient !== 'Todos') entries = entries.filter((e) => e.c === selectedClient);
        return entries;
    }, [selectedMonth, selectedNucleo, selectedPerson, selectedClient]);

    // Filtros dependentes do mês selecionado para evitar combinações impossíveis
    const nucleos = useMemo(() => {
        if (!selectedMonth?.rawEntries) return [];
        return Array.from(new Set(selectedMonth.rawEntries.map((e) => e.n))).sort();
    }, [selectedMonth]);

    const people = useMemo(() => {
        if (!selectedMonth?.rawEntries) return [];
        let entries = selectedMonth.rawEntries;
        if (selectedNucleo !== 'Todos') entries = entries.filter((e) => e.n === selectedNucleo);
        return Array.from(new Set(entries.map((e) => e.p))).sort();
    }, [selectedMonth, selectedNucleo]);

    const clients = useMemo(() => {
        if (!selectedMonth?.rawEntries) return [];
        let entries = selectedMonth.rawEntries;
        if (selectedNucleo !== 'Todos') entries = entries.filter((e) => e.n === selectedNucleo);
        if (selectedPerson !== 'Todos') entries = entries.filter((e) => e.p === selectedPerson);
        return Array.from(new Set(entries.map((e) => e.c))).sort();
    }, [selectedMonth, selectedNucleo, selectedPerson]);

    const filteredMetrics = useMemo(() => {
        const totalLogged = globalFilteredEntries.reduce((acc, curr) => acc + curr.t, 0);
        const totalEntries = globalFilteredEntries.length;
        // Calcular available somando de byPerson (mais preciso que totalAvailable)
        let totalAvailable = 0;
        if (selectedMonth?.byPerson) {
            let personList = Object.values(selectedMonth.byPerson);
            // Se filtro de pessoa ativo, considerar só essa pessoa
            if (selectedPerson !== 'Todos') personList = personList.filter((p) => p.name === selectedPerson);
            totalAvailable = personList.reduce((acc, p) => acc + (p.available || 0), 0);
        }
        const estoque = totalAvailable - totalLogged;
        return { logged: totalLogged, available: totalAvailable, totalEntries, estoque };
    }, [globalFilteredEntries, selectedMonth, selectedPerson]);

    // Gera lista ordenada (ranking) de colaboradores respeitando filtros
    const rankedCollaborators = useMemo(() => {
        if (!selectedMonth?.byPerson) return [];

        // 1. Determinar quais pessoas pertencem ao núcleo selecionado
        const peopleInNucleo = new Set<string>();
        if (selectedNucleo !== 'Todos') {
            (selectedMonth.rawEntries || [])
                .filter(e => e.n === selectedNucleo)
                .forEach(e => peopleInNucleo.add(e.p));
        }

        // 2. Filtrar lista de pessoas
        let personList = Object.values(selectedMonth.byPerson);
        if (selectedNucleo !== 'Todos') {
            personList = personList.filter(p => peopleInNucleo.has(p.name));
        }

        // 3. Calcular utilização e ordenar (ranking)
        return personList
            .map(p => ({
                name: p.name,
                shortName: p.name.split(' ')[0],
                util: p.available ? Math.round((p.logged / p.available) * 100) : 0,
                logged: p.logged,
                available: p.available
            }))
            .sort((a, b) => b.util - a.util)
            .map((p, idx) => ({ ...p, rank: idx + 1 }));
    }, [selectedMonth, selectedNucleo]);

    // Dados do gráfico Top Colaboradores com lógica contextual
    const evolutionData = useMemo(() => {
        // Modo "Todo o Período" - Evolução mensal
        if (selectedMonthId === 'ALL') {
            return data.months.map(m => {
                let entries = m.rawEntries || [];
                if (selectedNucleo !== 'Todos') entries = entries.filter((e) => e.n === selectedNucleo);
                if (selectedPerson !== 'Todos') entries = entries.filter((e) => e.p === selectedPerson);
                if (selectedClient !== 'Todos') entries = entries.filter((e) => e.c === selectedClient);
                const log = entries.reduce((acc, curr) => acc + curr.t, 0);
                const avail = m.totalAvailable || 1;
                return { name: m.name.substring(0, 3), Utilizacao: Math.round((log / avail) * 100), isHighlighted: false };
            });
        }

        // Modo mês específico - Top Colaboradores com ranking contextual
        const TOP_COUNT = 8;

        // Se nenhuma pessoa selecionada, mostra Top 8
        if (selectedPerson === 'Todos') {
            return rankedCollaborators
                .slice(0, TOP_COUNT)
                .map(p => ({ name: p.shortName, Utilizacao: p.util, isHighlighted: false }));
        }

        // Pessoa selecionada - Lógica de Ranking Contextual
        const selectedPersonData = rankedCollaborators.find(p => p.name === selectedPerson);
        if (!selectedPersonData) return [];

        const selectedRank = selectedPersonData.rank;

        // Cenário A: Pessoa está no Top 8 - Mostra Top 8 com destaque
        if (selectedRank <= TOP_COUNT) {
            return rankedCollaborators
                .slice(0, TOP_COUNT)
                .map(p => ({
                    name: p.shortName,
                    Utilizacao: p.util,
                    isHighlighted: p.name === selectedPerson
                }));
        }

        // Cenário B: Pessoa está fora do Top 8 - Mostra Top 3 + Contexto (vizinhos)
        const top3 = rankedCollaborators.slice(0, 3);
        const context = [
            rankedCollaborators[selectedRank - 2], // Posição anterior
            selectedPersonData,                     // Pessoa selecionada
            rankedCollaborators[selectedRank]       // Posição seguinte
        ].filter(Boolean);

        // Monta dados com marcador de separação visual
        const result = [
            ...top3.map(p => ({ name: `${p.rank}º ${p.shortName}`, Utilizacao: p.util, isHighlighted: false })),
            { name: '...', Utilizacao: 0, isHighlighted: false, isSeparator: true },
            ...context.map(p => ({
                name: `${p.rank}º ${p.shortName}`,
                Utilizacao: p.util,
                isHighlighted: p.name === selectedPerson
            }))
        ];

        return result;
    }, [selectedMonthId, selectedNucleo, selectedPerson, selectedClient, rankedCollaborators]);

    const topClients = useMemo(() => {
        const map = new Map<string, number>();
        globalFilteredEntries.forEach((e) => { map.set(e.c, (map.get(e.c) || 0) + e.t); });
        return Array.from(map.entries()).map(([name, val]) => ({ name, Horas: Math.round(val / 60) })).sort((a, b) => b.Horas - a.Horas).slice(0, 10);
    }, [globalFilteredEntries]);

    // Função para remover textos entre colchetes, ex: "[Timesheet] - Atividade" -> "Atividade"
    const cleanTaskName = (name: string) => name.replace(/\[.*?\]\s*-?\s*/g, '').trim();

    const topTarefas = useMemo(() => {
        const map = new Map<string, number>();
        globalFilteredEntries.forEach((e) => {
            const cleanName = cleanTaskName(e.e);
            map.set(cleanName, (map.get(cleanName) || 0) + e.t);
        });
        return Array.from(map.entries()).map(([name, val]) => ({ name, Horas: Math.round(val / 60) })).sort((a, b) => b.Horas - a.Horas).slice(0, 10);
    }, [globalFilteredEntries]);

    const formatHours = (min: number) => `${Math.floor(min / 60)}h${Math.round(min % 60).toString().padStart(2, '0')}m`;

    if (!selectedMonth) return <div>Carregando...</div>;

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 font-sans p-6 md:p-10">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
                <div className="flex items-center gap-4">
                    <Link to="/" className="p-2 rounded-xl bg-white shadow-sm border border-slate-100 hover:bg-slate-50 transition-colors">
                        <Home className="w-5 h-5 text-slate-600" />
                    </Link>
                    <h1 className="text-3xl font-extrabold text-slate-900">TimeSheet <span className="text-blue-600">Analytics</span></h1>
                </div>
                <div className="flex flex-nowrap gap-2 bg-white p-2 rounded-2xl shadow-sm border border-slate-100 overflow-x-auto">
                    {/* Filters */}
                    <select value={selectedMonthId} onChange={e => setSelectedMonthId(e.target.value)} className="bg-transparent px-2 py-1 rounded-lg border border-slate-200 text-sm min-w-0"><option value="ALL">Todo o Período</option>{data.months.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
                    <select value={selectedNucleo} onChange={e => setSelectedNucleo(e.target.value)} className="bg-transparent px-2 py-1 rounded-lg border border-slate-200 text-sm min-w-0"><option value="Todos">Todos Núcleos</option>{nucleos.map((n) => <option key={n} value={n}>{n}</option>)}</select>
                    <select value={selectedPerson} onChange={e => setSelectedPerson(e.target.value)} className="bg-transparent px-2 py-1 rounded-lg border border-slate-200 text-sm min-w-0 max-w-[180px]"><option value="Todos">Todas Pessoas</option>{people.map((p) => <option key={p} value={p}>{p}</option>)}</select>
                    <select value={selectedClient} onChange={e => setSelectedClient(e.target.value)} className="bg-transparent px-2 py-1 rounded-lg border border-slate-200 text-sm min-w-0 max-w-[180px]"><option value="Todos">Todos Clientes</option>{clients.map((c) => <option key={c} value={c}>{c}</option>)}</select>
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-10">
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                    <p className="text-xs text-slate-500 uppercase mb-1">Disponível</p>
                    <h3 className="text-xl font-bold text-slate-700">{formatHours(filteredMetrics.available)}</h3>
                </div>
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                    <p className="text-xs text-slate-500 uppercase mb-1">Realizado</p>
                    <h3 className="text-xl font-bold text-blue-600">{formatHours(filteredMetrics.logged)}</h3>
                </div>
                <div className={`p-5 rounded-2xl shadow-sm border ${filteredMetrics.estoque >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                    <p className="text-xs text-slate-500 uppercase mb-1">Estoque</p>
                    <h3 className={`text-xl font-bold ${filteredMetrics.estoque >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{filteredMetrics.estoque >= 0 ? '+' : ''}{formatHours(filteredMetrics.estoque)}</h3>
                </div>
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                    <p className="text-xs text-slate-500 uppercase mb-1">Utilização</p>
                    <h3 className="text-xl font-bold">{Math.round((filteredMetrics.logged / (filteredMetrics.available || 1)) * 100)}%</h3>
                </div>
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                    <p className="text-xs text-slate-500 uppercase mb-1">Entradas</p>
                    <h3 className="text-xl font-bold">{filteredMetrics.totalEntries.toLocaleString()}</h3>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
                {/* Gráfico de Evolução/Top Colaboradores */}
                <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
                    <h3 className="font-bold text-lg mb-4">{selectedMonthId === 'ALL' ? 'Evolução Mensal' : 'Top Colaboradores (% Utilização)'}</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={evolutionData} barSize={selectedMonthId === 'ALL' ? 40 : 24}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                            <YAxis />
                            <Tooltip formatter={(value) => [`${value ?? 0}%`, 'Utilização']} />
                            <Bar dataKey="Utilizacao" radius={[4, 4, 0, 0]}>
                                {evolutionData.map((entry, index) => (
                                    <Cell
                                        key={`cell-${index}`}
                                        fill={entry.isHighlighted ? '#f59e0b' : '#3b82f6'}
                                        opacity={(entry as unknown as { isSeparator?: boolean }).isSeparator ? 0 : 1}
                                    />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
                {/* Gráfico de Top Clientes */}
                <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
                    <h3 className="font-bold text-lg mb-4">Top Clientes</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={topClients}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} tick={{ fontSize: 9 }} />
                            <YAxis />
                            <Tooltip />
                            <Bar dataKey="Horas" fill="#f59e0b" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Seção de Top Tarefas */}
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 mb-10">
                <h3 className="font-bold text-lg mb-4">Top Tarefas / Atividades</h3>
                <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={topTarefas} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis dataKey="name" type="category" width={200} tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Bar dataKey="Horas" fill="#10b981" />
                    </BarChart>
                </ResponsiveContainer>
            </div>

            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden mb-10">
                <div className="p-6 border-b border-slate-100"><h3 className="font-bold text-lg">Detalhamento por Pessoa</h3></div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-slate-500 uppercase bg-slate-50">
                            <tr><th className="px-6 py-3">Colaborador</th><th className="px-6 py-3 text-right">Disponível</th><th className="px-6 py-3 text-right">Realizado</th><th className="px-6 py-3 text-right">Estoque</th><th className="px-6 py-3 text-right">Entradas</th><th className="px-6 py-3">Utilização</th></tr>
                        </thead>
                        <tbody>
                            {(() => {
                                const source = selectedMonthId === 'ALL' ? selectedMonth.byPerson : selectedMonth?.byPerson;
                                if (!source) return <tr><td colSpan={6} className="p-6 text-center text-slate-400">Sem dados</td></tr>;

                                // Determinar pessoas do núcleo selecionado
                                const peopleInNucleo = new Set<string>();
                                if (selectedNucleo !== 'Todos') {
                                    (selectedMonth?.rawEntries || [])
                                        .filter(e => e.n === selectedNucleo)
                                        .forEach(e => peopleInNucleo.add(e.p));
                                }

                                let list = Object.values(source);
                                // Filtrar por núcleo
                                if (selectedNucleo !== 'Todos') {
                                    list = list.filter((p) => peopleInNucleo.has(p.name));
                                }
                                // Filtrar por pessoa
                                if (selectedPerson !== 'Todos') list = list.filter((p) => p.name === selectedPerson);
                                list.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
                                return list.map((p) => {
                                    const util = p.available ? Math.round((p.logged / p.available) * 100) : 0;
                                    return (
                                        <tr key={p.name} className="border-b border-slate-50 hover:bg-slate-50/50">
                                            <td className="px-6 py-4 font-medium text-slate-900">{p.name}</td>
                                            <td className="px-6 py-4 text-right text-slate-500">{formatHours(p.available || 0)}</td>
                                            <td className="px-6 py-4 text-right font-bold text-blue-600">{formatHours(p.logged)}</td>
                                            <td className={`px-6 py-4 text-right font-medium ${(p.available || 0) - p.logged >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{(p.available || 0) - p.logged >= 0 ? '+' : ''}{formatHours((p.available || 0) - p.logged)}</td>
                                            <td className="px-6 py-4 text-right">{p.entries}</td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-full bg-slate-100 rounded-full h-2 max-w-[100px]">
                                                        <div className={`h-2 rounded-full ${util > 100 ? 'bg-amber-500' : 'bg-blue-500'}`} style={{ width: `${Math.min(util, 100)}%` }}></div>
                                                    </div>
                                                    <span className="text-xs font-bold">{util}%</span>
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                });
                            })()}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
export default GeneralDashboard;
