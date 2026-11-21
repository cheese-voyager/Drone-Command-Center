class DropConfigData {
  const DropConfigData({
    required this.servoChannel,
    required this.thrustPercent,
    required this.durationS,
    required this.seedsPerDrop,
    required this.pwmMin,
    required this.pwmMax,
  });

  final int servoChannel;
  final double thrustPercent;
  final double durationS;
  final int seedsPerDrop;
  final int pwmMin;
  final int pwmMax;

  factory DropConfigData.fromJson(Map<String, dynamic> json) {
    return DropConfigData(
      servoChannel: (json['servo_channel'] as num?)?.toInt() ?? 0,
      thrustPercent: (json['thrust_percent'] as num?)?.toDouble() ?? 0,
      durationS: (json['duration_s'] as num?)?.toDouble() ?? 0,
      seedsPerDrop: (json['seeds_per_drop'] as num?)?.toInt() ?? 0,
      pwmMin: (json['pwm_min'] as num?)?.toInt() ?? 0,
      pwmMax: (json['pwm_max'] as num?)?.toInt() ?? 0,
    );
  }
}
