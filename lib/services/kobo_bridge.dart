import 'dart:convert';

import 'package:logger/logger.dart';
import 'package:url_launcher/url_launcher.dart';

import '../domain/entities/correction.dart';
import '../domain/entities/parcel.dart';

final _log = Logger(printer: PrettyPrinter(methodCount: 0));

/// Bridge to KoboToolbox Collect for pre-filling survey forms.
///
/// Two strategies:
///   1. **Deep Link / Intent**: opens Kobo Collect with pre-filled fields
///      via `kobo-collect://` URI scheme or Android Intent.
///   2. **API submission**: POST data directly to Kobo API (requires network).
///
/// The field mapping between CorrectionFIELD and Kobo form fields
/// must match the deployed XLSForm on the Kobo server.
class KoboBridge {
  const KoboBridge({
    this.koboServerUrl = 'https://kf.kobotoolbox.org',
    this.formId,
  });

  final String koboServerUrl;
  final String? formId;

  // ── Deep Link / Intent approach ────────────────────────────

  /// Open Kobo Collect with pre-filled fields for a parcel correction.
  ///
  /// Uses the ODK-compatible URL scheme:
  ///   `kobo-collect://form/<formId>?d[field1]=value1&d[field2]=value2`
  ///
  /// If Kobo Collect is not installed, falls back to opening
  /// the web form in a browser.
  Future<bool> openPrefilledForm({
    required Parcel parcel,
    required Correction correction,
    Map<String, String> extraFields = const {},
  }) async {
    // Build the pre-fill payload
    final fields = <String, String>{
      'num_parcel': correction.numParcel,
      'commune_ref': parcel.communeRef,
      'parcel_type': parcel.parcelType.name,
      'enqueteur': correction.enqueteur ?? '',
      'gps_latitude': correction.gpsLatitude?.toString() ?? '',
      'gps_longitude': correction.gpsLongitude?.toString() ?? '',
      'gps_accuracy': correction.gpsAccuracy?.toString() ?? '',
      'notes': correction.notes ?? '',
      'correction_uuid': correction.uuid,
      ...extraFields,
    };

    _log.i('Opening Kobo form with fields: ${fields.keys.join(", ")}');

    // Try Kobo Collect deep link first
    final koboUri = _buildKoboCollectUri(fields);
    if (koboUri != null && await canLaunchUrl(koboUri)) {
      await launchUrl(koboUri, mode: LaunchMode.externalApplication);
      return true;
    }

    // Fallback: try the ODK Collect URI scheme
    final odkUri = _buildOdkCollectUri(fields);
    if (odkUri != null && await canLaunchUrl(odkUri)) {
      await launchUrl(odkUri, mode: LaunchMode.externalApplication);
      return true;
    }

    // Final fallback: open web form
    final webUri = _buildWebFormUri(fields);
    if (webUri != null) {
      await launchUrl(webUri, mode: LaunchMode.externalApplication);
      return true;
    }

    _log.w('Could not open any Kobo form interface');
    return false;
  }

  /// Build a simplified JSON payload for direct API submission.
  Map<String, dynamic> buildApiPayload({
    required Parcel parcel,
    required Correction correction,
  }) {
    return {
      'id': formId,
      'submission': {
        'num_parcel': correction.numParcel,
        'commune_ref': parcel.communeRef,
        'parcel_type': parcel.parcelType.name,
        'enqueteur': correction.enqueteur,
        'gps_latitude': correction.gpsLatitude,
        'gps_longitude': correction.gpsLongitude,
        'gps_accuracy': correction.gpsAccuracy,
        'notes': correction.notes,
        'correction_uuid': correction.uuid,
        'survey_status': correction.surveyStatus,
        'geom_json': correction.geomJson,
      },
      'meta': {
        'instanceID': 'uuid:${correction.uuid}',
        'submissionDate': correction.updatedAt,
      },
    };
  }

  // ── Private URI builders ───────────────────────────────────

  Uri? _buildKoboCollectUri(Map<String, String> fields) {
    if (formId == null) return null;

    final params = fields.entries
        .map((e) => 'd[${Uri.encodeComponent(e.key)}]=${Uri.encodeComponent(e.value)}')
        .join('&');

    try {
      return Uri.parse('kobo-collect://form/$formId?$params');
    } catch (_) {
      return null;
    }
  }

  Uri? _buildOdkCollectUri(Map<String, String> fields) {
    if (formId == null) return null;

    final params = fields.entries
        .map((e) => 'd[${Uri.encodeComponent(e.key)}]=${Uri.encodeComponent(e.value)}')
        .join('&');

    try {
      return Uri.parse('odkcollect://form/$formId?$params');
    } catch (_) {
      return null;
    }
  }

  Uri? _buildWebFormUri(Map<String, String> fields) {
    if (formId == null) return null;

    final params = fields.entries
        .map((e) => 'd[${Uri.encodeComponent(e.key)}]=${Uri.encodeComponent(e.value)}')
        .join('&');

    try {
      return Uri.parse('$koboServerUrl/#/forms/$formId/fill?$params');
    } catch (_) {
      return null;
    }
  }
}

