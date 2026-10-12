"use client";

/**
 * Web Audio sound engine for Ruchima Masala order notifications.
 *
 * Implements:
 * 1. Zomato/Swiggy-style upbeat marimba/chime arpeggio for new admin order alerts.
 * 2. Swiggy-style high-clarity double dining bell, usable as an alternate admin theme.
 * 3. Warm, subtle customer status chimes (Placed, Paid, Packed, Shipped, Delivered, Cancelled).
 *
 * Zero external audio files (no 404s, no CDN latency, 100% offline).
 * Handles AudioContext suspension, auto-unlock on user gesture, and volume control.
 *
 * Ported from rakus-kitchen's audioAlerts.ts — the synthesis engine itself is
 * generic (no business-specific logic), only the customer chime status set
 * below is remapped to Ruchima's own OrderStatus.
 */

export type SoundTheme = "zomato" | "bell" | "buzzer";

let sharedAudioCtx: AudioContext | null = null;

/**
 * Get or create the shared AudioContext.
 * Automatically attempts to resume if in "suspended" state.
 */
export function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;

  try {
    if (!sharedAudioCtx) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const AC = window.AudioContext ?? (window as any).webkitAudioContext;
      if (AC) sharedAudioCtx = new AC();
    }

    if (sharedAudioCtx && sharedAudioCtx.state === "suspended") {
      sharedAudioCtx.resume().catch(() => {});
    }

    return sharedAudioCtx;
  } catch {
    return null;
  }
}

/**
 * Global unlocker attached once on document user interaction (click/touch).
 * Ensures browser autoplay policy allows audio seamlessly.
 */
let unlockListenerAttached = false;
export function attachAudioAutoUnlock(): void {
  if (typeof window === "undefined" || unlockListenerAttached) return;
  unlockListenerAttached = true;

  const unlock = () => {
    const ctx = getAudioContext();
    if (ctx && ctx.state === "suspended") {
      ctx.resume().then(() => {
        window.removeEventListener("click", unlock);
        window.removeEventListener("touchstart", unlock);
        window.removeEventListener("keydown", unlock);
      }).catch(() => {});
    } else if (ctx && ctx.state === "running") {
      window.removeEventListener("click", unlock);
      window.removeEventListener("touchstart", unlock);
      window.removeEventListener("keydown", unlock);
    }
  };

  window.addEventListener("click", unlock, { passive: true });
  window.addEventListener("touchstart", unlock, { passive: true });
  window.addEventListener("keydown", unlock, { passive: true });
}

/**
 * Synthesizes a bright, resonant marimba/xylophone tone using FM synthesis.
 * Fundamental sine wave + subtle bright overtone with snappy decay.
 */
function playMarimbaTone(
  ctx: AudioContext,
  freq: number,
  startTime: number,
  duration = 0.35,
  peakGain = 0.4
): void {
  // Primary oscillator
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(freq, startTime);

  // Secondary overtone for woody/percussive chime texture (2.76x frequency)
  const overtone = ctx.createOscillator();
  const overtoneGain = ctx.createGain();
  overtone.type = "sine";
  overtone.frequency.setValueAtTime(freq * 2.76, startTime);

  osc.connect(gain);
  overtone.connect(overtoneGain);
  overtoneGain.connect(gain);
  gain.connect(ctx.destination);

  // Envelope: instantaneous attack, fast percussive decay
  gain.gain.setValueAtTime(0.001, startTime);
  gain.gain.linearRampToValueAtTime(peakGain, startTime + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

  overtoneGain.gain.setValueAtTime(0.001, startTime);
  overtoneGain.gain.linearRampToValueAtTime(peakGain * 0.4, startTime + 0.006);
  overtoneGain.gain.exponentialRampToValueAtTime(0.0001, startTime + Math.min(0.12, duration * 0.5));

  osc.start(startTime);
  overtone.start(startTime);
  osc.stop(startTime + duration);
  overtone.stop(startTime + duration);
}

/**
 * Synthesizes a pure metallic bell chime with long, warm sustain.
 */
function playBellTone(
  ctx: AudioContext,
  freq: number,
  startTime: number,
  duration = 0.8,
  peakGain = 0.3
): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(freq, startTime);

  osc.connect(gain);
  gain.connect(ctx.destination);

  gain.gain.setValueAtTime(0.001, startTime);
  gain.gain.linearRampToValueAtTime(peakGain, startTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

  osc.start(startTime);
  osc.stop(startTime + duration);
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * ADMIN NEW-ORDER / NEW-LEAD ALERTS
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * Plays the signature Zomato-style upbeat marimba motif.
 * Ascending arpeggio followed by cheerful double bounce:
 * [G5 (784Hz), B5 (988Hz), D6 (1175Hz), G6 (1568Hz), D6 (1175Hz), G6 (1568Hz)]
 */
export function playZomatoAlert(volume = 0.8): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const notes = [
    { freq: 783.99, delay: 0.00 }, // G5
    { freq: 987.77, delay: 0.09 }, // B5
    { freq: 1174.66, delay: 0.18 }, // D6
    { freq: 1567.98, delay: 0.27 }, // G6
    { freq: 1174.66, delay: 0.42 }, // D6
    { freq: 1567.98, delay: 0.52 }, // G6
  ];

  notes.forEach(({ freq, delay }) => {
    playMarimbaTone(ctx, freq, now + delay, 0.35, 0.45 * volume);
  });
}

/**
 * Plays a Swiggy-style crisp, resonant dining bell alert.
 * High-pitched two-tone bell chime [880Hz (A5), 1318.5Hz (E6)].
 */
export function playBellAlert(volume = 0.8): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  playBellTone(ctx, 880.00, now, 0.7, 0.4 * volume);
  playBellTone(ctx, 1318.51, now + 0.18, 0.9, 0.5 * volume);
}

