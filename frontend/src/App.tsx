import { useState, useEffect } from 'react';
import axios from 'axios';
import Login from './components/Login';
import EmailDashboard from './components/EmailDashboard';
import SentEmailsByCustomer from './components/SentEmailsByCustomer';
import Settings from './components/Settings';
import UserProfile from './components/UserProfile';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

axios.defaults.baseURL = API_URL;
axios.defaults.withCredentials = true;

type View = 'dashboard' | 'settings';
type Tab = 'inbox' | 'sent' | 'summary';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [hasProfile, setHasProfile] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [currentTab, setCurrentTab] = useState<Tab>('inbox');

  useEffect(() => {
    checkAuthAndProfile();

    // Check for auth callback
    const params = new URLSearchParams(window.location.search);
    if (params.get('auth') === 'success') {
      setIsAuthenticated(true);
      window.history.replaceState({}, '', '/');
      // Recheck profile after successful auth
      checkAuthAndProfile();
    } else if (params.get('error')) {
      console.error('Authentication error:', params.get('error'));
      window.history.replaceState({}, '', '/');
    }
  }, []);

  const checkAuthAndProfile = async () => {
    try {
      // First check if config file exists (no auth required)
      const configResponse = await axios.get('/api/user/profile/exists');
      const configFileExists = configResponse.data.exists;

      // Then check auth status
      const authResponse = await axios.get('/api/auth/status');
      const authenticated = authResponse.data.authenticated;

      setIsAuthenticated(authenticated);

      if (authenticated) {
        // If authenticated, check if profile exists either in config file or session
        if (configFileExists) {
          // Config file exists, profile is available
          setHasProfile(true);
        } else {
          // No config file, check session
          try {
            const profileResponse = await axios.get('/api/user/profile');
            setHasProfile(profileResponse.data.hasProfile || false);
          } catch (error) {
            setHasProfile(false);
          }
        }
      } else {
        setHasProfile(false);
      }
    } catch (error) {
      console.error('Auth/Profile check failed:', error);
      setIsAuthenticated(false);
      setHasProfile(false);
    } finally {
      setLoading(false);
    }
  };

  const handleProfileComplete = () => {
    setHasProfile(true);
  };

  const handleLogout = async () => {
    try {
      await axios.post('/api/auth/logout');
      setIsAuthenticated(false);
      setHasProfile(false);
      setCurrentView('dashboard');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const handleShowSettings = () => {
    setCurrentView('settings');
  };

  const handleBackToDashboard = () => {
    setCurrentView('dashboard');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-xl text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900">
      {!isAuthenticated ? (
        <Login />
      ) : !hasProfile ? (
        <UserProfile onComplete={handleProfileComplete} />
      ) : (
        currentView === 'settings' ? (
          <div className="min-h-screen bg-slate-900 py-8 px-4">
            <Settings onBack={handleBackToDashboard} />
          </div>
        ) : (
          <div className="min-h-screen bg-slate-900">
            {/* Tab Navigation */}
            <div className="bg-slate-800 border-b border-slate-700">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex gap-4">
                  <button
                    onClick={() => setCurrentTab('inbox')}
                    className={`px-6 py-4 font-semibold border-b-2 transition ${
                      currentTab === 'inbox'
                        ? 'border-indigo-500 text-indigo-400'
                        : 'border-transparent text-slate-400 hover:text-slate-300'
                    }`}
                  >
                    📥 Inbox (Received)
                  </button>
                  <button
                    onClick={() => setCurrentTab('sent')}
                    className={`px-6 py-4 font-semibold border-b-2 transition ${
                      currentTab === 'sent'
                        ? 'border-indigo-500 text-indigo-400'
                        : 'border-transparent text-slate-400 hover:text-slate-300'
                    }`}
                  >
                    📤 Sent (By Customer)
                  </button>
                  <button
                    onClick={() => setCurrentTab('summary')}
                    className={`px-6 py-4 font-semibold border-b-2 transition ${
                      currentTab === 'summary'
                        ? 'border-indigo-500 text-indigo-400'
                        : 'border-transparent text-slate-400 hover:text-slate-300'
                    }`}
                  >
                    📊 Customer Activity Summary
                  </button>
                </div>
              </div>
            </div>

            {/* Tab Content */}
            {currentTab === 'inbox' ? (
              <EmailDashboard onLogout={handleLogout} onShowSettings={handleShowSettings} />
            ) : currentTab === 'summary' ? (
              <EmailDashboard onLogout={handleLogout} onShowSettings={handleShowSettings} summaryOnly />
            ) : (
              <SentEmailsByCustomer onLogout={handleLogout} onShowSettings={handleShowSettings} />
            )}
          </div>
        )
      )}
    </div>
  );
}

export default App;
