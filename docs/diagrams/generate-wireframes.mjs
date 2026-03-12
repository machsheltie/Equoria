/**
 * Excalidraw Wireframe Generator for Equoria Celestial Night
 * Generates 18 high-fidelity wireframes (9 screens × 2 breakpoints)
 *
 * Run: node docs/diagrams/generate-wireframes.mjs
 * Output: docs/diagrams/wireframe-2026-03-11.excalidraw
 */

import { writeFileSync } from 'fs';

// Theme from theme.json
const T = {
  bg: '#0a0e1a',
  container: '#1a2341',
  containerHover: '#243061',
  border: '#c9a84c',
  borderSubtle: '#2a3a6b',
  text: '#f5f0e8',
  textMuted: '#8b9dc3',
  textAccent: '#c9a84c',
  primary: '#3b82f6',
  primaryGlow: '#60a5fa',
  success: '#22c55e',
  warning: '#f59e0b',
  error: '#ef4444',
  glass: '#1a234188',
  glassBorder: '#c9a84c26',
};

let idCounter = 0;
const uid = () => `el-${++idCounter}`;
const elements = [];

// Snap to 20px grid
const snap = (v) => Math.round(v / 20) * 20;

// Text width calculation
const textWidth = (text, fontSize) => Math.ceil(text.length * fontSize * 0.6 + 20);

// Base element factory
function rect(x, y, w, h, opts = {}) {
  const id = uid();
  elements.push({
    id,
    type: 'rectangle',
    x: snap(x),
    y: snap(y),
    width: w,
    height: h,
    strokeColor: opts.stroke || T.border,
    backgroundColor: opts.fill || T.container,
    fillStyle: 'solid',
    strokeWidth: opts.strokeWidth || 1,
    roughness: 0,
    opacity: opts.opacity || 100,
    roundness: opts.radius ? { type: 3, value: opts.radius } : null,
    boundElements: [],
    groupIds: opts.groupIds || [],
    locked: false,
    isDeleted: false,
  });
  return id;
}

function ellipseEl(x, y, w, h, opts = {}) {
  const id = uid();
  elements.push({
    id,
    type: 'ellipse',
    x: snap(x),
    y: snap(y),
    width: w,
    height: h,
    strokeColor: opts.stroke || T.border,
    backgroundColor: opts.fill || T.container,
    fillStyle: 'solid',
    strokeWidth: opts.strokeWidth || 1,
    roughness: 0,
    opacity: opts.opacity || 100,
    boundElements: [],
    groupIds: opts.groupIds || [],
    locked: false,
    isDeleted: false,
  });
  return id;
}

function label(x, y, text, opts = {}) {
  const id = uid();
  const fontSize = opts.fontSize || 14;
  const w = opts.width || textWidth(text, fontSize);
  elements.push({
    id,
    type: 'text',
    x: snap(x),
    y: snap(y),
    width: w,
    height: fontSize + 8,
    text,
    fontSize,
    fontFamily: opts.fontFamily || 1, // 1=Virgil(hand), 3=Cascadia(mono), 4=Liberation(sans)
    textAlign: opts.align || 'left',
    verticalAlign: opts.vAlign || 'top',
    strokeColor: opts.color || T.text,
    containerId: opts.containerId || null,
    groupIds: opts.groupIds || [],
    boundElements: [],
    locked: false,
    isDeleted: false,
    lineHeight: 1.25,
    originalText: text,
  });
  return id;
}

function labelInShape(shapeId, text, opts = {}) {
  const gid = uid();
  const shape = elements.find((e) => e.id === shapeId);
  if (!shape) return;

  const fontSize = opts.fontSize || 14;
  const tid = uid();

  elements.push({
    id: tid,
    type: 'text',
    x: shape.x + 10,
    y: shape.y + (shape.height - fontSize - 8) / 2,
    width: shape.width - 20,
    height: fontSize + 8,
    text,
    fontSize,
    fontFamily: opts.fontFamily || 4,
    textAlign: opts.align || 'center',
    verticalAlign: 'middle',
    strokeColor: opts.color || T.text,
    containerId: shapeId,
    groupIds: [gid],
    boundElements: [],
    locked: false,
    isDeleted: false,
    lineHeight: 1.25,
    originalText: text,
  });

  shape.groupIds = [gid];
  shape.boundElements.push({ type: 'text', id: tid });
  return tid;
}

function line(x1, y1, x2, y2, opts = {}) {
  const id = uid();
  elements.push({
    id,
    type: 'line',
    x: snap(x1),
    y: snap(y1),
    width: x2 - x1,
    height: y2 - y1,
    strokeColor: opts.stroke || T.borderSubtle,
    strokeWidth: opts.strokeWidth || 1,
    roughness: 0,
    opacity: opts.opacity || 100,
    points: [
      [0, 0],
      [x2 - x1, y2 - y1],
    ],
    groupIds: opts.groupIds || [],
    boundElements: [],
    locked: false,
    isDeleted: false,
  });
  return id;
}

// Component builders
function button(x, y, text, variant = 'primary', opts = {}) {
  const w = opts.width || Math.max(120, textWidth(text, 14) + 20);
  const h = opts.height || 44;
  const fill =
    variant === 'primary'
      ? T.textAccent
      : variant === 'secondary'
        ? T.containerHover
        : variant === 'destructive'
          ? T.error
          : 'transparent';
  const stroke =
    variant === 'primary'
      ? T.textAccent
      : variant === 'secondary'
        ? T.borderSubtle
        : variant === 'destructive'
          ? T.error
          : T.textMuted;
  const textColor = variant === 'primary' ? T.bg : variant === 'tertiary' ? T.textMuted : T.text;

  const sid = rect(x, y, w, h, { fill, stroke, radius: 22, ...opts });
  labelInShape(sid, text, { color: textColor, fontSize: 13 });
  return sid;
}

function inputField(x, y, placeholder, opts = {}) {
  const w = opts.width || 280;
  const h = opts.height || 44;
  const sid = rect(x, y, w, h, { fill: '#0a0e1a', stroke: T.borderSubtle, radius: 8 });
  labelInShape(sid, placeholder, { color: T.textMuted, fontSize: 13, align: 'left' });
  return sid;
}

function card(x, y, w, h, opts = {}) {
  return rect(x, y, w, h, { fill: T.glass, stroke: T.borderSubtle, radius: 12, ...opts });
}

function badge(x, y, text, opts = {}) {
  const w = textWidth(text, 11) + 10;
  const sid = rect(x, y, w, 24, {
    fill: opts.fill || T.containerHover,
    stroke: opts.stroke || T.borderSubtle,
    radius: 12,
  });
  labelInShape(sid, text, { fontSize: 11, color: opts.color || T.textMuted });
  return sid;
}

function sectionTitle(x, y, text) {
  return label(x, y, text, { fontSize: 18, color: T.textAccent, fontFamily: 4 });
}

function annotation(x, y, text) {
  return label(x, y, text, { fontSize: 11, color: T.warning, fontFamily: 3 });
}

function deviceFrame(x, y, w, h, title) {
  // Title label above frame
  label(x, y - 40, title, { fontSize: 16, color: T.textAccent, fontFamily: 4 });
  // Device frame
  return rect(x, y, w, h, { fill: T.bg, stroke: T.border, strokeWidth: 2, radius: 8 });
}

function topBar(x, y, w, items = {}) {
  const h = 60;
  const barId = rect(x, y, w, h, { fill: T.container, stroke: T.borderSubtle });

  if (items.logo)
    label(x + 16, y + 18, items.logo, { fontSize: 18, color: T.textAccent, fontFamily: 4 });
  if (items.hamburger) label(x + 16, y + 18, '☰', { fontSize: 20, color: T.text });
  if (items.coins) badge(x + w - 200, y + 18, '🪙 1,250', { fill: T.containerHover });
  if (items.bell) label(x + w - 80, y + 18, '🔔', { fontSize: 18, color: T.text });
  if (items.avatar)
    ellipseEl(x + w - 48, y + 14, 32, 32, { fill: T.containerHover, stroke: T.borderSubtle });
  if (items.search) inputField(x + w / 2 - 140, y + 10, '🔍 Search...', { width: 280, height: 40 });

  line(x, y + h, x + w, y + h, { stroke: T.borderSubtle });
  return barId;
}

function bottomNav(x, y, w, items = ['Home', 'Stable', 'Train', 'Compete', 'More']) {
  const h = 56;
  const barId = rect(x, y, w, h, { fill: T.container, stroke: T.borderSubtle });
  line(x, y, x + w, y, { stroke: T.borderSubtle });

  const itemWidth = w / items.length;
  items.forEach((item, i) => {
    const ix = x + i * itemWidth + itemWidth / 2 - 20;
    label(ix, y + 8, '●', {
      fontSize: 16,
      color: i === 0 ? T.textAccent : T.textMuted,
      align: 'center',
    });
    label(ix - 4, y + 30, item, {
      fontSize: 10,
      color: i === 0 ? T.textAccent : T.textMuted,
      align: 'center',
    });
  });
  return barId;
}

// ==========================================
// SCREEN 1: HUB DASHBOARD
// ==========================================

