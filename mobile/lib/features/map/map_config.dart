import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';

class DccMapConfig {
  const DccMapConfig._();

  static const LatLng siteCenter = LatLng(-6.8971983, 107.636371);
  static const double mapZoom = 16;
  static const double dashboardZoom = 17;
  static const double minZoom = 4;
  static const double maxZoom = 19;

  static const String tileUrl = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
  static const String userAgent = 'drone_command_center';
  static const String attribution = 'OpenStreetMap contributors';

  static const Color trail = Color(0xFF38BDF8);
  static const double droneMarkerSize = 22;

  static TileLayer tileLayer({
    required bool dark,
    required ErrorTileCallBack onTileError,
  }) {
    return TileLayer(
      urlTemplate: tileUrl,
      userAgentPackageName: userAgent,
      maxNativeZoom: 19,
      tileBuilder: dark ? darkModeTileBuilder : null,
      errorTileCallback: onTileError,
    );
  }
}
