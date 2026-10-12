"use client";

/**
 * useOrderAlerts — admin new-order alert controller for Ruchima Masala.
 *
 * Owns everything the admin needs to *never miss* a new order:
 *   - Sound engine: Zomato-style upbeat marimba arpeggio, Swiggy bell, or classic buzzer
 *   - Auto-resumes AudioContext if suspended
 *   - Vibration loop on supported devices
 *   - Document title flashing
 *   - Native OS Notifications with order summary
 *   - Queue management with acknowledge action
 *   - Sound testing and volume controls
 *   - Persistent settings across browser tabs via localStorage
 *
 * Ported from rakus-kitchen's useOrderAlerts.ts.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { Order } from "@/types";
import {
  attachAudioAutoUnlock,
  getAudioContext,
  playAdminAlert,
  type SoundTheme,
} from "./audioAlerts";

const STORAGE_ARMED_KEY = "rm-alerts-armed-v1";
const STORAGE_THEME_KEY = "rm-alerts-sound-theme-v1";
const STORAGE_VOLUME_KEY = "rm-alerts-volume-v1";

export interface OrderAlertsHook {
  /** True after alerts have been enabled (persisted in localStorage). */
  armed: boolean;
  /** Orders waiting for acknowledgement (oldest first). */
  queue: Order[];
  /** Whether sound is muted. */
  muted: boolean;
  /** Whether the alert sound loop is currently ringing. */
  isRinging: boolean;
  /** Chosen sound theme: "zomato" | "bell" | "buzzer" */
  soundTheme: SoundTheme;
  /** Volume level: 0 to 1 */
  volume: number;
  /** Enable and unlock audio alerts + request OS notification permissions. */
  arm: () => Promise<void>;
  /** Push genuinely-new orders into the alert queue. */
  pushNew: (orders: Order[]) => void;
  /** Acknowledge a single order: removes it from the queue and stops sound if queue is now empty. */
  acknowledgeOrder: (orderId: string) => void;
  /** Acknowledge all pending orders: clears queue and stops alert loop. */
  acknowledge: () => void;
  /** Immediately silences the ringing tone without clearing the queue. */
  stopAlertTone: () => void;
  /** Toggle sound mute. */
  toggleMute: () => void;
  /** Select alert sound theme. */
  setSoundTheme: (theme: SoundTheme) => void;
  /** Set alert volume. */
  setVolume: (vol: number) => void;
  /** Plays a preview test of the currently selected sound. */
  testSound: () => void;
}

