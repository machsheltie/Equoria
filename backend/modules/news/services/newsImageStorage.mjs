/**
 * News image storage (Equoria-wbt8l, owner ruling 2026-10-23): seasonal-event
 * tile images are uploaded at the News Desk and kept in the approved Supabase
 * Storage, in one public bucket.
 *
 * No SDK: Supabase Storage is a plain REST API, called with Node's fetch.
 * Configuration is read at call time from three environment variables; all
 * three must be set or uploads answer 503 "not set up":
 *   SUPABASE_URL              — the project URL, e.g. https://<ref>.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY — the project's service-role (secret) key;
 *                               server-only, never sent to the browser
 *   SUPABASE_NEWS_BUCKET      — a PUBLIC bucket for News images
 *
 * Every upload passes utils/uploadGuard.mjs first (size, type allow-list,
 * magic bytes). Objects are named by their sha256, so re-uploading the same
 * picture overwrites an identical object instead of piling up copies.
 * A tile URL is accepted on a post only when it points into that bucket and
 * passes utils/ssrfGuard.mjs's URL check.
 */

import AppError from '../../../errors/AppError.mjs';
import logger from '../../../utils/logger.mjs';
import { assertSafeUpload } from '../../../utils/uploadGuard.mjs';
import { validateOutboundUrl } from '../../../utils/ssrfGuard.mjs';

/** News tile images are pictures for a row of small tiles: 5 MB is plenty. */
export const newsImageMaxBytes = 5 * 1024 * 1024;

const uploadTimeoutMs = 20_000;
const bucketPattern = /^[a-z0-9][a-z0-9._-]{1,62}$/;

/**
 * The storage configuration, or null when it is not (fully) set.
 * @returns {{ baseUrl: string, key: string, bucket: string, publicPrefix: string } | null}
 */
export function newsImageStorageConfig() {
  const rawUrl = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const bucket = process.env.SUPABASE_NEWS_BUCKET?.trim();
  if (!rawUrl || !key || !bucket || !bucketPattern.test(bucket)) {
    return null;
  }
  let baseUrl;
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return null;
    }
    baseUrl = parsed.origin;
  } catch {
    // A malformed SUPABASE_URL is the same as an unset one: uploads say so.
    return null;
  }
  return {
    baseUrl,
    key,
    bucket,
    publicPrefix: `${baseUrl}/storage/v1/object/public/${bucket}/`,
  };
}

/**
 * Whether a tile image URL is one of ours: inside the News bucket's public
 * path, and a plain public http(s) URL by the SSRF guard's rules.
 * @param {unknown} url
 * @returns {boolean}
 */
export function isNewsImageUrl(url) {
  const config = newsImageStorageConfig();
  if (!config || typeof url !== 'string' || !url.startsWith(config.publicPrefix)) {
    return false;
  }
  const rest = url.slice(config.publicPrefix.length);
  if (!/^news\/[a-f0-9]{64}\.(?:jpg|jpeg|png|gif|webp)$/.test(rest)) {
    return false;
  }
  return validateOutboundUrl(url).ok === true;
}

/**
 * Vet an uploaded picture and store it in the News bucket.
 *
 * @param {{ filename: unknown, contentType: unknown, buffer: unknown }} upload
 * @returns {Promise<{ imageUrl: string }>}
 * @throws {AppError} 400 unsafe file, 503 storage not set up, 502 storage refused
 */
export async function uploadNewsImage({ filename, contentType, buffer }) {
  const safe = assertSafeUpload({
    filename,
    declaredMimeType: contentType,
    buffer,
    maxBytes: newsImageMaxBytes,
  });

  const config = newsImageStorageConfig();
  if (!config) {
    throw new AppError(
      'Image storage is not set up yet, so pictures cannot be uploaded. The game owner needs to configure it.',
      503,
    );
  }

  const objectPath = `news/${safe.checksum}.${safe.extension}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), uploadTimeoutMs);
  let response;
  try {
    response = await fetch(`${config.baseUrl}/storage/v1/object/${config.bucket}/${objectPath}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.key}`,
        apikey: config.key,
        'Content-Type': safe.detectedType,
        'x-upsert': 'true',
      },
      body: buffer,
      signal: controller.signal,
    });
  } catch (error) {
    logger.error(`[newsImageStorage] upload request failed: ${error.message}`);
    throw new AppError('The picture could not be stored just now. Please try again.', 502);
  } finally {
    clearTimeout(timer);
  }
  if (!response.ok) {
    logger.error(`[newsImageStorage] storage answered ${response.status} for ${objectPath}`);
    throw new AppError('The picture could not be stored just now. Please try again.', 502);
  }
  return { imageUrl: `${config.publicPrefix}${objectPath}` };
}
