// Centralized type definitions for the Timesheet Dashboard

// --- Raw Data Types (from JSON) ---

export interface RawEntry {
    p: string;      // person (collaborator name)
    n: string;      // nucleo
    c: string;      // client
    e: string;      // evento (activity)
    t: number;      // time in minutes
    d?: string;     // description
    l?: number;     // lag (days)
    pj?: string;    // número do processo
    dt?: string;    // formatted datetime (lançamento para)
    te?: string;    // formatted datetime (transferido em)
}

export interface PersonData {
    name: string;
    available: number;
    logged: number;
    entries: number;
    fragments?: number;
    fragmentTime?: number;
    totalLag?: number;
    lagCount?: number;
}

export interface NucleoData {
    name: string;
    logged: number;
}

export interface ClientData {
    name: string;
    logged: number;
    faturavel?: boolean;
}

export interface MonthData {
    id: string;
    name: string;
    totalAvailable: number;
    totalLogged: number;
    byPerson: Record<string, PersonData>;
    byNucleo: Record<string, NucleoData>;
    byClient: Record<string, ClientData>;
    rawEntries: RawEntry[];
}

export interface DashboardData {
    months: MonthData[];
}

// --- UI Component Types ---

export interface StatsCardProps {
    title: string;
    value: string | number;
    subtitle?: string;
    icon?: React.ReactNode;
    trend?: {
        value: number;
        isPositive: boolean;
    };
    className?: string;
}

export interface MonthSelectorProps {
    months: MonthData[];
    selectedMonth: string;
    onChange: (monthId: string) => void;
    className?: string;
}

// --- Audit Types ---

export interface AuditEntry {
    id: string;
    collaborator: string;
    client: string;
    project: string;
    activity: string;
    description: string;
    time: number;
    date?: string;
    transferredAt?: string;
    pj?: string;
    isTop5: boolean;
}

export type RejectionReason =
    | 'wrong_time'
    | 'wrong_client'
    | 'wrong_project'
    | 'wrong_activity'
    | 'bad_description'
    | 'other';

export interface ReviewAction {
    approved: boolean;
    rejectionReason?: RejectionReason;
    correctedTime?: number;
    comment?: string;
}

export type AuditState = Record<string, ReviewAction>;
