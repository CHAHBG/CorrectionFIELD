// =====================================================
//  FieldCorrect — Enketo Webform integration (iframe)
// =====================================================

import { useRef, useEffect, useCallback, useState } from 'react';
import { Spinner } from '@/shared/ui/components';

interface EnketoFrameProps {
  /** Full URL to Enketo webform (e.g. https://enketo.kobotoolbox.org/x/abc123) */
  formUrl: string;
  /** Prefill data as XPath → value pairs */
  prefill?: Record<string, string>;
  /** Called when the form posts a submission message */
  onSubmit?: (data: Record<string, unknown>) => void;
  /** Optional CSS class for the container */
  className?: string;
}

/**
 * Renders an Enketo Webform inside an iframe.
 * Listens for `postMessage` from the Enketo iframe to detect submissions.
 *
 * Usage:
 *   <EnketoFrame formUrl="https://kc.kobotoolbox.org/::abc123" prefill={{ '/survey/name': 'Jean' }} />
 */
export function EnketoFrame({ formUrl, prefill, onSubmit, className }: EnketoFrameProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loading, setLoading] = useState(true);

  // Build the URL with prefill query params (Enketo convention: d[xpath]=value)
  const src = buildEnketoUrl(formUrl, prefill);

  // Listen for postMessage from the Enketo iframe
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (!formUrl.includes(event.origin)) return;
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (data.enketoEvent === 'submissionsuccess' || data.type === 'submissionsuccess') {
          onSubmit?.(data.payload ?? data);
        }
      } catch {
        // Ignore non-JSON messages
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [formUrl, onSubmit]);

  const handleLoad = useCallback(() => setLoading(false), []);

  return (
    <div className={`relative w-full h-full min-h-[400px] ${className ?? ''}`}>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
          <Spinner />
          <span className="ml-2 text-sm text-gray-500">Chargement du formulaire Enketo…</span>
        </div>
      )}
      <iframe
        ref={iframeRef}
        src={src}
        onLoad={handleLoad}
        title="Enketo Form"
        className="w-full h-full border-0 rounded"
        sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
      />
    </div>
  );
}

function buildEnketoUrl(base: string, prefill?: Record<string, string>): string {
  if (!prefill || Object.keys(prefill).length === 0) return base;
  const url = new URL(base);
  for (const [xpath, value] of Object.entries(prefill)) {
    url.searchParams.set(`d[${xpath}]`, value);
  }
  return url.toString();
}
