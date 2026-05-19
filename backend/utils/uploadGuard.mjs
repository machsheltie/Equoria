/**
 * uploadGuard — file-upload security validation gate.
 *
 * Equoria-9m1u: A reusable, fail-closed upload guard that ANY future
 * feature accepting a user-supplied file (avatar upload, horse photo,
 * club banner, import, etc.) MUST call BEFORE persisting, serving, or
 * otherwise trusting the uploaded bytes. This is a hard prerequisite
 * GATE — it is intentionally built ahead of any consumer (no
 * multer/formidable/upload endpoint exists today; SECURITY.md §7 records
 * file-upload validation as implemented-but-unconsumed precisely because
 * this utility makes the first such feature safe by construction).
 *
 * SECURITY.md §7 (File Upload Security) documents the exact behavior
 * implemented here. Do not contradict that section; update it together
 * with this file.
 *
 * Mirrors the structural conventions of `backend/utils/ssrfGuard.mjs`
 * (Equoria-4dva): frozen allow-lists, a fail-closed boolean/predicate
 * core, a single `assert*` GATE that throws a generic `AppError(400)` on
 * ANY failure, and a logger.warn breadcrumb on every rejection.
 *
 * ──────────────────────────────────────────────────────────────────────
 * CONTRACT — how to use this gate
 * ──────────────────────────────────────────────────────────────────────
 *
 *   import { assertSafeUpload } from '../utils/uploadGuard.mjs';
 *
 *   // In any handler that accepts an uploaded file (e.g. multer memory
 *   // storage gives you { originalname, mimetype, buffer }):
 *   const safe = assertSafeUpload({
 *     filename: file.originalname,
 *     declaredMimeType: file.mimetype,
 *     buffer: file.buffer,
 *   });
 *   // throws AppError(400) if anything is unsafe — fail CLOSED.
 *   // `safe.safeFilename`  — sanitized, traversal-free storage name
 *   // `safe.detectedType`  — MIME proven by magic-byte sniff
 *   // `safe.checksum`      — sha256 hex of the bytes (A08 integrity)
 *   await fs.writeFile(path.join(UPLOAD_DIR, safe.safeFilename), buffer);
 *
 * The guard NEVER trusts the declared Content-Type or the file extension
 * on its own. The authoritative type is the one proven by inspecting the
 * actual leading bytes (magic numbers). The declared MIME and extension
 * must BOTH agree with the sniffed type or the upload is rejected — this
 * defeats a `.jpg` that is really a script/polyglot, and a script served
 * with `Content-Type: image/png`.
 *
 * ──────────────────────────────────────────────────────────────────────
 * FAIL-CLOSED INVARIANT (EDGE_CASE_FIX_DISCIPLINE.md §3)
 * ──────────────────────────────────────────────────────────────────────
 *
 * Every code path that does not affirmatively prove the file is a small,
 * allow-listed image whose declared type, extension, and magic bytes all
 * agree REJECTS. Empty/oversize/missing buffers, unparseable names,
 * unknown magic, type disagreement, and ANY unexpected exception reject
 * with a generic AppError(400). There is no silent catch, no
 * allow-through-on-error, no "best effort" path.
 */

import crypto from 'crypto';

import AppError from '../errors/AppError.mjs';
import logger from './logger.mjs';

/** Default maximum upload size: 5 MB (SECURITY.md §7). */
export const DEFAULT_MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/**
 * The canonical allow-list. Each entry is a single logical image type:
 *  - `mimes`      — every declared Content-Type accepted for this type
 *  - `extensions` — every filename extension accepted for this type
 *  - `sniff(buf)` — magic-byte predicate; true iff the actual bytes are
 *                   this type. This is the AUTHORITATIVE check.
 *
 * SECURITY.md §7 allow-list: JPEG, PNG, GIF, WebP. Nothing else passes.
 */