function buildHubDesktop(ox, oy) {
  deviceFrame(ox, oy, 1440, 900, 'Hub Dashboard — Desktop (1440×900)');
  topBar(ox, oy, 1440, { logo: '✦ EQUORIA', coins: true, bell: true, avatar: true, search: true });

  // Left sidebar
  const sideW = 240;
  rect(ox, oy + 60, sideW, 840, { fill: T.container, stroke: T.borderSubtle });
  const navItems = [
    '🏠 Home',
    '🐴 My Stable',
    '🎯 Training',
    '💕 Breeding',
    '🏆 Competitions',
    '🌍 World',
    '🛒 Marketplace',
    '👥 Community',
    '📊 Leaderboards',
    '⚙️ Settings',
  ];
  navItems.forEach((item, i) => {
    if (i === 0)
      rect(ox, oy + 60 + i * 44, sideW, 44, { fill: T.containerHover, stroke: 'transparent' });
    label(ox + 20, oy + 72 + i * 44, item, {
      fontSize: 13,
      color: i === 0 ? T.textAccent : T.text,
    });
  });
  annotation(ox + 4, oy + 60 + navItems.length * 44 + 8, '← Active: gold left border');

  // NextActionsBar
  const contentX = ox + sideW + 20;
  const _contentW = 1440 - sideW - 300;
  sectionTitle(contentX, oy + 80, 'What to do next');
  annotation(contentX + 200, oy + 80, '← NextActionsBar (server-seeded priorities)');

  const actions = [
    {
      icon: '🎯',
      title: 'Train Luna',
      desc: 'Cooldown ended — Dressage recommended',
      priority: true,
    },
    { icon: '🏆', title: 'Check Results', desc: '3 show results from overnight' },
    { icon: '🐴', title: 'Groom Foal', desc: 'Star is 8 weeks — enrichment available' },
    { icon: '💰', title: 'Claim Prizes', desc: '2 unclaimed competition prizes' },
  ];

  actions.forEach((a, i) => {
    const cx = contentX + i * 220;
    const _cid = card(cx, oy + 120, 200, 100);
    if (a.priority) {
      // Gold border on top priority
      elements.find((e) => e.id === cid).strokeColor = T.textAccent;
      annotation(cx, oy + 230, '↑ Gold border = top priority');
    }
    label(cx + 16, oy + 130, `${a.icon} ${a.title}`, { fontSize: 14, color: T.text });
    label(cx + 16, oy + 155, a.desc, { fontSize: 11, color: T.textMuted, width: 170 });
  });

  // Stable card grid (2 columns)
  sectionTitle(contentX, oy + 260, 'Your Stable');

  const horses = [
    { name: 'Luna', breed: 'Andalusian', chip: '✅ Ready to train!' },
    { name: 'Storm', breed: 'Thoroughbred', chip: '🏆 3 results pending' },
    { name: 'Star ⭐', breed: 'Arabian Foal', chip: '🐴 8 weeks — groom available' },
    { name: 'Thunder', breed: 'Quarter Horse', chip: '⏳ Cooldown: 2d 14h' },
  ];

  horses.forEach((h, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const hx = contentX + col * 440;
    const hy = oy + 300 + row * 180;

    const _hid = card(hx, hy, 420, 160);
    // Horse portrait placeholder
    rect(hx + 12, hy + 12, 100, 136, { fill: T.containerHover, stroke: T.borderSubtle, radius: 8 });
    label(hx + 30, hy + 60, '🐎', { fontSize: 40 });

    // Horse info
    label(hx + 128, hy + 16, h.name, { fontSize: 16, color: T.text, fontFamily: 4 });
    label(hx + 128, hy + 40, h.breed, { fontSize: 12, color: T.textMuted });

    // NarrativeChip
    badge(hx + 128, hy + 64, h.chip, { fill: T.containerHover, stroke: T.borderSubtle });
    annotation(hx + 128, hy + 96, '← NarrativeChip (contextual)');

    // Care status strip
    rect(hx + 128, hy + 120, 280, 6, { fill: T.success, stroke: 'transparent', radius: 3 });
    label(hx + 128, hy + 132, 'Care: Good', { fontSize: 10, color: T.textMuted });
  });

  // Right aside panel
  const asideX = ox + 1440 - 280;
  rect(asideX, oy + 60, 280, 840, { fill: T.container, stroke: T.borderSubtle });
  sectionTitle(asideX + 16, oy + 80, 'Quick View');
  annotation(asideX + 16, oy + 105, 'Aside panel (desktop only)');

  // Quick horse preview
  card(asideX + 12, oy + 130, 256, 200);
  label(asideX + 28, oy + 140, 'Luna — Andalusian', { fontSize: 14, color: T.text });
  label(asideX + 28, oy + 164, 'Age: 5yr  |  Level: 7', { fontSize: 12, color: T.textMuted });

  // Stat bars in aside
  const stats = ['Speed', 'Stamina', 'Agility', 'Balance'];
  stats.forEach((s, i) => {
    const sy = oy + 192 + i * 28;
    label(asideX + 28, sy, s, { fontSize: 11, color: T.textMuted });
    rect(asideX + 100, sy + 2, 140, 12, { fill: T.bg, stroke: T.borderSubtle, radius: 6 });
    rect(asideX + 100, sy + 2, 70 + i * 15, 12, {
      fill: T.primary,
      stroke: 'transparent',
      radius: 6,
    });
  });

  // Cooldown timers
  label(asideX + 28, oy + 350, 'Cooldowns', { fontSize: 14, color: T.textAccent });
  label(asideX + 28, oy + 375, '🎯 Training: 2d 14h', { fontSize: 12, color: T.warning });
  label(asideX + 28, oy + 395, '💕 Breeding: Ready ✅', { fontSize: 12, color: T.success });
  annotation(asideX + 28, oy + 420, '← CooldownTimer components');

  // Recent activity
  label(asideX + 28, oy + 460, 'Recent Activity', { fontSize: 14, color: T.textAccent });
  const activities = [
    'Luna placed 2nd in Dressage',
    'Star bonded +5 with groom',
    'Thunder finished training',
  ];
  activities.forEach((a, i) => {
    label(asideX + 28, oy + 490 + i * 24, `• ${a}`, {
      fontSize: 11,
      color: T.textMuted,
      width: 230,
    });
  });
}

function buildHubMobile(ox, oy) {
  deviceFrame(ox, oy, 375, 812, 'Hub Dashboard — Mobile (375×812)');
  topBar(ox, oy, 375, { hamburger: true, coins: true, bell: true });

  // NextActionsBar (horizontal scroll)
  label(ox + 16, oy + 72, 'What to do next', { fontSize: 14, color: T.textAccent });
  annotation(ox + 180, oy + 72, '← scroll →');

  const mActions = [
    { icon: '🎯', title: 'Train Luna', priority: true },
    { icon: '🏆', title: 'Results', priority: false },
    { icon: '🐴', title: 'Groom Star', priority: false },
  ];
  mActions.forEach((a, i) => {
    const _cid = card(ox + 16 + i * 130, oy + 96, 120, 72);
    if (a.priority) elements.find((e) => e.id === cid).strokeColor = T.textAccent;
    label(ox + 28 + i * 130, oy + 106, a.icon, { fontSize: 20 });
    label(ox + 28 + i * 130, oy + 136, a.title, { fontSize: 12, color: T.text });
  });

  // Single-column horse cards
  label(ox + 16, oy + 188, 'Your Stable', { fontSize: 14, color: T.textAccent });

  const mHorses = [
    { name: 'Luna', breed: 'Andalusian', chip: '✅ Ready to train!' },
    { name: 'Storm', breed: 'Thoroughbred', chip: '🏆 3 results' },
    { name: 'Star ⭐', breed: 'Arabian Foal', chip: '🐴 Groom available' },
    { name: 'Thunder', breed: 'Quarter Horse', chip: '⏳ 2d 14h' },
  ];

  mHorses.forEach((h, i) => {
    const hy = oy + 212 + i * 120;
    card(ox + 16, hy, 343, 108);
    rect(ox + 28, hy + 10, 68, 88, { fill: T.containerHover, stroke: T.borderSubtle, radius: 8 });
    label(ox + 44, hy + 36, '🐎', { fontSize: 28 });
    label(ox + 108, hy + 14, h.name, { fontSize: 14, color: T.text });
    label(ox + 108, hy + 34, h.breed, { fontSize: 11, color: T.textMuted });
    badge(ox + 108, hy + 56, h.chip);
    rect(ox + 108, hy + 88, 224, 4, { fill: T.success, stroke: 'transparent', radius: 2 });
  });

  // Bottom sheet indicator
  rect(ox + 140, oy + 700, 95, 4, { fill: T.textMuted, stroke: 'transparent', radius: 2 });
  annotation(ox + 100, oy + 712, '↑ Swipe up: bottom sheet');

  bottomNav(ox, oy + 756, 375);
}

// ==========================================
// SCREEN 2: WHILE YOU WERE GONE
// ==========================================

