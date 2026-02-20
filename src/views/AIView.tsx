import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Home, Send, Bot, User, Loader2, Sparkles, AlertCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { generateGeminiContent } from '../services/gemini';
import rawData from '../data/data.json';

// Tipos
interface Message {
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
}

interface Data {
    months: Array<{
        id: string;
        name: string;
        rawEntries?: Array<{
            p: string; c: string; t: number; e: string;
        }>;
        byPerson?: { [key: string]: { name: string; available: number; logged: number; entries: number } };
        totals?: { available: number; logged: number };
    }>;
}

const data: Data = rawData as unknown as Data;

// Função para gerar contexto resumido dos dados
const generateDataContext = (): string => {
    const summary: string[] = [];

    // --- CONTEXTO GERAL ---
    let totalHours = 0;
    let totalEntries = 0;
    const clientHours = new Map<string, number>();
    const personHours = new Map<string, number>();
    const activityHours = new Map<string, number>();

    data.months.forEach(m => {
        m.rawEntries?.forEach(e => {
            totalHours += e.t;
            totalEntries++;
            clientHours.set(e.c, (clientHours.get(e.c) || 0) + e.t);
            personHours.set(e.p, (personHours.get(e.p) || 0) + e.t);
            activityHours.set(e.e, (activityHours.get(e.e) || 0) + e.t);
        });
    });

    const topClients = Array.from(clientHours.entries())
        .sort((a, b) => b[1] - a[1]).slice(0, 10)
        .map(([name, mins]) => `${name}: ${Math.round(mins / 60)}h`);

    const topPeople = Array.from(personHours.entries())
        .sort((a, b) => b[1] - a[1]).slice(0, 10)
        .map(([name, mins]) => `${name}: ${Math.round(mins / 60)}h`);

    const topActivities = Array.from(activityHours.entries())
        .sort((a, b) => b[1] - a[1]).slice(0, 10)
        .map(([name, mins]) => `${name.substring(0, 50)}: ${Math.round(mins / 60)}h`);

    summary.push(`CONTEXTO GERAL (Período: ${data.months[0]?.name} a ${data.months[data.months.length - 1]?.name})`);
    summary.push(`Total de Horas: ${Math.round(totalHours / 60)}h`);
    summary.push(`Total de Lançamentos: ${totalEntries}`);
    summary.push('');
    summary.push('TOP 10 GERAL - CLIENTES:');
    summary.push(topClients.join('\n'));
    summary.push('');
    summary.push('TOP 10 GERAL - COLABORADORES:');
    summary.push(topPeople.join('\n'));
    summary.push('');
    summary.push('TOP 10 GERAL - ATIVIDADES:');
    summary.push(topActivities.join('\n'));
    summary.push('');
    summary.push('='.repeat(30));
    summary.push('');
    summary.push('DETALHAMENTO MENSAL (Use isso para responder perguntas específicas sobre meses):');
    summary.push('');

    // --- CONTEXTO MENSAL ---
    data.months.forEach(m => {
        if (!m.rawEntries || m.rawEntries.length === 0) return;

        const mClient = new Map<string, number>();
        const mPerson = new Map<string, number>();
        const mActivity = new Map<string, number>();
        let mTotal = 0;

        m.rawEntries.forEach(e => {
            mTotal += e.t;
            mClient.set(e.c, (mClient.get(e.c) || 0) + e.t);
            mPerson.set(e.p, (mPerson.get(e.p) || 0) + e.t);
            mActivity.set(e.e, (mActivity.get(e.e) || 0) + e.t);
        });

        const mTopClients = Array.from(mClient.entries())
            .sort((a, b) => b[1] - a[1]).slice(0, 10)
            .map(([n, v]) => `${n} (${Math.round(v / 60)}h)`)
            .join(', ');

        // Enviar TODOS os colaboradores
        const mTopTeam = Array.from(mPerson.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([n, v]) => `${n} (${Math.round(v / 60)}h)`)
            .join(', ');

        const mTopActivities = Array.from(mActivity.entries())
            .sort((a, b) => b[1] - a[1]).slice(0, 20)
            .map(([n, v]) => {
                // Encontrar top 5 colaboradores desta atividade específica
                const activityContributors = new Map<string, number>();
                m.rawEntries?.filter(e => e.e === n).forEach(e => {
                    activityContributors.set(e.p, (activityContributors.get(e.p) || 0) + e.t);
                });

                const topContributors = Array.from(activityContributors.entries())
                    .sort((a, b) => b[1] - a[1]).slice(0, 5) // Top 5 pessoas da atividade
                    .map(([p, t]) => `${p} (${Math.round(t / 60)}h)`)
                    .join(', ');

                return `\n  - ${n.substring(0, 50)}: ${Math.round(v / 60)}h [Principais: ${topContributors}]`;
            })
            .join('');

        summary.push(`[${m.name}]`);
        summary.push(`- Horas Totais: ${Math.round(mTotal / 60)}h`);
        summary.push(`- Top Colaboradores: ${mTopTeam}`);
        summary.push(`- Top Clientes: ${mTopClients}`);
        summary.push(`- Detalhe Atividades: ${mTopActivities}`);
        summary.push('');
    });

    summary.push('='.repeat(30));
    summary.push('');
    summary.push('DETALHAMENTO INDIVIDUAL POR COLABORADOR (Use para análises específicas de pessoa/mês):');
    summary.push('');

    // --- CONTEXTO INDIVIDUAL (FULL INDEX) ---
    // Obter lista única de colaboradores de todos os meses
    const allPeople = new Set<string>();
    data.months.forEach(m => m.rawEntries?.forEach(e => allPeople.add(e.p)));

    Array.from(allPeople).sort().forEach(person => {
        summary.push(`COLABORADOR: ${person}`);

        data.months.forEach(m => {
            const pEntries = m.rawEntries?.filter(e => e.p === person);
            if (!pEntries || pEntries.length === 0) return;

            let pTotal = 0;
            const pClients = new Map<string, number>();
            const pActivities = new Map<string, number>();

            pEntries.forEach(e => {
                pTotal += e.t;
                pClients.set(e.c, (pClients.get(e.c) || 0) + e.t);
                pActivities.set(e.e, (pActivities.get(e.e) || 0) + e.t);
            });

            const clientStr = Array.from(pClients.entries())
                .sort((a, b) => b[1] - a[1])
                .map(([n, v]) => `${n} (${Math.round(v / 60)}h)`)
                .join(', ');

            const activityStr = Array.from(pActivities.entries())
                .sort((a, b) => b[1] - a[1])
                .map(([n, v]) => `${n.substring(0, 50)} (${Math.round(v / 60)}h)`)
                .join(', ');

            summary.push(`  [${m.name}]: ${Math.round(pTotal / 60)}h`);
            summary.push(`    - Clientes: ${clientStr}`);
            summary.push(`    - Atividades: ${activityStr}`);
        });
        summary.push('');
    });

    return summary.join('\n');
};

