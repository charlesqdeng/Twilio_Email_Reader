import { useState, useEffect } from 'react';
import axios from 'axios';

interface GongCall {
  emailId: string;
  subject: string;
  date: string;
  callTitle: string;
  customerName: string;
  gongUrl: string;
  nextSteps: Array<{ text: string; deadline?: string }>;
  body: string;
}

interface GongCallProcessorProps {
  onClose: () => void;
}

interface AccountOwner {
  name: string;
  email: string;
}

export default function GongCallProcessor({ onClose }: GongCallProcessorProps) {
  const [loading, setLoading] = useState(false);
  const [calls, setCalls] = useState<GongCall[]>([]);
  const [selectedOwner, setSelectedOwner] = useState<string>('');
  const [selectedCalls, setSelectedCalls] = useState<Set<string>>(new Set());
  const [processing, setProcessing] = useState(false);
  const [sheetUrl, setSheetUrl] = useState<string>('');
  const [accountOwners, setAccountOwners] = useState<AccountOwner[]>([]);

  // Fetch account owners from user profile
  useEffect(() => {
    const fetchAccountOwners = async () => {
      try {
        const response = await axios.get('/api/user/profile', { withCredentials: true });
        if (response.data.hasProfile && response.data.profile.account_owners) {
          setAccountOwners(response.data.profile.account_owners);
        }
      } catch (error) {
        console.error('Failed to fetch account owners:', error);
        // Fallback to empty array if profile doesn't have account owners
        setAccountOwners([]);
      }
    };

    fetchAccountOwners();
  }, []);

  const fetchGongCalls = async (silent = false) => {
    try {
      setLoading(true);
      const response = await axios.get('/api/gong/calls');
      const loadedCalls = response.data.calls || [];
      setCalls(loadedCalls);
      console.log(`📞 Loaded ${loadedCalls.length} Gong calls with next steps`);

      // Only show alert on initial fetch, not after processing
      if (loadedCalls.length === 0 && !silent) {
        alert('No Gong calls found with "Next steps" section. Check backend logs for details.');
      }
    } catch (error) {
      console.error('Failed to fetch Gong calls:', error);
      alert('Failed to fetch Gong calls. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const toggleCallSelection = (emailId: string) => {
    const newSelected = new Set(selectedCalls);
    if (newSelected.has(emailId)) {
      newSelected.delete(emailId);
    } else {
      newSelected.add(emailId);
    }
    setSelectedCalls(newSelected);
  };

  const handleProcessCalls = async () => {
    if (!selectedOwner) {
      alert('Please select an account owner');
      return;
    }

    if (selectedCalls.size === 0) {
      alert('Please select at least one call to process');
      return;
    }

    try {
      setProcessing(true);
      let lastSheetUrl = '';

      // Process each selected call
      for (const emailId of selectedCalls) {
        const call = calls.find(c => c.emailId === emailId);
        if (!call) continue;

        // Create tasks for each next step
        for (const nextStep of call.nextSteps) {
          const taskData = {
            taskId: `${call.customerName}-${nextStep.text.substring(0, 50)}`,
            taskTitle: nextStep.text,
            customerName: call.customerName,
            customerEmail: '', // We don't have customer email from Gong
            emailFrom: 'Gong <do-not-reply@gong.io>',
            emailTo: selectedOwner, // Use selected account owner
            emailCc: '',
            emailSubject: `Gong: ${call.callTitle}`,
            priority: 'P1',
            urgency: 'High',
            deadline: nextStep.deadline || 'None'
          };

          // Approve the task
          const response = await axios.post('/api/tasks/approve', taskData);
          if (response.data.sheetUrl) {
            lastSheetUrl = response.data.sheetUrl;
          }
          console.log(`✅ Created task: ${nextStep.text.substring(0, 50)}...`);
        }

        // Mark email as read
        await axios.post('/api/emails/mark-read', { emailId });
      }

      setSheetUrl(lastSheetUrl);
      alert(`✅ Successfully processed ${selectedCalls.size} Gong call(s) and created tasks!`);
      setSelectedCalls(new Set());
      await fetchGongCalls(true); // Refresh the list silently
    } catch (error) {
      console.error('Failed to process calls:', error);
      alert('Failed to process calls. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <div>
            <h2 className="text-2xl font-bold text-white">Process Gong Calls</h2>
            <p className="text-slate-400 text-sm mt-1">All tasks from unread call recordings</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Fetch Button */}
          {calls.length === 0 && !loading && (
            <div className="text-center py-12">
              <button
                onClick={() => fetchGongCalls()}
                className="px-6 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition"
              >
                Fetch Gong Calls
              </button>
              <p className="text-slate-400 text-sm mt-4">
                Fetches unread Gong call recordings with next steps
              </p>
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
              <p className="mt-4 text-slate-200 font-medium">Loading Gong calls...</p>
            </div>
          )}

          {/* Calls List */}
          {calls.length > 0 && (
            <div className="space-y-6">
              {/* Account Owner Selection */}
              <div className="bg-slate-700 rounded-lg p-4">
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Select Account Owner
                </label>
                <select
                  value={selectedOwner}
                  onChange={(e) => setSelectedOwner(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-600 text-white rounded-lg border border-slate-500 focus:outline-none focus:border-indigo-500"
                >
                  <option value="">Choose account owner...</option>
                  {accountOwners.length === 0 ? (
                    <option disabled>No account owners configured</option>
                  ) : (
                    accountOwners.map((owner: AccountOwner) => (
                      <option key={owner.email} value={owner.email}>
                        {owner.name}
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Calls */}
              {calls.map((call) => (
                <div
                  key={call.emailId}
                  className={`bg-slate-700 rounded-lg p-4 border-2 transition ${
                    selectedCalls.has(call.emailId)
                      ? 'border-indigo-500'
                      : 'border-transparent'
                  }`}
                >
                  {/* Call Header */}
                  <div className="flex items-start gap-3 mb-3">
                    <input
                      type="checkbox"
                      checked={selectedCalls.has(call.emailId)}
                      onChange={() => toggleCallSelection(call.emailId)}
                      className="mt-1 w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
                    />
                    <div className="flex-1">
                      <h3 className="text-white font-semibold text-lg">{call.callTitle}</h3>
                      <div className="flex items-center gap-4 mt-1">
                        <span className="text-slate-400 text-sm">{call.customerName}</span>
                        <span className="text-slate-500 text-sm">
                          {new Date(call.date).toLocaleDateString()}
                        </span>
                        {call.gongUrl && (
                          <a
                            href={call.gongUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-indigo-400 hover:text-indigo-300 text-sm inline-flex items-center gap-1"
                          >
                            View Recording
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </a>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Next Steps */}
                  <div className="ml-8 space-y-2">
                    <p className="text-slate-300 font-medium text-sm mb-2">
                      Next Steps ({call.nextSteps.length}):
                    </p>
                    {call.nextSteps.map((step, idx) => (
                      <div key={idx} className="bg-slate-800 rounded p-3">
                        <p className="text-slate-200 text-sm">{step.text}</p>
                        {step.deadline && (
                          <span className="inline-block mt-2 px-2 py-1 bg-orange-900/30 text-orange-400 text-xs rounded">
                            Deadline: {step.deadline}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {calls.length > 0 && (
          <div className="flex items-center justify-between p-6 border-t border-slate-700 bg-slate-800">
            <div className="text-slate-400 text-sm">
              {selectedCalls.size} call{selectedCalls.size !== 1 ? 's' : ''} selected
              {selectedOwner && (
                <span className="ml-2">
                  → {accountOwners.find((o: AccountOwner) => o.email === selectedOwner)?.name}
                </span>
              )}
            </div>
            <div className="flex gap-3">
              {sheetUrl && (
                <a
                  href={sheetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition inline-flex items-center gap-2"
                >
                  Open Updated Sheet
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              )}
              <button
                onClick={() => fetchGongCalls(true)}
                disabled={loading}
                className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-500 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                Refresh
              </button>
              <button
                onClick={handleProcessCalls}
                disabled={processing || selectedCalls.size === 0 || !selectedOwner}
                className="px-6 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {processing ? 'Processing...' : `Process ${selectedCalls.size} Call${selectedCalls.size !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
