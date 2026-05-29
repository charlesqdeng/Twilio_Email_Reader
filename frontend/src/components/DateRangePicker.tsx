import { useState } from 'react';

interface DateRangePickerProps {
  onFetch: (startDate?: string, endDate?: string, unreadOnly?: boolean) => void;
  loading: boolean;
}

export default function DateRangePicker({ onFetch, loading }: DateRangePickerProps) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const handleUnreadFetch = () => {
    onFetch(undefined, undefined, true);
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (new Date(startDate) > new Date(endDate)) {
      alert('Start date must be before end date');
      return;
    }
    onFetch(startDate, endDate, false);
  };

  return (
    <div className="space-y-4">
      {/* Unread Emails Button - Primary Action */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-3">
          Quick Actions
        </label>
        <button
          type="button"
          onClick={handleUnreadFetch}
          disabled={loading}
          className="w-full px-8 py-6 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-bold text-xl rounded-lg hover:from-green-700 hover:to-emerald-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:ring-offset-slate-800 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transition-all"
        >
          <div className="flex items-center justify-center gap-3">
            <span className="text-3xl">📬</span>
            <div>
              <div>Analyze Unread Emails</div>
              <div className="text-xs mt-1 opacity-90 font-normal">All unread messages in your inbox</div>
            </div>
          </div>
        </button>
      </div>

      {/* Custom Date Range */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-3">
          Fetch by Date Range
        </label>
        <form onSubmit={handleCustomSubmit} className="flex flex-col sm:flex-row gap-4 pt-2">
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
              required
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-300 mb-1">
              End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
              required
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={loading}
              className="w-full sm:w-auto px-6 py-2 bg-indigo-600 text-white font-medium rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Loading...' : 'Fetch'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
