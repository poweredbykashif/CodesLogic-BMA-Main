import React from 'react';
import { TableProps } from '../types';
import { EmptyState, SkeletonTable } from './Feedback';

export function Table<T>({
  columns = [],
  data = [],
  onRowClick,
  emptyMessage = "No data available",
  className = "",
  isLoading = false,
  isMetallicHeader = false,
  disableRowHover = false
}: TableProps<T>) {
  // Smooth loading: Only show skeletons on the first load (when data is empty/null)
  // If we already have data, we just dim it and show a small indicator
  if (isLoading && (!data || data.length === 0)) {
    return <SkeletonTable rows={5} className={className} />;
  }

  const hasData = data && data.length > 0;

  return (
    <div className={`w-full overflow-hidden rounded-2xl border border-surface-border bg-surface-card shadow-nova relative ${className}`}>
      {/* Smooth Loading Indicator (Top Progress Bar) */}
      {isLoading && hasData && (
        <div className="absolute top-0 left-0 w-full h-0.5 z-[100] overflow-hidden bg-brand-primary/10">
          <div className="h-full bg-brand-primary animate-[shimmer_1.5s_infinite] origin-left w-1/3" />
        </div>
      )}

      <div className={`overflow-x-auto transition-all duration-300 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent hover:scrollbar-thumb-white/20 ${isLoading && hasData ? 'opacity-50 grayscale-[0.6]' : 'opacity-100 grayscale-0'}`}>

        <table className="w-full text-left border-collapse table-auto">
          <thead className={isMetallicHeader ? "relative z-20" : ""}>
            <tr
              className={`
                ${isMetallicHeader
                  ? 'bg-[#1A1A1A] relative'
                  : 'bg-surface-overlay border-b border-surface-border'}
              `}
              style={isMetallicHeader ? {
                backgroundImage: 'radial-gradient(circle at 50% 0%, rgba(255,255,255,0.05) 0%, transparent 70%), linear-gradient(115deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0.05) 40%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.05) 60%, rgba(255,255,255,0.02) 100%)',
                backgroundSize: '100% 100%'
              } : {}}
            >
              {columns.map((col, idx) => {
                const headerAlignmentClasses = col.className
                  ? col.className.split(' ').filter(c =>
                    (c.startsWith('text-') && ['left', 'center', 'right'].includes(c.split('-')[1])) ||
                    c.startsWith('w-') ||
                    c.startsWith('min-w-') ||
                    c === 'whitespace-nowrap'
                  ).join(' ')
                  : '';

                return (
                  <th
                    key={idx}
                    className={`px-6 py-4 text-[11px] font-bold uppercase tracking-widest ${isMetallicHeader ? 'text-white' : 'text-gray-400'} ${headerAlignmentClasses} relative`}
                  >
                    {isMetallicHeader && idx === 0 && (
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[80%] h-px bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />
                    )}
                    {isMetallicHeader && (
                      <div className="absolute bottom-0 left-0 w-full h-[1px] bg-white/5 pointer-events-none" />
                    )}
                    <span className="relative z-10">{col.header}</span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border">
            {!data || data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="p-0">
                  <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                    <div className="mb-4 text-gray-600">
                      <svg className="w-16 h-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-bold text-white mb-2">No Data</h3>
                    <p className="text-gray-400 max-w-sm">{emptyMessage}</p>
                  </div>
                </td>
              </tr>
            ) : (
              data.map((item, rowIdx) => (
                <tr
                  key={rowIdx}
                  onClick={() => onRowClick?.(item)}
                  className={`transition-all duration-200 ease-out group ${disableRowHover
                    ? ''
                    : onRowClick
                      ? 'cursor-pointer hover:bg-white/[0.06] active:bg-white/[0.08]'
                      : 'hover:bg-white/[0.03]'
                    }`}
                >
                  {columns.map((col, colIdx) => (
                    <td key={colIdx} className={`px-6 py-4 text-sm text-gray-300 ${colIdx % 2 === 1 ? 'bg-white/[0.02]' : ''} ${col.className || ''}`}>
                      {col.render ? col.render(item, rowIdx) : (item as any)[col.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}