/**
 * Private stud request queue: reject, cancel and the queue listing
 * (Equoria-q4uem.9). Request and approval live in studRequestController.mjs.
 *
 * Owner rulings (Stacey): 2026-10-15 S8 requests never expire and the mare
 * owner may cancel any time; S10 the mare owner is told of a rejection.
 * 2026-10-16 S-Q5 the stallion owner is told of a cancellation.
 *
 * Each close is ONE guarded update (status still PENDING, the caller on the
 * right side), so it can never close a request an approval completed.
 */
import prisma from '../../../../packages/database/prismaClient.mjs';
import { withRetryableTxMapping } from '../../../utils/retryableTransaction.mjs';
import {
  BUSY_MESSAGE,
  BookingRefusal,
  REQUEST_NOT_FOUND,
  REQUEST_NOT_PENDING,
  finalizeAll,
  notify,
  requestPayload,
  sendUnexpected,
} from '../services/studBookingShared.mjs';

/**
 * Close a PENDING request as one party. `field` names the caller's side.
 *
 * @param {{ requestId: number, callerId: string, field: 'stallionOwnerId' | 'mareOwnerId',
 *   data: object, notifyField: 'mareOwnerId' | 'stallionOwnerId', type: string }} params
 */
async function closeRequest({ requestId, callerId, field, data, notifyField, type }) {
  return withRetryableTxMapping(
    prisma.$transaction(
      async tx => {
        const claimed = await tx.breedingRecord.updateMany({
          where: { id: requestId, kind: 'PRIVATE_STUD', status: 'PENDING', [field]: callerId },
          data: { ...data, resolvedAt: new Date() },
        });
        const record = await tx.breedingRecord.findUnique({ where: { id: requestId } });
        if (claimed.count !== 1) {
          if (!record || record.kind !== 'PRIVATE_STUD' || record[field] !== callerId) {
            throw new BookingRefusal(404, REQUEST_NOT_FOUND);
          }
          throw new BookingRefusal(409, REQUEST_NOT_PENDING);
        }
        const notifications = [];
        await notify(tx, notifications, record[notifyField], type, requestPayload(record, data));
        return notifications;
      },
      { timeout: 30000 },
    ),
    { message: BUSY_MESSAGE },
  );
}

async function sendClose(res, label, params) {
  try {
    const notifications = await closeRequest(params);
    finalizeAll(notifications);
    return res
      .status(200)
      .json({ success: true, data: { requestId: params.requestId, status: params.data.status } });
  } catch (error) {
    if (error instanceof BookingRefusal) {
      return res.status(error.status).json(error.body);
    }
    return sendUnexpected(res, label, error);
  }
}

/** POST /api/v1/studs/requests/:id/reject — the stallion owner says no (S10: the mare owner is told). */
export function rejectStudRequest(req, res) {
  return sendClose(res, 'rejectStudRequest', {
    requestId: Number(req.params.id),
    callerId: req.user.id,
    field: 'stallionOwnerId',
    data: { status: 'DECLINED', declineReason: 'REJECTED' },
    notifyField: 'mareOwnerId',
    type: 'studRequestDeclined',
  });
}

/** POST /api/v1/studs/requests/:id/cancel — the mare owner withdraws (S8; S-Q5: the stallion owner is told). */
export function cancelStudRequest(req, res) {
  return sendClose(res, 'cancelStudRequest', {
    requestId: Number(req.params.id),
    callerId: req.user.id,
    field: 'mareOwnerId',
    data: { status: 'CANCELLED', declineReason: 'CANCELLED_BY_OWNER' },
    notifyField: 'stallionOwnerId',
    type: 'studRequestCancelled',
  });
}

/**
 * GET /api/v1/studs/requests?role=incoming|outgoing&status=&page=&limit=
 * incoming: requests for the caller's stallions; outgoing: the caller's mares.
 */
export async function listStudRequests(req, res) {
  try {
    const callerId = req.user.id;
    const incoming = req.query.role === 'incoming';
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
    const where = {
      kind: 'PRIVATE_STUD',
      ...(incoming ? { stallionOwnerId: callerId } : { mareOwnerId: callerId }),
      ...(req.query.status ? { status: req.query.status } : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.breedingRecord.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.breedingRecord.count({ where }),
    ]);
    const requests = rows.map(r => ({
      id: r.id,
      status: r.status,
      kind: r.kind,
      fee: r.fee,
      createdAt: r.createdAt,
      resolvedAt: r.resolvedAt,
      declineReason: r.declineReason,
      sire: { id: r.sireId, name: r.sireName },
      dam: { id: r.damId, name: r.damName },
      counterparty: { username: incoming ? r.mareOwnerName : r.stallionOwnerName },
    }));
    return res.status(200).json({
      success: true,
      data: { requests, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } },
    });
  } catch (error) {
    return sendUnexpected(res, 'listStudRequests', error);
  }
}
