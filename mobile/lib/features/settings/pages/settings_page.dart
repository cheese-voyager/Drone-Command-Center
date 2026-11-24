import 'package:flutter/material.dart';

import '../../../core/config/app_config.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/hud_panel.dart';
import '../../dashboard/providers/dashboard_provider.dart';

class SettingsPage extends StatefulWidget {
  const SettingsPage({super.key, required this.provider});

  final DashboardProvider provider;

  @override
  State<SettingsPage> createState() => _SettingsPageState();
}

class _SettingsPageState extends State<SettingsPage> {
  late final TextEditingController _controller;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(text: AppConfig.backendUrl.value);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _toggleDummy(bool value) {
    setState(() => AppConfig.dummyMode.value = value);
    final c = context.dcc;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          value
              ? 'Mode dummy aktif untuk seluruh fitur.'
              : 'Mode dummy nonaktif. Data diambil dari backend.',
          style: DccText.mono(c.text),
        ),
      ),
    );
  }

  void _save() {
    final c = context.dcc;
    final raw = _controller.text.trim();
    final uri = Uri.tryParse(raw);
    if (uri == null || !uri.hasScheme || !['http', 'https'].contains(uri.scheme) || uri.host.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('URL tidak valid. Contoh: ${AppConfig.defaultBackendUrl}', style: DccText.mono(c.text))),
      );
      return;
    }
    AppConfig.backendUrl.value = raw.replaceAll(RegExp(r'/+$'), '');
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Backend diubah ke ${AppConfig.backendUrl.value}', style: DccText.mono(c.text))),
    );
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: widget.provider,
      builder: (context, _) => _build(context),
    );
  }

  Widget _build(BuildContext context) {
    final c = context.dcc;
    final provider = widget.provider;
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 140),
      children: [
        HudPanel(
          title: 'Sumber data',
          meta: AppConfig.dummyMode.value ? 'DUMMY' : 'BACKEND',
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                value: AppConfig.dummyMode.value,
                onChanged: _toggleDummy,
                activeThumbColor: c.accent,
                title: Text('Mode data dummy', style: DccText.head(c.text, size: 12, weight: FontWeight.w700, ls: 8)),
                subtitle: Text(
                  'Mengisi semua menu dengan payload berbentuk sama seperti backend: status, drop, MQTT, baterai, benih, cuaca, dan kamera.',
                  style: DccText.mono(c.textMuted, size: 10),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 10),
        HudPanel(
          title: 'Status koneksi',
          padding: const EdgeInsets.all(12),
          child: Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              StatusPill(
                provider.backendOnline ? 'BACKEND ONLINE' : 'BACKEND OFFLINE',
                tone: provider.backendOnline ? PillTone.ok : PillTone.danger,
              ),
              StatusPill(
                provider.mqtt?.connected == true ? 'MQTT TERHUBUNG' : 'MQTT TIDAK TERHUBUNG',
                tone: provider.mqtt?.connected == true ? PillTone.ok : PillTone.warn,
              ),
              StatusPill(
                provider.status.connected ? 'PIXHAWK AKTIF' : 'PIXHAWK STANDBY',
                tone: provider.status.connected ? PillTone.ok : PillTone.warn,
              ),
            ],
          ),
        ),
        const SizedBox(height: 10),
        HudPanel(
          title: 'Koneksi backend',
          meta: 'REST',
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text('ALAMAT SERVER', style: DccText.head(c.textSecondary, size: 10, ls: 12)),
              const SizedBox(height: 8),
              TextField(
                controller: _controller,
                keyboardType: TextInputType.url,
                autocorrect: false,
                style: DccText.mono(c.text, size: 13),
                decoration: InputDecoration(
                  hintText: AppConfig.defaultBackendUrl,
                  hintStyle: DccText.mono(c.textMuted, size: 12),
                  filled: true,
                  fillColor: c.raised,
                  contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(4),
                    borderSide: BorderSide(color: c.borderStrong),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(4),
                    borderSide: BorderSide(color: c.borderStrong),
                  ),
                ),
              ),
              const SizedBox(height: 12),
              SizedBox(
                height: 46,
                child: FilledButton.icon(
                  style: FilledButton.styleFrom(
                    backgroundColor: c.accent,
                    foregroundColor: c.accentInk,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
                  ),
                  onPressed: _save,
                  icon: const Icon(Icons.link, size: 18),
                  label: Text('SIMPAN & HUBUNGKAN', style: DccText.head(c.accentInk, size: 13, weight: FontWeight.w700, ls: 8)),
                ),
              ),
              const SizedBox(height: 12),
              Text(
                'Gunakan IP Wi-Fi komputer backend, bukan localhost. Dashboard akan memuat ulang data otomatis.',
                style: DccText.mono(c.textMuted, size: 10),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
