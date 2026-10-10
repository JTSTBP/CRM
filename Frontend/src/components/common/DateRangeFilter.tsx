import React, { useState } from 'react';
import { Filter, X, Calendar } from 'lucide-react';

interface DateRange {
    startDate: string;
    endDate: string;
}

interface DateRangeFilterProps {
    onApply: (range: DateRange | null) => void;
    initialRange?: DateRange | null;
}

const DateRangeFilter: React.FC<DateRangeFilterProps> = ({ onApply, initialRange }) => {
    const [startDate, setStartDate] = useState(initialRange?.startDate || '');
    const [endDate, setEndDate] = useState(initialRange?.endDate || '');
    const [isOpen, setIsOpen] = useState(false);

    const handleApply = () => {
        if (startDate && endDate) {
            onApply({ startDate, endDate });
            setIsOpen(false);
        }
    };

    const handleClear = () => {
        setStartDate('');
        setEndDate('');
        onApply(null);
        setIsOpen(false);
    };

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all shadow-sm border ${startDate && endDate
                        ? 'bg-sky-50 border-sky-200 text-[#0ea5e9]'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
            >
                <Calendar size={16} />
                {startDate && endDate ? `${startDate} to ${endDate}` : 'Filter by Date'}
                {(startDate && endDate) && (
                    <X
                        size={14}
                        className="ml-1 hover:text-rose-500"
                        onClick={(e) => {
                            e.stopPropagation();
                            handleClear();
                        }}
                    />
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-slate-200 p-4 z-[100] animate-in fade-in zoom-in-95 duration-200">
                    <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
                        <h4 className="font-extrabold text-[#0f1c2e] text-sm flex items-center gap-2">
                            <Filter size={14} className="text-[#0ea5e9]" />
                            Date Range
                        </h4>
                        <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-rose-500">
                            <X size={16} />
                        </button>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">From Date</label>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0ea5e9]/20 focus:border-[#0ea5e9] transition-all"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">To Date</label>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0ea5e9]/20 focus:border-[#0ea5e9] transition-all"
                            />
                        </div>

                        <div className="flex gap-2 pt-2">
                            <button
                                onClick={handleClear}
                                className="flex-1 py-2 bg-slate-50 text-slate-500 rounded-xl text-xs font-bold hover:bg-slate-100 transition-colors"
                            >
                                Reset All
                            </button>
                            <button
                                onClick={handleApply}
                                disabled={!startDate || !endDate}
                                className="flex-[2] py-2 bg-gradient-to-r from-[#0ea5e9] to-[#0284c7] text-white rounded-xl text-xs font-bold hover:shadow-lg hover:shadow-sky-500/20 transition-all disabled:opacity-50 disabled:shadow-none"
                            >
                                Apply Filter
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DateRangeFilter;
