/**
 * appearanceCallRecord.mjs
 *
 * The recording fields every molecular call carries (genetics master spec §3
 * MolecularVariantCall, Equoria-8xxnf slice 1): the assembly and call kind it
 * was reported in, and an optional assay key. Pure functions, no Prisma.
 */

import { getVariant } from './appearanceVariantRegistry.mjs';

const ASSEMBLIES = new Set(['EquCab2.0', 'EquCab3.0', 'TB-T2T', 'UNMAPPED']);
const callKinds = new Set(['SNV', 'INDEL', 'CNV', 'INVERSION', 'INSERTION', 'haplotypeMarker']);

/**
 * The assembly and call kind a call is recorded in when the registry is its
 * only source (legacy conversion): the registry's preferred build, or UNMAPPED
 * for a sentinel that has no coordinates.
 *
 * @param {string} variantId
 * @returns {{ assembly: string, callKind: string }}
 */
export function registryCallRepresentation(variantId) {
  const entry = getVariant(variantId);
  if (!entry) {
    throw new Error(`registryCallRepresentation: unknown variant ${variantId}`);
  }
  return { assembly: entry.preferredMappingAssembly ?? 'UNMAPPED', callKind: entry.callKind };
}

/**
 * Spec §3 MolecularVariantCall: every call keeps the build and molecular
 * representation it was reported in. An assay may report a variant in another
 * build or as a linked marker, so these are not required to match the registry.
 * assayId, when present, is a key into the dated assay registry; that registry
 * does not exist yet, so only its shape is checked.
 */
export function checkCallRecord(call, callPath, errors) {
  if (!ASSEMBLIES.has(call.assembly)) {
    invalid(errors, `${callPath}.assembly`, 'must be EquCab2.0, EquCab3.0, TB-T2T or UNMAPPED');
  }
  if (!callKinds.has(call.callKind)) {
    invalid(errors, `${callPath}.callKind`, 'must be a spec §3 call kind');
  }
  if (
    Object.hasOwn(call, 'assayId') &&
    (typeof call.assayId !== 'string' || call.assayId.trim() === '')
  ) {
    invalid(errors, `${callPath}.assayId`, 'must be a non-blank string when present');
  }
}

function invalid(errors, path, detail) {
  errors.push({ code: 'invalidField', path, detail });
}
