import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, UserCheck, ShieldCheck, CheckCircle, XCircle, AlertTriangle, Table2, Search, Eye, X } from 'lucide-react';
import { MANAGERS } from '../config/managers';
import type { ManagerConfig } from '../config/managers';
import type { DashboardData, AuditEntry, RejectionReason, ReviewAction, AuditState, RawEntry, MonthData } from '../types';
import finalData from '../data/data.json';

// Cast data to typed structure
const data = finalData as unknown as DashboardData;

// --- LocalStorage Keys ---
const STORAGE_KEY_PREFIX = 'timesheet_audit_reviews';

// Generate a unique, deterministic ID for an entry based on its content
const generateEntryId = (raw: { p: string; c: string; n: string; e: string; d?: string; t: number; dt?: string }, monthId: string): string => {
    // Create a unique hash based on all entry properties
    const str = `${monthId}-${raw.p}-${raw.c}-${raw.n}-${raw.e}-${raw.t}-${raw.dt || ''}-${raw.d?.slice(0, 50) || ''}`;
    // Simple hash function
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return `entry-${Math.abs(hash)}`;
};

// LocalStorage helpers
const getStorageKey = (managerId: string, monthId: string): string => {
    return `${STORAGE_KEY_PREFIX}_${managerId}_${monthId}`;
};

const loadReviewsFromStorage = (managerId: string, monthId: string): AuditState => {
    try {
        const key = getStorageKey(managerId, monthId);
        const stored = localStorage.getItem(key);
        if (stored) {
            return JSON.parse(stored);
        }
    } catch (e) {
        console.error('Error loading reviews from storage:', e);
    }
    return {};
};

const saveReviewsToStorage = (managerId: string, monthId: string, reviews: AuditState): void => {
    try {
        const key = getStorageKey(managerId, monthId);
        localStorage.setItem(key, JSON.stringify(reviews));
    } catch (e) {
        console.error('Error saving reviews to storage:', e);
    }
};

// --- Components ---

