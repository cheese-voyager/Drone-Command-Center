class GpsInfo {
  const GpsInfo({
    this.fixType,
    this.satellitesVisible,
    this.hdop,
    this.vdop,
    this.altMslM,
    this.speedMps,
    this.cogDeg,
    this.rtkStatus,
  });

  final int? fixType;
  final int? satellitesVisible;
  final double? hdop;
  final double? vdop;
  final double? altMslM;
  final double? speedMps;
  final double? cogDeg;
  final String? rtkStatus;

  factory GpsInfo.fromJson(Map<String, dynamic> json) {
    return GpsInfo(
      fixType: _int(json['fix_type']),
      satellitesVisible: _int(json['satellites_visible']),
      hdop: _num(json['hdop']),
      vdop: _num(json['vdop']),
      altMslM: _num(json['alt_msl_m']),
      speedMps: _num(json['speed_mps']),
      cogDeg: _num(json['cog_deg']),
      rtkStatus: json['rtk_status'] as String?,
    );
  }

  static const empty = GpsInfo();
}

class NavInfo {
  const NavInfo({
    this.altAmslM,
    this.altRelM,
    this.airspeedMps,
    this.groundspeedMps,
    this.climbMps,
    this.throttlePercent,
    this.headingDeg,
    this.cogDeg,
    this.vxMps,
    this.vyMps,
    this.vzMps,
    this.windSpeedMps,
    this.windDirectionDeg,
    this.windSource,
    this.altAglM,
    this.altAglSource,
  });

  final double? altAmslM;
  final double? altRelM;
  final double? airspeedMps;
  final double? groundspeedMps;
  final double? climbMps;
  final double? throttlePercent;
  final double? headingDeg;
  final double? cogDeg;
  final double? vxMps;
  final double? vyMps;
  final double? vzMps;
  final double? windSpeedMps;
  final double? windDirectionDeg;
  final String? windSource;
  final double? altAglM;
  final String? altAglSource;

  factory NavInfo.fromJson(Map<String, dynamic> json) {
    return NavInfo(
      altAmslM: _num(json['alt_amsl_m']),
      altRelM: _num(json['alt_rel_m']),
      airspeedMps: _num(json['airspeed_mps']),
      groundspeedMps: _num(json['groundspeed_mps']),
      climbMps: _num(json['climb_mps']),
      throttlePercent: _num(json['throttle_percent']),
      headingDeg: _num(json['heading_deg']),
      cogDeg: _num(json['cog_deg']),
      vxMps: _num(json['vx_mps']),
      vyMps: _num(json['vy_mps']),
      vzMps: _num(json['vz_mps']),
      windSpeedMps: _num(json['wind_speed_mps']),
      windDirectionDeg: _num(json['wind_direction_deg']),
      windSource: json['wind_source'] as String?,
      altAglM: _num(json['alt_agl_m']),
      altAglSource: json['alt_agl_source'] as String?,
    );
  }

  static const empty = NavInfo();
}

class MissionInfo {
  const MissionInfo({
    this.currentWp,
    this.totalWp,
    this.nextWpLat,
    this.nextWpLon,
    this.wpDistanceM,
    this.targetBearingDeg,
    this.navBearingDeg,
    this.navRollDeg,
    this.navPitchDeg,
    this.xtrackErrorM,
    this.state,
  });

  final int? currentWp;
  final int? totalWp;
  final double? nextWpLat;
  final double? nextWpLon;
  final double? wpDistanceM;
  final double? targetBearingDeg;
  final double? navBearingDeg;
  final double? navRollDeg;
  final double? navPitchDeg;
  final double? xtrackErrorM;
  final String? state;

  factory MissionInfo.fromJson(Map<String, dynamic> json) {
    return MissionInfo(
      currentWp: _int(json['current_wp']),
      totalWp: _int(json['total_wp']),
      nextWpLat: _num(json['next_wp_lat']),
      nextWpLon: _num(json['next_wp_lon']),
      wpDistanceM: _num(json['wp_distance_m']),
      targetBearingDeg: _num(json['target_bearing_deg']),
      navBearingDeg: _num(json['nav_bearing_deg']),
      navRollDeg: _num(json['nav_roll_deg']),
      navPitchDeg: _num(json['nav_pitch_deg']),
      xtrackErrorM: _num(json['xtrack_error_m']),
      state: json['state'] as String?,
    );
  }

  static const empty = MissionInfo();
}

class ServoChannelInfo {
  const ServoChannelInfo({
    required this.channel,
    required this.pwm,
    this.percent,
    this.function,
  });

  final int channel;
  final int pwm;
  final double? percent;
  final String? function;

  factory ServoChannelInfo.fromJson(Map<String, dynamic> json) {
    return ServoChannelInfo(
      channel: _int(json['channel']) ?? 0,
      pwm: _int(json['pwm']) ?? 0,
      percent: _num(json['percent']),
      function: json['function'] as String?,
    );
  }
}

class LastDropInfo {
  const LastDropInfo({
    this.time,
    required this.channel,
    required this.pwm,
    required this.ackResult,
    this.dropId,
  });

  final DateTime? time;
  final int channel;
  final int pwm;
  final String ackResult;
  final String? dropId;

  factory LastDropInfo.fromJson(Map<String, dynamic> json) {
    return LastDropInfo(
      time: _dateTime(json['time']),
      channel: _int(json['channel']) ?? 0,
      pwm: _int(json['pwm']) ?? 0,
      ackResult: json['ack_result']?.toString() ?? 'UNKNOWN',
      dropId: json['drop_id'] as String?,
    );
  }
}

class ServoInfo {
  const ServoInfo({
    this.channels = const [],
    this.lastDrop,
  });

  final List<ServoChannelInfo> channels;
  final LastDropInfo? lastDrop;

  factory ServoInfo.fromJson(Map<String, dynamic> json) {
    return ServoInfo(
      channels: (json['channels'] as List<dynamic>?)
              ?.whereType<Map<String, dynamic>>()
              .map(ServoChannelInfo.fromJson)
              .toList() ??
          const [],
      lastDrop: json['last_drop'] is Map<String, dynamic>
          ? LastDropInfo.fromJson(json['last_drop'] as Map<String, dynamic>)
          : null,
    );
  }

  static const empty = ServoInfo();
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
