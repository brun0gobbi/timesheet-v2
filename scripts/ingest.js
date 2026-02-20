
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { createRequire } from 'module';

// Workaround for xlsx (CommonJS) in ES Modules
const require = createRequire(import.meta.url);
const XLSX = require('xlsx');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_FILE = path.join(__dirname, '../src/data/data.json');
const UPLOADS_DIR = path.join(__dirname, '../src/data/uploads');


// Identificadores de Planilha (Keywords no nome do arquivo)
const KEYWORD_ANALYTIC = 'analitica';
const KEYWORD_MANAGERIAL = 'gerencial';

// Default Fallback
const DEFAULT_AVAILABLE_HOURS_MONTH = 168 * 60;

// Função para normalizar nomes (remove acentos, espaços duplos e lowercase)
function canonicalizeName(name) {
    if (!name) return '';
    return name
        .toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Remove acentos
        .replace(/\s+/g, ' ') // Remove espaços duplicados
        .trim();
}

function loadData() {
    if (fs.existsSync(DATA_FILE)) {
        return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    }
    return { months: [] };
}

function saveData(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`✅ Base de dados atualizada: ${DATA_FILE}`);
}

function processManagerial(filePath, monthStats) {
    console.log(`   📊 Processando Gerencial: ${path.basename(filePath)}`);
    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet);

    // Esperado: Colunas 'Nome' e 'Horas Disponíveis' (ou 'Meta')
    rows.forEach(row => {
        const name = row['Nome'] || row['Colaborador'];
        // Tenta pegar horas disponíveis (pode estar em horas ou minutos no excel, assumindo HORAS aqui e convertendo)
        // Mapeamento de colunas possíveis para meta de horas
        const availableHoursRaw = row['Tempo disponível'] || row['Horas Disponíveis'] || row['Meta'] || row['Available'] || 0;
        let availableHours = 0;

        // Parser robusto para formatos de texto
        if (typeof availableHoursRaw === 'string') {
            const val = availableHoursRaw.toLowerCase().trim();

            // Formato: "160h00min" ou "160h"
            if (val.includes('h')) {
                const parts = val.replace('min', '').split('h');
                const h = parseFloat(parts[0]) || 0;
                const m = parseFloat(parts[1]) || 0;
                availableHours = h + (m / 60);
            }
            // Formato: "160:00"
            else if (val.includes(':')) {
                const [h, m] = val.split(':').map(Number);
                availableHours = h + (m / 60);
            }
            // Formato numérico em string: "160"
            else {
                availableHours = parseFloat(val) || 0;
            }
        }
        // Formato Numérico direto (Excel number)
        else {
            availableHours = parseFloat(availableHoursRaw) || 0;
        }

        if (name && availableHours > 0) {
            // Tenta encontrar a pessoa usando nome canônico
            const canonName = canonicalizeName(name);

            // Procura chaves existentes que batam com o nome canônico
            let targetKey = Object.keys(monthStats.byPerson).find(k => canonicalizeName(k) === canonName);

            // Se não achar exato, tenta "contains" para casos como "Lugan Thierry" vs "Lugan Thierry Fernandes..."
            if (!targetKey) {
                targetKey = Object.keys(monthStats.byPerson).find(k => {
                    const kCanon = canonicalizeName(k);
                    // Match bidirecional e leniente
                    return kCanon.includes(canonName) || canonName.includes(kCanon);
                });
            }

            if (targetKey) {
                // Atualiza disponibilidade (em minutos)
                monthStats.byPerson[targetKey].available = Math.round(availableHours * 60);
                // console.log(`      ✅ Match Gerencial: ${name} -> ${targetKey} (${availableHours}h)`);
            } else {
                console.warn(`      ⚠️  SEM MATCH NO ANALÍTICO: ${name} (${canonName}) (Ignorado)`);
            }
        }
    });
}

