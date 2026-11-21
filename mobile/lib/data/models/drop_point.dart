class DropRecord {
  const DropRecord({
    required this.time,
    this.lat,
    this.lon,
    required this.thrust,
    required this.duration,
  });

  final double time;
  final double? lat;
  final double? lon;
  final double thrust;
  final double duration;

  factory DropRecord.fromJson(Map<String, dynamic> json) {
    return DropRecord(
      time: (json['time'] as num?)?.toDouble() ?? 0,
      lat: (json['lat'] as num?)?.toDouble(),
      lon: (json['lon'] as num?)?.toDouble(),
      thrust: (json['thrust'] as num?)?.toDouble() ?? 0,
      duration: (json['duration'] as num?)?.toDouble() ?? 0,
    );
  }
}
