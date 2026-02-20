/**
 * Limpa o nome da atividade removendo padrões comuns indesejados.
 * Ex: "Nova Atividade - " -> "Nova Atividade"
 */
export const cleanTaskName = (taskName: string): string => {
    if (!taskName) return '';
    return taskName.replace(/^[0-9]+\.\s*/, '').trim();
};
