import { useState, useEffect } from 'react';
import axios from 'axios';
import DateRangePicker from './DateRangePicker';
import CustomerTaskBoard from './CustomerTaskBoard';
import ProgressBar from './ProgressBar';
import GongCallProcessor from './GongCallProcessor';

interface EmailDashboardProps {
  onLogout: () => void;
  onShowSettings: () => void;
  summaryOnly?: boolean;
}

interface PersistedAnalysis {
  customers: any[];
  analyzedEmails: any[];
  timestamp: string;
  fetchType: 'unread' | 'dateRange';
  emailCount: number;
}

interface MatchingEmail {
  id: string;
  subject: string;
  from: string;
  to?: string;
  date?: string;
  snippet?: string;
}

interface CustomerSummary {
  customer_name: string;
  email_count: number;
  summary: string;
  themes: string[];
  stakeholders: string[];
  open_items: string[];
  risk_level: string;
  recommended_next_steps: string[];
  matchingEmails?: MatchingEmail[];
}

const STORAGE_KEY = 'email-analysis-data';

const formatDateInput = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getDefaultSummaryDateRange = () => {
  const endDate = new Date();
  const startDate = new Date(endDate);
  startDate.setDate(endDate.getDate() - 29);

  return {
    startDate: formatDateInput(startDate),
    endDate: formatDateInput(endDate)
  };
};

