// =====================================================
//  FieldCorrect — Layer Panel (left sidebar)
// =====================================================

import { useState } from 'react';
import { Layers, Plus, Search, ChevronDown, ChevronRight } from 'lucide-react';
import { useLayerStore } from '@/stores/layerStore';
import { useMapStore } from '@/stores/mapStore';
import { LayerItem } from './LayerItem';
import { Button, Input } from '@/shared/ui/components';
import type { Layer } from '@/shared/types';

interface LayerPanelProps {
  onOpenSymbology?: (layer: Layer) => void;
  onOpenImport?: () => void;
}

export function LayerPanel({ onOpenSymbology, onOpenImport }: LayerPanelProps) {
  const layers = useLayerStore((s) => s.layers);
  const setAttributeTableOpen = useMapStore((s) => s.setAttributeTableOpen);
  const setAttributeTableLayerId = useMapStore((s) => s.setAttributeTableLayerId);
  const [filter, setFilter] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // Group layers
  const groups = groupLayers(layers);

  const filteredGroups = filter
    ? groups.map((g) => ({
        ...g,
        layers: g.layers.filter((l) =>
          l.name.toLowerCase().includes(filter.toLowerCase())
        ),
      })).filter((g) => g.layers.length > 0)
    : groups;

  const toggleGroup = (name: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const handleOpenAttributeTable = (layer: Layer) => {
    setAttributeTableLayerId(layer.id);
    setAttributeTableOpen(true);
  };

  return (
    <div className="flex h-full flex-col bg-white">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-gray-200 px-3 py-2">
        <Layers size={16} className="text-gray-500" />
        <span className="text-sm font-semibold text-gray-800">Couches</span>
        <span className="ml-auto text-xs text-gray-400">{layers.length}</span>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onOpenImport} title="Ajouter une couche">
          <Plus size={14} />
        </Button>
      </div>

      {/* Search */}
      <div className="px-2 py-1.5 border-b border-gray-100">
        <div className="relative">
          <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-gray-400" />
          <Input
            className="h-7 pl-7 text-xs"
            placeholder="Filtrer les couches..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
      </div>

      {/* Layer list */}
      <div className="flex-1 overflow-y-auto px-1 py-1">
        {filteredGroups.map((group) => (
          <div key={group.name}>
            {group.name !== '__default__' && (
              <button
                className="flex w-full items-center gap-1 px-2 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wide hover:text-gray-700"
                onClick={() => toggleGroup(group.name)}
              >
                {collapsedGroups.has(group.name) ? (
                  <ChevronRight size={12} />
                ) : (
                  <ChevronDown size={12} />
                )}
                {group.name}
                <span className="ml-auto font-normal">{group.layers.length}</span>
              </button>
            )}
            {!collapsedGroups.has(group.name) &&
              group.layers.map((layer) => (
                <LayerItem
                  key={layer.id}
                  layer={layer}
                  onOpenSymbology={onOpenSymbology}
                  onOpenAttributeTable={handleOpenAttributeTable}
                />
              ))}
          </div>
        ))}

        {layers.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-gray-400">
            <Layers size={32} className="mb-2" />
            <p className="text-sm">Aucune couche</p>
            <Button variant="secondary" size="sm" className="mt-2" onClick={onOpenImport}>
              Importer des données
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

interface LayerGroup {
  name: string;
  layers: Layer[];
}

function groupLayers(layers: Layer[]): LayerGroup[] {
  const map = new Map<string, Layer[]>();
  for (const layer of layers) {
    const groupName = layer.groupName ?? '__default__';
    if (!map.has(groupName)) map.set(groupName, []);
    map.get(groupName)!.push(layer);
  }

  const groups: LayerGroup[] = [];
  // Default group first
  if (map.has('__default__')) {
    groups.push({ name: '__default__', layers: map.get('__default__')! });
    map.delete('__default__');
  }
  for (const [name, layers] of map) {
    groups.push({ name, layers });
  }
  return groups;
}
