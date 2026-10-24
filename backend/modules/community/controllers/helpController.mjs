/** GET /api/v1/help/staff — the Need Help? page's staff list (Equoria-vc5x1). */

import logger from '../../../utils/logger.mjs';
import { listHelpStaff } from '../services/helpDirectory.mjs';

export async function getHelpStaff(req, res) {
  try {
    const data = await listHelpStaff();
    return res.json({ success: true, data });
  } catch (error) {
    logger.error(`[helpController.getHelpStaff] ${error.message}`);
    return res.status(500).json({ success: false, message: 'Failed to fetch the team' });
  }
}
