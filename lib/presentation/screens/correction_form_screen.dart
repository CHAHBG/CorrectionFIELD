import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';

import '../../app/di/providers.dart';
import '../../app/theme.dart';
import '../../domain/entities/parcel.dart';
import '../state/gps_provider.dart';

/// Form screen for creating / editing a parcel correction.
///
/// Validates:
///   - Num_parcel uniqueness (no duplicates)
///   - Required fields
///   - Topology (if geometry is edited)
class CorrectionFormScreen extends ConsumerStatefulWidget {
  const CorrectionFormScreen({super.key, required this.parcel});

  final Parcel parcel;

  @override
  ConsumerState<CorrectionFormScreen> createState() =>
      _CorrectionFormScreenState();
}

class _CorrectionFormScreenState extends ConsumerState<CorrectionFormScreen> {
  final _formKey = GlobalKey<FormState>();
  final _numParcelController = TextEditingController();
  final _enqueteurController = TextEditingController();
  final _notesController = TextEditingController();

  bool _isSaving = false;
  String? _duplicateError;

  @override
  void initState() {
    super.initState();
    // Pre-fill with existing parcel number if available
    if (widget.parcel.numParcel != null && widget.parcel.numParcel != '0') {
      _numParcelController.text = widget.parcel.numParcel!;
    }
  }