function buildWYAGDesktop(ox, oy) {
  deviceFrame(ox, oy, 1440, 900, 'WhileYouWereGone — Desktop (1440×900)');
  // Dark scrim
  rect(ox, oy, 1440, 900, { fill: '#000000', stroke: 'transparent', opacity: 70 });

  // Centered glass panel
  const pw = 600,
    ph = 640;
  const px = ox + (1440 - pw) / 2;
  const py = oy + (900 - ph) / 2;

  card(px, py, pw, ph, { stroke: T.border });
  label(px + pw - 40, py + 12, '✕', { fontSize: 18, color: T.textMuted });

  sectionTitle(px + 24, py + 20, 'While You Were Gone...');
  label(px + 24, py + 52, "Here's what happened since you left", {
    fontSize: 13,
    color: T.textMuted,
  });
  annotation(px + pw + 16, py + 20, '← Cinzel heading, gold');

  // Priority items
  const wyagItems = [
    {
      icon: '🏆',
      type: 'Competition',
      text: 'Luna placed 2nd in Grand Dressage Championship!',
      badge: 'Won 450 coins',
    },
    { icon: '🏆', type: 'Competition', text: 'Storm placed 5th in Sprint Racing Open', badge: '' },
    {
      icon: '⭐',
      type: 'Foal Milestone',
      text: 'Star reached bond level 50 — trait revealed!',
      badge: 'BRAVE',
    },
    { icon: '✉️', type: 'Message', text: '2 new messages from club members', badge: '' },
    { icon: '🛡️', type: 'Club', text: 'Dressage Masters election results are in', badge: '' },
    {
      icon: '🎯',
      type: 'Training',
      text: "Thunder's training cooldown has ended",
      badge: 'Ready!',
    },
  ];

  wyagItems.forEach((item, i) => {
    const iy = py + 84 + i * 76;
    card(px + 20, iy, pw - 40, 64);
    label(px + 36, iy + 8, item.icon, { fontSize: 20 });
    badge(px + 64, iy + 8, item.type, { fill: T.containerHover });
    label(px + 36, iy + 36, item.text, { fontSize: 13, color: T.text, width: pw - 100 });
    if (item.badge) badge(px + pw - 120, iy + 8, item.badge, { fill: T.textAccent, color: T.bg });
  });

  annotation(px + pw + 16, py + 84, '← Priority-sorted (competitions first)');
  annotation(px + pw + 16, py + 160, '← Max 8 items');

  // Continue button
  button(px + pw / 2 - 100, py + ph - 60, 'Continue to Stable →', 'primary', { width: 200 });
}

function buildWYAGMobile(ox, oy) {
  deviceFrame(ox, oy, 375, 812, 'WhileYouWereGone — Mobile (375×812)');
  rect(ox, oy, 375, 812, { fill: T.bg, stroke: T.border, radius: 8 });

  // Full-screen glass panel
  sectionTitle(ox + 20, oy + 40, 'While You Were Gone...');
  label(ox + 20, oy + 70, "Here's what happened", { fontSize: 12, color: T.textMuted });

  const mItems = [
    { icon: '🏆', text: 'Luna placed 2nd — 450 coins!' },
    { icon: '🏆', text: 'Storm placed 5th in Sprint Racing' },
    { icon: '⭐', text: 'Star bond 50 — BRAVE trait!' },
    { icon: '✉️', text: '2 new messages' },
    { icon: '🛡️', text: 'Club election results' },
    { icon: '🎯', text: 'Thunder ready to train' },
  ];

  mItems.forEach((item, i) => {
    const iy = oy + 100 + i * 68;
    card(ox + 16, iy, 343, 56);
    label(ox + 32, iy + 16, `${item.icon}  ${item.text}`, {
      fontSize: 13,
      color: T.text,
      width: 310,
    });
  });

  // Sticky continue button
  button(ox + 16, oy + 740, 'Continue →', 'primary', { width: 343 });
  annotation(ox + 16, oy + 720, '↓ Sticky bottom');
}

// ==========================================
// SCREEN 3: ONBOARDING WIZARD
// ==========================================

function buildOnboardingDesktop(ox, oy) {
  deviceFrame(ox, oy, 1440, 900, 'Onboarding Wizard (Step 2: BreedSelector) — Desktop');
  rect(ox, oy, 1440, 900, { fill: T.bg, stroke: T.border, strokeWidth: 2, radius: 8 });

  // Step indicator
  const steps = ['Welcome', 'Choose Your Horse', 'Ready'];
  steps.forEach((s, i) => {
    const sx = ox + 1440 / 2 - 180 + i * 140;
    ellipseEl(sx, oy + 20, 24, 24, {
      fill: i === 1 ? T.textAccent : T.containerHover,
      stroke: i === 1 ? T.textAccent : T.borderSubtle,
    });
    label(sx - 16, oy + 52, s, {
      fontSize: 11,
      color: i === 1 ? T.textAccent : T.textMuted,
      align: 'center',
      width: 60,
    });
    if (i < 2) line(sx + 28, oy + 32, sx + 120, oy + 32, { stroke: T.borderSubtle });
  });

  // BreedSelector title
  sectionTitle(ox + 60, oy + 100, 'Choose Your First Horse');
  label(ox + 60, oy + 130, 'Select a breed, choose gender, and name your companion', {
    fontSize: 14,
    color: T.textMuted,
  });

  // Breed grid (3 columns)
  const breeds = [
    {
      name: 'Arabian',
      stats: 'Speed ★★★ | Stamina ★★★',
      lore: 'Ancient desert breed, elegant and spirited',
    },
    {
      name: 'Thoroughbred',
      stats: 'Speed ★★★★ | Agility ★★',
      lore: 'Born to race, powerful and competitive',
    },
    {
      name: 'Andalusian',
      stats: 'Balance ★★★ | Precision ★★★',
      lore: 'Noble Iberian horse, graceful in dressage',
    },
    {
      name: 'Quarter Horse',
      stats: 'Speed ★★★ | Agility ★★★',
      lore: 'Versatile American breed, quick bursts',
    },
    {
      name: 'Friesian',
      stats: 'Stamina ★★★ | Balance ★★★',
      lore: 'Majestic black beauty, powerful presence',
    },
    {
      name: 'Saddlebred',
      stats: 'Flexibility ★★★★ | Balance ★★',
      lore: 'High-stepping show horse, animated gaits',
    },
  ];

  breeds.forEach((b, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const bx = ox + 60 + col * 300;
    const by = oy + 170 + row * 220;

    const _cid = card(bx, by, 280, 200);
    if (i === 2) elements.find((e) => e.id === cid).strokeColor = T.textAccent; // Selected

    // Portrait placeholder
    rect(bx + 10, by + 10, 260, 80, { fill: T.containerHover, stroke: T.borderSubtle, radius: 8 });
    label(bx + 110, by + 30, '🐎', { fontSize: 36 });

    label(bx + 16, by + 100, b.name, { fontSize: 16, color: T.text, fontFamily: 4 });
    label(bx + 16, by + 124, b.stats, { fontSize: 11, color: T.textMuted });
    label(bx + 16, by + 148, b.lore, { fontSize: 11, color: T.textMuted, width: 250 });

    if (i === 2) annotation(bx + 290, by + 10, '← Selected (gold border)');
  });

  // Right side: Preview + Gender + Name
  const previewX = ox + 980;
  card(previewX, oy + 170, 400, 500);
  sectionTitle(previewX + 20, oy + 184, 'Your Horse Preview');

  // Portrait
  rect(previewX + 20, oy + 220, 360, 160, {
    fill: T.containerHover,
    stroke: T.borderSubtle,
    radius: 12,
  });
  label(previewX + 160, oy + 270, '🐎', { fontSize: 60 });

  // Gender toggle
  label(previewX + 20, oy + 400, 'Gender', { fontSize: 13, color: T.textMuted });
  button(previewX + 20, oy + 420, '♀ Mare', 'secondary', { width: 170 });
  button(previewX + 210, oy + 420, '♂ Stallion', 'primary', { width: 170 });
  annotation(previewX + 410, oy + 420, '← Gender toggle');

  // Name input
  label(previewX + 20, oy + 480, 'Name Your Horse', { fontSize: 13, color: T.textMuted });
  inputField(previewX + 20, oy + 504, 'Enter a name...', { width: 360 });

  // Preview card
  label(previewX + 20, oy + 564, 'Andalusian Stallion', { fontSize: 16, color: T.text });
  label(previewX + 20, oy + 588, '"Moonlight Sonata"', { fontSize: 14, color: T.textAccent });
  annotation(previewX + 410, oy + 564, '← Live preview');

  // CTA
  button(ox + 1440 / 2 - 100, oy + 840, 'Choose This Horse →', 'primary', { width: 220 });
}

function buildOnboardingMobile(ox, oy) {
  deviceFrame(ox, oy, 375, 812, 'Onboarding (Step 2) — Mobile');
  rect(ox, oy, 375, 812, { fill: T.bg, stroke: T.border, radius: 8 });

  // Step dots
  [0, 1, 2].forEach((i) => {
    ellipseEl(ox + 150 + i * 30, oy + 16, 16, 16, {
      fill: i === 1 ? T.textAccent : T.containerHover,
      stroke: T.borderSubtle,
    });
  });

  label(ox + 16, oy + 48, 'Choose Your First Horse', { fontSize: 16, color: T.textAccent });

  // Scrollable breed list (single column)
  const mBreeds = ['Arabian', 'Thoroughbred', 'Andalusian ✓', 'Quarter Horse', 'Friesian'];
  mBreeds.forEach((b, i) => {
    const by = oy + 80 + i * 72;
    const _cid = card(ox + 16, by, 343, 64);
    if (i === 2) elements.find((e) => e.id === cid).strokeColor = T.textAccent;
    rect(ox + 28, by + 8, 48, 48, { fill: T.containerHover, stroke: T.borderSubtle, radius: 8 });
    label(ox + 40, by + 20, '🐎', { fontSize: 20 });
    label(ox + 88, by + 12, b, { fontSize: 14, color: T.text });
    label(ox + 88, by + 34, 'Speed ★★★ | Balance ★★★', { fontSize: 10, color: T.textMuted });
  });

  // Gender toggle
  label(ox + 16, oy + 452, 'Gender', { fontSize: 12, color: T.textMuted });
  button(ox + 16, oy + 472, '♀ Mare', 'secondary', { width: 165 });
  button(ox + 194, oy + 472, '♂ Stallion', 'primary', { width: 165 });

  // Name input
  label(ox + 16, oy + 528, 'Name', { fontSize: 12, color: T.textMuted });
  inputField(ox + 16, oy + 548, 'Enter a name...', { width: 343 });

  // Preview
  card(ox + 16, oy + 608, 343, 80);
  label(ox + 32, oy + 620, 'Andalusian Stallion', { fontSize: 14, color: T.text });
  label(ox + 32, oy + 644, '"Moonlight Sonata"', { fontSize: 13, color: T.textAccent });

  // CTA
  button(ox + 16, oy + 708, 'Choose This Horse →', 'primary', { width: 343 });
}

