import React, { useState, useMemo, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell, Legend
} from 'recharts';
import { Home, Clock, TrendingUp, Package, Star, Timer, Building2, ChevronDown, ChevronRight, Zap, Users, Activity, Info, CalendarCheck, Calendar, Sparkles, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { generateGeminiContent } from '../services/gemini';
import rawData from '../data/data.json';
import html2canvas from 'html2canvas-pro';
import { jsPDF } from 'jspdf';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { CollaboratorExportTemplate } from '../components/CollaboratorExportTemplate';

// Tipos
interface Entry {
    p: string;
    n: string;
    c: string;
    e: string;
    t: number;
    d?: string;  // Descrição da atividade
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
interface MonthData {
    id: string;
    name: string;
    byPerson: Record<string, PersonData>;
    rawEntries: Entry[];
}
interface DashboardData { months: MonthData[]; }
const data = rawData as unknown as DashboardData;



// Componente de Tooltip
const InfoTooltip = ({ text }: { text: string }) => (
    <div className="group relative ml-1 cursor-help inline-flex align-middle">
        <Info className="w-3.5 h-3.5 text-slate-300 hover:text-blue-500 transition-colors" />
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-slate-800 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 pointer-events-none text-center leading-tight font-normal">
            {text}
            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-800"></div>
        </div>
    </div>
);

const CollaboratorView: React.FC = () => {
    // Lista de todos os colaboradores únicos
    const allPeople = useMemo(() => {
        const peopleSet = new Set<string>();
        data.months.forEach(m => {
            if (m.rawEntries) {
                m.rawEntries.forEach(e => peopleSet.add(e.p));
            }
        });
        return Array.from(peopleSet).sort();
    }, []);

    // Suporte a query params para navegação direta
    const [searchParams] = useSearchParams();
    const personFromUrl = searchParams.get('colaborador');

    const [selectedPerson, setSelectedPerson] = useState<string>(() => {
        // Se vier da URL, usa o nome do colaborador
        if (personFromUrl && allPeople.includes(personFromUrl)) {
            return personFromUrl;
        }
        return allPeople[0] || '';
    });

    // Suporte a mês via URL
    const monthFromUrl = searchParams.get('mes');
    const [selectedMonthId, setSelectedMonthId] = useState<string>(() => {
        // Se vier da URL, usa o mês 
        if (monthFromUrl && data.months.some(m => m.id === monthFromUrl)) {
            return monthFromUrl;
        }
        return 'ALL';
    });
    const [expandedActivity, setExpandedActivity] = useState<string | null>(null);

    // Estados para AI Insight
    const [aiInsight, setAiInsight] = useState<string>('');
    const [aiLoading, setAiLoading] = useState<boolean>(false);
    const [aiError, setAiError] = useState<string | null>(null);

    // Estados para Batch Export (PDFs)
    const [exporting, setExporting] = useState<boolean>(false);
    const [exportProgress, setExportProgress] = useState({ current: 0, total: 0, status: '' });

    // Meses a considerar (filtrado ou todos)
    const relevantMonths = useMemo(() => {
        if (selectedMonthId === 'ALL') return data.months;
        return data.months.filter(m => m.id === selectedMonthId);
    }, [selectedMonthId]);

    // Todas as entradas do colaborador selecionado (filtrado por mês)
    const personEntries = useMemo(() => {
        if (!selectedPerson) return [];
        const entries: Entry[] = [];
        relevantMonths.forEach(m => {
            if (m.rawEntries) {
                entries.push(...m.rawEntries.filter(e => e.p === selectedPerson));
            }
        });
        return entries;
    }, [selectedPerson, relevantMonths]);


    // Função para limpar nome de tarefa (memoizada para evitar rerenders)
    const cleanTaskName = React.useCallback((name: string) => name.replace(/\[.*?\]\s*-?\s*/g, '').trim(), []);

    // Dados para filtros de Cruzamento (Todos os meses, para a pessoa selecionada)
    const crossAnalysisOptions = useMemo(() => {
        const clientHours = new Map<string, number>();

        data.months.forEach(m => {
            const entries = m.rawEntries?.filter(e => e.p === selectedPerson) || [];
            entries.forEach(e => {
                clientHours.set(e.c, (clientHours.get(e.c) || 0) + e.t);
            });
        });

        const topClient = Array.from(clientHours.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || '';

        return {
            clients: Array.from(clientHours.keys()).sort(),
            defaults: { topClient }
        };
    }, [selectedPerson]);

    const [crossClient, setCrossClient] = useState<string>('');
    const [crossActivity, setCrossActivity] = useState<string>('');

    // Atividades filtradas pelo cliente selecionado
    const activitiesForClient = useMemo(() => {
        if (!crossClient) return { activities: [], topActivity: '' };

        const activityHours = new Map<string, number>();

        data.months.forEach(m => {
            const entries = m.rawEntries?.filter(e =>
                e.p === selectedPerson && e.c === crossClient
            ) || [];
            entries.forEach(e => {
                const actName = cleanTaskName(e.e);
                activityHours.set(actName, (activityHours.get(actName) || 0) + e.t);
            });
        });

        const topActivity = Array.from(activityHours.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || '';

        return {
            activities: Array.from(activityHours.keys()).sort(),
            topActivity
        };
    }, [crossClient, selectedPerson, cleanTaskName]);

    // Set client default when person changes
    React.useEffect(() => {
        if (crossAnalysisOptions.defaults.topClient) {
            setCrossClient(crossAnalysisOptions.defaults.topClient);
        }
    }, [crossAnalysisOptions, selectedPerson]);

    // Set activity default when client changes
    React.useEffect(() => {
        if (activitiesForClient.topActivity) {
            setCrossActivity(activitiesForClient.topActivity);
        }
    }, [activitiesForClient]);

    // Dados para o Gráfico de Cruzamento (Temporal)
    const crossAnalysisData = useMemo(() => {
        if (!crossClient || !crossActivity) return [];

        return data.months.map(m => {
            const entries = m.rawEntries?.filter(e =>
                e.p === selectedPerson &&
                e.c === crossClient &&
                cleanTaskName(e.e) === crossActivity
            ) || [];

            const totalMinutes = entries.reduce((acc, e) => acc + e.t, 0);
            return {
                name: m.name.substring(0, 3) + '.', // Mar., Abr.
                Horas: Number((totalMinutes / 60).toFixed(1)), // Decimais para precisão em volume baixo
                minutes: totalMinutes
            };
        });
    }, [crossClient, crossActivity, selectedPerson]);

    // Dados agregados de byPerson para o colaborador (filtrado por mês)
    const personAggregated = useMemo(() => {
        let available = 0;
        let logged = 0;
        let entries = 0;
        let totalLag = 0;
        let lagCount = 0;
        relevantMonths.forEach(m => {
            if (m.byPerson && m.byPerson[selectedPerson]) {
                const p = m.byPerson[selectedPerson];
                available += p.available || 0;
                logged += p.logged || 0;
                entries += p.entries || 0;
                totalLag += p.totalLag || 0;
                lagCount += p.lagCount || 0;
            }
        });
        return { available, logged, entries, estoque: available - logged, totalLag, lagCount };
    }, [selectedPerson, relevantMonths]);


    // KPIs
    const kpis = useMemo(() => {
        const totalTime = personEntries.reduce((acc, e) => acc + e.t, 0);
        const utilizacao = personAggregated.available > 0
            ? Math.round((personAggregated.logged / personAggregated.available) * 100)
            : 0;

        // Atividade principal (mais frequente por tempo)
        const activityMap = new Map<string, { time: number; count: number }>();
        personEntries.forEach(e => {
            const name = cleanTaskName(e.e);
            const existing = activityMap.get(name) || { time: 0, count: 0 };
            activityMap.set(name, { time: existing.time + e.t, count: existing.count + 1 });
        });

        let mainActivity = { name: '-', time: 0, count: 0, avgTime: 0 };
        activityMap.forEach((val, key) => {
            if (val.time > mainActivity.time) {
                mainActivity = { name: key, time: val.time, count: val.count, avgTime: Math.round(val.time / val.count) };
            }
        });

        return {
            availableHours: Math.round(personAggregated.available / 60), // Novo KPI
            totalHours: Math.round(totalTime / 60),
            utilizacao,
            estoque: Math.round(personAggregated.estoque / 60),
            mainActivity: mainActivity.name.length > 25 ? mainActivity.name.substring(0, 25) + '...' : mainActivity.name,
            avgTimePerSession: mainActivity.avgTime, // em minutos
            avgLag: personAggregated.lagCount > 0 ? Math.round(personAggregated.totalLag / personAggregated.lagCount) : 0
        };
    }, [personEntries, personAggregated]);

    // Top Clientes (para quem trabalhou)
    const topClients = useMemo(() => {
        const map = new Map<string, number>();
        personEntries.forEach(e => {
            map.set(e.c, (map.get(e.c) || 0) + e.t);
        });
        return Array.from(map.entries())
            .map(([name, val]) => ({ name, Horas: Math.round(val / 60), minutes: val }))
            .sort((a, b) => b.Horas - a.Horas)
            .slice(0, 8);
    }, [personEntries]);

    // Top Atividades (o que fez no geral)
    const topActivities = useMemo(() => {
        const map = new Map<string, { time: number; count: number }>();
        personEntries.forEach(e => {
            const name = cleanTaskName(e.e);
            const existing = map.get(name) || { time: 0, count: 0 };
            map.set(name, { time: existing.time + e.t, count: existing.count + 1 });
        });
        return Array.from(map.entries())
            .map(([name, val]) => ({
                name: name.length > 30 ? name.substring(0, 30) + '...' : name,
                Horas: Math.round(val.time / 60),
                Média: Math.round(val.time / val.count)
            }))
            .sort((a, b) => b.Horas - a.Horas)
            .slice(0, 8);
    }, [personEntries]);



    // Drill-down para Top 3 Clientes
    const topClientsDrillDown = useMemo(() => {
        return topClients.slice(0, 3).map((client, index) => {
            const map = new Map<string, number>();
            personEntries.filter(e => e.c === client.name).forEach(e => {
                const name = cleanTaskName(e.e);
                map.set(name, (map.get(name) || 0) + e.t);
            });

            const activities = Array.from(map.entries())
                .map(([name, val]) => ({
                    name: name.length > 40 ? name.substring(0, 40) + '...' : name,
                    Horas: Math.round(val / 60)
                }))
                .sort((a, b) => b.Horas - a.Horas)
                .slice(0, 8);

            return {
                client: client.name,
                totalHours: client.Horas,
                activities,
                rank: index + 1
            };
        });
    }, [personEntries, topClients]);

    // Dados de Evolução (Histórico Completo)
    const evolutionData = useMemo(() => {
        return data.months.map(m => {
            const p = m.byPerson?.[selectedPerson];
            return {
                name: m.name.substring(0, 3),
                fullMonth: m.name,
                Disponível: p ? Math.round((p.available || 0) / 60) : 0,
                Realizado: p ? Math.round((p.logged || 0) / 60) : 0
            };
        });
    }, [selectedPerson]);

    // Índice de Foco (Deep Work vs Fragmentação)
    const focusStats = useMemo(() => {
        let totalLogged = 0;
        let fragmentTime = 0;
        let totalFragments = 0;

        relevantMonths.forEach(m => {
            if (m.byPerson && m.byPerson[selectedPerson]) {
                const p = m.byPerson[selectedPerson];
                totalLogged += p.logged || 0;
                fragmentTime += p.fragmentTime || 0;
                totalFragments += p.fragments || 0;
            }
        });

        const deepWorkTime = totalLogged - fragmentTime;
        const deepWorkPct = totalLogged > 0 ? Math.round((deepWorkTime / totalLogged) * 100) : 0;
        const fragmentPct = totalLogged > 0 ? Math.round((fragmentTime / totalLogged) * 100) : 0;

        return {
            deepWorkTime: Math.round(deepWorkTime / 60),
            fragmentTime: Math.round(fragmentTime / 60),
            deepWorkPct,
            fragmentPct,
            totalFragments,
            pieData: [
                { name: 'Deep Work', value: deepWorkTime, color: '#003763' },
                { name: 'Fragmentado', value: fragmentTime, color: '#e2e8f0' }
            ]
        };
    }, [selectedPerson, relevantMonths]);

    // Benchmarking (Comparativo com a Equipe)
    const benchmarking = useMemo(() => {
        let teamTotalAvailable = 0;
        let teamTotalLogged = 0;
        let personAvailable = 0;
        let personLogged = 0;

        relevantMonths.forEach(m => {
            if (m.byPerson) {
                Object.values(m.byPerson).forEach(p => {
                    teamTotalAvailable += p.available || 0;
                    teamTotalLogged += p.logged || 0;

                    if (p.name === selectedPerson) {
                        personAvailable += p.available || 0;
                        personLogged += p.logged || 0;
                    }
                });
            }
        });

        const teamUtil = teamTotalAvailable > 0 ? Math.round((teamTotalLogged / teamTotalAvailable) * 100) : 0;
        const personUtil = personAvailable > 0 ? Math.round((personLogged / personAvailable) * 100) : 0;

        return { teamUtil, personUtil, diff: personUtil - teamUtil };
    }, [selectedPerson, relevantMonths]);

    // Função para obter top 5 lançamentos de uma atividade para um cliente específico
    const getTopEntriesForActivity = (clientName: string, activityName: string) => {
        return personEntries
            .filter(e => e.c === clientName && cleanTaskName(e.e) === activityName)
            .sort((a, b) => b.t - a.t)
            .slice(0, 5)
            .map(e => ({
                client: e.c,
                time: e.t,
                event: e.e,
                description: e.d || ''
            }));
    };

    // Função para gerar Insight da IA
    const generateAIInsight = useCallback(async () => {
        setAiLoading(true);
        setAiError(null);
        setAiInsight('');

        const periodLabel = selectedMonthId === 'ALL' ? 'todo o período analisado' : data.months.find(m => m.id === selectedMonthId)?.name || selectedMonthId;

        const context = {
            colaborador: selectedPerson,
            periodo: periodLabel,
            kpis: {
                horasDisponiveis: kpis.availableHours,
                horasAcumuladas: kpis.totalHours,
                utilizacao: kpis.utilizacao,
                estoque: kpis.estoque,
                atividadePrincipal: kpis.mainActivity,
                tempoMedioPorSessao: kpis.avgTimePerSession,
                delayMedio: kpis.avgLag
            },
            foco: {
                deepWorkPercent: focusStats.deepWorkPct,
                fragmentadoPercent: focusStats.fragmentPct,
                totalFragmentos: focusStats.totalFragments
            },
            benchmarking: {
                utilizacaoColaborador: benchmarking.personUtil,
                utilizacaoEquipe: benchmarking.teamUtil,
                diferenca: benchmarking.diff
            },
            topClientes: topClients.slice(0, 5).map(c => ({ nome: c.name, horas: c.Horas })),
            topAtividades: topActivities.slice(0, 5).map(a => ({ nome: a.name, horas: a.Horas }))
        };

        const prompt = `Você é um gerente de operações analisando dados de timesheet.
Analise os dados abaixo sobre o colaborador "${selectedPerson}" e escreva um resumo executivo COMPLETO de 3 a 4 frases em português brasileiro.

REGRAS:
- Seja direto e objetivo
- Destaque pontos positivos e pontos de atenção
- Use **negrito** para números importantes
- Termine cada frase corretamente com ponto final

DADOS:
${JSON.stringify(context, null, 2)}`;

        try {
            const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
            // Usando serviço centralizado com fallback automático (2.5-lite -> 2.5 -> 1.5)
            const text = await generateGeminiContent(apiKey, prompt);
            setAiInsight(text);
        } catch (err) {
            setAiError('Não foi possível conectar à IA. Tente novamente.');
            console.error('AI Insight Error:', err);
        } finally {
            setAiLoading(false);
        }
    }, [selectedPerson, selectedMonthId, kpis, focusStats, benchmarking, topClients, topActivities]);

    // Função para exportar todos os PDFs em Lote
    const exportBatchPDF = async () => {
        if (!window.confirm(`Deseja exportar o resumo em PDF para todos os ${allPeople.length} colaboradores? Isso pode levar de 15 a 30 segundos dependendo de quantos forem.`)) return;

        setExporting(true);
        const originalPerson = selectedPerson;
        const zip = new JSZip();

        const monthLabel = selectedMonthId === 'ALL' ? 'Todo_Periodo' : (data.months.find(m => m.id === selectedMonthId)?.name || 'Mes').replace(/\//g, '-');

        try {
            for (let i = 0; i < allPeople.length; i++) {
                const person = allPeople[i];
                setExportProgress({ current: i + 1, total: allPeople.length, status: person });

                // Força o React a recalcular todos os useMemos para a nova pessoa
                setSelectedPerson(person);

                // Aguarda 500ms para garantir que o DOM oculto foi pintado com os dados novos e re-renderizado completamente
                await new Promise(resolve => setTimeout(resolve, 500));

                const element = document.getElementById('pdf-template-export');
                if (element) {
                    const canvas = await html2canvas(element, { scale: 2, useCORS: true, logging: false });
                    const imgData = canvas.toDataURL('image/jpeg', 0.95);

                    // A4 proportions: 210 x 297 mm
                    const pdf = new jsPDF('p', 'mm', 'a4');
                    pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297);

                    const safeName = person.replace(/[^a-zA-Z0-9\s-]/g, '').trim().replace(/\s+/g, '_');
                    zip.file(`Extrato_Mensal_${safeName}_${monthLabel}.pdf`, pdf.output('blob'));
                }
            }

            setExportProgress(prev => ({ ...prev, status: 'Compactando arquivo ZIP...' }));
            await new Promise(resolve => setTimeout(resolve, 100)); // atualiza a interface antes de travar no zip

            const content = await zip.generateAsync({ type: 'blob' });
            saveAs(content, `Relatorios_Colaboradores_${monthLabel}.zip`);

        } catch (err) {
            console.error('Erro ao gerar PDFs:', err);
            alert('Erro inesperado ao gerar os PDFs. Verifique o console.');
        } finally {
            setSelectedPerson(originalPerson);
            setExporting(false);
            setExportProgress({ current: 0, total: 0, status: '' });
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 font-sans p-6 md:p-10 relative">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
                <div className="flex items-center gap-4">
                    <Link to="/" className="p-2 rounded-xl bg-white shadow-sm border border-slate-100 hover:bg-slate-50 transition-colors">
                        <Home className="w-5 h-5 text-slate-600" />
                    </Link>
                    <h1 className="text-3xl font-extrabold text-slate-900">Jornada do <span className="text-brand-secondary">Colaborador</span></h1>
                </div>
                <div className="flex flex-wrap gap-2 bg-white p-2 rounded-2xl shadow-sm border border-slate-100">
                    <select
                        value={selectedMonthId}
                        onChange={e => setSelectedMonthId(e.target.value)}
                        className="bg-transparent px-3 py-2 rounded-lg border border-slate-200 text-sm font-medium"
                        aria-label="Selecionar período de análise"
                    >
                        <option value="ALL">Todo o Período</option>
                        {data.months.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                    <select
                        value={selectedPerson}
                        onChange={e => setSelectedPerson(e.target.value)}
                        className="bg-transparent px-3 py-2 rounded-lg border border-slate-200 text-sm font-medium min-w-[250px] disabled:opacity-50"
                        aria-label="Selecionar colaborador"
                        disabled={exporting}
                    >
                        {allPeople.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>

                    <button
                        onClick={exportBatchPDF}
                        disabled={exporting}
                        className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-opacity-90 transition-all disabled:opacity-75 disabled:cursor-wait"
                        title="Exportar Extratos Individuais (PDF) de todos os colaboradores do mês selecionado"
                    >
                        {exporting && <Loader2 className="w-4 h-4 animate-spin" />}
                        {exporting ? `Gerando ${exportProgress.current}/${exportProgress.total}...` : 'Exportar Lote (PDF)'}
                    </button>
                </div>
            </div>

            {/* Card de Insight IA */}
            <div className="mb-8 bg-white p-6 rounded-3xl border border-brand-primary/20 shadow-sm relative">
                <div className="absolute top-0 left-0 w-1 h-full bg-brand-secondary"></div>
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-brand-primary/5 rounded-xl shadow-sm">
                            <Sparkles className="w-5 h-5 text-brand-primary" />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-800">Insight da IA</h3>
                            <p className="text-xs text-slate-500">Análise inteligente do colaborador no período selecionado</p>
                        </div>
                    </div>
                    <button
                        onClick={generateAIInsight}
                        disabled={aiLoading}
                        className="flex items-center gap-2 px-4 py-2 bg-brand-primary text-white text-sm font-medium rounded-xl hover:bg-opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm border border-transparent hover:border-brand-secondary/50 group"
                    >
                        {aiLoading ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin text-brand-secondary" />
                                Analisando...
                            </>
                        ) : (
                            <>
                                <Sparkles className="w-4 h-4 text-brand-secondary group-hover:text-white transition-colors" />
                                Gerar Análise
                            </>
                        )}
                    </button>
                </div>

                {aiError && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                        {aiError}
                    </div>
                )}

                {aiInsight && !aiError && (
                    <div className="prose prose-sm prose-slate max-w-none bg-white/70 p-4 rounded-xl overflow-y-auto max-h-[300px] break-words [&>*]:break-words scrollbar-thin scrollbar-thumb-slate-200">
                        <ReactMarkdown>{aiInsight}</ReactMarkdown>
                    </div>
                )}

                {!aiInsight && !aiError && !aiLoading && (
                    <p className="text-slate-400 text-sm italic">Clique em "Gerar Análise" para obter um resumo executivo personalizado.</p>
                )}
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 gap-4 mb-10">
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                    <div className="flex items-center gap-2 text-slate-400 mb-2">
                        <Calendar className="w-4 h-4" />
                        <span className="text-xs uppercase flex items-center">
                            Horas Disponíveis
                            <InfoTooltip text="Total de horas possíveis/contratadas no período." />
                        </span>
                    </div>
                    <h3 className="text-2xl font-bold text-slate-700">{kpis.availableHours}h</h3>
                </div>
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                    <div className="flex items-center gap-2 text-slate-400 mb-2">
                        <Clock className="w-4 h-4" />
                        <span className="text-xs uppercase flex items-center">
                            Horas Acumuladas
                            <InfoTooltip text="Soma de todas as horas lançadas no período selecionado." />
                        </span>
                    </div>
                    <h3 className="text-2xl font-bold text-brand-primary">{kpis.totalHours}h</h3>
                </div>
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                    <div className="flex items-center gap-2 text-slate-400 mb-2">
                        <TrendingUp className="w-4 h-4" />
                        <span className="text-xs uppercase flex items-center">
                            Utilização
                            <InfoTooltip text="% de horas trabalhadas vs. horas úteis totais." />
                        </span>
                    </div>
                    <h3 className="text-2xl font-bold">{kpis.utilizacao}%</h3>
                </div>
                <div className={`p-5 rounded-2xl shadow-sm border ${kpis.estoque >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                    <div className="flex items-center gap-2 text-slate-400 mb-2">
                        <Package className="w-4 h-4" />
                        <span className="text-xs uppercase flex items-center">
                            Estoque
                            <InfoTooltip text="Saldo: Horas Contratadas - Horas Trabalhadas." />
                        </span>
                    </div>
                    <h3 className={`text-2xl font-bold ${kpis.estoque >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {kpis.estoque >= 0 ? '+' : ''}{kpis.estoque}h
                    </h3>
                </div>
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                    <div className="flex items-center gap-2 text-slate-400 mb-2">
                        <Star className="w-4 h-4" />
                        <span className="text-xs uppercase flex items-center">
                            Atividade Principal
                            <InfoTooltip text="A atividade que consumiu maior volume de horas." />
                        </span>
                    </div>
                    <h3 className="text-sm font-bold text-slate-700" title={kpis.mainActivity}>{kpis.mainActivity}</h3>
                </div>
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                    <div className="flex items-center gap-2 text-slate-400 mb-2">
                        <Timer className="w-4 h-4" />
                        <span className="text-xs uppercase flex items-center">
                            Tempo Médio/Sessão
                            <InfoTooltip text="Duração média de cada bloco de trabalho contínuo." />
                        </span>
                    </div>
                    <h3 className="text-2xl font-bold text-amber-600">{kpis.avgTimePerSession}min</h3>
                </div>
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                    <div className="flex items-center gap-2 text-slate-400 mb-2">
                        <CalendarCheck className="w-4 h-4" />
                        <span className="text-xs uppercase flex items-center">
                            Delay Médio
                            <InfoTooltip text="Média de dias entre a realização do trabalho e o lançamento no sistema." />
                        </span>
                    </div>
                    <h3 className={`text-2xl font-bold ${kpis.avgLag <= 2 ? 'text-emerald-600' :
                        kpis.avgLag <= 5 ? 'text-amber-600' : 'text-red-600'
                        }`}>
                        {kpis.avgLag} dias
                    </h3>
                </div>
            </div>

            {/* Gráficos: Clientes e Atividades */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
                {/* Para quem trabalhou */}
                <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
                    <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                        <Building2 className="w-5 h-5 text-blue-500" />
                        Para quem trabalhou?
                        <InfoTooltip text="Distribuição do volume de horas por cliente." />
                    </h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={topClients.slice(0, 6)} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis type="number" />
                            <YAxis
                                dataKey="name"
                                type="category"
                                width={140}
                                tick={{ fontSize: 10 }}
                                tickFormatter={(value) => value.length > 18 ? value.substring(0, 18) + '...' : value}
                            />
                            <Bar dataKey="Horas" fill="#003763" radius={[0, 4, 4, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* O que fez */}
                <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
                    <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                        O que fez? (Top Atividades)
                        <InfoTooltip text="As atividades que mais consumiram tempo." />
                    </h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={topActivities} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis type="number" />
                            <YAxis dataKey="name" type="category" width={150} tick={{ fontSize: 10 }} />
                            <Tooltip formatter={(value, name) => name === 'Média' ? `${value} min/sessão` : `${value}h`} />
                            <Bar dataKey="Horas" fill="#10b981" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Deep Dive: Top 3 Clientes */}
            {topClientsDrillDown.map((drilldown) => (
                <div key={drilldown.client} className={`p-8 rounded-3xl shadow-sm border mb-6 ${drilldown.rank === 1 ? 'bg-brand-primary/5 border-brand-primary/20' :
                    drilldown.rank === 2 ? 'bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-100' :
                        'bg-gradient-to-br from-amber-50 to-orange-50 border-amber-100'
                    }`}>
                    <h3 className="font-bold text-lg mb-6 flex items-center gap-2">
                        <Building2 className={`w-5 h-5 ${drilldown.rank === 1 ? 'text-brand-primary' : 'text-slate-400'}`} />
                        <span className="text-slate-500">{drilldown.rank}º Cliente:</span>
                        <span className={`${drilldown.rank === 1 ? 'text-brand-primary' :
                            drilldown.rank === 2 ? 'text-emerald-600' :
                                'text-amber-600'
                            }`}>{drilldown.client}</span>
                        <span className="text-sm font-normal text-slate-400">({drilldown.totalHours}h)</span>
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <h4 className="text-sm font-medium text-slate-500 mb-4">O que foi feito para este cliente:</h4>
                            <ResponsiveContainer width="100%" height={220}>
                                <BarChart data={drilldown.activities} layout="vertical">
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis type="number" />
                                    <YAxis dataKey="name" type="category" width={160} tick={{ fontSize: 9 }} />
                                    <Tooltip formatter={(value) => `${value}h`} />
                                    <Bar dataKey="Horas" fill={
                                        drilldown.rank === 1 ? '#6366f1' :
                                            drilldown.rank === 2 ? '#10b981' :
                                                '#f59e0b'
                                    } />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                        <div>
                            <h4 className="text-sm font-medium text-slate-500 mb-4">Resumo das atividades:</h4>
                            <div className="space-y-2">
                                {drilldown.activities.slice(0, 5).map((a, i) => {
                                    const activityKey = `${drilldown.client}-${a.name}`;
                                    const isExpanded = expandedActivity === activityKey;
                                    const topEntries = isExpanded ? getTopEntriesForActivity(drilldown.client, a.name) : [];

                                    return (
                                        <div key={i} className="bg-white/80 rounded-xl overflow-hidden">
                                            <button
                                                onClick={() => setExpandedActivity(isExpanded ? null : activityKey)}
                                                className="w-full flex justify-between items-center p-3 hover:bg-white transition-colors"
                                            >
                                                <div className="flex items-center gap-2">
                                                    {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                                                    <span className="text-sm text-slate-700 text-left">{a.name}</span>
                                                </div>
                                                <span className={`text-sm font-bold ${drilldown.rank === 1 ? 'text-brand-primary' :
                                                    drilldown.rank === 2 ? 'text-emerald-600' :
                                                        'text-amber-600'
                                                    }`}>{a.Horas}h</span>
                                            </button>
                                            {isExpanded && topEntries.length > 0 && (
                                                <div className="px-4 pb-3 space-y-2 border-t border-slate-100">
                                                    <p className="text-xs text-slate-400 pt-2">Top 5 maiores lançamentos:</p>
                                                    {topEntries.map((entry, j) => (
                                                        <div key={j} className="bg-slate-50 p-2 rounded-lg text-xs">
                                                            <div className="flex justify-between items-start">
                                                                <span className="text-slate-600 flex-1 font-medium">{entry.event}</span>
                                                                <span className="font-bold text-slate-700 ml-2">{Math.round(entry.time / 60)}h{(entry.time % 60).toString().padStart(2, '0')}m</span>
                                                            </div>
                                                            {entry.description && (
                                                                <p className="text-slate-500 mt-1 italic text-[10px] leading-tight">
                                                                    {entry.description.length > 120 ? entry.description.substring(0, 120) + '...' : entry.description}
                                                                </p>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            ))}

            {/* Seções de Inteligência (Novos KPIs) */}
            <h3 className="font-bold text-lg mb-6 flex items-center gap-2 text-slate-800">
                <Activity className="w-5 h-5 text-brand-primary" />
                Inteligência & Tendências
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-10">

                {/* 1. Evolução Temporal */}

                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 col-span-1 md:col-span-2 lg:col-span-3">
                    <h4 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-emerald-500" />
                        Evolução Anual
                        <InfoTooltip text="Histórico mensal: Meta (Verde) vs. Realizado (Azul)." />
                    </h4>
                    <ResponsiveContainer width="100%" height={250}>
                        <AreaChart data={evolutionData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                            <Tooltip />
                            <Legend />
                            <Area type="monotone" dataKey="Disponível" stackId="0" stroke="#10b981" fill="#10b981" fillOpacity={0.1} />
                            <Area type="monotone" dataKey="Realizado" stackId="1" stroke="#003763" fill="#003763" fillOpacity={0.6} />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>

                {/* 2. Índice de Foco */}
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                    <h4 className="font-bold text-slate-700 mb-2 flex items-center gap-2">
                        <Zap className="w-4 h-4 text-amber-500" />
                        Índice de Foco
                        <div className="group relative ml-1 cursor-help">
                            <Info className="w-4 h-4 text-slate-300 hover:text-blue-500 transition-colors" />
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-slate-800 text-white text-xs rounded-xl shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 pointer-events-none">
                                <p className="font-bold mb-1">Entenda o índice:</p>
                                <p className="mb-1"><span className="text-blue-400 font-bold">Deep Work:</span> Tarefas com duração maior que 9 minutos.</p>
                                <p><span className="text-slate-400 font-bold">Fragmentado:</span> Tarefas curtas (menores de 9 min), indicando interrupções ou trocas de contexto.</p>
                            </div>
                        </div>
                    </h4>
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <p className="text-3xl font-bold text-blue-600">{focusStats.deepWorkPct}%</p>
                            <p className="text-xs text-slate-400">Deep Work</p>
                        </div>
                        <div className="text-right">
                            <p className="text-xl font-bold text-slate-400">{focusStats.fragmentPct}%</p>
                            <p className="text-xs text-slate-400">Fragmentado</p>
                        </div>
                    </div>
                    <div className="h-32 w-full relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={focusStats.pieData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={35}
                                    outerRadius={55}
                                    startAngle={90}
                                    endAngle={-270}
                                    dataKey="value"
                                >
                                    {focusStats.pieData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex items-center justify-center font-bold text-slate-300 text-xs pointer-events-none">
                            {focusStats.totalFragments} frags
                        </div>
                    </div>
                </div>

                {/* 3. Cruzamento Dinâmico (Substitui Radar) */}
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 col-span-1 md:col-span-2 lg:col-span-3">
                    <h4 className="font-bold text-slate-700 mb-6 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-brand-primary" />
                            Análise de Evolução Específica
                            <InfoTooltip text="Selecione um Cliente e uma Atividade para ver a evolução temporal exata." />
                        </div>
                        <div className="flex gap-2">
                            <select
                                value={crossClient}
                                onChange={(e) => setCrossClient(e.target.value)}
                                className="text-xs border border-slate-200 rounded-lg px-2 py-1 max-w-[150px]"
                                aria-label="Selecionar cliente para análise cruzada"
                            >
                                {crossAnalysisOptions.clients.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                            <select
                                value={crossActivity}
                                onChange={(e) => setCrossActivity(e.target.value)}
                                className="text-xs border border-slate-200 rounded-lg px-2 py-1 max-w-[200px]"
                                aria-label="Selecionar atividade para análise cruzada"
                            >
                                {activitiesForClient.activities.map(a => <option key={a} value={a}>{a}</option>)}
                            </select>
                        </div>
                    </h4>

                    <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={crossAnalysisData}>
                                <defs>
                                    <linearGradient id="colorCross" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                                <Tooltip formatter={(value) => `${value}h`} />
                                <Area
                                    type="monotone"
                                    dataKey="Horas"
                                    stroke="#6366f1"
                                    fillOpacity={1}
                                    fill="url(#colorCross)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 4. Benchmarking (Ajustado) */}
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 col-span-1 md:col-span-2 lg:col-span-3">
                    <h4 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                        <Users className="w-4 h-4 text-purple-500" />
                        Comparativo com Equipe
                        <InfoTooltip text="Sua utilização vs. média geral do escritório." />
                    </h4>
                    <div className="space-y-6">
                        <div>
                            <div className="flex justify-between text-sm mb-1">
                                <span className="text-slate-500">Utilização {selectedPerson.split(' ')[0]}</span>
                                <span className="font-bold text-slate-700">{benchmarking.personUtil}%</span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-2">
                                <div
                                    className="bg-blue-600 h-2 rounded-full"
                                    style={{ width: `${Math.min(benchmarking.personUtil, 100)}%` }}
                                ></div>
                            </div>
                        </div>
                        <div>
                            <div className="flex justify-between text-sm mb-1">
                                <span className="text-slate-500">Média da Equipe</span>
                                <span className="font-bold text-slate-500">{benchmarking.teamUtil}%</span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-2">
                                <div
                                    className="bg-slate-400 h-2 rounded-full"
                                    style={{ width: `${Math.min(benchmarking.teamUtil, 100)}%` }}
                                ></div>
                            </div>
                        </div>
                        <div className={`p-3 rounded-xl text-sm font-medium text-center ${benchmarking.diff >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                            }`}>
                            {selectedPerson.split(' ')[0]} está
                            <span className="font-bold"> {Math.abs(benchmarking.diff)}% {benchmarking.diff >= 0 ? 'acima' : 'abaixo'} </span>
                            da média.
                        </div>
                    </div>
                </div>

            </div>

            {/* Hidden Export Template */}
            <div style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', opacity: 0, zIndex: -100 }}>
                <div id="pdf-template-export">
                    <CollaboratorExportTemplate
                        collaboratorName={selectedPerson}
                        monthName={relevantMonths.length === 1 ? relevantMonths[0].name : 'Todo o Período'}
                        kpis={kpis}
                        focusStats={focusStats}
                        topClients={topClients}
                        topActivities={topActivities}
                    />
                </div>
            </div>
        </div>
    );
};

export default CollaboratorView;
