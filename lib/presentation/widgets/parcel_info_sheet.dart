import 'package:flutter/material.dart';

import '../../app/theme.dart';
import '../../domain/entities/parcel.dart';

/// Bottom sheet showing details of a selected parcel.
class ParcelInfoSheet extends StatelessWidget {
  const ParcelInfoSheet({
    super.key,
    required this.parcel,
    this.onCorrect,
    this.onKobo,
  });

  final Parcel parcel;
  final VoidCallback? onCorrect;
  final VoidCallback? onKobo;

  @override
  Widget build(BuildContext context) {
    final statusColor = AppTheme.statusColor(parcel.status.name);
    final typeColor = parcel.parcelType == ParcelType.sansEnquete
        ? AppTheme.sansEnquete
        : AppTheme.sansNumero;

    return Container(
      padding: const EdgeInsets.all(20),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Drag handle
          Center(
            child: Container(
              width: 40,
              height: 4,
              margin: const EdgeInsets.only(bottom: 16),
              decoration: BoxDecoration(
                color: Colors.grey[300],
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),

          // Title row
          Row(
            children: [
              Expanded(
                child: Text(
                  parcel.numParcel ?? 'Sans numéro',
                  style: const TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w800,
                    color: AppTheme.primary,
                  ),
                ),
              ),
              _statusChip(parcel.status.name, statusColor),
            ],
          ),

          const SizedBox(height: 12),

          // Info rows
          _infoRow('Type', _typeLabel(parcel.parcelType), typeColor),
          _infoRow('Commune', parcel.communeRef, AppTheme.primary),
          if (parcel.sourceFile != null)
            _infoRow('Source', parcel.sourceFile!, Colors.grey[700]!),
          if (parcel.layer != null)
            _infoRow('Couche', parcel.layer!, Colors.grey[700]!),

          const SizedBox(height: 20),

          // Action buttons
          Row(
            children: [
              if (parcel.needsCorrection) ...[
                Expanded(
                  child: ElevatedButton.icon(
                    onPressed: onCorrect,
                    icon: const Icon(Icons.edit_location_alt, size: 20),
                    label: const Text('Corriger'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppTheme.primary,
                    ),
                  ),
                ),
                const SizedBox(width: 12),
              ],
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: onKobo,
                  icon: const Icon(Icons.send, size: 20),
                  label: const Text('Kobo'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppTheme.primary,
                  ),
                ),
              ),
            ],
          ),

          const SizedBox(height: 8),
        ],
      ),
    );
  }

  Widget _statusChip(String label, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withOpacity(0.12),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color.withOpacity(0.4)),
      ),
      child: Text(
        label.toUpperCase(),
        style: TextStyle(
          color: color,
          fontWeight: FontWeight.w700,
          fontSize: 11,
        ),
      ),
    );
  }

  Widget _infoRow(String label, String value, Color valueColor) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          SizedBox(
            width: 90,
            child: Text(
              label,
              style: TextStyle(
                color: Colors.grey[500],
                fontWeight: FontWeight.w600,
                fontSize: 13,
              ),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: TextStyle(
                color: valueColor,
                fontWeight: FontWeight.w600,
                fontSize: 14,
              ),
            ),
          ),
        ],
      ),
    );
  }

  String _typeLabel(ParcelType type) {
    switch (type) {
      case ParcelType.sansEnquete:
        return 'Sans enquête';
      case ParcelType.sansNumero:
        return 'Sans numéro';
    }
  }
}