// ==========================================
// SCREEN 4: TRAINING PAGE
// ==========================================

function buildTrainingDesktop(ox, oy) {
  deviceFrame(ox, oy, 1440, 900, 'Training Page — Desktop (1440×900)');
  topBar(ox, oy, 1440, { logo: '✦ EQUORIA', coins: true, bell: true, avatar: true });

  // Left panel: Horse selector
  const leftW = 320;
  rect(ox, oy + 60, leftW, 840, { fill: T.container, stroke: T.borderSubtle });
  sectionTitle(ox + 16, oy + 76, 'Select Horse');
  annotation(ox + 160, oy + 76, '← Eligible first');

  const trainHorses = [
    { name: 'Luna', status: '✅ Eligible', eligible: true },
    { name: 'Thunder', status: '✅ Eligible', eligible: true },
    { name: 'Storm', status: '⏳ Cooldown: 5d', eligible: false },
    { name: 'Star', status: '🔒 Age: 8wk (min 3yr)', eligible: false },
  ];

  trainHorses.forEach((h, i) => {
    const hy = oy + 108 + i * 80;
    const _cid = card(ox + 12, hy, leftW - 24, 68);
    if (i === 0) elements.find((e) => e.id === cid).strokeColor = T.textAccent;
    if (!h.eligible) elements.find((e) => e.id === cid).opacity = 50;
    label(ox + 28, hy + 12, h.name, { fontSize: 14, color: h.eligible ? T.text : T.textMuted });
    label(ox + 28, hy + 34, h.status, {
      fontSize: 11,
      color: h.eligible ? T.success : T.textMuted,
    });
  });

  // Center: DisciplineSelector
  const centerX = ox + leftW + 20;
  const centerW = 1440 - leftW - 340;
  sectionTitle(centerX, oy + 76, 'Choose Discipline');
  label(centerX, oy + 102, 'Recommended for Luna (based on stats)', {
    fontSize: 12,
    color: T.textMuted,
  });
  annotation(centerX + 320, oy + 102, '← Server-ranked recommendations');

  const disciplines = [
    { name: 'Dressage', match: '★★★★★', stats: 'Precision +3, Balance +2', icon: '🎩', top: true },
    { name: 'Show Jumping', match: '★★★★', stats: 'Agility +3, Boldness +1', icon: '🏇' },
    { name: 'Western Pleasure', match: '★★★★', stats: 'Balance +2, Obedience +2', icon: '🤠' },
    { name: 'Eventing', match: '★★★', stats: 'Stamina +2, Agility +2', icon: '🏔️' },
    { name: 'Cross Country', match: '★★★', stats: 'Stamina +2, Boldness +2', icon: '🌲' },
  ];

  disciplines.forEach((d, i) => {
    const dy = oy + 132 + i * 88;
    const _cid = card(centerX, dy, centerW, 76);
    if (d.top) {
      elements.find((e) => e.id === cid).strokeColor = T.textAccent;
      badge(centerX + centerW - 100, dy + 8, '⭐ Best Match', { fill: T.textAccent, color: T.bg });
    }
    label(centerX + 16, dy + 12, `${d.icon} ${d.name}`, { fontSize: 15, color: T.text });
    label(centerX + 16, dy + 36, `Match: ${d.match}`, { fontSize: 12, color: T.textAccent });
    label(centerX + 200, dy + 36, `Stat gain: ${d.stats}`, { fontSize: 12, color: T.textMuted });
    annotation(centerX + centerW + 8, dy + 12, i === 0 ? '← Stat impact preview' : '');
  });

  // "Show All 24 Disciplines" expandable
  button(centerX + centerW / 2 - 100, oy + 580, 'Show All 24 Disciplines ▼', 'tertiary', {
    width: 220,
  });

  // Right panel: Horse stats + cooldown
  const rightX = ox + 1440 - 320;
  rect(rightX, oy + 60, 320, 840, { fill: T.container, stroke: T.borderSubtle });
  sectionTitle(rightX + 16, oy + 76, 'Luna — Stats');

  const trainStats = [
    { name: 'Speed', val: 72 },
    { name: 'Stamina', val: 68 },
    { name: 'Agility', val: 65 },
    { name: 'Balance', val: 81 },
    { name: 'Precision', val: 85 },
    { name: 'Intelligence', val: 70 },
  ];
  trainStats.forEach((s, i) => {
    const sy = oy + 108 + i * 32;
    label(rightX + 16, sy, s.name, { fontSize: 12, color: T.textMuted });
    rect(rightX + 100, sy + 2, 180, 14, { fill: T.bg, stroke: T.borderSubtle, radius: 7 });
    rect(rightX + 100, sy + 2, Math.round((180 * s.val) / 100), 14, {
      fill: T.primary,
      stroke: 'transparent',
      radius: 7,
    });
    label(rightX + 288, sy, `${s.val}`, { fontSize: 11, color: T.text });
  });

  // CooldownTimer
  card(rightX + 12, oy + 320, 296, 80);
  label(rightX + 28, oy + 332, '⏱️ Training Cooldown', { fontSize: 13, color: T.textMuted });
  label(rightX + 28, oy + 356, 'Ready to train! ✅', { fontSize: 16, color: T.success });
  annotation(rightX + 320, oy + 332, '← CooldownTimer');

  // Train button
  button(rightX + 40, oy + 440, '🎯 Train in Dressage', 'primary', { width: 240 });
}

function buildTrainingMobile(ox, oy) {
  deviceFrame(ox, oy, 375, 812, 'Training — Mobile (375×812)');
  topBar(ox, oy, 375, { hamburger: true, coins: true, bell: true });

  // Horse selector: horizontal scroll
  label(ox + 16, oy + 72, 'Select Horse', { fontSize: 13, color: T.textAccent });
  ['Luna ✅', 'Thunder ✅', 'Storm ⏳'].forEach((h, i) => {
    const _cid = card(ox + 16 + i * 110, oy + 92, 100, 52);
    if (i === 0) elements.find((e) => e.id === cid).strokeColor = T.textAccent;
    label(ox + 28 + i * 110, oy + 108, h, { fontSize: 11, color: T.text });
  });
  annotation(ox + 16, oy + 152, '← Horizontal scroll, eligible first');

  // CooldownTimer
  card(ox + 16, oy + 172, 343, 44);
  label(ox + 32, oy + 182, '⏱️ Ready to train! ✅', { fontSize: 13, color: T.success });

  // Discipline cards
  label(ox + 16, oy + 228, 'Recommended for Luna', { fontSize: 13, color: T.textAccent });
  const mDisc = [
    { name: '🎩 Dressage', match: '★★★★★', stats: 'Precision +3, Balance +2', top: true },
    { name: '🏇 Show Jumping', match: '★★★★', stats: 'Agility +3, Boldness +1' },
    { name: '🤠 Western Pleasure', match: '★★★★', stats: 'Balance +2, Obedience +2' },
  ];
  mDisc.forEach((d, i) => {
    const dy = oy + 252 + i * 80;
    const _cid = card(ox + 16, dy, 343, 68);
    if (d.top) elements.find((e) => e.id === cid).strokeColor = T.textAccent;
    label(ox + 32, dy + 10, d.name, { fontSize: 14, color: T.text });
    label(ox + 32, dy + 32, `${d.match}  |  ${d.stats}`, { fontSize: 11, color: T.textMuted });
    if (d.top) badge(ox + 270, dy + 8, '⭐ Best', { fill: T.textAccent, color: T.bg });
  });

  button(ox + 16, oy + 510, 'Show All 24 ▼', 'tertiary', { width: 343 });

  // Sticky train button
  button(ox + 16, oy + 700, '🎯 Train in Dressage', 'primary', { width: 343 });
  bottomNav(ox, oy + 756, 375);
}

// ==========================================
// SCREEN 5: COMPETITION PAGE
// ==========================================

