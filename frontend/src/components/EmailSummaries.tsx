import { useState } from 'react';

interface Email {
  id: string;
  subject: string;
  date: string;
  snippet: string;
}

interface Summary {
  sender: string;
  senderName: string;
  emailCount: number;
  emails: Email[];
  summary: string;
}

interface EmailSummariesProps {
  summaries: Summary[];
}

export default function EmailSummaries({ summaries }: EmailSummariesProps) {
  const [expandedSender, setExpandedSender] = useState<string | null>(null);

  const toggleSender = (sender: string) => {
    setExpandedSender(expandedSender === sender ? null : sender);
  };

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-gray-900 mb-4">
        Email Summaries ({summaries.length} senders)
      </h2>

      {summaries.map((summary) => (
        <div
          key={summary.sender}
          className="bg-white rounded-lg shadow overflow-hidden border border-gray-200"
        >
          {/* Sender Header */}
          <button
            onClick={() => toggleSender(summary.sender)}
            className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                <span className="text-indigo-600 font-semibold text-lg">
                  {summary.senderName.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="text-left">
                <h3 className="font-semibold text-gray-900">{summary.senderName}</h3>
                <p className="text-sm text-gray-500">{summary.sender}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm font-medium">
                {summary.emailCount} {summary.emailCount === 1 ? 'email' : 'emails'}
              </span>
              <svg
                className={`w-5 h-5 text-gray-400 transition-transform ${
                  expandedSender === summary.sender ? 'rotate-180' : ''
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </div>
          </button>

          {/* Expanded Content */}
          {expandedSender === summary.sender && (
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
              <div className="mb-4">
                <h4 className="font-semibold text-gray-900 mb-2">AI Summary</h4>
                <div className="bg-white rounded-lg p-4 border border-gray-200">
                  <p className="text-gray-700 whitespace-pre-wrap">{summary.summary}</p>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Individual Emails</h4>
                <div className="space-y-2">
                  {summary.emails.map((email) => (
                    <div
                      key={email.id}
                      className="bg-white rounded-lg p-4 border border-gray-200"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <h5 className="font-medium text-gray-900">{email.subject}</h5>
                        <span className="text-sm text-gray-500 ml-4 whitespace-nowrap">
                          {new Date(email.date).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 line-clamp-2">{email.snippet}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
