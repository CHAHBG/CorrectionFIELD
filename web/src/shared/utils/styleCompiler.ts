// =====================================================
//  FieldCorrect — Style Compiler (JSONB → MapLibre spec)
// =====================================================

import type { LayerStyle } from '@/shared/types';

export interface MapLibrePaint {
  fill?: Record<string, unknown>;
  stroke?: Record<string, unknown>;
  circle?: Record<string, unknown>;
  symbol?: Record<string, unknown>;
}

/**
 * Compile a LayerStyle JSONB object into MapLibre GL paint/layout specs.
 */
export function compileStyle(style: LayerStyle): MapLibrePaint {
  if (style.mode === 'rule-based' && style.ruleBased) {
    return compileRuleBased(style);
  }

  if (style.mode === 'graduated' && style.graduated) {
    return compileGraduated(style);
  }

  // Default: simple mode
  return compileSimple(style);
}

function compileSimple(style: LayerStyle): MapLibrePaint {
  const s = style.simple ?? {
    fillColor: '#3388ff',
    fillOpacity: 0.5,
    strokeColor: '#3388ff',
    strokeWidth: 2,
    strokeOpacity: 1,
    pointRadius: 6,
  };

  return {
    fill: {
      'fill-color': s.fillColor,
      'fill-opacity': s.fillOpacity ?? 0.5,
    },
    stroke: {
      'line-color': s.strokeColor ?? s.fillColor,
      'line-width': s.strokeWidth ?? 2,
      'line-opacity': s.strokeOpacity ?? 1,
    },
    circle: {
      'circle-radius': s.pointRadius ?? 6,
      'circle-color': s.fillColor,
      'circle-stroke-color': s.strokeColor ?? '#fff',
      'circle-stroke-width': s.strokeWidth ?? 1,
      'circle-opacity': s.fillOpacity ?? 0.8,
    },
  };
}

function compileRuleBased(style: LayerStyle): MapLibrePaint {
  const rb = style.ruleBased!;
  const { field, rules, defaultStyle } = rb;

  // MapLibre "match" expression: ['match', ['get', field], v1, c1, v2, c2, default]
  const fillMatch: unknown[] = [
    'match',
    ['get', field],
    ...rules.flatMap((r) => [r.value, r.style.fillColor ?? defaultStyle.fillColor]),
    defaultStyle.fillColor,
  ];

  const strokeMatch: unknown[] = [
    'match',
    ['get', field],
    ...rules.flatMap((r) => [r.value, r.style.strokeColor ?? defaultStyle.strokeColor]),
    defaultStyle.strokeColor,
  ];

  return {
    fill: {
      'fill-color': fillMatch,
      'fill-opacity': defaultStyle.fillOpacity ?? 0.7,
    },
    stroke: {
      'line-color': strokeMatch,
      'line-width': defaultStyle.strokeWidth ?? 1,
    },
    circle: {
      'circle-color': fillMatch,
      'circle-radius': defaultStyle.pointRadius ?? 6,
      'circle-stroke-color': strokeMatch,
      'circle-stroke-width': defaultStyle.strokeWidth ?? 1,
    },
  };
}

function compileGraduated(style: LayerStyle): MapLibrePaint {
  const grad = style.graduated!;
  const { field, colorRamp, breaks } = grad;

  // Build interpolation stops
  const stops: unknown[] = [];
  for (let i = 0; i < breaks.length && i < colorRamp.length; i++) {
    stops.push(breaks[i], colorRamp[i]);
  }

  const interpolation: unknown[] = [
    'interpolate',
    ['linear'],
    ['get', field],
    ...stops,
  ];

  return {
    fill: {
      'fill-color': interpolation,
      'fill-opacity': 0.7,
    },
    stroke: {
      'line-color': '#333',
      'line-width': 1,
    },
    circle: {
      'circle-color': interpolation,
      'circle-radius': 6,
    },
  };
}

/**
 * Compile a status-based default style (PROCASEF convention).
 */
export function defaultStatusStyle(): LayerStyle {
  return {
    mode: 'rule-based',
    ruleBased: {
      field: 'status',
      defaultStyle: {
        fillColor: '#9E9E9E',
        fillOpacity: 0.6,
        strokeColor: '#757575',
        strokeWidth: 1,
        strokeOpacity: 1,
      },
      rules: [
        { value: 'pending', label: 'En attente', style: { fillColor: '#FF9800', strokeColor: '#E65100' } },
        { value: 'locked', label: 'Verrouillée', style: { fillColor: '#FFC107', strokeColor: '#F57F17' } },
        { value: 'corrected', label: 'Corrigée', style: { fillColor: '#2196F3', strokeColor: '#0D47A1' } },
        { value: 'validated', label: 'Validée', style: { fillColor: '#4CAF50', strokeColor: '#1B5E20' } },
        { value: 'rejected', label: 'Rejetée', style: { fillColor: '#F44336', strokeColor: '#B71C1C' } },
      ],
    },
  };
}
