import type { ReactNode } from 'react';

interface StatsCardProps {
    title: string;
    value: string | number;
    subtitle?: string;
    icon?: ReactNode;
    trend?: {
        value: number;
        isPositive: boolean;
        invertColors?: boolean; // For metrics where decrease is good (e.g., lag, fragmentation)
    };
    className?: string;
    valueClassName?: string;
}

/**
 * Reusable stats card component for displaying metrics
 */
export function StatsCard({
    title,
    value,
    subtitle,
    icon,
    trend,
    className = '',
    valueClassName = 'text-white'
}: StatsCardProps) {
    const getTrendColor = () => {
        if (!trend) return '';
        const isGood = trend.invertColors ? !trend.isPositive : trend.isPositive;
        return isGood ? 'text-green-400' : 'text-red-400';
    };

    const getTrendIcon = () => {
        if (!trend) return '';
        return trend.isPositive ? '↑' : '↓';
    };

    return (
        <div className={`bg-slate-800/50 rounded-2xl p-6 border border-white/5 ${className}`}>
            <div className="flex items-center gap-2 mb-2">
                {icon && <span className="text-slate-400">{icon}</span>}
                <h3 className="text-sm text-slate-400 uppercase tracking-wide">{title}</h3>
            </div>
            <p className={`text-2xl font-bold ${valueClassName}`}>{value}</p>
            {subtitle && (
                <p className="text-sm text-slate-500 mt-1">{subtitle}</p>
            )}
            {trend && (
                <div className={`text-xs mt-2 pt-2 border-t border-white/10 ${getTrendColor()}`}>
                    {getTrendIcon()} {Math.abs(trend.value).toFixed(1)}%
                </div>
            )}
        </div>
    );
}

export default StatsCard;
