import { getStockSnapshot } from "@/api/StockApi";
import { applyStockUpdate } from "@/slices/stockSlice";
import { useAppDispatch } from "@/store/hooks";
import { StockUpdateMessage } from "@b2b/shared";
import { useEffect } from "react";

const WS_URL = "ws://localhost:4000/ws/stock";
const POLL_AFTER_ATTEMPTS = 2;
const POLL_INTERVAL = 5000;

export function useStockSocket() {
  const dispatch = useAppDispatch();

  useEffect(() => {
    let ws: WebSocket;
    let reconnectTimer: ReturnType<typeof setTimeout>;
    let pollTimer: ReturnType<typeof setInterval> | undefined;
    let attempt = 0;
    let stopped = false;

    const poll = async () => {
      try {
        const snapshot = await getStockSnapshot();
        const now = Date.now();
        snapshot.forEach((s) =>
          dispatch(applyStockUpdate({ ...s, updatedAt: now })),
        );
      } catch {
        // сеть недоступна — попробуем на следующем тике
      }
    };

    const startPolling = () => {
      if (pollTimer) return;
      poll();
      pollTimer = setInterval(poll, POLL_INTERVAL);
    };

    const stopPolling = () => {
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = undefined;
      }
    };

    const connect = () => {
      ws = new WebSocket(WS_URL);

      ws.onopen = () => {
        attempt = 0;
        stopPolling();
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as StockUpdateMessage;
          if (msg.type === "stock") dispatch(applyStockUpdate(msg));
        } catch {}
      };

      ws.onclose = () => {
        if (stopped) return;

        if (attempt >= POLL_AFTER_ATTEMPTS) startPolling();
        const delay = Math.min(1000 * 2 ** attempt, 30000);
        attempt += 1;
        reconnectTimer = setTimeout(connect, delay);
      };

      ws.onerror = () => ws.close();
    };

    connect();

    return () => {
      stopped = true;
      clearTimeout(reconnectTimer);
      stopPolling();
      ws?.close();
    };
  }, [dispatch]);
}