const ALLOWED_TYPES = Object.freeze([
  Object.freeze({
    type: 'image/jpeg',
    mimes: Object.freeze(['image/jpeg', 'image/jpg', 'image/pjpeg']),
    extensions: Object.freeze(['jpg', 'jpeg']),
    // JPEG: FF D8 FF ... and ends with FF D9 (we only assert the SOI).
    sniff: buf => buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff,
  }),
  Object.freeze({
    type: 'image/png',
    mimes: Object.freeze(['image/png']),
    extensions: Object.freeze(['png']),
    // PNG: 89 50 4E 47 0D 0A 1A 0A
    sniff: buf =>
      buf.length >= 8 &&
      buf[0] === 0x89 &&
      buf[1] === 0x50 &&
      buf[2] === 0x4e &&
      buf[3] === 0x47 &&
      buf[4] === 0x0d &&
      buf[5] === 0x0a &&
      buf[6] === 0x1a &&
      buf[7] === 0x0a,
  }),
  Object.freeze({
    type: 'image/gif',
    mimes: Object.freeze(['image/gif']),
    extensions: Object.freeze(['gif']),
    // GIF: "GIF87a" or "GIF89a"
    sniff: buf => {
      if (buf.length < 6) {
        return false;
      }
      const sig = buf.toString('latin1', 0, 6);
      return sig === 'GIF87a' || sig === 'GIF89a';
    },
  }),
  Object.freeze({
    type: 'image/webp',
    mimes: Object.freeze(['image/webp']),
    extensions: Object.freeze(['webp']),
    // WebP: "RIFF" .... "WEBP" (RIFF container with WEBP form type)
    sniff: buf =>
      buf.length >= 12 &&
      buf.toString('latin1', 0, 4) === 'RIFF' &&
      buf.toString('latin1', 8, 12) === 'WEBP',
  }),
]);

/**
 * Sanitize a user-supplied filename into a safe storage name.
 *
 * Strips directory components and traversal sequences, rejects null
 * bytes and control characters, collapses everything to a conservative
 * `[A-Za-z0-9._-]` charset, and forbids leading dots / empty results.
 * Returns `null` (NOT a guessed name) when the input cannot be made
 * safe — the GATE turns that null into a rejection (fail closed).
 *
 * @param {unknown} rawName
 * @returns {string | null} a safe basename, or null if unsanitizable
 */
export function sanitizeFilename(rawName) {
  if (typeof rawName !== 'string' || rawName.length === 0) {
    return null;
  }

  // Null byte or any C0/C1 control character → reject outright. A null
  // byte is a classic truncation attack ("a.jpg\0.php"); never try to
  // "clean" it — refuse.
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f-\u009f]/.test(rawName)) {
    return null;
  }

  // Take only the final path component regardless of separator style
  // (handles "../../etc/passwd", "..\\..\\win.ini", absolute paths,
  // and mixed separators). Splitting on both / and \ defeats traversal.
  const base = rawName.split(/[/\\]/).pop() || '';

  // After taking the basename, "." and ".." are not valid filenames.
  if (base === '' || base === '.' || base === '..') {
    return null;
  }

  // Collapse to a conservative charset. Anything outside [A-Za-z0-9._-]
  // becomes "_". This also neutralizes any residual "../" that survived
  // a pathological encoding (defense-in-depth on top of the split).
  let safe = base.replace(/[^A-Za-z0-9._-]/g, '_');

  // Disallow leading dots (hidden files, "..foo") and collapse repeated
  // dots so "image..jpg" / ".htaccess" cannot slip through.
  safe = safe.replace(/^\.+/, '').replace(/\.{2,}/g, '.');

  // Length cap — overlong names are a filesystem / log-injection smell.
  if (safe.length === 0 || safe.length > 200) {
    return null;
  }

  return safe;
}

/**
 * Detect the true file type by inspecting the leading magic bytes.
 * Returns the matching ALLOWED_TYPES entry, or null if the bytes do not
 * match any allow-listed image signature. Magic bytes are the
 * AUTHORITATIVE type — never trust the extension or declared MIME.
 *
 * @param {Buffer} buffer
 * @returns {object | null}
 */
function detectType(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    return null;
  }
  for (const entry of ALLOWED_TYPES) {
    let matched = false;
    try {
      matched = entry.sniff(buffer) === true;
    } catch {
      // A sniff predicate must never throw; if one does, treat as
      // no-match (fail closed) rather than crash the gate.
      matched = false;
    }
    if (matched) {
      return entry;
    }
  }
  return null;
}

/**
 * Extract the lowercased extension (without the dot) from a filename, or
 * null if there is none.
 */
function extensionOf(filename) {
  const idx = filename.lastIndexOf('.');
  if (idx <= 0 || idx === filename.length - 1) {
    return null;
  }
  return filename.slice(idx + 1).toLowerCase();
}

