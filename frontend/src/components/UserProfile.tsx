import { useState } from 'react';
import axios from 'axios';

interface UserProfileProps {
  onComplete: () => void;
}

export default function UserProfile({ onComplete }: UserProfileProps) {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    primaryEmail: '',
    internalDomain: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.firstName || !formData.lastName || !formData.primaryEmail || !formData.internalDomain) {
      setError('All fields are required');
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.primaryEmail)) {
      setError('Please enter a valid email address');
      return;
    }

    // Validate domain format (should start with @)
    if (!formData.internalDomain.startsWith('@')) {
      setError('Internal domain should start with @ (e.g., @company.com)');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      await axios.post('/api/user/profile', {
        first_name: formData.firstName,
        last_name: formData.lastName,
        primary_email: formData.primaryEmail,
        internal_domain: formData.internalDomain
      });

      onComplete();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save profile. Please try again.');
      setLoading(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError(null);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 px-4">
      <div className="max-w-lg w-full bg-slate-800 rounded-lg shadow-2xl border border-slate-700 p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Welcome to Email Reader!</h1>
          <p className="text-slate-300 mb-3">
            Let's set up your profile to personalize your experience
          </p>
          <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-3 text-left">
            <p className="text-blue-300 text-sm">
              <span className="font-semibold">💾 Note:</span> Your profile will be saved to a local configuration file (<code className="bg-slate-900 px-1 py-0.5 rounded">.user-config.json</code>). You won't need to re-enter this information next time!
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* First Name */}
          <div>
            <label htmlFor="firstName" className="block text-sm font-medium text-slate-300 mb-2">
              First Name *
            </label>
            <input
              type="text"
              id="firstName"
              value={formData.firstName}
              onChange={(e) => handleChange('firstName', e.target.value)}
              className="w-full px-4 py-3 bg-slate-700 border border-slate-600 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="John"
              required
            />
          </div>

          {/* Last Name */}
          <div>
            <label htmlFor="lastName" className="block text-sm font-medium text-slate-300 mb-2">
              Last Name *
            </label>
            <input
              type="text"
              id="lastName"
              value={formData.lastName}
              onChange={(e) => handleChange('lastName', e.target.value)}
              className="w-full px-4 py-3 bg-slate-700 border border-slate-600 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Doe"
              required
            />
          </div>

          {/* Primary Email */}
          <div>
            <label htmlFor="primaryEmail" className="block text-sm font-medium text-slate-300 mb-2">
              Primary Email *
            </label>
            <input
              type="email"
              id="primaryEmail"
              value={formData.primaryEmail}
              onChange={(e) => handleChange('primaryEmail', e.target.value)}
              className="w-full px-4 py-3 bg-slate-700 border border-slate-600 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="john.doe@company.com"
              required
            />
            <p className="mt-2 text-xs text-slate-400">
              This email is used for "Direct-to-Owner" priority detection
            </p>
          </div>

          {/* Internal Domain */}
          <div>
            <label htmlFor="internalDomain" className="block text-sm font-medium text-slate-300 mb-2">
              Internal Domain *
            </label>
            <input
              type="text"
              id="internalDomain"
              value={formData.internalDomain}
              onChange={(e) => handleChange('internalDomain', e.target.value)}
              className="w-full px-4 py-3 bg-slate-700 border border-slate-600 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="@company.com"
              required
            />
            <p className="mt-2 text-xs text-slate-400">
              Used to distinguish internal emails from external customers
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-900/30 border border-red-700 text-red-300 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {loading ? 'Saving...' : 'Complete Setup'}
          </button>
        </form>

        <div className="mt-6 p-4 bg-blue-900/30 border border-blue-700 rounded-lg">
          <p className="text-sm text-blue-300">
            <strong>Why we need this:</strong> Your profile helps us correctly prioritize emails
            by distinguishing internal communications from external customer emails, and identifying
            messages sent directly to you (P0 priority).
          </p>
        </div>
      </div>
    </div>
  );
}
