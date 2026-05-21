// Adversarial color-rule consistency auditor for ALL breed .txt files.
// Goes BEYOND _validate.mjs (which only checks weight sums / temperament /
// gaited flag). This encodes equine color-genetics SEMANTICS and tries hard
// to find biology inconsistencies. Run: node _audit_color_rules.mjs
import { readFileSync, readdirSync } from 'fs';
const DIR = 'C:/Users/heirr/OneDrive/Desktop/Equoria/samples/Breeds';
const files = readdirSync(DIR).filter(
  (f) => f.endsWith('.txt') && !f.startsWith('_') && f !== 'generichorse.txt'
);

const CANON_GAITS = new Set([
  'Rack',
  'Slow Gait',
  'Tölt',
  'Running Walk',
  'Flat Walk',
  'Paso Llano',
  'Sobreandando',
  'Fino',
  'Corto',
  'Largo',
  'Fox Trot',
  'Marcha Batida',
  'Marcha Picada',
  'Singlefoot',
  'Saddle Rack',
  'Amble',
  'Pace',
  'Stepping Pace',
  'Trocha',
  'Revaal',
  'Aphcal',
  'Rahvaan',
]);

// shade-group -> the gene + predicate that a non-negative allele exists
const CREAM = ['Palomino', 'Buckskin', 'Smoky Black', 'Cremello', 'Perlino', 'Smoky Cream'];
const DUNS = ['Grulla', 'Red Dun', 'Bay Dun'];
const SILVERS = ['Silver Bay', 'Silver Black'];
const GRAYS = [
  'Steel Gray',
  'Rose Gray',
  'Steel Dark Dapple Gray',
  'Rose Dark Dapple Gray',
  'Steel Light Dapple Gray',
  'Rose Light Dapple Gray',
  'White Gray',
  'Fleabitten Gray',
];
const ROANS = ['Red Roan', 'Blue Roan', 'Strawberry Roan'];
const APPYS = [
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
const DWHITE = ['Dominant White'];
const CHAMP = ['Gold Champagne', 'Amber Champagne', 'Classic Champagne'];

const has = (alleles, gene, pred) => (alleles[gene] || []).some(pred);
const creamAllele = (a) => has(a, 'Cr_Cream', (x) => x.includes('Cr'));
const dunAllele = (a) => has(a, 'D_Dun', (x) => x.includes('D/')); // D/nd1, D/nd2, D/D
const silverAllele = (a) => has(a, 'Z_Silver', (x) => x.includes('Z'));
const grayAllele = (a) => has(a, 'G_Gray', (x) => x.includes('G'));
const roanAllele = (a) => has(a, 'Rn_Roan', (x) => x.includes('Rn'));
const lpAllele = (a) => has(a, 'LP_LeopardComplex', (x) => x.includes('LP'));
const patnAllele = (a) => has(a, 'PATN1_Pattern1', (x) => x.includes('PATN1'));
const wAllele = (a) => has(a, 'W_DominantWhite', (x) => x !== 'w/w');
const champAllele = (a) => has(a, 'Ch_Champagne', (x) => x.includes('Ch'));
const pearlAllele = (a) => has(a, 'Prl_Pearl', (x) => x.includes('Prl'));

let errs = 0,
  warns = 0;
const report = [];
for (const f of files.sort()) {
  const t = readFileSync(`${DIR}/${f}`, 'utf8');
  const m = t.match(/\$json\$([\s\S]*?)\$json\$/);
  if (!m) {
    report.push(`[ERR] ${f}: no $json$`);
    errs++;
    continue;
  }
  let j;
  try {
    j = JSON.parse(m[1]);
  } catch (e) {
    report.push(`[ERR] ${f}: JSON ${e.message}`);
    errs++;
    continue;
  }
  const a = j.allowed_alleles || {};
  const sh = Object.keys(j.shade_bias || {});
  const shSet = new Set(sh);
  const adv = j.advanced_markings_bias || {};
  const E = [];

  // ---- HARD: shade present but no allele to produce it ----
  if (CREAM.some((s) => shSet.has(s)) && !creamAllele(a)) E.push('cream shade but NO Cr allele');
  if (DUNS.some((s) => shSet.has(s)) && !dunAllele(a)) E.push('dun shade but NO D-dun allele');
  if (SILVERS.some((s) => shSet.has(s)) && !silverAllele(a)) E.push('silver shade but NO Z allele');
  if (GRAYS.some((s) => shSet.has(s)) && !grayAllele(a)) E.push('gray shade but NO G allele');
  if (ROANS.some((s) => shSet.has(s)) && !roanAllele(a)) E.push('roan shade but NO Rn allele');
  if (APPYS.some((s) => shSet.has(s)) && !lpAllele(a)) E.push('appaloosa shade but NO LP allele');
  if (DWHITE.some((s) => shSet.has(s)) && !wAllele(a))
    E.push('Dominant White shade but NO W allele');
  if (CHAMP.some((s) => shSet.has(s)) && !champAllele(a))
    E.push('champagne shade but NO Ch allele');

  // ---- HARD: LP <-> snowflake/frost multiplier consistency ----
  const lp = lpAllele(a);
  const sf = adv.snowflake_probability_multiplier,
    fr = adv.frost_probability_multiplier;
  if (lp && (sf !== 1.0 || fr !== 1.0))
    E.push(`LP allele present but snowflake/frost mult = ${sf}/${fr} (expect 1.0/1.0)`);
  if (!lp && (sf === 1.0 || fr === 1.0))
    E.push(`no LP allele but snowflake/frost mult = ${sf}/${fr} (expect 0.0/0.0)`);
  // LP present should also carry PATN1 (leopard vs blanket patterning)
  if (lp && !patnAllele(a)) E.push('LP allele present but NO PATN1 allele (patterns cannot vary)');

  // ---- HARD: gaited registry names must be canonical ----
  const rp = j.rating_profiles || {};
  if (rp.is_gaited_breed === true) {
    const reg = rp.gaited_gait_registry || [];
    for (const g of reg) if (!CANON_GAITS.has(g)) E.push(`non-canonical gait name "${g}"`);
  }

  // ---- HARD: each shade sub-distribution must sum to ~1.0 ----
  for (const [name, dist] of Object.entries(j.shade_bias || {})) {
    const s = Object.values(dist).reduce((x, y) => x + y, 0);
    if (Math.abs(s - 1) > 0.001) E.push(`shade "${name}" sub-weights sum ${s.toFixed(3)} (≠1.0)`);
  }
  // ---- HARD: face marking distribution must sum to ~1.0 ----
  const face = (j.marking_bias || {}).face || {};
  const fsum = Object.values(face).reduce((x, y) => x + y, 0);
  if (Math.abs(fsum - 1) > 0.001) E.push(`face markings sum ${fsum.toFixed(3)} (≠1.0)`);

  // ---- SOFT (warn): allele present but no corresponding shade listed ----
  const W = [];
  if (creamAllele(a) && !CREAM.some((s) => shSet.has(s))) W.push('Cr allele but no cream shade');
  if (dunAllele(a) && !DUNS.some((s) => shSet.has(s))) W.push('dun allele but no dun shade');
  if (silverAllele(a) && !SILVERS.some((s) => shSet.has(s))) W.push('Z allele but no silver shade');
  if (grayAllele(a) && !GRAYS.some((s) => shSet.has(s))) W.push('G allele but no gray shade');
  if (roanAllele(a) && !ROANS.some((s) => shSet.has(s))) W.push('Rn allele but no roan shade');
  if (lpAllele(a) && !APPYS.some((s) => shSet.has(s))) W.push('LP allele but no appaloosa shade');
  if (wAllele(a) && !DWHITE.some((s) => shSet.has(s)))
    W.push('W allele but no Dominant White shade');
  if (champAllele(a) && !CHAMP.some((s) => shSet.has(s)))
    W.push('Ch allele but no champagne shade');
  if (pearlAllele(a) && !shSet.has('Sparse Mane/Tail'))
    W.push('Pearl allele present (verify pearl handling)');

  if (E.length) {
    report.push(`[ERR] ${f}: ${E.join('; ')}`);
    errs += E.length;
  }
  if (W.length) {
    report.push(`[warn] ${f}: ${W.join('; ')}`);
    warns += W.length;
  }
}
console.log(report.join('\n'));
console.log(
  `\n=== AUDIT: ${errs} hard errors, ${warns} warnings, across ${files.length} breeds ===`
);
