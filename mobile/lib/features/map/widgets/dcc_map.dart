import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../data/models/drone_status.dart';
import '../../../../data/models/drop_point.dart';
import '../../../../data/services/telemetry_history.dart';
import '../map_config.dart';

class DccMap extends StatefulWidget {
  const DccMap({
    super.key,
    required this.status,
    required this.drops,
    this.path = const <TelemetrySample>[],
    this.showPath = true,
    this.showTiles = true,
    this.showControls = true,
    this.showLegend = true,
    this.showStatus = true,
    this.interactive = true,
    this.height = 240,
    this.zoom = DccMapConfig.mapZoom,
  });

  final DroneStatus status;
  final List<DropRecord> drops;
  final List<TelemetrySample> path;
  final bool showPath;
  final bool showTiles;
  final bool showControls;
  final bool showLegend;
  final bool showStatus;
  final bool interactive;
  final double height;
  final double zoom;

  @override
  State<DccMap> createState() => _DccMapState();
}

class _DccMapState extends State<DccMap> {
  final MapController _controller = MapController();

  bool _mapReady = false;
  bool _follow = true;
  bool _tileFailed = false;
  int _tileRetry = 0;
  double _zoomValue = DccMapConfig.mapZoom;
  LatLng? _lastDronePoint;

  LatLng? get _dronePoint {
    final lat = widget.status.lat;
    final lon = widget.status.lon;
    if (lat == null || lon == null) return null;
    return LatLng(lat, lon);
  }

  LatLng get _initialCenter => _dronePoint ?? DccMapConfig.siteCenter;

  @override
  void initState() {
    super.initState();
    _zoomValue = widget.zoom;
    _lastDronePoint = _dronePoint;
  }