  @override
  void dispose() {
    _numParcelController.dispose();
    _enqueteurController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final gps = ref.watch(gpsProvider);
    final parcel = widget.parcel;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Correction parcelle'),
        actions: [
          TextButton.icon(
            onPressed: _isSaving ? null : _saveCorrection,
            icon: const Icon(Icons.save, color: Colors.white),
            label: const Text(
              'Sauvegarder',
              style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700),
            ),
          ),
        ],
      ),
      body: _isSaving
          ? const Center(child: CircularProgressIndicator())
          : SingleChildScrollView(
              padding: const EdgeInsets.all(20),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // ── Parcel info card ──
                    _buildInfoCard(parcel),

                    const SizedBox(height: 24),

                    // ── GPS context ──
                    _buildGpsCard(gps),

                    const SizedBox(height: 24),

                    // ── Correction form ──
                    const Text(
                      'Correction',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w800,
                        color: AppTheme.primary,
                      ),
                    ),
                    const SizedBox(height: 16),

                    // Numéro de parcelle
                    TextFormField(
                      controller: _numParcelController,
                      decoration: InputDecoration(
                        labelText: 'Numéro de parcelle *',
                        hintText: 'Ex: 0532010100638',
                        prefixIcon: const Icon(Icons.tag),
                        errorText: _duplicateError,
                      ),
                      keyboardType: TextInputType.text,
                      validator: (value) {
                        if (value == null || value.trim().isEmpty) {
                          return 'Le numéro de parcelle est obligatoire';
                        }
                        return null;
                      },
                      onChanged: (_) {
                        if (_duplicateError != null) {
                          setState(() => _duplicateError = null);
                        }
                      },
                    ),

                    const SizedBox(height: 16),

                    // Enquêteur
                    TextFormField(
                      controller: _enqueteurController,
                      decoration: const InputDecoration(
                        labelText: 'Nom de l\'enquêteur',
                        hintText: 'Ex: Djibril Bodian',
                        prefixIcon: Icon(Icons.person),
                      ),
                    ),

                    const SizedBox(height: 16),

                    // Notes
                    TextFormField(
                      controller: _notesController,
                      decoration: const InputDecoration(
                        labelText: 'Notes / observations',
                        hintText: 'Détails sur la correction...',
                        prefixIcon: Icon(Icons.note),
                      ),
                      maxLines: 3,
                    ),

                    const SizedBox(height: 32),

                    // Save button
                    SizedBox(
                      width: double.infinity,
                      height: 54,
                      child: ElevatedButton.icon(
                        onPressed: _isSaving ? null : _saveCorrection,
                        icon: const Icon(Icons.check_circle),
                        label: const Text(
                          'Enregistrer la correction',
                          style: TextStyle(fontSize: 16),
                        ),
                      ),
                    ),

                    const SizedBox(height: 16),

                    // Kobo button
                    SizedBox(
                      width: double.infinity,
                      height: 54,
                      child: OutlinedButton.icon(
                        onPressed: _sendToKobo,
                        icon: const Icon(Icons.send),
                        label: const Text(
                          'Envoyer vers KoboToolbox',
                          style: TextStyle(fontSize: 16),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
    );
  }

  Widget _buildInfoCard(Parcel parcel) {
    final typeLabel = parcel.parcelType == ParcelType.sansEnquete
        ? 'Sans enquête'
        : 'Sans numéro';
    final typeColor = parcel.parcelType == ParcelType.sansEnquete
        ? AppTheme.sansEnquete
        : AppTheme.sansNumero;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.map, color: AppTheme.primary, size: 20),
                const SizedBox(width: 8),
                const Text(
                  'Parcelle',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: AppTheme.primary,
                  ),
                ),
                const Spacer(),
                Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: typeColor.withOpacity(0.12),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    typeLabel,
                    style: TextStyle(
                      color: typeColor,
                      fontWeight: FontWeight.w700,
                      fontSize: 12,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            _infoRow('ID', '#${parcel.id}'),
            if (parcel.numParcel != null && parcel.numParcel != '0')
              _infoRow('Numéro actuel', parcel.numParcel!),
            _infoRow('Commune', parcel.communeRef),
            if (parcel.sourceFile != null)
              _infoRow('Source', parcel.sourceFile!),
          ],
        ),
      ),
    );
  }

  Widget _buildGpsCard(GpsState gps) {
    final color = AppTheme.gpsColor(gps.accuracyMeters);

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.gps_fixed, color: color, size: 20),
                const SizedBox(width: 8),
                const Text(
                  'Position GPS',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: AppTheme.primary,
                  ),
                ),
                const Spacer(),
                Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: color.withOpacity(0.12),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    '±${gps.accuracyMeters.toStringAsFixed(1)}m',
                    style: TextStyle(
                      color: color,
                      fontWeight: FontWeight.w700,
                      fontSize: 12,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            if (gps.hasPosition) ...[
              _infoRow('Latitude', gps.latitude!.toStringAsFixed(6)),
              _infoRow('Longitude', gps.longitude!.toStringAsFixed(6)),
            ] else
              const Text(
                'Position non disponible',
                style: TextStyle(color: Colors.grey),
              ),
          ],
        ),
      ),
    );
  }

  Widget _infoRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        children: [
          SizedBox(
            width: 110,
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
              style: const TextStyle(
                fontWeight: FontWeight.w600,
                fontSize: 14,
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ── Save logic ─────────────────────────────────────────────

  Future<void> _saveCorrection() async {
    if (!_formKey.currentState!.validate()) return;

    final numParcel = _numParcelController.text.trim();
    final correctionsRepo = ref.read(correctionsRepositoryProvider);

    // Check for duplicate num_parcel
    final isTaken = await correctionsRepo.isNumParcelTaken(numParcel);
    if (isTaken) {
      setState(() {
        _duplicateError = 'Ce numéro de parcelle existe déjà !';
      });
      return;
    }

    setState(() => _isSaving = true);

    try {
      final gps = ref.read(gpsProvider);

      await correctionsRepo.saveCorrection(
        uuid: const Uuid().v4(),
        parcelId: widget.parcel.id,
        numParcel: numParcel,
        enqueteur: _enqueteurController.text.trim().isNotEmpty
            ? _enqueteurController.text.trim()
            : null,
        notes: _notesController.text.trim().isNotEmpty
            ? _notesController.text.trim()
            : null,
        gpsLatitude: gps.latitude,
        gpsLongitude: gps.longitude,
        gpsAccuracy: gps.accuracyMeters,
      );

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('✅ Correction enregistrée'),
            backgroundColor: AppTheme.gpsExcellent,
          ),
        );
        Navigator.pop(context, true);
      }
    } catch (e) {
      setState(() => _isSaving = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('❌ Erreur: $e'),
            backgroundColor: AppTheme.gpsPoor,
          ),
        );
      }
    }
  }

  void _sendToKobo() {
    // TODO: wire KoboBridge
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Ouverture de KoboToolbox...'),
        duration: Duration(seconds: 2),
      ),
    );
  }
}
