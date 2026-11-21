import 'battery_info.dart';
import 'diagnostics_info.dart';
import 'motor_info.dart';
import 'navigation_info.dart';
import 'seed_info.dart';

class DroneStatus {
  const DroneStatus({
    required this.connected,
    required this.armed,
    this.mode,
    this.lat,
    this.lon,
    this.alt,
    this.pitch,
    this.roll,
    this.yaw,
    this.speed,
    this.avgSpeed,
    this.voltage,
    this.current,
    this.gpsFix,
    this.satellites,
    this.battery = BatteryInfo.empty,
    this.seed = SeedInfo.empty,
    this.motors = const [],
    this.gps = GpsInfo.empty,
    this.nav = NavInfo.empty,
    this.mission = MissionInfo.empty,
    this.servo = ServoInfo.empty,
    this.schemaVersion,
    this.time = TimeInfo.empty,
    this.power = PowerInfo.empty,
    this.health = HealthInfo.empty,
    this.link = LinkInfo.empty,
    this.messages = const [],
  });

  final bool connected;
  final bool armed;
  final String? mode;
  final double? lat;
  final double? lon;
  final double? alt;
  final double? pitch;
  final double? roll;
  final double? yaw;
  final double? speed;
  final double? avgSpeed;
  final double? voltage;
  final double? current;
  final int? gpsFix;
  final int? satellites;
  final BatteryInfo battery;
  final SeedInfo seed;
  final List<MotorInfo> motors;
  final GpsInfo gps;
  final NavInfo nav;
  final MissionInfo mission;
  final ServoInfo servo;
  final int? schemaVersion;
  final TimeInfo time;
  final PowerInfo power;
  final HealthInfo health;
  final LinkInfo link;
  final List<StatusMessage> messages;

  factory DroneStatus.fromJson(Map<String, dynamic> json) {
    final battery = json['battery'];
    final seed = json['seed'];
    final time = json['time'];
    final power = json['power'];
    final gps = json['gps'];
    final nav = json['nav'];
    final mission = json['mission'];
    final servo = json['servo'];
    final health = json['health'];
    final link = json['link'];
    return DroneStatus(
      connected: json['connected'] as bool? ?? false,
      armed: json['armed'] as bool? ?? false,
      mode: json['mode'] as String?,
      lat: _num(json['lat']),
      lon: _num(json['lon']),
      alt: _num(json['alt']),
      pitch: _num(json['pitch']),
      roll: _num(json['roll']),
      yaw: _num(json['yaw']),
      speed: _num(json['speed']),
      avgSpeed: _num(json['avg_speed']),
      voltage: _num(json['voltage']),
      current: _num(json['current']),
      gpsFix: _int(json['gps_fix']),
      satellites: _int(json['satellites']),
      battery: battery is Map<String, dynamic>
          ? BatteryInfo.fromJson(battery)
          : BatteryInfo.empty,
      seed: seed is Map<String, dynamic> ? SeedInfo.fromJson(seed) : SeedInfo.empty,
      motors: (json['motors'] as List<dynamic>?)
              ?.whereType<Map<String, dynamic>>()
              .map(MotorInfo.fromJson)
              .toList() ??
          const [],
      gps: gps is Map<String, dynamic> ? GpsInfo.fromJson(gps) : GpsInfo.empty,
      nav: nav is Map<String, dynamic> ? NavInfo.fromJson(nav) : NavInfo.empty,
      mission: mission is Map<String, dynamic> ? MissionInfo.fromJson(mission) : MissionInfo.empty,
      servo: servo is Map<String, dynamic> ? ServoInfo.fromJson(servo) : ServoInfo.empty,
      schemaVersion: _int(json['schema_version']),
      time: time is Map<String, dynamic> ? TimeInfo.fromJson(time) : TimeInfo.empty,
      power: power is Map<String, dynamic> ? PowerInfo.fromJson(power) : PowerInfo.empty,
      health: health is Map<String, dynamic> ? HealthInfo.fromJson(health) : HealthInfo.empty,
      link: link is Map<String, dynamic> ? LinkInfo.fromJson(link) : LinkInfo.empty,
      messages: (json['messages'] as List<dynamic>?)
              ?.whereType<Map<String, dynamic>>()
              .map(StatusMessage.fromJson)
              .toList() ??
          const [],
    );
  }

  static const empty = DroneStatus(connected: false, armed: false);

  DroneStatus copyWith({
    bool? connected,
    bool? armed,
    String? mode,
    double? lat,
    double? lon,
    double? alt,
    double? pitch,
    double? roll,
    double? yaw,
    double? speed,
    double? avgSpeed,
    double? voltage,
    double? current,
    int? gpsFix,
    int? satellites,
    BatteryInfo? battery,
    SeedInfo? seed,
    List<MotorInfo>? motors,
    GpsInfo? gps,
    NavInfo? nav,
    MissionInfo? mission,
    ServoInfo? servo,
    int? schemaVersion,
    TimeInfo? time,
    PowerInfo? power,
    HealthInfo? health,
    LinkInfo? link,
    List<StatusMessage>? messages,
  }) {
    return DroneStatus(
      connected: connected ?? this.connected,
      armed: armed ?? this.armed,
      mode: mode ?? this.mode,
      lat: lat ?? this.lat,
      lon: lon ?? this.lon,
      alt: alt ?? this.alt,
      pitch: pitch ?? this.pitch,
      roll: roll ?? this.roll,
      yaw: yaw ?? this.yaw,
      speed: speed ?? this.speed,
      avgSpeed: avgSpeed ?? this.avgSpeed,
      voltage: voltage ?? this.voltage,
      current: current ?? this.current,
      gpsFix: gpsFix ?? this.gpsFix,
      satellites: satellites ?? this.satellites,
      battery: battery ?? this.battery,
      seed: seed ?? this.seed,
      motors: motors ?? this.motors,
      gps: gps ?? this.gps,
      nav: nav ?? this.nav,
      mission: mission ?? this.mission,
      servo: servo ?? this.servo,
      schemaVersion: schemaVersion ?? this.schemaVersion,
      time: time ?? this.time,
      power: power ?? this.power,
      health: health ?? this.health,
      link: link ?? this.link,
      messages: messages ?? this.messages,
    );
  }

  static double? _num(dynamic value) {
    if (value is num) return value.toDouble();
    return null;
  }

  static int? _int(dynamic value) {
    if (value is num) return value.toInt();
    if (value is String) return int.tryParse(value);
    return null;
  }
}
