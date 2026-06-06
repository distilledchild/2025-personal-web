import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, useSearchParams, Navigate, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { ThreeDNA } from './components/ThreeDNA';
import { Todo } from './pages/Todo';
import { About } from './pages/About';
import { Research } from './pages/Research';
import { Blog } from './pages/Blog';
import { Interests } from './pages/Interests';
import { Contact } from './pages/Contact';
import { StravaCallback } from './pages/StravaCallback';
import { API_URL } from './utils/apiConfig';
import {
  clearStoredUserProfile,
  fetchMemberRole,
  getStoredUserProfile,
  setStoredUserProfile,
  subscribeToUserProfileChanges
} from './utils/auth';

const Home: React.FC = () => (
  <div className="relative w-full h-[100dvh] flex flex-col items-center justify-center overflow-hidden bg-black">
    {/* 3D Background Layer - Z index 0 */}
    <ThreeDNA />

    {/* Content Overlay - Z index 10, Pointer Events None allows clicking through to Canvas */}
    <div className="relative z-10 text-center space-y-4 px-4 pointer-events-none select-none mt-[-5vh]">
      <h1 
        className="text-[7.5rem] md:text-[12rem] leading-none font-extrabold tracking-tight"
        style={{ filter: "drop-shadow(0px 5px 15px rgba(0,0,0,0.45)) drop-shadow(0px 15px 35px rgba(0,0,0,0.45))" }}
      >
        <span className="text-white">
          3D{' '}
        </span>
        <br className="md:hidden" />
        <span
          className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-green-400 to-purple-400 animate-gradient pr-2"
          style={{
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}
        >
          Genomics
        </span>
      </h1>
      <p className="text-lg md:text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed">
        unraveling the 3D genome, one interaction at a time.
      </p>
    </div>

    {/* Instruction Text - Centered and Animated */}
    <div className="absolute bottom-9 left-1/2 -translate-x-1/2 z-20 pointer-events-none select-none hidden md:block">
      <p className="text-lg md:text-xl text-white font-light animate-double-blink">
        Drag or Scroll to Interact
      </p>
    </div>
  </div>
);

// Liquid Crystal Tab Component - 95% of original size
const LiquidTab = ({ to, label, active, colorClass, badgeCount }: { to: string; label: string; active: boolean; colorClass: string; badgeCount?: number }) => (
  <Link
    to={to}
    className={`
      relative px-3 md:px-5 py-2 md:py-3 rounded-full transition-all duration-200 group overflow-hidden
      font-extrabold tracking-tighter hover:scale-105
      ${colorClass}
    `}
    style={{ fontSize: 'clamp(1.3rem, 3.2vw, 2rem)' }}
  >
    {/* Content with Floating Animation */}
    <span className="relative z-10 block transition-transform duration-300 ease-out group-hover:-translate-y-2 flex items-center gap-2 -translate-y-2">
      {label}
      {badgeCount !== undefined && (
        <span className="bg-red-500 text-white text-xs rounded-full px-2 py-0.5 min-w-[1.5rem] text-center">
          {badgeCount}
        </span>
      )}
    </span>
  </Link>
);

const Layout: React.FC = () => {
  const location = useLocation();
  const isHome = location.pathname === '/';
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [userRole, setUserRole] = React.useState<string | null>(null);
  const [isAuthorized, setIsAuthorized] = React.useState(false);
  const researchDefaultPath = '/research/paperfinder';

  React.useEffect(() => {
    const checkAuth = async () => {
      const stored = getStoredUserProfile<any>();
      if (stored) {
        try {
          setUserRole(stored.role ?? null);

          // Check authorization from MEMBER collection
          const data = await fetchMemberRole(stored.email);
          setIsAuthorized(Boolean(data.authorized));
          setUserRole((data.role as string | null | undefined) ?? stored.role ?? null);
        } catch (e) {
          console.error("Failed to parse user profile or check authorization", e);
          setIsAuthorized(false);
        }
      } else {
        setUserRole(null);
        setIsAuthorized(false);
      }
    };

    checkAuth();

    const unsubscribe = subscribeToUserProfileChanges(checkAuth);

    return () => {
      unsubscribe();
    };
  }, []);

  // Google Analytics - Track page views on route change
  useEffect(() => {
    if (typeof window.gtag !== 'undefined') {
      window.gtag('config', 'G-GD5495D6KD', {
        page_path: location.pathname + location.search
      });
    }
  }, [location]);


  return (
    <div className="min-h-screen font-sans text-slate-900">
      {/* Branding Logo - Visible on ALL pages top left */}
      <div className="fixed top-0 left-0 z-50 p-4 md:p-8 flex items-center">
        <Link to="/" className="font-extrabold tracking-tighter flex items-center text-slate-900" style={{ fontSize: 'clamp(1.5rem, 4vw, 2.4rem)' }}>
          {/* <span className="text-green-500">Distilled</span> */}
          <span
            className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-green-400 to-purple-400 animate-gradient"
            style={{
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}
          >Distilled</span>
          <span className="text-[#0D1584]">Child</span>
        </Link>
      </div>

      {/* Hamburger Menu Button - Visible on screens smaller than xl */}
      <button
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        className="fixed top-0 right-0 z-50 p-6 xl:hidden pointer-events-auto"
        aria-label="Toggle menu"
      >
        <div className="w-8 h-8 flex flex-col justify-center items-center gap-1.5">
          <span className={`w-full h-0.5 bg-red-500 transition-all duration-300 ${mobileMenuOpen ? 'rotate-45 translate-y-2' : ''}`} />
          <span className={`w-full h-0.5 bg-red-500 transition-all duration-300 ${mobileMenuOpen ? 'opacity-0' : ''}`} />
          <span className={`w-full h-0.5 bg-red-500 transition-all duration-300 ${mobileMenuOpen ? '-rotate-45 -translate-y-2' : ''}`} />
        </div>
      </button>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 xl:hidden animate-modalBackdrop"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div className="fixed top-20 right-4 bg-white rounded-3xl shadow-2xl p-6 animate-modalContent" onClick={(e) => e.stopPropagation()}>
            <div className="flex flex-col gap-4">
              {isAuthorized && (
                <Link to="/todo" onClick={() => setMobileMenuOpen(false)} className="text-2xl font-extrabold text-gray-500 hover:text-gray-300 transition-colors px-4 py-2">
                  TODO
                </Link>
              )}
              <Link to="/about" onClick={() => setMobileMenuOpen(false)} className="text-2xl font-extrabold text-blue-500 hover:text-blue-300 transition-colors px-4 py-2">
                About
              </Link>
              <Link to={researchDefaultPath} onClick={() => setMobileMenuOpen(false)} className="text-2xl font-extrabold text-teal-500 hover:text-teal-300 transition-colors px-4 py-2">
                Research
              </Link>
              <Link to="/blog" onClick={() => setMobileMenuOpen(false)} className="text-2xl font-extrabold text-pink-500 hover:text-pink-300 transition-colors px-4 py-2">
                Blog
              </Link>
              <Link to="/interests/analysis/1" onClick={() => setMobileMenuOpen(false)} className="text-2xl font-extrabold text-[#FFA300] hover:text-[#FFD180] transition-colors px-4 py-2">
                Interests
              </Link>
              <Link to="/contact/contactinfo" onClick={() => setMobileMenuOpen(false)} className="text-2xl font-extrabold text-purple-500 hover:text-purple-300 transition-colors px-4 py-2">
                Contact
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Bar - Desktop Only - Hidden on small screens */}
      <nav className="fixed top-0 right-0 w-full z-50 p-4 md:p-8 justify-end pointer-events-none hidden xl:flex">
        <div className="pointer-events-auto flex gap-3 items-center bg-white/0 backdrop-blur-none">
          {isAuthorized && (
            <LiquidTab
              to="/todo"
              label="TODO"
              active={location.pathname === '/todo'}
              colorClass="text-gray-500 hover:text-gray-300"
            />
          )}
          <LiquidTab
            to="/about"
            label="About"
            active={location.pathname === '/about'}
            colorClass="text-blue-500 hover:text-blue-300"
          />
          <LiquidTab
            to={researchDefaultPath}
            label="Research"
            active={location.pathname.startsWith('/research')}
            colorClass="text-teal-500 hover:text-teal-300"
          />
          <LiquidTab
            to="/blog"
            label="Blog"
            active={location.pathname.startsWith('/blog')}
            colorClass="text-pink-500 hover:text-pink-300"
          />
          <LiquidTab
            to="/interests/analysis/1"
            label="Interests"
            active={location.pathname.startsWith('/interests')}
            colorClass="text-[#FFA300] hover:text-[#FFD180]"
          />
          <LiquidTab
            to="/contact/contactinfo"
            label="Contact"
            active={location.pathname.startsWith('/contact')}
            colorClass="text-purple-500 hover:text-purple-300"
          />
        </div>
      </nav>

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/todo" element={<Navigate to="/todo/personal" replace />} />
        <Route path="/todo/:tab" element={<Todo />} />
        <Route path="/about" element={<Navigate to="/about/me" replace />} />
        <Route path="/about/:tab" element={<About />} />
        <Route path="/research" element={<Navigate to={researchDefaultPath} replace />} />
        <Route path="/research/:submenu" element={<Research />} />
        <Route path="/blog" element={<Navigate to="/blog/tech-bio" replace />} />
        <Route path="/blog/:tab" element={<Blog />} />
        <Route path="/interests" element={<Navigate to="/interests/analysis/1" replace />} />
        <Route path="/interests/:submenu" element={<Interests isAuthorized={isAuthorized} />} />
        <Route path="/interests/:submenu/:subId" element={<Interests isAuthorized={isAuthorized} />} />
        <Route path="/contact" element={<Navigate to="/contact/contactinfo" replace />} />
        <Route path="/contact/:tab" element={<Contact />} />
        <Route path="/strava/callback" element={<StravaCallback />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <GoogleLogin />
      <TimerWidget isAuthorized={isAuthorized} />
    </div>
  );
};

const GoogleLogin: React.FC = () => {
  const [user, setUser] = useState<{ picture: string; name: string } | null>(null);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const stored = getStoredUserProfile<any>();
    if (stored) {
      try {
        setUser(stored);
      } catch (e) {
        console.error("Failed to parse user profile", e);
      }
    }
  }, []);

  const handleLogin = () => {
    if (user) {
      // Logout logic if needed, or just show info
      if (confirm('Do you want to logout?')) {
        clearStoredUserProfile();
        setUser(null);
        // Redirect to home if on any /todo page (including /todo/personal, /todo/dev)
        if (location.pathname.startsWith('/todo')) {
          navigate('/');
        }
      }
      return;
    }

    const redirectUri =
      import.meta.env.VITE_GOOGLE_REDIRECT_URI ||
      `${window.location.origin}/oauth/google/callback`;
    const googleClientId =
      import.meta.env.VITE_GOOGLE_CLIENT_ID ||
      '511732610766-qma8v1ljq0qia68rtvuq790shn03bvmo.apps.googleusercontent.com';

    const params = new URLSearchParams({
      client_id: googleClientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'email profile',
      access_type: 'offline',
      prompt: 'consent'
    });
    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  };

  return (
    <div className="fixed bottom-6 left-6 z-50">
      <FloatingActionButton
        onClick={handleLogin}
        title={user ? `Logged in as ${user.name}` : "Login with Google"}
        className="border border-slate-100"
      >
        {user ? (
          <img src={user.picture} alt={user.name} className="w-full h-full object-cover" />
        ) : (
          <div className="bg-red-600 w-full h-full flex items-center justify-center">
            <span className="text-white font-bold text-2xl">G</span>
          </div>
        )}
      </FloatingActionButton>
    </div>
  );
};