export function AuditView() {
    const navigate = useNavigate();

    // State
    const [selectedManager, setSelectedManager] = useState<ManagerConfig | null>(null);
    const [selectedMonth] = useState<string>(() => {
        // Safe initialization - fixed to last month (Dezembro)
        if (data?.months && data.months.length > 0) {
            return data.months[data.months.length - 1].id;
        }
        return "";
    });

    // Derived State (Data Processing)
    const auditData = useMemo(() => {
        if (!selectedManager || !selectedMonth) return null;

        const monthData = data.months?.find((m: MonthData) => m.id === selectedMonth);
        if (!monthData) return null;

        // Filter by Nucleo
        const targetNucleos = Array.isArray(selectedManager.nucleo)
            ? selectedManager.nucleo
            : [selectedManager.nucleo];

        // Filter entries for this manager's team
        const teamEntries = monthData.rawEntries.filter((entry: RawEntry) =>
            targetNucleos.includes(entry.n)
        );

        // Group by Collaborator
        const byCollaborator: Record<string, AuditEntry[]> = {};

        teamEntries.forEach((raw: RawEntry) => {
            if (!byCollaborator[raw.p]) byCollaborator[raw.p] = [];

            byCollaborator[raw.p].push({
                id: generateEntryId(raw, selectedMonth), // Unique, persistent ID
                collaborator: raw.p,
                client: raw.c,
                project: raw.n,
                activity: raw.e,
                description: raw.d || '',
                time: raw.t,
                date: raw.dt, // Data do lançamento com hora
                transferredAt: raw.te, // Transferido em
                pj: raw.pj, // Número do processo
                isTop5: false // Will calculate below
            });
        });

        // Sample Selection Logic (Top 5 + Random 5)
        const finalSample: Record<string, AuditEntry[]> = {};

        Object.keys(byCollaborator).forEach(collab => {
            const entries = byCollaborator[collab];

            // 1. Sort by Time Desc (Top 5)
            const sortedByTime = [...entries].sort((a, b) => b.time - a.time);
            const top5 = sortedByTime.slice(0, 5).map(e => ({ ...e, isTop5: true }));

            // 2. Random 5 (from the rest) - Deterministic
            const rest = sortedByTime.slice(5);

            // Deterministic shuffle based on month + collaborator name
            // This ensures the SAME "random" items are selected every time for this month
            let seed = 0;
            const seedStr = selectedMonth + collab;
            for (let i = 0; i < seedStr.length; i++) seed += seedStr.charCodeAt(i);

            const seededRandom = () => {
                const x = Math.sin(seed++) * 10000;
                return x - Math.floor(x);
            };

            // Fisher-Yates shuffle with seeded random
            const shuffledRest = [...rest];
            for (let i = shuffledRest.length - 1; i > 0; i--) {
                const j = Math.floor(seededRandom() * (i + 1));
                [shuffledRest[i], shuffledRest[j]] = [shuffledRest[j], shuffledRest[i]];
            }

            const random5 = shuffledRest.slice(0, 5);

            finalSample[collab] = [...top5, ...random5];
        });

        return finalSample;

    }, [selectedManager, selectedMonth]);

    // View State - must be declared before useMemos that use them
    const [currentCollaborator, setCurrentCollaborator] = useState<string | null>(null);
    const [reviews, setReviews] = useState<AuditState>({});
    const [isLoadingReviews, setIsLoadingReviews] = useState(true);
    const [viewMode, setViewMode] = useState<'sample' | 'all'>('sample');
    // Save/Load Status
    const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error' | 'idle'>('idle');

    // Reset save status when changing collaborator
    useEffect(() => {
        setSaveStatus('idle');
    }, [currentCollaborator]);

    // Load reviews from localStorage when manager changes
    const loadedKeyRef = useRef<string>('');

    useEffect(() => {
        const key = `${selectedManager?.name}-${selectedMonth}`;

        // Only load if manager/month changed and we haven't loaded for this combo yet
        if (selectedManager && selectedMonth && loadedKeyRef.current !== key) {
            setIsLoadingReviews(true); // Ensure loading is true before start
            const storedReviews = loadReviewsFromStorage(selectedManager.name, selectedMonth);
            setReviews(storedReviews);
            loadedKeyRef.current = key;

            // Safety delay to prevent save-before-load race condition
            setTimeout(() => {
                setIsLoadingReviews(false);
            }, 300);
        }
    }, [selectedManager, selectedMonth]);

    // Save reviews to localStorage whenever they change
    useEffect(() => {
        // Only save if NOT loading and we have a valid session
        if (selectedManager && selectedMonth && !isLoadingReviews) {
            setSaveStatus('saving');
            try {
                saveReviewsToStorage(selectedManager.name, selectedMonth, reviews);
                setTimeout(() => setSaveStatus('saved'), 800);
            } catch (e) {
                console.error("Failed to save", e);
                setSaveStatus('error');
            }
        }
    }, [reviews, selectedManager, selectedMonth, isLoadingReviews]);
    const [searchFilter, setSearchFilter] = useState<string>('');
    const [sortBy, setSortBy] = useState<'time' | 'client' | 'activity'>('time');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
    const [selectedEntryForDetails, setSelectedEntryForDetails] = useState<AuditEntry | null>(null);

    // All entries for the current collaborator (unsampled)
    const allEntriesForCollaborator = useMemo(() => {
        if (!selectedManager || !selectedMonth || !currentCollaborator) return [];

        const monthData = data.months?.find((m: { id: string }) => m.id === selectedMonth);
        if (!monthData) return [];

        const targetNucleos = Array.isArray(selectedManager.nucleo)
            ? selectedManager.nucleo
            : [selectedManager.nucleo];

        // Get all entries for this collaborator
        const entries: AuditEntry[] = [];

        monthData.rawEntries.forEach((raw: RawEntry) => {
            if (targetNucleos.includes(raw.n) && raw.p === currentCollaborator) {
                entries.push({
                    id: generateEntryId(raw, selectedMonth), // Same persistent ID
                    collaborator: raw.p,
                    client: raw.c,
                    project: raw.n,
                    activity: raw.e,
                    description: raw.d || '',
                    time: raw.t,
                    date: raw.dt, // Data do lançamento com hora
                    transferredAt: raw.te, // Transferido em
                    pj: raw.pj, // Número do processo
                    isTop5: false
                });
            }
        });

        return entries;
    }, [selectedManager, selectedMonth, currentCollaborator]);

    // Filtered and sorted entries for full table view
    const filteredEntries = useMemo(() => {
        let result = [...allEntriesForCollaborator];

        // Apply search filter
        if (searchFilter) {
            const lower = searchFilter.toLowerCase();
            result = result.filter(e =>
                e.client.toLowerCase().includes(lower) ||
                e.activity.toLowerCase().includes(lower) ||
                e.description.toLowerCase().includes(lower)
            );
        }

        // Apply sort
        result.sort((a, b) => {
            let cmp = 0;
            if (sortBy === 'time') cmp = a.time - b.time;
            else if (sortBy === 'client') cmp = a.client.localeCompare(b.client);
            else if (sortBy === 'activity') cmp = a.activity.localeCompare(b.activity);
            return sortDir === 'desc' ? -cmp : cmp;
        });

        return result;
    }, [allEntriesForCollaborator, searchFilter, sortBy, sortDir]);

    // Collaborator stats for manager dashboard
    const collaboratorStats = useMemo(() => {
        if (!selectedManager || !selectedMonth || !currentCollaborator) return null;

        const monthData = data.months?.find((m: { id: string }) => m.id === selectedMonth);
        if (!monthData) return null;

        // Get aggregated person data
        const personData = monthData.byPerson?.[currentCollaborator];
        if (!personData) return null;

        const available = personData.available || 0;
        const logged = personData.logged || 0;
        const utilization = available > 0 ? Math.round((logged / available) * 100) : 0;
        const stockHours = (available - logged) / 60; // Convert to hours

        // Calculate Top 3 Clients and Activities from rawEntries
        const clientTotals: Record<string, number> = {};
        const activityTotals: Record<string, number> = {};

        allEntriesForCollaborator.forEach(entry => {
            clientTotals[entry.client] = (clientTotals[entry.client] || 0) + entry.time;
            activityTotals[entry.activity] = (activityTotals[entry.activity] || 0) + entry.time;
        });

        const topClients = Object.entries(clientTotals)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([name, time]) => ({ name, time }));

        const topActivities = Object.entries(activityTotals)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([name, time]) => ({ name, time }));

        return {
            available,
            logged,
            utilization,
            stockHours,
            topClients,
            topActivities,
            entries: personData.entries || 0
        };
    }, [selectedManager, selectedMonth, currentCollaborator, allEntriesForCollaborator]);

    const handleApprove = (id: string) => {
        setReviews(prev => ({
            ...prev,
            [id]: { approved: true }
        }));
    };

    const handleReject = (id: string, rejectionReason: RejectionReason, correctedTime: number | undefined, comment: string) => {
        setReviews(prev => ({
            ...prev,
            [id]: { approved: false, rejectionReason, correctedTime, comment }
        }));
    };

    // Google Sheets Integration
    const GOOGLE_SHEETS_URL = 'https://script.google.com/macros/s/AKfycbzvUDOfy5o9dKXRnxDAY2kHrbJr8G7sl-8_15rmXUhU1vo-TNz1jmG6Nh4goE7RXjQe/exec';
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitSuccess, setSubmitSuccess] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);

    // Reset success state when changing collaborator
    useEffect(() => {
        setSubmitSuccess(false);
        setSubmitError(null);
    }, [currentCollaborator]);

    // Calculate review counts for current collaborator
    const currentCollabSampleSize = auditData?.[currentCollaborator || '']?.length || 0;
    const currentCollabReviewedCount = auditData?.[currentCollaborator || '']?.filter(entry => reviews[entry.id])?.length || 0;
    const allReviewed = currentCollabReviewedCount === currentCollabSampleSize && currentCollabSampleSize > 0;

    const handleSubmitReviews = async () => {
        if (!auditData || !selectedManager || !currentCollaborator) return;

        // Get all reviewed entries
        const reviewedEntries = auditData[currentCollaborator]?.filter(entry => reviews[entry.id]) || [];
        const totalEntries = auditData[currentCollaborator]?.length || 0;

        // Validate all entries are reviewed
        if (reviewedEntries.length < totalEntries) {
            setSubmitError(`Revise todos os ${totalEntries} lançamentos antes de finalizar. Faltam ${totalEntries - reviewedEntries.length}.`);
            return;
        }

        // Filter only REJECTED entries for Google Sheets
        const rejectedEntries = reviewedEntries.filter(entry => {
            const review = reviews[entry.id];
            return review && !review.approved;
        });

        setIsSubmitting(true);
        setSubmitError(null);

        // Only send to Google Sheets if there are rejected entries
        if (rejectedEntries.length > 0) {
            // Build payload with only rejected items
            const payload = {
                managerName: selectedManager.name,
                nucleo: Array.isArray(selectedManager.nucleo) ? selectedManager.nucleo.join(', ') : selectedManager.nucleo,
                month: selectedMonth,
                reviews: rejectedEntries.map(entry => {
                    const review = reviews[entry.id];
                    return {
                        collaborator: entry.collaborator,
                        date: entry.date,
                        client: entry.client,
                        project: entry.project,
                        activity: entry.activity,
                        description: entry.description,
                        originalTime: entry.time,
                        approved: false, // Always false since we filter rejected
                        rejectionReason: review.rejectionReason,
                        correctedTime: review.correctedTime,
                        comment: review.comment
                    };
                })
            };

            try {
                await fetch(GOOGLE_SHEETS_URL, {
                    method: 'POST',
                    mode: 'no-cors', // Required for Google Apps Script
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
            } catch (error) {
                setSubmitError('Erro ao enviar retificações. Tente novamente.');
                console.error('Submit error:', error);
                setIsSubmitting(false);
                return;
            }
        }

        // Mark as success (reviews are saved locally via useEffect)
        setSubmitSuccess(true);
        setSubmitError(null);
        setIsSubmitting(false);
    };

    // --- Render ---

    // Initial Selection Screen
    if (!selectedManager) {
        return (
            <div className="min-h-screen bg-slate-900 text-slate-100 p-8 flex flex-col items-center justify-center">
                <div className="max-w-md w-full bg-slate-800 rounded-3xl p-8 border border-white/5 shadow-2xl">
                    <div className="flex items-center gap-3 mb-6 justify-center text-brand-secondary">
                        <ShieldCheck className="w-10 h-10" />
                        <h1 className="text-2xl font-bold text-white">Portal de Auditoria</h1>
                    </div>

                    <p className="text-slate-400 text-center mb-8">
                        Selecione seu perfil para iniciar a revisão de qualidade dos lançamentos (Fidelidade do Dado).
                    </p>

                    <label className="block text-sm font-medium text-slate-300 mb-2">Quem é você?</label>
                    <select
                        className="w-full bg-slate-900 border border-white/10 rounded-xl p-4 text-white focus:ring-2 focus:ring-brand-primary outline-none"
                        onChange={(e) => {
                            const mgr = MANAGERS.find((m: ManagerConfig) => m.name === e.target.value);
                            if (mgr) setSelectedManager(mgr);
                        }}
                        defaultValue=""
                    >
                        <option value="" disabled>Selecione um gestor...</option>
                        {MANAGERS.map((m: ManagerConfig) => (
                            <option key={m.name} value={m.name}>{m.name}</option>
                        ))}
                    </select>

                    <div className="mt-8 flex justify-center">
                        <button
                            onClick={() => navigate('/')}
                            className="bg-slate-700 hover:bg-slate-600 text-white px-6 py-3 rounded-xl text-sm font-medium flex items-center gap-2 transition-all w-full justify-center"
                        >
                            <ArrowLeft className="w-4 h-4" /> Voltar para Home
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Main Audit Interface
    return (
        <div className="min-h-screen bg-slate-900 text-slate-100 p-6 md:p-12">
            {/* Header */}
            <div className="max-w-7xl mx-auto flex items-center justify-between mb-10">
                <div className="flex items-center gap-4">
                    <button onClick={() => setSelectedManager(null)} className="p-2 bg-white/5 rounded-full hover:bg-white/10 transition-colors">
                        <ArrowLeft className="w-6 h-6 text-slate-300" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                            <UserCheck className="w-6 h-6 text-brand-secondary" />
                            Auditoria: {selectedManager.name}
                        </h1>
                        <p className="text-slate-400 text-sm">
                            Núcleo: {Array.isArray(selectedManager.nucleo) ? selectedManager.nucleo.join(', ') : selectedManager.nucleo}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    {/* Save Status Indicator */}
                    {saveStatus !== 'idle' && (
                        <div className={`text-xs font-mono transition-colors flex items-center gap-1.5 ${saveStatus === 'saving' ? 'text-amber-400' :
                            saveStatus === 'error' ? 'text-red-400' :
                                'text-slate-500'
                            }`}>
                            {saveStatus === 'saving' && <span className="animate-pulse">💾 Salvando...</span>}
                            {saveStatus === 'error' && <span>❌ Erro ao salvar</span>}
                            {saveStatus === 'saved' && <span>✅ Salvo</span>}
                        </div>
                    )}

                    <span className="bg-brand-secondary/10 text-brand-secondary border border-brand-secondary/20 px-4 py-2 rounded-lg font-bold">
                        📅 Revisão: {data.months?.find(m => m.id === selectedMonth)?.name || 'Mês Atual'}
                    </span>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-8">

                {/* Left: Collaborator List */}
                <div className="lg:col-span-1 space-y-4">
                    <h2 className="text-sm font-bold text-brand-secondary uppercase tracking-wider mb-4">Colaboradores</h2>
                    <div className="space-y-2">
                        {auditData && Object.keys(auditData).map(collab => {
                            const entries = auditData[collab];
                            const reviewedCount = entries.filter(e => reviews[e.id]).length;
                            const totalCount = entries.length;
                            const isDone = reviewedCount === totalCount;

                            return (
                                <button
                                    key={collab}
                                    onClick={() => setCurrentCollaborator(collab)}
                                    className={`w-full text-left p-4 rounded-xl border transition-all flex items-center justify-between group ${currentCollaborator === collab
                                        ? 'bg-brand-primary text-white border-brand-primary'
                                        : 'bg-slate-800 text-slate-300 border-white/5 hover:border-white/20'
                                        }`}
                                >
                                    <div>
                                        <div className="font-bold text-sm truncate max-w-[180px]">{collab}</div>
                                        <div className="text-xs opacity-70 mt-1">{reviewedCount}/{totalCount} Revisados</div>
                                    </div>
                                    {isDone && <CheckCircle className="w-5 h-5 text-green-400" />}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Right: Review Cards */}
                <div className="lg:col-span-3">
                    {!currentCollaborator ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-500 min-h-[400px] border-2 border-dashed border-white/5 rounded-3xl">
                            <UserCheck className="w-16 h-16 mb-4 opacity-20" />
                            <p>Selecione um colaborador à esquerda para começar.</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* Tabs */}
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex bg-slate-800 rounded-xl p-1 border border-white/5">
                                    <button
                                        onClick={() => setViewMode('sample')}
                                        className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${viewMode === 'sample'
                                            ? 'bg-brand-primary text-white'
                                            : 'text-slate-400 hover:text-white'
                                            }`}
                                    >
                                        <UserCheck className="w-4 h-4 inline mr-2" />
                                        Amostragem ({auditData?.[currentCollaborator]?.length || 0})
                                    </button>
                                    <button
                                        onClick={() => setViewMode('all')}
                                        className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${viewMode === 'all'
                                            ? 'bg-brand-primary text-white'
                                            : 'text-slate-400 hover:text-white'
                                            }`}
                                    >
                                        <Table2 className="w-4 h-4 inline mr-2" />
                                        Todos ({allEntriesForCollaborator.length})
                                    </button>
                                </div>
                                <h2 className="text-xl font-bold text-white">
                                    <span className="text-brand-secondary">{currentCollaborator}</span>
                                </h2>
                            </div>

                            {/* Collaborator Quick Stats + Link to Full Journey */}
                            {collaboratorStats && (
                                <div className="bg-slate-800/50 rounded-2xl border border-white/5 p-5 mb-6">
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                                        {/* Tempo Disponível */}
                                        <div className="bg-slate-900/50 rounded-xl p-3 text-center">
                                            <div className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Disponível</div>
                                            <div className="text-lg font-bold text-white">{(collaboratorStats.available / 60).toFixed(0)}h</div>
                                        </div>
                                        {/* Tempo Lançado */}
                                        <div className="bg-slate-900/50 rounded-xl p-3 text-center">
                                            <div className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Lançado</div>
                                            <div className="text-lg font-bold text-brand-secondary">{(collaboratorStats.logged / 60).toFixed(0)}h</div>
                                        </div>
                                        {/* Aproveitamento */}
                                        <div className={`bg-slate-900/50 rounded-xl p-3 text-center ${collaboratorStats.utilization >= 85 ? 'ring-1 ring-green-500/30' :
                                            collaboratorStats.utilization >= 70 ? 'ring-1 ring-amber-500/30' : 'ring-1 ring-red-500/30'
                                            }`}>
                                            <div className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Aproveitamento</div>
                                            <div className={`text-lg font-bold ${collaboratorStats.utilization >= 85 ? 'text-green-400' :
                                                collaboratorStats.utilization >= 70 ? 'text-amber-400' : 'text-red-400'
                                                }`}>{collaboratorStats.utilization}%</div>
                                        </div>
                                        {/* Estoque de Horas */}
                                        <div className="bg-slate-900/50 rounded-xl p-3 text-center">
                                            <div className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Estoque</div>
                                            <div className={`text-lg font-bold ${collaboratorStats.stockHours > 0 ? 'text-amber-400' : 'text-green-400'}`}>
                                                {collaboratorStats.stockHours > 0 ? '+' : ''}{collaboratorStats.stockHours.toFixed(1)}h
                                            </div>
                                        </div>
                                    </div>

                                    {/* Top 3 Clientes e Atividades */}
                                    <div className="grid grid-cols-2 gap-4 mb-4">
                                        {/* Top 3 Clientes */}
                                        <div className="bg-slate-900/50 rounded-xl p-3">
                                            <div className="text-[10px] text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                                                <span className="w-1.5 h-1.5 rounded-full bg-brand-primary"></span>
                                                Top 3 Clientes
                                            </div>
                                            <div className="space-y-1.5">
                                                {collaboratorStats.topClients.map((client, idx) => (
                                                    <div key={idx} className="flex items-center justify-between text-xs">
                                                        <span className="text-white truncate max-w-[70%]" title={client.name}>
                                                            {idx + 1}. {client.name}
                                                        </span>
                                                        <span className="text-brand-secondary font-mono font-bold">{(client.time / 60).toFixed(1)}h</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                        {/* Top 3 Atividades */}
                                        <div className="bg-slate-900/50 rounded-xl p-3">
                                            <div className="text-[10px] text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                                                <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                                                Top 3 Atividades
                                            </div>
                                            <div className="space-y-1.5">
                                                {collaboratorStats.topActivities.map((activity, idx) => (
                                                    <div key={idx} className="flex items-center justify-between text-xs">
                                                        <span className="text-white truncate max-w-[70%]" title={activity.name}>
                                                            {idx + 1}. {activity.name}
                                                        </span>
                                                        <span className="text-amber-400 font-mono font-bold">{(activity.time / 60).toFixed(1)}h</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Link to Full Journey */}
                                    <button
                                        onClick={() => navigate(`/colaborador?colaborador=${encodeURIComponent(currentCollaborator)}&mes=${encodeURIComponent(selectedMonth)}`)}
                                        className="w-full bg-brand-primary/10 hover:bg-brand-primary/20 text-brand-secondary border border-brand-primary/20 rounded-xl py-3 px-4 text-sm font-medium transition-all flex items-center justify-center gap-2"
                                    >
                                        📊 Ver Jornada Completa de {currentCollaborator.split(' ')[0]} em {data.months?.find(m => m.id === selectedMonth)?.name || 'Mês Atual'}
                                    </button>
                                </div>
                            )}

                            {/* Sample View (Cards) */}
                            {viewMode === 'sample' && (
                                <>
                                    <span className="text-xs bg-slate-700 px-3 py-1 rounded-full text-slate-300 inline-block mb-4">
                                        Amostra Inteligente: Top 5 + Aleatórios
                                    </span>
                                    {auditData && auditData[currentCollaborator]?.map(entry => (
                                        <AuditCard
                                            key={entry.id}
                                            entry={entry}
                                            review={reviews[entry.id]}
                                            onApprove={() => handleApprove(entry.id)}
                                            onReject={(reason, correctedTime, comment) => handleReject(entry.id, reason, correctedTime, comment)}
                                        />
                                    ))}
                                </>
                            )}

                            {/* Full Table View */}
                            {viewMode === 'all' && (
                                <div className="space-y-4">
                                    {/* Search & Filter Bar */}
                                    <div className="flex gap-4 items-center">
                                        <div className="flex-1 relative">
                                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                            <input
                                                type="text"
                                                placeholder="Buscar por cliente, atividade ou descrição..."
                                                value={searchFilter}
                                                onChange={e => setSearchFilter(e.target.value)}
                                                className="w-full bg-slate-800 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:border-brand-primary outline-none"
                                            />
                                        </div>
                                        <select
                                            value={sortBy}
                                            onChange={e => setSortBy(e.target.value as 'time' | 'client' | 'activity')}
                                            className="bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                                            aria-label="Ordenar por"
                                        >
                                            <option value="time">Tempo</option>
                                            <option value="client">Cliente</option>
                                            <option value="activity">Atividade</option>
                                        </select>
                                        <button
                                            onClick={() => setSortDir(sortDir === 'asc' ? 'desc' : 'asc')}
                                            className="bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white hover:bg-slate-700"
                                        >
                                            {sortDir === 'desc' ? '↓ Maior' : '↑ Menor'}
                                        </button>
                                    </div>

                                    {/* Table */}
                                    <div className="bg-slate-800 rounded-2xl border border-white/5 overflow-hidden">
                                        <table className="w-full text-sm">
                                            <thead className="bg-slate-900/50 text-slate-400 text-left">
                                                <tr>
                                                    <th className="px-4 py-3 font-medium">Cliente</th>
                                                    <th className="px-4 py-3 font-medium">Atividade</th>
                                                    <th className="px-4 py-3 font-medium hidden md:table-cell">Descrição</th>
                                                    <th className="px-4 py-3 font-medium text-right">Tempo</th>
                                                    <th className="px-4 py-3 font-medium text-center">Ação</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-white/5">
                                                {filteredEntries.slice(0, 50).map(entry => {
                                                    const review = reviews[entry.id];
                                                    return (
                                                        <tr
                                                            key={entry.id}
                                                            onClick={() => setSelectedEntryForDetails(entry)}
                                                            className={`hover:bg-slate-700/30 transition-colors cursor-pointer ${review
                                                                ? review.approved
                                                                    ? 'bg-green-500/5'
                                                                    : 'bg-red-500/5'
                                                                : ''
                                                                }`}
                                                        >
                                                            <td className="px-4 py-3 text-white">{entry.client}</td>
                                                            <td className="px-4 py-3 text-slate-300">{entry.activity}</td>
                                                            <td className="px-4 py-3 text-slate-400 text-xs hidden md:table-cell max-w-[200px] truncate" title={entry.description}>
                                                                {entry.description}
                                                            </td>
                                                            <td className="px-4 py-3 text-right font-mono text-brand-secondary font-bold">
                                                                {entry.time}min
                                                                {review?.correctedTime !== undefined && (
                                                                    <span className="block text-amber-400 text-xs">→ {review.correctedTime}min</span>
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-3 text-center">
                                                                {review ? (
                                                                    review.approved ? (
                                                                        <CheckCircle className="w-5 h-5 text-green-400 inline" />
                                                                    ) : (
                                                                        <XCircle className="w-5 h-5 text-red-400 inline" />
                                                                    )
                                                                ) : (
                                                                    <div className="flex items-center justify-center gap-2">
                                                                        <button
                                                                            onClick={() => handleApprove(entry.id)}
                                                                            className="p-1 rounded bg-green-500/10 text-green-400 hover:bg-green-500 hover:text-white transition-all"
                                                                            title="Aprovar"
                                                                        >
                                                                            <CheckCircle className="w-4 h-4" />
                                                                        </button>
                                                                        <button
                                                                            onClick={() => handleReject(entry.id, 'other', undefined, '')}
                                                                            className="p-1 rounded bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-all"
                                                                            title="Retificar"
                                                                        >
                                                                            <XCircle className="w-4 h-4" />
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                        {filteredEntries.length > 50 && (
                                            <div className="px-4 py-3 text-center text-slate-400 text-sm bg-slate-900/50">
                                                Mostrando 50 de {filteredEntries.length} lançamentos. Use o filtro para refinar.
                                            </div>
                                        )}
                                        {filteredEntries.length === 0 && (
                                            <div className="px-4 py-8 text-center text-slate-500">
                                                Nenhum lançamento encontrado.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Detail Popup for 'Todos' tab entries */}
                            {selectedEntryForDetails && (
                                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSelectedEntryForDetails(null)}>
                                    <div className="bg-slate-800 rounded-3xl border border-white/10 shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                                        {/* Header */}
                                        <div className="flex items-center justify-between p-6 border-b border-white/5">
                                            <div className="flex items-center gap-3">
                                                <Eye className="w-6 h-6 text-brand-secondary" />
                                                <h3 className="text-xl font-bold text-white">Detalhes do Lançamento</h3>
                                            </div>
                                            <button onClick={() => setSelectedEntryForDetails(null)} className="p-2 rounded-full hover:bg-white/5 text-slate-400 hover:text-white transition-colors" aria-label="Fechar detalhes">
                                                <X className="w-5 h-5" />
                                            </button>
                                        </div>

                                        {/* Content */}
                                        <div className="p-6 space-y-4">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="bg-slate-900/50 rounded-xl p-4">
                                                    <label className="text-xs text-slate-500 uppercase tracking-wide">Colaborador</label>
                                                    <p className="text-white font-bold mt-1">{selectedEntryForDetails.collaborator}</p>
                                                </div>
                                                <div className="bg-slate-900/50 rounded-xl p-4">
                                                    <label className="text-xs text-slate-500 uppercase tracking-wide">Cliente</label>
                                                    <p className="text-white font-bold mt-1">{selectedEntryForDetails.client}</p>
                                                </div>
                                                <div className="bg-slate-900/50 rounded-xl p-4">
                                                    <label className="text-xs text-slate-500 uppercase tracking-wide">Núcleo/Projeto</label>
                                                    <p className="text-white font-bold mt-1">{selectedEntryForDetails.project}</p>
                                                </div>
                                                <div className="bg-slate-900/50 rounded-xl p-4">
                                                    <label className="text-xs text-slate-500 uppercase tracking-wide">Tempo Lançado</label>
                                                    <p className="text-brand-secondary font-bold text-lg mt-1">{selectedEntryForDetails.time} minutos</p>
                                                    <p className="text-slate-500 text-xs">{(selectedEntryForDetails.time / 60).toFixed(1)} horas</p>
                                                </div>
                                            </div>

                                            <div className="bg-slate-900/50 rounded-xl p-4">
                                                <label className="text-xs text-slate-500 uppercase tracking-wide">Tipo de Atividade</label>
                                                <p className="text-white font-bold mt-1">{selectedEntryForDetails.activity}</p>
                                            </div>

                                            <div className="bg-slate-900/50 rounded-xl p-4">
                                                <label className="text-xs text-slate-500 uppercase tracking-wide">Descrição Completa</label>
                                                <p className="text-slate-300 mt-1 text-sm leading-relaxed">{selectedEntryForDetails.description || 'Sem descrição'}</p>
                                            </div>

                                            <div className="bg-slate-900/50 rounded-xl p-4">
                                                <label className="text-xs text-slate-500 uppercase tracking-wide">Lançamento Para</label>
                                                <p className="text-white font-bold mt-1">{selectedEntryForDetails.date || '-'}</p>
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <div className="p-6 border-t border-white/5 flex gap-3">
                                            <button
                                                onClick={() => { handleReject(selectedEntryForDetails.id, 'other', undefined, ''); setSelectedEntryForDetails(null); }}
                                                className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl py-3 text-sm font-medium transition-all flex items-center justify-center gap-2"
                                            >
                                                <XCircle className="w-4 h-4" /> Retificar
                                            </button>
                                            <button
                                                onClick={() => { handleApprove(selectedEntryForDetails.id); setSelectedEntryForDetails(null); }}
                                                className="flex-1 bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/20 rounded-xl py-3 text-sm font-medium transition-all flex items-center justify-center gap-2"
                                            >
                                                <CheckCircle className="w-4 h-4" /> Aprovar
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Submit Review Button */}
                            {viewMode === 'sample' && (
                                <div className="mt-8 pt-6 border-t border-white/10">
                                    {submitError && (
                                        <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl mb-4 text-sm">
                                            {submitError}
                                        </div>
                                    )}

                                    {submitSuccess ? (
                                        <div className="bg-green-500/10 border border-green-500/30 text-green-400 px-6 py-4 rounded-xl text-center">
                                            <CheckCircle className="w-8 h-8 mx-auto mb-2" />
                                            <p className="font-bold">Revisão enviada com sucesso!</p>
                                            <p className="text-sm opacity-80 mt-1">Os dados foram salvos na planilha de controle.</p>
                                            <button
                                                onClick={() => {
                                                    const collaborators = Object.keys(auditData || {});
                                                    const currentIndex = collaborators.indexOf(currentCollaborator || '');
                                                    const nextCollaborator = collaborators[currentIndex + 1];

                                                    if (nextCollaborator) {
                                                        setCurrentCollaborator(nextCollaborator);
                                                    } else {
                                                        // Fallback or finish
                                                        setCurrentCollaborator(collaborators[0]);
                                                    }

                                                    setSubmitSuccess(false);
                                                    // Do NOT reset reviews here, as it clears ALL reviews for ALL collaborators
                                                    // setReviews({}); 
                                                }}
                                                className="mt-4 bg-green-500/20 hover:bg-green-500/30 px-6 py-2 rounded-lg text-sm font-medium transition-all"
                                            >
                                                Próximo Colaborador →
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-between">
                                            <div className="text-slate-400 text-sm">
                                                <span className="text-white font-bold">{currentCollabReviewedCount}</span> de{' '}
                                                <span className="text-white">{currentCollabSampleSize}</span> lançamentos revisados
                                            </div>
                                            <button
                                                onClick={handleSubmitReviews}
                                                disabled={isSubmitting || !allReviewed}
                                                className={`px-6 py-3 rounded-xl font-bold text-white flex items-center gap-2 transition-all ${isSubmitting
                                                    ? 'bg-slate-600 cursor-wait'
                                                    : !allReviewed
                                                        ? 'bg-slate-700 cursor-not-allowed opacity-50'
                                                        : 'bg-green-600 hover:bg-green-500 shadow-lg shadow-green-600/30'
                                                    }`}
                                            >
                                                {isSubmitting ? (
                                                    <>
                                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                                        Enviando...
                                                    </>
                                                ) : (
                                                    <>
                                                        <CheckCircle className="w-5 h-5" />
                                                        Finalizar Revisão de {currentCollaborator?.split(' ')[0]}
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// Sub-component for individual card review
interface AuditCardProps {
    entry: AuditEntry;
    review?: ReviewAction;
    onApprove: () => void;
    onReject: (reason: RejectionReason, correctedTime: number | undefined, comment: string) => void;
}

const REJECTION_REASONS: { value: RejectionReason; label: string }[] = [
    { value: 'wrong_time', label: '⏱️ Tempo Incorreto' },
    { value: 'wrong_client', label: '🏢 Cliente Errado' },
    { value: 'wrong_project', label: '📁 Projeto Incorreto' },
    { value: 'wrong_activity', label: '📋 Atividade Errada' },
    { value: 'bad_description', label: '📝 Descrição Ruim' },
    { value: 'other', label: '❓ Outro' },
];

function AuditCard({ entry, review, onApprove, onReject }: AuditCardProps) {
    const [isRejecting, setIsRejecting] = useState(false);
    const [showDetails, setShowDetails] = useState(false);
    const [selectedReason, setSelectedReason] = useState<RejectionReason>('wrong_time');
    const [correctedTime, setCorrectedTime] = useState<string>('');
    const [comment, setComment] = useState('');

    const handleRejectConfirm = () => {
        const correctedTimeNum = selectedReason === 'wrong_time' && correctedTime
            ? parseInt(correctedTime, 10)
            : undefined;
        onReject(selectedReason, correctedTimeNum, comment);
        setIsRejecting(false);
        // Reset form
        setSelectedReason('wrong_time');
        setCorrectedTime('');
        setComment('');
    };

    // Badge JSX based on entry type (using variable instead of component to avoid render issues)
    const entryBadge = entry.isTop5 ? (
        <span className="text-[10px] font-bold bg-amber-500/10 text-amber-400 px-2 py-1 rounded border border-amber-500/20 uppercase tracking-wide">
            📊 Maior Lançamento
        </span>
    ) : (
        <span className="text-[10px] font-bold bg-purple-500/10 text-purple-400 px-2 py-1 rounded border border-purple-500/20 uppercase tracking-wide">
            🎲 Aleatório
        </span>
    );

    // Detail Popup Modal (using variable instead of component)
    const detailPopup = showDetails && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowDetails(false)}>
            <div className="bg-slate-800 rounded-3xl border border-white/10 shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-white/5">
                    <div className="flex items-center gap-3">
                        <Eye className="w-6 h-6 text-brand-secondary" />
                        <h3 className="text-xl font-bold text-white">Detalhes do Lançamento</h3>
                    </div>
                    <button onClick={() => setShowDetails(false)} className="p-2 rounded-full hover:bg-white/5 text-slate-400 hover:text-white transition-colors" aria-label="Fechar detalhes">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-4">
                    <div className="flex gap-2 mb-4">
                        {entryBadge}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-slate-900/50 rounded-xl p-4">
                            <label className="text-xs text-slate-500 uppercase tracking-wide">Colaborador</label>
                            <p className="text-white font-bold mt-1">{entry.collaborator}</p>
                        </div>
                        <div className="bg-slate-900/50 rounded-xl p-4">
                            <label className="text-xs text-slate-500 uppercase tracking-wide">Cliente</label>
                            <p className="text-white font-bold mt-1">{entry.client}</p>
                        </div>
                        <div className="bg-slate-900/50 rounded-xl p-4">
                            <label className="text-xs text-slate-500 uppercase tracking-wide">Núcleo/Projeto</label>
                            <p className="text-white font-bold mt-1">{entry.project}</p>
                        </div>
                        <div className="bg-slate-900/50 rounded-xl p-4">
                            <label className="text-xs text-slate-500 uppercase tracking-wide">Nº do Processo (PJ)</label>
                            <p className="text-white font-bold mt-1">{entry.pj || 'Sem PJ identificada'}</p>
                        </div>
                        <div className="bg-slate-900/50 rounded-xl p-4">
                            <label className="text-xs text-slate-500 uppercase tracking-wide">Tempo Lançado</label>
                            <p className="text-brand-secondary font-bold text-lg mt-1">{entry.time} minutos</p>
                            <p className="text-slate-500 text-xs">{(entry.time / 60).toFixed(1)} horas</p>
                        </div>
                    </div>

                    <div className="bg-slate-900/50 rounded-xl p-4">
                        <label className="text-xs text-slate-500 uppercase tracking-wide">Tipo de Atividade</label>
                        <p className="text-white font-bold mt-1">{entry.activity}</p>
                    </div>

                    <div className="bg-slate-900/50 rounded-xl p-4">
                        <label className="text-xs text-slate-500 uppercase tracking-wide">Descrição Completa</label>
                        <p className="text-slate-200 mt-1 leading-relaxed">{entry.description || '(Sem descrição)'}</p>
                    </div>

                    {entry.date && (
                        <div className="bg-slate-900/50 rounded-xl p-4">
                            <label className="text-xs text-slate-500 uppercase tracking-wide">Lançamento para</label>
                            <p className="text-white font-bold mt-1">{entry.date}</p>
                        </div>
                    )}

                    {entry.transferredAt && (
                        <div className="bg-slate-900/50 rounded-xl p-4">
                            <label className="text-xs text-slate-500 uppercase tracking-wide">Transferido em</label>
                            <p className="text-white font-bold mt-1">{entry.transferredAt}</p>
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="p-6 border-t border-white/5 flex justify-end gap-4">
                    <button
                        onClick={() => { setShowDetails(false); setIsRejecting(true); }}
                        className="px-6 py-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-all font-bold"
                    >
                        <XCircle className="w-4 h-4 inline mr-2" />
                        Retificar
                    </button>
                    <button
                        onClick={() => { setShowDetails(false); onApprove(); }}
                        className="px-6 py-2 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500 hover:text-white transition-all font-bold"
                    >
                        <CheckCircle className="w-4 h-4 inline mr-2" />
                        Aprovar
                    </button>
                </div>
            </div>
        </div>
    );

    // Already Reviewed State
    if (review) {
        const reasonLabel = REJECTION_REASONS.find(r => r.value === review.rejectionReason)?.label || '';

        return (
            <div className={`p-6 rounded-2xl border mb-4 ${review.approved
                ? 'bg-green-500/5 border-green-500/20'
                : 'bg-red-500/5 border-red-500/20'
                }`}>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                            {entryBadge}
                            <h3 className="font-bold text-white">{entry.activity}</h3>
                            <span className="text-slate-400 text-sm">• {entry.client}</span>
                        </div>
                        <p className="text-sm text-slate-300 mb-2 italic">"{entry.description}"</p>
                        <div className="text-xs font-mono text-slate-500">
                            {entry.time} min • {entry.project}
                        </div>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                        {review.approved ? (
                            <div className="flex items-center gap-2 text-green-400 font-bold bg-green-500/10 px-4 py-2 rounded-lg">
                                <CheckCircle className="w-5 h-5" /> Aprovado
                            </div>
                        ) : (
                            <>
                                <div className="flex items-center gap-2 text-red-400 font-bold bg-red-500/10 px-4 py-2 rounded-lg">
                                    <XCircle className="w-5 h-5" /> Retificado
                                </div>
                                <div className="text-xs text-red-300 text-right">
                                    {reasonLabel}
                                    {review.correctedTime !== undefined && (
                                        <span className="block font-bold text-amber-400">
                                            De: {entry.time}min → Para: {review.correctedTime}min
                                        </span>
                                    )}
                                    {review.comment && <span className="block text-slate-400 mt-1">"{review.comment}"</span>}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // Rejection Modal
    if (isRejecting) {
        return (
            <div className="bg-slate-800 p-6 rounded-2xl border border-red-500/30 shadow-lg shadow-red-900/10 animate-in fade-in slide-in-from-bottom-2">
                <h3 className="text-red-400 font-bold mb-4 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5" /> Retificar Lançamento
                </h3>

                <div className="grid md:grid-cols-2 gap-4 mb-4">
                    {/* Dropdown de Motivo */}
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Motivo da Retificação *</label>
                        <select
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:border-red-500 outline-none"
                            value={selectedReason}
                            onChange={e => setSelectedReason(e.target.value as RejectionReason)}
                            aria-label="Motivo da retificação"
                        >
                            {REJECTION_REASONS.map(r => (
                                <option key={r.value} value={r.value}>{r.label}</option>
                            ))}
                        </select>
                    </div>

                    {/* Campo de Tempo Correto (Condicional) */}
                    {selectedReason === 'wrong_time' && (
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                Tempo Correto (min) *
                            </label>
                            <div className="flex items-center gap-3">
                                <span className="text-slate-500 text-sm">Atual: {entry.time}min →</span>
                                <input
                                    type="number"
                                    min="0"
                                    className="flex-1 bg-slate-900 border border-amber-500/50 rounded-lg p-3 text-amber-400 font-bold focus:border-amber-500 outline-none"
                                    placeholder="novo tempo"
                                    value={correctedTime}
                                    onChange={e => setCorrectedTime(e.target.value)}
                                />
                            </div>
                        </div>
                    )}
                </div>

                <div className="mb-4">
                    <label className="block text-sm font-medium text-slate-300 mb-2">Observação (opcional)</label>
                    <textarea
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm text-white focus:border-red-500 outline-none"
                        placeholder="Adicione detalhes sobre a correção..."
                        rows={2}
                        value={comment}
                        onChange={e => setComment(e.target.value)}
                    />
                </div>

                <div className="flex justify-end gap-3">
                    <button
                        onClick={() => setIsRejecting(false)}
                        className="text-slate-400 hover:text-white px-4 py-2 text-sm"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleRejectConfirm}
                        disabled={selectedReason === 'wrong_time' && !correctedTime}
                        className="bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded-lg text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Confirmar Retificação
                    </button>
                </div>
            </div>
        );
    }

    // Default Card State
    return (
        <>
            {detailPopup}
            <div className="bg-slate-800 p-6 rounded-2xl border border-white/5 hover:border-white/10 transition-all flex flex-col md:flex-row md:items-center justify-between gap-6 group">
                {/* Clickable Content Area */}
                <div className="flex-1 cursor-pointer" onClick={() => setShowDetails(true)}>
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                        {entryBadge}
                        <h3 className="font-bold text-lg text-white group-hover:text-brand-secondary transition-colors">
                            {entry.activity}
                        </h3>
                        <button
                            className="p-1 rounded-full bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                            title="Ver detalhes completos"
                        >
                            <Eye className="w-4 h-4" />
                        </button>
                    </div>

                    <p className="text-slate-300 mb-3 leading-relaxed line-clamp-2">
                        "{entry.description}"
                    </p>

                    <div className="flex items-center gap-4 text-xs text-slate-500 font-mono flex-wrap">
                        <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-brand-primary"></span>
                            {entry.client}
                        </span>
                        <span>|</span>
                        <span className="text-brand-secondary font-bold">{entry.time} min</span>
                        <span>|</span>
                        <span>{entry.project}</span>
                        <span>|</span>
                        <span className="text-amber-400">PJ: {entry.pj || 'Sem PJ identificada'}</span>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => setIsRejecting(true)}
                        className="p-3 rounded-full bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-all border border-transparent hover:border-red-400"
                        title="Retificar (Necessita Correção)"
                    >
                        <XCircle className="w-6 h-6" />
                    </button>
                    <button
                        onClick={onApprove}
                        className="p-3 rounded-full bg-green-500/10 text-green-400 hover:bg-green-500 hover:text-white transition-all border border-transparent hover:border-green-400"
                        title="Aprovar"
                    >
                        <CheckCircle className="w-6 h-6" />
                    </button>
                </div>
            </div>
        </>
    );
}
