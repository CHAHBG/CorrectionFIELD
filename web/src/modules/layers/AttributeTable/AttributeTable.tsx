// =====================================================
//  FieldCorrect — Attribute Table (virtualized)
// =====================================================

import { useMemo, useRef, useState, useEffect } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  type SortingState,
  type ColumnFiltersState,
  type ColumnDef,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { X, Download, ArrowUpDown, Search } from 'lucide-react';
import { useFeatures } from '@/modules/map/hooks/useFeatures';
import { useMapStore } from '@/stores/mapStore';
import { useLayerStore } from '@/stores/layerStore';
import { Button, Input, Badge } from '@/shared/ui/components';
import { cn } from '@/shared/ui/cn';
import type { AppFeature } from '@/shared/types';

export function AttributeTable() {
  const layerId = useMapStore((s) => s.attributeTableLayerId);
  const setOpen = useMapStore((s) => s.setAttributeTableOpen);
  const layer = useLayerStore((s) => s.layers.find((l) => l.id === layerId));
  const { data: features } = useFeatures(layerId ?? undefined);
  const parentRef = useRef<HTMLDivElement>(null);

  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [editingCell, setEditingCell] = useState<{ row: string; col: string } | null>(null);

  // Generate columns from layer fields
  const columns = useMemo<ColumnDef<AppFeature>[]>(() => {
    if (!layer) return [];

    const cols: ColumnDef<AppFeature>[] = [
      {
        accessorKey: 'status',
        header: 'Status',
        size: 100,
        cell: ({ getValue }) => {
          const status = getValue() as string;
          return <Badge variant={status as 'pending'}>{status}</Badge>;
        },
      },
    ];

    for (const field of layer.fields) {
      cols.push({
        id: field.name,
        accessorFn: (row) => row.props[field.name],
        header: field.label ?? field.name,
        size: 150,
        cell: ({ getValue, row }) => {
          const value = getValue();
          const isEditing =
            editingCell?.row === row.original.id && editingCell?.col === field.name;

          if (isEditing) {
            return (
              <input
                autoFocus
                className="w-full h-full px-1 border rounded text-xs"
                defaultValue={String(value ?? '')}
                onBlur={() => setEditingCell(null)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === 'Escape') {
                    setEditingCell(null);
                  }
                }}
              />
            );
          }

          return (
            <span
              className="truncate cursor-default"
              onDoubleClick={() => {
                if (field.editable !== false) {
                  setEditingCell({ row: row.original.id, col: field.name });
                }
              }}
            >
              {value != null ? String(value) : ''}
            </span>
          );
        },
      });
    }

    return cols;
  }, [layer, editingCell]);

  const table = useReactTable({
    data: features ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    enableMultiRowSelection: true,
    state: { sorting, columnFilters, globalFilter },
    getRowId: (row) => row.id,
  });

  // Virtualizer
  const rows = table.getRowModel().rows;
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 32,
    overscan: 15,
  });

  // Sync table selection → map
  const selectedRows = table.getSelectedRowModel().rows;
  useEffect(() => {
    const ids = selectedRows.map((r) => r.original.id);
    if (ids.length > 0) {
      useMapStore.getState().setSelectedFeatureIds(ids);
    }
  }, [selectedRows]);

  if (!layer) return null;

  const totalFeatures = features?.length ?? 0;
  const filteredCount = rows.length;

  return (
    <div className="flex flex-col bg-white border-t border-gray-200 shadow-lg" style={{ height: 320 }}>
      {/* Header bar */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-gray-200 bg-gray-50 shrink-0">
        <span className="text-sm font-semibold text-gray-800">{layer.name}</span>
        <span className="text-xs text-gray-500">
          {filteredCount === totalFeatures
            ? `${totalFeatures} features`
            : `${filteredCount} / ${totalFeatures} features`}
        </span>

        <div className="ml-auto flex items-center gap-1">
          <div className="relative">
            <Search className="absolute left-2 top-1.5 h-3.5 w-3.5 text-gray-400" />
            <Input
              className="h-7 w-48 pl-7 text-xs"
              placeholder="Rechercher..."
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
            />
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7" title="Exporter">
            <Download size={14} />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOpen(false)}>
            <X size={14} />
          </Button>
        </div>
      </div>

      {/* Table */}
      <div ref={parentRef} className="flex-1 overflow-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 z-10 bg-gray-100">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {/* Row checkbox */}
                <th className="w-8 px-1 py-1.5 border-b border-r border-gray-200">
                  <input
                    type="checkbox"
                    checked={table.getIsAllRowsSelected()}
                    onChange={table.getToggleAllRowsSelectedHandler()}
                  />
                </th>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-2 py-1.5 text-left font-medium text-gray-600 border-b border-r border-gray-200 cursor-pointer hover:bg-gray-200 select-none"
                    style={{ width: header.getSize() }}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <div className="flex items-center gap-1">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getIsSorted() && (
                        <ArrowUpDown size={10} className="text-blue-600" />
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {/* Virtual padding top */}
            {rowVirtualizer.getVirtualItems().length > 0 && (
              <tr>
                <td
                  style={{ height: rowVirtualizer.getVirtualItems()[0]?.start ?? 0 }}
                />
              </tr>
            )}
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const row = rows[virtualRow.index];
              const isSelected = row.getIsSelected();
              return (
                <tr
                  key={row.id}
                  className={cn(
                    'hover:bg-blue-50 transition-colors border-b border-gray-100',
                    isSelected && 'bg-blue-100'
                  )}
                  onClick={() => row.toggleSelected()}
                >
                  <td className="w-8 px-1 py-1 border-r border-gray-100">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={row.getToggleSelectedHandler()}
                    />
                  </td>
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className="px-2 py-1 border-r border-gray-100 max-w-[200px]"
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              );
            })}
            {/* Virtual padding bottom */}
            {rowVirtualizer.getVirtualItems().length > 0 && (
              <tr>
                <td
                  style={{
                    height:
                      rowVirtualizer.getTotalSize() -
                      (rowVirtualizer.getVirtualItems().at(-1)?.end ?? 0),
                  }}
                />
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
