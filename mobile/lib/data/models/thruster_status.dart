class ThrusterResult {
  const ThrusterResult({
    required this.target,
    required this.thrust,
    required this.duration,
    this.pwm,
    this.totalDuration,
    this.stopped,
  });

  final String target;
  final double thrust;
  final double duration;
  final int? pwm;
  final double? totalDuration;
  final bool? stopped;

  factory ThrusterResult.fromJson(Map<String, dynamic> json) {
    return ThrusterResult(
      target: json['target'] as String? ?? 'seeder',
      thrust: (json['thrust'] as num?)?.toDouble() ?? 0,
      duration: (json['duration'] as num?)?.toDouble() ?? 0,
      pwm: (json['pwm'] as num?)?.toInt(),
      totalDuration: (json['total_duration'] as num?)?.toDouble(),
      stopped: json['stopped'] as bool?,
    );
  }
}
