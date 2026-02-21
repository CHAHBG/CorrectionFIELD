// =====================================================
//  FieldCorrect Mobile — Kobo Bridge v2
//  Deep link with prefill + ODK fallback + native form
// =====================================================

import { Linking, Platform } from 'react-native';
import type { AppFeature, Layer } from '@/types';

/**
 * KoboBridge v2 — 3 modes:
 * 1. Deep link to Kobo Collect with pre-filled params
 * 2. Fallback to ODK Collect
 * 3. Return false → caller should open native Flutter/RN form
 */
export class KoboBridge {
  /**
   * Try to open Kobo/ODK Collect for a feature correction.
   * Returns true if an external app was launched, false if caller should
   * fall back to the native in-app form.
   */
  static async openForFeature(
    feature: AppFeature,
    layer: Layer,
    options?: {
      koboFormId?: string;
      koboServerUrl?: string;
      additionalParams?: Record<string, string>;
    },
  ): Promise<boolean> {
    const formId = options?.koboFormId ?? (layer as any).kobo_form_id;
    if (!formId) {
      // No Kobo form configured → use native form
      return false;
    }

    // Build pre-fill params from feature props → Kobo question mapping
    const prefillParams = KoboBridge.buildPrefillParams(feature, layer);
    const allParams = { ...prefillParams, ...options?.additionalParams };
    const queryString = Object.entries(allParams)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');

    // 1. Try Kobo Collect deep link
    const koboUri = `kobo-collect://form/${formId}${queryString ? '?' + queryString : ''}`;
    try {
      const canOpen = await Linking.canOpenURL(koboUri);
      if (canOpen) {
        await Linking.openURL(koboUri);
        return true;
      }
    } catch {
      // Kobo not installed
    }

    // 2. Try ODK Collect intent (Android)
    if (Platform.OS === 'android') {
      const odkUri = `content://org.odk.collect.android.provider.odk/forms/${formId}`;
      try {
        const canOpen = await Linking.canOpenURL(odkUri);
        if (canOpen) {
          await Linking.openURL(odkUri);
          return true;
        }
      } catch {
        // ODK not installed
      }

      // 2b. Try generic Android intent
      const intentUri = `intent://form/${formId}#Intent;scheme=odkcollect;package=org.odk.collect.android;end`;
      try {
        await Linking.openURL(intentUri);
        return true;
      } catch {
        // Not available
      }
    }

    // 3. Try Enketo web form (if server URL configured)
    const serverUrl = options?.koboServerUrl;
    if (serverUrl && formId) {
      const enketoUrl = `${serverUrl}/x/${formId}${queryString ? '?' + queryString : ''}`;
      try {
        await Linking.openURL(enketoUrl);
        return true;
      } catch {
        // Fallback
      }
    }

    // 4. Nothing worked → return false for native form
    return false;
  }

  /**
   * Build pre-fill query parameters from feature props based on
   * the layer's field schema kobo mapping.
   */
  static buildPrefillParams(
    feature: AppFeature,
    layer: Layer,
  ): Record<string, string> {
    const params: Record<string, string> = {};

    // Always include feature ID for tracking
    params.feature_id = feature.id;
    params.layer_id = feature.layer_id;

    // Map feature props to Kobo question names
    for (const field of layer.fields) {
      const value = feature.props[field.name];
      if (value == null) {continue;}

      // Use kobo question name if mapped, otherwise use field name
      const koboName = (field as any).kobo_question_name ?? field.name;
      params[koboName] = String(value);
    }

    // Add GPS if available in geom
    if (feature.geom && feature.geom.type === 'Point') {
      const coords = (feature.geom as any).coordinates;
      if (coords) {
        params.gps_lat = String(coords[1]);
        params.gps_lng = String(coords[0]);
      }
    }

    return params;
  }

  /**
   * Parse a Kobo webhook/API submission and convert to a correction patch.
   */
  static parseSubmission(
    submission: Record<string, any>,
    layer: Layer,
  ): {
    propsPatch: Record<string, any>;
    mediaUrls: string[];
    gpsPoint?: { lat: number; lng: number; accuracy?: number };
    koboSubmissionId?: string;
  } {
    const propsPatch: Record<string, any> = {};
    const mediaUrls: string[] = [];
    let gpsPoint: { lat: number; lng: number; accuracy?: number } | undefined;

    for (const field of layer.fields) {
      const koboName = (field as any).kobo_question_name ?? field.name;
      if (submission[koboName] !== undefined) {
        propsPatch[field.name] = submission[koboName];
      }
    }

    // Extract media
    if (submission._attachments) {
      for (const att of submission._attachments) {
        if (att.download_url) {
          mediaUrls.push(att.download_url);
        }
      }
    }

    // Extract GPS
    if (submission._geolocation?.length === 2) {
      gpsPoint = {
        lat: submission._geolocation[0],
        lng: submission._geolocation[1],
      };
    } else if (submission.gps_lat && submission.gps_lng) {
      gpsPoint = {
        lat: parseFloat(submission.gps_lat),
        lng: parseFloat(submission.gps_lng),
        accuracy: submission.gps_accuracy ? parseFloat(submission.gps_accuracy) : undefined,
      };
    }

    return {
      propsPatch,
      mediaUrls,
      gpsPoint,
      koboSubmissionId: submission._id ? String(submission._id) : undefined,
    };
  }

  /**
   * Poll Kobo API for new submissions (when webhook isn't available).
   */
  static async pollSubmissions(
    koboServerUrl: string,
    formId: string,
    token: string,
    since?: string,
  ): Promise<Record<string, any>[]> {
    try {
      const url = `${koboServerUrl}/api/v2/assets/${formId}/data.json${since ? `?query={"_submission_time":{"$gte":"${since}"}}` : ''}`;
      const response = await fetch(url, {
        headers: { Authorization: `Token ${token}` },
      });

      if (!response.ok) {return [];}
      const json = await response.json();
      return json.results ?? [];
    } catch (e) {
      console.warn('[KoboBridge] poll error:', e);
      return [];
    }
  }
}
