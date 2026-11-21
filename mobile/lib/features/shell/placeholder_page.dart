import 'package:flutter/material.dart';

import '../../core/constants/app_colors.dart';
import '../../core/theme/app_theme.dart';

/// Halaman yang desainnya belum dibuat.
class PlaceholderPage extends StatelessWidget {
  const PlaceholderPage({super.key, required this.title, required this.icon});

  final String title;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    final c = context.dcc;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 44, color: c.textMuted),
            const SizedBox(height: 16),
            Text(title.toUpperCase(), style: DccText.head(c.text, size: 18, weight: FontWeight.w700, ls: 8)),
            const SizedBox(height: 8),
            Text('Desain halaman ini menyusul.', style: TextStyle(color: c.textSecondary)),
          ],
        ),
      ),
    );
  }
}