/**
 * THE GATE. Validate a user-supplied upload for safety: size cap, MIME
 * allow-list, extension allow-list, magic-byte content sniff (the
 * authoritative type), declared-type / extension / sniff agreement, and
 * filename sanitization. Returns the vetted descriptor on success.
 * Throws a generic AppError(400) on ANY failure — fail CLOSED. There is
 * no path that resolves to "allowed" without affirmatively proving the
 * bytes are a small allow-listed image whose claimed type, extension,
 * and magic bytes all agree.
 *
 * @param {object}  input
 * @param {unknown} input.filename          user-supplied original name
 * @param {unknown} input.declaredMimeType  the declared Content-Type
 * @param {unknown} input.buffer            the raw file bytes (Buffer)
 * @param {number} [input.maxBytes]         override the 5MB default cap
 * @returns {{ safeFilename: string, detectedType: string,
 *             extension: string, size: number, checksum: string }}
 * @throws {AppError} 400 on any unsafe/unverifiable input
 */
export function assertSafeUpload(input) {
  try {
    if (input === null || typeof input !== 'object') {
      throw new AppError('Upload rejected by upload policy', 400);
    }

    const { filename, declaredMimeType, buffer } = input;
    const maxBytes =
      typeof input.maxBytes === 'number' && Number.isFinite(input.maxBytes) && input.maxBytes > 0
        ? input.maxBytes
        : DEFAULT_MAX_UPLOAD_BYTES;

    // 1. Buffer must exist and be non-empty. Empty / missing / non-Buffer
    //    → reject (fail closed; an empty upload cannot be proven safe).
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
      logger.warn('[uploadGuard] rejected upload: missing or empty buffer');
      throw new AppError('Upload rejected: empty or invalid file', 400);
    }

    // 2. Size cap.
    if (buffer.length > maxBytes) {
      logger.warn(`[uploadGuard] rejected upload: ${buffer.length} bytes exceeds cap ${maxBytes}`);
      throw new AppError('Upload rejected: file exceeds maximum allowed size', 400);
    }

    // 3. Filename sanitization (fail closed on unsanitizable input —
    //    null byte, traversal-only, control chars, empty).
    const safeFilename = sanitizeFilename(filename);
    if (safeFilename === null) {
      logger.warn('[uploadGuard] rejected upload: filename could not be sanitized');
      throw new AppError('Upload rejected: invalid filename', 400);
    }

    // 4. Magic-byte content sniff — the AUTHORITATIVE type. A script or
    //    polyglot disguised as .jpg fails here because its bytes do not
    //    match any allow-listed image signature.
    const detected = detectType(buffer);
    if (detected === null) {
      logger.warn('[uploadGuard] rejected upload: content does not match any allowed image type');
      throw new AppError('Upload rejected: file content is not an allowed image type', 400);
    }

    // 5. Declared MIME must be in this type's allow-list AND agree with
    //    the sniffed type. A script served as image/png is caught here
    //    (its bytes sniff as not-png, so step 4 already rejected it; this
    //    step additionally rejects image/png-claimed-but-actually-gif).
    const declared =
      typeof declaredMimeType === 'string' ? declaredMimeType.trim().toLowerCase() : '';
    if (!detected.mimes.includes(declared)) {
      logger.warn(
        `[uploadGuard] rejected upload: declared MIME "${declared}" disagrees with sniffed ${detected.type}`,
      );
      throw new AppError('Upload rejected: declared content type does not match file', 400);
    }

    // 6. Extension must be in this type's allow-list AND agree with the
    //    sniffed type. "evil.jpg" containing PNG bytes is rejected here
    //    even though both jpg and png are individually allowed.
    const extension = extensionOf(safeFilename);
    if (extension === null || !detected.extensions.includes(extension)) {
      logger.warn(
        `[uploadGuard] rejected upload: extension "${extension}" disagrees with sniffed ${detected.type}`,
      );
      throw new AppError('Upload rejected: file extension does not match file content', 400);
    }

    // 7. Integrity checksum (Report A08 — "checksum verification for
    //    file uploads"). Callers persist this alongside the file so a
    //    later read can prove the bytes were not tampered with at rest.
    const checksum = crypto.createHash('sha256').update(buffer).digest('hex');

    return {
      safeFilename,
      detectedType: detected.type,
      extension,
      size: buffer.length,
      checksum,
    };
  } catch (err) {
    // Fail CLOSED. Re-throw AppError as-is; wrap anything else generically
    // (never swallow, never allow-through). EDGE_CASE_FIX_DISCIPLINE §3.
    if (AppError.isAppError(err)) {
      throw err;
    }
    logger.warn('[uploadGuard] rejected upload (unexpected error, fail-closed)');
    throw new AppError('Upload rejected by upload policy', 400);
  }
}

export default assertSafeUpload;
