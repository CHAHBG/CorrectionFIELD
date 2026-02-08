import 'dart:io';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/di/providers.dart';
import '../../app/theme.dart';

/// Screen for importing GeoPackage data from a directory.
class ImportScreen extends ConsumerStatefulWidget {
  const ImportScreen({super.key});

  @override
  ConsumerState<ImportScreen> createState() => _ImportScreenState();
}

class _ImportScreenState extends ConsumerState<ImportScreen> {
  bool _isImporting = false;
  String _status = '';
  Map<String, int>? _result;
  final _logs = <String>[];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Importer les données'),
      ),
      body: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Import GeoPackage',
              style: TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.w800,
                color: AppTheme.primary,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Sélectionnez le dossier contenant les sous-dossiers:\n'
              '• Communes Boundou Procasef/\n'
              '• Parcelles_sans_Enquete/\n'
              '• Parcelles_sans_Numero/',
              style: TextStyle(
                fontSize: 14,
                color: Colors.grey[600],
                height: 1.5,
              ),
            ),

            const SizedBox(height: 24),

            // Import button
            SizedBox(
              width: double.infinity,
              height: 54,
              child: ElevatedButton.icon(
                onPressed: _isImporting ? null : _selectAndImport,
                icon: _isImporting
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Icon(Icons.folder_open),
                label: Text(_isImporting
                    ? 'Import en cours...'
                    : 'Sélectionner le dossier data/'),
              ),
            ),

            const SizedBox(height: 16),

            // Status
            if (_status.isNotEmpty)
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: _result != null
                      ? AppTheme.gpsExcellent.withOpacity(0.1)
                      : AppTheme.accent.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  _status,
                  style: TextStyle(
                    fontWeight: FontWeight.w600,
                    color: _result != null
                        ? AppTheme.gpsExcellent
                        : AppTheme.primary,
                  ),
                ),
              ),

            // Results
            if (_result != null) ...[
              const SizedBox(height: 16),
              _resultRow('Communes importées', _result!['communes'] ?? 0),
              _resultRow(
                  'Parcelles sans enquête', _result!['sans_enquete'] ?? 0),
              _resultRow(
                  'Parcelles sans numéro', _result!['sans_numero'] ?? 0),
              _resultRow(
                'Total parcelles',
                (_result!['sans_enquete'] ?? 0) +
                    (_result!['sans_numero'] ?? 0),
              ),
            ],

            // Logs
            if (_logs.isNotEmpty) ...[
              const SizedBox(height: 16),
              const Text(
                'Journal',
                style: TextStyle(
                  fontWeight: FontWeight.w700,
                  color: AppTheme.primary,
                ),
              ),
              const SizedBox(height: 8),
              Expanded(
                child: Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF5F5F5),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: ListView.builder(
                    itemCount: _logs.length,
                    itemBuilder: (_, i) => Text(
                      _logs[i],
                      style: const TextStyle(
                        fontFamily: 'monospace',
                        fontSize: 11,
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _resultRow(String label, int count) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Expanded(
            child: Text(
              label,
              style: const TextStyle(fontWeight: FontWeight.w600),
            ),
          ),
          Text(
            '$count',
            style: const TextStyle(
              fontWeight: FontWeight.w800,
              color: AppTheme.primary,
              fontSize: 18,
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _selectAndImport() async {
    // Pick directory
    final result = await FilePicker.platform.getDirectoryPath();
    if (result == null) return;

    setState(() {
      _isImporting = true;
      _status = 'Importation depuis $result...';
      _result = null;
      _logs.clear();
    });

    try {
      final importer = ref.read(gpkgImportServiceProvider);
      final counts = await importer.importAllFromDirectory(result);

      setState(() {
        _isImporting = false;
        _result = counts;
        _status = '✅ Import terminé avec succès !';
        _logs.add(
            'Communes: ${counts['communes']}, Sans enquête: ${counts['sans_enquete']}, Sans numéro: ${counts['sans_numero']}');
      });
    } catch (e) {
      setState(() {
        _isImporting = false;
        _status = '❌ Erreur: $e';
        _logs.add('ERREUR: $e');
      });
    }
  }
}
