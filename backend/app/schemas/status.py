from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.battery import BatteryStatus
from app.schemas.seed import SeedStatus


class MotorStatus(BaseModel):
    """Satu motor/propeler penggerak drone (bukan thruster penebar benih)."""

    id: int  # 1-4
    pwm: int  # output PWM dari Pixhawk (1000-2000)
    percent: float  # 0-100, dihitung dari PWM


class TimeInfo(BaseModel):
    utc: datetime
    boot_ms: int | None = None


class PowerInfo(BaseModel):
    source: str | None = None
    battery_id: int | None = None
    remaining_percent: float | None = None
    energy_consumed_wh: float | None = None
    energy_capacity_wh: float | None = None
    cell_voltages_v: list[float] | None = None
    temperature_c: float | None = None
    load_percent: float | None = None
    usb_connected: bool | None = None
    power_brick_out: bool | None = None


class GpsInfo(BaseModel):
    fix_type: int | None = None
    satellites_visible: int | None = None
    hdop: float | None = None
    vdop: float | None = None
    alt_msl_m: float | None = None
    speed_mps: float | None = None
    cog_deg: float | None = None
    rtk_status: str | None = None


class NavInfo(BaseModel):
    alt_amsl_m: float | None = None
    alt_rel_m: float | None = None
    airspeed_mps: float | None = None
    groundspeed_mps: float | None = None
    climb_mps: float | None = None
    throttle_percent: float | None = None
    heading_deg: float | None = None
    cog_deg: float | None = None
    vx_mps: float | None = None
    vy_mps: float | None = None
    vz_mps: float | None = None
    wind_speed_mps: float | None = None
    wind_direction_deg: float | None = None
    wind_source: str | None = None
    alt_agl_m: float | None = None
    alt_agl_source: str | None = None


class MissionInfo(BaseModel):
    current_wp: int | None = None
    total_wp: int | None = None
    next_wp_lat: float | None = None
    next_wp_lon: float | None = None
    wp_distance_m: float | None = None
    target_bearing_deg: float | None = None
    nav_bearing_deg: float | None = None
    nav_roll_deg: float | None = None
    nav_pitch_deg: float | None = None
    xtrack_error_m: float | None = None
    state: str | None = None


class HealthInfo(BaseModel):
    prearm_ok: bool | None = None
    ekf_ok: bool | None = None
    ekf_flags: int | None = None
    sensor_present: int | None = None
    sensor_enabled: int | None = None
    sensor_health: int | None = None
    vibration_x: float | None = None
    vibration_y: float | None = None
    vibration_z: float | None = None
    clipping_events: int | None = None
    comm_drop_rate: float | None = None
    comm_errors: int | None = None
    failsafe: list[str] = Field(default_factory=list)


class LinkInfo(BaseModel):
    rssi: int | None = None
    remrssi: int | None = None
    noise: int | None = None
    remnoise: int | None = None
    rx_errors: int | None = None
    fixed: int | None = None
    txbuf_percent: float | None = None


class ServoChannel(BaseModel):
    channel: int
    pwm: int
    percent: float | None = None
    function: str | None = None


class LastDrop(BaseModel):
    time: datetime
    channel: int
    pwm: int
    ack_result: str
    drop_id: str | None = None


class ServoInfo(BaseModel):
    channels: list[ServoChannel] = Field(default_factory=list)
    last_drop: LastDrop | None = None


class StatusMessage(BaseModel):
    time: datetime
    severity: int
    text: str
    component: int | None = None


class DroneStatus(BaseModel):
    """Isi `GET /status` dan setiap pesan `WS /ws`."""

    schema_version: int = 1
    connected: bool
    mode: str | None = None
    armed: bool
    lat: float | None = None
    lon: float | None = None
    alt: float | None = None
    pitch: float | None = None
    roll: float | None = None
    yaw: float | None = None
    speed: float | None = None
    voltage: float | None = None
    current: float | None = None
    gps_fix: int | None = None
    satellites: int | None = None
    motors: list[MotorStatus] | None = None  # 4 motor, None kalau belum ada data
    battery: BatteryStatus
    seed: SeedStatus
    gps: GpsInfo = Field(default_factory=GpsInfo)
    nav: NavInfo = Field(default_factory=NavInfo)
    mission: MissionInfo = Field(default_factory=MissionInfo)
    servo: ServoInfo = Field(default_factory=ServoInfo)
    avg_speed: float | None = None
    time: TimeInfo
    power: PowerInfo = Field(default_factory=PowerInfo)
    health: HealthInfo = Field(default_factory=HealthInfo)
    link: LinkInfo = Field(default_factory=LinkInfo)
    messages: list[StatusMessage] = Field(default_factory=list)