function processAnalytic(filePath, monthStats) {
    console.log(`   📝 Processando Analítica: ${path.basename(filePath)}`);
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rawData = XLSX.utils.sheet_to_json(sheet);

    rawData.forEach(row => {
        // Mapeamento de colunas real do escritório:
        // Nome, Cliente, Núcleo, Descrição do evento, Tempo lançado, Descrição da atividade
        const p = row['Nome'] || row['Colaborador'] || row['Resource'];
        const c = row['Cliente'] || row['Customer'];
        const n = row['Núcleo'] || row['Nucleo'] || 'Geral';
        const e = row['Descrição do evento'] || row['Atividade'] || row['Task'] || '';
        const d = row['Descrição da atividade'] || row['Descrição'] || '';
        const t = parseFloat(row['Tempo lançado'] || row['Tempo (min)'] || row['Time'] || 0);
        // Data do lançamento (coluna G - "Lançamento para")
        const rawDate = row['Lançamento para'] || row['Data'] || row['Date'] || '';
        // Converter serial do Excel para DD/MM/AAAA
        let dt = '';
        if (rawDate) {
            if (typeof rawDate === 'number') {
                // Excel serial date: days since 1900-01-01 (with Excel's leap year bug adjustment)
                const excelEpoch = new Date(1899, 11, 30); // Excel epoch
                const dateObj = new Date(excelEpoch.getTime() + rawDate * 24 * 60 * 60 * 1000);
                const day = String(dateObj.getDate()).padStart(2, '0');
                const month = String(dateObj.getMonth() + 1).padStart(2, '0');
                const year = dateObj.getFullYear();
                dt = `${day}/${month}/${year}`;
            } else {
                dt = String(rawDate);
            }
        }
        // Lag: diferença entre Lançamento para e Transferido em (se houver)
        const lag = row['Lag'] || 0;

        if (!p || !c || !e) return;

        const entry = { p, n, c, e, t, d, l: lag, dt };
        monthStats.rawEntries.push(entry);

        // Agregação por Pessoa
        if (!monthStats.byPerson[p]) {
            monthStats.byPerson[p] = {
                name: p,
                available: DEFAULT_AVAILABLE_HOURS_MONTH, // Será sobrescrito pelo Gerencial se tiver
                logged: 0,
                entries: 0,
                fragments: 0,
                fragmentTime: 0,
                totalLag: 0,
                lagCount: 0
            };
        }

        const person = monthStats.byPerson[p];
        person.logged += t;
        person.entries += 1;
        person.totalLag += lag;
        person.lagCount += 1;

        if (t < 10) {
            person.fragments += 1;
            person.fragmentTime += t;
        }

        // Agregação por Núcleo
        if (!monthStats.byNucleo[n]) monthStats.byNucleo[n] = { name: n, logged: 0 };
        monthStats.byNucleo[n].logged += t;

        // Agregação por Cliente
        if (!monthStats.byClient[c]) monthStats.byClient[c] = { name: c, logged: 0, faturavel: true };
        monthStats.byClient[c].logged += t;
    });
}


