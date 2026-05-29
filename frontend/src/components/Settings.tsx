import { useState, useEffect } from 'react';
import axios from 'axios';

interface SettingsProps {
  onBack: () => void;
}

type Provider = 'openai' | 'gemini' | 'anthropic';

const providerModels = {
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
  gemini: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash', 'gemini-flash-latest'],
  anthropic: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229']
};

export default function Settings({ onBack }: SettingsProps) {
  const [provider, setProvider] = useState<Provider>('openai');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [fetchingConfig, setFetchingConfig] = useState(true);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const response = await axios.get('/api/config');
      const config = response.data;
      setProvider(config.provider || 'openai');
      setModel(config.model || '');
      // API key is masked from backend
    } catch (error) {
      console.error('Failed to fetch config:', error);
    } finally {
      setFetchingConfig(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    // API key is optional now since we have a default OpenAI key
    if (!apiKey && provider !== 'openai') {
      setMessage({ type: 'error', text: 'Please enter an API key' });
      return;
    }

    try {
      setLoading(true);
      setMessage(null);

      await axios.post('/api/config', {
        provider,
        apiKey: apiKey || undefined,
        model: model || undefined
      });

      setMessage({ type: 'success', text: 'Settings saved successfully!' });
      setApiKey(''); // Clear the API key input after save
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.response?.data?.error || 'Failed to save settings'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleProviderChange = (newProvider: Provider) => {
    setProvider(newProvider);
    setModel(''); // Reset model when provider changes
  };

  if (fetchingConfig) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-slate-400">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-slate-800 rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">AI Settings</h2>
          <button
            onClick={onBack}
            className="px-4 py-2 text-sm font-medium text-slate-300 bg-slate-800 border border-slate-600 rounded-md hover:bg-slate-700"
          >
            Back to Dashboard
          </button>
        </div>

        {/* Default Config Notice */}
        <div className="mb-6 p-4 bg-green-900/30 rounded-lg border border-green-700">
          <div className="flex items-start">
            <svg className="w-5 h-5 text-green-400 mr-3 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <h3 className="text-sm font-semibold text-green-300 mb-1">Default Configuration Active</h3>
              <p className="text-sm text-green-200">
                OpenAI (GPT-4o-mini) is pre-configured and ready to use. You can change providers or add your own API keys below if needed.
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          {/* Provider Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              AI Provider
            </label>
            <div className="grid grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => handleProviderChange('openai')}
                className={`px-4 py-3 rounded-lg border-2 font-medium transition-all ${
                  provider === 'openai'
                    ? 'border-indigo-500 bg-indigo-600 text-white'
                    : 'border-slate-600 bg-slate-700 text-slate-300 hover:border-slate-500'
                }`}
              >
                OpenAI
              </button>
              <button
                type="button"
                onClick={() => handleProviderChange('gemini')}
                className={`px-4 py-3 rounded-lg border-2 font-medium transition-all ${
                  provider === 'gemini'
                    ? 'border-indigo-500 bg-indigo-600 text-white'
                    : 'border-slate-600 bg-slate-700 text-slate-300 hover:border-slate-500'
                }`}
              >
                Gemini
              </button>
              <button
                type="button"
                onClick={() => handleProviderChange('anthropic')}
                className={`px-4 py-3 rounded-lg border-2 font-medium transition-all ${
                  provider === 'anthropic'
                    ? 'border-indigo-500 bg-indigo-600 text-white'
                    : 'border-slate-600 bg-slate-700 text-slate-300 hover:border-slate-500'
                }`}
              >
                Anthropic
              </button>
            </div>
          </div>

          {/* API Key */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              API Key {provider === 'openai' && <span className="text-slate-500">(Optional - using default)</span>}
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={
                provider === 'openai'
                  ? 'Leave blank to use default or enter your own OpenAI API key'
                  : `Enter your ${provider === 'gemini' ? 'Google Gemini' : 'Anthropic'} API key`
              }
              className="w-full px-3 py-2 bg-slate-700 text-white border border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <p className="mt-1 text-xs text-slate-400">
              {provider === 'openai' && 'Using default OpenAI key. Override with your own from: https://platform.openai.com/api-keys'}
              {provider === 'gemini' && 'Get your API key from: https://aistudio.google.com/app/apikey'}
              {provider === 'anthropic' && 'Get your API key from: https://console.anthropic.com/'}
            </p>
          </div>

          {/* Model Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Model (Optional)
            </label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full px-3 py-2 bg-slate-700 text-white border border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Default model ({provider === 'openai' ? 'gpt-4o-mini' : provider === 'gemini' ? 'gemini-2.5-flash' : 'claude-3-5-sonnet'})</option>
              {providerModels[provider].map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-400">
              Leave as default to use the recommended model for {provider}
            </p>
          </div>

          {/* Message */}
          {message && (
            <div
              className={`px-4 py-3 rounded-lg ${
                message.type === 'success'
                  ? 'bg-green-900/30 text-green-300 border border-green-700'
                  : 'bg-red-900/30 text-red-300 border border-red-700'
              }`}
            >
              {message.text}
            </div>
          )}

          {/* Save Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full px-6 py-3 bg-indigo-600 text-white font-medium rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Saving...' : 'Save Settings'}
          </button>
        </form>

        {/* Info Box */}
        <div className="mt-6 p-4 bg-blue-900/30 rounded-lg border border-blue-700">
          <h3 className="text-sm font-semibold text-blue-300 mb-2">About AI Providers</h3>
          <ul className="text-sm text-blue-200 space-y-1">
            <li>• <strong>OpenAI:</strong> GPT-4 and GPT-3.5 models, great for detailed summaries (Default)</li>
            <li>• <strong>Gemini:</strong> Google's AI models, fast and efficient</li>
            <li>• <strong>Anthropic:</strong> Claude models, excellent for understanding context</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
