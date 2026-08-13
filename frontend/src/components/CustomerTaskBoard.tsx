import { useState, useEffect } from 'react';
import axios from 'axios';

interface Task {
  title: string;
  deadline: string;
  urgency: 'High' | 'Medium' | 'Low';
  emailId?: string;           // Email ID for linking
  emailSubject?: string;      // Email subject for context
  emailFrom?: string;         // Email sender
  emailTo?: string;           // Email recipients (To field)
  emailCc?: string;           // Email recipients (CC field)
  emailPriority?: string;     // Email priority
  emailDate?: string;         // Email timestamp for sorting
}

interface Email {
  emailId: string;
  subject: string;
  from: string;
  to: string;
  cc: string;
  date: string;
  snippet: string;
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  category: string;
  actionable: boolean;
  summary: string;
  tasks: Task[];
  stakeholders: string[];
  sentiment: string;
  keywords: string[];
}

interface Customer {
  customer_name: string;
  is_external: boolean;
  email_count: number;
  highest_priority: 'P0' | 'P1' | 'P2' | 'P3';
  emails: Email[];
  all_tasks: Task[];
}

interface CustomerTaskBoardProps {
  customers: Customer[];
  onRequestCustomerSummary?: (request: { customerName: string; domain?: string }) => void;
}

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

