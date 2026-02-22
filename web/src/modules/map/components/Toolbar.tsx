// =====================================================
//  FieldCorrect — Map Toolbar
// =====================================================

import {
  MousePointer2, Move, Info, Edit3, PenTool, Ruler,
  Square, Circle, Triangle, Undo2, Redo2
} from 'lucide-react';
import { useMapStore } from '@/stores/mapStore';
import { Button } from '@/shared/ui/components';
import { Tooltip } from '@/shared/ui/components';
import { cn } from '@/shared/ui/cn';
import type { MapTool } from '@/shared/types';

interface ToolDef {
  id: MapTool;
  label: string;
  icon: React.ReactNode;
  shortcut?: string;
  group: string;
}

const TOOLS: ToolDef[] = [
  { id: 'select', label: 'Sélection', icon: <MousePointer2 size={16} />, shortcut: 'S', group: 'nav' },
  { id: 'pan', label: 'Déplacer', icon: <Move size={16} />, shortcut: 'H', group: 'nav' },
  { id: 'identify', label: 'Identifier', icon: <Info size={16} />, shortcut: 'I', group: 'nav' },
  { id: 'edit', label: 'Éditer', icon: <Edit3 size={16} />, shortcut: 'E', group: 'edit' },
  { id: 'draw_polygon', label: 'Polygone', icon: <Triangle size={16} />, shortcut: 'P', group: 'draw' },
  { id: 'draw_point', label: 'Point', icon: <Circle size={16} />, group: 'draw' },
  { id: 'draw_line', label: 'Ligne', icon: <PenTool size={16} />, group: 'draw' },
  { id: 'measure_distance', label: 'Distance', icon: <Ruler size={16} />, shortcut: 'M', group: 'measure' },
  { id: 'measure_area', label: 'Surface', icon: <Square size={16} />, group: 'measure' },
  { id: 'select_rectangle', label: 'Sélection rect.', icon: <Square size={16} />, group: 'select' },
];

export function Toolbar() {
  const activeTool = useMapStore((s) => s.activeTool);
  const setTool = useMapStore((s) => s.setTool);

  return (
    <div className="absolute left-3 top-1/2 z-10 -translate-y-1/2 flex flex-col gap-0.5 rounded-lg bg-white p-1 shadow-[0_4px_16px_rgba(0,0,0,0.1)] border border-slate-200">
      {/* Navigation group */}
      <ToolGroup tools={TOOLS.filter((t) => t.group === 'nav')} activeTool={activeTool} setTool={setTool} />
      <Divider />
      {/* Edit group */}
      <ToolGroup tools={TOOLS.filter((t) => t.group === 'edit' || t.group === 'draw')} activeTool={activeTool} setTool={setTool} />
      <Divider />
      {/* Measure group */}
      <ToolGroup tools={TOOLS.filter((t) => t.group === 'measure')} activeTool={activeTool} setTool={setTool} />
      <Divider />
      {/* Undo / Redo */}
      <UndoRedoButtons />
    </div>
  );
}

function ToolGroup({
  tools,
  activeTool,
  setTool,
}: {
  tools: ToolDef[];
  activeTool: MapTool;
  setTool: (t: MapTool) => void;
}) {
  return (
    <>
      {tools.map((tool) => (
        <Tooltip key={tool.id} content={`${tool.label}${tool.shortcut ? ` (${tool.shortcut})` : ''}`}>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'h-7 w-7 text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors',
              activeTool === tool.id && 'bg-blue-50 text-blue-600 hover:bg-blue-50 hover:text-blue-600'
            )}
            onClick={() => setTool(tool.id)}
          >
            {tool.icon}
          </Button>
        </Tooltip>
      ))}
    </>
  );
}

function UndoRedoButtons() {
  const undoLen = useMapStore((s) => s.undoStack.length);
  const redoLen = useMapStore((s) => s.redoStack.length);
  const undo = useMapStore((s) => s.undo);
  const redo = useMapStore((s) => s.redo);

  return (
    <>
      <Tooltip content="Annuler (Ctrl+Z)">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          disabled={undoLen === 0}
          onClick={undo}
        >
          <Undo2 size={14} />
        </Button>
      </Tooltip>
      <Tooltip content="Rétablir (Ctrl+Y)">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          disabled={redoLen === 0}
          onClick={redo}
        >
          <Redo2 size={14} />
        </Button>
      </Tooltip>
    </>
  );
}

function Divider() {
  return <div className="mx-1 my-0.5 h-px bg-slate-200" />;
}
