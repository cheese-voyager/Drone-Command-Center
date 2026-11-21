class BatteryInfo {
  const BatteryInfo({
    required this.capacityMah,
    required this.remainingMah,
    required this.remainingPercent,
    required this.low,
    this.estimatedMinutesLeft,
    this.usedMah = 0,
    this.avgCurrent = 0,
  });

  final int capacityMah;
  final double remainingMah;
  final double remainingPercent;
  final double? estimatedMinutesLeft;
  final bool low;
  final double usedMah;
  final double avgCurrent;

  factory BatteryInfo.fromJson(Map<String, dynamic> json) {
    return BatteryInfo(
      capacityMah: (json['capacity_mah'] as num?)?.toInt() ?? 0,
      remainingMah: (json['remaining_mah'] as num?)?.toDouble() ?? 0,
      remainingPercent: (json['remaining_percent'] as num?)?.toDouble() ?? 0,
      estimatedMinutesLeft: (json['estimated_minutes_left'] as num?)?.toDouble(),
      low: json['low'] as bool? ?? false,
      usedMah: (json['used_mah'] as num?)?.toDouble() ?? 0,
      avgCurrent: (json['avg_current'] as num?)?.toDouble() ?? 0,
    );
  }

  static const empty = BatteryInfo(
    capacityMah: 0,
    remainingMah: 0,
    remainingPercent: 0,
    low: false,
  );
}

class BatterySetup {
  const BatterySetup({
    required this.capacityMah,
    required this.cells,
    required this.minSafePercent,
  });

  final int capacityMah;
  final int cells;
  final int minSafePercent;

  Map<String, dynamic> toJson() => {
        'capacity_mah': capacityMah,
        'cells': cells,
        'min_safe_percent': minSafePercent,
      };
}
