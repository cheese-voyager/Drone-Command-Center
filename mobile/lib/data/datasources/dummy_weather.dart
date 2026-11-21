import '../models/weather.dart';

class DummyWeatherForecast {
  DummyWeatherForecast._();

  static WeatherForecast build(double lat, double lon) {
    final now = DateTime.now().toUtc();
    final start = now.subtract(const Duration(hours: 3));
    final descriptions = [
      'Berawan',
      'Berawan sebagian',
      'Hujan ringan',
      'Hujan sedang',
      'Cerah berawan',
      'Berawan',
    ];
    final winds = [4.8, 5.6, 6.9, 8.2, 5.1, 4.3];
    final rains = [0.2, 0.4, 1.2, 3.8, 0.0, 0.1];
    final temps = [27.4, 28.1, 26.8, 25.9, 29.2, 28.4];

    final slots = List<WeatherSlot>.generate(12, (index) {
      final utc = start.add(Duration(hours: index * 3));
      final local = utc.add(const Duration(hours: 7));
      return WeatherSlot.fromJson(<String, dynamic>{
        'datetime': utc.toIso8601String(),
        'utc_datetime': utc.toIso8601String(),
        'local_datetime': local.toIso8601String(),
        't': temps[index % temps.length],
        'weather_desc': descriptions[index % descriptions.length],
        'ws': winds[index % winds.length],
        'wd': index.isEven ? 'BARAT' : 'BARAT LAUT',
        'hu': 72 + (index % 4) * 5,
        'tp': rains[index % rains.length],
        'vs_text': '> 10 km',
        'analysis_date': utc.toIso8601String(),
      });
    });

    final suffix = '${lat.toStringAsFixed(3)}, ${lon.toStringAsFixed(3)}';
    return WeatherForecast(
      location: 'Cibeunying Kaler, Kota Bandung, Jawa Barat · dummy ($suffix)',
      adm4: '3204050001',
      slots: slots,
    );
  }
}
