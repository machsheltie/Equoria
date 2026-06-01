/**
 * xj9ep-muted-rgb-codemod.mjs (Equoria-xj9ep)
 *
 * Replaces the hardcoded muted slate literal rgb(148,163,184) /
 * rgba(148,163,184,<alpha>) with the design token, preserving exact visual +
 * alpha parity, using the convention established by Equoria-osx51 (pages) and
 * Equoria-saer (auth pages):
 *
 *   Tailwind arbitrary-value class form
 *     <prefix>-[rgb(148,163,184)]              -> <prefix>-slate-400
 *     <prefix>-[rgba(148,163,184,0.10)]        -> <prefix>-slate-400/10
 *     <prefix>-[rgba(148,163,184,0.30)]        -> <prefix>-slate-400/30
 *     <prefix>-[rgba(148,163,184,0.40)]        -> <prefix>-slate-400/40
 *     <prefix>-[rgba(148,163,184,0.08)]        -> <prefix>-slate-400/[0.08]
 *       (standard Tailwind opacity step when alpha*100 is an integer that
 *        Tailwind ships as a default step: 5,10,20,25,30,40,50,60,70,75,80,
 *        90,95,100; otherwise the arbitrary-value /[0.0x] form — same rule
 *        osx51 applied: /60 /40 for clean, /[0.08] for non-step.)
 *
 *   Bare JS / CSS-in-JS string literal form
 *     'rgb(148,163,184)'                       -> 'rgb(var(--mystic-silver))'
 *     'rgba(148,163,184,0.1)'                  -> 'rgb(var(--mystic-silver) / 0.1)'
 *       (--mystic-silver is defined space-separated `148 163 184` in
 *        index.css, so the modern `rgb(<r g b> / <a>)` syntax is valid and
 *        preserves the exact alpha.)
 *
 * The literal-with-alpha may appear with or without spaces after commas
 * (`rgba(148, 163, 184, 0.1)` and `rgba(148,163,184,0.1)` both occur).
 *
 * Whitespace-insensitive on the numeric triple; alpha captured verbatim.
 *
 * Usage: node scripts/xj9ep-muted-rgb-codemod.mjs <file> [<file> ...]
 */
import fs from 'node:fs';

const RGB_TRIPLE = String.raw`148\s*,\s*163\s*,\s*184`;

// Tailwind default opacity steps (so we know when /NN is valid vs needs /[0.x]).
const TW_OPACITY_STEPS = new Set([
  0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100,
]);

/** Map a captured alpha string (e.g. "0.1", "0.08", ".4", "1") to the
 *  Tailwind opacity suffix: "/40" for a default step, "/[0.08]" otherwise. */
function alphaToTailwindSuffix(alphaRaw) {
  const a = parseFloat(alphaRaw);
  if (Number.isNaN(a)) return null;
  const pct = a * 100;
  // Use the integer-step form only when it lands exactly on a Tailwind step.
  if (Number.isInteger(pct) && TW_OPACITY_STEPS.has(pct)) {
    return `/${pct}`;
  }
  // Arbitrary-value form preserves the literal alpha exactly.
  // Normalise a leading-dot alpha (".4" -> "0.4") for the bracket form.
  const norm = alphaRaw.trim().startsWith('.') ? `0${alphaRaw.trim()}` : alphaRaw.trim();
  return `/[${norm}]`;
}

