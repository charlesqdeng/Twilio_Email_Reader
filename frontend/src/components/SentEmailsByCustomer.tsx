import { useState, useEffect } from 'react';
import axios from 'axios';
import DateRangePicker from './DateRangePicker';

interface SentEmailsByCustomerProps {
  onLogout: () => void;
  onShowSettings: () => void;
}

export default function SentEmailsByCustomer({ onLogout, onShowSettings }: SentEmailsByCustomerProps) {
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [analyzedEmails, setAnalyzedEmails] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [expandedCustomer, setExpandedCustomer] = useState<string | null>(null);
  const [expandedEmail, setExpandedEmail] = useState<string | null>(null);
  const [savedSolutions, setSavedSolutions] = useState<Set<string>>(new Set());
  const [savingSolution, setSavingSolution] = useState<string | null>(null);
  const [sheetUrl, setSheetUrl] = useState<string | null>(null);

  // Fetch sheet URL on component mount
  const fetchSheetUrl = async () => {
    try {
      const response = await axios.get('/api/tasks/approved');
      if (response.data.sheetUrl) {
        setSheetUrl(response.data.sheetUrl);
      }
    } catch (err) {
      console.error('Failed to fetch sheet URL:', err);
      // Silently fail - sheet URL will be set when user saves a solution
    }
  };

  // Fetch sheet URL when component mounts
  useEffect(() => {
    fetchSheetUrl();
  }, []);

  const handleFetchEmails = async (startDate?: string, endDate?: string, _unreadOnly?: boolean) => {
    // This component only supports date range filtering, not unread filtering
    if (!startDate || !endDate) {
      setError('Please select a date range');
      return;
    }
    try {
      setLoading(true);
      setError(null);

      // Fetch sent emails
      const emailsResponse = await axios.get('/api/emails/sent', {
        params: {
          startDate: startDate.split('T')[0].replace(/-/g, '/'),
          endDate: endDate.split('T')[0].replace(/-/g, '/')
        }
      });

      const emails = emailsResponse.data.emails;

      if (emails.length === 0) {
        setError('No sent emails found in the selected date range');
        setCustomers([]);
        setAnalyzedEmails([]);
        setLoading(false);
        return;
      }

      // Analyze emails with AI
      const analysisResponse = await axios.post('/api/emails/analyze', {
        emails
      });

      setCustomers(analysisResponse.data.customers || []);
      setAnalyzedEmails(analysisResponse.data.analyzedEmails || []);
    } catch (err: any) {
      console.error('Error:', err);
      setError(err.response?.data?.error || 'Failed to fetch sent emails. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenGoogleSheet = () => {
    if (sheetUrl) {
      window.open(sheetUrl, '_blank');
    }
  };

  const handleSaveSolution = async (email: any, customerName: string) => {
    if (!email.solution_provided || email.solution_provided.trim() === '') {
      setError('No solution or answer found in this email to save.');
      return;
    }

    setSavingSolution(email.emailId);
    try {
      const response = await axios.post('/api/tasks/save-solution', {
        emailId: email.emailId,
        sentDate: email.date,
        recipient: email.to,
        customerName: customerName,
        subject: email.subject,
        solutionProvided: email.solution_provided
      });

      // Store the sheet URL for the "View Google Sheet" button
      if (response.data.sheetUrl) {
        setSheetUrl(response.data.sheetUrl);
      }

      const newSaved = new Set(savedSolutions);
      newSaved.add(email.emailId);
      setSavedSolutions(newSaved);
      alert('✅ Solution saved to Google Sheets!');
    } catch (err: any) {
      console.error('Error saving solution:', err);
      setError('Failed to save solution. Please try again.');
    } finally {
      setSavingSolution(null);
    }
  };

  const toggleCustomer = (customerName: string) => {
    setExpandedCustomer(expandedCustomer === customerName ? null : customerName);
  };

  const toggleEmail = (emailId: string) => {
    setExpandedEmail(expandedEmail === emailId ? null : emailId);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'P0': return 'text-red-400 bg-red-900/30 border-red-700';
      case 'P1': return 'text-orange-400 bg-orange-900/30 border-orange-700';
      case 'P2': return 'text-blue-400 bg-blue-900/30 border-blue-700';
      case 'P3': return 'text-slate-400 bg-slate-800/50 border-slate-600';
      default: return 'text-slate-400 bg-slate-800/50 border-slate-600';
    }
  };

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <div className="bg-slate-800 shadow-lg border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-white">Sent Emails by Customer</h1>
            <div className="flex gap-3">
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

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-slate-800 rounded-lg shadow-xl border border-slate-700 p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-white">
              Select Date Range
            </h2>
            {sheetUrl && (
              <button
                onClick={handleOpenGoogleSheet}
                className="px-4 py-2 text-sm font-medium text-green-300 bg-green-900/50 border border-green-700 rounded-md hover:bg-green-900 flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                View Google Sheet
              </button>
            )}
          </div>
          <DateRangePicker onFetch={handleFetchEmails} loading={loading} />
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-700 text-red-300 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {loading && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
            <p className="mt-4 text-slate-200 font-medium">
              Analyzing sent emails with AI...
            </p>
            <p className="mt-2 text-sm text-slate-400">
              Classifying and organizing by recipient
            </p>
          </div>
        )}

        {!loading && customers.length > 0 && (
          <div className="space-y-4">
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-white mb-2">
                📤 Sent Emails: {analyzedEmails.length} emails to {customers.length} customers
              </h3>
            </div>

            {customers.map((customer) => (
              <div key={customer.customer_name} className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleCustomer(customer.customer_name)}
                  className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-750 transition"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded text-xs font-semibold border ${getPriorityColor(customer.highest_priority)}`}>
                        {customer.highest_priority}
                      </span>
                      <h3 className="text-lg font-semibold text-white">{customer.customer_name}</h3>
                    </div>
                    <span className="text-slate-400 text-sm">
                      {customer.email_count} email{customer.email_count !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <svg
                    className={`w-5 h-5 text-slate-400 transition-transform ${expandedCustomer === customer.customer_name ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {expandedCustomer === customer.customer_name && (
                  <div className="border-t border-slate-700 px-6 py-4 space-y-3">
                    {customer.emails.map((email: any) => (
                      <div key={email.emailId} className="bg-slate-900/50 rounded-lg border border-slate-600">
                        <button
                          onClick={() => toggleEmail(email.emailId)}
                          className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-800/50 transition"
                        >
                          <div className="flex-1 text-left">
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-0.5 rounded text-xs font-medium border ${getPriorityColor(email.priority)}`}>
                                {email.priority}
                              </span>
                              <p className="text-white font-medium">{email.subject}</p>
                            </div>
                            <p className="text-sm text-slate-400 mt-1">
                              To: {email.to} • {new Date(email.date).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <a
                              href={`https://mail.google.com/mail/u/0/#sent/${email.emailId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3 py-1 text-xs font-medium text-indigo-300 bg-indigo-900/50 border border-indigo-700 rounded hover:bg-indigo-900"
                              onClick={(e) => e.stopPropagation()}
                            >
                              View in Gmail
                            </a>
                            <svg
                              className={`w-4 h-4 text-slate-400 transition-transform ${expandedEmail === email.emailId ? 'rotate-180' : ''}`}
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </button>

                        {expandedEmail === email.emailId && (
                          <div className="border-t border-slate-600 px-4 py-3 space-y-3">
                            <div className="bg-slate-800/50 rounded p-3">
                              <p className="text-sm text-slate-300">{email.summary}</p>
                            </div>

                            {email.solution_provided && email.solution_provided.trim() !== '' && (
                              <div className="bg-green-900/20 border border-green-700 rounded p-4">
                                <div className="flex justify-between items-start mb-2">
                                  <h4 className="text-sm font-semibold text-green-300 flex items-center gap-2">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    Solution / Answer Provided
                                  </h4>
                                  {savedSolutions.has(email.emailId) ? (
                                    <span className="text-xs text-green-400 bg-green-900/50 px-2 py-1 rounded border border-green-700">
                                      ✓ Saved to Sheets
                                    </span>
                                  ) : (
                                    <button
                                      onClick={() => handleSaveSolution(email, customer.customer_name)}
                                      disabled={savingSolution === email.emailId}
                                      className="px-3 py-1 text-xs font-medium text-green-300 bg-green-900/50 border border-green-700 rounded hover:bg-green-900 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                      {savingSolution === email.emailId ? 'Saving...' : 'Save to Sheets'}
                                    </button>
                                  )}
                                </div>
                                <p className="text-sm text-green-100 mt-2">{email.solution_provided}</p>
                              </div>
                            )}

                            {email.tasks && email.tasks.length > 0 && (
                              <div className="space-y-2">
                                <h4 className="text-sm font-semibold text-slate-300">Tasks Mentioned:</h4>
                                {email.tasks.map((task: any, idx: number) => (
                                  <div key={idx} className="bg-slate-800/50 rounded p-3 border border-slate-600">
                                    <p className="text-white font-medium">{task.title}</p>
                                    <div className="mt-2 flex gap-3 text-xs text-slate-400">
                                      <span>Deadline: {task.deadline}</span>
                                      <span>•</span>
                                      <span>Urgency: {task.urgency}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}

                            {email.stakeholders && email.stakeholders.length > 0 && (
                              <div>
                                <h4 className="text-sm font-semibold text-slate-300 mb-2">Stakeholders:</h4>
                                <div className="flex flex-wrap gap-2">
                                  {email.stakeholders.map((person: string, idx: number) => (
                                    <span key={idx} className="px-2 py-1 bg-slate-700 text-slate-300 rounded text-xs">
                                      {person}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
