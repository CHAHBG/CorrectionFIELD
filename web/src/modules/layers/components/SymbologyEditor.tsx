// =====================================================
//  FieldCorrect — Symbology Editor
// =====================================================

import { useState } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { Button, Input } from '@/shared/ui/components';
import { cn } from '@/shared/ui/cn';
import type { Layer, LayerStyle, SimpleStyle, StyleRule } from '@/shared/types';

interface SymbologyEditorProps {
  layer: Layer;
  onSave: (style: LayerStyle) => void;
  onClose: () => void;
}

export function SymbologyEditor({ layer, onSave, onClose }: SymbologyEditorProps) {
  const [style, setStyle] = useState<LayerStyle>({ ...layer.style });
  const [activeTab, setActiveTab] = useState<'simple' | 'rules' | 'labels'>(
    style.mode === 'rule-based' ? 'rules' : 'simple'
  );

  const handleSave = () => {
    onSave(style);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="w-[500px] max-h-[80vh] rounded-lg bg-white shadow-xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Symbologie</h2>
            <p className="text-xs text-gray-500">{layer.name}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X size={16} />
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex border-b">
          {(['simple', 'rules', 'labels'] as const).map((tab) => (
            <button
              key={tab}
              className={cn(
                'flex-1 py-2 text-sm font-medium transition-colors',
                activeTab === tab
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              )}
              onClick={() => setActiveTab(tab)}
            >
              {tab === 'simple' ? 'Symbole unique' : tab === 'rules' ? 'Par règle' : 'Étiquettes'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === 'simple' && (
            <SimpleStyleEditor
              style={style.simple ?? defaultSimpleStyle()}
              onChange={(s) => setStyle({ ...style, mode: 'simple', simple: s })}
            />
          )}
          {activeTab === 'rules' && (
            <RuleBasedEditor
              style={style}
              fields={layer.fields}
              onChange={(s) => setStyle(s)}
            />
          )}
          {activeTab === 'labels' && (
            <LabelEditor
              labels={style.labels}
              fields={layer.fields}
              onChange={(labels) => setStyle({ ...style, labels })}
            />
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 border-t px-4 py-3">
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button onClick={handleSave}>Appliquer</Button>
        </div>
      </div>
    </div>
  );
}

// ── Simple style editor ─────────────────────────────
function SimpleStyleEditor({
  style,
  onChange,
}: {
  style: SimpleStyle;
  onChange: (s: SimpleStyle) => void;
}) {
  return (
    <div className="space-y-4">
      <ColorRow label="Remplissage" value={style.fillColor} onChange={(v) => onChange({ ...style, fillColor: v })} />
      <SliderRow
        label="Opacité remplissage"
        value={style.fillOpacity}
        min={0} max={1} step={0.05}
        onChange={(v) => onChange({ ...style, fillOpacity: v })}
      />
      <ColorRow label="Contour" value={style.strokeColor} onChange={(v) => onChange({ ...style, strokeColor: v })} />
      <SliderRow
        label="Épaisseur contour"
        value={style.strokeWidth}
        min={0} max={10} step={0.5}
        onChange={(v) => onChange({ ...style, strokeWidth: v })}
      />
      <SliderRow
        label="Rayon point"
        value={style.pointRadius ?? 6}
        min={1} max={30} step={1}
        onChange={(v) => onChange({ ...style, pointRadius: v })}
      />
    </div>
  );
}

// ── Rule-based editor ───────────────────────────────
function RuleBasedEditor({
  style,
  fields,
  onChange,
}: {
  style: LayerStyle;
  fields: Layer['fields'];
  onChange: (s: LayerStyle) => void;
}) {
  const rb = style.ruleBased ?? {
    field: fields[0]?.name ?? 'status',
    defaultStyle: defaultSimpleStyle(),
    rules: [],
  };

  const updateField = (field: string) => {
    onChange({ ...style, mode: 'rule-based', ruleBased: { ...rb, field } });
  };

  const addRule = () => {
    onChange({
      ...style,
      mode: 'rule-based',
      ruleBased: {
        ...rb,
        rules: [...rb.rules, { value: '', style: { fillColor: randomColor() } }],
      },
    });
  };

  const updateRule = (idx: number, rule: StyleRule) => {
    const rules = [...rb.rules];
    rules[idx] = rule;
    onChange({ ...style, mode: 'rule-based', ruleBased: { ...rb, rules } });
  };

  const removeRule = (idx: number) => {
    onChange({
      ...style,
      mode: 'rule-based',
      ruleBased: { ...rb, rules: rb.rules.filter((_, i) => i !== idx) },
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-medium text-gray-600">Champ de classification</label>
        <select
          className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
          value={rb.field}
          onChange={(e) => updateField(e.target.value)}
        >
          {fields.map((f) => (
            <option key={f.name} value={f.name}>{f.label ?? f.name}</option>
          ))}
          <option value="status">status (système)</option>
        </select>
      </div>

      <div>
        <label className="text-xs font-medium text-gray-600">Style par défaut</label>
        <ColorRow label="" value={rb.defaultStyle.fillColor} onChange={(v) =>
          onChange({ ...style, mode: 'rule-based', ruleBased: { ...rb, defaultStyle: { ...rb.defaultStyle, fillColor: v } } })
        } />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-medium text-gray-600">Règles</label>
          <Button variant="ghost" size="sm" onClick={addRule}>
            <Plus size={12} className="mr-1" /> Ajouter
          </Button>
        </div>

        {rb.rules.map((rule, idx) => (
          <div key={idx} className="flex items-center gap-2 mb-2 p-2 bg-gray-50 rounded">
            <input
              type="color"
              value={rule.style.fillColor ?? '#888'}
              onChange={(e) => updateRule(idx, { ...rule, style: { ...rule.style, fillColor: e.target.value } })}
              className="h-7 w-7 cursor-pointer rounded border-0"
            />
            <Input
              className="h-7 flex-1 text-xs"
              placeholder="Valeur"
              value={rule.value}
              onChange={(e) => updateRule(idx, { ...rule, value: e.target.value })}
            />
            <Input
              className="h-7 w-24 text-xs"
              placeholder="Label"
              value={rule.label ?? ''}
              onChange={(e) => updateRule(idx, { ...rule, label: e.target.value })}
            />
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeRule(idx)}>
              <Trash2 size={12} className="text-red-500" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Label editor ────────────────────────────────────
function LabelEditor({
  labels,
  fields,
  onChange,
}: {
  labels: LayerStyle['labels'];
  fields: Layer['fields'];
  onChange: (labels: LayerStyle['labels']) => void;
}) {
  const config = labels ?? {
    enabled: false,
    field: fields[0]?.name ?? '',
    fontSize: 12,
    fontColor: '#333',
    halo: true,
    minZoom: 10,
    placement: 'center' as const,
  };

  return (
    <div className="space-y-4">
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={config.enabled}
          onChange={(e) => onChange({ ...config, enabled: e.target.checked })}
        />
        <span className="text-sm">Afficher les étiquettes</span>
      </label>

      {config.enabled && (
        <>
          <div>
            <label className="text-xs font-medium text-gray-600">Champ</label>
            <select
              className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
              value={config.field}
              onChange={(e) => onChange({ ...config, field: e.target.value })}
            >
              {fields.map((f) => (
                <option key={f.name} value={f.name}>{f.label ?? f.name}</option>
              ))}
            </select>
          </div>

          <SliderRow
            label="Taille police"
            value={config.fontSize}
            min={8} max={32} step={1}
            onChange={(v) => onChange({ ...config, fontSize: v })}
          />

          <ColorRow
            label="Couleur"
            value={config.fontColor}
            onChange={(v) => onChange({ ...config, fontColor: v })}
          />

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={config.halo}
              onChange={(e) => onChange({ ...config, halo: e.target.checked })}
            />
            <span className="text-sm">Halo blanc</span>
          </label>

          <SliderRow
            label="Zoom minimum"
            value={config.minZoom}
            min={0} max={22} step={1}
            onChange={(v) => onChange({ ...config, minZoom: v })}
          />
        </>
      )}
    </div>
  );
}

// ── Helpers ─────────────────────────────────────────
function ColorRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      {label && <label className="text-xs font-medium text-gray-600 w-36">{label}</label>}
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-7 w-7 cursor-pointer rounded border-0"
      />
      <Input
        className="h-7 w-24 text-xs font-mono"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-xs font-medium text-gray-600 w-36">{label}</label>
      <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="flex-1"
      />
      <span className="text-xs font-mono text-gray-500 w-10 text-right">{value}</span>
    </div>
  );
}

function defaultSimpleStyle(): SimpleStyle {
  return {
    fillColor: '#3388ff',
    fillOpacity: 0.5,
    strokeColor: '#3388ff',
    strokeWidth: 2,
    strokeOpacity: 1,
    pointRadius: 6,
  };
}

function randomColor(): string {
  const colors = ['#e53e3e', '#dd6b20', '#d69e2e', '#38a169', '#3182ce', '#805ad5', '#d53f8c'];
  return colors[Math.floor(Math.random() * colors.length)];
}
