"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, ChevronsUpDown, ChevronUp, ChevronDown, Loader2 } from "lucide-react";
import { cn } from "../lib/utils";

export interface DataTableColumn<T> {
  key: string;
  label: string;
  sortable?: boolean;
  className?: string;
  render?: (value: unknown, row: T, index: number) => React.ReactNode;
}

export interface DataTablePagination {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

export type SortDirection = "asc" | "desc";

export interface DataTableSort {
  key: string;
  direction: SortDirection;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  pagination?: DataTablePagination;
  onSort?: (sort: DataTableSort) => void;
  currentSort?: DataTableSort;
  loading?: boolean;
  emptyMessage?: string;
  className?: string;
  rowClassName?: string | ((row: T, index: number) => string);
  onRowClick?: (row: T, index: number) => void;
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, part) => {
    if (acc && typeof acc === "object" && part in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, obj);
}

function DataTableInner<T extends Record<string, unknown>>(
  {
    columns,
    data,
    pagination,
    onSort,
    currentSort,
    loading = false,
    emptyMessage = "No data available.",
    className,
    rowClassName,
    onRowClick,
  }: DataTableProps<T>,
  ref: React.ForwardedRef<HTMLDivElement>
) {
  const totalPages = pagination
    ? Math.ceil(pagination.total / pagination.pageSize)
    : 1;

  const handleSort = (key: string) => {
    if (!onSort) return;
    const direction: SortDirection =
      currentSort?.key === key && currentSort.direction === "asc"
        ? "desc"
        : "asc";
    onSort({ key, direction });
  };

  const renderSortIcon = (column: DataTableColumn<T>) => {
    if (!column.sortable || !onSort) return null;
    if (currentSort?.key === column.key) {
      return currentSort.direction === "asc" ? (
        <ChevronUp className="ml-1 h-4 w-4" />
      ) : (
        <ChevronDown className="ml-1 h-4 w-4" />
      );
    }
    return <ChevronsUpDown className="ml-1 h-4 w-4 opacity-30" />;
  };

  return (
    <div ref={ref} className={cn("w-full", className)}>
      <div className="rounded-md border">
        <div className="relative w-full overflow-auto">
          <table className="w-full caption-bottom text-sm">
            <thead className="[&_tr]:border-b">
              <tr className="border-b transition-colors hover:bg-muted/50">
                {columns.map((column) => (
                  <th
                    key={column.key}
                    className={cn(
                      "h-12 px-4 text-left align-middle font-medium text-muted-foreground",
                      column.sortable && onSort && "cursor-pointer select-none",
                      column.className
                    )}
                    onClick={
                      column.sortable && onSort
                        ? () => handleSort(column.key)
                        : undefined
                    }
                  >
                    <div className="flex items-center">
                      {column.label}
                      {renderSortIcon(column)}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="[&_tr:last-child]:border-0">
              {loading ? (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="h-24 text-center"
                  >
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-muted-foreground">Loading...</span>
                    </div>
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="h-24 text-center text-muted-foreground"
                  >
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                data.map((row, rowIndex) => {
                  const resolvedRowClassName =
                    typeof rowClassName === "function"
                      ? rowClassName(row, rowIndex)
                      : rowClassName;
                  return (
                    <tr
                      key={rowIndex}
                      className={cn(
                        "border-b transition-colors hover:bg-muted/50",
                        onRowClick && "cursor-pointer",
                        resolvedRowClassName
                      )}
                      onClick={
                        onRowClick
                          ? () => onRowClick(row, rowIndex)
                          : undefined
                      }
                    >
                      {columns.map((column) => {
                        const value = getNestedValue(row, column.key);
                        return (
                          <td
                            key={column.key}
                            className={cn(
                              "p-4 align-middle",
                              column.className
                            )}
                          >
                            {column.render
                              ? column.render(value, row, rowIndex)
                              : (value as React.ReactNode) ?? ""}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {pagination && totalPages > 1 && (
        <div className="flex items-center justify-between px-2 py-4">
          <p className="text-sm text-muted-foreground">
            {pagination.total} total result{pagination.total !== 1 ? "s" : ""}
          </p>
          <div className="flex items-center gap-2">
            <button
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-input bg-background text-sm hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50"
              onClick={() => pagination.onPageChange(pagination.page - 1)}
              disabled={pagination.page <= 1}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm text-muted-foreground">
              Page {pagination.page} of {totalPages}
            </span>
            <button
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-input bg-background text-sm hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50"
              onClick={() => pagination.onPageChange(pagination.page + 1)}
              disabled={pagination.page >= totalPages}
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const DataTable = React.forwardRef(DataTableInner) as <
  T extends Record<string, unknown>
>(
  props: DataTableProps<T> & { ref?: React.ForwardedRef<HTMLDivElement> }
) => React.ReactElement;

export { DataTable };
