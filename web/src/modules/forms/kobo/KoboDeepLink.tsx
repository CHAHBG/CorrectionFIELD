// =====================================================
//  FieldCorrect — KoboToolbox deep-link component
// =====================================================

import { Button } from '@/shared/ui/components';

interface KoboDeepLinkProps {
  /** KoboToolbox server URL (e.g. https://kf.kobotoolbox.org) */
  serverUrl?: string;
  /** Kobo form asset UID */
  formUid: string;
  /** Optional prefill as query params */
  prefill?: Record<string, string>;
  /** When true, opens KoboCollect on mobile instead of Enketo web */
  useMobileApp?: boolean;
  className?: string;
}

/**
 * Opens a KoboToolbox form in a new tab (Enketo web) or via a deep link (KoboCollect mobile).
 */
export function KoboDeepLink({
  serverUrl = 'https://kf.kobotoolbox.org',
  formUid,
  prefill,
  useMobileApp = false,
  className,
}: KoboDeepLinkProps) {
  const enketoUrl = `${serverUrl}/api/v2/assets/${formUid}/data/enketo/?return=false`;

  const koboCollectUrl = buildKoboCollectUrl(serverUrl, formUid, prefill);

  const url = useMobileApp ? koboCollectUrl : enketoUrl;

  return (
    <Button
      variant="secondary"
      size="sm"
      className={className}
      onClick={() => window.open(url, '_blank', 'noopener')}
    >
      {useMobileApp ? '📱 Ouvrir KoboCollect' : '🌐 Ouvrir dans Enketo'}
    </Button>
  );
}

function buildKoboCollectUrl(
  serverUrl: string,
  formUid: string,
  prefill?: Record<string, string>
): string {
  // KoboCollect deep link scheme
  const params = new URLSearchParams({
    form: `${serverUrl}/api/v2/assets/${formUid}/`,
  });
  if (prefill) {
    for (const [k, v] of Object.entries(prefill)) {
      params.set(k, v);
    }
  }
  return `kobocollect://open?${params.toString()}`;
}
