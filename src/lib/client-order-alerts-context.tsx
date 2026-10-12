"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useAuth } from "./auth-context";
import { subscribeMyOrders } from "./db";
import {
  attachAudioAutoUnlock,
  getAudioContext,
  playCustomerChime,
  type CustomerAlertStatus,
} from "./audioAlerts";
import { BUSINESS } from "./config";
import type { Order, OrderStatus } from "@/types";

export interface ClientToastAlert {
  id: string; // unique toast id
  orderId: string;
  docId: string;
  status: OrderStatus;
  title: string;
  message: string;
  icon: string;
  itemsSummary: string;
  createdAt: number;
}

interface ClientOrderAlertsContextValue {
  toasts: ClientToastAlert[];
  dismissToast: (id: string) => void;
  soundEnabled: boolean;
  toggleSound: () => void;
  requestNotificationPermission: () => Promise<NotificationPermission>;
  notificationPermission: NotificationPermission | "unsupported";
}

const ClientOrderAlertsContext = createContext<ClientOrderAlertsContextValue | null>(null);

const STORAGE_SOUND_KEY = "rm-customer-sound-v1";

/**
 * Ruchima's equivalent of rakus-kitchen's ClientOrderAlertsProvider — same
 * mechanism (live subscribeMyOrders, status-transition diffing, chime +
 * toast + tab-flash + OS notification), remapped from rakus-kitchen's
 * Confirmed/Preparing/Out for Delivery/Ready for Pickup/Delivered/Cancelled
 * to Ruchima's own Placed/Paid/Packed/Shipped/Delivered/Cancelled/Refunded.
 */