  @override
  void didUpdateWidget(covariant DccMap oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.zoom != oldWidget.zoom) _zoomValue = widget.zoom;
    final next = _dronePoint;
    if (next == _lastDronePoint) return;
    _lastDronePoint = next;
    if (_follow && _mapReady && next != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _controller.move(next, _zoomValue);
      });
    }
  }

  void _zoom(double delta) {
    if (!_mapReady) return;
    final camera = _controller.camera;
    final next = (camera.zoom + delta).clamp(
      DccMapConfig.minZoom,
      DccMapConfig.maxZoom,
    );
    _zoomValue = next.toDouble();
    _controller.move(camera.center, _zoomValue);
  }

  void _recenter() {
    if (!_mapReady) return;
    setState(() => _follow = true);
    _controller.move(_dronePoint ?? DccMapConfig.siteCenter, _zoomValue);
  }

  void _retryTiles() {
    if (!widget.showTiles) return;
    setState(() {
      _tileFailed = false;
      _tileRetry++;
    });
  }

  @override
  Widget build(BuildContext context) {
    final c = context.dcc;
    final dark = Theme.of(context).brightness == Brightness.dark;
    final trail = widget.showPath
        ? widget.path
            .where((p) => p.lat != null && p.lon != null)
            .map((p) => LatLng(p.lat!, p.lon!))
            .toList()
        : <LatLng>[];
    final locatedDrops = widget.drops
        .asMap()
        .entries
        .where((entry) =>
            entry.value.lat != null && entry.value.lon != null)
        .toList();

    return SizedBox(
      height: widget.height,
      child: FlutterMap(
        mapController: _controller,
        options: MapOptions(
          initialCenter: _initialCenter,
          initialZoom: widget.zoom,
          minZoom: DccMapConfig.minZoom,
          maxZoom: DccMapConfig.maxZoom,
          backgroundColor: c.inset,
          keepAlive: true,
          interactionOptions: widget.interactive
              ? const InteractionOptions()
              : const InteractionOptions(flags: InteractiveFlag.none),
          onMapReady: () {
            if (!mounted) return;
            _mapReady = true;
            WidgetsBinding.instance.addPostFrameCallback((_) {
              if (mounted) {
                _controller.move(_initialCenter, _zoomValue);
              }
            });
          },
          onPositionChanged: (camera, hasGesture) {
            _zoomValue = camera.zoom;
            if (hasGesture && _follow && mounted) {
              setState(() => _follow = false);
            }
          },
        ),
        children: [
          if (widget.showTiles)
            KeyedSubtree(
              key: ValueKey(_tileRetry),
              child: DccMapConfig.tileLayer(
                dark: dark,
                onTileError: (_, __, ___) {
                  if (!mounted || _tileFailed) return;
                  setState(() => _tileFailed = true);
                },
              ),
            ),
          if (trail.length > 1)
            PolylineLayer(
              polylines: [
                Polyline(
                  points: trail,
                  strokeWidth: 8,
                  color: withA(DccMapConfig.trail, 0.18),
                ),
                Polyline(
                  points: trail,
                  strokeWidth: 4,
                  color: withA(DccMapConfig.trail, 0.9),
                ),
              ],
            ),
          if (locatedDrops.isNotEmpty)
            CircleLayer(
              circles: [
                for (final entry in locatedDrops)
                  CircleMarker(
                    point: LatLng(entry.value.lat!, entry.value.lon!),
                    radius: entry.key == 0 ? 7 : 6,
                    color: withA(entry.key == 0 ? c.ok : c.warn, 0.9),
                    borderColor: c.bg,
                    borderStrokeWidth: 2,
                  ),
              ],
            ),
          MarkerLayer(
            markers: [
              Marker(
                point: DccMapConfig.siteCenter,
                width: 64,
                height: 34,
                child: _SiteMarker(color: c.info),
              ),
              if (_dronePoint != null)
                Marker(
                  point: _dronePoint!,
                  width: 44,
                  height: 40,
                  child: _DroneMarker(color: c.accent, background: c.bg),
                ),
            ],
          ),
          Scalebar(
            alignment: Alignment.bottomLeft,
            padding: const EdgeInsets.only(left: 10, bottom: 70),
            textStyle: DccText.mono(c.textSecondary, size: 9),
            lineColor: c.textSecondary,
            strokeWidth: 1.5,
            lineHeight: 4,
            length: ScalebarLength.m,
          ),
          RichAttributionWidget(
            alignment: AttributionAlignment.bottomRight,
            permanentHeight: 18,
            showFlutterMapAttribution: false,
            popupBackgroundColor: withA(c.panel, 0.96),
            popupBorderRadius: BorderRadius.circular(3),
            attributions: [
              LogoSourceAttribution(
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 4),
                  color: withA(c.panel, 0.9),
                  child: Text(
                    '© OSM',
                    style: DccText.mono(c.textMuted, size: 8),
                  ),
                ),
                height: 18,
                tooltip: 'Data peta © OpenStreetMap contributors',
              ),
              TextSourceAttribution(
                'OpenStreetMap contributors',
                textStyle: DccText.mono(c.textMuted, size: 8),
              ),
            ],
            openButton: (_, open) => InkWell(
              onTap: open,
              child: Container(
                width: 18,
                height: 18,
                color: withA(c.panel, 0.9),
                child: Icon(Icons.info_outline, size: 10, color: c.textMuted),
              ),
            ),
            closeButton: (_, close) => InkWell(
              onTap: close,
              child: Container(
                width: 18,
                height: 18,
                color: withA(c.panel, 0.9),
                child: Icon(Icons.close, size: 10, color: c.textMuted),
              ),
            ),
          ),
          if (widget.showStatus)
            Positioned(
              left: 10,
              top: 10,
              child: _StatusChip(
                status: widget.status,
                dropCount: locatedDrops.length,
                color: c,
              ),
            ),
          if (_tileFailed)
            Positioned(
              left: 10,
              top: widget.showStatus ? 42 : 10,
              child: _Banner(
                text: 'TILE PETA TIDAK TERSEDIA · COBA LAGI',
                color: c.danger,
                onTap: _retryTiles,
              ),
            ),
          if (widget.showLegend)
            Positioned(
              left: 10,
              bottom: 10,
              child: _Legend(color: c, trailColor: DccMapConfig.trail),
            ),
          if (widget.showControls)
            Positioned(
              right: 10,
              top: 10,
              child: Column(
                children: [
                  _MapButton(
                    icon: Icons.add,
                    tooltip: 'Perbesar peta',
                    color: c,
                    onTap: () => _zoom(1),
                  ),
                  const SizedBox(height: 6),
                  _MapButton(
                    icon: Icons.remove,
                    tooltip: 'Perkecil peta',
                    color: c,
                    onTap: () => _zoom(-1),
                  ),
                  const SizedBox(height: 6),
                  _MapButton(
                    icon: _follow ? Icons.my_location : Icons.location_disabled,
                    tooltip: _follow ? 'Ikuti drone aktif' : 'Klik untuk ikuti drone',
                    color: c,
                    iconColor: _follow ? c.accent : c.textSecondary,
                    onTap: _recenter,
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

class _SiteMarker extends StatelessWidget {
  const _SiteMarker({required this.color});

  final Color color;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 18,
          height: 18,
          decoration: BoxDecoration(
            color: withA(color, 0.24),
            border: Border.all(color: color, width: 2),
            shape: BoxShape.circle,
          ),
          child: Icon(Icons.school_outlined, size: 10, color: color),
        ),
        const SizedBox(height: 2),
        Text('ITENAS', style: DccText.head(color, size: 8, weight: FontWeight.w700, ls: 10)),
      ],
    );
  }
}

class _DroneMarker extends StatelessWidget {
  const _DroneMarker({required this.color, required this.background});

  final Color color;
  final Color background;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: DccMapConfig.droneMarkerSize,
          height: DccMapConfig.droneMarkerSize,
          decoration: BoxDecoration(
            color: color,
            border: Border.all(color: background, width: 3),
            shape: BoxShape.circle,
            boxShadow: [
              BoxShadow(color: withA(color, 0.35), spreadRadius: 4, blurRadius: 14),
            ],
          ),
        ),
        const SizedBox(height: 2),
        Text('UAV', style: DccText.head(color, size: 8, weight: FontWeight.w700, ls: 10)),
      ],
    );
  }
}

