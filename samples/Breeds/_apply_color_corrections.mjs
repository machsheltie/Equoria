// Canonical color-genetics CORRECTION pass (runs after generation).
// Applies per-breed allele corrections (remove colors a breed should not
// carry) and derives any missing shade groups for the colors a breed CAN
// still produce — so allowed_alleles and shade_bias are mutually consistent
// by construction. Idempotent. Preserves the exact SQL name/wrapper.
// Run: node _apply_color_corrections.mjs
import { readFileSync, writeFileSync, readdirSync } from 'fs';
const DIR = 'C:/Users/heirr/OneDrive/Desktop/Equoria/samples/Breeds';

// --- per-breed allele REMOVALS (keyed by filename without .txt) ----------
// Decision basis = breed-identity / equine genetics (see QA review):
//  - LP breeds: gray erases the appaloosa pattern -> remove Gray.
//  - Arabian/Oriental + Thoroughbred: lack classic roan -> remove Roan.
//  - golden-Don / sport warmbloods: roan not a breed trait -> remove Roan.
//  - Iberian breeds carry Pearl, not Champagne -> remove Champagne.
//  - Carthusian PRE is gray-dominant, cream not characteristic -> remove Cream.
const NEG_RESET = {
  G_Gray: { 'g/g': 1.0 },
  Rn_Roan: { 'rn/rn': 1.0 },
  Cr_Cream: { 'n/n': 1.0 },
  Ch_Champagne: { 'n/n': 1.0 },
};
const REMOVALS = {
  'Nez Perce': ['G_Gray', 'Rn_Roan'],
  'Pryor Mountain Mustang': ['G_Gray'],
  'Tiger Horse': ['G_Gray'],
  Walkaloosa: ['G_Gray'],
  'Tori horse': ['G_Gray'],
  'Santa Cruz Island': ['G_Gray'],
  Thoroughbred: ['Rn_Roan'],
  'Purosangue Orientale': ['Rn_Roan'],
  'Russian Don': ['Rn_Roan'],
  'Rhinelander horse': ['Rn_Roan'],
  'Romanian Sport Horse': ['Rn_Roan'],
  Cartujano: ['Cr_Cream'],
  Andalusian: ['Ch_Champagne'],
  'Irish Sport (Hunter)': ['Ch_Champagne'],
};

// --- shade group definitions (incl. NEW champagne vocabulary) ------------
const SH = {
  Palomino: { pale: 0.3, golden: 0.4, copper: 0.3 },
  Buckskin: { cream: 0.3, golden: 0.4, burnished: 0.3 },
  'Smoky Black': { faded: 0.5, 'rich chocolate': 0.5 },
  Cremello: { ice: 0.5, peachy: 0.5 },
  Perlino: { cream: 0.5, peachy: 0.5 },
  'Smoky Cream': { 'light cream': 0.5, 'dark cream': 0.5 },
  Grulla: { 'silver gray': 0.3, standard: 0.4, burnished: 0.3 },
  'Red Dun': { strawberry: 0.4, medium: 0.3, 'dark red': 0.3 },
  'Bay Dun': { light: 0.3, standard: 0.4, dark: 0.3 },
  'Silver Bay': { light: 0.3, 'brushed bronze': 0.4, burnished: 0.3 },
  'Silver Black': { steel: 0.5, 'rich black': 0.5 },
  'Red Roan': { rose: 0.5, cherry: 0.3, rust: 0.2 },
  'Blue Roan': { steel: 0.4, 'cool gray': 0.4, charcoal: 0.2 },
  'Strawberry Roan': { pinkish: 0.4, amber: 0.4, wine: 0.2 },
  'Steel Gray': { steel: 1.0 },
  'Rose Gray': { rose: 1.0 },
  'Steel Dark Dapple Gray': { 'steel dapple': 1.0 },
  'Rose Dark Dapple Gray': { 'rose dapple': 1.0 },
  'Steel Light Dapple Gray': { 'light steel dapple': 1.0 },
  'Rose Light Dapple Gray': { 'light rose dapple': 1.0 },
  'White Gray': { 'white gray': 1.0 },
  'Fleabitten Gray': { fleabitten: 1.0 },
  'Fewspot Leopard': { porcelain: 0.6, frosted: 0.4 },
  Snowcap: { cream: 0.4, porcelain: 0.4, ivory: 0.2 },
  Leopard: { 'light spotted': 0.4, freckled: 0.4, 'bold spotted': 0.2 },
  Blanket: { 'light blanket': 0.4, 'mottled blanket': 0.4, 'spotted blanket': 0.2 },
  'Varnish Roan': { 'roan wash': 0.4, peppered: 0.4, faded: 0.2 },
  'Light Snowflake Leopard': { 'light snowflake': 1.0 },
  'Moderate Snowflake Leopard': { 'moderate snowflake': 1.0 },
  'Heavy Snowflake Leopard': { 'heavy snowflake': 1.0 },
  'Light Frost Roan Varnish': { 'light frost': 1.0 },
  'Moderate Frost Roan Varnish': { 'moderate frost': 1.0 },
  'Heavy Frost Roan Varnish': { 'heavy frost': 1.0 },
  'Dominant White': { white: 1.0 },
  // NEW project-wide champagne vocabulary:
  'Gold Champagne': { pale: 0.3, golden: 0.4, rich: 0.3 },
  'Amber Champagne': { light: 0.3, standard: 0.4, dark: 0.3 },
  'Classic Champagne': { light: 0.3, standard: 0.4, dark: 0.3 },
};
const GRAY = [
  'Steel Gray',
  'Rose Gray',
  'Steel Dark Dapple Gray',
  'Rose Dark Dapple Gray',
  'Steel Light Dapple Gray',
  'Rose Light Dapple Gray',
  'White Gray',
  'Fleabitten Gray',
];
const ROAN = ['Red Roan', 'Blue Roan', 'Strawberry Roan'];
const DUN = ['Grulla', 'Red Dun', 'Bay Dun'];
const APPY = [
  'Fewspot Leopard',
  'Snowcap',
  'Leopard',
  'Blanket',
  'Varnish Roan',
  'Light Snowflake Leopard',
  'Moderate Snowflake Leopard',
  'Heavy Snowflake Leopard',
  'Light Frost Roan Varnish',
  'Moderate Frost Roan Varnish',
  'Heavy Frost Roan Varnish',
];

