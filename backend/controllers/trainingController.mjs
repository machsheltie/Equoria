/**
 * Backwards-compat shim — real implementation in modules/training/controllers/trainingController.mjs
 *
 * Equoria-94z3m: re-export through the training module barrel (index.mjs) to
 * satisfy the cross-module public-API boundary rule (no-restricted-imports /
 * Equoria-fy2tx). Named exports mirror the controller's public surface.
 */
export {
  canTrain,
  trainHorse,
  getTrainingStatus,
  getTrainableHorses,
  trainRouteHandler,
} from '../modules/training/index.mjs';
