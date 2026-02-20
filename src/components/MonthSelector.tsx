import type { MonthData } from '../types';

interface MonthSelectorProps {
    months: MonthData[];
    selectedMonth: string;
    onChange: (monthId: string) => void;
    className?: string;
    label?: string;
}

/**
 * Reusable month selector dropdown component
 */
export function MonthSelector({
    months,
    selectedMonth,
    onChange,
    className = '',
    label = 'Mês'
}: MonthSelectorProps) {
    return (
        <div className={className}>
            {label && (
                <label className="block text-sm font-medium text-slate-300 mb-2">
                    {label}
                </label>
            )}
            <select
                value={selectedMonth}
                onChange={(e) => onChange(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:border-brand-primary outline-none"
                aria-label={label || 'Selecionar mês'}
            >
                {months.map(month => (
                    <option key={month.id} value={month.id}>
                        {month.name}
                    </option>
                ))}
            </select>
        </div>
    );
}

export default MonthSelector;
