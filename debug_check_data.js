
import fs from 'fs';
const data = JSON.parse(fs.readFileSync('./src/data/data.json', 'utf-8'));
console.log('Months found:', data.months.map(m => m.id));
