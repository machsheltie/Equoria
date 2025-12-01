import fs from 'fs';
import path from 'path';

// Placeholder OpenAPI generator
// TODO: Replace with real schema loading and openapi generation (zod-to-openapi or similar)

const outputPath = path.resolve('docs/api/openapi.yaml');
const placeholder = openapi: 3.1.0
info:
  title: Equoria API
  version: 0.1.0
  description: Generated placeholder. Replace by running real schema-based generator.
paths: {}
;

fs.writeFileSync(outputPath, placeholder, 'utf8');
console.log(Wrote placeholder OpenAPI to );
