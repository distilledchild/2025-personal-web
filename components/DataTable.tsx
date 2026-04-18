import React from 'react';

export type DataTableTheme = 'orange' | 'teal' | 'slate';

export interface DataTableColumn<T> {
    key: string;
    header: React.ReactNode;
    render: (row: T, index: number) => React.ReactNode;
    className?: string;
    headerClassName?: string;
}

interface DataTableProps<T> {
    columns: DataTableColumn<T>[];
    rows: T[];
    getRowKey: (row: T, index: number) => React.Key;
    theme?: DataTableTheme;
    minRows?: number;
    emptyState?: React.ReactNode;
    className?: string;
    tableClassName?: string;
}

const themeConfig: Record<DataTableTheme, { header: string; hover: string }> = {
    orange: {
        header: 'bg-gradient-to-r from-orange-50 to-slate-50',
        hover: 'hover:bg-orange-50'
    },
    teal: {
        header: 'bg-gradient-to-r from-teal-50 to-slate-50',
        hover: 'hover:bg-teal-50'
    },
    slate: {
        header: 'bg-gradient-to-r from-slate-50 to-white',
        hover: 'hover:bg-slate-50'
    }
};

export function DataTable<T>({
    columns,
    rows,
    getRowKey,
    theme = 'slate',
    minRows = 0,
    emptyState,
    className = '',
    tableClassName = 'w-full table-fixed'
}: DataTableProps<T>) {
    const { header, hover } = themeConfig[theme];
    const hasEmptyState = rows.length === 0 && Boolean(emptyState);
    const emptyRowCount = hasEmptyState ? 0 : Math.max(0, minRows - rows.length);

    return (
        <div className={`bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden ${className}`}>
            <div className="overflow-x-auto scrollbar-hide">
                <table className={tableClassName}>
                    <thead className={header}>
                        <tr>
                            {columns.map((column) => (
                                <th
                                    key={column.key}
                                    className={`px-6 py-4 text-left text-sm font-bold text-slate-700 border-b border-slate-200 ${column.headerClassName || ''}`}
                                >
                                    {column.header}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row, index) => (
                            <tr
                                key={getRowKey(row, index)}
                                className={`${hover} transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}
                            >
                                {columns.map((column) => (
                                    <td
                                        key={column.key}
                                        className={`px-6 py-4 text-sm text-slate-600 border-b border-slate-100 ${column.className || ''}`}
                                    >
                                        {column.render(row, index)}
                                    </td>
                                ))}
                            </tr>
                        ))}

                        {hasEmptyState ? (
                            <tr>
                                <td colSpan={columns.length} className="px-6 py-10 text-center text-sm text-slate-500 border-b border-slate-100">
                                    {emptyState}
                                </td>
                            </tr>
                        ) : null}

                        {Array.from({ length: rows.length === 0 ? Math.max(0, emptyRowCount - 1) : emptyRowCount }).map((_, index) => (
                            <tr
                                key={`empty-${index}`}
                                className={`${(rows.length + index) % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}
                            >
                                {columns.map((column) => (
                                    <td
                                        key={column.key}
                                        className={`px-6 py-4 text-sm text-slate-600 border-b border-slate-100 ${column.className || ''}`}
                                    >
                                        &nbsp;
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default DataTable;
