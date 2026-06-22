/**
 * tooltip — resolveCollision unit tests (Equoria-rkgq9.3.1)
 *
 * jsdom has no real layout: getBoundingClientRect() returns all-zero rects, so
 * the flip/shift path cannot be exercised through a rendered component. Instead
 * we unit-test the pure resolveCollision() decision helper directly with
 * hand-built rects — the same code path the component runs once a real browser
 * has measured the elements.
 */
import { describe, it, expect } from 'vitest';
import { resolveCollision, type Rect, type Viewport } from '../tooltip';

const VIEWPORT: Viewport = { width: 1000, height: 800 };

function rect(left: number, top: number, width: number, height: number): Rect {
  return { left, top, right: left + width, bottom: top + height, width, height };
}

describe('resolveCollision — main-axis flip', () => {
  it('keeps the preferred side when it fits', () => {
    // Trigger mid-screen, content small: top fits comfortably.
    const trigger = rect(450, 400, 100, 30);
    const content = rect(0, 0, 120, 40);
    const r = resolveCollision(trigger, content, VIEWPORT, 'top', 6);
    expect(r.side).toBe('top');
  });

  it('flips top -> bottom when the content would clip above the viewport', () => {
    // Trigger near the very top: only 10px above, content needs 40 -> flip down.
    const trigger = rect(450, 10, 100, 30);
    const content = rect(0, 0, 120, 40);
    const r = resolveCollision(trigger, content, VIEWPORT, 'top', 6);
    expect(r.side).toBe('bottom');
  });

  it('flips bottom -> top when the content would clip below the viewport', () => {
    // Trigger near the bottom: ~10px below the trigger, content needs 40 -> flip up.
    const trigger = rect(450, 760, 100, 30); // bottom = 790, 10px to viewport bottom
    const content = rect(0, 0, 120, 40);
    const r = resolveCollision(trigger, content, VIEWPORT, 'bottom', 6);
    expect(r.side).toBe('top');
  });

  it('flips left -> right when the content would clip past the left edge', () => {
    const trigger = rect(10, 400, 30, 30); // left = 10
    const content = rect(0, 0, 200, 40);
    const r = resolveCollision(trigger, content, VIEWPORT, 'left', 6);
    expect(r.side).toBe('right');
  });

  it('flips right -> left when the content would clip past the right edge', () => {
    const trigger = rect(960, 400, 30, 30); // right = 990, 10px to edge
    const content = rect(0, 0, 200, 40);
    const r = resolveCollision(trigger, content, VIEWPORT, 'right', 6);
    expect(r.side).toBe('left');
  });

  it('flips toward the roomier side when neither side fits the content', () => {
    // Tall content that fits on neither vertical side; preferred (bottom) has
    // little room (~70px) while top has 700px, so flip into the roomier side.
    const trigger = rect(450, 700, 100, 30); // top room 700, bottom room ~70
    const content = rect(0, 0, 120, 750);
    const r = resolveCollision(trigger, content, VIEWPORT, 'bottom', 6);
    // bottom room (70) < needed (750), opposite top room (700) > 70 -> flips to top
    expect(r.side).toBe('top');
  });

  it('respects the preferred side when it has the most room even if it does not fit', () => {
    const trigger = rect(450, 50, 100, 30); // top room 50, bottom room ~720
    const content = rect(0, 0, 120, 900); // fits neither
    const r = resolveCollision(trigger, content, VIEWPORT, 'bottom', 6);
    // preferred bottom room (720) already > top room (50) -> no flip
    expect(r.side).toBe('bottom');
  });
});

describe('resolveCollision — cross-axis shift', () => {
  it('shifts right when a centered vertical tooltip clips the left edge', () => {
    // Trigger hugging the left: centre at x=20, content 200 wide -> left = -80.
    const trigger = rect(5, 400, 30, 30); // centre x = 20
    const content = rect(0, 0, 200, 40);
    const r = resolveCollision(trigger, content, VIEWPORT, 'top', 6);
    expect(r.side).toBe('top');
    expect(r.shiftX).toBeGreaterThan(0); // nudged back to the right
    // content left would be 20 - 100 = -80 -> shift +80
    expect(r.shiftX).toBe(80);
    expect(r.shiftY).toBe(0);
  });

  it('shifts left when a centered vertical tooltip clips the right edge', () => {
    const trigger = rect(965, 400, 30, 30); // centre x = 980
    const content = rect(0, 0, 200, 40);
    const r = resolveCollision(trigger, content, VIEWPORT, 'top', 6);
    // content right would be 980 + 100 = 1080 -> overflow 80 -> shift -80
    expect(r.shiftX).toBe(-80);
  });

  it('shifts down when a centered horizontal tooltip clips the top edge', () => {
    const trigger = rect(400, 5, 30, 30); // centre y = 20
    const content = rect(0, 0, 200, 200);
    const r = resolveCollision(trigger, content, VIEWPORT, 'right', 6);
    expect(r.side).toBe('right');
    // content top = 20 - 100 = -80 -> shift +80 down
    expect(r.shiftY).toBe(80);
    expect(r.shiftX).toBe(0);
  });

  it('no shift when a centered tooltip fits within the viewport', () => {
    const trigger = rect(450, 400, 100, 30);
    const content = rect(0, 0, 120, 40);
    const r = resolveCollision(trigger, content, VIEWPORT, 'top', 6);
    expect(r.shiftX).toBe(0);
    expect(r.shiftY).toBe(0);
  });

  it('pins to the left edge (non-negative final position) when content is wider than the viewport', () => {
    const narrow: Viewport = { width: 150, height: 800 };
    const trigger = rect(60, 400, 30, 30); // centre x = 75
    const content = rect(0, 0, 300, 40); // wider than the 150 viewport
    const r = resolveCollision(trigger, content, narrow, 'top', 6);
    // centre-anchored left = 75 - 150 = -75 -> shift +75 lands left edge at 0
    expect(75 - content.width / 2 + r.shiftX).toBeGreaterThanOrEqual(0);
  });
});
