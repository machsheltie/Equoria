import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { allSchemas } from '../schemas/index.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outputPath = path.resolve(__dirname, '../../docs/api/openapi.yaml');

const baseSpec = {
  openapi: '3.1.0',
  info: {
    title: 'Equoria API',
    version: '0.1.0',
    description: 'Generated from schema stubs. Replace with real schemas per route.',
  },
  servers: [
    { url: 'http://localhost:3000/api/v1', description: 'Local dev' },
    { url: 'https://api.equoria.example.com/api/v1', description: 'Production (placeholder)' },
  ],
  paths: {},
};

for (const schema of allSchemas) {
  const normalizedPath = schema.path.startsWith('/') ? schema.path : `/${schema.path}`;
  const fullPath = `/api/v1${normalizedPath}`;
  if (!baseSpec.paths[fullPath]) { baseSpec.paths[fullPath] = {}; }
  baseSpec.paths[fullPath][schema.method] = {
    summary: schema.summary,
    tags: schema.tags,
    requestBody: schema.request
      ? {
        content: {
          'application/json': {
            schema: schema.request.body,
          },
        },
      }
      : undefined,
    responses: schema.responses || { 200: { description: 'OK' } },
  };
}

// Minimal YAML serializer for simple objects/arrays
const yaml = (obj, indent = 0) => {
  const pad = '  '.repeat(indent);
  if (Array.isArray(obj)) {
    return obj
      .map(item => `${pad}- ${typeof item === 'object' ? `\n${yaml(item, indent + 1)}` : item}`)
      .join('\n');
  }
  if (obj && typeof obj === 'object') {
    return Object.entries(obj)
      .map(([key, val]) => {
        if (val === undefined) { return ''; }
        if (val && typeof val === 'object') {
          return `${pad}${key}:\n${yaml(val, indent + 1)}`;
        }
        return `${pad}${key}: ${val}`;
      })
      .filter(Boolean)
      .join('\n');
  }
  return `${pad}${obj}`;
};

const content = yaml(baseSpec);
fs.writeFileSync(outputPath, content, 'utf8');
console.log(`Wrote OpenAPI stub to ${outputPath}`);
