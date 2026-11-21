import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../core/constants/app_colors.dart';
import '../../core/theme/app_theme.dart';

/// Satu tujuan di menu radial. [ring] 0 = busur dalam, 1 = busur luar.
/// [angle] dalam derajat: 180 = kiri, 90 = atas, 0 = kanan.
class RadialItem {
  const RadialItem({required this.id, required this.label, required this.icon, required this.ring, required this.angle});

  final String id;
  final String label;
  final IconData icon;
  final int ring;
  final double angle;
}

/// Tombol bulat di tengah bawah. Saat ditekan, fitur-fitur muncul melingkar di dua busur.
/// Letakkan sebagai anak terakhir sebuah [Stack] yang memenuhi layar.
class RadialMenu extends StatefulWidget {
  const RadialMenu({
    super.key,
    required this.items,
    required this.activeId,
    required this.onSelect,
    this.onOpenChanged,
  });

  final List<RadialItem> items;
  final String activeId;
  final ValueChanged<String> onSelect;
  final ValueChanged<bool>? onOpenChanged;

  @override
  State<RadialMenu> createState() => _RadialMenuState();
}

class _RadialMenuState extends State<RadialMenu> with SingleTickerProviderStateMixin {
  static const _fabSize = 64.0;
  static const _itemSize = 48.0;
  static const _innerRadius = 92.0;
  static const _outerRadius = 160.0;

  late final AnimationController _controller = AnimationController(vsync: this, duration: const Duration(milliseconds: 280));
  late final Animation<double> _anim = CurvedAnimation(parent: _controller, curve: Curves.easeOutBack, reverseCurve: Curves.easeIn);
  bool _open = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _setOpen(bool value) {
    if (_open == value) return;
    setState(() => _open = value);
    value ? _controller.forward() : _controller.reverse();
    widget.onOpenChanged?.call(value);
  }

  void _select(String id) {
    _setOpen(false);
    widget.onSelect(id);
  }

  @override
  Widget build(BuildContext context) {
    final c = context.dcc;
    return LayoutBuilder(
      builder: (context, box) {
        final w = box.maxWidth;
        final h = box.maxHeight;
        final safeBottom = MediaQuery.of(context).padding.bottom;
        final center = Offset(w / 2, h - safeBottom - 46);
        // Perkecil busur di layar sempit agar tidak keluar layar.
        final k = math.min(1.0, (w / 2 - 34) / _outerRadius);
        final radii = [_innerRadius * k, _outerRadius * k];

        return AnimatedBuilder(
          animation: _anim,
          builder: (context, _) {
            final t = _anim.value;
            final tv = t.clamp(0.0, 1.0);
            return Stack(
              clipBehavior: Clip.none,
              children: [
                if (_controller.value > 0)
                  Positioned.fill(
                    child: GestureDetector(
                      behavior: HitTestBehavior.opaque,
                      onTap: () => _setOpen(false),
                      child: ColoredBox(color: withA(c.bg, 0.86 * tv)),
                    ),
                  ),
                if (_controller.value > 0)
                  Positioned.fill(
                    child: IgnorePointer(
                      child: CustomPaint(painter: _ArcPainter(center: center, radii: radii, opacity: tv, color: c.borderStrong)),
                    ),
                  ),
                for (final item in widget.items) _buildItem(context, item, center, radii, t, tv),
                Positioned(
                  left: center.dx - _fabSize / 2,
                  top: center.dy - _fabSize / 2,
                  child: _Fab(open: _open, onTap: () => _setOpen(!_open)),
                ),
              ],
            );
          },
        );
      },
    );
  }

  Widget _buildItem(BuildContext context, RadialItem item, Offset center, List<double> radii, double t, double tv) {
    final c = context.dcc;
    final r = radii[item.ring];
    final rad = item.angle * math.pi / 180;
    final target = Offset(center.dx + r * math.cos(rad), center.dy - r * math.sin(rad));
    final pos = Offset.lerp(center, target, t)!;
    final active = item.id == widget.activeId;
    const boxW = 72.0;

    return Positioned(
      left: pos.dx - boxW / 2,
      top: pos.dy - _itemSize / 2,
      width: boxW,
      child: IgnorePointer(
        ignoring: !_open,
        child: Opacity(
          opacity: tv,
          child: Transform.scale(
            scale: 0.6 + 0.4 * tv,
            child: Semantics(
              button: true,
              selected: active,
              label: item.label,
              child: ExcludeSemantics(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Material(
                      color: active ? c.accent : c.panel,
                      shape: CircleBorder(side: BorderSide(color: active ? c.accent : c.borderStrong)),
                      child: InkWell(
                        customBorder: const CircleBorder(),
                        onTap: () => _select(item.id),
                        child: SizedBox(
                          width: _itemSize,
                          height: _itemSize,
                          child: Icon(item.icon, size: 22, color: active ? c.accentInk : c.text),
                        ),
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      item.label,
                      maxLines: 1,
                      overflow: TextOverflow.visible,
                      style: DccText.head(active ? c.accent : c.textSecondary, size: 10, weight: FontWeight.w500, ls: 4),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _Fab extends StatelessWidget {
  const _Fab({required this.open, required this.onTap});

  final bool open;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final c = context.dcc;
    return Semantics(
      button: true,
      label: open ? 'Tutup menu' : 'Buka menu fitur',
      child: ExcludeSemantics(
        child: GestureDetector(
          onTap: onTap,
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            width: 64,
            height: 64,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: open ? c.raised : c.accent,
              border: open ? Border.all(color: c.accent, width: 2) : null,
              boxShadow: open ? null : [BoxShadow(color: withA(c.accent, 0.4), blurRadius: 18, offset: const Offset(0, 4))],
            ),
            child: AnimatedSwitcher(
              duration: const Duration(milliseconds: 200),
              child: Icon(
                open ? Icons.close_rounded : Icons.apps_rounded,
                key: ValueKey(open),
                size: 28,
                color: open ? c.accent : c.accentInk,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _ArcPainter extends CustomPainter {
  _ArcPainter({required this.center, required this.radii, required this.opacity, required this.color});

  final Offset center;
  final List<double> radii;
  final double opacity;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = withA(color, 0.8 * opacity)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.5;
    for (final r in radii) {
      final arc = Path()..addArc(Rect.fromCircle(center: center, radius: r), math.pi, math.pi);
      for (final m in arc.computeMetrics()) {
        for (double d = 0; d < m.length; d += 9) {
          canvas.drawPath(m.extractPath(d, math.min(d + 4, m.length)), paint);
        }
      }
    }
  }

  @override
  bool shouldRepaint(_ArcPainter old) => old.opacity != opacity || old.center != center || old.color != color || old.radii != radii;
}
