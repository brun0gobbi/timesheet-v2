export interface ManagerConfig {
    name: string;
    nucleo: string | string[]; // Pode ser um núcleo ou lista de núcleos
}

export const MANAGERS: ManagerConfig[] = [
    {
        name: "Bruno Gobbi",
        nucleo: "Administrativo"
    },
    {
        name: "Rafael Leonardo Borg",
        nucleo: ["Seguros", "Consultivo Securitário"]
    },
    {
        name: "Rafael Vieira Vianna Santos",
        nucleo: "Contencioso"
    },
    {
        name: "Maria Eduarda Kormann",
        nucleo: "Contratos"
    },
    {
        name: "Caroline Hoffmann",
        nucleo: "Controladoria"
    }
];