const AIView: React.FC = () => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

    // Scroll para o final quando novas mensagens chegam
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Foco no input ao carregar
    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    const sendMessage = async () => {
        if (!input.trim() || isLoading) return;

        const userMessage: Message = {
            role: 'user',
            content: input.trim(),
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);
        setError(null);

        try {
            const dataContext = generateDataContext();
            const systemPrompt = `Você é um assistente de análise de dados de timesheet. Responda com base nestes dados:\n${dataContext}\n\nPergunta: ${userMessage.content}`;

            // TENTATIVA API COM FALLBACK AUTOMÁTICO
            // =================================================================================
            let apiSuccess = false;

            try {
                // The apiKey is already defined in the component scope, no need to redefine.
                const text = await generateGeminiContent(apiKey, systemPrompt);
                setMessages(prev => [...prev, { role: 'assistant', content: text, timestamp: new Date() }]);
                apiSuccess = true;
            } catch (err: any) {
                console.warn('Todas as tentativas de IA falharam:', err);
                apiSuccess = false;
            }

            if (apiSuccess) {
                setIsLoading(false);
                return;
            }

            // FALLBACK: MOCK LOCAL INTELIGENTE
            // (Ativado automaticamente se a API falhar ou chave for inválida)
            // =================================================================================
            await new Promise(resolve => setTimeout(resolve, 800)); // Delay para parecer natural

            let mockResponse = "Não identifiquei essa informação nos dados resumidos. Tente: 'maiores clientes', 'quem mais trabalhou' ou 'total de horas'.";
            const lowerInput = userMessage.content.toLowerCase();

            if (lowerInput.includes('quem') || lowerInput.includes('colaborador') || lowerInput.includes('trabalhou')) {
                const topPerson = dataContext.match(/TOP 10 COLABORADORES.*?\n(.*?):/s)?.[1] || 'os principais colaboradores';
                mockResponse = `Com base nos dados, o colaborador com maior destaque é **${topPerson}**.\n\n(Consulte a aba 'Colaboradores' para detalhes finais).`;
            } else if (lowerInput.includes('cliente') || lowerInput.includes('empresa')) {
                const topClient = dataContext.match(/TOP 10 CLIENTES.*?\n(.*?):/s)?.[1] || 'os principais clientes';
                mockResponse = `O cliente com maior volume de horas registrado é **${topClient}**.`;
            } else if (lowerInput.includes('atividade') || lowerInput.includes('tarefa')) {
                const topActivity = dataContext.match(/TOP 10 ATIVIDADES.*?\n(.*?):/s)?.[1] || 'atividades diversas';
                mockResponse = `A atividade mais registrada pela equipe é **${topActivity}**.`;
            } else if (lowerInput.includes('total') || lowerInput.includes('horas')) {
                const totalHours = dataContext.match(/Total de Horas: (\d+)/)?.[1] || '0';
                mockResponse = `O total de horas registradas no período é de aproximadamente **${totalHours} horas**.`;
            } else if (lowerInput.includes('olá') || lowerInput.includes('oi')) {
                mockResponse = "Olá! Sou o assistente do Timesheet v2. Posso ajudar com dados sobre Clientes, Colaboradores e Produção.";
            }

            setMessages(prev => [...prev, {
                role: 'assistant',
                content: mockResponse + "\n\n*(Nota: Resposta gerada offline devido a instabilidade na API)*",
                timestamp: new Date()
            }]);

        } catch (err) {
            console.error('Erro geral:', err);
            setError('Serviço temporariamente indisponível.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    const suggestedQuestions = [
        'Quem é o colaborador que mais trabalhou?',
        'Qual cliente consome mais horas?',
        'Qual a atividade mais comum?',
        'Quantas horas foram trabalhadas no total?'
    ];

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            {/* Header */}
            <div className="border-b border-brand-primary/10 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
                <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link to="/" className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors border border-slate-100">
                            <Home className="w-5 h-5 text-slate-600" />
                        </Link>
                        <div className="flex items-center gap-2">
                            <Sparkles className="w-6 h-6 text-brand-secondary" />
                            <h1 className="text-xl font-bold text-slate-800">Assistente <span className="text-brand-primary">IA</span></h1>
                        </div>
                    </div>
                    <p className="text-sm text-slate-400">Powered by Gemini + Poletto Engine</p>
                </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto px-6 py-8">
                <div className="max-w-4xl mx-auto space-y-6">
                    {messages.length === 0 ? (
                        <div className="text-center py-16">
                            <div className="w-20 h-20 bg-gradient-to-br from-brand-primary to-slate-800 rounded-3xl mx-auto mb-6 flex items-center justify-center shadow-lg transform rotate-3 hover:rotate-0 transition-all duration-300">
                                <Sparkles className="w-10 h-10 text-brand-secondary" />
                            </div>
                            <h2 className="text-2xl font-bold mb-2 text-slate-800">Olá! Sou seu assistente de dados.</h2>
                            <p className="text-slate-500 mb-8 max-w-lg mx-auto">
                                Pergunte qualquer coisa sobre os dados de timesheet do escritório Poletto & Possamai.
                            </p>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl mx-auto">
                                {suggestedQuestions.map((q, i) => (
                                    <button
                                        key={i}
                                        onClick={() => setInput(q)}
                                        className="text-left p-4 rounded-xl bg-white border border-slate-200 hover:border-brand-primary hover:shadow-md transition-all text-sm text-slate-700 group hover:ring-1 hover:ring-brand-primary/10"
                                    >
                                        <span className="group-hover:text-brand-primary transition-colors">{q}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : (
                        messages.map((msg, i) => (
                            <div
                                key={i}
                                className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                                {msg.role === 'assistant' && (
                                    <div className="w-10 h-10 rounded-xl bg-brand-primary text-white flex items-center justify-center flex-shrink-0 shadow-md">
                                        <Bot className="w-6 h-6" />
                                    </div>
                                )}
                                <div className={`max-w-[80%] p-5 rounded-2xl shadow-sm ${msg.role === 'user'
                                    ? 'bg-slate-800 text-white'
                                    : 'bg-white border border-slate-100 text-slate-800'
                                    }`}
                                >
                                    <div className={`prose prose-sm md:prose-base max-w-none leading-relaxed break-words ${msg.role === 'user' ? 'prose-invert' : 'prose-slate'}`}>
                                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                                    </div>
                                    <p className="text-xs mt-2 opacity-50 text-right">
                                        {msg.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                </div>
                                {msg.role === 'user' && (
                                    <div className="w-10 h-10 rounded-xl bg-slate-200 flex items-center justify-center flex-shrink-0">
                                        <User className="w-5 h-5 text-slate-600" />
                                    </div>
                                )}
                            </div>
                        ))
                    )}

                    {isLoading && (
                        <div className="flex gap-4">
                            <div className="w-10 h-10 rounded-xl bg-brand-primary/10 flex items-center justify-center">
                                <Bot className="w-5 h-5 text-brand-primary" />
                            </div>
                            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                                <Loader2 className="w-5 h-5 animate-spin text-brand-primary" />
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="flex gap-4 items-start">
                            <div className="w-10 h-10 rounded-xl bg-red-600/20 flex items-center justify-center">
                                <AlertCircle className="w-5 h-5 text-red-400" />
                            </div>
                            <div className="bg-red-900/30 border border-red-700 p-4 rounded-2xl text-red-200">
                                <p className="font-medium">Erro ao processar sua pergunta:</p>
                                <p className="text-sm mt-1 opacity-80">{error}</p>
                            </div>
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>
            </div>

            {/* Input Area */}
            <div className="border-t border-slate-200 bg-white p-6 sticky bottom-0 z-10">
                <div className="max-w-4xl mx-auto">
                    <div className="flex gap-4">
                        <input
                            ref={inputRef}
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyPress={handleKeyPress}
                            placeholder="Digite sua pergunta sobre os dados..."
                            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent transition-all shadow-inner"
                            disabled={isLoading}
                        />
                        <button
                            onClick={sendMessage}
                            disabled={isLoading || !input.trim()}
                            className="px-6 py-3 bg-brand-primary hover:bg-brand-primary/90 text-white disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed rounded-xl transition-all shadow-md flex items-center gap-2 font-medium"
                        >
                            {isLoading ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <Send className="w-5 h-5" />
                            )}
                        </button>
                    </div>
                    <p className="text-xs text-slate-400 mt-3 text-center">
                        A IA analisa os dados de timesheet consolidados. Respostas podem não ser 100% precisas.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default AIView;
