import { Link } from 'react-router-dom';
import { Home } from 'lucide-react';

interface BackButtonProps {
    to?: string;
    className?: string;
}

/**
 * Reusable back button component that links to Home by default
 */
export function BackButton({ to = '/', className = '' }: BackButtonProps) {
    return (
        <Link
            to={to}
            className={`p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors ${className}`}
        >
            <Home className="w-5 h-5" />
        </Link>
    );
}

export default BackButton;
