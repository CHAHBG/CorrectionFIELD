import 'package:flutter/material.dart';

class GpsAccuracyBadge extends StatelessWidget {
  const GpsAccuracyBadge({super.key, required this.accuracyMeters});

  final double accuracyMeters;

  Color _colorForAccuracy(double value) {
    if (value <= 5) {
      return const Color(0xFF0F9D58);
    }
    if (value <= 15) {
      return const Color(0xFFF4B400);
    }
    return const Color(0xFFDB4437);
  }

  @override
  Widget build(BuildContext context) {
    final color = _colorForAccuracy(accuracyMeters);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: color.withOpacity(0.15),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color, width: 1.5),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.gps_fixed, color: color, size: 18),
          const SizedBox(width: 6),
          Text(
            '${accuracyMeters.toStringAsFixed(1)} m',
            style: TextStyle(color: color, fontWeight: FontWeight.w700),
          ),
        ],
      ),
    );
  }
}
