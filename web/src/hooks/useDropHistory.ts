import { useEffect } from "react";
import { fetchDrops } from "../api/client";
import { useDroneStore } from "../store/droneStore";
import { useBackendUrl } from "./useBackendUrl";
import type { DropRecord } from "../types";

export function useDropHistory(lastDrop: DropRecord | null) {
  const drops = useDroneStore((state) => state.drops);
  const client = useDroneStore((state) => state.client);
  const pushDrop = useDroneStore((state) => state.pushDrop);
  const resetDrops = useDroneStore((state) => state.resetDrops);
  const backendUrl = useBackendUrl();

  useEffect(() => {
    if (!client) {
      return;
    }
    resetDrops();
    let cancelled = false;
    fetchDrops(backendUrl.apiUrl)
      .then((old) => {
        if (!cancelled) {
          useDroneStore.setState({ drops: old });
        }
      })
      .catch(() => {
        if (!cancelled) {
          useDroneStore.setState({ drops: [] });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [client, resetDrops, backendUrl.apiUrl]);

  useEffect(() => {
    if (!lastDrop) {
      return;
    }
    pushDrop(lastDrop);
  }, [lastDrop, pushDrop]);

  return drops;
}
