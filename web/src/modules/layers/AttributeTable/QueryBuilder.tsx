// =====================================================
//  FieldCorrect — Query Builder (visual filter)
// =====================================================

import { Plus, Trash2, XCircle } from 'lucide-react';
import { Button, Input } from '@/shared/ui/components';
import { cn } from '@/shared/ui/cn';
import type { QueryFilter, QueryFilterGroup, QueryRule, FieldSchema } from '@/shared/types';

interface QueryBuilderProps {
  fields: FieldSchema[];
  value: QueryFilter;
  onChange: (filter: QueryFilter) => void;
}

const OPERATORS: Record<string, { label: string; ops: { value: string; label: string }[] }> = {
  text: {
    label: 'Texte',
    ops: [
      { value: '=', label: 'est' },
      { value: '!=', label: "n'est pas" },
      { value: 'CONTAINS', label: 'contient' },
      { value: 'STARTS_WITH', label: 'commence par' },
      { value: 'ENDS_WITH', label: 'finit par' },
      { value: 'IS_NULL', label: 'est vide' },
      { value: 'IS_NOT_NULL', label: "n'est pas vide" },
    ],
  },
  number: {
    label: 'Nombre',
    ops: [
      { value: '=', label: '=' },
      { value: '!=', label: '≠' },
      { value: '<', label: '<' },
      { value: '<=', label: '≤' },
      { value: '>', label: '>' },
      { value: '>=', label: '≥' },
      { value: 'IS_NULL', label: 'est vide' },
    ],
  },
  date: {
    label: 'Date',
    ops: [
      { value: '=', label: 'est' },
      { value: 'BEFORE', label: 'avant' },
      { value: 'AFTER', label: 'après' },
      { value: 'IS_NULL', label: 'est vide' },
    ],
  },
};

function getOpsForField(field: FieldSchema) {
  if (field.type === 'integer' || field.type === 'decimal') return OPERATORS.number.ops;
  if (field.type === 'date' || field.type === 'datetime') return OPERATORS.date.ops;
  return OPERATORS.text.ops;
}

export function QueryBuilder({ fields, value, onChange }: QueryBuilderProps) {
  const addRule = () => {
    onChange({
      ...value,
      rules: [
        ...value.rules,
        { field: fields[0]?.name ?? '', op: '=', value: '' } as QueryRule,
      ],
    });
  };

  const addGroup = () => {
    onChange({
      ...value,
      rules: [
        ...value.rules,
        { operator: 'AND', rules: [] } as QueryFilterGroup,
      ],
    });
  };

  const removeRule = (index: number) => {
    onChange({
      ...value,
      rules: value.rules.filter((_, i) => i !== index),
    });
  };

  const updateRule = (index: number, rule: QueryRule | QueryFilterGroup) => {
    const newRules = [...value.rules];
    newRules[index] = rule;
    onChange({ ...value, rules: newRules });
  };

  const toggleOperator = () => {
    onChange({ ...value, operator: value.operator === 'AND' ? 'OR' : 'AND' });
  };

  return (
    <div className="space-y-2 rounded-md border border-gray-200 bg-gray-50 p-3">
      {/* Group operator toggle */}
      <div className="flex items-center gap-2 mb-2">
        <button
          className={cn(
            'rounded px-2 py-0.5 text-xs font-semibold',
            value.operator === 'AND'
              ? 'bg-blue-100 text-blue-700'
              : 'bg-gray-200 text-gray-600'
          )}
          onClick={toggleOperator}
        >
          {value.operator === 'AND' ? 'ET (toutes)' : 'OU (au moins une)'}
        </button>
      </div>

      {/* Rules */}
      {value.rules.map((rule, idx) => (
        <div key={idx} className="flex items-start gap-2">
          {'field' in rule ? (
            <RuleRow
              rule={rule as QueryRule}
              fields={fields}
              onChange={(r) => updateRule(idx, r)}
              onRemove={() => removeRule(idx)}
            />
          ) : (
            <div className="flex-1">
              <QueryBuilder
                fields={fields}
                value={rule as QueryFilterGroup}
                onChange={(g) => updateRule(idx, g)}
              />
              <Button
                variant="ghost"
                size="sm"
                className="mt-1 text-red-500"
                onClick={() => removeRule(idx)}
              >
                <Trash2 size={12} className="mr-1" /> Supprimer le groupe
              </Button>
            </div>
          )}
        </div>
      ))}

      {/* Add buttons */}
      <div className="flex gap-2 pt-1">
        <Button variant="ghost" size="sm" onClick={addRule}>
          <Plus size={12} className="mr-1" /> Condition
        </Button>
        <Button variant="ghost" size="sm" onClick={addGroup}>
          <Plus size={12} className="mr-1" /> Groupe
        </Button>
      </div>
    </div>
  );
}

function RuleRow({
  rule,
  fields,
  onChange,
  onRemove,
}: {
  rule: QueryRule;
  fields: FieldSchema[];
  onChange: (r: QueryRule) => void;
  onRemove: () => void;
}) {
  const field = fields.find((f) => f.name === rule.field) ?? fields[0];
  const ops = field ? getOpsForField(field) : OPERATORS.text.ops;
  const needsValue = !['IS_NULL', 'IS_NOT_NULL'].includes(rule.op);

  return (
    <div className="flex items-center gap-1 flex-1">
      <select
        className="h-7 rounded border px-1 text-xs"
        value={rule.field}
        onChange={(e) => onChange({ ...rule, field: e.target.value })}
      >
        {fields.map((f) => (
          <option key={f.name} value={f.name}>{f.label ?? f.name}</option>
        ))}
      </select>

      <select
        className="h-7 rounded border px-1 text-xs"
        value={rule.op}
        onChange={(e) => onChange({ ...rule, op: e.target.value })}
      >
        {ops.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>

      {needsValue && (
        <Input
          className="h-7 flex-1 text-xs"
          value={String(rule.value ?? '')}
          onChange={(e) => onChange({ ...rule, value: e.target.value })}
          placeholder="Valeur..."
        />
      )}

      <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={onRemove}>
        <XCircle size={12} className="text-gray-400" />
      </Button>
    </div>
  );
}

/**
 * Compile a QueryFilter to a MapLibre filter expression.
 */
export function compileToMapLibreFilter(filter: QueryFilter): unknown[] | undefined {
  if (filter.rules.length === 0) return undefined;

  const compiled = filter.rules
    .map((rule) => {
      if ('field' in rule) {
        return compileRule(rule as QueryRule);
      } else {
        return compileToMapLibreFilter(rule as QueryFilterGroup);
      }
    })
    .filter(Boolean);

  if (compiled.length === 0) return undefined;
  if (compiled.length === 1) return compiled[0] as unknown[];

  return [filter.operator === 'AND' ? 'all' : 'any', ...compiled];
}

function compileRule(rule: QueryRule): unknown[] | null {
  switch (rule.op) {
    case '=':  return ['==', ['get', rule.field], rule.value];
    case '!=': return ['!=', ['get', rule.field], rule.value];
    case '<':  return ['<',  ['get', rule.field], Number(rule.value)];
    case '<=': return ['<=', ['get', rule.field], Number(rule.value)];
    case '>':  return ['>',  ['get', rule.field], Number(rule.value)];
    case '>=': return ['>=', ['get', rule.field], Number(rule.value)];
    case 'CONTAINS':
      return ['>', ['index-of', String(rule.value).toLowerCase(), ['downcase', ['get', rule.field]]], -1];
    case 'IS_NULL':     return ['!', ['has', rule.field]];
    case 'IS_NOT_NULL': return ['has', rule.field];
    default: return null;
  }
}
