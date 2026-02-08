import 'package:flutter/material.dart';

import '../../app/theme.dart';

/// Floating badge showing GPS accuracy with color coding.
///
/// Colors: vert ≤5m / orange 5–15m / rouge >15m
/// Designed for high-visibility under direct sunlight.
class GpsAccuracyBadge extends StatelessWidget {
  const GpsAccuracyBadge({
    super.key,
    required this.accuracyMeters,
    this.isTracking = true,
  });

  final double accuracyMeters;
  final bool isTracking;

  @override
  Widget build(BuildContext context) {
    final color = AppTheme.gpsColor(accuracyMeters);

    if (!isTracking) {
      return _buildBadge(
        color: Colors.grey,
        icon: Icons.gps_off,
        label: 'GPS off',
      );
    }

    return _buildBadge(
      color: color,
      icon: _iconForAccuracy(),
      label: '${accuracyMeters.toStringAsFixed(1)} m',
    );
  }

  IconData _iconForAccuracy() {
    if (accuracyMeters <= 5) return Icons.gps_fixed;
    if (accuracyMeters <= 15) return Icons.gps_not_fixed;
    return Icons.gps_off;
  }

  Widget _buildBadge({
    required Color color,
    required IconData icon,
    required String label,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.95),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: color, width: 2),
        boxShadow: [
          BoxShadow(
            color: color.withOpacity(0.25),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: color, size: 20),
          const SizedBox(width: 8),
          Text(
            label,
            style: TextStyle(
              color: color,
              fontWeight: FontWeight.w800,
              fontSize: 14,
            ),
          ),
        ],
      ),
    );
  }
}

