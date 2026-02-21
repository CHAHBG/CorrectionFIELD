// =====================================================
//  FieldCorrect — XLSForm Parser
// =====================================================

import * as XLSX from 'xlsx';
import type { FieldSchema, FieldType, EnumValue } from '@/shared/types';

/**
 * Parse an XLSForm Excel file into FieldSchema[].
 */
export function parseXlsForm(file: File): Promise<FieldSchema[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const wb = XLSX.read(data, { type: 'binary' });

        const surveySheet = wb.Sheets['survey'];
        const choicesSheet = wb.Sheets['choices'];

        if (!surveySheet) {
          reject(new Error("Feuille 'survey' introuvable dans le fichier XLSForm"));
          return;
        }

        const survey = XLSX.utils.sheet_to_json<Record<string, string>>(surveySheet);
        const choices = choicesSheet
          ? XLSX.utils.sheet_to_json<Record<string, string>>(choicesSheet)
          : [];

        // Group choices by list_name
        const choiceMap = new Map<string, EnumValue[]>();
        for (const row of choices) {
          const listName = row.list_name;
          if (!listName) continue;
          if (!choiceMap.has(listName)) choiceMap.set(listName, []);
          choiceMap.get(listName)!.push({
            name: row.name ?? '',
            label: row['label::French'] ?? row.label ?? row.name ?? '',
            list_name: listName,
          });
        }

        const fields: FieldSchema[] = survey
          .filter((row) => row.type && row.name)
          .filter((row) => {
            // Skip begin_group / end_group / begin_repeat / end_repeat
            const t = row.type.trim().toLowerCase();
            return !t.startsWith('begin_') && !t.startsWith('end_');
          })
          .map((row) => {
            const rawType = row.type.trim();
            const { type, listName } = mapXlsType(rawType);

            return {
              name: row.name,
              type,
              label: row['label::French'] ?? row.label ?? row.name,
              required: row.required === 'yes',
              relevant: row.relevant ?? undefined,
              constraint: row.constraint ?? undefined,
              calculate: row.calculation ?? row.calculate ?? undefined,
              hint: row['hint::French'] ?? row.hint ?? undefined,
              enumValues: listName ? choiceMap.get(listName) ?? undefined : undefined,
              koboQuestionName: row.name,
            };
          });

        resolve(fields);
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = () => reject(reader.error);
    reader.readAsBinaryString(file);
  });
}

function mapXlsType(rawType: string): { type: FieldType; listName?: string } {
  const lower = rawType.toLowerCase();

  if (lower.startsWith('select_one ')) {
    return { type: 'select_one', listName: rawType.split(' ')[1] };
  }
  if (lower.startsWith('select_multiple ')) {
    return { type: 'select_multiple', listName: rawType.split(' ')[1] };
  }

  const mapping: Record<string, FieldType> = {
    text: 'text',
    integer: 'integer',
    decimal: 'decimal',
    date: 'date',
    datetime: 'datetime',
    geopoint: 'geopoint',
    geoshape: 'geopoint',
    image: 'image',
    photo: 'image',
    note: 'note',
    calculate: 'calculate',
    repeat: 'repeat',
    boolean: 'boolean',
    acknowledge: 'boolean',
  };

  return { type: mapping[lower] ?? 'text' };
}

/**
 * Infer FieldSchema[] from GeoJSON properties or Feature array (when no XLSForm is available).
 */
export function inferFieldsFromProperties(
  input: Record<string, unknown> | GeoJSON.Feature[]
): FieldSchema[] {
  let properties: Record<string, unknown>;
  if (Array.isArray(input)) {
    // Find first feature with properties
    const first = input.find((f) => f.properties && Object.keys(f.properties).length > 0);
    properties = (first?.properties ?? {}) as Record<string, unknown>;
  } else {
    properties = input;
  }
  return Object.entries(properties).map(([name, value]) => ({
    name,
    type: inferType(value),
    label: name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    required: false,
    editable: true,
  }));
}

function inferType(value: unknown): FieldType {
  if (typeof value === 'number') {
    return Number.isInteger(value) ? 'integer' : 'decimal';
  }
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'string') {
    // Date pattern
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) return 'date';
  }
  return 'text';
}
