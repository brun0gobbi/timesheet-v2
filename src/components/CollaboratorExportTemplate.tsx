import React from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import { Calendar, Clock, TrendingUp, Package, Zap, Building2, Activity } from 'lucide-react';

interface ExportKPIs {
    availableHours: number;
    totalHours: number;
    utilizacao: number;
    estoque: number;
    mainActivity: string;
}

interface ExportProps {
    collaboratorName: string;
    monthName: string;
    kpis: ExportKPIs;
    focusStats: {
        deepWorkPct: number;
        fragmentPct: number;
        pieData: { name: string; value: number; color: string }[];
    };
    topClients: { name: string; Horas: number }[];
    topActivities: { name: string; Horas: number }[];
}

// Fixed dimensions for A4 at 96 PPI: 794px width, 1123px height
export const CollaboratorExportTemplate: React.FC<ExportProps> = ({
    collaboratorName,
    monthName,
    kpis,
    focusStats,
    topClients,
    topActivities
}) => {
    return (
        <div
            id={`pdf-template-${collaboratorName.replace(/\s+/g, '-')}`}
            style={{
                width: '794px',
                height: '1123px',
                backgroundColor: '#ffffff',
                padding: '40px',
                boxSizing: 'border-box',
                fontFamily: "'Inter', 'Segoe UI', sans-serif",
                color: '#0f172a',
                display: 'flex',
                flexDirection: 'column'
            }}
        >
            {/* Header section */}
            <div style={{ paddingBottom: '20px', borderBottom: '2px solid #f1f5f9', marginBottom: '30px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <h1 style={{ fontSize: '28px', fontWeight: '800', margin: '0 0 4px 0', color: '#0f172a' }}>
                            Extrato Escolar <span style={{ color: '#0284c7' }}>Mensal</span>
                        </h1>
                        <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>
                            Relatório de Performance e Produtividade
                        </p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ backgroundColor: '#f0f9ff', color: '#0369a1', padding: '6px 12px', borderRadius: '8px', fontWeight: 'bold', fontSize: '14px', marginBottom: '8px', display: 'inline-block' }}>
                            {monthName}
                        </div>
                        <h2 style={{ fontSize: '20px', fontWeight: 'bold', margin: 0, color: '#334155' }}>
                            {collaboratorName}
                        </h2>
                    </div>
                </div>
            </div>

            {/* KPIs Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '30px' }}>
                <div style={{ backgroundColor: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        <Calendar size={14} color="#64748b" />
                        <span style={{ fontSize: '10px', textTransform: 'uppercase', color: '#64748b', fontWeight: 'bold' }}>Esperado</span>
                    </div>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#334155' }}>{kpis.availableHours}h</div>
                </div>
                <div style={{ backgroundColor: '#f0f9ff', padding: '16px', borderRadius: '12px', border: '1px solid #bae6fd' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        <Clock size={14} color="#0284c7" />
                        <span style={{ fontSize: '10px', textTransform: 'uppercase', color: '#0284c7', fontWeight: 'bold' }}>Realizado</span>
                    </div>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#0369a1' }}>{kpis.totalHours}h</div>
                </div>
                <div style={{ backgroundColor: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        <TrendingUp size={14} color="#64748b" />
                        <span style={{ fontSize: '10px', textTransform: 'uppercase', color: '#64748b', fontWeight: 'bold' }}>Utilização</span>
                    </div>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#334155' }}>{kpis.utilizacao}%</div>
                </div>
                <div style={{ backgroundColor: kpis.estoque >= 0 ? '#ecfdf5' : '#fef2f2', padding: '16px', borderRadius: '12px', border: `1px solid ${kpis.estoque >= 0 ? '#a7f3d0' : '#fecaca'}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        <Package size={14} color={kpis.estoque >= 0 ? '#059669' : '#dc2626'} />
                        <span style={{ fontSize: '10px', textTransform: 'uppercase', color: kpis.estoque >= 0 ? '#059669' : '#dc2626', fontWeight: 'bold' }}>Estoque</span>
                    </div>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: kpis.estoque >= 0 ? '#059669' : '#dc2626' }}>
                        {kpis.estoque >= 0 ? '+' : ''}{kpis.estoque}h
                    </div>
                </div>
            </div>

            {/* Focus & Top Activities Row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px', marginBottom: '30px' }}>
                <div style={{ backgroundColor: '#f8fafc', padding: '20px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                    <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#334155', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Zap size={16} color="#f59e0b" /> Índice de Foco
                    </h3>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                        <div>
                            <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#0369a1' }}>{focusStats.deepWorkPct}%</div>
                            <div style={{ fontSize: '10px', color: '#64748b' }}>Deep Work</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#94a3b8' }}>{focusStats.fragmentPct}%</div>
                            <div style={{ fontSize: '10px', color: '#64748b' }}>Fragmentado</div>
                        </div>
                    </div>
                    <div style={{ height: '140px', width: '100%' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={focusStats.pieData}
                                    cx="50%" cy="50%"
                                    innerRadius={40} outerRadius={60}
                                    startAngle={90} endAngle={-270}
                                    dataKey="value"
                                    stroke="none"
                                    isAnimationActive={false}
                                >
                                    {focusStats.pieData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div style={{ backgroundColor: '#f8fafc', padding: '20px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                    <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#334155', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Activity size={16} color="#10b981" /> Top Atividades (O que fez?)
                    </h3>
                    <div style={{ height: '200px', width: '100%' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={topActivities} layout="vertical" margin={{ top: 0, right: 30, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" width={160} tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                                <Bar dataKey="Horas" fill="#10b981" radius={[0, 4, 4, 0]} barSize={20} isAnimationActive={false} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Top Clients Row */}
            <div style={{ backgroundColor: '#f8fafc', padding: '20px', borderRadius: '16px', border: '1px solid #e2e8f0', flex: 1 }}>
                <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#334155', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Building2 size={16} color="#0ea5e9" /> Top Clientes (Para quem trabalhou?)
                </h3>
                <div style={{ height: '240px', width: '100%' }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={topClients.slice(0, 6)} layout="vertical" margin={{ top: 0, right: 30, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
                            <XAxis type="number" hide />
                            <YAxis
                                dataKey="name"
                                type="category"
                                width={180}
                                tick={{ fontSize: 10, fill: '#64748b' }}
                                tickFormatter={(val) => val.length > 25 ? val.substring(0, 25) + '...' : val}
                                axisLine={false}
                                tickLine={false}
                            />
                            <Bar dataKey="Horas" fill="#0369a1" radius={[0, 4, 4, 0]} barSize={20} isAnimationActive={false} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Footer */}
            <div style={{ borderTop: '1px solid #e2e8f0', marginTop: '24px', paddingTop: '16px', textAlign: 'center', color: '#94a3b8', fontSize: '10px' }}>
                Gerado pelo TimeSheet Analytics • Resumo Confidencial
            </div>
        </div>
    );
};
