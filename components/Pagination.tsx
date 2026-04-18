import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export type PaginationTheme = 'pink' | 'purple' | 'orange' | 'teal' | 'gray' | 'slate';
export type PaginationVariant = 'numbered' | 'compact';

interface PaginationProps {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    theme?: PaginationTheme;
    variant?: PaginationVariant;
    className?: string;
    /** Optional: For displaying "Showing X to Y of Z" text */
    showingInfo?: {
        start: number;
        end: number;
        total: number;
        label?: string; // e.g., "activities", "items"
    };
}

// Theme configurations for active button colors
const themeConfig: Record<PaginationTheme, { active: string; activeHover: string }> = {
    pink: { active: 'bg-pink-500 text-white', activeHover: 'hover:bg-pink-600' },
    purple: { active: 'bg-purple-500 text-white', activeHover: 'hover:bg-purple-600' },
    orange: { active: 'bg-[#FFA300] text-white', activeHover: 'hover:bg-[#FF8C00]' },
    teal: { active: 'bg-teal-500 text-white', activeHover: 'hover:bg-teal-600' },
    gray: { active: 'bg-gray-500 text-white', activeHover: 'hover:bg-gray-600' },
    slate: { active: 'bg-slate-700 text-white', activeHover: 'hover:bg-slate-800' },
};

/**
 * Reusable Pagination Component
 * 
 * Features:
 * - Always visible pagination controls
 * - Previous/Next buttons with proper disabled states
 * - Two variants: 'numbered' (shows page buttons) and 'compact' (shows page text)
 * - Optional "Showing X to Y of Z" display for table paginations
 * - Theme support for different page color schemes
 */
export const Pagination: React.FC<PaginationProps> = ({
    currentPage,
    totalPages,
    onPageChange,
    theme = 'pink',
    variant = 'numbered',
    className = '',
    showingInfo
}) => {
    const effectiveTotalPages = Math.max(1, totalPages);
    const { active, activeHover } = themeConfig[theme];

    const handlePrevious = () => {
        if (currentPage > 1) {
            onPageChange(currentPage - 1);
        }
    };

    const handleNext = () => {
        if (currentPage < effectiveTotalPages) {
            onPageChange(currentPage + 1);
        }
    };

    // Compact variant - shows icon buttons with page text
    if (variant === 'compact') {
        return (
            <div className={`flex items-center justify-between ${className}`}>
                {/* Showing info (optional) */}
                {showingInfo ? (
                    <p className="text-sm text-slate-600">
                        Showing <span className="font-bold text-slate-900">{showingInfo.start}</span> to{' '}
                        <span className="font-bold text-slate-900">{showingInfo.end}</span> of{' '}
                        <span className="font-bold text-slate-900">{showingInfo.total}</span>{' '}
                        {showingInfo.label || 'items'}
                    </p>
                ) : (
                    <div></div>
                )}

                <div className="flex items-center gap-2">
                    {/* Previous Button - Icon */}
                    <button
                        onClick={handlePrevious}
                        disabled={currentPage === 1}
                        aria-label="Previous page"
                        className={`px-4 py-2 rounded-lg font-medium transition-all ${currentPage === 1
                            ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                            : `${active} ${activeHover} shadow-sm hover:shadow-md`
                            }`}
                    >
                        <ChevronLeft size={20} />
                    </button>

                    {/* Page Text */}
                    <span className="text-sm font-medium text-slate-700">
                        Page {currentPage} of {effectiveTotalPages}
                    </span>

                    {/* Next Button - Icon */}
                    <button
                        onClick={handleNext}
                        disabled={currentPage >= effectiveTotalPages}
                        aria-label="Next page"
                        className={`px-4 py-2 rounded-lg font-medium transition-all ${currentPage >= effectiveTotalPages
                            ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                            : `${active} ${activeHover} shadow-sm hover:shadow-md`
                            }`}
                    >
                        <ChevronRight size={20} />
                    </button>
                </div>
            </div>
        );
    }

    // Default: Numbered variant
    return (
        <div className={`flex items-center justify-center gap-2 ${className}`}>
            {/* Previous Button */}
            <button
                onClick={handlePrevious}
                disabled={currentPage === 1}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${currentPage === 1
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                    }`}
            >
                Previous
            </button>

            {/* Page Number Buttons - Smart pagination with ellipsis */}
            <div className="flex items-center gap-1">
                {(() => {
                    const pages: (number | string)[] = [];
                    const maxVisible = 7; // Maximum visible page buttons

                    if (effectiveTotalPages <= maxVisible) {
                        // Show all pages if total is small
                        for (let i = 1; i <= effectiveTotalPages; i++) {
                            pages.push(i);
                        }
                    } else {
                        // Always show first page
                        pages.push(1);

                        // Calculate range around current page
                        let start = Math.max(2, currentPage - 1);
                        let end = Math.min(effectiveTotalPages - 1, currentPage + 1);

                        // Adjust if at the beginning
                        if (currentPage <= 3) {
                            start = 2;
                            end = 4;
                        }

                        // Adjust if at the end
                        if (currentPage >= effectiveTotalPages - 2) {
                            start = effectiveTotalPages - 3;
                            end = effectiveTotalPages - 1;
                        }

                        // Add ellipsis before if needed
                        if (start > 2) {
                            pages.push('...');
                        }

                        // Add middle pages
                        for (let i = start; i <= end; i++) {
                            pages.push(i);
                        }

                        // Add ellipsis after if needed
                        if (end < effectiveTotalPages - 1) {
                            pages.push('...');
                        }

                        // Always show last page
                        pages.push(effectiveTotalPages);
                    }

                    return pages.map((page, index) => (
                        page === '...' ? (
                            <span key={`ellipsis-${index}`} className="px-2 text-slate-400">
                                ...
                            </span>
                        ) : (
                            <button
                                key={page}
                                onClick={() => onPageChange(page as number)}
                                className={`w-10 h-10 rounded-lg font-medium transition-colors ${currentPage === page
                                    ? `${active} ${activeHover}`
                                    : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                                    }`}
                            >
                                {page}
                            </button>
                        )
                    ));
                })()}
            </div>

            {/* Next Button */}
            <button
                onClick={handleNext}
                disabled={currentPage >= effectiveTotalPages}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${currentPage >= effectiveTotalPages
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                    }`}
            >
                Next
            </button>
        </div>
    );
};

export default Pagination;
