import { existsSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const frontendRoot = join(scriptDir, '..');

const requiredAssets = [
  'dist/index.html',
  'dist/images/bg-stable.webp',
  'dist/images/bg-horse-detail.webp',
  'dist/assets/art/farrier.webp',
  'dist/images/farriershop.webp',
];

const missingAssets = requiredAssets.filter((assetPath) => {
  return !existsSync(join(frontendRoot, assetPath));
});

if (missingAssets.length > 0) {
  console.error('Missing required frontend build assets:');
  for (const assetPath of missingAssets) {
    console.error(`- ${relative(process.cwd(), join(frontendRoot, assetPath))}`);
  }
  process.exit(1);
}

console.log('Required frontend build assets verified.');
