import 'package:flutter/material.dart';

import '../../../core/config/app_config.dart';
import '../../../core/constants/api_endpoints.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/hud_panel.dart';
import '../../dashboard/providers/dashboard_provider.dart';
import '../widgets/mjpeg_viewer.dart';

class VideoPage extends StatelessWidget {
  const VideoPage({super.key, required this.provider});

  final DashboardProvider provider;

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<bool>(
      valueListenable: AppConfig.dummyMode,
      builder: (context, dummy, _) => _buildPage(context, dummy),
    );
  }

  Widget _buildPage(BuildContext context, bool dummy) {
    final c = context.dcc;
    final url = AppConfig.uri(ApiEndpoints.video).toString();
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 140),
      children: [
        Wrap(
          spacing: 6,
          runSpacing: 6,
          children: [
            const StatusPill('Kamera', tone: PillTone.info),
            if (dummy)
              const StatusPill('DUMMY FEED', tone: PillTone.info)
            else
              const StatusPill('MJPEG stream', tone: PillTone.info),
          ],
        ),
        const SizedBox(height: 10),
        HudPanel(
          title: 'Live video',
          meta: '/video',
          padding: EdgeInsets.zero,
          child: AspectRatio(
            aspectRatio: 16 / 10,
            child: DecoratedBox(
              decoration: BoxDecoration(color: c.inset),
              child: MjpegViewer(key: ValueKey(dummy), url: Uri.parse(url), dummy: dummy),
            ),
          ),
        ),
        const SizedBox(height: 10),
        HudPanel(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('ALAMAT STREAM', style: DccText.head(c.textMuted, size: 9, weight: FontWeight.w700, ls: 14)),
              const SizedBox(height: 4),
              Text(url, style: DccText.mono(c.text, size: 11)),
              const SizedBox(height: 10),
              Text(
                dummy
                    ? 'Mode dummy menampilkan feed sintetis tanpa membuka koneksi /video. Cocok untuk membandingkan layout sebelum kamera backend tersedia.'
                    : 'Stream berasal dari backend yang sama dengan telemetri. Jika kamera tidak tersedia, backend akan menolak koneksi dengan HTTP 503.',
                style: DccText.mono(c.textMuted, size: 10),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
