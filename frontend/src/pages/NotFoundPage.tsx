/**
 * NotFoundPage — what the client shows at an address that is not a page.
 *
 * Today that is nothing: the game has no designed "lost" page yet, and an
 * unknown address has always rendered no route content. App.tsx mounts this
 * as the catch-all route, and the Steward's Office gate renders the very same
 * element for anyone who is not staff (STAFF-CR-17), so /steward and any
 * random address are indistinguishable. A designed page, when the owner asks
 * for one, replaces this body and both uses change together.
 *
 * Eagerly imported on purpose: a lazy import would flash the Suspense loader
 * on one path and not the other.
 */

export default function NotFoundPage() {
  return null;
}