const OAuthCallback: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = React.useMemo(() => {
    // This is a hack because useNavigate might not be available if this component is rendered outside Router context,
    // but here it is inside. However, to be safe and simple:
    return (path: string) => window.location.href = path;
  }, []);

  const code = searchParams.get('code');
  const [status, setStatus] = useState('Processing login...');

  useEffect(() => {
    if (code) {
      const redirectUri =
        import.meta.env.VITE_GOOGLE_REDIRECT_URI ||
        `${window.location.origin}/oauth/google/callback`;
      fetch(`${API_URL}/api/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, redirectUri })
      })
        .then(async res => {
          if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Login failed');
          }
          return res.json();
        })
        .then(data => {
          if (data.picture) {
            setStoredUserProfile(data);
            setStatus('Login successful! Redirecting...');
            setTimeout(() => navigate('/'), 1000);
          }
        })
        .catch(err => {
          console.error(err);
          setStatus(`Login failed: ${err.message}`);
          setTimeout(() => navigate('/'), 3000);
        });
    } else {
      navigate('/');
    }
  }, [code, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="text-center">
        <Loader2 className="w-10 h-10 animate-spin text-blue-500 mx-auto mb-4" />
        <p className="text-slate-600 text-lg">{status}</p>
      </div>
    </div>
  );
};

import { FloatingActionButton, TimerWidget } from './components/TodoComponents';



const App: React.FC = () => {
  return (
    <Router>
      <Routes>
        <Route path="/oauth/google/callback" element={<OAuthCallback />} />
        <Route path="*" element={<Layout />} />
      </Routes>
    </Router>
  );
};

export default App;
