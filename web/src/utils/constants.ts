export const ERROR_TEXT: Record<string, string> = {
  drone_not_connected: "Pixhawk belum terhubung",
  not_enough_seeds: "Benih tidak cukup, isi dulu benihnya",
  busy: "Thruster masih berjalan, tunggu sebentar",
  drone_armed: "Tes motor hanya boleh saat drone disarm",
  validation_error: "Nilai di luar batas",
  invalid_parameter: "Nilai tidak valid",
  mavlink_command_failed: "Perintah gagal terkirim ke Pixhawk",
  camera_unavailable: "Kamera tidak tersedia",
  internal_error: "Kesalahan internal",
};

export const GPS_FIX_NAMES: Record<number, string> = {
  0: "Tidak ada GPS",
  1: "Tidak ada fix",
  2: "2D fix",
  3: "3D fix",
  4: "DGPS",
  5: "RTK float",
  6: "RTK fixed",
};

export const THRUST_MIN_PERCENT = 0;
export const THRUST_MAX_PERCENT = 100;
export const MOTOR_TEST_MAX_PERCENT = 30;
export const MAX_DURATION_S = 10;
export const DEFAULT_TEST_THRUST_PERCENT = 20;
export const DEFAULT_TEST_DURATION_S = 2;

export const TEST_TARGETS: { label: string; value: string }[] = [
  { label: "Thruster penebar benih", value: "seeder" },
  { label: "Motor 1", value: "motor_1" },
  { label: "Motor 2", value: "motor_2" },
  { label: "Motor 3", value: "motor_3" },
  { label: "Motor 4", value: "motor_4" },
  { label: "Semua motor (berurutan 1-4)", value: "all_motors" },
];

export const DEFAULT_DROP_CONFIG = {
  servo_channel: 9,
  thrust_percent: 70,
  duration_s: 1.5,
  seeds_per_drop: 1,
  pwm_min: 1000,
  pwm_max: 2000,
};