class _StatusChip extends StatelessWidget {
  const _StatusChip({
    required this.status,
    required this.dropCount,
    required this.color,
  });

  final DroneStatus status;
  final int dropCount;
  final DccColors color;

  @override
  Widget build(BuildContext context) {
    final gps = status.gpsFix == null ? 'GPS --' : 'GPS ${status.gpsFix}D';
    final satellites = status.satellites?.toString() ?? '-';
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
      decoration: BoxDecoration(
        color: withA(color.panel, 0.9),
        border: Border.all(color: color.borderStrong),
        borderRadius: BorderRadius.circular(3),
      ),
      child: Text(
        '$gps · $satellites SAT · $dropCount DROP',
        style: DccText.mono(color.textSecondary, size: 9, ls: 6),
      ),
    );
  }
}

class _Banner extends StatelessWidget {
  const _Banner({required this.text, required this.color, this.onTap});

  final String text;
  final Color color;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      borderRadius: BorderRadius.circular(3),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(3),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          decoration: BoxDecoration(
            color: withA(color, 0.16),
            border: Border.all(color: withA(color, 0.5)),
            borderRadius: BorderRadius.circular(3),
          ),
          child: Text(text, style: DccText.mono(color, size: 9, weight: FontWeight.w700, ls: 6)),
        ),
      ),
    );
  }
}

class _Legend extends StatelessWidget {
  const _Legend({required this.color, required this.trailColor});

  final DccColors color;
  final Color trailColor;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
      decoration: BoxDecoration(
        color: withA(color.panel, 0.9),
        border: Border.all(color: color.borderStrong),
        borderRadius: BorderRadius.circular(3),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(width: 7, height: 7, decoration: BoxDecoration(color: color.accent, shape: BoxShape.circle)),
          const SizedBox(width: 4),
          Text('UAV', style: DccText.mono(color.textMuted, size: 8)),
          const SizedBox(width: 10),
          Container(width: 7, height: 7, decoration: BoxDecoration(color: withA(color.info, 0.24), border: Border.all(color: color.info, width: 1.5), shape: BoxShape.circle)),
          const SizedBox(width: 4),
          Text('SITE', style: DccText.mono(color.textMuted, size: 8)),
          const SizedBox(width: 10),
          Container(width: 14, height: 2, color: trailColor),
          const SizedBox(width: 4),
          Text('JALUR', style: DccText.mono(color.textMuted, size: 8)),
          const SizedBox(width: 10),
          Container(width: 7, height: 7, decoration: BoxDecoration(color: color.warn, shape: BoxShape.circle)),
          const SizedBox(width: 4),
          Text('DROP', style: DccText.mono(color.textMuted, size: 8)),
        ],
      ),
    );
  }
}

class _MapButton extends StatelessWidget {
  const _MapButton({
    required this.icon,
    required this.tooltip,
    required this.color,
    this.iconColor,
    required this.onTap,
  });

  final IconData icon;
  final String tooltip;
  final DccColors color;
  final Color? iconColor;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: tooltip,
      child: Material(
        color: withA(color.panel, 0.92),
        borderRadius: BorderRadius.circular(3),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(3),
          child: Container(
            width: 30,
            height: 30,
            decoration: BoxDecoration(
              border: Border.all(color: color.borderStrong),
              borderRadius: BorderRadius.circular(3),
            ),
            child: Icon(icon, size: 16, color: iconColor ?? color.accent),
          ),
        ),
      ),
    );
  }
}
