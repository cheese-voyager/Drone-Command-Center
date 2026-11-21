class MotorInfo {
  const MotorInfo({required this.id, required this.pwm, required this.percent});

  final int id;
  final int pwm;
  final double percent;

  factory MotorInfo.fromJson(Map<String, dynamic> json) {
    return MotorInfo(
      id: (json['id'] as num?)?.toInt() ?? 0,
      pwm: (json['pwm'] as num?)?.toInt() ?? 0,
      percent: (json['percent'] as num?)?.toDouble() ?? 0,
    );
  }
}