export function ClientOrderAlertsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [toasts, setToasts] = useState<ClientToastAlert[]>([]);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_SOUND_KEY);
      return saved !== "0"; // default enabled
    } catch {
      return true;
    }
  });

  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | "unsupported">(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      return Notification.permission;
    }
    return "unsupported";
  });

  // Track previous statuses keyed by order doc ID
  const prevStatusesRef = useRef<Map<string, OrderStatus>>(new Map());
  const seededRef = useRef<boolean>(false);
  const originalTitleRef = useRef<string>("");
  const titleTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    attachAudioAutoUnlock();
  }, []);

  const toggleSound = () => {
    setSoundEnabled((prev) => {
      const next = !prev;
      try { localStorage.setItem(STORAGE_SOUND_KEY, next ? "1" : "0"); } catch { /* ignore */ }
      if (next) {
        playCustomerChime("placed");
      }
      return next;
    });
  };

  const requestNotificationPermission = async (): Promise<NotificationPermission> => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      return "denied";
    }
    try {
      const perm = await Notification.requestPermission();
      setNotificationPermission(perm);
      return perm;
    } catch {
      return "denied";
    }
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Flash tab title when a new alert occurs while the tab is blurred
  const flashTitle = (headline: string) => {
    if (typeof document === "undefined") return;
    if (!originalTitleRef.current) originalTitleRef.current = document.title;

    if (titleTimerRef.current) clearInterval(titleTimerRef.current);

    let flip = false;
    let ticks = 0;
    titleTimerRef.current = setInterval(() => {
      ticks++;
      flip = !flip;
      document.title = flip ? headline : (originalTitleRef.current || BUSINESS.name);
      if (ticks > 12) {
        if (titleTimerRef.current) clearInterval(titleTimerRef.current);
        document.title = originalTitleRef.current || BUSINESS.name;
      }
    }, 1500);

    const onFocus = () => {
      if (titleTimerRef.current) clearInterval(titleTimerRef.current);
      document.title = originalTitleRef.current || BUSINESS.name;
      window.removeEventListener("focus", onFocus);
    };
    window.addEventListener("focus", onFocus);
  };

  useEffect(() => {
    if (!user?.uid) {
      prevStatusesRef.current.clear();
      seededRef.current = false;
      return;
    }

    const unsubscribe = subscribeMyOrders(user.uid, (orders: Order[]) => {
      if (!seededRef.current) {
        // First snapshot seed: record existing statuses without alarming the customer
        orders.forEach((o) => prevStatusesRef.current.set(o.id, o.status));
        seededRef.current = true;
        return;
      }

      // Check each order for status transition
      for (const order of orders) {
        const prevStatus = prevStatusesRef.current.get(order.id);
        const currentStatus = order.status;

        // If status changed
        if (prevStatus && prevStatus !== currentStatus) {
          handleStatusTransition(order, currentStatus);
        }

        prevStatusesRef.current.set(order.id, currentStatus);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [user?.uid, soundEnabled]);

  const handleStatusTransition = (order: Order, newStatus: OrderStatus) => {
    const summary = order.items.map((i) => `${i.name} (x${i.qty})`).join(", ");
    let title = "";
    let message = "";
    let icon = "🧡";
    let chimeType: CustomerAlertStatus = "placed";

    switch (newStatus) {
      case "Placed":
        title = "Order Received";
        message = `Your order ${order.orderId} has been received and will be confirmed shortly.`;
        icon = "📝";
        chimeType = "placed";
        break;

      case "Paid":
        title = "Payment Confirmed ✅";
        message = `Payment for order ${order.orderId} is confirmed — we're processing it now.`;
        icon = "✅";
        chimeType = "paid";
        break;

      case "Packed":
        title = "Order Packed 📦";
        message = `Your order ${order.orderId} is packed and ready to ship!`;
        icon = "📦";
        chimeType = "packed";
        break;

      case "Shipped":
        title = "Shipped 🚚";
        message = `Your order ${order.orderId} is on its way!`;
        icon = "🚚";
        chimeType = "shipped";
        break;

      case "Delivered":
        title = "Delivered! 🎉";
        message = `Your order ${order.orderId} has arrived. Enjoy your masalas!`;
        icon = "🎉";
        chimeType = "delivered";
        break;

      case "Cancelled":
        title = "Order Cancelled";
        message = `Your order ${order.orderId} has been cancelled.`;
        icon = "🟠";
        chimeType = "cancelled";
        break;

      case "Refunded":
        title = "Order Refunded 💸";
        message = `Your refund for order ${order.orderId} has been processed.`;
        icon = "💸";
        chimeType = "cancelled";
        break;
    }

    // 1. Play consumer chime
    if (soundEnabled) {
      const ctx = getAudioContext();
      if (ctx && ctx.state === "suspended") ctx.resume().catch(() => {});
      playCustomerChime(chimeType);
    }

    // 2. Add floating in-app toast
    const toastId = `${order.id}-${newStatus}-${Date.now()}`;
    const newToast: ClientToastAlert = {
      id: toastId,
      orderId: order.orderId,
      docId: order.id,
      status: newStatus,
      title,
      message,
      icon,
      itemsSummary: summary,
      createdAt: Date.now(),
    };

    setToasts((prev) => [newToast, ...prev.slice(0, 2)]); // Keep max 3 toasts

    // Auto-dismiss toast after 7 seconds
    setTimeout(() => {
      dismissToast(toastId);
    }, 7000);

    // 3. Tab title flash
    flashTitle(`${icon} ${title} — ${BUSINESS.name}`);

    // 4. OS native notification if backgrounded and permitted
    try {
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        new Notification(`${icon} ${title}`, {
          body: `${message}\n${summary}`,
          tag: `rm-order-${order.id}`,
          icon: "/favicon.ico",
        });
      }
    } catch { /* ignore */ }
  };

  return (
    <ClientOrderAlertsContext.Provider
      value={{
        toasts,
        dismissToast,
        soundEnabled,
        toggleSound,
        requestNotificationPermission,
        notificationPermission,
      }}
    >
      {children}
    </ClientOrderAlertsContext.Provider>
  );
}

export function useClientOrderAlerts(): ClientOrderAlertsContextValue {
  const ctx = useContext(ClientOrderAlertsContext);
  if (!ctx) {
    throw new Error("useClientOrderAlerts must be used within a ClientOrderAlertsProvider");
  }
  return ctx;
}
