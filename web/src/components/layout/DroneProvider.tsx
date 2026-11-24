import type { ReactNode } from "react";
import { useDroneStatus } from "../../hooks/useDroneStatus";
import { useFlightLogRecorder } from "../../hooks/useFlightLogRecorder";

export function DroneProvider({ children }: { children: ReactNode }) {
  useDroneStatus();
  useFlightLogRecorder();
  return <>{children}</>;
}
