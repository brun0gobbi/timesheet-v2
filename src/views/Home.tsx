import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, Users, Building2, MessageSquareText, TrendingUp, Clock, Package, ShieldCheck, Briefcase } from 'lucide-react';
import rawData from '../data/data.json';

// Tipos
interface PersonData {
    name: string;
    available: number;
    logged: number;
    entries: number;
}
interface MonthData {
    id: string;
    name: string;
    byPerson: Record<string, PersonData>;
    rawEntries: { t: number }[];
}
interface DashboardData { months: MonthData[]; }
const data = rawData as unknown as DashboardData;

const Home: React.FC = () => {
    // Calcular métricas globais a partir dos dados reais
    const globalStats = useMemo(() => {
        let totalAvailable = 0;
        let totalLogged = 0;
        let totalEntries = 0;

        data.months.forEach(m => {
            if (m.byPerson) {
                Object.values(m.byPerson).forEach(p => {
                    totalAvailable += (p.available || 0);
                    totalLogged += (p.logged || 0);
                });
            }
            if (m.rawEntries) {
                totalEntries += m.rawEntries.length;
            }
        });

        const estoque = totalAvailable - totalLogged;
        return {
            available: Math.round(totalAvailable / 60),
            logged: Math.round(totalLogged / 60),
            estoque: Math.round(estoque / 60),
            entries: totalEntries,
            months: data.months.length
        };
    }, []);

    const formatNumber = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}K` : n.toString();

    const cards = [
        {
            title: 'Visão Geral',
            description: 'Dashboard completo com métricas, gráficos de evolução e ranking de clientes e colaboradores.',
            icon: BarChart3,
            color: 'from-brand-primary-light to-brand-primary',
            link: '/dashboard',
            available: true
        },
        {
            title: 'Jornada do Colaborador',
            description: 'Acompanhe a evolução individual, timeline de atividades e produtividade ao longo do tempo.',
            icon: Users,
            color: 'from-emerald-500 to-teal-600',
            link: '/colaborador',
            available: true
        },
        {
            title: 'Raio-X do Cliente',
            description: 'Visão detalhada por cliente: horas investidas, equipes envolvidas e histórico de entregas.',
            icon: Building2,
            color: 'from-amber-500 to-orange-600',
            link: '/cliente',
            available: true
        },
        {
            title: 'Pergunte à IA',
            description: 'Faça perguntas em linguagem natural sobre os dados. A IA analisa e responde com insights.',
            icon: MessageSquareText,
            color: 'from-purple-500 to-pink-600',
            link: '/ia',
            available: true
        },
        {
            title: 'Revisão e Auditoria',
            description: 'Área exclusiva para gestores. Validação de fidelidade dos lançamentos e aprovação de timesheet.',
            icon: ShieldCheck,
            color: 'from-red-500 to-rose-600',
            link: '/audit',
            available: true
        },
        {
            title: 'Análise de Atividades',
            description: 'Cruze dados por núcleo e cliente para entender onde o tempo está sendo investido.',
            icon: Briefcase,
            color: 'from-blue-600 to-indigo-700',
            link: '/atividades',
            available: true
        }
    ];

    return (
        <div className="min-h-screen bg-gradient-to-br from-brand-primary-dark via-brand-primary to-brand-primary-dark text-white">
            {/* Hero Section */}
            <div className="relative overflow-hidden">
                {/* Background decoration */}
                <div className="absolute inset-0 opacity-20">
                    <div className="absolute top-20 left-20 w-72 h-72 bg-brand-secondary rounded-full blur-[128px]"></div>
                    <div className="absolute bottom-20 right-20 w-96 h-96 bg-brand-primary-light rounded-full blur-[128px]"></div>
                </div>

                <div className="relative max-w-6xl mx-auto px-6 py-20">
                    {/* Logo & Title */}
                    <div className="text-center mb-16">
                        <div className="inline-flex items-center gap-3 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full mb-6 border border-white/10">
                            <Clock className="w-5 h-5 text-brand-secondary" />
                            <span className="text-sm font-medium text-slate-300">TimeSheet Intelligence v2</span>
                        </div>
                        <h1 className="text-4xl md:text-5xl font-extrabold mb-4 text-white tracking-tight">
                            Análise Estratégica do Tempo<br />
                            <span className="text-brand-secondary">Poletto & Possamai</span>
                        </h1>
                        <p className="text-lg text-slate-300 max-w-2xl mx-auto mb-10">
                            Consolidação automática dos dados de timesheet para apoio à gestão e à tomada de decisão.
                        </p>

                        {/* Seção Explicativa (About) */}
                        <div className="bg-white/5 backdrop-blur-md rounded-3xl p-8 border border-white/10 max-w-5xl mx-auto mb-16 text-left">
                            <p className="text-slate-300 mb-6 text-center text-lg">
                                Esta plataforma consolida, de forma automática e inteligente, todos os dados de timesheet do escritório.
                                O objetivo não é apenas acompanhar horas lançadas, mas compreender como o tempo é efetivamente utilizado.
                            </p>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="p-4 rounded-xl bg-brand-primary/20 border border-white/5">
                                    <div className="flex items-center gap-3 mb-2 text-brand-secondary">
                                        <Building2 className="w-5 h-5" />
                                        <h3 className="font-bold text-white text-sm">Organização</h3>
                                    </div>
                                    <p className="text-sm text-slate-400 leading-relaxed">
                                        Estrutura as informações por núcleo, cliente, colaborador e tipo de atividade para visão granular.
                                    </p>
                                </div>
                                <div className="p-4 rounded-xl bg-brand-primary/20 border border-white/5">
                                    <div className="flex items-center gap-3 mb-2 text-brand-secondary">
                                        <TrendingUp className="w-5 h-5" />
                                        <h3 className="font-bold text-white text-sm">Padrões & Gargalos</h3>
                                    </div>
                                    <p className="text-sm text-slate-400 leading-relaxed">
                                        Identifica padrões de uso do tempo, concentração de demanda e gargalos operacionais.
                                    </p>
                                </div>
                                <div className="p-4 rounded-xl bg-brand-primary/20 border border-white/5">
                                    <div className="flex items-center gap-3 mb-2 text-brand-secondary">
                                        <Users className="w-5 h-5" />
                                        <h3 className="font-bold text-white text-sm">Decisão Estratégica</h3>
                                    </div>
                                    <p className="text-sm text-slate-400 leading-relaxed">
                                        Apresenta indicadores objetivos que apoiam decisões de gestão baseadas em dados reais.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Stats Preview */}
                    <div className="flex flex-wrap justify-center gap-6 mb-16">
                        <div className="text-center min-w-[100px]">
                            <div className="flex items-center justify-center gap-2 text-slate-300 mb-1">
                                <Clock className="w-5 h-5" />
                                <span className="text-3xl font-bold">{formatNumber(globalStats.available)}</span>
                            </div>
                            <span className="text-sm text-slate-500">Horas Disponíveis</span>
                        </div>
                        <div className="text-center min-w-[100px]">
                            <div className="flex items-center justify-center gap-2 text-blue-400 mb-1">
                                <TrendingUp className="w-5 h-5" />
                                <span className="text-3xl font-bold">{formatNumber(globalStats.logged)}</span>
                            </div>
                            <span className="text-sm text-slate-500">Horas Lançadas</span>
                        </div>
                        <div className="text-center min-w-[100px]">
                            <div className={`flex items-center justify-center gap-2 ${globalStats.estoque >= 0 ? 'text-emerald-400' : 'text-red-400'} mb-1`}>
                                <Package className="w-5 h-5" />
                                <span className="text-3xl font-bold">{globalStats.estoque >= 0 ? '+' : ''}{formatNumber(globalStats.estoque)}</span>
                            </div>
                            <span className="text-sm text-slate-500">Estoque</span>
                        </div>
                        <div className="text-center min-w-[100px]">
                            <div className="flex items-center justify-center gap-2 text-amber-400 mb-1">
                                <Users className="w-5 h-5" />
                                <span className="text-3xl font-bold">{formatNumber(globalStats.entries)}</span>
                            </div>
                            <span className="text-sm text-slate-500">Entradas</span>
                        </div>
                        <div className="text-center min-w-[100px]">
                            <div className="flex items-center justify-center gap-2 text-purple-400 mb-1">
                                <BarChart3 className="w-5 h-5" />
                                <span className="text-3xl font-bold">{globalStats.months}</span>
                            </div>
                            <span className="text-sm text-slate-500">Meses</span>
                        </div>
                    </div>

                    {/* Navigation Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
                        {cards.map((card) => (
                            <div key={card.title} className="relative group">
                                {card.available ? (
                                    <Link
                                        to={card.link}
                                        className="block p-8 rounded-3xl bg-white/5 backdrop-blur-sm border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl"
                                    >
                                        <div className={`inline-flex p-3 rounded-2xl bg-gradient-to-br ${card.color} mb-4`}>
                                            <card.icon className="w-6 h-6 text-white" />
                                        </div>
                                        <h3 className="text-xl font-bold mb-2">{card.title}</h3>
                                        <p className="text-slate-400 text-sm leading-relaxed">{card.description}</p>
                                        <div className="mt-4 text-sm font-medium text-blue-400 group-hover:text-blue-300 transition-colors">
                                            Acessar →
                                        </div>
                                    </Link>
                                ) : (
                                    <div className="block p-8 rounded-3xl bg-white/5 backdrop-blur-sm border border-white/10 opacity-60 cursor-not-allowed">
                                        <div className={`inline-flex p-3 rounded-2xl bg-gradient-to-br ${card.color} mb-4 opacity-50`}>
                                            <card.icon className="w-6 h-6 text-white" />
                                        </div>
                                        <h3 className="text-xl font-bold mb-2">{card.title}</h3>
                                        <p className="text-slate-400 text-sm leading-relaxed">{card.description}</p>
                                        <div className="mt-4 text-sm font-medium text-slate-500">
                                            Em breve
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Footer */}
                    <div className="text-center mt-16 text-slate-500 text-sm">
                        <p>Desenvolvido com 💙 usando React, Vite e Recharts</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Home;