function buildCompetitionDesktop(ox, oy) {
  deviceFrame(ox, oy, 1440, 900, 'Competition Page — Desktop (1440×900)');
  topBar(ox, oy, 1440, { logo: '✦ EQUORIA', coins: true, bell: true, avatar: true });

  // Tab bar
  const tabs = ['Browse Shows', 'My Entries', 'Results'];
  tabs.forEach((t, i) => {
    const tx = ox + 100 + i * 180;
    label(tx, oy + 76, t, { fontSize: 14, color: i === 0 ? T.textAccent : T.textMuted });
    if (i === 0) rect(tx, oy + 98, 120, 3, { fill: T.textAccent, stroke: 'transparent' });
  });
  annotation(ox + 640, oy + 76, '← Active tab: gold underline');

  // Filter bar
  rect(ox + 20, oy + 116, 1400, 52, { fill: T.container, stroke: T.borderSubtle, radius: 8 });
  label(ox + 36, oy + 132, 'Discipline:', { fontSize: 12, color: T.textMuted });
  rect(ox + 120, oy + 124, 160, 36, { fill: T.bg, stroke: T.borderSubtle, radius: 8 });
  label(ox + 136, oy + 132, 'All Disciplines ▼', { fontSize: 12, color: T.text });
  label(ox + 320, oy + 132, 'Closing:', { fontSize: 12, color: T.textMuted });
  rect(ox + 400, oy + 124, 140, 36, { fill: T.bg, stroke: T.borderSubtle, radius: 8 });
  label(ox + 416, oy + 132, 'This Week ▼', { fontSize: 12, color: T.text });
  label(ox + 580, oy + 132, 'Entry Fee:', { fontSize: 12, color: T.textMuted });
  rect(ox + 672, oy + 124, 120, 36, { fill: T.bg, stroke: T.borderSubtle, radius: 8 });
  label(ox + 688, oy + 132, '0 - 500 ▼', { fontSize: 12, color: T.text });

  // Show cards (2 columns)
  const shows = [
    {
      name: 'Grand Dressage Championship',
      disc: 'Dressage',
      entries: '12/20',
      fee: '100',
      closes: '3d 14h',
      status: 'open',
    },
    {
      name: 'Sprint Racing Open',
      disc: 'Racing',
      entries: '8/15',
      fee: '50',
      closes: '5d 2h',
      status: 'open',
    },
    {
      name: 'Jumping Masters Cup',
      disc: 'Show Jumping',
      entries: '18/20',
      fee: '200',
      closes: '1d 8h',
      status: 'closing-soon',
    },
    {
      name: 'Western Pleasure Classic',
      disc: 'Western Pleasure',
      entries: '5/15',
      fee: '75',
      closes: '6d 20h',
      status: 'open',
    },
  ];

  shows.forEach((s, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const sx = ox + 20 + col * 700;
    const sy = oy + 184 + row * 200;

    const _cid = card(sx, sy, 680, 180);

    label(sx + 16, sy + 12, s.name, { fontSize: 16, color: T.text, fontFamily: 4 });
    badge(sx + 16, sy + 40, s.disc);
    badge(sx + 140, sy + 40, `${s.entries} entered`);
    badge(sx + 280, sy + 40, `🪙 ${s.fee} fee`);

    // Closing countdown
    label(sx + 16, sy + 76, `Closes in: ${s.closes}`, {
      fontSize: 13,
      color: s.status === 'closing-soon' ? T.warning : T.textMuted,
    });
    if (s.status === 'closing-soon') annotation(sx + 240, sy + 76, '← Warning: closing soon');

    // Progress bar (days remaining out of 7)
    rect(sx + 16, sy + 100, 400, 8, { fill: T.bg, stroke: T.borderSubtle, radius: 4 });
    const progress = s.status === 'closing-soon' ? 340 : 200;
    rect(sx + 16, sy + 100, progress, 8, {
      fill: s.status === 'closing-soon' ? T.warning : T.primary,
      stroke: 'transparent',
      radius: 4,
    });
    annotation(sx + 420, sy + 96, '← 7-day entry window progress');

    // Actions
    button(sx + 16, sy + 124, 'Scout Field 🔍', 'secondary', { width: 140 });
    button(sx + 172, sy + 124, 'Enter Horse →', 'primary', { width: 140 });
  });

  annotation(
    ox + 1420,
    oy + 184,
    '← CompetitionFieldPreview\n   opens as slide-in panel\n   on "Scout Field" click'
  );
}

function buildCompetitionMobile(ox, oy) {
  deviceFrame(ox, oy, 375, 812, 'Competition — Mobile (375×812)');
  topBar(ox, oy, 375, { hamburger: true, coins: true, bell: true });

  // Tabs
  ['Browse', 'Entries', 'Results'].forEach((t, i) => {
    label(ox + 16 + i * 120, oy + 68, t, {
      fontSize: 13,
      color: i === 0 ? T.textAccent : T.textMuted,
    });
    if (i === 0)
      rect(ox + 16 + i * 120, oy + 86, 60, 2, { fill: T.textAccent, stroke: 'transparent' });
  });

  // Collapsible filter
  rect(ox + 16, oy + 96, 343, 36, { fill: T.container, stroke: T.borderSubtle, radius: 8 });
  label(ox + 32, oy + 104, '🔍 Filters ▼', { fontSize: 12, color: T.textMuted });

  // Show cards (single column)
  const mShows = [
    { name: 'Grand Dressage Championship', disc: 'Dressage', entries: '12/20', closes: '3d 14h' },
    { name: 'Sprint Racing Open', disc: 'Racing', entries: '8/15', closes: '5d 2h' },
    { name: 'Jumping Masters Cup', disc: 'Show Jumping', entries: '18/20', closes: '1d 8h' },
  ];

  mShows.forEach((s, i) => {
    const sy = oy + 144 + i * 160;
    card(ox + 16, sy, 343, 140);
    label(ox + 32, sy + 10, s.name, { fontSize: 14, color: T.text });
    badge(ox + 32, sy + 34, s.disc);
    badge(ox + 140, sy + 34, `${s.entries}`);
    label(ox + 32, sy + 68, `Closes: ${s.closes}`, { fontSize: 12, color: T.textMuted });
    rect(ox + 32, sy + 88, 311, 6, { fill: T.bg, stroke: T.borderSubtle, radius: 3 });
    rect(ox + 32, sy + 88, 180, 6, { fill: T.primary, stroke: 'transparent', radius: 3 });
    button(ox + 32, sy + 104, 'Scout', 'secondary', { width: 140 });
    button(ox + 192, sy + 104, 'Enter →', 'primary', { width: 151 });
  });

  bottomNav(ox, oy + 756, 375);
}

// ==========================================
// SCREEN 6: BREEDING PAGE
// ==========================================

function buildBreedingDesktop(ox, oy) {
  deviceFrame(ox, oy, 1440, 900, 'Breeding Page — Desktop (1440×900)');
  topBar(ox, oy, 1440, { logo: '✦ EQUORIA', coins: true, bell: true, avatar: true });

  sectionTitle(ox + 20, oy + 76, 'Breeding Center');

  // Bidirectional selectors
  // Mare selector (left)
  card(ox + 20, oy + 112, 380, 440);
  label(ox + 36, oy + 124, 'Select Mare', { fontSize: 15, color: T.textAccent });

  const mares = ['Luna (Andalusian, 5yr)', 'Bella (Arabian, 7yr)', 'Starlight (Friesian, 4yr)'];
  mares.forEach((m, i) => {
    const my = oy + 156 + i * 56;
    const _cid = card(ox + 32, my, 356, 48);
    if (i === 0) elements.find((e) => e.id === cid).strokeColor = T.textAccent;
    label(ox + 48, my + 14, m, { fontSize: 13, color: T.text });
  });
  annotation(ox + 400, oy + 124, '← Bidirectional: start from either side');

  // Stallion selector (right)
  card(ox + 1040, oy + 112, 380, 440);
  label(ox + 1056, oy + 124, 'Select Stallion', { fontSize: 15, color: T.textAccent });

  const stallions = ['Thunder (Quarter Horse, 6yr)', 'Blaze (Thoroughbred, 8yr)'];
  stallions.forEach((s, i) => {
    const sy = oy + 156 + i * 56;
    const _cid = card(ox + 1052, sy, 356, 48);
    if (i === 0) elements.find((e) => e.id === cid).strokeColor = T.textAccent;
    label(ox + 1068, sy + 14, s, { fontSize: 13, color: T.text });
  });

  // Center: CompatibilityPreview
  const cpx = ox + 420;
  card(cpx, oy + 112, 600, 440, { stroke: T.border });
  sectionTitle(cpx + 16, oy + 124, 'Compatibility Preview');

  // Tabs
  const cpTabs = ['Stat Ranges', 'Traits', 'Inbreeding', 'Pedigree'];
  cpTabs.forEach((t, i) => {
    label(cpx + 16 + i * 140, oy + 156, t, {
      fontSize: 12,
      color: i === 0 ? T.textAccent : T.textMuted,
    });
    if (i === 0)
      rect(cpx + 16 + i * 140, oy + 174, 80, 2, { fill: T.textAccent, stroke: 'transparent' });
  });
  annotation(cpx + 600, oy + 156, '← CompatibilityPreview (4 tabs)');

  // Stat Ranges content
  const cpStats = [
    { name: 'Speed', min: 55, max: 80, avg: 68 },
    { name: 'Stamina', min: 50, max: 75, avg: 63 },
    { name: 'Agility', min: 60, max: 85, avg: 73 },
    { name: 'Balance', min: 65, max: 90, avg: 78 },
    { name: 'Precision', min: 58, max: 82, avg: 70 },
  ];
  cpStats.forEach((s, i) => {
    const sy = oy + 196 + i * 36;
    label(cpx + 16, sy, s.name, { fontSize: 12, color: T.textMuted });
    // Range bar
    rect(cpx + 100, sy + 2, 400, 16, { fill: T.bg, stroke: T.borderSubtle, radius: 8 });
    const minPx = Math.round((400 * s.min) / 100);
    const maxPx = Math.round((400 * s.max) / 100);
    rect(cpx + 100 + minPx, sy + 2, maxPx - minPx, 16, {
      fill: T.primary,
      stroke: 'transparent',
      radius: 8,
      opacity: 60,
    });
    // Avg marker
    const avgPx = Math.round((400 * s.avg) / 100);
    rect(cpx + 100 + avgPx - 1, sy, 3, 20, { fill: T.textAccent, stroke: 'transparent' });
    label(cpx + 510, sy, `${s.min}-${s.max} (avg ${s.avg})`, { fontSize: 11, color: T.textMuted });
  });
  annotation(cpx + 16, oy + 380, '← Stat range bars with avg marker (gold)');

  // Cost breakdown
  card(cpx + 16, oy + 400, 568, 60);
  label(cpx + 32, oy + 410, 'Stud Fee: 500 🪙  |  Breeding Fee: 200 🪙  |  Total: 700 🪙', {
    fontSize: 13,
    color: T.text,
  });
  label(cpx + 32, oy + 434, 'Your Balance: 1,250 🪙', { fontSize: 12, color: T.success });

  // Bottom bar
  rect(ox, oy + 840, 1440, 60, { fill: T.container, stroke: T.borderSubtle });
  button(ox + 1440 / 2 - 100, oy + 850, '💕 Breed These Horses', 'primary', { width: 220 });
  label(ox + 20, oy + 860, '♀ Luna × ♂ Thunder', { fontSize: 14, color: T.textMuted });
}

