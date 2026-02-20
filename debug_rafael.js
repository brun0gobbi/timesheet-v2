import fs from 'fs';

const data = JSON.parse(fs.readFileSync('./src/data/data.json', 'utf8'));
const july = data.months.find(m => m.name.toLowerCase().includes('julho'));

const targetName = "Rafael Leonardo Borg";
const entries = july.rawEntries.filter(e => e.p === targetName);

const byClient = {};
const byActivity = {};

entries.forEach(e => {
    // Client
    byClient[e.c] = (byClient[e.c] || 0) + e.t;
    // Activity
    byActivity[e.e] = (byActivity[e.e] || 0) + e.t;
});

console.log('--- Por Cliente (Rafael / Julho) ---');
Object.entries(byClient)
    .sort((a, b) => b[1] - a[1])
    .forEach(([name, min]) => {
        console.log(`${name}: ${min} min (${(min / 60).toFixed(1)}h) [Faturável: ${july.byClient[name]?.faturavel}]`);
    });

console.log('\n--- Por Atividade (Rafael / Julho) ---');
Object.entries(byActivity)
    .sort((a, b) => b[1] - a[1])
    .forEach(([name, min]) => {
        console.log(`${name}: ${min} min (${(min / 60).toFixed(1)}h)`);
    });
