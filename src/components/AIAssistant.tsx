
import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import ReactMarkdown from 'react-markdown';
import { Sparkles, Send, X, Loader2 } from 'lucide-react';

interface AIAssistantProps {
    data: any; // Recebe o objeto completo de dados do dashboard
}

interface Message {
    role: 'user' | 'model';
    text: string;
}

export const AIAssistant: React.FC<AIAssistantProps> = ({ data }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
        { role: 'model', text: 'Olá! Sou seu analista de dados virtual. Me pergunte qualquer coisa sobre os registros de horas! 🧠✨' }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isOpen]);

    const prepareContextData = () => {
        // Achata os dados de todos os meses em uma lista única e simples
        const allEntries: any[] = [];
        if (data && data.months) {
            data.months.forEach((m: any) => {
                if (m.rawEntries) {
                    m.rawEntries.forEach((e: any) => {
                        allEntries.push({
                            Data: e.d,
                            Autor: e.p, // Pessoa
                            Cliente: e.c,
                            Nucleo: e.n,
                            Atividade: e.e,
                            Minutos: e.t
                        });
                    });
                }
            });
        }
        return JSON.stringify(allEntries);
    };

    const handleSend = async () => {
        if (!input.trim() || !apiKey) return;

        const userMsg = input;
        setInput('');
        setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
        setIsLoading(true);

        try {
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

            const contextData = prepareContextData();

            const prompt = `
        Você é um analista de dados especialista em timesheets.
        Analise os dados JSON abaixo e responda à pergunta do usuário de forma concisa, direta e amigável (em Português do Brasil).
        
        DADOS (Array de registros de horas):
        ${contextData}
        
        Contexto:
        - 'Minutos' é o tempo gasto. Para converter para horas, divida por 60.
        - Se a pergunta for sobre "Total", some os minutos e converta.
        - Seja analítico. Se notar algo interessante (ex: um cliente tomando muito tempo), comente.
        
        PERGUNTA DO USUÁRIO:
        "${userMsg}"
      `;

            const result = await model.generateContent(prompt);
            const response = result.response;
            const text = response.text();

            setMessages(prev => [...prev, { role: 'model', text: text }]);
        } catch (error) {
            console.error("Erro na AI:", error);
            setMessages(prev => [...prev, { role: 'model', text: `Ops, tive um problema (Erro: ${error instanceof Error ? error.message : String(error)}). Tente novamente.` }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    if (!apiKey) return null; // Não renderiza se não tiver chave

    return (
        <>
            {/* Floating Action Button */}
            {!isOpen && (
                <button
                    onClick={() => setIsOpen(true)}
                    className="fixed bottom-8 right-8 bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-4 rounded-full shadow-lg hover:shadow-2xl hover:scale-105 transition-all z-40 flex items-center gap-2 group"
                >
                    <Sparkles className="w-6 h-6 animate-pulse" />
                    <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 font-bold whitespace-nowrap">
                        IA Analyst
                    </span>
                </button>
            )}

            {/* Chat Window */}
            {isOpen && (
                <div className="fixed bottom-8 right-8 w-96 h-[500px] bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-10 duration-300">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-4 flex items-center justify-between text-white">
                        <div className="flex items-center gap-2">
                            <Sparkles className="w-5 h-5" />
                            <h3 className="font-bold">Assistente IA</h3>
                        </div>
                        <button onClick={() => setIsOpen(false)} className="hover:bg-white/20 p-1 rounded-full transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-4 bg-slate-50 space-y-4">
                        {messages.map((msg, idx) => (
                            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div
                                    className={`
                    max-w-[85%] p-3 rounded-2xl text-sm leading-relaxed shadow-sm
                    ${msg.role === 'user'
                                            ? 'bg-indigo-600 text-white rounded-br-none'
                                            : 'bg-white text-slate-700 border border-slate-200 rounded-bl-none prose prose-indigo prose-sm'}
                  `}
                                >
                                    <ReactMarkdown>{msg.text}</ReactMarkdown>
                                </div>
                            </div>
                        ))}
                        {isLoading && (
                            <div className="flex justify-start">
                                <div className="bg-white p-3 rounded-2xl rounded-bl-none border border-slate-200 shadow-sm flex items-center gap-2 text-slate-500 text-sm">
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span>Analisando dados...</span>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input */}
                    <div className="p-4 bg-white border-t border-slate-100">
                        <div className="flex items-center gap-2 bg-slate-100 rounded-full px-4 py-2 border border-transparent focus-within:border-indigo-300 focus-within:ring-2 focus-within:ring-indigo-100 transition-all">
                            <input
                                type="text"
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                onKeyDown={handleKeyPress}
                                placeholder="Pergunte sobre os dados..."
                                className="flex-1 bg-transparent border-none focus:ring-0 text-sm text-slate-800 placeholder:text-slate-400"
                                autoFocus
                            />
                            <button
                                onClick={handleSend}
                                disabled={isLoading || !input.trim()}
                                className="text-indigo-600 disabled:text-slate-400 hover:scale-110 transition-transform p-1"
                            >
                                <Send className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
