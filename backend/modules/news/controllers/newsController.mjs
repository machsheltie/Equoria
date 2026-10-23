/**
 * News HTTP handlers (Equoria-wbt8l).
 *
 * - getNews: the players' feed (GET /api/v1/news).
 * - the News Desk (GET/POST /api/v1/admin/news, PUT/DELETE /:id, POST
 *   /images): staff write posts and upload tile pictures. The /admin router
 *   already requires an admin-role token; the desk service re-reads the role
 *   and applies the per-type rule in ../newsPostTypes.mjs.
 *
 * Failures are AppErrors thrown by the services and answered by the global
 * error handler ({ success: false, message }).
 */

import { listPublishedNews } from '../services/newsFeedService.mjs';
import {
  createNewsPost,
  deleteNewsPost,
  getNewsDesk,
  updateNewsPost,
} from '../services/newsDeskService.mjs';
import { uploadNewsImage } from '../services/newsImageStorage.mjs';

/** GET /api/v1/news?before=<cursor>&limit=<n> */
export async function getNews(req, res, next) {
  try {
    const data = await listPublishedNews({
      cursor: typeof req.query.before === 'string' ? req.query.before : null,
      limit: req.query.limit === undefined ? undefined : Number(req.query.limit),
    });
    return res.json({ success: true, data });
  } catch (error) {
    return next(error);
  }
}

/** GET /api/v1/admin/news */
export async function getDesk(req, res, next) {
  try {
    return res.json({ success: true, data: await getNewsDesk({ writerId: req.user.id }) });
  } catch (error) {
    return next(error);
  }
}

/** POST /api/v1/admin/news */
export async function createPost(req, res, next) {
  try {
    const post = await createNewsPost({ writerId: req.user.id, input: req.body ?? {} });
    return res.status(201).json({ success: true, data: { post } });
  } catch (error) {
    return next(error);
  }
}

/** PUT /api/v1/admin/news/:id */
export async function updatePost(req, res, next) {
  try {
    const post = await updateNewsPost({
      writerId: req.user.id,
      id: Number(req.params.id),
      input: req.body ?? {},
    });
    return res.json({ success: true, data: { post } });
  } catch (error) {
    return next(error);
  }
}

/** DELETE /api/v1/admin/news/:id */
export async function deletePost(req, res, next) {
  try {
    const removed = await deleteNewsPost({ writerId: req.user.id, id: Number(req.params.id) });
    return res.json({ success: true, data: removed });
  } catch (error) {
    return next(error);
  }
}

/**
 * POST /api/v1/admin/news/images?filename=<name> — the raw picture is the
 * request body, sent with its own image Content-Type.
 */
export async function uploadImage(req, res, next) {
  const buffer = Buffer.isBuffer(req.body) ? req.body : null;
  const filename = typeof req.query.filename === 'string' ? req.query.filename : '';
  const contentType = req.get('Content-Type') ?? '';
  // /admin requests are written to the audit trail with req.body; record what
  // was uploaded, never the picture's bytes.
  req.body = { filename, contentType, size: buffer?.length ?? 0 };
  try {
    const image = await uploadNewsImage({ filename, contentType, buffer });
    return res.status(201).json({ success: true, data: image });
  } catch (error) {
    return next(error);
  }
}
