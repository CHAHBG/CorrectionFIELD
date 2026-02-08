import 'package:flutter/material.dart';

import '../../app/theme.dart';

/// Compact sync status indicator for the app bar.
class SyncStatusIndicator extends StatelessWidget {
  const SyncStatusIndicator({
    super.key,
    required this.pendingCount,
    this.isSyncing = false,
    this.onTap,
  });

  final int pendingCount;
  final bool isSyncing;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    if (isSyncing) {
      return IconButton(
        onPressed: null,
        icon: const SizedBox(
          width: 20,
          height: 20,
          child: CircularProgressIndicator(
            strokeWidth: 2.5,
            valueColor: AlwaysStoppedAnimation(Colors.white),
          ),
        ),
        tooltip: 'Synchronisation en cours...',
      );
    }

    return Stack(
      children: [
        IconButton(
          icon: Icon(
            pendingCount > 0 ? Icons.sync_problem : Icons.sync,
            color: Colors.white,
          ),
          onPressed: onTap,
          tooltip: pendingCount > 0
              ? '$pendingCount corrections à synchroniser'
              : 'Tout est synchronisé',
        ),
        if (pendingCount > 0)
          Positioned(
            right: 6,
            top: 6,
            child: Container(
              padding: const EdgeInsets.all(4),
              decoration: const BoxDecoration(
                color: AppTheme.gpsPoor,
                shape: BoxShape.circle,
              ),
              constraints: const BoxConstraints(minWidth: 18, minHeight: 18),
              child: Text(
                '$pendingCount',
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 10,
                  fontWeight: FontWeight.w700,
                ),
                textAlign: TextAlign.center,
              ),
            ),
          ),
      ],
    );
  }
}
