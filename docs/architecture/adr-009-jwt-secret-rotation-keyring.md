# ADR-009: Two-Key Ring for JWT Signing-Secret Rotation

**Status:** Accepted
**Date:** 2026-05-18
**Scope:** Access- and refresh-token signing secrets

## Load rule

Load this ADR only when changing JWT signing or verification, access/refresh signing secrets, previous-key support, rotation procedure, token lifetimes, or the related environment contract. Verify runtime behavior against `backend/utils/jwtKeyRing.mjs`, its callers, runtime secret policy, and environment templates.

## Context

With one symmetric signing secret, replacing the secret immediately invalidates every still-live token. Equoria needs a bounded overlap window so an old cohort can expire while all newly issued tokens use the replacement key.

## Decision

Maintain a two-key ring for each JWT kind: one current signing secret and one optional previous verification secret.

Current invariants:

- Signing always uses the current secret.
- Verification tries the current secret first and retries the optional previous secret only for a signature mismatch.
- Expiry, not-before, malformed-token, and algorithm errors are not hidden by previous-key fallback.
- Access and refresh keys rotate independently through their corresponding current/previous environment variables.
- All JWT signing and verification routes through the shared key-ring helpers.
- Previous secrets are temporary overlap material, never permanent fallback configuration.

## Rotation procedure

1. Generate a new secret that satisfies the live runtime secret policy.
2. In the deployment environment, set the previous value to the old current secret and set current to the new secret. Deploy the pair together.
3. Confirm new tokens are signed with the new key and old, unexpired tokens still verify.
4. Wait longer than the maximum lifetime of tokens signed with the old key, using current configured lifetimes rather than values copied from this ADR.
5. Remove the previous secret, deploy, and verify login, refresh, and authenticated requests.

If rolling back after new-key tokens have been issued, restore the old key as current and retain the new key temporarily as previous. Removing the new key immediately would invalidate the newly issued cohort.

## Consequences

- Routine signing-key rotation does not require an immediate global logout.
- A compromised previous secret remains usable during the overlap window, so the window must close promptly.
- More than two concurrent keys, asymmetric signing, or `kid`-based selection requires a superseding decision.
- CSRF HMAC behavior is outside this JWT decision. Because current CSRF configuration is coupled to `JWT_SECRET`, an access-key rotation must also verify its CSRF-token impact rather than assuming the overlap window covers it.