function buildBreedingMobile(ox, oy) {
  deviceFrame(ox, oy, 375, 812, 'Breeding — Mobile (375×812)');
  topBar(ox, oy, 375, { hamburger: true, coins: true, bell: true });

  // Sequential flow indicator
  label(ox + 16, oy + 68, 'Step 1: Select Mare', { fontSize: 14, color: T.textAccent });
  annotation(ox + 200, oy + 68, '← Sequential on mobile');

  // Mare list
  ['Luna (Andalusian, 5yr)', 'Bella (Arabian, 7yr)'].forEach((m, i) => {
    const _cid = card(ox + 16, oy + 96 + i * 64, 343, 52);
    if (i === 0) elements.find((e) => e.id === cid).strokeColor = T.textAccent;
    label(ox + 32, oy + 112 + i * 64, m, { fontSize: 13, color: T.text });
  });

  button(ox + 16, oy + 236, 'Next: Select Stallion →', 'primary', { width: 343 });

  // Preview of compatibility (collapsed)
  label(ox + 16, oy + 300, 'Compatibility Preview', { fontSize: 14, color: T.textAccent });
  // Horizontal scroll tabs
  ['Stats', 'Traits', 'Inbreeding', 'Pedigree'].forEach((t, i) => {
    badge(ox + 16 + i * 84, oy + 328, t, { fill: i === 0 ? T.containerHover : 'transparent' });
  });

  // Compact stat ranges
  ['Speed: 55-80', 'Stamina: 50-75', 'Agility: 60-85', 'Balance: 65-90'].forEach((s, i) => {
    label(ox + 32, oy + 364 + i * 28, s, { fontSize: 12, color: T.textMuted });
    rect(ox + 160, oy + 366 + i * 28, 180, 10, { fill: T.bg, stroke: T.borderSubtle, radius: 5 });
    rect(ox + 160, oy + 366 + i * 28, 120, 10, {
      fill: T.primary,
      stroke: 'transparent',
      radius: 5,
      opacity: 60,
    });
  });

  // Cost
  card(ox + 16, oy + 488, 343, 52);
  label(ox + 32, oy + 500, 'Total: 700 🪙  |  Balance: 1,250 🪙', { fontSize: 12, color: T.text });

  // Breed button
  button(ox + 16, oy + 560, '💕 Breed', 'primary', { width: 343 });

  bottomNav(ox, oy + 756, 375);
}

// ==========================================
// SCREEN 7: HORSE DETAIL PAGE
// ==========================================

function buildHorseDetailDesktop(ox, oy) {
  deviceFrame(ox, oy, 1440, 900, 'Horse Detail — Desktop (1440×900)');
  topBar(ox, oy, 1440, { logo: '✦ EQUORIA', coins: true, bell: true, avatar: true });

  // Hero section
  rect(ox + 20, oy + 72, 1400, 200, { fill: T.container, stroke: T.borderSubtle, radius: 12 });
  // Portrait
  rect(ox + 36, oy + 84, 160, 176, { fill: T.containerHover, stroke: T.borderSubtle, radius: 12 });
  label(ox + 80, oy + 140, '🐎', { fontSize: 60 });

  // Horse info
  label(ox + 220, oy + 92, 'Luna', { fontSize: 28, color: T.textAccent, fontFamily: 4 });
  annotation(ox + 340, oy + 92, '← Cinzel Decorative');
  label(ox + 220, oy + 128, 'Andalusian  •  Mare  •  5 years old  •  Level 7', {
    fontSize: 14,
    color: T.textMuted,
  });

  // CareStatusStrip
  rect(ox + 220, oy + 160, 400, 24, { fill: T.bg, stroke: T.borderSubtle, radius: 12 });
  label(ox + 232, oy + 163, '🍎 Fed 2h ago  |  🔨 Shod 3d ago  |  🎯 Trained 5d ago', {
    fontSize: 10,
    color: T.textMuted,
  });
  annotation(ox + 640, oy + 160, '← CareStatusStrip');

  // Trait badges
  badge(ox + 220, oy + 196, '✨ BRAVE', { fill: T.containerHover, stroke: T.textAccent });
  badge(ox + 320, oy + 196, '⚡ ATHLETIC', { fill: T.containerHover, stroke: T.primary });
  badge(ox + 440, oy + 196, '🧠 INTELLIGENT', { fill: T.containerHover, stroke: T.success });

  // Tab bar
  const detailTabs = ['Stats', 'Pedigree', 'Health', 'Training', 'Stud/Sale'];
  detailTabs.forEach((t, i) => {
    label(ox + 20 + i * 160, oy + 292, t, {
      fontSize: 14,
      color: i === 0 ? T.textAccent : T.textMuted,
    });
    if (i === 0)
      rect(ox + 20 + i * 160, oy + 314, 60, 3, { fill: T.textAccent, stroke: 'transparent' });
  });

  // Stats tab content
  // Left: Stat bars
  const stats = [
    { name: 'Speed', val: 72 },
    { name: 'Stamina', val: 68 },
    { name: 'Agility', val: 65 },
    { name: 'Balance', val: 81 },
    { name: 'Precision', val: 85 },
    { name: 'Intelligence', val: 70 },
    { name: 'Boldness', val: 60 },
    { name: 'Flexibility', val: 55 },
    { name: 'Obedience', val: 78 },
    { name: 'Focus', val: 74 },
  ];
  stats.forEach((s, i) => {
    const col = i < 5 ? 0 : 1;
    const row = i % 5;
    const sx = ox + 20 + col * 380;
    const sy = oy + 336 + row * 32;
    label(sx, sy, s.name, { fontSize: 12, color: T.textMuted });
    rect(sx + 100, sy + 2, 220, 14, { fill: T.bg, stroke: T.borderSubtle, radius: 7 });
    rect(sx + 100, sy + 2, Math.round((220 * s.val) / 100), 14, {
      fill: T.primary,
      stroke: 'transparent',
      radius: 7,
    });
    label(sx + 328, sy, `${s.val}`, { fontSize: 12, color: T.text });
  });

  // Right: Radar chart placeholder
  rect(ox + 800, oy + 330, 360, 300, { fill: T.container, stroke: T.borderSubtle, radius: 12 });
  label(ox + 900, oy + 450, '📊 Stat Radar', { fontSize: 20, color: T.textMuted });
  annotation(ox + 1180, oy + 330, '← Recharts RadarChart');

  // Discipline scores
  label(ox + 800, oy + 648, 'Discipline Scores', { fontSize: 14, color: T.textAccent });
  ['Dressage: 45', 'Show Jumping: 32', 'Western: 28'].forEach((d, i) => {
    label(ox + 800, oy + 672 + i * 24, d, { fontSize: 12, color: T.textMuted });
  });

  // Bottom action bar
  rect(ox, oy + 840, 1440, 60, { fill: T.container, stroke: T.borderSubtle });
  const actionBtns = ['🍎 Feed', '🎯 Train', '💕 Breed', '👤 Assign Groom', '🏷️ List for Sale'];
  actionBtns.forEach((b, i) => {
    button(ox + 40 + i * 260, oy + 848, b, i === 0 ? 'primary' : 'secondary', { width: 240 });
  });
  annotation(ox + 20, oy + 828, '↓ Sticky bottom action bar');
}