const keysHave = (w, frag) => Object.keys(w || {}).some((k) => k.includes(frag));

function derivedShadeNames(alleleWeights) {
  const add = new Set();
  const cr = alleleWeights.Cr_Cream || {};
  if (keysHave(cr, 'Cr')) {
    ['Palomino', 'Buckskin', 'Smoky Black'].forEach((s) => add.add(s));
    if (keysHave(cr, 'Cr/Cr')) ['Cremello', 'Perlino', 'Smoky Cream'].forEach((s) => add.add(s));
  }
  if (keysHave(alleleWeights.D_Dun || {}, 'D/')) DUN.forEach((s) => add.add(s));
  if (keysHave(alleleWeights.Z_Silver || {}, 'Z'))
    ['Silver Bay', 'Silver Black'].forEach((s) => add.add(s));
  if (keysHave(alleleWeights.G_Gray || {}, 'G')) GRAY.forEach((s) => add.add(s));
  if (keysHave(alleleWeights.Rn_Roan || {}, 'Rn')) ROAN.forEach((s) => add.add(s));
  if (keysHave(alleleWeights.LP_LeopardComplex || {}, 'LP')) APPY.forEach((s) => add.add(s));
  if (keysHave(alleleWeights.Ch_Champagne || {}, 'Ch'))
    ['Gold Champagne', 'Amber Champagne', 'Classic Champagne'].forEach((s) => add.add(s));
  if (Object.keys(alleleWeights.W_DominantWhite || {}).some((k) => k !== 'w/w'))
    add.add('Dominant White');
  return add;
}

let changed = 0;
const log = [];
for (const f of readdirSync(DIR)
  .filter((x) => x.endsWith('.txt') && !x.startsWith('_') && x !== 'generichorse.txt')
  .sort()) {
  const name = f.replace(/\.txt$/, '');
  const raw = readFileSync(`${DIR}/${f}`, 'utf8');
  const i = raw.indexOf('$json$');
  const k = raw.indexOf('$json$', i + 6);
  if (i < 0 || k < 0) {
    log.push(`SKIP(no json) ${f}`);
    continue;
  }
  const prefix = raw.slice(0, i + 6),
    suffix = raw.slice(k),
    json = raw.slice(i + 6, k);
  const j = JSON.parse(json);
  const note = [];

  // 1. allele removals
  for (const gene of REMOVALS[name] || []) {
    if (
      j.allele_weights?.[gene] &&
      !(
        Object.keys(j.allele_weights[gene]).length === 1 &&
        j.allele_weights[gene][Object.keys(NEG_RESET[gene])[0]]
      )
    ) {
      j.allowed_alleles[gene] = Object.keys(NEG_RESET[gene]);
      j.allele_weights[gene] = { ...NEG_RESET[gene] };
      note.push(`-${gene}`);
    }
  }

  // 2. derive + add missing shades for remaining producible colors
  const want = derivedShadeNames(j.allele_weights || {});
  const have = new Set(Object.keys(j.shade_bias || {}));
  for (const s of want) {
    if (!have.has(s)) {
      if (!SH[s]) {
        note.push(`!!missing-SH:${s}`);
        continue;
      }
      j.shade_bias[s] = SH[s];
      note.push(`+shade:${s}`);
    }
  }
  // 3. remove now-orphan shades (color no longer producible after a removal)
  const producible = derivedShadeNames(j.allele_weights || {});
  const GROUP_OF = {};
  for (const s of GRAY) GROUP_OF[s] = () => keysHave(j.allele_weights.G_Gray, 'G');
  for (const s of ROAN) GROUP_OF[s] = () => keysHave(j.allele_weights.Rn_Roan, 'Rn');
  for (const s of ['Palomino', 'Buckskin', 'Smoky Black', 'Cremello', 'Perlino', 'Smoky Cream'])
    GROUP_OF[s] = () => keysHave(j.allele_weights.Cr_Cream, 'Cr');
  for (const s of ['Gold Champagne', 'Amber Champagne', 'Classic Champagne'])
    GROUP_OF[s] = () => keysHave(j.allele_weights.Ch_Champagne, 'Ch');
  for (const s of Object.keys(j.shade_bias || {})) {
    if (GROUP_OF[s] && !GROUP_OF[s]()) {
      delete j.shade_bias[s];
      note.push(`-shade:${s}`);
    }
  }
  void producible;

  if (note.length) {
    const out = prefix + JSON.stringify(j, null, 2) + suffix;
    writeFileSync(`${DIR}/${f}`, out, 'utf8');
    changed++;
    log.push(`CHANGED ${f}: ${note.join(' ')}`);
  }
}
console.log(log.join('\n'));
console.log(`\n=== corrections applied to ${changed} files ===`);