export default function CustomerTaskBoard({ customers, onRequestCustomerSummary }: CustomerTaskBoardProps) {
  const [expandedCustomer, setExpandedCustomer] = useState<string | null>(null);
  const [expandedEmail, setExpandedEmail] = useState<string | null>(null);
  const [approvedTasks, setApprovedTasks] = useState<Set<string>>(new Set());
  const [dismissedTasks, setDismissedTasks] = useState<Set<string>>(new Set());
  const [sheetUrl, setSheetUrl] = useState<string>('');
  const [filter, setFilter] = useState<string>('all');
  const [showAllTasksView, setShowAllTasksView] = useState(false);
  const [showDismissed, setShowDismissed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [markedAsRead, setMarkedAsRead] = useState<Set<string>>(new Set());
  const [markingAsRead, setMarkingAsRead] = useState<Set<string>>(new Set());

  // Helper to check if customer is internal tools group
  const isInternalTools = (customerName: string) =>
    customerName === '🔧 Internal Tools & Notifications';

  // Sort customers: real customers first (by priority), then internal tools at end
  const sortedCustomers = [...customers].sort((a, b) => {
    const aIsInternal = isInternalTools(a.customer_name);
    const bIsInternal = isInternalTools(b.customer_name);

    if (aIsInternal && !bIsInternal) return 1;  // Internal tools go last
    if (!aIsInternal && bIsInternal) return -1; // Real customers go first

    // For customers of same type, sort by priority
    const priorityOrder: Record<string, number> = { 'P0': 0, 'P1': 1, 'P2': 2, 'P3': 3 };
    return priorityOrder[a.highest_priority] - priorityOrder[b.highest_priority];
  });

  // Load approved tasks, dismissed tasks, and marked as read emails on component mount
  useEffect(() => {
    loadApprovedTasks();
    loadDismissedTasks();
    loadMarkedAsRead();
  }, []);

  // Load dismissed tasks from localStorage
  const loadDismissedTasks = () => {
    try {
      const stored = localStorage.getItem('dismissedTasks');
      if (stored) {
        const taskIds = JSON.parse(stored);
        setDismissedTasks(new Set(taskIds));
      }
    } catch (error) {
      console.error('Failed to load dismissed tasks:', error);
    }
  };

  // Save dismissed tasks to localStorage
  const saveDismissedTasks = (tasks: Set<string>) => {
    try {
      localStorage.setItem('dismissedTasks', JSON.stringify(Array.from(tasks)));
    } catch (error) {
      console.error('Failed to save dismissed tasks:', error);
    }
  };

  // Load marked as read emails from localStorage
  const loadMarkedAsRead = () => {
    try {
      const stored = localStorage.getItem('markedAsReadEmails');
      if (stored) {
        const emailIds = JSON.parse(stored);
        setMarkedAsRead(new Set(emailIds));
      }
    } catch (error) {
      console.error('Failed to load marked as read emails:', error);
    }
  };

  // Save marked as read emails to localStorage
  const saveMarkedAsRead = (emails: Set<string>) => {
    try {
      localStorage.setItem('markedAsReadEmails', JSON.stringify(Array.from(emails)));
    } catch (error) {
      console.error('Failed to save marked as read emails:', error);
    }
  };

  const loadApprovedTasks = async () => {
    try {
      const response = await axios.get('/api/tasks/approved');
      const approved = response.data.approvedTasks || [];
      const url = response.data.sheetUrl || '';

      // Convert to Set of task IDs (customerName-taskTitle)
      const taskIds = new Set<string>(
        approved.map((task: any) => `${task.customerName}-${task.taskTitle}`)
      );
      setApprovedTasks(taskIds);
      setSheetUrl(url);
    } catch (error) {
      console.error('Failed to load approved tasks:', error);
    }
  };

  const toggleCustomer = (customerName: string) => {
    setExpandedCustomer(expandedCustomer === customerName ? null : customerName);
  };

  const toggleEmail = (emailId: string) => {
    setExpandedEmail(expandedEmail === emailId ? null : emailId);
  };

  // Helper function to extract email address from "Name <email>" format
  const extractEmailAddress = (emailString: string): string => {
    if (!emailString) return 'unknown';
    const match = emailString.match(/<(.+?)>/);
    return match ? match[1].toLowerCase() : emailString.toLowerCase().trim();
  };

  const handleApproveTask = async (customerName: string, taskTitle: string, taskDetails?: any) => {
    const taskId = `${customerName}-${taskTitle}`;
    const isCurrentlyApproved = approvedTasks.has(taskId);

    setLoading(true);

    try {
      if (isCurrentlyApproved) {
        // Unapprove - remove from Google Sheets
        await axios.post('/api/tasks/unapprove', { taskId });

        const newApproved = new Set(approvedTasks);
        newApproved.delete(taskId);
        setApprovedTasks(newApproved);
      } else {
        // Approve - save to Google Sheets
        // Extract email address from "Name <email>" format
        const customerEmail = extractEmailAddress(taskDetails?.emailFrom || 'unknown');

        // Log what we're sending for debugging
        console.log('🔍 Approving task with email participants:');
        console.log('  From:', taskDetails?.emailFrom);
        console.log('  To:', taskDetails?.emailTo);
        console.log('  CC:', taskDetails?.emailCc);
        console.log('  Subject:', taskDetails?.emailSubject);

        const response = await axios.post('/api/tasks/approve', {
          taskId,
          taskTitle,
          customerName,
          customerEmail,
          emailFrom: taskDetails?.emailFrom || '',
          emailTo: taskDetails?.emailTo || '',
          emailCc: taskDetails?.emailCc || '',
          emailSubject: taskDetails?.emailSubject || '',
          priority: taskDetails?.priority || 'P2',
          urgency: taskDetails?.urgency || 'Medium',
          deadline: taskDetails?.deadline || 'None'
        });

        const newApproved = new Set(approvedTasks);
        newApproved.add(taskId);
        setApprovedTasks(newApproved);

        // Update sheet URL if returned
        if (response.data.sheetUrl) {
          setSheetUrl(response.data.sheetUrl);
        }
      }
    } catch (error) {
      console.error('Failed to update task approval:', error);
      alert('Failed to save task approval. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const isTaskApproved = (customerId: string, taskTitle: string) => {
    return approvedTasks.has(`${customerId}-${taskTitle}`);
  };

  const isTaskDismissed = (customerId: string, taskTitle: string) => {
    return dismissedTasks.has(`${customerId}-${taskTitle}`);
  };

  const extractDomainFromEmail = (value?: string) => {
    if (!value) return '';
    const match = value.match(/<([^>]+)>|([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    const email = (match?.[1] || match?.[2] || value).toLowerCase().trim();
    const parts = email.split('@');
    return parts.length === 2 ? parts[1].replace(/\/$/, '') : '';
  };

  const inferCustomerDomain = (customer: Customer) => {
    const domains = customer.emails
      .flatMap(email => [email.from, email.to, email.cc])
      .map(extractDomainFromEmail)
      .filter(Boolean)
      .filter(domain => !domain.includes('gmail.com') && !domain.includes('googlemail.com'));

    return domains[0] || '';
  };

  // Check if all emails from a customer are marked as read
  const areAllEmailsMarkedAsRead = (customer: Customer) => {
    if (customer.emails.length === 0) return false;
    return customer.emails.every(email => markedAsRead.has(email.emailId));
  };

  const handleDismissTask = (customerName: string, taskTitle: string) => {
    const taskId = `${customerName}-${taskTitle}`;
    const newDismissed = new Set(dismissedTasks);

    if (dismissedTasks.has(taskId)) {
      // Undismiss
      newDismissed.delete(taskId);
    } else {
      // Dismiss
      newDismissed.add(taskId);
    }

    setDismissedTasks(newDismissed);
    saveDismissedTasks(newDismissed);
  };

  const handleMarkAsRead = async (emailId: string) => {
    if (markedAsRead.has(emailId) || markingAsRead.has(emailId)) {
      return; // Already marked or in progress
    }

    try {
      // Add to marking in progress
      setMarkingAsRead(prev => new Set(prev).add(emailId));

      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const response = await axios.post(
        `${API_URL}/api/emails/mark-read`,
        { emailId },
        { withCredentials: true }
      );

      if (response.data.success) {
        // Add to marked as read set and save to localStorage
        const newMarkedAsRead = new Set(markedAsRead).add(emailId);
        setMarkedAsRead(newMarkedAsRead);
        saveMarkedAsRead(newMarkedAsRead);
        console.log('✅ Email marked as read:', emailId);
      }
    } catch (error: any) {
      console.error('❌ Error marking email as read:', error);
      const errorMessage = error.response?.data?.details || error.response?.data?.error || error.message || 'Unknown error';
      alert(`Failed to mark email as read: ${errorMessage}\n\nPlease try again or refresh the page.`);
    } finally {
      // Remove from marking in progress
      setMarkingAsRead(prev => {
        const newSet = new Set(prev);
        newSet.delete(emailId);
        return newSet;
      });
    }
  };

  const filteredCustomers = sortedCustomers.filter(customer => {
    // First apply priority/external filters
    let passesFilter = false;
    if (filter === 'all') passesFilter = true;
    else if (filter === 'external') passesFilter = customer.is_external;
    else if (filter === 'p0-p1') passesFilter = ['P0', 'P1'].includes(customer.highest_priority);
    else if (filter === 'p0') passesFilter = customer.highest_priority === 'P0';
    else if (filter === 'p1') passesFilter = customer.highest_priority === 'P1';
    else if (filter === 'p2') passesFilter = customer.highest_priority === 'P2';
    else if (filter === 'p3') passesFilter = customer.highest_priority === 'P3';

    if (!passesFilter) return false;

    // Don't hide customers with dismissed tasks - we still want to show their emails
    return true;
  });

  const totalEmails = customers.reduce((acc, c) => acc + c.email_count, 0);
  const totalTasks = customers.reduce((acc, c) => acc + c.all_tasks.length, 0);

  // Calculate priority breakdown
  const priorityBreakdown = {
    P0: customers.filter(c => c.highest_priority === 'P0').length,
    P1: customers.filter(c => c.highest_priority === 'P1').length,
    P2: customers.filter(c => c.highest_priority === 'P2').length,
    P3: customers.filter(c => c.highest_priority === 'P3').length
  };

  const actionableCustomers = customers.filter(c => ['P0', 'P1'].includes(c.highest_priority)).length;

  // Aggregate all tasks with customer context
  const allTasksWithContext = customers
    .flatMap(customer =>
      customer.all_tasks.map(task => ({
        ...task,
        customerName: customer.customer_name,
        priority: customer.highest_priority,
        isExternal: customer.is_external
      }))
    )
    .filter(task => showDismissed || !isTaskDismissed(task.customerName, task.title))
    .sort((a, b) => {
      // Sort by email date - newest first
      if (a.emailDate && b.emailDate) {
        return new Date(b.emailDate).getTime() - new Date(a.emailDate).getTime();
      }
      // If one doesn't have a date, prioritize the one that does
      if (a.emailDate) return -1;
      if (b.emailDate) return 1;
      return 0;
    });

  // If showing all tasks view, render that instead
  if (showAllTasksView) {
    return (
      <div className="space-y-6">
        {/* All Tasks Header */}
        <div className="bg-slate-800 rounded-lg shadow-xl border border-slate-700 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">All Tasks</h2>
              <p className="text-slate-400 text-sm">
                {allTasksWithContext.length} tasks across {customers.length} customers
                {showDismissed && dismissedTasks.size > 0 && (
                  <span className="text-yellow-400 ml-2">
                    (including {dismissedTasks.size} dismissed)
                  </span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowDismissed(!showDismissed)}
                className={`px-4 py-2 rounded-lg transition flex items-center gap-2 ${
                  showDismissed
                    ? 'bg-yellow-900/30 text-yellow-300 border border-yellow-700 hover:bg-yellow-900/50'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {showDismissed ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  )}
                </svg>
                {showDismissed ? 'Hide Dismissed' : 'Show Dismissed'}
              </button>
              <button
                onClick={() => setShowAllTasksView(false)}
                className="px-4 py-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to Customer Board
              </button>
            </div>
          </div>

          {/* Task List */}
          <div className="space-y-3">
            {allTasksWithContext.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                No tasks found
              </div>
            ) : (
              allTasksWithContext.map((task, idx) => (
                <div
                  key={`${task.customerName}-${idx}`}
                  className="bg-slate-700/50 rounded-lg p-4 border border-slate-600 hover:border-slate-500 transition"
                >
                  <div className="flex flex-col gap-3">
                    {/* Main Task Info */}
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        {/* Priority, Customer, and Timestamp */}
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`px-2 py-1 rounded text-xs font-bold ${priorityColors[task.priority]}`}>
                            {task.priority}
                          </span>
                          <span className="text-slate-400 text-sm">•</span>
                          <span className="text-slate-300 text-sm font-medium">{task.customerName}</span>
                          {task.isExternal && (
                            <span className="px-2 py-0.5 bg-blue-900/50 text-blue-300 border border-blue-700 rounded text-xs">
                              External
                            </span>
                          )}
                          {task.emailDate && (
                            <>
                              <span className="text-slate-500 text-sm">•</span>
                              <span className="text-slate-400 text-xs">
                                {new Date(task.emailDate).toLocaleString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: 'numeric',
                                  minute: '2-digit',
                                  hour12: true
                                })}
                              </span>
                            </>
                          )}
                        </div>

                        {/* Task Details */}
                        <p className="text-white font-medium mb-1">{task.title}</p>
                        <div className="flex items-center gap-3 text-sm">
                          <span className={urgencyColors[task.urgency]}>
                            {task.urgency} Priority
                          </span>
                          {task.deadline !== 'None' && (
                            <>
                              <span className="text-slate-500">•</span>
                              <span className="text-slate-400">
                                Due: {new Date(task.deadline).toLocaleDateString()}
                              </span>
                            </>
                          )}
                        </div>
                        {task.emailSubject && (
                          <p className="text-slate-400 text-xs mt-1">
                            From email: {task.emailSubject}
                          </p>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-2">
                        {/* Approve Button or Sheet Link */}
                        {isTaskApproved(task.customerName, task.title) && sheetUrl ? (
                          <a
                            href={sheetUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-4 py-2 rounded-lg text-sm font-medium bg-green-600 text-white hover:bg-green-700 transition inline-flex items-center gap-2"
                          >
                            <span>✓ Approved</span>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </a>
                        ) : (
                          <button
                            onClick={() => handleApproveTask(task.customerName, task.title, task)}
                            disabled={loading}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                              isTaskApproved(task.customerName, task.title)
                                ? 'bg-green-600 text-white'
                                : 'bg-indigo-600 text-white hover:bg-indigo-700'
                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                          >
                            {isTaskApproved(task.customerName, task.title) ? '✓ Approved' : 'Approve'}
                          </button>
                        )}

                        {/* Dismiss Button */}
                        <button
                          onClick={() => handleDismissTask(task.customerName, task.title)}
                          className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-900/20 transition"
                          title="Dismiss task"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* Email Action Buttons */}
                    {task.emailId && (
                      <div className="flex items-center gap-2 pt-2 border-t border-slate-600">
                        <a
                          href={`https://mail.google.com/mail/u/0/#inbox/${task.emailId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded hover:bg-indigo-700 transition flex items-center gap-1.5"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                          View in Gmail
                        </a>

                        <button
                          onClick={() => handleMarkAsRead(task.emailId!)}
                          disabled={markedAsRead.has(task.emailId!) || markingAsRead.has(task.emailId!)}
                          className={`px-3 py-1.5 text-xs font-medium rounded transition flex items-center gap-1.5 ${
                            markedAsRead.has(task.emailId!)
                              ? 'bg-green-600 text-white cursor-not-allowed'
                              : markingAsRead.has(task.emailId!)
                              ? 'bg-slate-600 text-slate-300 cursor-wait'
                              : 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                          }`}
                        >
                          {markingAsRead.has(task.emailId!) ? (
                            <>
                              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Marking...
                            </>
                          ) : markedAsRead.has(task.emailId!) ? (
                            <>
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              Marked as Read
                            </>
                          ) : (
                            <>
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 19v-8.93a2 2 0 01.89-1.664l7-4.666a2 2 0 012.22 0l7 4.666A2 2 0 0121 10.07V19M3 19a2 2 0 002 2h14a2 2 0 002-2M3 19l6.75-4.5M21 19l-6.75-4.5M3 10l6.75 4.5M21 10l-6.75 4.5m0 0l-1.14.76a2 2 0 01-2.22 0l-1.14-.76" />
                              </svg>
                              Mark as Read
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="bg-slate-800 rounded-lg shadow-xl border border-slate-700 p-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-white mb-2">Customer Task Board</h2>
          <p className="text-slate-400 text-sm">
            Click on priority badges below to filter customers by urgency
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {/* Total Customers */}
          <div className="bg-slate-700/50 rounded-lg p-4 border border-slate-600">
            <div className="text-slate-400 text-xs font-medium mb-1">TOTAL CUSTOMERS</div>
            <div className="text-2xl font-bold text-white">{customers.length}</div>
          </div>

          {/* Actionable (P0-P1) */}
          <div className="bg-red-900/30 rounded-lg p-4 border border-red-700">
            <div className="text-red-300 text-xs font-medium mb-1">NEEDS ATTENTION</div>
            <div className="text-2xl font-bold text-red-300">{actionableCustomers}</div>
            <div className="text-xs text-red-400 mt-1">P0-P1 priority</div>
          </div>

          {/* Total Emails */}
          <div className="bg-blue-900/30 rounded-lg p-4 border border-blue-700">
            <div className="text-blue-300 text-xs font-medium mb-1">TOTAL EMAILS</div>
            <div className="text-2xl font-bold text-blue-300">{totalEmails}</div>
          </div>

          {/* Total Tasks - Clickable */}
          <button
            onClick={() => setShowAllTasksView(true)}
            className="bg-green-900/30 rounded-lg p-4 border border-green-700 hover:bg-green-900/50 transition text-left w-full"
          >
            <div className="text-green-300 text-xs font-medium mb-1">TOTAL TASKS</div>
            <div className="text-2xl font-bold text-green-300">{totalTasks}</div>
            <div className="text-xs text-green-400 mt-1 flex items-center gap-1">
              Click to view all
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>
        </div>

        {/* Priority Breakdown - Clickable */}
        <div className="mb-4">
          <div className="text-slate-400 text-xs font-medium mb-2">PRIORITY BREAKDOWN (Click to filter)</div>
          <div className="flex gap-2">
            <button
              onClick={() => setFilter('p0')}
              className={`flex-1 px-4 py-3 rounded-lg transition ${
                filter === 'p0'
                  ? 'bg-red-600 text-white ring-2 ring-red-400'
                  : 'bg-red-900/30 text-red-300 border border-red-700 hover:bg-red-900/50'
              }`}
            >
              <div className="text-lg font-bold">{priorityBreakdown.P0}</div>
              <div className="text-xs opacity-90">P0 Critical</div>
            </button>
            <button
              onClick={() => setFilter('p1')}
              className={`flex-1 px-4 py-3 rounded-lg transition ${
                filter === 'p1'
                  ? 'bg-orange-600 text-white ring-2 ring-orange-400'
                  : 'bg-orange-900/30 text-orange-300 border border-orange-700 hover:bg-orange-900/50'
              }`}
            >
              <div className="text-lg font-bold">{priorityBreakdown.P1}</div>
              <div className="text-xs opacity-90">P1 Important</div>
            </button>
            <button
              onClick={() => setFilter('p2')}
              className={`flex-1 px-4 py-3 rounded-lg transition ${
                filter === 'p2'
                  ? 'bg-yellow-600 text-gray-900 ring-2 ring-yellow-400'
                  : 'bg-yellow-900/30 text-yellow-300 border border-yellow-700 hover:bg-yellow-900/50'
              }`}
            >
              <div className="text-lg font-bold">{priorityBreakdown.P2}</div>
              <div className="text-xs opacity-90">P2 Normal</div>
            </button>
            <button
              onClick={() => setFilter('p3')}
              className={`flex-1 px-4 py-3 rounded-lg transition ${
                filter === 'p3'
                  ? 'bg-green-600 text-white ring-2 ring-green-400'
                  : 'bg-green-900/30 text-green-300 border border-green-700 hover:bg-green-900/50'
              }`}
            >
              <div className="text-lg font-bold">{priorityBreakdown.P3}</div>
              <div className="text-xs opacity-90">P3 Low</div>
            </button>
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
            All Customers
          </button>
          <button
            onClick={() => setFilter('external')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              filter === 'external'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            External Only
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
            onClick={() => setShowDismissed(!showDismissed)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 ${
              showDismissed
                ? 'bg-yellow-900/30 text-yellow-300 border border-yellow-700'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
            title={showDismissed ? 'Hide dismissed tasks' : 'Show dismissed tasks'}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {showDismissed ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              )}
            </svg>
            {showDismissed ? `Showing ${dismissedTasks.size} Dismissed` : 'Show Dismissed'}
          </button>
        </div>
      </div>

      {/* Customer Cards */}
      <div className="space-y-4">
        {filteredCustomers.length === 0 ? (
          <div className="bg-slate-800 rounded-lg shadow-xl border border-slate-700 p-12 text-center text-slate-400">
            No customers match the selected filter
          </div>
        ) : (
          filteredCustomers.map((customer) => (
            <div
              key={customer.customer_name}
              className={`${
                isInternalTools(customer.customer_name)
                  ? 'bg-slate-800/50 border-slate-600'
                  : 'bg-slate-800 border-slate-700'
              } rounded-lg shadow-xl border-2 overflow-hidden hover:border-indigo-500 transition`}
            >
              {/* Customer Header */}
              <button
                onClick={() => toggleCustomer(customer.customer_name)}
                className="w-full px-6 py-5 flex items-center justify-between hover:bg-slate-700/50 transition"
              >
                <div className="flex items-center gap-4 flex-1">
                  {/* Priority Badge */}
                  <div className={`px-3 py-1 rounded-full text-sm font-bold ${priorityColors[customer.highest_priority]}`}>
                    {customer.highest_priority}
                  </div>

                  {/* Customer Info */}
                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-3">
                      <h3 className={`text-xl font-bold ${
                        isInternalTools(customer.customer_name) ? 'text-slate-400' : 'text-white'
                      }`}>
                        {customer.customer_name}
                      </h3>
                      {!isInternalTools(customer.customer_name) && customer.is_external && (
                        <span className="px-2 py-1 bg-blue-900/50 text-blue-300 border border-blue-700 rounded text-xs font-medium">
                          External
                        </span>
                      )}
                      {isInternalTools(customer.customer_name) && (
                        <span className="px-2 py-1 bg-slate-700/50 text-slate-400 border border-slate-600 rounded text-xs font-medium">
                          Internal
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-sm text-slate-400">
                        {customer.email_count} {customer.email_count === 1 ? 'email' : 'emails'} • {customer.all_tasks.length} {customer.all_tasks.length === 1 ? 'task' : 'tasks'}
                      </p>
                      {areAllEmailsMarkedAsRead(customer) && (
                        <span className="px-2 py-0.5 bg-green-900/50 text-green-300 border border-green-700 rounded-full text-xs font-medium flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          All Read
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {onRequestCustomerSummary && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRequestCustomerSummary({
                            customerName: customer.customer_name,
                            domain: inferCustomerDomain(customer)
                          });
                        }}
                        className="px-3 py-1.5 text-xs font-medium text-indigo-200 bg-indigo-900/40 border border-indigo-700 rounded-md hover:bg-indigo-900 transition"
                      >
                        Summarize
                      </button>
                    )}
                    <svg
                      className={`w-6 h-6 text-slate-400 transition-transform ${
                        expandedCustomer === customer.customer_name ? 'rotate-180' : ''
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </button>

              {/* Expanded Content */}
              {expandedCustomer === customer.customer_name && (
                <div className="px-6 py-4 bg-slate-900/50 border-t border-slate-700">
                  {/* All Tasks Summary */}
                  {customer.all_tasks.length > 0 && (() => {
                    const visibleTasks = customer.all_tasks
                      .filter(task => showDismissed || !isTaskDismissed(customer.customer_name, task.title))
                      .sort((a, b) => {
                        // Sort by email date - newest first
                        if (a.emailDate && b.emailDate) {
                          return new Date(b.emailDate).getTime() - new Date(a.emailDate).getTime();
                        }
                        if (a.emailDate) return -1;
                        if (b.emailDate) return 1;
                        return 0;
                      });

                    if (visibleTasks.length === 0) {
                      return (
                        <div className="mb-6">
                          <h4 className="font-semibold text-white mb-3 text-lg">All Tasks from {customer.customer_name}</h4>
                          <div className="bg-slate-700/30 rounded-lg p-4 border border-slate-600 text-center">
                            <p className="text-slate-400 text-sm">
                              All tasks dismissed. Click "Show Dismissed" above to view them.
                            </p>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div className="mb-6">
                        <h4 className="font-semibold text-white mb-3 text-lg">All Tasks from {customer.customer_name}</h4>
                        <div className="space-y-3">
                          {visibleTasks.map((task, idx) => (
                            <div
                              key={idx}
                              className="bg-slate-700/50 rounded-lg p-4 border border-slate-600"
                            >
                            <div className="flex flex-col gap-3">
                              {/* Task Info */}
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
                                  <p className="text-white font-medium">{task.title}</p>
                                  {task.emailSubject && (
                                    <p className="text-slate-400 text-xs mt-1">
                                      From email: {task.emailSubject}
                                    </p>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  {isTaskApproved(customer.customer_name, task.title) && sheetUrl ? (
                                    <a
                                      href={sheetUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="px-4 py-2 rounded-lg text-sm font-medium bg-green-600 text-white hover:bg-green-700 transition inline-flex items-center gap-2"
                                    >
                                      <span>✓ Approved</span>
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                      </svg>
                                    </a>
                                  ) : (
                                    <button
                                      onClick={() => handleApproveTask(customer.customer_name, task.title, {
                                        ...task,
                                        priority: customer.highest_priority
                                      })}
                                      disabled={loading}
                                      className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                                        isTaskApproved(customer.customer_name, task.title)
                                          ? 'bg-green-600 text-white'
                                          : 'bg-indigo-600 text-white hover:bg-indigo-700'
                                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                                    >
                                      {isTaskApproved(customer.customer_name, task.title) ? '✓ Approved' : 'Approve'}
                                    </button>
                                  )}
                                  <button
                                    onClick={() => handleDismissTask(customer.customer_name, task.title)}
                                    className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-900/20 transition"
                                    title="Dismiss task"
                                  >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </button>
                                </div>
                              </div>

                              {/* Email Action Buttons */}
                              {task.emailId && (
                                <div className="flex items-center gap-2 pt-2 border-t border-slate-600">
                                  <a
                                    href={`https://mail.google.com/mail/u/0/#inbox/${task.emailId}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded hover:bg-indigo-700 transition flex items-center gap-1.5"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                    </svg>
                                    View in Gmail
                                  </a>

                                  <button
                                    onClick={() => handleMarkAsRead(task.emailId!)}
                                    disabled={markedAsRead.has(task.emailId!) || markingAsRead.has(task.emailId!)}
                                    className={`px-3 py-1.5 text-xs font-medium rounded transition flex items-center gap-1.5 ${
                                      markedAsRead.has(task.emailId!)
                                        ? 'bg-green-600 text-white cursor-not-allowed'
                                        : markingAsRead.has(task.emailId!)
                                        ? 'bg-slate-600 text-slate-300 cursor-wait'
                                        : 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                                    }`}
                                  >
                                    {markingAsRead.has(task.emailId!) ? (
                                      <>
                                        <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Marking...
                                      </>
                                    ) : markedAsRead.has(task.emailId!) ? (
                                      <>
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                        Marked as Read
                                      </>
                                    ) : (
                                      <>
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 19v-8.93a2 2 0 01.89-1.664l7-4.666a2 2 0 012.22 0l7 4.666A2 2 0 0121 10.07V19M3 19a2 2 0 002 2h14a2 2 0 002-2M3 19l6.75-4.5M21 19l-6.75-4.5M3 10l6.75 4.5M21 10l-6.75 4.5m0 0l-1.14.76a2 2 0 01-2.22 0l-1.14-.76" />
                                        </svg>
                                        Mark as Read
                                      </>
                                    )}
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Individual Emails */}
                  <div>
                    <h4 className="font-semibold text-white mb-3">Individual Emails</h4>
                    <div className="space-y-2">
                      {customer.emails.map((email) => (
                        <div
                          key={email.emailId}
                          className="bg-slate-700/30 rounded-lg border border-slate-600 overflow-hidden"
                        >
                          <div className="px-4 py-3 flex items-center justify-between">
                            <button
                              onClick={() => toggleEmail(email.emailId)}
                              className="flex items-center gap-3 flex-1 text-left hover:opacity-80 transition"
                            >
                              <div className={`px-2 py-1 rounded text-xs font-bold ${priorityColors[email.priority]}`}>
                                {email.priority}
                              </div>
                              <div className="flex-1">
                                <p className="text-white font-medium text-sm">{email.subject}</p>
                                <div className="flex items-center gap-2 text-xs">
                                  <p className="text-slate-400">{email.from}</p>
                                  <span className="text-slate-500">•</span>
                                  <p className="text-slate-400">
                                    {new Date(email.date).toLocaleString('en-US', {
                                      month: 'short',
                                      day: 'numeric',
                                      hour: 'numeric',
                                      minute: '2-digit',
                                      hour12: true
                                    })}
                                  </p>
                                </div>
                              </div>
                              {email.tasks.length > 0 && (
                                <span className="px-2 py-1 bg-blue-900/50 text-blue-300 border border-blue-700 rounded-full text-xs">
                                  {email.tasks.length} tasks
                                </span>
                              )}
                              <svg
                                className={`w-4 h-4 text-slate-400 transition-transform ${
                                  expandedEmail === email.emailId ? 'rotate-180' : ''
                                }`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </button>

                            {/* View in Gmail Button */}
                            <a
                              href={`https://mail.google.com/mail/u/0/#inbox/${email.emailId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="ml-3 px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded hover:bg-indigo-700 transition flex items-center gap-1.5"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                              </svg>
                              View in Gmail
                            </a>

                            {/* Mark as Read Button */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMarkAsRead(email.emailId);
                              }}
                              disabled={markedAsRead.has(email.emailId) || markingAsRead.has(email.emailId)}
                              className={`ml-2 px-3 py-1.5 text-xs font-medium rounded transition flex items-center gap-1.5 ${
                                markedAsRead.has(email.emailId)
                                  ? 'bg-green-600 text-white cursor-not-allowed'
                                  : markingAsRead.has(email.emailId)
                                  ? 'bg-slate-600 text-slate-300 cursor-wait'
                                  : 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                              }`}
                            >
                              {markingAsRead.has(email.emailId) ? (
                                <>
                                  <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                  </svg>
                                  Marking...
                                </>
                              ) : markedAsRead.has(email.emailId) ? (
                                <>
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                  Marked as Read
                                </>
                              ) : (
                                <>
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 19v-8.93a2 2 0 01.89-1.664l7-4.666a2 2 0 012.22 0l7 4.666A2 2 0 0121 10.07V19M3 19a2 2 0 002 2h14a2 2 0 002-2M3 19l6.75-4.5M21 19l-6.75-4.5M3 10l6.75 4.5M21 10l-6.75 4.5m0 0l-1.14.76a2 2 0 01-2.22 0l-1.14-.76" />
                                  </svg>
                                  Mark as Read
                                </>
                              )}
                            </button>
                          </div>

                          {expandedEmail === email.emailId && (
                            <div className="px-4 py-3 bg-slate-800/50 border-t border-slate-600">
                              <p className="text-slate-300 text-sm mb-2">{email.summary}</p>
                              <p className="text-slate-500 text-xs">{new Date(email.date).toLocaleString()}</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
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
