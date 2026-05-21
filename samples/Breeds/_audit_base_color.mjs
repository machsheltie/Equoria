// Base-color frequency PLAUSIBILITY auditor. For breeds with a strong,
// well-documented base-color identity, verify the E/A/G/D allele weights
// actually realize that identity (e.g. a "black" breed shouldn't throw
// mostly chestnut; a "chestnut" breed shouldn't throw mostly bay).
// Computes realized base distribution and checks expected thresholds.
// Run: node _audit_base_color.mjs
import { readFileSync, readdirSync, existsSync } from 'fs';
const DIR = 'C:/Users/heirr/OneDrive/Desktop/Equoria/samples/Breeds';

// breed (filename w/o .txt) -> expected base identity
const EXPECT = {
  // chestnut-dominant / fixed (red base e/e should dominate)
  'Suffolk Punch': 'chestnut',
  Haflinger: 'chestnut',
  'Schleswig Coldblood': 'chestnut',
  Pleven: 'chestnut',
  'Sokolski horse': 'chestnut',
  'Russian Don': 'chestnut',
  'Russian Heavy Draft': 'chestnut',
  'Soviet Heavy Draft': 'chestnut',
  'Novoalexandrian Draft': 'chestnut',
  'South German Coldblood': 'chestnut',
  'Rhenish German Coldblood': 'chestnut',
  'Tori horse': 'chestnut',
  'Yonaguni horse': 'chestnut',
  'Samolaco horse': 'chestnut',
  Gidran: 'chestnut',
  'Black Forest Horse': 'chestnut',
  'Comtois horse': 'chestnut',
  // NOTE: Oberlander (~40% chestnut) and Priob (~40% dun) are PLURALITY breeds
  // per research, not >=50% single-base — intentionally NOT in this strict map.
  // black-dominant (a/a high, e/e low)
  Friesian: 'black',
  Vlaamperd: 'black',
  Nivernais: 'black',
  Nonius: 'black',
  Murgese: 'black',
  'Merens (Merens horse)': 'black',
  'Losino horse': 'black',
  'Mallorquín horse': 'black',
  'Menorquín horse': 'black',
  Sanfratellano: 'black',
  // gray-predominant (high gray)
  Lipizzan: 'gray',
  Lusitano: 'gray',
  Andalusian: 'gray',
  'Shagya Arabian': 'gray',
  'Tersk horse': 'gray',
  'Orlov Trotter': 'gray',
  Percheron: 'gray',
  Boulonnais: 'gray',
  Cartujano: 'gray',
  'Unmol Horse': 'gray',
  // dun-dominant / fixed (primitive)
  Sorraia: 'dun',
  'Fjord horse': 'dun',
  Konik: 'dun',
  'Kiger Mustang': 'dun',
  'Vyatka horse': 'dun',
  'Riwoche horse': 'dun',
};
const THRESH = { chestnut: 0.5, black: 0.5, gray: 0.4, dun: 0.5 };

const sumKeys = (w, frag) =>
  Object.entries(w || {}).reduce((s, [k, v]) => (k.includes(frag) ? s + v : s), 0);

let issues = 0,
  ok = 0,
  missing = 0;
for (const [breed, cat] of Object.entries(EXPECT)) {
  const path = `${DIR}/${breed}.txt`;
  if (!existsSync(path)) {
    console.log(`[missing-file] ${breed}.txt (check expected-map key)`);
    missing++;
    continue;
  }
  const j = JSON.parse(readFileSync(path, 'utf8').match(/\$json\$([\s\S]*?)\$json\$/)[1]);
  const aw = j.allele_weights || {};
  const E = aw.E_Extension || {},
    A = aw.A_Agouti || {};
  const chestnutP = E['e/e'] || 0;
  const Ep = (E['E/e'] || 0) + (E['E/E'] || 0);
  const blackP = Ep * (A['a/a'] || 0);
  const grayP = sumKeys(aw.G_Gray, 'G');
  const dunP = sumKeys(aw.D_Dun, 'D/');
  const metric = { chestnut: chestnutP, black: blackP, gray: grayP, dun: dunP }[cat];
  const flag = metric < THRESH[cat];
  if (flag) {
    console.log(
      `[IMPLAUSIBLE] ${breed}: expected ${cat}-dominant but ${cat}P=${metric.toFixed(2)} < ${THRESH[cat]} (e/e=${chestnutP.toFixed(2)} blackP=${blackP.toFixed(2)} grayP=${grayP.toFixed(2)} dunP=${dunP.toFixed(2)})`
    );
    issues++;
  } else ok++;
}
console.log(
  `\n=== BASE-COLOR AUDIT: ${ok} plausible, ${issues} implausible, ${missing} map-keys-not-found (of ${Object.keys(EXPECT).length} checked) ===`
);
