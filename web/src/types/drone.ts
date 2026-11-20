import type { BatteryStatus } from "./battery";
import type { SeedStatus } from "./seed";

export interface MotorStatus {
  id: number;
  pwm: number;
  percent: number;
}

export interface DroneStatus {
  connected: boolean;
  mode: string | null;
  armed: boolean;
  lat: number | null;
  lon: number | null;
  alt: number | null;
  pitch: number | null;
  roll: number | null;
  yaw: number | null;
  speed: number | null;
  voltage: number | null;
  current: number | null;
  gps_fix: number | null;
  satellites: number | null;
  motors: MotorStatus[] | null;
  battery: BatteryStatus;
  seed: SeedStatus;
  avg_speed: number | null;
}

export interface TelemetrySample {
  time: number;
  lat: number | null;
  lon: number | null;
  alt: number | null;
  speed: number | null;
  yaw: number | null;
  voltage: number | null;
  current: number | null;
  battery: number | null;
  satellites: number | null;
  gps_fix: number | null;
  mode: string | null;
  armed: boolean;
  motors: MotorStatus[] | null;
  seed_remaining: number | null;
}
