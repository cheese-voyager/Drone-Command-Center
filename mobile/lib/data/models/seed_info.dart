class SeedInfo {
  const SeedInfo({required this.loaded, required this.dropped, required this.remaining});

  final int loaded;
  final int dropped;
  final int remaining;

  factory SeedInfo.fromJson(Map<String, dynamic> json) {
    return SeedInfo(
      loaded: (json['loaded'] as num?)?.toInt() ?? 0,
      dropped: (json['dropped'] as num?)?.toInt() ?? 0,
      remaining: (json['remaining'] as num?)?.toInt() ?? 0,
    );
  }

  static const empty = SeedInfo(loaded: 0, dropped: 0, remaining: 0);
}
