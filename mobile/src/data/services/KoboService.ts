/**
 * @deprecated Use `services/KoboBridge.ts` instead.
 * KoboBridge supports 3-mode fallback: Kobo Collect → ODK Collect → Enketo web.
 */

import { Linking } from 'react-native';

export class KoboService {
    /**
     * Launches KoboCollect with a specific form and pre-filled data.
     * Note: Deep linking with pre-fill data via URL is limited in standard KoboCollect.
     * Usually requires 'com.google.android.apps.maps' style intents or specific Kobo intent actions.
     * 
     * For this implementation, we simply launch the app.
     */
    static async launchForm(formId: string, parcelData: any) {
        // URI scheme for KoboCollect
        // 'odkcollect' is also common.
        const schemes = [
            'org.koboc.collect.android',
            'org.odk.collect.android'
        ];

        let targetUrl = '';

        // Try to construct an intent-based URL if supported by the OS (Android 11+ restrictions apply)
        // A generic way often used is invoking a view action on a form URI.

        // Mock implementation: Open Kobo
        console.log(`Launching Kobo for form ${formId} with data`, parcelData);

        const url = `android-app://org.koboc.collect.android/`;

        try {
            const supported = await Linking.canOpenURL(url);
            if (supported) {
                await Linking.openURL(url);
            } else {
                console.warn('KoboCollect is not installed');
                // Fallback to web?
                // Linking.openURL(`https://ee.kobotoolbox.org/x/...`);
            }
        } catch (e) {
            console.error('Failed to launch Kobo', e);
        }
    }
}
