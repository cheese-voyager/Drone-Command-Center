class TimeInfo {
  const TimeInfo({this.utc, this.bootMs});

  final DateTime? utc;
  final int? bootMs;

  factory TimeInfo.fromJson(Map<String, dynamic> json) {
    return TimeInfo(
      utc: _dateTime(json['utc']),
      bootMs: _int(json['boot_ms']),
    );
  }

  static const empty = TimeInfo();
}

class PowerInfo {
  const PowerInfo({
    this.source,
    this.batteryId,
    this.remainingPercent,
    this.energyConsumedWh,
    this.energyCapacityWh,
    this.cellVoltagesV = const [],
    this.temperatureC,
    this.loadPercent,
    this.usbConnected,
    this.powerBrickOut,
  });

  final String? source;
  final int? batteryId;
  final double? remainingPercent;
  final double? energyConsumedWh;
  final double? energyCapacityWh;
  final List<double> cellVoltagesV;
  final double? temperatureC;
  final double? loadPercent;
  final bool? usbConnected;
  final bool? powerBrickOut;

  factory PowerInfo.fromJson(Map<String, dynamic> json) {
    return PowerInfo(
      source: json['source'] as String?,
      batteryId: _int(json['battery_id']),
      remainingPercent: _num(json['remaining_percent']),
      energyConsumedWh: _num(json['energy_consumed_wh']),
      energyCapacityWh: _num(json['energy_capacity_wh']),
      cellVoltagesV: (json['cell_voltages_v'] as List<dynamic>?)
              ?.map((value) => _num(value) ?? 0)
              .toList() ??
          const [],
      temperatureC: _num(json['temperature_c']),
      loadPercent: _num(json['load_percent']),
      usbConnected: json['usb_connected'] as bool?,
      powerBrickOut: json['power_brick_out'] as bool?,
    );
  }

  static const empty = PowerInfo();
}

class HealthInfo {
  const HealthInfo({
    this.prearmOk,
    this.ekfOk,
    this.ekfFlags,
    this.sensorPresent,
    this.sensorEnabled,
    this.sensorHealth,
    this.vibrationX,
    this.vibrationY,
    this.vibrationZ,
    this.clippingEvents,
    this.commDropRate,
    this.commErrors,
    this.failsafe = const [],
  });

  final bool? prearmOk;
  final bool? ekfOk;
  final int? ekfFlags;
  final int? sensorPresent;
  final int? sensorEnabled;
  final int? sensorHealth;
  final double? vibrationX;
  final double? vibrationY;
  final double? vibrationZ;
  final int? clippingEvents;
  final double? commDropRate;
  final int? commErrors;
  final List<String> failsafe;

  bool get hasAlerts => failsafe.isNotEmpty || ekfOk == false;

  factory HealthInfo.fromJson(Map<String, dynamic> json) {
    return HealthInfo(
      prearmOk: json['prearm_ok'] as bool?,
      ekfOk: json['ekf_ok'] as bool?,
      ekfFlags: _int(json['ekf_flags']),
      sensorPresent: _int(json['sensor_present']),
      sensorEnabled: _int(json['sensor_enabled']),
      sensorHealth: _int(json['sensor_health']),
      vibrationX: _num(json['vibration_x']),
      vibrationY: _num(json['vibration_y']),
      vibrationZ: _num(json['vibration_z']),
      clippingEvents: _int(json['clipping_events']),
      commDropRate: _num(json['comm_drop_rate']),
      commErrors: _int(json['comm_errors']),
      failsafe: (json['failsafe'] as List<dynamic>?)
              ?.map((value) => value.toString())
              .toList() ??
          const [],
    );
  }

  static const empty = HealthInfo();
}

class LinkInfo {
  const LinkInfo({
    this.rssi,
    this.remrssi,
    this.noise,
    this.remnoise,
    this.rxErrors,
    this.fixed,
    this.txbufPercent,
  });

  final int? rssi;
  final int? remrssi;
  final int? noise;
  final int? remnoise;
  final int? rxErrors;
  final int? fixed;
  final double? txbufPercent;

  factory LinkInfo.fromJson(Map<String, dynamic> json) {
    return LinkInfo(
      rssi: _int(json['rssi']),
      remrssi: _int(json['remrssi']),
      noise: _int(json['noise']),
      remnoise: _int(json['remnoise']),
      rxErrors: _int(json['rx_errors']),
      fixed: _int(json['fixed']),
      txbufPercent: _num(json['txbuf_percent']),
    );
  }

  static const empty = LinkInfo();
}

class StatusMessage {
  const StatusMessage({
    this.time,
    required this.text,
    this.severity = 0,
    this.component,
  });

  final DateTime? time;
  final String text;
  final int severity;
  final int? component;

  factory StatusMessage.fromJson(Map<String, dynamic> json) {
    return StatusMessage(
      time: _dateTime(json['time']),
      text: json['text']?.toString() ?? '',
      severity: _int(json['severity']) ?? 0,
      component: _int(json['component']),
    );
  }
}

double? _num(dynamic value) {
  if (value is num) return value.toDouble();
  return null;
}

int? _int(dynamic value) {
  if (value is num) return value.toInt();
  if (value is String) return int.tryParse(value);
  return null;
}

DateTime? _dateTime(dynamic value) {
  if (value is DateTime) return value;
  if (value is String) return DateTime.tryParse(value);
  return null;
}
