/**
 * SoundManager — Epic 30
 *
 * Manages game audio using HTML5 Audio API.
 * All sounds are OFF by default (user must opt in via Settings).
 * Respects prefers-reduced-motion (treats motion reduction as a proxy for
 * reduced stimulation, which typically includes audio).
 *
 * Sound categories:
 * - interaction: button clicks, UI feedback
 * - ambient:     background music for hub/stable pages (looping)
 * - celebration: cinematic moment events (trait-discovery, foal-birth, cup-win)
 */

const SOUND_ENABLED_KEY = 'equoria:soundEnabled';

/**
 * Check the OS-level prefers-reduced-motion setting.
 * Returns true if the user has requested reduced motion.
 */
function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Read the user's explicit sound preference from localStorage.
 * Returns false (sound OFF) if never set.
 */
export function getSoundEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const stored = localStorage.getItem(SOUND_ENABLED_KEY);
    return stored === 'true';
  } catch {
    return false;
  }
}

/**
 * Persist the user's sound preference to localStorage.
 */
export function setSoundEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SOUND_ENABLED_KEY, String(enabled));
  } catch {
    // localStorage may be unavailable; silently skip
  }
}

/**
 * Determine whether audio playback should proceed.
 * Checks: user preference AND prefers-reduced-motion.
 */
export function isSoundActive(): boolean {
  if (prefersReducedMotion()) return false;
  return getSoundEnabled();
}

type SoundVariant = 'click' | 'success' | 'cooldown' | 'trait-discovery' | 'foal-birth' | 'cup-win';

/**
 * Audio data URLs for lightweight procedurally generated tones.
 * We use the Web Audio API to synthesise short sounds to avoid
 * shipping binary audio assets.
 */
function createAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return null;
    return new AudioContextClass();
  } catch {
    return null;
  }
}

/**
 * Play a synthesised tone using the Web Audio API.
 * Each SoundVariant maps to distinct pitch/duration/waveform.
 */
export async function playSound(variant: SoundVariant): Promise<void> {
  if (!isSoundActive()) return;

  const ctx = createAudioContext();
  if (!ctx) return;

  try {
    // Resume context if suspended (browser autoplay policy)
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    const gainNode = ctx.createGain();
    gainNode.connect(ctx.destination);

    const oscillator = ctx.createOscillator();
    oscillator.connect(gainNode);

    // Configure tone based on variant
    switch (variant) {
      case 'click':
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, ctx.currentTime);
        gainNode.gain.setValueAtTime(0.08, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + 0.08);
        break;

      case 'success':
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(523, ctx.currentTime); // C5
        oscillator.frequency.setValueAtTime(659, ctx.currentTime + 0.1); // E5
        oscillator.frequency.setValueAtTime(784, ctx.currentTime + 0.2); // G5
        gainNode.gain.setValueAtTime(0.12, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + 0.4);
        break;

      case 'cooldown':
        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(440, ctx.currentTime);
        oscillator.frequency.setValueAtTime(550, ctx.currentTime + 0.15);
        gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + 0.3);
        break;

      case 'trait-discovery':
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(392, ctx.currentTime); // G4
        oscillator.frequency.setValueAtTime(523, ctx.currentTime + 0.15); // C5
        oscillator.frequency.setValueAtTime(784, ctx.currentTime + 0.3); // G5
        oscillator.frequency.setValueAtTime(1047, ctx.currentTime + 0.45); // C6
        gainNode.gain.setValueAtTime(0.14, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + 0.8);
        break;

      case 'foal-birth':
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(330, ctx.currentTime); // E4
        oscillator.frequency.setValueAtTime(440, ctx.currentTime + 0.2); // A4
        oscillator.frequency.setValueAtTime(554, ctx.currentTime + 0.4); // C#5
        oscillator.frequency.setValueAtTime(659, ctx.currentTime + 0.6); // E5
        gainNode.gain.setValueAtTime(0.14, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.0);
        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + 1.0);
        break;

      case 'cup-win':
        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(523, ctx.currentTime); // C5
        oscillator.frequency.setValueAtTime(659, ctx.currentTime + 0.12); // E5
        oscillator.frequency.setValueAtTime(784, ctx.currentTime + 0.24); // G5
        oscillator.frequency.setValueAtTime(1047, ctx.currentTime + 0.36); // C6
        oscillator.frequency.setValueAtTime(1319, ctx.currentTime + 0.48); // E6
        gainNode.gain.setValueAtTime(0.15, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);
        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + 1.2);
        break;

      default:
        oscillator.stop();
        ctx.close();
        return;
    }

    // Clean up context after sound completes
    oscillator.onended = () => {
      ctx.close().catch(() => {
        /* ignore */
      });
    };
  } catch {
    // Non-critical: swallow audio errors silently
    ctx.close().catch(() => {
      /* ignore */
    });
  }
}
