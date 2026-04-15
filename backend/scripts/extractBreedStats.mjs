import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(__dirname, '../../docs/BreedData');
const stats10 = [
  'speed',
  'stamina',
  'agility',
  'balance',
  'precision',
  'intelligence',
  'boldness',
  'flexibility',
  'obedience',
  'focus',
  'endurance',
  'strength',
];
const result = {};

const files = fs.readdirSync(dir).filter(f => f.endsWith('.txt') && f !== 'generichorse.txt');
for (const f of files) {
  const name = f.replace('.txt', '');
  const content = fs.readFileSync(path.join(dir, f), 'utf-8');
  if (!content.includes('starter_stats')) {
    continue;
  }

  const breedStats = {};
  for (const stat of stats10) {
    const re = new RegExp(
      `"${stat}"\\s*:\\s*\\{\\s*"mean"\\s*:\\s*(\\d+)\\s*,\\s*"std_dev"\\s*:\\s*(\\d+)`,
    );
    const m = content.match(re);
    if (m) {
      breedStats[stat] = { mean: parseInt(m[1]), std: parseInt(m[2]) };
    }
  }
  if (Object.keys(breedStats).length > 0) {
    result[name] = breedStats;
  }
}

const outPath = path.join(__dirname, '../data/breedStarterStats.json');
fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
console.log(`Wrote ${Object.keys(result).length} breeds to ${outPath}`);
