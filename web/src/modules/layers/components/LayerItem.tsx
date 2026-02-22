// =====================================================
//  FieldCorrect — LayerItem (single layer row in panel)
// =====================================================

import { Eye, EyeOff, MoreVertical, Table2, Palette, ZoomIn, Trash2, Copy, Tag } from 'lucide-react';
import { useLayerStore } from '@/stores/layerStore';
import { Button } from '@/shared/ui/components';
import { cn } from '@/shared/ui/cn';
import type { Layer } from '@/shared/types';
import { useState } from 'react';

interface LayerItemProps {
  layer: Layer;
  onOpenSymbology?: (layer: Layer) => void;
  onOpenAttributeTable?: (layer: Layer) => void;
  onDelete?: (layerId: string) => void;
  onZoom?: (layer: Layer) => void;
  onToggleLabels?: (layer: Layer) => void;
  onDuplicate?: (layer: Layer) => void;
}

const GEOM_ICONS: Record<string, string> = {
  Point: '●',
  MultiPoint: '●●',
  LineString: '╱',
  MultiLineString: '╱╱',
  Polygon: '▬',
  MultiPolygon: '▬▬',
};

export function LayerItem({
  layer,
  onOpenSymbology,
  onOpenAttributeTable,
  onDelete,
  onZoom,
  onToggleLabels,
  onDuplicate,
}: LayerItemProps) {
  const toggleVisibility = useLayerStore((s) => s.toggleVisibility);
  const [menuOpen, setMenuOpen] = useState(false);

  const fillColor = layer.style.simple?.fillColor
    ?? layer.style.ruleBased?.defaultStyle.fillColor
    ?? '#3388ff';

  return (
    <div
      className={cn(
        'group flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-gray-50 transition-colors',
        !layer.visible && 'opacity-50'
      )}
    >
      {/* Geometry type icon */}
      <span
        className="flex h-5 w-5 items-center justify-center rounded text-xs font-bold"
        style={{ color: fillColor }}
        title={layer.geometryType}
      >
        {GEOM_ICONS[layer.geometryType] ?? '?'}
      </span>

      {/* Layer name */}
      <span className="flex-1 truncate text-sm font-medium text-gray-800">
        {layer.name}
      </span>

      {/* Visibility toggle */}
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 opacity-0 group-hover:opacity-100"
        onClick={() => toggleVisibility(layer.id)}
        title={layer.visible ? 'Masquer' : 'Afficher'}
      >
        {layer.visible ? <Eye size={14} /> : <EyeOff size={14} />}
      </Button>

      {/* Context menu */}
      <div className="relative">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 opacity-0 group-hover:opacity-100"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          <MoreVertical size={14} />
        </Button>

        {menuOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
            <div className="absolute right-0 top-full z-50 mt-1 w-48 rounded-md bg-white shadow-lg border border-gray-200 py-1">
              <MenuItem
                icon={<ZoomIn size={14} />}
                label="Zoom sur la couche"
                onClick={() => { setMenuOpen(false); onZoom?.(layer); }}
              />
              <MenuItem
                icon={<Table2 size={14} />}
                label="Table attributaire"
                onClick={() => { setMenuOpen(false); onOpenAttributeTable?.(layer); }}
              />
              <MenuItem
                icon={<Palette size={14} />}
                label="Symbologie"
                onClick={() => { setMenuOpen(false); onOpenSymbology?.(layer); }}
              />
              <MenuItem
                icon={<Tag size={14} />}
                label="Étiquettes"
                onClick={() => { setMenuOpen(false); onToggleLabels?.(layer); }}
              />
              <div className="my-1 h-px bg-gray-100" />
              <MenuItem
                icon={<Copy size={14} />}
                label="Dupliquer"
                onClick={() => { setMenuOpen(false); onDuplicate?.(layer); }}
              />
              <MenuItem
                icon={<Trash2 size={14} />}
                label="Supprimer"
                onClick={() => { setMenuOpen(false); onDelete?.(layer.id); }}
                destructive
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  destructive,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      className={cn(
        'flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-50',
        destructive ? 'text-red-600 hover:bg-red-50' : 'text-gray-700'
      )}
      onClick={onClick}
    >
      {icon}
      {label}
    </button>
  );
}
