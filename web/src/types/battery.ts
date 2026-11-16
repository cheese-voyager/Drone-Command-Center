export interface BatteryConfig {
  capacity_mah: number;
  cells: number;
  min_safe_percent: number;
}

export interface BatteryStatus {
  capacity_mah: number;
  used_mah: number;
  remaining_mah: number;
  remaining_percent: number;
  avg_current: number | null;
  estimated_minutes_left: number | null;
  low: boolean;
}