function migrate(src) {
  let out = src;

  // 1. Tailwind arbitrary-value class — WITH alpha:
  //    <prefix>-[rgba(148,163,184, <alpha>)]
  out = out.replace(
    new RegExp(String.raw`([\w-]+)-\[rgba\(\s*${RGB_TRIPLE}\s*,\s*([0-9.]+)\s*\)\]`, 'g'),
    (m, prefix, alpha) => {
      const suffix = alphaToTailwindSuffix(alpha);
      if (suffix == null) return m;
      return `${prefix}-slate-400${suffix}`;
    }
  );

  // 2. Tailwind arbitrary-value class — NO alpha:
  //    <prefix>-[rgb(148,163,184)]
  out = out.replace(
    new RegExp(String.raw`([\w-]+)-\[rgb\(\s*${RGB_TRIPLE}\s*\)\]`, 'g'),
    (_m, prefix) => `${prefix}-slate-400`
  );

  // 3. Bare JS/CSS string literal — WITH alpha:
  //    'rgba(148,163,184, <alpha>)'  /  "rgba(...)"  /  `rgba(...)`
  out = out.replace(
    new RegExp(String.raw`(['"\`])rgba\(\s*${RGB_TRIPLE}\s*,\s*([0-9.]+)\s*\)\1`, 'g'),
    (_m, q, alpha) => `${q}rgb(var(--mystic-silver) / ${alpha.trim()})${q}`
  );

  // 4. Bare JS/CSS string literal — NO alpha:
  //    'rgb(148,163,184)'
  out = out.replace(
    new RegExp(String.raw`(['"\`])rgb\(\s*${RGB_TRIPLE}\s*\)\1`, 'g'),
    (_m, q) => `${q}rgb(var(--mystic-silver))${q}`
  );

  // 5. CSS-selector ESCAPED arbitrary-value form inside querySelector/CSS
  //    string args, e.g.  .text-\[rgb\(148\,163\,184\)\]  or
  //    .bg-\[rgba\(148\,163\,184\,0.3\)\]  (each special char backslash-
  //    escaped for querySelector). These reference the OLD literal class
  //    that the component no longer renders post-migration, so they must
  //    track the same slate-400[/alpha] target. We match the escaped triple
  //    `148\,163\,184` (one literal backslash before each comma in the
  //    selector string).
  //  The selector string in source contains TWO literal backslashes before
  //  each CSS special char (it's a JS string whose runtime value escapes the
  //  selector for querySelector): bytes are `\` `\` `[`. To match two literal
  //  backslashes a regex needs `\\\\`; in a String.raw template that is eight
  //  backslashes. Helper keeps the regex readable.
  const BS2 = String.raw`\\\\`; // matches two literal backslash chars
  const ESC_TRIPLE = `148${BS2},163${BS2},184`;
  //  5a. escaped WITH alpha
  out = out.replace(
    new RegExp(
      String.raw`([\w-]+)-${BS2}\[rgba${BS2}\(${ESC_TRIPLE}${BS2},([0-9.]+)${BS2}\)${BS2}\]`,
      'g'
    ),
    (m, prefix, alpha) => {
      const suffix = alphaToTailwindSuffix(alpha);
      if (suffix == null) return m;
      // slate-400/[0.0x] inside a selector needs the bracket re-escaped
      // with the same two-backslash convention.
      const escSuffix = suffix.startsWith('/[') ? `/\\\\[${suffix.slice(2, -1)}\\\\]` : suffix;
      return `${prefix}-slate-400${escSuffix}`;
    }
  );
  //  5b. escaped NO alpha
  out = out.replace(
    new RegExp(String.raw`([\w-]+)-${BS2}\[rgb${BS2}\(${ESC_TRIPLE}${BS2}\)${BS2}\]`, 'g'),
    (_m, prefix) => `${prefix}-slate-400`
  );

  // 6. Attribute-substring selectors that targeted the muted token by its
  //    CSS value, e.g. querySelectorAll('[class*="rgb(var(--mystic-silver))"]')
  //    — these were written against a JS-token migration assumption, but the
  //    Tailwind class form the component actually renders is `slate-400`, so
  //    the substring must be the class token. Also normalises the raw-literal
  //    substring form `[class*="rgb(148,163,184)"]`.
  out = out.replace(
    new RegExp(String.raw`(\[class\*?[\^$~|]?=("|'))rgb\(var\(--mystic-silver\)\)\2\]`, 'g'),
    (_m, head, q) => `${head}slate-400${q}]`
  );
  out = out.replace(
    new RegExp(String.raw`(\[class\*?[\^$~|]?=("|'))rgb\(\s*${RGB_TRIPLE}\s*\)\2\]`, 'g'),
    (_m, head, q) => `${head}slate-400${q}]`
  );

  return out;
}

const files = process.argv.slice(2);
let changedFiles = 0;
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  const next = migrate(src);
  if (next !== src) {
    fs.writeFileSync(f, next, 'utf8');
    changedFiles++;
    console.log(`MIGRATED: ${f}`);
  } else {
    console.log(`SKIP (no muted literal): ${f}`);
  }
}
console.log(`\nTOTAL: ${changedFiles} files changed`);
