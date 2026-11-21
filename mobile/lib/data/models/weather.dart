class WeatherSlot {
  const WeatherSlot({
    this.datetime,
    this.localTime,
    this.temperature,
    this.description,
    this.windSpeed,
    this.windDirection,
    this.humidity,
    this.rain,
    this.visibility,
    this.analysisDate,
  });

  final String? datetime;
  final String? localTime;
  final double? temperature;
  final String? description;
  final double? windSpeed;
  final String? windDirection;
  final double? humidity;
  final double? rain;
  final String? visibility;
  final String? analysisDate;

  factory WeatherSlot.fromJson(Map<String, dynamic> json) {
    return WeatherSlot(
      datetime: json['datetime'] as String? ?? json['utc_datetime'] as String?,
      localTime: json['local_datetime'] as String?,
      temperature: (json['t'] as num?)?.toDouble(),
      description: json['weather_desc'] as String?,
      windSpeed: (json['ws'] as num?)?.toDouble(),
      windDirection: json['wd'] as String?,
      humidity: (json['hu'] as num?)?.toDouble(),
      rain: (json['tp'] as num?)?.toDouble(),
      visibility: json['vs_text'] as String?,
      analysisDate: json['analysis_date'] as String?,
    );
  }

  String get clock {
    final value = localTime;
    if (value != null && value.length >= 16) return value.substring(11, 16);
    return '--:--';
  }
}

class WeatherForecast {
  const WeatherForecast({
    required this.location,
    required this.adm4,
    required this.slots,
  });

  final String location;
  final String adm4;
  final List<WeatherSlot> slots;

  WeatherSlot? get current {
    if (slots.isEmpty) return null;
    final now = DateTime.now().toUtc();
    WeatherSlot? last;
    for (final slot in slots) {
      final parsed = DateTime.tryParse(slot.datetime ?? '');
      if (parsed == null) continue;
      final utc = parsed.isUtc ? parsed : parsed.toUtc();
      if (!utc.isAfter(now)) {
        last = slot;
      } else {
        break;
      }
    }
    return last ?? slots.first;
  }

  List<WeatherSlot> get upcoming {
    final now = DateTime.now().toUtc();
    return slots.where((slot) {
      final parsed = DateTime.tryParse(slot.datetime ?? '');
      if (parsed == null) return false;
      final utc = parsed.isUtc ? parsed : parsed.toUtc();
      return !utc.isBefore(now);
    }).take(8).toList();
  }
}