/**
 * Plays a classic urgent buzzer tone.
 */
export function playBuzzerAlert(volume = 0.8): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.type = "square";
  osc.frequency.setValueAtTime(240, now);
  osc.frequency.linearRampToValueAtTime(320, now + 0.15);

  gain.gain.setValueAtTime(0.3 * volume, now);
  gain.gain.linearRampToValueAtTime(0, now + 0.2);

  osc.start(now);
  osc.stop(now + 0.22);
}

/**
 * Plays the admin alert sound corresponding to the chosen theme.
 */
export function playAdminAlert(theme: SoundTheme = "zomato", volume = 0.8): void {
  switch (theme) {
    case "zomato":
      playZomatoAlert(volume);
      break;
    case "bell":
      playBellAlert(volume);
      break;
    case "buzzer":
      playBuzzerAlert(volume);
      break;
  }
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * CUSTOMER STATUS CHIMES (Zomato / Swiggy Consumer Style)
 * ─────────────────────────────────────────────────────────────────────────────
 */

export type CustomerAlertStatus = "placed" | "paid" | "packed" | "shipped" | "delivered" | "cancelled";

/**
 * Plays friendly, pleasing consumer app chimes when order status updates:
 * - "placed": Crisp uplifting double chime
 * - "paid": Warm two-tone confirmation bell
 * - "packed": Warm two-tone culinary bell
 * - "shipped": Upbeat 3-note ascending fanfare
 * - "delivered": Satisfying warm celebration chord
 * - "cancelled": Soft downward alert
 */
export function playCustomerChime(status: CustomerAlertStatus, volume = 0.65): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  switch (status) {
    case "placed":
      // C5 (523Hz) -> G5 (784Hz)
      playBellTone(ctx, 523.25, now, 0.45, 0.35 * volume);
      playBellTone(ctx, 783.99, now + 0.12, 0.6, 0.45 * volume);
      break;

    case "paid":
      // D5 (587Hz) -> A5 (880Hz)
      playBellTone(ctx, 587.33, now, 0.45, 0.35 * volume);
      playBellTone(ctx, 880.00, now + 0.12, 0.6, 0.45 * volume);
      break;

    case "packed":
      // E5 (659Hz) -> A5 (880Hz)
      playMarimbaTone(ctx, 659.25, now, 0.3, 0.35 * volume);
      playMarimbaTone(ctx, 880.00, now + 0.14, 0.4, 0.45 * volume);
      break;

    case "shipped":
      // Upbeat 3-note delivery fanfare: F5 (698Hz) -> A5 (880Hz) -> C6 (1046Hz)
      playMarimbaTone(ctx, 698.46, now, 0.25, 0.35 * volume);
      playMarimbaTone(ctx, 880.00, now + 0.11, 0.25, 0.4 * volume);
      playBellTone(ctx, 1046.50, now + 0.22, 0.7, 0.5 * volume);
      break;

    case "delivered":
      // Celebration chord: C5 -> E5 -> G5 -> C6
      playBellTone(ctx, 523.25, now, 0.5, 0.3 * volume);
      playBellTone(ctx, 659.25, now + 0.10, 0.5, 0.35 * volume);
      playBellTone(ctx, 783.99, now + 0.20, 0.6, 0.4 * volume);
      playBellTone(ctx, 1046.50, now + 0.30, 0.9, 0.5 * volume);
      break;

    case "cancelled":
      // Soft downward minor 2-tone: E5 (659Hz) -> C5 (523Hz)
      playBellTone(ctx, 659.25, now, 0.3, 0.25 * volume);
      playBellTone(ctx, 523.25, now + 0.15, 0.5, 0.25 * volume);
      break;
  }
}
