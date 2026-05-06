import { expect, type Locator, type Page } from '@playwright/test';

// Equoria-d7k6: the Celestial Night layout renders MainNavigation with
// `hideHamburger={isDesktop}` where isDesktop = window matches (min-width: 1024px)
// (frontend/src/components/layout/DashboardLayout.tsx:98). At desktop widths
// SidebarNav is shown directly and the hamburger button is not rendered;
// only on mobile (<1024px) does the hamburger appear and toggle a NavPanel
// overlay. Specs that hard-coded `getByTestId('hamburger-menu').click()`
// time out on Playwright's default 1280×720 chromium viewport because the
// element does not exist there.
//
// Use openNavPanel(page) to get a Locator scoped to the navigation
// container in a viewport-aware way. On desktop it returns the always-visible
// SidebarNav. On mobile it clicks the hamburger and returns the NavPanel
// overlay dialog. Either way the returned Locator is the right scope for
// `.getByRole('link', { name: ... })` queries against the nav.
export async function openNavPanel(page: Page): Promise<Locator> {
  const viewport = page.viewportSize();
  const isDesktop = viewport ? viewport.width >= 1024 : true;

  // Equoria-iiiz: use 15s timeout for the initial visibility wait — under
  // CI Redis-reconnect contention the React hydration + useMediaQuery
  // effect that triggers nav rendering can take longer than the default 5s.
  if (isDesktop) {
    const sidebar = page.getByTestId('sidebar-nav');
    await expect(sidebar).toBeVisible({ timeout: 15_000 });
    return sidebar;
  }

  const hamburger = page.getByTestId('hamburger-menu');
  await expect(hamburger).toBeVisible({ timeout: 15_000 });
  await hamburger.click();
  const panel = page.getByRole('dialog', { name: 'Navigation menu' });
  await expect(panel).toBeVisible({ timeout: 5_000 });
  return panel;
}
