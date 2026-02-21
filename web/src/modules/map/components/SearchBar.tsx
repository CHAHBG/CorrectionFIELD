// =====================================================
//  FieldCorrect — Search Bar (geocoding + attribute search)
// =====================================================

import { useState, useCallback } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/shared/ui/components';
import { cn } from '@/shared/ui/cn';

interface SearchResult {
  type: 'feature' | 'geocode';
  id: string;
  label: string;
  sublabel?: string;
  lngLat?: [number, number];
}

interface SearchBarProps {
  onSelectResult?: (result: SearchResult) => void;
}

export function SearchBar({ onSelectResult }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);

  const handleSearch = useCallback(
    async (q: string) => {
      setQuery(q);
      if (q.length < 2) {
        setResults([]);
        setOpen(false);
        return;
      }

      // Nominatim geocoding (free)
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5`
        );
        const data = (await res.json()) as Array<{
          place_id: string;
          display_name: string;
          lat: string;
          lon: string;
        }>;
        const geocodeResults: SearchResult[] = data.map((item) => ({
          type: 'geocode',
          id: item.place_id,
          label: item.display_name.split(',')[0],
          sublabel: item.display_name,
          lngLat: [parseFloat(item.lon), parseFloat(item.lat)] as [number, number],
        }));
        setResults(geocodeResults);
        setOpen(true);
      } catch {
        setResults([]);
      }
    },
    []
  );

  return (
    <div className="absolute top-3 left-1/2 z-20 -translate-x-1/2 w-80">
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Rechercher un lieu, une parcelle..."
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          className="pl-9 pr-8 bg-white shadow-md"
        />
        {query && (
          <button
            className="absolute right-2.5 top-2.5"
            onClick={() => { setQuery(''); setResults([]); setOpen(false); }}
          >
            <X className="h-4 w-4 text-gray-400 hover:text-gray-600" />
          </button>
        )}
      </div>

      {open && results.length > 0 && (
        <div className="mt-1 rounded-md bg-white shadow-lg border border-gray-200 max-h-64 overflow-y-auto">
          {results.map((r) => (
            <button
              key={r.id}
              className={cn(
                'w-full text-left px-3 py-2 hover:bg-blue-50 transition-colors',
                'flex flex-col border-b border-gray-100 last:border-0'
              )}
              onClick={() => {
                onSelectResult?.(r);
                setOpen(false);
                setQuery(r.label);
              }}
            >
              <span className="text-sm font-medium text-gray-900">{r.label}</span>
              {r.sublabel && (
                <span className="text-xs text-gray-500 truncate">{r.sublabel}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