function buildHorseDetailMobile(ox, oy) {
  deviceFrame(ox, oy, 375, 812, 'Horse Detail — Mobile (375×812)');
  topBar(ox, oy, 375, { hamburger: true, coins: true, bell: true });

  // Hero (compact)
  rect(ox + 16, oy + 68, 343, 120, { fill: T.container, stroke: T.borderSubtle, radius: 12 });
  rect(ox + 28, oy + 78, 80, 100, { fill: T.containerHover, stroke: T.borderSubtle, radius: 8 });
  label(ox + 48, oy + 108, '🐎', { fontSize: 36 });
  label(ox + 120, oy + 80, 'Luna', { fontSize: 20, color: T.textAccent });
  label(ox + 120, oy + 106, 'Andalusian • Mare • 5yr', { fontSize: 11, color: T.textMuted });
  badge(ox + 120, oy + 128, '✨ BRAVE');
  badge(ox + 210, oy + 128, '⚡ ATHLETIC');

  // Tabs (horizontal scroll)
  ['Stats', 'Pedigree', 'Health', 'Training', 'Stud'].forEach((t, i) => {
    label(ox + 16 + i * 72, oy + 200, t, {
      fontSize: 12,
      color: i === 0 ? T.textAccent : T.textMuted,
    });
  });
  rect(ox + 16, oy + 218, 40, 2, { fill: T.textAccent, stroke: 'transparent' });

  // Stats (compact)
  ['Speed: 72', 'Stamina: 68', 'Agility: 65', 'Balance: 81', 'Precision: 85'].forEach((s, i) => {
    const sy = oy + 232 + i * 28;
    label(ox + 16, sy, s.split(':')[0], { fontSize: 11, color: T.textMuted });
    rect(ox + 100, sy + 2, 200, 12, { fill: T.bg, stroke: T.borderSubtle, radius: 6 });
    const val = parseInt(s.split(': ')[1]);
    rect(ox + 100, sy + 2, Math.round((200 * val) / 100), 12, {
      fill: T.primary,
      stroke: 'transparent',
      radius: 6,
    });
    label(ox + 310, sy, s.split(': ')[1], { fontSize: 11, color: T.text });
  });

  // Bottom action bar (5 icons)
  rect(ox, oy + 700, 375, 56, { fill: T.container, stroke: T.borderSubtle });
  ['🍎', '🎯', '💕', '👤', '🏷️'].forEach((icon, i) => {
    label(ox + 20 + i * 72, oy + 712, icon, { fontSize: 22 });
  });
  annotation(ox + 16, oy + 688, '↓ Sticky action bar (5 icons)');

  bottomNav(ox, oy + 756, 375);
}

// ==========================================
// SCREEN 8: FOAL DEVELOPMENT TRACKER
// ==========================================

function buildFoalDevDesktop(ox, oy) {
  deviceFrame(ox, oy, 1440, 900, 'Foal Development Tracker — Desktop (1440×900)');
  topBar(ox, oy, 1440, { logo: '✦ EQUORIA', coins: true, bell: true, avatar: true });

  // Foal card (left)
  card(ox + 20, oy + 72, 340, 200);
  rect(ox + 32, oy + 84, 120, 160, { fill: T.containerHover, stroke: T.borderSubtle, radius: 8 });
  label(ox + 60, oy + 140, '🐴', { fontSize: 48 });
  label(ox + 168, oy + 88, 'Star', { fontSize: 20, color: T.textAccent });
  label(ox + 168, oy + 116, 'Arabian • 8 weeks old', { fontSize: 12, color: T.textMuted });
  badge(ox + 168, oy + 140, '🌱 Weanling', { fill: T.containerHover, stroke: T.success });
  label(ox + 168, oy + 172, 'Bond: 42/100', { fontSize: 12, color: T.textMuted });
  rect(ox + 168, oy + 192, 160, 10, { fill: T.bg, stroke: T.borderSubtle, radius: 5 });
  rect(ox + 168, oy + 192, 67, 10, { fill: T.textAccent, stroke: 'transparent', radius: 5 });
  annotation(ox + 168, oy + 212, '← Bond progress bar');

  // Horizontal timeline (center)
  sectionTitle(ox + 380, oy + 76, 'Development Timeline');
  annotation(ox + 600, oy + 76, '← DevelopmentTracker (horizontal timeline)');

  rect(ox + 380, oy + 112, 1040, 120, { fill: T.container, stroke: T.borderSubtle, radius: 12 });
  // Timeline track
  line(ox + 420, oy + 172, ox + 1380, oy + 172, { stroke: T.borderSubtle, strokeWidth: 3 });

  // Milestones
  const milestones = [
    { x: 420, label: 'Birth', done: true },
    { x: 560, label: 'Bond 25', done: true },
    { x: 700, label: '1st Trait', done: false, current: false },
    { x: 840, label: 'Bond 50', done: false },
    { x: 980, label: 'Bond 75', done: false },
    { x: 1120, label: 'Bond 100', done: false },
    { x: 1260, label: '🎓 Graduate\n(Age 3)', done: false },
  ];
  milestones.forEach((m) => {
    const color = m.done ? T.textAccent : T.borderSubtle;
    ellipseEl(ox + m.x - 8, oy + 164, 16, 16, {
      fill: m.done ? T.textAccent : T.bg,
      stroke: color,
      strokeWidth: 2,
    });
    label(ox + m.x - 20, oy + 188, m.label, {
      fontSize: 10,
      color: m.done ? T.textAccent : T.textMuted,
      align: 'center',
      width: 60,
    });
  });

  // Current position indicator
  ellipseEl(ox + 620, oy + 164, 20, 20, { fill: T.primary, stroke: T.primaryGlow, strokeWidth: 2 });
  annotation(ox + 620, oy + 130, '↓ Current position (glow)');

  // Age stages
  const stages = [
    { label: 'Newborn\n0-4wk', x: 420, w: 140, done: true },
    { label: 'Weanling\n4-26wk', x: 560, w: 280, current: true },
    { label: 'Yearling\n26-52wk', x: 840, w: 280 },
    { label: 'Two-Year-Old\n52-104wk', x: 1120, w: 260 },
  ];
  stages.forEach((s) => {
    const fill = s.done ? T.containerHover : s.current ? T.primary : 'transparent';
    rect(ox + s.x, oy + 120, s.w, 8, {
      fill,
      stroke: 'transparent',
      radius: 4,
      opacity: s.current ? 40 : 20,
    });
  });

  // Activities panel (right)
  sectionTitle(ox + 380, oy + 252, 'Available Activities (Weanling Stage)');
  annotation(ox + 720, oy + 252, '← Filtered by current age stage');

  const activities = [
    {
      name: 'Gentle Desensitization',
      desc: 'Introduce new objects and sounds',
      bond: '+3',
      stress: '+1',
      icon: '🔔',
    },
    {
      name: 'Social Exposure',
      desc: 'Time with other horses in herd',
      bond: '+4',
      stress: '-1',
      icon: '🐴',
    },
    {
      name: 'Grooming Session',
      desc: 'Brush and handle the foal',
      bond: '+5',
      stress: '-2',
      icon: '🪮',
    },
    {
      name: 'Pasture Walk',
      desc: 'Explore different terrain surfaces',
      bond: '+2',
      stress: '+2',
      icon: '🌿',
    },
  ];

  activities.forEach((a, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const ax = ox + 380 + col * 520;
    const ay = oy + 284 + row * 100;

    card(ax, ay, 500, 88);
    label(ax + 16, ay + 10, `${a.icon} ${a.name}`, { fontSize: 14, color: T.text });
    label(ax + 16, ay + 34, a.desc, { fontSize: 12, color: T.textMuted });
    label(ax + 16, ay + 58, `Bond: ${a.bond}  |  Stress: ${a.stress}`, {
      fontSize: 11,
      color: T.textMuted,
    });
    button(ax + 380, ay + 24, 'Do Activity', 'primary', { width: 108 });
  });

  // Milestone history (bottom)
  sectionTitle(ox + 20, oy + 500, 'Completed Milestones');
  card(ox + 20, oy + 532, 1400, 120);
  const completed = [
    { icon: '🎉', text: 'Born — March 1, 2026', date: 'Week 0' },
    { icon: '💛', text: 'Bond Level 25 reached', date: 'Week 4' },
    { icon: '✨', text: 'Trait Discovered: BRAVE', date: 'Week 6' },
  ];
  completed.forEach((c, i) => {
    label(ox + 36 + i * 460, oy + 548, `${c.icon} ${c.text}`, { fontSize: 13, color: T.text });
    label(ox + 36 + i * 460, oy + 572, c.date, { fontSize: 11, color: T.textMuted });
  });
}

