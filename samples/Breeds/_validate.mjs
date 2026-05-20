import { readFileSync, readdirSync } from 'fs';
const dir = 'C:/Users/heirr/OneDrive/Desktop/Equoria/samples/Breeds';
const files = readdirSync(dir).filter((f) => f.endsWith('.txt'));
const DELIM = '$json$';
let pass = 0,
  fail = 0;
for (const f of files.sort()) {
  const t = readFileSync(`${dir}/${f}`, 'utf8');
  const a = t.indexOf(DELIM),
    b = t.indexOf(DELIM, a + DELIM.length);
  if (a < 0 || b < 0) {
    console.log(`BADWRAP   ${f}`);
    fail++;
    continue;
  }
  let j;
  try {
    j = JSON.parse(t.slice(a + DELIM.length, b));
  } catch (e) {
    console.log(`JSONERR   ${f}  ${e.message}`);
    fail++;
    continue;
  }
  const issues = [];
  const aw = j.allele_weights || {};
  for (const k in aw) {
    const s = Object.values(aw[k]).reduce((x, y) => x + y, 0);
    if (Math.abs(s - 1) > 0.0015) issues.push(`${k}=${s.toFixed(4)}`);
    // allowed_alleles keys must match allele_weights keys
    const allowed = (j.allowed_alleles || {})[k] || [];
    for (const ak of Object.keys(aw[k]))
      if (!allowed.includes(ak)) issues.push(`${k}:weight'${ak}'notInAllowed`);
  }
  const tw = Object.values(j.temperament_weights || {}).reduce((x, y) => x + y, 0);
  if (tw !== 100) issues.push(`temp=${tw}`);
  const rp = j.rating_profiles || {};
  const gaited = rp.is_gaited_breed;
  const g = rp.gaits && rp.gaits.gaiting;
  if (gaited === true && g == null) issues.push('gaited-but-gaiting-null');
  if (gaited === false && g != null) issues.push('not-gaited-but-gaiting-set');
  if (gaited === true && !Array.isArray(rp.gaited_gait_registry)) issues.push('gaited-no-registry');
  console.log(
    `${issues.length ? 'FAIL  ' : 'OK    '}${f.padEnd(30)} temp=${tw} gaited=${gaited}${issues.length ? '  >> ' + issues.join('; ') : ''}`
  );
  if (issues.length) {
    fail++;
  } else {
    pass++;
  }
}
console.log(`\n=== ${pass} OK / ${fail} FAIL / ${files.length} total ===`);
