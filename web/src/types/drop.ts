export interface DropRecord {
  time: number;
  lat: number | null;
  lon: number | null;
  thrust: number;
  duration: number;
}

export interface DropConfig {
  servo_channel: number;
  thrust_percent: number;
  duration_s: number;
  seeds_per_drop: number;
  pwm_min: number;
  pwm_max: number;
}

export interface DropConfigRequest {
  thrust_percent?: number | null;
  duration_s?: number | null;
}

export type TestTarget =
  | "seeder"
  | "motor_1"
  | "motor_2"
  | "motor_3"
  | "motor_4"
  | "all_motors";

export interface ThrusterTestRequest {
  target: TestTarget;
  thrust_percent: number;
  duration_s: number;
}

export interface ThrusterTestResponse {
  target: string;
  thrust: number;
  duration: number;
  pwm: number | null;
  total_duration: number | null;
}

export interface ThrusterStopResponse {
  stopped: boolean;
}

export interface CommandResponse<T = unknown> {
  cmd: string;
  ok: boolean;
  request_id?: string | number;
  data?: T;
  error?: { code: string; detail: string };
}

export type CommandName =
  | "drop"
  | "drop-config"
  | "seed-load"
  | "battery"
  | "thruster-test"
  | "thruster-stop";

export interface MqttTopics {
  online: string;
  status: string;
  drop_event: string;
  response: string;
  commands: Record<string, string>;
}

export interface MqttInfo {
  enabled: boolean;
  commands_enabled: boolean;
  connected: boolean;
  host: string;
  port: number;
  ws_port: number;
  base_topic: string;
  topics: MqttTopics;
}
