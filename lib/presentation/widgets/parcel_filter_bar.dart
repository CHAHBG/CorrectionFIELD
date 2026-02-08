import 'package:flutter/material.dart';

import '../../app/theme.dart';
import '../../domain/entities/parcel.dart';

/// Filter chips for parcel type selection.
class ParcelFilterBar extends StatelessWidget {
  const ParcelFilterBar({
    super.key,
    required this.currentFilter,
    required this.totalCount,
    required this.sansEnqueteCount,
    required this.sansNumeroCount,
    required this.onFilterChanged,
  });

  final String? currentFilter;
  final int totalCount;
  final int sansEnqueteCount;
  final int sansNumeroCount;
  final ValueChanged<String?> onFilterChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.95),
        borderRadius: BorderRadius.circular(14),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.08),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          _chip(
            label: 'Tout ($totalCount)',
            isSelected: currentFilter == null,
            color: AppTheme.primary,
            onTap: () => onFilterChanged(null),
          ),
          const SizedBox(width: 6),
          _chip(
            label: 'Sans enq. ($sansEnqueteCount)',
            isSelected: currentFilter == 'sans_enquete',
            color: AppTheme.sansEnquete,
            onTap: () => onFilterChanged('sans_enquete'),
          ),
          const SizedBox(width: 6),
          _chip(
            label: 'Sans num. ($sansNumeroCount)',
            isSelected: currentFilter == 'sans_numero',
            color: AppTheme.sansNumero,
            onTap: () => onFilterChanged('sans_numero'),
          ),
        ],
      ),
    );
  }

  Widget _chip({
    required String label,
    required bool isSelected,
    required Color color,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: isSelected ? color : Colors.transparent,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(
            color: isSelected ? color : color.withOpacity(0.3),
            width: 1.5,
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: isSelected ? Colors.white : color,
            fontWeight: FontWeight.w700,
            fontSize: 11,
          ),
        ),
      ),
    );
  }
}