function buildFoalDevMobile(ox, oy) {
  deviceFrame(ox, oy, 375, 812, 'Foal Dev — Mobile (375×812)');
  topBar(ox, oy, 375, { hamburger: true, coins: true, bell: true });

  // Foal card (compact)
  card(ox + 16, oy + 68, 343, 80);
  rect(ox + 28, oy + 76, 56, 64, { fill: T.containerHover, stroke: T.borderSubtle, radius: 8 });
  label(ox + 40, oy + 92, '🐴', { fontSize: 28 });
  label(ox + 96, oy + 76, 'Star — Arabian', { fontSize: 14, color: T.textAccent });
  label(ox + 96, oy + 96, '8 weeks old', { fontSize: 11, color: T.textMuted });
  badge(ox + 96, oy + 116, '🌱 Weanling');
  rect(ox + 200, oy + 118, 140, 8, { fill: T.bg, stroke: T.borderSubtle, radius: 4 });
  rect(ox + 200, oy + 118, 59, 8, { fill: T.textAccent, stroke: 'transparent', radius: 4 });

  // Vertical card stack (age stages)
  label(ox + 16, oy + 164, 'Development', { fontSize: 13, color: T.textAccent });
  annotation(ox + 140, oy + 164, '← Card view (replaces timeline)');

  const mStages = [
    { name: '✅ Newborn (0-4wk)', done: true, collapsed: true },
    { name: '🌱 Weanling (4-26wk)', current: true, collapsed: false },
    { name: '🔒 Yearling (26-52wk)', locked: true, collapsed: true },
    { name: '🔒 Two-Year-Old (52-104wk)', locked: true, collapsed: true },
  ];

  let msy = oy + 188;
  mStages.forEach((s) => {
    const h = s.collapsed ? 36 : 200;
    const _cid = card(ox + 16, msy, 343, h);
    if (s.current) elements.find((e) => e.id === cid).strokeColor = T.primary;
    label(ox + 32, msy + 8, s.name, { fontSize: 13, color: s.locked ? T.textMuted : T.text });

    if (!s.collapsed) {
      // Activities inside expanded stage
      label(ox + 32, msy + 40, 'Activities:', { fontSize: 12, color: T.textAccent });
      [
        '🔔 Desensitization (+3 bond)',
        '🐴 Social Exposure (+4 bond)',
        '🪮 Grooming (+5 bond)',
      ].forEach((a, i) => {
        label(ox + 32, msy + 64 + i * 28, a, { fontSize: 11, color: T.text });
        button(ox + 276, msy + 58 + i * 28, 'Do', 'primary', { width: 68, height: 28 });
      });
      label(ox + 32, msy + 156, 'Milestones: Bond 25 ✅ | 1st Trait ✅', {
        fontSize: 10,
        color: T.textMuted,
      });
    }

    msy += h + 8;
  });

  bottomNav(ox, oy + 756, 375);
}

// ==========================================
// SCREEN 9: GLOBAL NAVIGATION
// ==========================================

function buildNavDesktop(ox, oy) {
  deviceFrame(ox, oy, 1440, 900, 'Global Navigation — Desktop (1440×900)');

  // Top bar
  rect(ox, oy, 1440, 60, { fill: T.container, stroke: T.borderSubtle });
  label(ox + 20, oy + 16, '✦ EQUORIA', { fontSize: 22, color: T.textAccent, fontFamily: 4 });
  inputField(ox + 540, oy + 10, '🔍 Search horses, shows, players...', { width: 360, height: 40 });
  badge(ox + 1100, oy + 18, '🪙 1,250');
  label(ox + 1260, oy + 18, '🔔', { fontSize: 18, color: T.text });
  ellipseEl(ox + 1360, oy + 14, 32, 32, { fill: T.containerHover, stroke: T.borderSubtle });
  annotation(ox + 1440, oy + 16, '← Top bar: logo, search, coins, bell, avatar');

  // Left sidebar
  rect(ox, oy + 60, 240, 840, { fill: T.container, stroke: T.borderSubtle });

  const sideItems = [
    { icon: '🏠', label: 'Home', active: true },
    { icon: '🐴', label: 'My Stable' },
    { icon: '🎯', label: 'Training' },
    { icon: '💕', label: 'Breeding' },
    { icon: '🏆', label: 'Competitions' },
    { icon: '🌍', label: 'World' },
    { icon: '🛒', label: 'Marketplace' },
    { icon: '👥', label: 'Community' },
    { icon: '📊', label: 'Leaderboards' },
    { icon: '⚙️', label: 'Settings' },
  ];

  sideItems.forEach((item, i) => {
    const iy = oy + 60 + i * 48;
    if (item.active) {
      rect(ox, iy, 240, 48, { fill: T.containerHover, stroke: 'transparent' });
      rect(ox, iy, 3, 48, { fill: T.textAccent, stroke: 'transparent' });
    }
    label(ox + 20, iy + 14, `${item.icon}  ${item.label}`, {
      fontSize: 14,
      color: item.active ? T.textAccent : T.text,
    });
  });
  annotation(ox + 248, oy + 60, '← Active: gold left border + lighter bg');

  // Breadcrumbs
  label(ox + 260, oy + 72, 'Home  >  My Stable  >  Luna', { fontSize: 12, color: T.textMuted });
  annotation(ox + 540, oy + 72, '← Breadcrumbs (gold separator)');

  // Content area (StarfieldBackground visible)
  rect(ox + 240, oy + 100, 1200, 800, { fill: T.bg, stroke: 'transparent', opacity: 80 });
  label(ox + 700, oy + 440, '✦ Content Area ✦\n(StarfieldBackground visible)', {
    fontSize: 18,
    color: T.textMuted,
    align: 'center',
  });
}

function buildNavMobile(ox, oy) {
  deviceFrame(ox, oy, 375, 812, 'Global Nav — Mobile (375×812)');

  // Top bar
  rect(ox, oy, 375, 56, { fill: T.container, stroke: T.borderSubtle });
  label(ox + 16, oy + 16, '☰', { fontSize: 22, color: T.text });
  label(ox + 140, oy + 14, '✦ EQUORIA', { fontSize: 16, color: T.textAccent });
  label(ox + 300, oy + 16, '🔔', { fontSize: 16, color: T.text });
  ellipseEl(ox + 332, oy + 12, 28, 28, { fill: T.containerHover, stroke: T.borderSubtle });

  // Hamburger menu (slide-in, shown as overlay)
  rect(ox, oy + 56, 300, 700, { fill: T.container, stroke: T.border, radius: 0 });
  label(ox + 240, oy + 72, '✕', { fontSize: 18, color: T.textMuted });
  annotation(ox + 304, oy + 56, '← Slide-in glass panel');

  const mNavItems = [
    '🏠 Home',
    '🐴 My Stable',
    '🎯 Training',
    '💕 Breeding',
    '🏆 Competitions',
    '🌍 World',
    '🛒 Marketplace',
    '👥 Community',
    '📊 Leaderboards',
    '⚙️ Settings',
  ];
  mNavItems.forEach((item, i) => {
    const iy = oy + 96 + i * 48;
    if (i === 0) {
      rect(ox, iy, 300, 48, { fill: T.containerHover, stroke: 'transparent' });
      rect(ox, iy, 3, 48, { fill: T.textAccent, stroke: 'transparent' });
    }
    label(ox + 20, iy + 14, item, { fontSize: 14, color: i === 0 ? T.textAccent : T.text });
  });

  // Bottom nav bar
  rect(ox, oy + 756, 375, 56, { fill: T.container, stroke: T.borderSubtle });
  line(ox, oy + 756, ox + 375, oy + 756, { stroke: T.borderSubtle });
  const bnItems = ['🏠', '🐴', '🎯', '🏆', '•••'];
  const bnLabels = ['Home', 'Stable', 'Train', 'Compete', 'More'];
  bnItems.forEach((icon, i) => {
    const bx = ox + i * 75 + 20;
    label(bx, oy + 764, icon, { fontSize: 20, color: i === 0 ? T.textAccent : T.textMuted });
    label(bx - 4, oy + 790, bnLabels[i], {
      fontSize: 9,
      color: i === 0 ? T.textAccent : T.textMuted,
    });
  });
  annotation(ox + 16, oy + 744, '↓ Bottom nav: 5 key items, "More" opens full menu');
}

// ==========================================
// BUILD ALL SCREENS
// ==========================================

// Layout: screens side by side with 200px gaps
// Desktop row: y = 0, each 1440w + 200 gap
// Mobile row: y = 1200, each 375w + 100 gap (centered under desktop)

// Desktop screens
const dGap = 200;
const dY = 60; // leave room for title

buildHubDesktop(0, dY);
buildWYAGDesktop(1440 + dGap, dY);
buildOnboardingDesktop((1440 + dGap) * 2, dY);
buildTrainingDesktop((1440 + dGap) * 3, dY);
buildCompetitionDesktop((1440 + dGap) * 4, dY);
buildBreedingDesktop((1440 + dGap) * 5, dY);
buildHorseDetailDesktop((1440 + dGap) * 6, dY);
buildFoalDevDesktop((1440 + dGap) * 7, dY);
buildNavDesktop((1440 + dGap) * 8, dY);

// Mobile screens (positioned below their desktop counterparts)
const mY = 1200;

buildHubMobile(0, mY);
buildWYAGMobile(1440 + dGap, mY);
buildOnboardingMobile((1440 + dGap) * 2, mY);
buildTrainingMobile((1440 + dGap) * 3, mY);
buildCompetitionMobile((1440 + dGap) * 4, mY);
buildBreedingMobile((1440 + dGap) * 5, mY);
buildHorseDetailMobile((1440 + dGap) * 6, mY);
buildFoalDevMobile((1440 + dGap) * 7, mY);
buildNavMobile((1440 + dGap) * 8, mY);

// ==========================================
// OUTPUT EXCALIDRAW JSON
// ==========================================

const excalidraw = {
  type: 'excalidraw',
  version: 2,
  source: 'equoria-wireframe-generator',
  elements: elements.filter((e) => !e.isDeleted),
  appState: {
    viewBackgroundColor: T.bg,
    gridSize: 20,
    gridStep: 5,
    gridModeEnabled: true,
  },
};

const outputPath = 'docs/diagrams/wireframe-2026-03-11.excalidraw';
writeFileSync(outputPath, JSON.stringify(excalidraw, null, 2));

console.log(`✓ Generated ${elements.length} elements across 18 wireframes`);
console.log(`✓ Saved to ${outputPath}`);
console.log(`✓ File size: ${(JSON.stringify(excalidraw).length / 1024).toFixed(1)} KB`);
