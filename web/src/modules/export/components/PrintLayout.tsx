// =====================================================
//  FieldCorrect — Print Layout Designer
// =====================================================

import { useState, useRef, useCallback } from 'react';
import { Button, Input } from '@/shared/ui/components';
import type { PrintLayout, PrintElement } from '@/shared/types';

const PAPER_SIZES: Record<string, { w: number; h: number }> = {
  A4: { w: 210, h: 297 },
  A3: { w: 297, h: 420 },
  Letter: { w: 216, h: 279 },
};

export function PrintLayoutDesigner({ onClose }: { onClose: () => void }) {
  const [layout, setLayout] = useState<PrintLayout>({
    id: crypto.randomUUID(),
    name: 'Mise en page',
    paperSize: 'A4',
    orientation: 'landscape',
    dpi: 150,
    elements: [],
  });

  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const paper = PAPER_SIZES[layout.paperSize] ?? PAPER_SIZES.A4;
  const width = layout.orientation === 'landscape' ? paper.h : paper.w;
  const height = layout.orientation === 'landscape' ? paper.w : paper.h;
  const scale = 2.5; // mm to px

  const addElement = (type: PrintElement['type']) => {
    const el: PrintElement = {
      id: crypto.randomUUID(),
      type,
      x: 20,
      y: 20,
      width: type === 'map' ? 180 : 80,
      height: type === 'map' ? 120 : (type === 'title' ? 15 : 30),
      content:
        type === 'title' ? 'Titre de la carte'
        : type === 'legend' ? 'Légende'
        : type === 'scalebar' ? ''
        : type === 'north_arrow' ? ''
        : '',
      fontSize: type === 'title' ? 18 : 12,
    };
    setLayout((prev) => ({
      ...prev,
      elements: [...prev.elements, el],
    }));
    setSelectedElementId(el.id);
  };

  const updateElement = (id: string, updates: Partial<PrintElement>) => {
    setLayout((prev) => ({
      ...prev,
      elements: prev.elements.map((el) =>
        el.id === id ? { ...el, ...updates } : el
      ),
    }));
  };

  const removeElement = (id: string) => {
    setLayout((prev) => ({
      ...prev,
      elements: prev.elements.filter((el) => el.id !== id),
    }));
    if (selectedElementId === id) setSelectedElementId(null);
  };

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const selectedElement = layout.elements.find((e) => e.id === selectedElementId);

  return (
    <div className="fixed inset-0 z-50 flex bg-gray-100">
      {/* Left toolbar */}
      <div className="w-56 bg-white border-r p-4 space-y-3 overflow-y-auto">
        <h3 className="text-sm font-semibold text-gray-700">Éléments</h3>
        <div className="space-y-1">
          {[
            { type: 'map' as const, label: '🗺️ Carte', },
            { type: 'title' as const, label: '📝 Titre', },
            { type: 'legend' as const, label: '📋 Légende', },
            { type: 'scalebar' as const, label: "📏 Barre d'échelle", },
            { type: 'north_arrow' as const, label: '🧭 Flèche nord', },
          ].map((item) => (
            <Button
              key={item.type}
              variant="ghost"
              size="sm"
              className="w-full justify-start text-xs"
              onClick={() => addElement(item.type)}
            >
              {item.label}
            </Button>
          ))}
        </div>

        <hr />

        <h3 className="text-sm font-semibold text-gray-700">Page</h3>
        <div className="space-y-2 text-xs">
          <div>
            <label className="text-gray-500">Format</label>
            <select
              className="w-full mt-0.5 rounded border px-2 py-1 text-xs"
              value={layout.paperSize}
              onChange={(e) => setLayout({ ...layout, paperSize: e.target.value })}
            >
              {Object.keys(PAPER_SIZES).map((k) => (
                <option key={k}>{k}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-gray-500">Orientation</label>
            <select
              className="w-full mt-0.5 rounded border px-2 py-1 text-xs"
              value={layout.orientation}
              onChange={(e) => setLayout({ ...layout, orientation: e.target.value as 'portrait' | 'landscape' })}
            >
              <option value="portrait">Portrait</option>
              <option value="landscape">Paysage</option>
            </select>
          </div>
          <div>
            <label className="text-gray-500">DPI</label>
            <Input
              type="number"
              value={layout.dpi}
              onChange={(e) => setLayout({ ...layout, dpi: parseInt(e.target.value) || 150 })}
              className="text-xs h-7"
            />
          </div>
        </div>

        {selectedElement && (
          <>
            <hr />
            <h3 className="text-sm font-semibold text-gray-700">Propriétés</h3>
            <div className="space-y-2 text-xs">
              {(selectedElement.type === 'title') && (
                <div>
                  <label className="text-gray-500">Texte</label>
                  <Input
                    value={selectedElement.content ?? ''}
                    onChange={(e) => updateElement(selectedElement.id, { content: e.target.value })}
                    className="text-xs h-7"
                  />
                </div>
              )}
              <div className="grid grid-cols-2 gap-1">
                <div>
                  <label className="text-gray-500">X (mm)</label>
                  <Input
                    type="number"
                    value={selectedElement.x}
                    onChange={(e) => updateElement(selectedElement.id, { x: +e.target.value })}
                    className="text-xs h-7"
                  />
                </div>
                <div>
                  <label className="text-gray-500">Y (mm)</label>
                  <Input
                    type="number"
                    value={selectedElement.y}
                    onChange={(e) => updateElement(selectedElement.id, { y: +e.target.value })}
                    className="text-xs h-7"
                  />
                </div>
                <div>
                  <label className="text-gray-500">Largeur</label>
                  <Input
                    type="number"
                    value={selectedElement.width}
                    onChange={(e) => updateElement(selectedElement.id, { width: +e.target.value })}
                    className="text-xs h-7"
                  />
                </div>
                <div>
                  <label className="text-gray-500">Hauteur</label>
                  <Input
                    type="number"
                    value={selectedElement.height}
                    onChange={(e) => updateElement(selectedElement.id, { height: +e.target.value })}
                    className="text-xs h-7"
                  />
                </div>
              </div>
              <Button
                variant="destructive"
                size="sm"
                className="w-full text-xs"
                onClick={() => removeElement(selectedElement.id)}
              >
                Supprimer
              </Button>
            </div>
          </>
        )}
      </div>

      {/* Canvas area */}
      <div className="flex-1 overflow-auto flex items-center justify-center p-8">
        <div
          ref={canvasRef}
          className="bg-white shadow-lg relative border"
          style={{
            width: width * scale,
            height: height * scale,
          }}
          onClick={() => setSelectedElementId(null)}
        >
          {layout.elements.map((el) => (
            <div
              key={el.id}
              className={`absolute border cursor-move ${
                el.id === selectedElementId
                  ? 'border-blue-500 ring-2 ring-blue-200'
                  : 'border-gray-300'
              }`}
              style={{
                left: el.x * scale,
                top: el.y * scale,
                width: el.width * scale,
                height: el.height * scale,
              }}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedElementId(el.id);
              }}
            >
              <div className="w-full h-full flex items-center justify-center text-xs text-gray-500 bg-gray-50/50">
                {el.type === 'map' && '🗺️ Zone carte'}
                {el.type === 'title' && (
                  <span style={{ fontSize: (el.fontSize ?? 18) * (scale / 3) }}>
                    {el.content}
                  </span>
                )}
                {el.type === 'legend' && '📋 Légende'}
                {el.type === 'scalebar' && '📏 Échelle'}
                {el.type === 'north_arrow' && '🧭 N'}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Top bar */}
      <div className="absolute top-0 left-56 right-0 h-12 bg-white border-b flex items-center justify-between px-4">
        <Input
          value={layout.name}
          onChange={(e) => setLayout({ ...layout, name: e.target.value })}
          className="w-48 h-8 text-sm font-medium"
        />
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={handlePrint}>
            🖨️ Imprimer
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Fermer
          </Button>
        </div>
      </div>
    </div>
  );
}
