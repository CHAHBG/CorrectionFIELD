// =====================================================
//  FieldCorrect — Dynamic Form (native React form)
// =====================================================

import { useMemo } from 'react';
import {
  useForm,
  Controller,
  type Control,
  type UseFormRegister,
  type FieldErrors,
} from 'react-hook-form';
import { Button, Input, Spinner } from '@/shared/ui/components';
import type { Layer, AppFeature, FieldSchema } from '@/shared/types';

type FormValues = Record<string, unknown>;

// ── Field components ────────────────────────────────
function TextField({ field, register }: FieldProps) {
  return (
    <Input
      {...register(field.name, { required: field.required ? 'Champ requis' : false })}
      placeholder={field.hint ?? field.label}
    />
  );
}

function NumberField({ field, register }: FieldProps) {
  return (
    <Input
      type="number"
      step={field.type === 'decimal' ? '0.01' : '1'}
      {...register(field.name, {
        required: field.required ? 'Champ requis' : false,
        valueAsNumber: true,
      })}
      placeholder={field.hint ?? field.label}
    />
  );
}

function SelectField({ field, register }: FieldProps) {
  return (
    <select
      className="flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-1 text-sm"
      {...register(field.name, { required: field.required ? 'Champ requis' : false })}
    >
      <option value="">— Sélectionner —</option>
      {field.enumValues?.map((ev) => (
        <option key={ev.name} value={ev.name}>{ev.label}</option>
      ))}
    </select>
  );
}

function DateField({ field, register }: FieldProps) {
  return (
    <Input
      type={field.type === 'datetime' ? 'datetime-local' : 'date'}
      {...register(field.name, { required: field.required ? 'Champ requis' : false })}
    />
  );
}

function BooleanField({ field, register }: FieldProps) {
  return (
    <label className="flex items-center gap-2">
      <input
        type="checkbox"
        {...register(field.name)}
        className="h-4 w-4 rounded border-gray-300"
      />
      <span className="text-sm">{field.label ?? field.name}</span>
    </label>
  );
}

function NoteField({ field }: { field: FieldSchema }) {
  return (
    <p className="text-sm text-gray-600 italic bg-blue-50 p-2 rounded">{field.label}</p>
  );
}

function GpsField({ field, control }: { field: FieldSchema; control: Control<FormValues> }) {
  return (
    <Controller
      name={field.name}
      control={control}
      render={({ field: formField }) => (
        <div className="flex items-center gap-2">
          <Input
            readOnly
            value={typeof formField.value === 'string' ? formField.value : ''}
            placeholder="Aucune position capturée"
            className="flex-1"
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => {
              navigator.geolocation.getCurrentPosition(
                (pos) => {
                  formField.onChange(
                    `${pos.coords.latitude} ${pos.coords.longitude} 0 ${pos.coords.accuracy.toFixed(1)}`
                  );
                },
                () => { /* error */ },
                { enableHighAccuracy: true, timeout: 15000 }
              );
            }}
          >
            📍 GPS
          </Button>
        </div>
      )}
    />
  );
}

function PhotoField({ field, control }: { field: FieldSchema; control: Control<FormValues> }) {
  return (
    <Controller
      name={field.name}
      control={control}
      render={({ field: formField }) => (
        <div>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                formField.onChange(URL.createObjectURL(file));
              }
            }}
            className="text-sm"
          />
          {typeof formField.value === 'string' && formField.value.length > 0 && (
            <img src={formField.value} alt="preview" className="mt-2 w-24 h-24 object-cover rounded" />
          )}
        </div>
      )}
    />
  );
}

// ── Field renderer ──────────────────────────────────
interface FieldProps {
  field: FieldSchema;
  register: UseFormRegister<FormValues>;
  error?: FieldErrors<FormValues>[string];
}

