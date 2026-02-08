import 'package:flutter/material.dart';

import '../../app/theme.dart';

/// Chip displaying the current commune name.
///
/// Tapping opens the commune selector bottom sheet.
class CommuneChip extends StatelessWidget {
  const CommuneChip({
    super.key,
    required this.communeName,
    this.parcelCount,
    this.pendingCount,
    this.onTap,
  });

  final String communeName;
  final int? parcelCount;
  final int? pendingCount;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
        decoration: BoxDecoration(
          color: Colors.white.withOpacity(0.95),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppTheme.primary, width: 1.5),
          boxShadow: [
            BoxShadow(
              color: AppTheme.primary.withOpacity(0.15),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(
              Icons.location_city,
              color: AppTheme.primary,
              size: 18,
            ),
            const SizedBox(width: 8),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  communeName,
                  style: const TextStyle(
                    color: AppTheme.primary,
                    fontWeight: FontWeight.w800,
                    fontSize: 13,
                  ),
                ),
                if (parcelCount != null)
                  Text(
                    '$parcelCount parcelles · $pendingCount à corriger',
                    style: TextStyle(
                      color: AppTheme.primary.withOpacity(0.6),
                      fontWeight: FontWeight.w500,
                      fontSize: 10,
                    ),
                  ),
              ],
            ),
            const SizedBox(width: 4),
            Icon(
              Icons.expand_more,
              color: AppTheme.primary.withOpacity(0.5),
              size: 18,
            ),
          ],
        ),
      ),
    );
  }
}
