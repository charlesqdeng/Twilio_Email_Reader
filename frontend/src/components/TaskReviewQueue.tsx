import { useState } from 'react';

interface Task {
  title: string;
  deadline: string;
  urgency: 'High' | 'Medium' | 'Low';
}

interface AnalyzedEmail {
  emailId: string;
  subject: string;
  from: string;
  date: string;
  snippet: string;
  category: 'Customer Support' | 'Internal Update' | 'Event/Newsletter' | 'Trash';
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  actionable: boolean;
  summary: string;
  tasks: Task[];
  stakeholders: string[];
  sentiment: 'Urgent' | 'Normal' | 'Casual';
  keywords: string[];
}

interface TaskReviewQueueProps {
  analyzedEmails: AnalyzedEmail[];
}

const categoryColors = {
  'Customer Support': 'bg-red-900/40 text-red-300 border-red-700',
  'Internal Update': 'bg-blue-900/40 text-blue-300 border-blue-700',
  'Event/Newsletter': 'bg-purple-900/40 text-purple-300 border-purple-700',
  'Trash': 'bg-slate-700/40 text-slate-300 border-slate-600'
};

const priorityColors = {
  'P0': 'bg-red-600 text-white',
  'P1': 'bg-orange-500 text-white',
  'P2': 'bg-yellow-500 text-gray-900',
  'P3': 'bg-green-500 text-white'
};

const urgencyColors = {
  'High': 'text-red-400 font-semibold',
  'Medium': 'text-yellow-400 font-medium',
  'Low': 'text-green-400'
};

