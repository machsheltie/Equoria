/**
 * The port the owner's quarantined-show routes call through (Equoria-ehlbj).
 *
 * The tools themselves (diagnose, preview, run) settle shows, so they belong to
 * the competition module; the staff routes (the only place the staff guard and
 * its path-scoped device cookie reach) cannot import competition without a
 * module cycle (competition -> users -> staff). The app layer, which may import
 * both barrels, hands the staff module the tools once at start-up:
 * backend/app/routers.mjs calls registerQuarantinedShowTools.
 */

let tools = null;

/**
 * @param {{ diagnoseQuarantinedShow: Function, previewQuarantinedShow: Function, runQuarantinedShow: Function }} implementation
 */
export function registerQuarantinedShowTools(implementation) {
  tools = Object.freeze({
    diagnoseQuarantinedShow: implementation.diagnoseQuarantinedShow,
    previewQuarantinedShow: implementation.previewQuarantinedShow,
    runQuarantinedShow: implementation.runQuarantinedShow,
  });
}

/** The registered tools; throws when the app layer has not registered them. */
export function quarantinedShowTools() {
  if (!tools) {
    throw new Error('Quarantined-show tools were not registered at start-up');
  }
  return tools;
}
