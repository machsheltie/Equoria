/**
 * Pay Rider routes' handlers (Equoria-hc96y). Owner rulings 2026-10-28 and 2026-10-29
 * (q268): payday is a player action, any time during the week; the week ends Sunday
 * midnight Eastern.
 */

import {
  RiderPayRefusal,
  getRiderPayStatus,
  payRider,
} from '../services/riderPlayerPayService.mjs';

/** GET /api/v1/riders/pay-status */
export async function getRiderPayStatusHandler(req, res, next) {
  try {
    const data = await getRiderPayStatus(req.user.id);
    return res.json({ success: true, message: 'Rider pay retrieved', data });
  } catch (error) {
    return next(error);
  }
}

/** POST /api/v1/riders/:id/pay — answers with the refreshed pay state. */
export async function payRiderHandler(req, res, next) {
  try {
    const paid = await payRider(req.user.id, Number(req.params.id));
    const data = await getRiderPayStatus(req.user.id);
    return res.json({ success: true, message: 'Rider paid', data: { ...data, paid } });
  } catch (error) {
    if (error instanceof RiderPayRefusal) {
      return res
        .status(error.status)
        .json({ success: false, code: error.code, message: error.message });
    }
    return next(error);
  }
}