export default function TaskReviewQueue({ analyzedEmails }: TaskReviewQueueProps) {
  const [expandedEmail, setExpandedEmail] = useState<string | null>(null);
  const [approvedTasks, setApprovedTasks] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<string>('all');

  const toggleEmail = (emailId: string) => {
    setExpandedEmail(expandedEmail === emailId ? null : emailId);
  };

  const handleApproveTask = (emailId: string, taskTitle: string) => {
    const taskId = `${emailId}-${taskTitle}`;
    const newApproved = new Set(approvedTasks);
    if (newApproved.has(taskId)) {
      newApproved.delete(taskId);
    } else {
      newApproved.add(taskId);
    }
    setApprovedTasks(newApproved);
  };

  const isTaskApproved = (emailId: string, taskTitle: string) => {
    return approvedTasks.has(`${emailId}-${taskTitle}`);
  };

  const filteredEmails = analyzedEmails.filter(email => {
    if (filter === 'all') return true;
    if (filter === 'actionable') return email.actionable;
    if (filter === 'p0-p1') return ['P0', 'P1'].includes(email.priority);
    return email.category === filter;
  });

  const actionableCount = analyzedEmails.filter(e => e.actionable).length;
  const totalTasks = analyzedEmails.reduce((acc, e) => acc + e.tasks.length, 0);

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="bg-slate-800 rounded-lg shadow-xl border border-slate-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-white">Task Review Queue</h2>
          <div className="flex gap-3 text-sm">
            <div className="px-3 py-1 bg-indigo-900/50 text-indigo-300 border border-indigo-700 rounded-full font-medium">
              {analyzedEmails.length} Emails
            </div>
            <div className="px-3 py-1 bg-green-900/50 text-green-300 border border-green-700 rounded-full font-medium">
              {actionableCount} Actionable
            </div>
            <div className="px-3 py-1 bg-blue-900/50 text-blue-300 border border-blue-700 rounded-full font-medium">
              {totalTasks} Tasks
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              filter === 'all'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter('actionable')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              filter === 'actionable'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            Actionable Only
          </button>
          <button
            onClick={() => setFilter('p0-p1')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              filter === 'p0-p1'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            High Priority (P0-P1)
          </button>
          <button
            onClick={() => setFilter('Customer Support')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              filter === 'Customer Support'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            Customer Support
          </button>
        </div>
      </div>

      {/* Email Cards */}
      <div className="space-y-4">
        {filteredEmails.length === 0 ? (
          <div className="bg-slate-800 rounded-lg shadow-xl border border-slate-700 p-12 text-center text-slate-400">
            No emails match the selected filter
          </div>
        ) : (
          filteredEmails.map((email) => (
            <div
              key={email.emailId}
              className="bg-slate-800 rounded-lg shadow-xl border-2 border-slate-700 overflow-hidden hover:border-indigo-500 transition"
            >
              {/* Email Header */}
              <button
                onClick={() => toggleEmail(email.emailId)}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-700/50 transition"
              >
                <div className="flex items-center gap-4 flex-1">
                  {/* Priority Badge */}
                  <div className={`px-3 py-1 rounded-full text-sm font-bold ${priorityColors[email.priority]}`}>
                    {email.priority}
                  </div>

                  {/* Email Info */}
                  <div className="flex-1 text-left">
                    <h3 className="font-semibold text-white">{email.subject}</h3>
                    <p className="text-sm text-slate-400">{email.from}</p>
                  </div>

                  {/* Category Badge */}
                  <div className={`px-3 py-1 rounded-lg text-sm font-medium border ${categoryColors[email.category]}`}>
                    {email.category}
                  </div>

                  {/* Task Count */}
                  {email.tasks.length > 0 && (
                    <div className="px-3 py-1 bg-blue-900/50 text-blue-300 border border-blue-700 rounded-full text-sm font-medium">
                      {email.tasks.length} {email.tasks.length === 1 ? 'Task' : 'Tasks'}
                    </div>
                  )}

                  {/* Expand Icon */}
                  <svg
                    className={`w-5 h-5 text-slate-400 transition-transform ${
                      expandedEmail === email.emailId ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>

              {/* Expanded Content */}
              {expandedEmail === email.emailId && (
                <div className="px-6 py-4 bg-slate-900/50 border-t border-slate-700">
                  {/* Summary */}
                  <div className="mb-4">
                    <h4 className="font-semibold text-white mb-2">AI Summary</h4>
                    <p className="text-slate-300">{email.summary}</p>
                  </div>

                  {/* Tasks */}
                  {email.tasks.length > 0 && (
                    <div className="mb-4">
                      <h4 className="font-semibold text-white mb-3">Extracted Tasks</h4>
                      <div className="space-y-3">
                        {email.tasks.map((task, idx) => (
                          <div
                            key={idx}
                            className="bg-slate-700/50 rounded-lg p-4 border border-slate-600"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className={`text-sm ${urgencyColors[task.urgency]}`}>
                                    {task.urgency} Priority
                                  </span>
                                  {task.deadline !== 'None' && (
                                    <span className="text-sm text-slate-400">
                                      • Due: {new Date(task.deadline).toLocaleDateString()}
                                    </span>
                                  )}
                                </div>
                                <p className="text-white">{task.title}</p>
                              </div>
                              <button
                                onClick={() => handleApproveTask(email.emailId, task.title)}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                                  isTaskApproved(email.emailId, task.title)
                                    ? 'bg-green-600 text-white'
                                    : 'bg-indigo-600 text-white hover:bg-indigo-700'
                                }`}
                              >
                                {isTaskApproved(email.emailId, task.title) ? '✓ Approved' : 'Approve'}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Stakeholders */}
                  {email.stakeholders.length > 0 && (
                    <div className="mb-4">
                      <h4 className="font-semibold text-white mb-2">Key Stakeholders</h4>
                      <div className="flex flex-wrap gap-2">
                        {email.stakeholders.map((stakeholder, idx) => (
                          <span
                            key={idx}
                            className="px-3 py-1 bg-indigo-900/50 text-indigo-300 border border-indigo-700 rounded-full text-sm"
                          >
                            {stakeholder}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Keywords */}
                  {email.keywords.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-white mb-2">Keywords</h4>
                      <div className="flex flex-wrap gap-2">
                        {email.keywords.map((keyword, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-1 bg-slate-700 text-slate-300 rounded text-sm"
                          >
                            {keyword}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Original Email Snippet */}
                  <div className="mt-4 pt-4 border-t border-slate-700">
                    <h4 className="font-semibold text-white mb-2 text-sm">Original Email</h4>
                    <p className="text-sm text-slate-400">{email.snippet}</p>
                    <p className="text-xs text-slate-500 mt-2">
                      {new Date(email.date).toLocaleString()}
                    </p>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