function FieldRenderer({
  field,
  register,
  control,
  error,
}: {
  field: FieldSchema;
  register: UseFormRegister<FormValues>;
  control: Control<FormValues>;
  error?: FieldErrors<FormValues>[string];
}) {
  if (field.type === 'note') return <NoteField field={field} />;
  if (field.type === 'geopoint') return <GpsField field={field} control={control} />;
  if (field.type === 'image') return <PhotoField field={field} control={control} />;

  const COMPONENTS: Record<string, React.FC<FieldProps>> = {
    text: TextField,
    integer: NumberField,
    decimal: NumberField,
    select_one: SelectField,
    select_multiple: SelectField,
    date: DateField,
    datetime: DateField,
    boolean: BooleanField,
  };

  const Component = COMPONENTS[field.type] ?? TextField;
  return <Component field={field} register={register} error={error} />;
}

// ── Main DynamicForm ────────────────────────────────
interface DynamicFormProps {
  layer: Layer;
  feature: AppFeature;
  onSubmit: (data: Record<string, unknown>) => void;
  loading?: boolean;
}

export function DynamicForm({ layer, feature, onSubmit, loading }: DynamicFormProps) {
  const defaultValues = useMemo(
    () => featureToDefaults(feature, layer),
    [feature, layer]
  );

  const { register, control, handleSubmit, watch, formState: { errors } } = useForm({
    defaultValues,
  });

  const watchAll = watch();

  // Evaluate XLSForm "relevant" conditions
  const visibleFields = useMemo(
    () => layer.fields.filter((field) => {
      if (!field.relevant) return true;
      // Simple expression parsing for common XLSForm patterns
      return evaluateRelevant(field.relevant, watchAll);
    }),
    [layer.fields, watchAll]
  );

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 p-4">
      {visibleFields.map((field) => (
        <div key={field.name}>
          {field.type !== 'note' && field.type !== 'boolean' && (
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {field.label ?? field.name}
              {field.required && <span className="text-red-500 ml-0.5">*</span>}
            </label>
          )}
          <FieldRenderer
            field={field}
            register={register}
            control={control}
            error={errors[field.name]}
          />
          {field.hint && field.type !== 'note' && (
            <p className="mt-0.5 text-xs text-gray-400">{field.hint}</p>
          )}
          {errors[field.name] && (
            <p className="mt-0.5 text-xs text-red-500">
              {String(errors[field.name]?.message ?? 'Erreur')}
            </p>
          )}
        </div>
      ))}

      {/* Offline indicator */}
      {!navigator.onLine && (
        <div className="flex items-center gap-2 rounded bg-amber-50 p-2 text-xs text-amber-800">
          <span className="h-2 w-2 rounded-full bg-amber-500" />
          Mode hors-ligne — la correction sera envoyée au retour réseau
        </div>
      )}

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? <Spinner className="mr-2" /> : null}
        Soumettre la correction
      </Button>
    </form>
  );
}

// ── Helpers ─────────────────────────────────────────
function featureToDefaults(
  feature: AppFeature,
  layer: Layer
): Record<string, unknown> {
  const defaults: Record<string, unknown> = {};
  for (const field of layer.fields) {
    defaults[field.name] = feature.props[field.name] ?? '';
  }
  return defaults;
}

function evaluateRelevant(
  expr: string,
  values: Record<string, unknown>
): boolean {
  try {
    // Handle common patterns: ${field_name} = 'value'
    const normalized = expr.replace(/\$\{(\w+)\}/g, (_, name) => {
      const val = values[name];
      return typeof val === 'string' ? `'${val}'` : String(val ?? '');
    });

    // Very basic evaluation for common comparisons
    const eqMatch = normalized.match(/^'?(.+?)'?\s*=\s*'(.+?)'$/);
    if (eqMatch) return eqMatch[1] === eqMatch[2];

    const neqMatch = normalized.match(/^'?(.+?)'?\s*!=\s*'(.+?)'$/);
    if (neqMatch) return neqMatch[1] !== neqMatch[2];

    return true; // Default: show field
  } catch {
    return true;
  }
}