export default function EmailDashboard({ onLogout, onShowSettings, summaryOnly = false }: EmailDashboardProps) {
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [analyzedEmails, setAnalyzedEmails] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [fetchType, setFetchType] = useState<'unread' | 'dateRange' | null>(null);
  const [lastAnalysisTime, setLastAnalysisTime] = useState<string | null>(null);
  const [showGongProcessor, setShowGongProcessor] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [summaryResult, setSummaryResult] = useState<CustomerSummary | null>(null);
  const [summaryResults, setSummaryResults] = useState<CustomerSummary[]>([]);
  const [summaryCopied, setSummaryCopied] = useState(false);
  const [showMatchingEmails, setShowMatchingEmails] = useState(false);
  const defaultSummaryDates = getDefaultSummaryDateRange();
  const [customerSummaryInput, setCustomerSummaryInput] = useState({
    customerName: '',
    domain: '',
    startDate: defaultSummaryDates.startDate,
    endDate: defaultSummaryDates.endDate
  });

  // Load persisted analysis on mount
  useEffect(() => {
    const loadPersistedData = () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const data: PersistedAnalysis = JSON.parse(stored);
          setCustomers(data.customers);
          setAnalyzedEmails(data.analyzedEmails);
          setFetchType(data.fetchType);
          setLastAnalysisTime(data.timestamp);
          console.log(`📦 Loaded ${data.emailCount} emails from storage (analyzed at ${data.timestamp})`);
        }
      } catch (err) {
        console.error('Failed to load persisted data:', err);
        localStorage.removeItem(STORAGE_KEY);
      }
    };

    loadPersistedData();
  }, []);

  // Save analysis to localStorage
  const saveAnalysisToStorage = (customers: any[], analyzedEmails: any[], type: 'unread' | 'dateRange') => {
    try {
      const data: PersistedAnalysis = {
        customers,
        analyzedEmails,
        timestamp: new Date().toISOString(),
        fetchType: type,
        emailCount: analyzedEmails.length
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      setLastAnalysisTime(data.timestamp);
      console.log(`💾 Saved ${analyzedEmails.length} emails to storage`);
    } catch (err) {
      console.error('Failed to save to storage:', err);
    }
  };

  // Clear persisted data
  const clearPersistedData = () => {
    localStorage.removeItem(STORAGE_KEY);
    setCustomers([]);
    setAnalyzedEmails([]);
    setLastAnalysisTime(null);
    setFetchType(null);
    console.log('🗑️ Cleared persisted analysis data');
  };

  const handleFetchEmails = async (startDate?: string, endDate?: string, unreadOnly?: boolean) => {
    try {
      setLoading(true);
      setError(null);
      setProgress(null);
      setFetchType(unreadOnly ? 'unread' : 'dateRange');

      // Build params based on fetch type
      const params: any = {};
      if (unreadOnly) {
        params.unreadOnly = 'true';
      } else if (startDate && endDate) {
        params.startDate = startDate.split('T')[0].replace(/-/g, '/');
        params.endDate = endDate.split('T')[0].replace(/-/g, '/');
      }

      // Fetch emails
      const emailsResponse = await axios.get('/api/emails', { params });

      const emails = emailsResponse.data.emails;

      if (emails.length === 0) {
        setError(unreadOnly ? 'No unread emails found in inbox' : 'No emails found in the selected date range');
        setCustomers([]);
        setAnalyzedEmails([]);
        setLoading(false);
        return;
      }

      // Show count of emails being processed
      console.log(`📧 Processing ${emails.length} ${unreadOnly ? 'unread' : ''} emails from inbox`);

      // Analyze emails with AI using fetch with streaming
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const response = await fetch(`${API_URL}/api/emails/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ emails })
      });

      if (!response.ok) {
        throw new Error('Failed to analyze emails');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('Response body is not readable');
      }

      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE messages
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || ''; // Keep incomplete message in buffer

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.substring(6));

            if (data.type === 'progress') {
              setProgress({ current: data.current, total: data.total });
            } else if (data.type === 'complete') {
              const customersData = data.customers || [];
              const emailsData = data.analyzedEmails || [];
              setCustomers(customersData);
              setAnalyzedEmails(emailsData);
              setProgress(null);
              setLoading(false);

              // Save to localStorage
              saveAnalysisToStorage(customersData, emailsData, fetchType || 'dateRange');
            } else if (data.type === 'error') {
              setError(data.error || 'Failed to analyze emails');
              setProgress(null);
              setLoading(false);
            }
          }
        }
      }
    } catch (err: any) {
      console.error('Error:', err);
      setError(err.response?.data?.error || 'Failed to fetch emails. Please try again.');
      setProgress(null);
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      if (customers.length === 0 && analyzedEmails.length === 0) {
        setError('No data to export. Please fetch emails first.');
        return;
      }

      const response = await axios.post('/api/emails/export', {
        customers,
        analyzedEmails
      }, {
        responseType: 'blob'
      });

      // Create download link
      const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `email-analysis-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('Error exporting:', err);
      setError('Failed to export data. Please try again.');
    }
  };

  const handleGenerateCustomerSummary = async () => {
    const { customerName, domain, startDate, endDate } = customerSummaryInput;

    if (!customerName.trim()) {
      setSummaryError('Please enter at least one customer name.');
      return;
    }

    const normalizedCustomerNames = customerName
      .split(/[;,\n]+/)
      .map(name => name.trim())
      .filter(Boolean);

    if (normalizedCustomerNames.length === 0) {
      setSummaryError('Please enter at least one customer name.');
      return;
    }

    const resolvedStartDate = startDate || defaultSummaryDates.startDate;
    const resolvedEndDate = endDate || defaultSummaryDates.endDate;

    if (resolvedStartDate && resolvedEndDate && new Date(resolvedStartDate) > new Date(resolvedEndDate)) {
      setSummaryError('Start date must be before end date.');
      return;
    }

    setCustomerSummaryInput(prev => ({
      ...prev,
      startDate: resolvedStartDate,
      endDate: resolvedEndDate
    }));

    try {
      setSummaryLoading(true);
      setSummaryError(null);
      setSummaryCopied(false);
      setShowMatchingEmails(false);

      const response = await axios.post('/api/emails/customer-summary', {
        customerName: normalizedCustomerNames.join(', '),
        domain: domain.trim() || undefined,
        startDate: resolvedStartDate,
        endDate: resolvedEndDate
      });

      const summaries = response.data.summaries || (response.data.summary ? [response.data.summary] : []);
      setSummaryResults(summaries);
      setSummaryResult(summaries[0] || null);
    } catch (err: any) {
      console.error('Customer summary error:', err);
      setSummaryError(err.response?.data?.error || 'Failed to generate customer summary.');
      setSummaryResult(null);
    } finally {
      setSummaryLoading(false);
    }
  };

  const handleCustomerSummaryRequest = ({ customerName, domain }: { customerName: string; domain?: string }) => {
    setCustomerSummaryInput(prev => ({
      ...prev,
      customerName,
      domain: domain || prev.domain
    }));
    setSummaryError(null);
    setSummaryCopied(false);
  };

  const formatSummaryText = (summary: CustomerSummary) => {
    return [
      `${summary.customer_name} Summary`,
      '',
      summary.summary,
      '',
      'Themes:',
      ...summary.themes.map(theme => `- ${theme}`),
      '',
      'Stakeholders:',
      ...summary.stakeholders.map(stakeholder => `- ${stakeholder}`),
      '',
      'Open Items:',
      ...summary.open_items.map(item => `- ${item}`),
      '',
      'Recommended Next Steps:',
      ...summary.recommended_next_steps.map(step => `- ${step}`)
    ].join('\n');
  };

  const handleCopySummaryFromResult = async (summary: CustomerSummary) => {
    try {
      await navigator.clipboard.writeText(formatSummaryText(summary));
      setSummaryCopied(true);
      window.setTimeout(() => setSummaryCopied(false), 1600);
    } catch (error) {
      console.error('Failed to copy summary:', error);
      setSummaryError('Unable to copy the summary. You can still select and copy the text manually.');
    }
  };

  // Format relative time
  const getRelativeTime = (timestamp: string) => {
    const now = new Date();
    const then = new Date(timestamp);
    const diffMs = now.getTime() - then.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  };

  return (
    <div className="min-h-screen bg-slate-900">
      {!summaryOnly && (
        <div className="bg-slate-800 shadow-lg border-b border-slate-700">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex justify-between items-center">
              <h1 className="text-2xl font-bold text-white">Email Reader</h1>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowGongProcessor(true)}
                  className="px-4 py-2 text-sm font-medium text-green-300 bg-green-900/50 border border-green-700 rounded-md hover:bg-green-900 flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  Process Gong Calls
                </button>
                <button
                  onClick={onShowSettings}
                  className="px-4 py-2 text-sm font-medium text-indigo-300 bg-indigo-900/50 border border-indigo-700 rounded-md hover:bg-indigo-900"
                >
                  AI Settings
                </button>
                <button
                  onClick={onLogout}
                  className="px-4 py-2 text-sm font-medium text-slate-300 bg-slate-700 border border-slate-600 rounded-md hover:bg-slate-600"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!summaryOnly && (
          <div className="bg-slate-800 rounded-lg shadow-xl border border-slate-700 p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-lg font-semibold text-white">
                  Fetch & Analyze Emails
                </h2>
                {lastAnalysisTime && customers.length > 0 && (
                  <p className="text-sm text-slate-400 mt-1">
                    Last analyzed: {getRelativeTime(lastAnalysisTime)} • {analyzedEmails.length} email{analyzedEmails.length !== 1 ? 's' : ''}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                {customers.length > 0 && (
                  <>
                    <button
                      onClick={clearPersistedData}
                      className="px-4 py-2 text-sm font-medium text-slate-300 bg-slate-700 border border-slate-600 rounded-md hover:bg-slate-600 flex items-center gap-2"
                      title="Clear analysis data"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Clear
                    </button>
                    <button
                      onClick={handleExport}
                      className="px-4 py-2 text-sm font-medium text-green-300 bg-green-900/50 border border-green-700 rounded-md hover:bg-green-900 flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Export Data
                    </button>
                  </>
                )}
              </div>
            </div>
            <DateRangePicker onFetch={handleFetchEmails} loading={loading} />
          </div>
        )}

        <div className="bg-slate-800 rounded-lg shadow-xl border border-slate-700 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-white">Customer Activity Summary</h2>
              <p className="text-sm text-slate-400 mt-1">Search by customer name and domain across all mail folders.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Customer Name</label>
              <input
                type="text"
                value={customerSummaryInput.customerName}
                onChange={(e) => setCustomerSummaryInput(prev => ({ ...prev, customerName: e.target.value }))}
                placeholder="Acme Corp, Contoso, Northwind"
                className="w-full px-3 py-2 bg-slate-700 text-white border border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Domain</label>
              <input
                type="text"
                value={customerSummaryInput.domain}
                onChange={(e) => setCustomerSummaryInput(prev => ({ ...prev, domain: e.target.value }))}
                placeholder="acme.com"
                className="w-full px-3 py-2 bg-slate-700 text-white border border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Start Date</label>
              <input
                type="date"
                value={customerSummaryInput.startDate}
                onChange={(e) => setCustomerSummaryInput(prev => ({ ...prev, startDate: e.target.value }))}
                className="w-full px-3 py-2 bg-slate-700 text-white border border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">End Date</label>
              <input
                type="date"
                value={customerSummaryInput.endDate}
                readOnly
                className="w-full px-3 py-2 bg-slate-700 text-white border border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-not-allowed opacity-90"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={handleGenerateCustomerSummary}
              disabled={summaryLoading}
              className="px-5 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {summaryLoading ? 'Generating...' : 'Generate Summary'}
            </button>
            {summaryResult && (
              <button
                type="button"
                onClick={() => setShowMatchingEmails(prev => !prev)}
                className="text-sm text-indigo-300 hover:text-indigo-200 underline-offset-2 hover:underline"
              >
                {(summaryResults.length > 0
                  ? summaryResults.reduce((total, item) => total + (item.email_count || 0), 0)
                  : summaryResult.email_count) || 0} matching emails
              </button>
            )}
          </div>

          {summaryError && (
            <div className="bg-red-900/30 border border-red-700 text-red-300 px-4 py-3 rounded-lg mb-4">
              {summaryError}
            </div>
          )}

          {(summaryResults.length > 0 ? summaryResults : summaryResult ? [summaryResult] : []).map((summary) => (
            <div key={`${summary.customer_name}-${summary.email_count}`} className="bg-slate-900/60 border border-slate-700 rounded-lg p-5 mb-5">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-indigo-300 mb-1">Account Overview</p>
                  <h3 className="text-xl font-semibold text-white">{summary.customer_name}</h3>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleCopySummaryFromResult(summary)}
                    className="px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-700 border border-slate-600 rounded-md hover:bg-slate-600 transition"
                  >
                    {summaryCopied ? 'Copied!' : 'Copy Summary'}
                  </button>
                </div>
              </div>

              <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-4 mb-5">
                <p className="text-slate-200 leading-relaxed">{summary.summary}</p>
              </div>

              {showMatchingEmails && summary.matchingEmails && summary.matchingEmails.length > 0 && (
                <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-4 mb-5">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Matching Emails</h4>
                    <span className="text-xs text-slate-400">{summary.matchingEmails.length} shown</span>
                  </div>
                  <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                    {summary.matchingEmails.map((email) => (
                      <div key={`${summary.customer_name}-${email.id}`} className="border border-slate-700 rounded-md p-3 bg-slate-900/40">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-medium text-white">{email.subject || 'No subject'}</p>
                            <p className="text-xs text-slate-400 mt-1">{email.from}</p>
                          </div>
                          {email.id && (
                            <a
                              href={`https://mail.google.com/mail/u/0/#inbox/${email.id}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-indigo-300 hover:text-indigo-200 underline"
                            >
                              Open in Gmail
                            </a>
                          )}
                        </div>
                        {email.date && <p className="text-xs text-slate-500 mt-2">{new Date(email.date).toLocaleString()}</p>}
                        {email.snippet && <p className="text-sm text-slate-300 mt-2 leading-relaxed">{email.snippet}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                  <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-400 mb-3">Themes</h4>
                  <ul className="list-disc list-inside text-slate-200 space-y-1">
                    {summary.themes.map((theme) => (
                      <li key={theme}>{theme}</li>
                    ))}
                  </ul>
                </div>

                <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                  <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-400 mb-3">Key Stakeholders</h4>
                  <ul className="list-disc list-inside text-slate-200 space-y-1">
                    {summary.stakeholders.map((stakeholder) => (
                      <li key={stakeholder}>{stakeholder}</li>
                    ))}
                  </ul>
                </div>

                <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                  <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-400 mb-3">Open Items</h4>
                  <ul className="list-disc list-inside text-slate-200 space-y-1">
                    {summary.open_items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>

                <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                  <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-400 mb-3">Recommended Next Steps</h4>
                  <ul className="list-disc list-inside text-slate-200 space-y-1">
                    {summary.recommended_next_steps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ))}
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-700 text-red-300 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {loading && (
          <div className="py-8">
            {progress ? (
              <>
                <div className="bg-slate-700/50 border border-slate-600 rounded-lg p-4 mb-4">
                  <p className="text-slate-300 text-center">
                    {fetchType === 'unread' ? (
                      <>
                        Processing <span className="font-bold text-blue-400">{progress.total} unread emails</span> from inbox
                      </>
                    ) : (
                      <>
                        Processing <span className="font-bold text-blue-400">{progress.total} emails</span>
                      </>
                    )}
                  </p>
                </div>
                <ProgressBar
                  current={progress.current}
                  total={progress.total}
                  message={`Analyzing with AI (batch processing: ${Math.ceil(progress.current / 10)} of ${Math.ceil(progress.total / 10)} batches)...`}
                />
              </>
            ) : (
              <div className="text-center py-4">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
                <p className="mt-4 text-slate-200 font-medium">
                  {fetchType === 'unread' ? 'Fetching unread emails from inbox...' : 'Fetching emails...'}
                </p>
              </div>
            )}
          </div>
        )}

        {!summaryOnly && !loading && customers.length > 0 && (
          <CustomerTaskBoard
            customers={customers}
            onRequestCustomerSummary={handleCustomerSummaryRequest}
          />
        )}
      </div>

      {/* Gong Call Processor Modal */}
      {showGongProcessor && (
        <GongCallProcessor onClose={() => setShowGongProcessor(false)} />
      )}
    </div>
  );
}
