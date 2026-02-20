
import React from 'react';
import { FileSearch, RefreshCw, XCircle } from 'lucide-react';

/**
 * Exibe um skeleton screen (animação de carregamento)
 * @param height Altura do container em pixels (padrão 300px)
 */
export const LoadingState: React.FC<{ height?: string }> = ({ height = "h-[300px]" }) => {
    return (
        <div className={`w-full ${height} bg-slate-50 rounded-3xl animate-pulse p-6 flex flex-col gap-4 border border-slate-100`}>
            <div className="h-6 w-1/3 bg-slate-200 rounded-md"></div>
            <div className="flex-1 w-full bg-slate-200 rounded-xl bg-opacity-50"></div>
        </div>
    );
};

/**
 * Exibe uma mensagem amigável quando não há dados
 */
export const EmptyState: React.FC<{ message?: string; onAction?: () => void; actionLabel?: string }> = ({
    message = "Nenhum dado encontrado com os filtros atuais.",
    onAction,
    actionLabel = "Limpar Filtros"
}) => {
    return (
        <div className="w-full h-[300px] flex flex-col items-center justify-center p-8 text-center bg-slate-50/50 rounded-3xl border border-dashed border-slate-200">
            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mb-4 shadow-sm">
                <FileSearch className="w-8 h-8 text-slate-300" />
            </div>
            <h3 className="text-slate-800 font-bold mb-2">Ops! Tudo vazio por aqui.</h3>
            <p className="text-slate-500 max-w-xs mb-6 text-sm">{message}</p>
            {onAction && (
                <button
                    onClick={onAction}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-full text-slate-600 text-sm font-semibold hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm"
                >
                    <RefreshCw className="w-4 h-4" />
                    {actionLabel}
                </button>
            )}
        </div>
    );
};

/**
 * Exibe uma mensagem de erro genérica
 */
export const ErrorState: React.FC<{ message?: string }> = ({ message = "Algo deu errado ao carregar este componente." }) => {
    return (
        <div className="w-full h-[200px] flex flex-col items-center justify-center p-6 text-center bg-red-50 rounded-3xl border border-red-100">
            <XCircle className="w-10 h-10 text-red-400 mb-3" />
            <p className="text-red-600 font-medium text-sm">{message}</p>
        </div>
    );
};