function main() {
    console.log('🚀 Iniciando ingestão de dados...');

    if (!fs.existsSync(UPLOADS_DIR)) {
        fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }

    const files = fs.readdirSync(UPLOADS_DIR).filter(f => f.endsWith('.xlsx'));

    if (files.length === 0) {
        console.warn('⚠️  Nenhum arquivo .xlsx encontrado em src/data/uploads.');
        return;
    }

    const currentData = loadData();

    // Agrupar arquivos por mês (assumindo que o nome do mês está no arquivo)
    // Ex: "Dezembro_Analitica.xlsx" e "Dezembro_Gerencial.xlsx" -> Grupo "Dezembro"
    const monthsMap = new Map();

    files.forEach(file => {
        // Nome real esperado: "Analitico - Dezembro.xlsx" ou "Gerencial - Dezembro.xlsx"
        // Também aceita: "Dezembro_Analitica.xlsx"
        // Normaliza para lowercase e remove extensão
        const cleanName = file.toLowerCase().replace('.xlsx', '').trim();

        // Lista de Meses para detecção
        const monthsList = [
            'janeiro', 'fevereiro', 'março', 'marco', 'abril', 'maio', 'junho',
            'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
        ];

        // Tenta encontrar qual mês está no nome do arquivo
        let monthName = monthsList.find(m => cleanName.includes(m));

        // Se achou "marco" (sem cedilha), normaliza para Março
        if (monthName === 'marco') monthName = 'Março';

        // Se não achou mês no nome, tenta extrair via regex ou usa "Desconhecido"
        // Mas para simplificar, se não tiver mês, ignoramos ou avisamos
        if (!monthName) {
            console.warn(`⚠️  Arquivo ignorado (sem mês no nome): ${file}`);
            return;
        }

        // Capitalize o mês
        monthName = monthName.charAt(0).toUpperCase() + monthName.slice(1);

        // Garante que o grupo do mês existe
        if (!monthsMap.has(monthName)) {
            monthsMap.set(monthName, { analytic: null, managerial: null });
        }
        const grupo = monthsMap.get(monthName);

        // Detecção do TIPO (Analítico vs Gerencial) baseada em keywords
        const isManagerial = cleanName.includes('gerencial') || cleanName.includes('meta') || cleanName.includes('disponi') || cleanName.includes('managerial');
        const isAnalytic = cleanName.includes('analit') || cleanName.includes('banco') || cleanName.includes('export') || cleanName.includes('detalhado') || !isManagerial; // Default to analytic if ambiguous

        if (isManagerial) {
            if (grupo.managerial) console.warn(`⚠️  Múltiplos arquivos gerenciais para ${monthName}. Usando: ${file}`);
            grupo.managerial = file;
        } else {
            if (grupo.analytic) console.warn(`⚠️  Múltiplos arquivos analíticos para ${monthName}. Usando: ${file}`);
            grupo.analytic = file;
        }
    });

    console.log('Grupos identificados:', Array.from(monthsMap.keys()));

    monthsMap.forEach((files, monthName) => {
        console.log(`\nProcessando Mês: ${monthName}...`);

        // Verifica se já existe
        const existsIndex = currentData.months.findIndex(m => m.id.includes(monthName) || m.name.includes(monthName));

        // Estrutura Base
        let monthStats = {
            totalAvailable: 0,
            totalLogged: 0,
            byPerson: {},
            byNucleo: {},
            byClient: {},
            rawEntries: []
        };

        // 1. Processar Analítica (Cria a base de dados e pessoas)
        if (files.analytic) {
            processAnalytic(path.join(UPLOADS_DIR, files.analytic), monthStats);
        } else {
            console.warn(`❌ Planilha analítica não encontrada para ${monthName}. Pulando.`);
            return;
        }

        // 2. Processar Gerencial (Enriquece com meta de horas)
        if (files.managerial) {
            processManagerial(path.join(UPLOADS_DIR, files.managerial), monthStats);
        } else {
            console.warn(`⚠️ Planilha gerencial não encontrada para ${monthName}. Usando horas padrao.`);
        }

        // Totais Gerais Recalculados
        monthStats.totalLogged = Object.values(monthStats.byPerson).reduce((acc, curr) => acc + curr.logged, 0);
        monthStats.totalAvailable = Object.values(monthStats.byPerson).reduce((acc, curr) => acc + curr.available, 0);

        const newMonthEntry = {
            id: monthName, // Garantir ID unico depois
            name: monthName,
            ...monthStats
        };

        if (existsIndex >= 0) {
            console.log(`🔄 Atualizando mês existente no JSON: ${currentData.months[existsIndex].name}`);
            currentData.months[existsIndex] = newMonthEntry;
        } else {
            console.log(`➕ Inserindo novo mês no JSON: ${monthName}`);
            currentData.months.push(newMonthEntry);
        }
    });

    saveData(currentData);
    console.log('✨ Processo finalizado!');
}

main();