export function useOrderAlerts(): OrderAlertsHook {
  const [armed, setArmed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_ARMED_KEY) === "1";
    } catch {
      return false;
    }
  });

  const [soundTheme, setSoundThemeState] = useState<SoundTheme>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_THEME_KEY);
      if (saved === "zomato" || saved === "bell" || saved === "buzzer") return saved;
    } catch { /* ignore */ }
    return "zomato";
  });

  const [volume, setVolumeState] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_VOLUME_KEY);
      if (saved) {
        const val = parseFloat(saved);
        if (!isNaN(val) && val >= 0 && val <= 1) return val;
      }
    } catch { /* ignore */ }
    return 0.85;
  });

  const [queue, setQueue] = useState<Order[]>([]);
  const [muted, setMuted] = useState(false);
  const [toneSilenced, setToneSilenced] = useState(false);
  const [isRinging, setIsRinging] = useState(false);

  // Stable refs for interval callbacks
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const originalTitle = useRef<string>("");
  const soundThemeRef = useRef(soundTheme);
  soundThemeRef.current = soundTheme;
  const volumeRef = useRef(volume);
  volumeRef.current = volume;
  const mutedRef = useRef(muted);
  mutedRef.current = muted;

  // Initialize auto-unlock listener once on mount
  useEffect(() => {
    attachAudioAutoUnlock();
  }, []);

  const setSoundTheme = useCallback((theme: SoundTheme) => {
    setSoundThemeState(theme);
    try { localStorage.setItem(STORAGE_THEME_KEY, theme); } catch { /* ignore */ }
  }, []);

  const setVolume = useCallback((vol: number) => {
    const clamped = Math.max(0, Math.min(1, vol));
    setVolumeState(clamped);
    try { localStorage.setItem(STORAGE_VOLUME_KEY, clamped.toString()); } catch { /* ignore */ }
  }, []);

  const playAlertSound = useCallback(() => {
    if (mutedRef.current) return;
    const ctx = getAudioContext();
    if (ctx && ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }
    playAdminAlert(soundThemeRef.current, volumeRef.current);
  }, []);

  const testSound = useCallback(() => {
    const ctx = getAudioContext();
    if (ctx && ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }
    playAdminAlert(soundThemeRef.current, volumeRef.current);
  }, []);

  // ── Vibration ─────────────────────────────────────────────────────────── //
  const vibrate = useCallback(() => {
    try {
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        // Distinctive double-pulse vibration
        navigator.vibrate([250, 100, 250, 100, 400]);
      }
    } catch { /* ignore */ }
  }, []);

  // ── Start / Stop the alert loop ───────────────────────────────────────── //
  const stopLoop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsRinging(false);
    if (originalTitle.current) {
      try { document.title = originalTitle.current; } catch { /* server */ }
    }
  }, []);

  const startLoop = useCallback((count: number) => {
    stopLoop();
    if (count === 0) return;

    try {
      if (!originalTitle.current) originalTitle.current = document.title;
    } catch { /* server */ }

    setIsRinging(true);
    let titleFlip = false;
    const tick = () => {
      playAlertSound();
      vibrate();
      try {
        titleFlip = !titleFlip;
        document.title = titleFlip
          ? `🔔 NEW ORDER (${count})`
          : (originalTitle.current || "Ruchima Masala — Admin");
      } catch { /* server */ }
    };

    tick();
    intervalRef.current = setInterval(tick, 2800);
  }, [playAlertSound, vibrate, stopLoop]);

  // Restart loop when queue or armed state changes (unless user explicitly silenced the current tone)
  useEffect(() => {
    if (queue.length > 0 && armed && !toneSilenced) {
      startLoop(queue.length);
    } else {
      stopLoop();
    }
    return () => {};
  }, [queue.length, armed, toneSilenced, startLoop, stopLoop]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopLoop();
    };
  }, [stopLoop]);

  // ── Public API ─────────────────────────────────────────────────────────── //

  const arm = useCallback(async () => {
    const ctx = getAudioContext();
    if (ctx) {
      try {
        await ctx.resume();
      } catch { /* ignore */ }
    }

    try {
      if (typeof Notification !== "undefined" && Notification.permission === "default") {
        await Notification.requestPermission();
      }
    } catch { /* ignore */ }

    setArmed(true);
    try { localStorage.setItem(STORAGE_ARMED_KEY, "1"); } catch { /* ignore */ }

    // Play a friendly single-bell confirmation so the admin immediately hears sound works
    playAdminAlert(soundThemeRef.current, volumeRef.current);
  }, []);

  const pushNew = useCallback((orders: Order[]) => {
    if (orders.length === 0) return;

    // Reset silence flag for newly arrived orders
    setToneSilenced(false);

    setQueue((prev) => {
      const existing = new Set(prev.map((o) => o.id));
      const fresh = orders.filter((o) => !existing.has(o.id));
      if (fresh.length === 0) return prev;

      // Send OS Notification if permission granted
      for (const o of fresh) {
        try {
          if (typeof Notification !== "undefined" && Notification.permission === "granted") {
            const itemSummary = o.items.map((i) => `${i.name}×${i.qty}`).join(", ");
            const notif = new Notification(`🔔 New Order ${o.orderId}`, {
              body: `${o.customerName} (₹${o.grandTotal})\n${itemSummary}`,
              tag: o.id,
              icon: "/favicon.ico",
            });
            notif.onclick = () => {
              window.focus();
            };
          }
        } catch { /* ignore */ }
      }

      return [...prev, ...fresh];
    });
  }, []);

  const stopAlertTone = useCallback(() => {
    setToneSilenced(true);
    stopLoop();
  }, [stopLoop]);

  const acknowledgeOrder = useCallback((orderId: string) => {
    setQueue((prev) => {
      const next = prev.filter((o) => o.id !== orderId && o.orderId !== orderId);
      if (next.length === 0) {
        stopLoop();
        setToneSilenced(false);
      }
      return next;
    });
  }, [stopLoop]);

  const acknowledge = useCallback(() => {
    setQueue([]);
    setToneSilenced(false);
    stopLoop();
    try {
      if (originalTitle.current) document.title = originalTitle.current;
    } catch { /* server */ }
  }, [stopLoop]);

  const toggleMute = useCallback(() => setMuted((m) => !m), []);

  return {
    armed,
    queue,
    muted,
    isRinging,
    soundTheme,
    volume,
    arm,
    pushNew,
    acknowledgeOrder,
    acknowledge,
    stopAlertTone,
    toggleMute,
    setSoundTheme,
    setVolume,
    testSound,
  };
}
