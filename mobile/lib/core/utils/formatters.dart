String formatCoordinate(
  double? lat,
  double? lon, {
  int digits = 6,
  String empty = '--',
}) {
  if (lat == null || lon == null) return empty;
  return '${formatLatitude(lat, digits: digits, empty: empty)}, ${formatLongitude(lon, digits: digits, empty: empty)}';
}

String formatLatitude(
  double? value, {
  int digits = 6,
  String empty = '--',
}) =>
    _formatAxis(value, digits: digits, empty: empty);

String formatLongitude(
  double? value, {
  int digits = 6,
  String empty = '--',
}) =>
    _formatAxis(value, digits: digits, empty: empty);

String _formatAxis(double? value, {required int digits, required String empty}) {
  if (value == null || value.isNaN || value.isInfinite) return empty;
  final normalized = value.abs() < 0.5 / _pow10(digits) ? 0.0 : value;
  return normalized.toStringAsFixed(digits);
}

double _pow10(int exponent) {
  var value = 1.0;
  for (var i = 0; i < exponent; i++) {
    value *= 10;
  }
  return value;
}
