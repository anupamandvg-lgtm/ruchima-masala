"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useAuth } from "./auth-context";
import { subscribeAllOrders } from "./db";
import { useOrderAlerts, type OrderAlertsHook } from "./useOrderAlerts";
import type { Order } from "@/types";

interface AdminAlertsContextValue {
  alerts: OrderAlertsHook;
  orders: Order[] | null;
  orderError: string | null;
  refreshOrders: () => void;
}

const AdminAlertsContext = createContext<AdminAlertsContextValue | null>(null);

export function AdminAlertsProvider({ children }: { children: ReactNode }) {
  const { isAdmin } = useAuth();
  const alerts = useOrderAlerts();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refreshOrders = () => {
    setOrders(null);
    setOrderError(null);
    setRefreshKey((k) => k + 1);
  };

  useEffect(() => {
    if (!isAdmin) return;

    const unsubscribe = subscribeAllOrders(
      (next) => {
        setOrderError(null);
        setOrders(next);
      },
      (errorMsg) => setOrderError(errorMsg),
      (fresh) => alerts.pushNew(fresh),
    );

    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, refreshKey]);

  return (
    <AdminAlertsContext.Provider value={{ alerts, orders, orderError, refreshOrders }}>
      {children}
    </AdminAlertsContext.Provider>
  );
}

export function useAdminAlerts(): AdminAlertsContextValue {
  const ctx = useContext(AdminAlertsContext);
  if (!ctx) {
    throw new Error("useAdminAlerts must be used within an AdminAlertsProvider");
  }
  return ctx;
}
