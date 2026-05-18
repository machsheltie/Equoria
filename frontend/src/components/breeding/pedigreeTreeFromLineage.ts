/**
 * pedigreeTreeFromLineage (Equoria-55bo.2)
 *
 * Maps the REAL backend lineage-analysis response into the recursive
 * PedigreeTree shape the CompatibilityPreview Pedigree tab renders.
 *
 * Before this module the Pedigree tab only rendered a FLAT list of common
 * ancestors (`pedigreeOverlap`) derived from the inbreeding path-analysis.
 * The UX spec wants a real 3-generation sire/dam ancestor tree. The backend
 * already produces one:
 *
 *   GET /api/v1/breeding/lineage-analysis/:stallionId/:mareId
 *     → { lineageTree: { root: { stallion, mare } } }    (apiClient unwraps
 *        the outer { success, data } envelope, so the hook receives the inner
 *        object directly)
 *
 * Each node from `buildHorseNode` (backend
 * services/advancedLineageAnalysisService.mjs) has the shape:
 *   { id, name, generation, stats, traits, sire: node|null, dam: node|null }
 *
 * This module is a PURE function (no network, no React) so it can be unit
 * tested directly against the documented backend response shape. It performs
 * NO fabrication: if the lineage payload is missing or has no root horses it
 * returns null and the caller must render an honest empty state (no fake
 * "shared grandsire" placeholder — that was the 21R fake-data defect).
 */

/** A single ancestor node in the rendered pedigree tree. */
export interface PedigreeTreeNode {
  id: number;
  name: string;
  /** generation depth: 0 = the breeding pair, 1 = parents, 2 = grandparents… */
  generation: number;
  sire: PedigreeTreeNode | null;
  dam: PedigreeTreeNode | null;
}

/** The two roots of the pedigree the breeding pair forms. */
export interface PedigreeTree {
  stallion: PedigreeTreeNode | null;
  mare: PedigreeTreeNode | null;
}

/** Raw backend node shape (subset we read). */
interface BackendLineageNode {
  id: number;
  name: string;
  generation?: number;
  sire?: BackendLineageNode | null;
  dam?: BackendLineageNode | null;
}

interface BackendLineageResponse {
  lineageTree?: {
    root?: {
      stallion?: BackendLineageNode | null;
      mare?: BackendLineageNode | null;
    };
  };
  [key: string]: unknown;
}

function mapNode(
  node: BackendLineageNode | null | undefined,
  depth: number
): PedigreeTreeNode | null {
  if (!node || typeof node.id !== 'number' || typeof node.name !== 'string') {
    return null;
  }
  return {
    id: node.id,
    name: node.name,
    generation: typeof node.generation === 'number' ? node.generation : depth,
    sire: mapNode(node.sire, depth + 1),
    dam: mapNode(node.dam, depth + 1),
  };
}

/**
 * Map the real backend lineage-analysis response into a PedigreeTree.
 *
 * Returns null when the lineage payload is missing or contains no root
 * horses — the caller MUST render an honest empty state rather than
 * fabricate ancestors.
 */
export function mapLineageToPedigreeTree(
  lineage: BackendLineageResponse | null | undefined
): PedigreeTree | null {
  const root = lineage?.lineageTree?.root;
  if (!root) {
    return null;
  }
  const stallion = mapNode(root.stallion, 0);
  const mare = mapNode(root.mare, 0);
  if (!stallion && !mare) {
    return null;
  }
  return { stallion, mare };
}
