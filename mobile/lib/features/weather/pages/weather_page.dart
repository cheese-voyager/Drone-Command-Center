import 'package:flutter/material.dart';

import '../../../../core/config/app_config.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../data/datasources/weather_remote_datasource.dart';
import '../../../../data/models/weather.dart';
import '../../../../shared/widgets/hud_panel.dart';
import '../../dashboard/providers/dashboard_provider.dart';

class WeatherPage extends StatelessWidget {
  const WeatherPage({super.key, required this.provider});

  static const fallbackLat = -6.8971983;
  static const fallbackLon = 107.636371;

  final DashboardProvider provider;

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<bool>(
      valueListenable: AppConfig.dummyMode,
      builder: (context, dummy, _) {
        return AnimatedBuilder(
          animation: provider,
          builder: (context, _) {
            final status = provider.status;
            final lat = status.lat ?? fallbackLat;
            final lon = status.lon ?? fallbackLon;
            return _WeatherView(
              key: ValueKey('${lat.toStringAsFixed(2)},${lon.toStringAsFixed(2)},$dummy'),
              lat: lat,
              lon: lon,
              usingFallback: status.lat == null || status.lon == null,
              usingDummy: dummy,
            );
          },
        );
      },
    );
  }
}

class _WeatherView extends StatefulWidget {
  const _WeatherView({
    super.key,
    required this.lat,
    required this.lon,
    required this.usingFallback,
    required this.usingDummy,
  });

  final double lat;
  final double lon;
  final bool usingFallback;
  final bool usingDummy;

  @override
  State<_WeatherView> createState() => _WeatherViewState();
}

class _WeatherViewState extends State<_WeatherView> {
  final WeatherService _service = WeatherService();
  WeatherForecast? _forecast;
  String? _error;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _service.close();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final value = await _service.fetch(widget.lat, widget.lon);
      if (!mounted) return;
      setState(() => _forecast = value);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.dcc;
    final forecast = _forecast;
    final current = forecast?.current;
    final risk = _risk(current);
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 140),
      children: [
        Wrap(
          spacing: 6,
          runSpacing: 6,
          children: [
            if (widget.usingDummy)
              const StatusPill('DUMMY BMKG', tone: PillTone.info)
            else
              const StatusPill('BMKG live', tone: PillTone.info),
            if (widget.usingFallback) const StatusPill('Fallback ITENAS', tone: PillTone.warn),
            if (risk != null) StatusPill(risk.$1, tone: risk.$2),
          ],
        ),
        const SizedBox(height: 10),
        HudPanel(
          title: 'Prakiraan cuaca',
          meta: forecast?.adm4 ?? 'BMKG',
          padding: const EdgeInsets.all(14),
          child: _loading
              ? Padding(
                  padding: const EdgeInsets.symmetric(vertical: 28),
                  child: Center(child: CircularProgressIndicator(color: c.accent)),
                )
              : _error != null
                  ? Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Text(_error!, style: DccText.mono(c.warn, size: 11)),
                        const SizedBox(height: 12),
                        OutlinedButton.icon(
                          onPressed: _load,
                          icon: const Icon(Icons.refresh, size: 15),
                          label: Text('COBA LAGI', style: DccText.head(c.text, size: 12, weight: FontWeight.w700)),
                        ),
                      ],
                    )
                  : Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(forecast!.location, style: DccText.head(c.text, size: 13, weight: FontWeight.w700, ls: 6)),
                        const SizedBox(height: 14),
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              current?.temperature?.toStringAsFixed(0) ?? '--',
                              style: DccText.mono(c.accent, size: 48, weight: FontWeight.w700),
                            ),
                            Padding(
                              padding: const EdgeInsets.only(top: 8),
                              child: Text('°C', style: DccText.mono(c.textSecondary, size: 18)),
                            ),
                            const Spacer(),
                            SizedBox(
                              width: 120,
                              child: Text(
                                current?.description ?? 'Cuaca tidak tersedia',
                                style: DccText.head(c.text, size: 12, weight: FontWeight.w600, ls: 4),
                                textAlign: TextAlign.right,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 16),
                        Row(
                          children: [
                            Expanded(child: _Metric(label: 'Angin', value: '${current?.windSpeed?.toStringAsFixed(1) ?? '--'} m/s')),
                            const SizedBox(width: 8),
                            Expanded(child: _Metric(label: 'Kelembapan', value: '${current?.humidity?.round() ?? '--'}%')),
                          ],
                        ),
                        const SizedBox(height: 8),
                        Row(
                          children: [
                            Expanded(child: _Metric(label: 'Hujan', value: '${current?.rain?.toStringAsFixed(1) ?? '--'} mm')),
                            const SizedBox(width: 8),
                            Expanded(child: _Metric(label: 'Jarak pandang', value: current?.visibility ?? '--')),
                          ],
                        ),
                        const SizedBox(height: 8),
                        _Metric(label: 'Arah angin', value: current?.windDirection ?? '--'),
                      ],
                    ),
        ),
        const SizedBox(height: 10),
        HudPanel(
          title: 'Prakiraan berikutnya',
          padding: const EdgeInsets.all(12),
          child: forecast == null
              ? Text('Menunggu data BMKG...', style: DccText.mono(c.textMuted, size: 11))
              : Column(
                  children: [
                    for (final slot in forecast.upcoming)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: Row(
                          children: [
                            SizedBox(width: 42, child: Text(slot.clock, style: DccText.mono(c.textSecondary, size: 11))),
                            Expanded(child: Text(slot.description ?? '-', style: DccText.mono(c.text, size: 11))),
                            Text('${slot.temperature?.toStringAsFixed(0) ?? '--'}°', style: DccText.mono(c.accent, size: 12, weight: FontWeight.w700)),
                          ],
                        ),
                      ),
                  ],
                ),
        ),
      ],
    );
  }

  (String, PillTone)? _risk(WeatherSlot? slot) {
    if (slot == null) return null;
    final rain = slot.rain ?? 0;
    final wind = slot.windSpeed ?? 0;
    if (rain >= 5 || wind >= 12) return ('CUACA BURUK', PillTone.danger);
    if (rain >= 1 || wind >= 7) return ('WASPADA', PillTone.warn);
    return ('AMAN TERBANG', PillTone.ok);
  }
}

class _Metric extends StatelessWidget {
  const _Metric({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final c = context.dcc;
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(color: c.inset, border: Border.all(color: c.border), borderRadius: BorderRadius.circular(4)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label.toUpperCase(), style: DccText.head(c.textMuted, size: 8, weight: FontWeight.w600, ls: 12)),
          const SizedBox(height: 4),
          Text(value, style: DccText.mono(c.text, size: 13, weight: FontWeight.w600)),
        ],
      ),
    );
  }
}
