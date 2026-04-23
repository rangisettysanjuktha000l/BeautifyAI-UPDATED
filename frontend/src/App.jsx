import React, { useState, useEffect, useRef, useCallback } from 'react';
import emailjs from '@emailjs/browser';
import {
  Sparkles, Upload, Sliders, Zap, Download, Shield, Layers, Cpu,
  ChevronDown, Github, Mail, Star, ArrowRight, Brain, Camera,
  Wand2, Image, Check, Menu, X
} from 'lucide-react';

// ── EmailJS credentials ─────────────────────────────────────────────
// 1. Sign up free at https://www.emailjs.com
// 2. Create an Email Service (Gmail recommended) → copy Service ID
// 3. Create an Email Template with variables: {{to_email}}, {{reset_link}}
// 4. Copy your Public Key from Account → API Keys
const EMAILJS_SERVICE_ID = 'service_o8nbzki';   // e.g. 'service_abc123'
const EMAILJS_TEMPLATE_ID = 'template_j88s61l';  // e.g. 'template_xyz789'
const EMAILJS_PUBLIC_KEY = 'gX6DNu5QgGIB5tkcY';   // e.g. 'abc123xyz'

/* ─────────────────────────────────────────────
   Login Modal
───────────────────────────────────────────── */
function LoginModal({ onClose, onLogin }) {
  const [view, setView] = useState('login'); // 'login' | 'signup' | 'forgot'
  const [showPwd, setShowPwd] = useState(false);
  const [keepMe, setKeepMe] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [toast, setToast] = useState('');

  // Signup fields
  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPwd, setSignupPwd] = useState('');
  const [signupPwd2, setSignupPwd2] = useState('');
  const [signupShowPwd, setSignupShowPwd] = useState(false);
2
  // Forgot password
  const [forgotEmail, setForgotEmail] = useState('');

  // Facebook flow states
  // 'none' | 'confirm' | 'manual'
  const [fbStep, setFbStep] = useState('none');
  const [fbUser, setFbUser] = useState('');
  const [fbPass, setFbPass] = useState('');
  const [fbShowPwd, setFbShowPwd] = useState(false);
  // Logged-in FB account detected from device
  const [fbProfile, setFbProfile] = useState(null); // { name, picture }
  const [fbLoading, setFbLoading] = useState(false);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2800);
  };

  // ⚠️ Replace with your real Client ID from console.cloud.google.com
  const GOOGLE_CLIENT_ID = '105162497855-16avlmhf862lo1lcolgrg2c7mm9rcmdh.apps.googleusercontent.com';

  const socialUrls = {
    X: 'https://twitter.com/login',
    Apple: 'https://appleid.apple.com/sign-in',
  };

  const handleSocial = (provider) => {
    if (provider === 'Google') {
      if (!window.google) {
        showToast('Google Sign-In is loading, try again in a moment.');
        return;
      }
      // Use OAuth2 token client — opens a real Google account picker popup
      // Works reliably on localhost and production
      const tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: 'openid email profile',
        callback: (tokenResponse) => {
          if (tokenResponse.error) {
            showToast('Google Sign-In was cancelled or failed.');
            return;
          }
          // Fetch the user's profile using the access token
          fetch(`https://www.googleapis.com/oauth2/v3/userinfo?access_token=${tokenResponse.access_token}`)
            .then(r => r.json())
            .then(profile => {
              showToast(`Welcome, ${profile.given_name || 'User'}! 🎉`);
              if (onLogin) onLogin(profile.email, profile.picture, profile.name || profile.given_name);
              setTimeout(onClose, 1200);
            })
            .catch(() => {
              showToast('Google Sign-In successful! 🎉');
              if (onLogin) onLogin('');
              setTimeout(onClose, 1200);
            });
        },
      });
      tokenClient.requestAccessToken({ prompt: 'select_account' });
      return;
    }
    if (provider === 'Facebook') {
      setFbProfile(null);
      setFbLoading(true);
      setFbStep('confirm');
      // Try to detect the existing logged-in FB account via SDK
      if (window.FB) {
        window.FB.getLoginStatus((response) => {
          if (response.status === 'connected') {
            window.FB.api('/me', { fields: 'name,picture.width(80).height(80)' }, (data) => {
              setFbProfile({
                name: data.name || 'Facebook User',
                picture: data.picture?.data?.url || null,
              });
              setFbLoading(false);
            });
          } else {
            setFbLoading(false);
          }
        });
      } else {
        setFbLoading(false);
      }
      return;
    }
    showToast(`Redirecting to ${provider}…`);
    setTimeout(() => window.open(socialUrls[provider], '_blank'), 800);
  };

  const handleFbContinue = () => {
    showToast('Redirecting to Facebook…');
    setFbStep('none');
    setTimeout(() => window.open('https://www.facebook.com/login', '_blank'), 800);
  };

  const handleFbCancel = () => {
    setFbStep('manual');
    setFbUser('');
    setFbPass('');
  };

  const handleFbLogin = () => {
    if (!fbUser) return showToast('Please enter your Facebook username or email.');
    if (!fbPass) return showToast('Please enter your Facebook password.');
    showToast('Signing in with Facebook… 🎉');
    if (onLogin) onLogin(fbUser, '', '', keepMe);
    setTimeout(() => { setFbStep('none'); onClose(); }, 1500);
  };

  const handleLogin = async () => {
    if (!email) return showToast('Please enter your email address.');
    if (!password) return showToast('Please enter your password.');

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json();

      if (data.success) {
        showToast('Login successful! 🎉');
        if (onLogin) onLogin(data.user.email, '', data.user.name || '', keepMe);
        setTimeout(() => onClose(), 1500);
      } else {
        showToast(data.message || 'Invalid email or password. ❌');
      }
    } catch (err) {
      showToast('Cannot connect to server. Is the backend running?');
    }
  };

  const handleSignup = async () => {
    if (!signupEmail.trim()) return showToast('Please enter your email address.');
    if (!/^[^@]+@[^@]+\.[^@]+$/.test(signupEmail)) return showToast('Please enter a valid email address.');
    if (signupPwd.length < 8) return showToast('Password must be at least 8 characters.');

    try {
      const res = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: signupName.trim(),
          email: signupEmail.trim(),
          password: signupPwd,
        }),
      });
      const data = await res.json();

      if (data.success) {
        // Show success screen — do NOT auto-login
        setView('success');
      } else {
        showToast(data.message || 'Signup failed. Please try again.');
        if (data.message && data.message.includes('already exists')) {
          setSignupEmail('');
          setSignupPwd('');
          setSignupName('');
          setSignupPwd2('');
        }
      }
    } catch (err) {
      showToast('Cannot connect to server. Is the backend running?');
    }
  };

  const [isSendingReset, setIsSendingReset] = useState(false);

  const handleForgotPassword = async () => {
    if (!forgotEmail.trim()) return showToast('Please enter your email address.');
    if (!/^[^@]+@[^@]+\.[^@]+$/.test(forgotEmail)) return showToast('Please enter a valid email address.');

    setIsSendingReset(true);
    try {
      await emailjs.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID,
        {
          to_email: forgotEmail,
          reset_link: `${window.location.origin}/reset-password`,
          from_name: 'BeautifyAI',
        },
        EMAILJS_PUBLIC_KEY
      );
      showToast('Reset link sent! Check your inbox 📧');
      setTimeout(() => { setView('login'); setForgotEmail(''); }, 2500);
    } catch (err) {
      console.error('EmailJS error:', err);
      showToast('Failed to send email. Please check your EmailJS setup.');
    } finally {
      setIsSendingReset(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-end"
      style={{ background: 'rgba(0,0,0,0.35)' }}
      onClick={onClose}
    >
      <div
        className="relative bg-white w-full max-w-sm h-full overflow-y-auto shadow-2xl px-8 py-10 flex flex-col gap-5"
        onClick={e => e.stopPropagation()}
      >
        {/* Toast */}
        {toast && (
          <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[300] bg-slate-900 text-white text-sm font-medium px-5 py-3 rounded-xl shadow-xl animate-pulse">
            {toast}
          </div>
        )}

        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* ── Facebook: OAuth-style "Continue as [Name]?" overlay ── */}
        {fbStep === 'confirm' && (
          <div className="absolute inset-0 z-[10] flex flex-col bg-white overflow-y-auto">
            {/* FB top bar with profile */}
            <div
              className="flex items-center justify-between px-4 py-3 border-b"
              style={{ borderColor: '#e4e6eb' }}
            >
              {/* Facebook logo */}
              <svg viewBox="0 0 36 36" className="w-9 h-9" fill="#1877F2">
                <path d="M20.181 35.87C29.094 34.791 36 27.202 36 18c0-9.941-8.059-18-18-18S0 8.059 0 18c0 8.442 5.811 15.526 13.652 17.471L14 34h5.5l.681 1.87z" />
                <path fill="#fff" d="M13.651 35.471v-11.97H9.936V18h3.715v-2.37c0-6.127 2.772-8.964 8.784-8.964 1.138 0 3.103.223 3.91.446v4.983c-.425-.043-1.167-.065-2.081-.065-2.952 0-4.09 1.116-4.09 4.025V18h5.883l-1.008 5.501h-4.875v12.37a18.183 18.183 0 01-6.523-.4z" />
              </svg>

              {/* Profile chip — shown when FB account detected */}
              {fbLoading ? (
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  Loading account…
                </div>
              ) : fbProfile ? (
                <div className="flex items-center gap-2">
                  {fbProfile.picture ? (
                    <img src={fbProfile.picture} alt={fbProfile.name} className="w-8 h-8 rounded-full object-cover border-2 border-white shadow" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm">
                      {fbProfile.name[0]}
                    </div>
                  )}
                  <span className="text-sm font-semibold text-slate-800">{fbProfile.name}</span>
                </div>
              ) : null}
            </div>

            {/* Main card */}
            <div className="flex-1 flex flex-col px-5 py-6 gap-5">
              {/* Logos: FB ↔ App */}
              <div className="flex items-center gap-3 justify-center">
                <svg viewBox="0 0 36 36" className="w-10 h-10" fill="#1877F2">
                  <path d="M20.181 35.87C29.094 34.791 36 27.202 36 18c0-9.941-8.059-18-18-18S0 8.059 0 18c0 8.442 5.811 15.526 13.652 17.471L14 34h5.5l.681 1.87z" />
                  <path fill="#fff" d="M13.651 35.471v-11.97H9.936V18h3.715v-2.37c0-6.127 2.772-8.964 8.784-8.964 1.138 0 3.103.223 3.91.446v4.983c-.425-.043-1.167-.065-2.081-.065-2.952 0-4.09 1.116-4.09 4.025V18h5.883l-1.008 5.501h-4.875v12.37a18.183 18.183 0 01-6.523-.4z" />
                </svg>
                {/* swap arrows */}
                <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
                </svg>
                {/* BeautifyAI logo mark */}
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center shadow">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
              </div>

              <div className="border-b" style={{ borderColor: '#e4e6eb' }} />

              {/* Access request */}
              <div>
                <p className="text-base font-bold text-slate-900 mb-3">
                  <span className="text-violet-700">BeautifyAI</span> is requesting access to:
                </p>
                <ul className="space-y-2">
                  {['Name and profile picture', 'Email address'].map(item => (
                    <li key={item} className="flex items-center gap-2 text-sm text-slate-700">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-500 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
                <button className="mt-3 text-sm font-semibold text-blue-600 hover:underline">
                  Edit access
                </button>
              </div>

              <div className="border-b" style={{ borderColor: '#e4e6eb' }} />

              {/* Action buttons */}
              <div className="flex flex-col gap-3 mt-auto">
                <button
                  onClick={handleFbContinue}
                  className="w-full py-3 rounded-lg font-bold text-white text-sm transition-all hover:opacity-90 active:scale-95"
                  style={{ background: '#1877F2' }}
                >
                  {fbProfile
                    ? `Continue as ${fbProfile.name.split(' ')[0]}`
                    : 'Continue with Facebook'}
                </button>
                <button
                  onClick={handleFbCancel}
                  className="w-full py-3 rounded-lg font-semibold text-slate-800 text-sm border border-slate-300 hover:bg-slate-50 transition-all active:scale-95"
                  style={{ background: '#f0f2f5' }}
                >
                  Cancel
                </button>
              </div>

              {/* Fine print */}
              <p className="text-xs text-slate-500 text-center leading-relaxed">
                By continuing, BeautifyAI will receive ongoing access to the
                information you share and Meta will record when BeautifyAI
                accesses it.{' '}
                <a href="#" className="text-blue-600 hover:underline">Learn more</a>{' '}
                about this sharing and the settings that you have.
              </p>
              <p className="text-xs text-slate-400 text-center">
                BeautifyAI's{' '}
                <a href="#" className="text-blue-600 hover:underline">Privacy Policy</a>{' '}
                and{' '}
                <a href="#" className="text-blue-600 hover:underline">Terms of Service</a>
              </p>
            </div>
          </div>
        )}

        {/* ── Facebook: manual username + password form overlay ── */}
        {fbStep === 'manual' && (
          <div className="absolute inset-0 z-[10] flex items-center justify-center bg-white/95 backdrop-blur-sm">
            <div className="w-full max-w-xs mx-auto px-6 py-8 flex flex-col gap-5">
              {/* header */}
              <div className="flex items-center gap-3 mb-1">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow" style={{ background: '#1877F2' }}>
                  <span className="text-white font-black text-xl leading-none">f</span>
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-medium">Sign in with</p>
                  <p className="font-bold text-slate-900" style={{ fontFamily: 'Outfit, sans-serif' }}>Facebook</p>
                </div>
                <button
                  onClick={() => setFbStep('none')}
                  className="ml-auto w-7 h-7 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Username */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Email or Phone</label>
                <input
                  type="text"
                  value={fbUser}
                  onChange={e => setFbUser(e.target.value)}
                  placeholder="Email or phone number"
                  className="w-full border-b-2 border-slate-200 focus:border-blue-500 outline-none py-2 text-sm text-slate-800 placeholder-slate-400 bg-transparent transition-colors"
                />
              </div>

              {/* Password */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Password</label>
                <div className="relative">
                  <input
                    type={fbShowPwd ? 'text' : 'password'}
                    value={fbPass}
                    onChange={e => setFbPass(e.target.value)}
                    placeholder="Facebook password"
                    className="w-full border-b-2 border-slate-200 focus:border-blue-500 outline-none py-2 text-sm text-slate-800 placeholder-slate-400 bg-transparent pr-8 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setFbShowPwd(!fbShowPwd)}
                    className="absolute right-0 top-2 text-slate-400 hover:text-slate-600"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      {fbShowPwd
                        ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 4.411m0 0L21 21" />
                        : <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></>
                      }
                    </svg>
                  </button>
                </div>
              </div>

              {/* Login button */}
              <button
                onClick={handleFbLogin}
                className="w-full py-3 rounded-xl font-bold text-white text-sm transition-all hover:opacity-90 active:scale-95 shadow-lg mt-1"
                style={{ background: '#1877F2' }}
              >
                Log in with Facebook
              </button>

              <button
                onClick={() => setFbStep('confirm')}
                className="text-xs text-slate-400 hover:text-slate-600 text-center underline underline-offset-2 transition-colors"
              >
                ← Back
              </button>
            </div>
          </div>
        )}

        {/* Logo — always shown */}
        <div className="flex items-center gap-2 mb-1">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center shadow">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <span className="font-extrabold text-lg text-slate-900" style={{ fontFamily: 'Outfit, sans-serif' }}>
            Beautify<span className="text-violet-600">AI</span>
          </span>
        </div>

        {view === 'login' ? (
          /* ══════════ LOGIN VIEW ══════════ */
          <>
            <h2 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Outfit, sans-serif' }}>
              Log in to BeautifyAI
            </h2>

            {/* Social login */}
            <div>
              <p className="text-sm text-slate-400 mb-3">Log in with:</p>
              <div className="flex gap-3">
                {[
                  { label: 'G', color: '#EA4335', border: '#ddd', title: 'Google' },
                  { label: 'f', color: '#1877F2', border: '#ddd', title: 'Facebook' },
                  { label: '𝕏', color: '#000', border: '#ddd', title: 'X' },
                  { label: '', color: '#000', border: '#ddd', title: 'Apple', isApple: true },
                ].map(({ label, color, border, title, isApple }) => (
                  <button
                    key={title}
                    title={title}
                    onClick={() => handleSocial(title)}
                    className="flex-1 h-11 rounded-full border flex items-center justify-center font-bold text-base transition-all hover:shadow-md active:scale-95"
                    style={{ borderColor: border, color }}
                  >
                    {isApple ? (
                      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
                        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                      </svg>
                    ) : label}
                  </button>
                ))}
              </div>
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-slate-200" />
              <span className="text-sm text-slate-400">or</span>
              <div className="flex-1 h-px bg-slate-200" />
            </div>

            {/* Email */}
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Email address"
              className="w-full border-b border-slate-300 focus:border-violet-600 outline-none py-2 text-base text-slate-800 placeholder-slate-400 bg-transparent transition-colors"
            />

            {/* Password */}
            <div className="relative">
              <input
                type={showPwd ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full border-b border-violet-500 focus:border-violet-700 outline-none py-2 text-base text-slate-800 placeholder-slate-400 bg-transparent pr-8 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPwd(!showPwd)}
                className="absolute right-0 top-2 text-slate-400 hover:text-slate-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {showPwd
                    ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 4.411m0 0L21 21" />
                    : <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></>
                  }
                </svg>
              </button>
            </div>

            {/* Keep logged in */}
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={keepMe}
                onChange={e => setKeepMe(e.target.checked)}
                className="w-4 h-4 accent-violet-600 rounded"
              />
              <span className="text-sm text-slate-700">Keep me logged in</span>
            </label>

            {/* Log in button */}
            <button
              onClick={handleLogin}
              className="w-full py-3.5 rounded-xl font-bold text-base text-white transition-all duration-200 hover:opacity-90 hover:-translate-y-0.5 shadow-lg active:scale-95"
              style={{ background: 'linear-gradient(135deg, #6d28d9, #2563eb)' }}
            >
              Log in
            </button>

            <p className="text-sm text-slate-700 text-center">
              Don't have an account?{' '}
              <button
                onClick={() => { setView('signup'); setSignupName(''); setSignupEmail(''); setSignupPwd(''); setSignupPwd2(''); }}
                className="text-violet-600 font-semibold hover:underline"
              >
                Create account
              </button>
            </p>
            <button
              onClick={() => { setView('forgot'); setForgotEmail(''); }}
              className="text-sm text-violet-600 hover:underline text-center"
            >
              Forgot your password?
            </button>
          </>
        ) : view === 'signup' ? (
          /* ══════════ SIGNUP VIEW ══════════ */
          <>
            <h2 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Outfit, sans-serif' }}>
              Create account
            </h2>

            {/* Email */}
            <input
              type="email"
              value={signupEmail}
              onChange={e => setSignupEmail(e.target.value)}
              placeholder="Email address"
              className="w-full border-b border-slate-300 focus:border-violet-600 outline-none py-2 text-base text-slate-800 placeholder-slate-400 bg-transparent transition-colors"
            />

            {/* Password */}
            <div className="relative">
              <input
                type={signupShowPwd ? 'text' : 'password'}
                value={signupPwd}
                onChange={e => setSignupPwd(e.target.value)}
                placeholder="Password (min 8 characters)"
                className="w-full border-b border-violet-400 focus:border-violet-700 outline-none py-2 text-base text-slate-800 placeholder-slate-400 bg-transparent pr-8 transition-colors"
              />
              <button type="button" onClick={() => setSignupShowPwd(!signupShowPwd)} className="absolute right-0 top-2 text-slate-400 hover:text-slate-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {signupShowPwd
                    ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 4.411m0 0L21 21" />
                    : <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></>}
                </svg>
              </button>
            </div>

            {/* Create button */}
            <button
              onClick={handleSignup}
              className="w-full py-3.5 rounded-xl font-bold text-base text-white transition-all duration-200 hover:opacity-90 hover:-translate-y-0.5 shadow-lg active:scale-95"
              style={{ background: 'linear-gradient(135deg, #6d28d9, #2563eb)' }}
            >
              Create account
            </button>

            <p className="text-sm text-slate-700 text-center">
              Already have an account?{' '}
              <button onClick={() => setView('login')} className="text-violet-600 font-semibold hover:underline">
                Log in
              </button>
            </p>
          </>
        ) : view === 'success' ? (
          /* ══════════ ACCOUNT CREATED SUCCESS VIEW ══════════ */
          <>
            {/* Success icon */}
            <div className="flex flex-col items-center text-center gap-4 py-4">
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center shadow-lg"
                style={{ background: 'linear-gradient(135deg, #6d28d9, #2563eb)' }}
              >
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>

              <h2 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Outfit, sans-serif' }}>
                Account Created! 🎉
              </h2>

              <p className="text-sm text-slate-500 leading-relaxed max-w-xs">
                Your BeautifyAI account has been successfully created for{' '}
                <span className="font-semibold text-violet-600">{signupEmail}</span>.
                <br />
                Please log in to get started.
              </p>

              {/* Go to Login */}
              <button
                onClick={() => {
                  setView('login');
                  setEmail(signupEmail);
                  setPassword('');
                  setSignupEmail('');
                  setSignupPwd('');
                }}
                className="w-full py-3.5 rounded-xl font-bold text-base text-white transition-all duration-200 hover:opacity-90 hover:-translate-y-0.5 shadow-lg active:scale-95 mt-2"
                style={{ background: 'linear-gradient(135deg, #6d28d9, #2563eb)' }}
              >
                Go to Login
              </button>

              <p className="text-xs text-slate-400">
                Already remembered?{' '}
                <button
                  onClick={() => setView('login')}
                  className="text-violet-500 hover:underline font-medium"
                >
                  Log in now
                </button>
              </p>
            </div>
          </>
        ) : (
          /* ══════════ FORGOT PASSWORD VIEW ══════════ */
          <>
            {/* Back arrow */}
            <button
              onClick={() => setView('login')}
              className="flex items-center gap-1 text-sm text-slate-500 hover:text-violet-600 transition-colors -mb-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Back to log in
            </button>

            <h2 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Outfit, sans-serif' }}>
              Reset password
            </h2>

            <p className="text-sm text-slate-500 leading-relaxed -mt-2">
              Enter your account email and we'll send you a link to reset your password.
            </p>

            {/* Email field */}
            <input
              type="email"
              value={forgotEmail}
              onChange={e => setForgotEmail(e.target.value)}
              placeholder="Email address"
              className="w-full border-b border-slate-300 focus:border-violet-600 outline-none py-2 text-base text-slate-800 placeholder-slate-400 bg-transparent transition-colors"
            />

            {/* Send button */}
            <button
              onClick={handleForgotPassword}
              disabled={isSendingReset}
              className="w-full py-3.5 rounded-xl font-bold text-base text-white transition-all duration-200 hover:opacity-90 hover:-translate-y-0.5 shadow-lg active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              style={{ background: 'linear-gradient(135deg, #6d28d9, #2563eb)' }}
            >
              {isSendingReset ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Sending…
                </>
              ) : 'Send reset link'}
            </button>

            <p className="text-sm text-slate-700 text-center">
              Remembered it?{' '}
              <button onClick={() => setView('login')} className="text-violet-600 font-semibold hover:underline">
                Log in
              </button>
            </p>
          </>
        )}
      </div>
    </div>
  );
}



/* ─────────────────────────────────────────────
   Navbar
───────────────────────────────────────────── */
function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userInitial, setUserInitial] = useState('U');
  const [userEmail, setUserEmail] = useState('');
  const [userPicture, setUserPicture] = useState('');
  const [userName, setUserName] = useState('');
  const [showUserMenu, setShowUserMenu] = useState(false);

  useEffect(() => {
    const onShow = () => setShowLogin(true);
    window.addEventListener('show_login_modal', onShow);
    
    // Restore session if available
    const saved = localStorage.getItem('beautifyai_session') || sessionStorage.getItem('beautifyai_session');
    if (saved) {
      try {
        const profile = JSON.parse(saved);
        setIsLoggedIn(true);
        window.IS_LOGGED_IN = true;
        setUserEmail(profile.email || '');
        setUserName(profile.name || '');
        setUserPicture(profile.picture || '');
        setUserInitial(profile.initial || 'U');
      } catch(e) {}
    }
    
    return () => window.removeEventListener('show_login_modal', onShow);
  }, []);

  const handleLogin = (email, picture, name, keepMe = true) => {
    const initial = (name || email || 'U')[0].toUpperCase();
    setIsLoggedIn(true);
    window.IS_LOGGED_IN = true;
    setUserEmail(email || '');
    setUserName(name || '');
    setUserPicture(picture || '');
    setUserInitial(initial);
    setShowLogin(false);
    
    if (keepMe) {
      localStorage.setItem('beautifyai_session', JSON.stringify({ email: email || '', name: name || '', picture: picture || '', initial }));
      sessionStorage.removeItem('beautifyai_session');
    } else {
      sessionStorage.setItem('beautifyai_session', JSON.stringify({ email: email || '', name: name || '', picture: picture || '', initial }));
      localStorage.removeItem('beautifyai_session');
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    window.IS_LOGGED_IN = false;
    setUserInitial('U');
    setUserEmail('');
    setUserPicture('');
    setUserName('');
    setShowUserMenu(false);
    localStorage.removeItem('beautifyai_session');
    sessionStorage.removeItem('beautifyai_session');
  };

  // ── Detect Google OAuth redirect (token in URL hash) ──
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes('access_token=')) {
      const params = new URLSearchParams(hash.replace(/^#/, ''));
      const accessToken = params.get('access_token');
      if (accessToken) {
        // Clean the token from the URL immediately
        window.history.replaceState(null, '', window.location.pathname);
        // Fetch the Google user info with the access token
        fetch(`https://www.googleapis.com/oauth2/v3/userinfo?access_token=${accessToken}`)
          .then(r => r.json())
          .then(profile => {
            handleLogin(profile.email, profile.picture, profile.name || profile.given_name);
          })
          .catch(() => {
            handleLogin('', '', 'Google User');
          });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const links = ['Features', 'How It Works', 'Technology', 'About'];

  return (
    <>
      {showLogin && <LoginModal onClose={() => setShowLogin(false)} onLogin={handleLogin} />}

      <nav className="fixed top-0 inset-x-0 z-50 bg-white border-b border-slate-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-8 py-4 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center shadow-lg">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="font-extrabold text-2xl text-slate-900 tracking-tight" style={{ fontFamily: 'Outfit, sans-serif' }}>
              Beautify<span className="text-violet-600">AI</span>
            </span>
          </div>

          {/* Desktop Links */}
          <div className="hidden md:flex items-center gap-8">
            {links.map(link => (
              <a
                key={link}
                href={`#${link.toLowerCase().replace(/\s+/g, '-')}`}
                className="text-slate-700 hover:text-violet-600 text-base font-medium transition-colors duration-200"
              >
                {link}
              </a>
            ))}
            {isLoggedIn ? (
              <div className="relative">
                {/* Avatar button — shows Google photo or purple initial */}
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="w-10 h-10 rounded-full overflow-hidden shadow-lg hover:scale-105 active:scale-95 transition-transform border-2 border-white ring-2 ring-violet-400"
                  title={userEmail}
                >
                  {userPicture ? (
                    <img src={userPicture} alt={userName || userEmail} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <span
                      className="w-full h-full flex items-center justify-center font-bold text-white text-base"
                      style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)' }}
                    >
                      {userInitial}
                    </span>
                  )}
                </button>

                {/* Dropdown */}
                {showUserMenu && (
                  <div
                    className="absolute right-0 top-12 w-60 bg-white rounded-2xl shadow-2xl border border-slate-100 py-2 z-[999] overflow-hidden"
                    onMouseLeave={() => setShowUserMenu(false)}
                  >
                    <div className="px-4 py-3 border-b border-slate-100">
                      <div className="flex items-center gap-3">
                        {/* Avatar in dropdown */}
                        <div className="w-10 h-10 rounded-full overflow-hidden shrink-0 ring-2 ring-violet-300">
                          {userPicture ? (
                            <img src={userPicture} alt={userName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <span
                              className="w-full h-full flex items-center justify-center font-bold text-white text-sm"
                              style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)' }}
                            >
                              {userInitial}
                            </span>
                          )}
                        </div>
                        <div className="min-w-0">
                          {userName && <p className="text-sm font-bold text-slate-900 truncate">{userName}</p>}
                          <p className="text-xs text-slate-500 truncate">{userEmail || 'User'}</p>
                          <p className="text-xs text-violet-500 font-medium">Logged in</p>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors text-left"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      Log out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={() => setShowLogin(true)}
                className="text-base font-semibold px-5 py-2.5 rounded-xl border-2 border-violet-600 text-violet-600 hover:bg-violet-600 hover:text-white transition-all duration-200 hover:-translate-y-0.5"
              >
                Login
              </button>
            )}
            <a
              href="#upload-page"
              onClick={(e) => { if (!window.IS_LOGGED_IN) { e.preventDefault(); window.dispatchEvent(new Event('show_login_modal')); } }}
              className="bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 text-white text-base font-semibold px-5 py-2.5 rounded-xl transition-all duration-200 shadow-lg hover:shadow-violet-500/30 hover:-translate-y-0.5"
            >
              Get Started
            </a>
          </div>

          {/* Mobile Menu */}
          <button className="md:hidden text-slate-700" onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <X /> : <Menu />}
          </button>
        </div>

        {/* Mobile Dropdown */}
        {menuOpen && (
          <div className="md:hidden bg-slate-50 border-t border-slate-200 px-6 py-4 flex flex-col gap-4">
            {links.map(link => (
              <a
                key={link}
                href={`#${link.toLowerCase().replace(/\s+/g, '-')}`}
                className="text-slate-700 hover:text-violet-600 text-base font-medium"
                onClick={() => setMenuOpen(false)}
              >
                {link}
              </a>
            ))}
            {isLoggedIn ? (
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-white text-sm"
                  style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)' }}
                >
                  {userInitial}
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-slate-800 truncate max-w-[160px]">{userEmail}</span>
                  <button onClick={handleLogout} className="text-xs text-red-500 text-left hover:underline">Log out</button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => { setMenuOpen(false); setShowLogin(true); }}
                className="text-base font-semibold px-5 py-2.5 rounded-xl border-2 border-violet-600 text-violet-600 text-center"
              >
                Login
              </button>
            )}
            <a
              href="#upload-page"
              className="bg-gradient-to-r from-violet-600 to-blue-600 text-white text-base font-semibold px-5 py-2.5 rounded-xl text-center"
              onClick={(e) => { if (!window.IS_LOGGED_IN) { e.preventDefault(); window.dispatchEvent(new Event('show_login_modal')); } setMenuOpen(false); }}
            >
              Get Started
            </a>
          </div>
        )}
      </nav>
    </>
  );
}


/* ─────────────────────────────────────────────
   Elevated Beauty Section (Before / After Slider)
   - Auto-animates left ↔ right in a 5s loop via requestAnimationFrame
   - On hover/touch: pauses auto-animation; slider tracks cursor/finger X
   - On leave: resumes from current position (no reset)
   - Uses refs for all high-frequency updates — zero re-renders during motion
───────────────────────────────────────────── */
function ElevatedBeautySection() {
  const containerRef      = useRef(null);
  const beforeContainerRef = useRef(null);
  const beforeImgRef      = useRef(null);
  const dividerRef        = useRef(null);
  const handleRef         = useRef(null);
  const tooltipRef        = useRef(null);

  // Animation state stored in refs to avoid triggering re-renders
  const pctRef       = useRef(50);   // current slider position (0–100)
  const dirRef       = useRef(1);    // 1 = moving right, -1 = moving left
  const hoveringRef  = useRef(false);
  const rafRef       = useRef(null);
  const lastTimeRef  = useRef(null);

  /** Directly paint the slider to DOM — no setState, no re-render */
  const applyPct = useCallback((pct) => {
    const p = Math.max(0, Math.min(pct, 100));
    pctRef.current = p;

    if (beforeContainerRef.current)
      beforeContainerRef.current.style.width = `${p}%`;

    if (beforeImgRef.current) {
      // Counter-scale the inner image so it doesn't stretch
      const safePct = p < 0.01 ? 0.01 : p;
      beforeImgRef.current.style.width = `${10000 / safePct}%`;
    }

    if (dividerRef.current)
      dividerRef.current.style.left = `${p}%`;

    if (handleRef.current)
      handleRef.current.style.left = `${p}%`;
  }, []);

  /** rAF loop — runs every frame but only moves slider when not hovering */
  const tick = useCallback((time) => {
    if (lastTimeRef.current != null && !hoveringRef.current) {
      const dt = time - lastTimeRef.current;
      // 5 000 ms per full 0→100 sweep → 0.02 % per ms
      const SPEED = 0.02;
      let next = pctRef.current + SPEED * dt * dirRef.current;

      if (next >= 100) { next = 100; dirRef.current = -1; }
      else if (next <= 0) { next = 0; dirRef.current = 1; }

      applyPct(next);
    }
    lastTimeRef.current = time;
    rafRef.current = requestAnimationFrame(tick);
  }, [applyPct]);

  // Mount: start the loop; unmount: clean up
  useEffect(() => {
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [tick]);

  /** Translate a clientX to a slider percentage and apply it */
  const followPointer = useCallback((clientX) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    applyPct((x / rect.width) * 100);
  }, [applyPct]);

  const onEnter = useCallback(() => {
    hoveringRef.current = true;
    // Fade out the tooltip permanently once the user interacts
    if (tooltipRef.current) tooltipRef.current.style.opacity = '0';
  }, []);

  const onLeave = useCallback(() => {
    hoveringRef.current = false;
    // Reset the clock so the animation doesn't lurch from accumulated time
    lastTimeRef.current = performance.now();
  }, []);

  const BEFORE_URL = '/beauty-model-before.jpg';
  const AFTER_URL  = '/beauty-model.jpg';

  return (
    <section
      style={{ background: '#ede8df' }}
      className="pt-28 pb-16 pl-6 md:pl-12 pr-0 overflow-hidden"
    >
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center gap-8">

        {/* ── Left: copy ── */}
        <div className="flex-1 max-w-lg">
          <h2
            className="text-4xl md:text-5xl font-extrabold leading-tight mb-5"
            style={{ fontFamily: 'Outfit, sans-serif', color: '#1a3830' }}
          >
            Elevated Beauty<br />Refined by AI
          </h2>

          <p className="text-base md:text-lg leading-relaxed mb-8" style={{ color: '#4a6560' }}>
            Experience the pinnacle of digital retouching. Our sophisticated AI brings
            out your natural elegance with unparalleled precision and grace.
          </p>

          <div className="flex items-center gap-6 flex-wrap">
            <a
              href="#upload-page"
              onClick={(e) => {
                if (!window.IS_LOGGED_IN) {
                  e.preventDefault();
                  window.dispatchEvent(new Event('show_login_modal'));
                }
              }}
              className="inline-flex items-center gap-2 font-bold text-sm tracking-widest text-white px-8 py-4 rounded-full transition-all duration-300 hover:opacity-90 hover:-translate-y-0.5 shadow-lg"
              style={{ background: '#1a3830', letterSpacing: '0.12em' }}
            >
              EXPOSE YOUR RADIANCE
            </a>
          </div>
        </div>

        {/* ── Right: before / after slider ── */}
        <div className="flex-1 flex justify-end">
          <div
            ref={containerRef}
            /* Mouse: follow cursor without any dragging required */
            onMouseEnter={onEnter}
            onMouseLeave={onLeave}
            onMouseMove={(e) => followPointer(e.clientX)}
            /* Touch: follow finger position */
            onTouchStart={(e) => { onEnter(); followPointer(e.touches[0].clientX); }}
            onTouchMove={(e) => followPointer(e.touches[0].clientX)}
            onTouchEnd={onLeave}
            className="relative select-none overflow-hidden rounded-3xl shadow-2xl cursor-ew-resize"
            style={{ width: '100%', maxWidth: '520px', aspectRatio: '3/4' }}
          >
            {/* AFTER — full-size background (beautified) */}
            <img
              src={AFTER_URL}
              alt="After AI beautification"
              className="absolute inset-0 w-full h-full object-cover"
              draggable={false}
            />

            {/* BEFORE — clipped to the left of the divider */}
            <div
              ref={beforeContainerRef}
              className="absolute inset-0 overflow-hidden"
              style={{ width: '50%' }}          /* initial = 50%, driven by applyPct */
            >
              <img
                ref={beforeImgRef}
                src={BEFORE_URL}
                alt="Before AI beautification"
                className="absolute inset-0 h-full object-cover"
                style={{ width: '200%', maxWidth: 'none' }}  /* counter-scale */
                draggable={false}
              />
            </div>

            {/* Labels */}
            <span
              className="absolute top-3 left-4 text-xs font-bold tracking-widest px-2 py-0.5 rounded pointer-events-none z-10"
              style={{ color: '#1a3830', background: 'rgba(255,255,255,0.7)' }}
            >
              BEFORE
            </span>
            <span
              className="absolute top-3 right-4 text-xs font-bold tracking-widest px-2 py-0.5 rounded pointer-events-none z-10"
              style={{ color: '#fff', background: 'rgba(26,56,48,0.65)' }}
            >
              AFTER
            </span>

            {/* Divider line */}
            <div
              ref={dividerRef}
              className="absolute inset-y-0 w-0.5 pointer-events-none z-10"
              style={{ left: '50%', background: '#c9a84c' }}
            />

            {/* Handle knob */}
            <div
              ref={handleRef}
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-9 h-9 rounded-full bg-white shadow-xl flex items-center justify-center pointer-events-none z-20"
              style={{ left: '50%', color: '#1a3830', fontSize: '10px' }}
            >
              ◂▸
            </div>

            {/* "Hover to reveal" tooltip — fades out after first interaction */}
            <div
              ref={tooltipRef}
              className="absolute inset-0 flex items-center justify-center pointer-events-none z-30"
              style={{ transition: 'opacity 0.4s ease' }}
            >
              <span
                className="text-xs font-semibold px-3 py-1.5 rounded-full shadow"
                style={{ background: 'rgba(255,255,255,0.85)', color: '#1a3830' }}
              >
                Hover / Swipe to reveal
              </span>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   Hero Section
───────────────────────────────────────────── */
function HeroSection() {
  return (
    <section
      id="hero"
      className="relative min-h-screen flex items-center justify-center overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #f8f7ff 0%, #ede9fe 30%, #e0e7ff 60%, #f0f9ff 100%)'
      }}
    >
      {/* Animated glowing orbs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute -top-40 -left-40 w-96 h-96 rounded-full blur-3xl opacity-30"
          style={{ background: 'radial-gradient(circle, #7c3aed, transparent)' }}
        />
        <div
          className="absolute top-1/4 right-0 w-80 h-80 rounded-full blur-3xl opacity-15"
          style={{ background: 'radial-gradient(circle, #3b82f6, transparent)' }}
        />
        <div
          className="absolute bottom-0 left-1/3 w-72 h-72 rounded-full blur-3xl opacity-10"
          style={{ background: 'radial-gradient(circle, #a855f7, transparent)' }}
        />
        <div
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: 'linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)',
            backgroundSize: '60px 60px'
          }}
        />
      </div>

      {/* Floating badge */}
      <div className="absolute top-32 left-1/2 -translate-x-1/2 bg-violet-100 border border-violet-300 text-violet-700 text-xs font-semibold px-4 py-1.5 rounded-full flex items-center gap-2 animate-pulse">
        <Star className="w-3 h-3" />
        FIBGAN-Based Deep Learning Architecture
      </div>

      {/* Main content */}
      <div className="relative z-10 text-center max-w-5xl mx-auto px-6 pt-24 pb-12">
        <h1
          className="text-7xl md:text-8xl lg:text-9xl font-black tracking-tight mb-6 leading-none"
          style={{
            fontFamily: 'Outfit, sans-serif',
            background: 'linear-gradient(135deg, #1a202c 0%, #2d3748 40%, #2c5282 80%, #1a202c 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            textShadow: 'none',
          }}
        >
          BEAUTIFY<span style={{ WebkitTextFillColor: '#7c3aed' }}>AI</span>
        </h1>

        <p
          className="text-xl md:text-2xl font-semibold text-slate-700 mb-6 tracking-wide"
          style={{ fontFamily: 'Outfit, sans-serif' }}
        >
          AI-Powered Multi-Intensity Facial Beautification using FIBGAN
        </p>

        <p className="text-base md:text-lg text-slate-500 max-w-2xl mx-auto mb-12 leading-relaxed">
          Our system generates <span className="text-violet-600 font-medium">multiple beautified versions</span> of your
          face image at varying intensity levels — all while preserving your unique identity, skin texture, and natural
          features through advanced feature pyramid and style-vector control.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <a
            id="upload"
            href="#upload-page"
            onClick={(e) => { if (!window.IS_LOGGED_IN) { e.preventDefault(); window.dispatchEvent(new Event('show_login_modal')); } }}
            className="group flex items-center gap-3 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 text-white font-bold px-8 py-4 rounded-2xl text-base transition-all duration-300 shadow-2xl hover:shadow-violet-500/40 hover:-translate-y-1"
          >
            <Upload className="w-5 h-5 group-hover:scale-110 transition-transform" />
            Upload Image
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </a>

          <a
            href="#features"
            className="flex items-center gap-3 bg-slate-100 hover:bg-slate-200 border border-slate-300 hover:border-violet-400/50 text-slate-700 font-semibold px-8 py-4 rounded-2xl text-base transition-all duration-300 hover:-translate-y-1"
          >
            <Brain className="w-5 h-5 text-violet-400" />
            Learn More
          </a>
        </div>

        {/* Stats row */}
        <div className="mt-16 grid grid-cols-3 gap-6 max-w-lg mx-auto">
          {[
            { value: '5+', label: 'Intensity Levels' },
            { value: 'GAN', label: 'Architecture' },
            { value: '99%', label: 'Identity Preserved' },
          ].map(stat => (
            <div key={stat.label} className="flex flex-col items-center gap-1">
              <span className="text-2xl font-black text-violet-700" style={{ fontFamily: 'Outfit, sans-serif' }}>
                {stat.value}
              </span>
              <span className="text-xs text-slate-500 font-medium">{stat.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Scroll cue */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-slate-400 flex flex-col items-center gap-1 animate-bounce">
        <span className="text-xs font-medium">Scroll</span>
        <ChevronDown className="w-4 h-4" />
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   Features Section
───────────────────────────────────────────── */
const features = [
  {
    icon: Shield,
    color: 'from-violet-500 to-purple-700',
    glow: 'violet',
    title: 'Identity-Preserving Beautification',
    description:
      'Our FIBGAN model maintains facial structure, identity cues, and micro-expressions throughout the beautification process. No uncanny valley — just a naturally enhanced you.',
    bullets: ['Landmark-aware processing', 'Perceptual similarity loss', 'ID-vector anchoring'],
  },
  {
    icon: Sliders,
    color: 'from-blue-500 to-cyan-600',
    glow: 'blue',
    title: 'Multi-Intensity Style Control',
    description:
      'Generate a spectrum of beautified outputs — from a subtle refresh to a dramatic transformation — without rerunning the model. One inference, infinite possibilities.',
    bullets: ['Continuous style interpolation', 'Single-pass multi-output', 'User-adjustable intensity slider'],
  },
  {
    icon: Zap,
    color: 'from-pink-500 to-rose-600',
    glow: 'pink',
    title: 'Weight Demodulation for Artifact Reduction',
    description:
      'StyleGAN2-inspired weight demodulation eliminates checkerboard artifacts and water droplet distortions common in early GANs, delivering sharp, photorealistic results.',
    bullets: ['No checkerboard artifacts', 'Sharp edge fidelity', 'High-res output support'],
  },
];

function FeaturesSection() {
  return (
    <section id="features" className="py-24 px-6" style={{ background: '#ffffff' }}>
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <span className="text-violet-600 text-sm font-semibold uppercase tracking-widest">Core Capabilities</span>
          <h2
            className="text-4xl md:text-5xl font-black text-slate-900 mt-3 mb-4"
            style={{ fontFamily: 'Outfit, sans-serif' }}
          >
            What Makes BeautifyAI <span className="text-violet-600">Different</span>
          </h2>
          <p className="text-slate-500 max-w-2xl mx-auto text-base">
            Three pillars of innovation that set our FIBGAN architecture apart from conventional beautification systems.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {features.map(({ icon: Icon, color, glow, title, description, bullets }) => (
            <div
              key={title}
              className="group relative bg-white border border-slate-200 hover:border-violet-300 rounded-3xl p-8 transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl cursor-pointer overflow-hidden"
              style={{ ['--tw-shadow-color']: `var(--color-${glow}-500)` }}
            >
              <div className={`absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-500 rounded-3xl bg-gradient-to-br ${color}`} />

              <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${color} flex items-center justify-center mb-6 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                <Icon className="w-7 h-7 text-white" />
              </div>

              <h3 className="text-xl font-bold text-slate-900 mb-3" style={{ fontFamily: 'Outfit, sans-serif' }}>
                {title}
              </h3>
              <p className="text-slate-500 text-sm leading-relaxed mb-5">{description}</p>

              <ul className="space-y-2">
                {bullets.map(b => (
                  <li key={b} className="flex items-center gap-2 text-xs text-slate-600">
                    <Check className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   How It Works
───────────────────────────────────────────── */
const steps = [
  {
    number: '01',
    icon: Camera,
    color: '#7c3aed',
    title: 'Upload Image',
    description:
      'Provide a clear frontal or near-frontal face image. Supports JPG, PNG, and WEBP formats up to 10 MB. Preprocessing handles lighting normalisation automatically.',
  },
  {
    number: '02',
    icon: Sliders,
    color: '#2563eb',
    title: 'Select Beautification Intensity',
    description:
      'Choose from multiple preset intensity levels (Subtle, Moderate, Vivid, Dramatic) or drag the slider to pinpoint your desired aesthetic transformation.',
  },
  {
    number: '03',
    icon: Wand2,
    color: '#9333ea',
    title: 'Generate Results',
    description:
      'FIBGAN processes your image through its Feature-Instance Normalization pipeline and produces all intensity variants in a single forward pass for maximum efficiency.',
  },
  {
    number: '04',
    icon: Download,
    color: '#0891b2',
    title: 'Download Enhanced Image',
    description:
      'Preview all output variants side-by-side, pick your favourite, and export in high-resolution PNG or JPEG. Batch export is also supported.',
  },
];

function HowItWorksSection() {
  return (
    <section id="how-it-works" className="py-24 px-6" style={{ background: '#f8fafc' }}>
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <span className="text-blue-600 text-sm font-semibold uppercase tracking-widest">Workflow</span>
          <h2
            className="text-4xl md:text-5xl font-black text-slate-900 mt-3 mb-4"
            style={{ fontFamily: 'Outfit, sans-serif' }}
          >
            How It <span className="text-blue-600">Works</span>
          </h2>
          <p className="text-slate-500 max-w-xl mx-auto text-base">
            From raw photo to beautiful output — four seamless steps powered by state-of-the-art deep learning.
          </p>
        </div>

        <div className="relative">
          <div className="hidden md:block absolute top-12 left-[12.5%] right-[12.5%] h-px bg-gradient-to-r from-violet-600 via-blue-500 to-cyan-500 opacity-30" />

          <div className="grid md:grid-cols-4 gap-8">
            {steps.map(({ number, icon: Icon, color, title, description }) => (
              <div
                key={number}
                className="group relative bg-white border border-slate-200 hover:border-blue-300 rounded-3xl p-7 text-center transition-all duration-400 hover:-translate-y-2 hover:shadow-xl"
              >
                <div
                  className="w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center relative"
                  style={{ background: `${color}22`, border: `2px solid ${color}55` }}
                >
                  <Icon className="w-8 h-8" style={{ color }} />
                  <span
                    className="absolute -top-2 -right-2 w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center text-white"
                    style={{ background: color }}
                  >
                    {number.slice(1)}
                  </span>
                </div>

                <div className="text-4xl font-black opacity-10 text-slate-900 mb-2" style={{ fontFamily: 'Outfit, sans-serif' }}>
                  {number}
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-3" style={{ fontFamily: 'Outfit, sans-serif' }}>
                  {title}
                </h3>
                <p className="text-slate-500 text-sm leading-relaxed">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   About Technology
───────────────────────────────────────────── */
const techCards = [
  {
    icon: Brain,
    color: 'from-violet-600 to-purple-800',
    tag: 'Core Model',
    title: 'Generative Adversarial Network (GAN)',
    body: `GANs consist of a Generator that synthesises realistic images and a Discriminator that distinguishes real from fake. Trained adversarially, the Generator learns to produce photorealistic beautified faces. BeautifyAI extends this with StyleGAN2's weight-demodulated convolutions for superior fidelity.`,
    highlights: ['Generator–Discriminator duality', 'Adversarial training loop', 'StyleGAN2 convolutions'],
  },
  {
    icon: Layers,
    color: 'from-blue-600 to-cyan-700',
    tag: 'Structural Understanding',
    title: 'Feature Pyramid Network (FPN)',
    body: `FPN extracts multi-scale facial features — from fine skin textures to high-level face geometry — enabling the model to beautify consistently across resolutions. Each pyramid level informs the style vector at the corresponding generator resolution layer.`,
    highlights: ['Multi-scale feature extraction', 'Top-down pathway fusion', 'Resolution-aware style injection'],
  },
  {
    icon: Cpu,
    color: 'from-pink-600 to-rose-700',
    tag: 'Style Mechanism',
    title: 'Style Vector Control',
    body: `A learnt mapping network transforms a noise vector plus a beauty-intensity scalar into a style vector 𝑤 ∈ 𝒲. This vector is injected into each convolution layer via Adaptive Instance Normalisation (AdaIN), giving granular per-layer control over colour, texture, and shape.`,
    highlights: ['Mapping network (8 layers)', 'AdaIN style injection', 'Per-layer intensity modulation'],
  },
];

function TechnologySection() {
  return (
    <section id="technology" className="py-24 px-6" style={{ background: '#ffffff' }}>
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <span className="text-pink-600 text-sm font-semibold uppercase tracking-widest">Under the Hood</span>
          <h2
            className="text-4xl md:text-5xl font-black text-slate-900 mt-3 mb-4"
            style={{ fontFamily: 'Outfit, sans-serif' }}
          >
            The Technology <span className="text-pink-600">Behind</span> BeautifyAI
          </h2>
          <p className="text-slate-500 max-w-2xl mx-auto text-base">
            Built on three complementary deep learning paradigms, FIBGAN combines the best of generative modelling,
            multi-scale feature extraction, and disentangled style control.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {techCards.map(({ icon: Icon, color, tag, title, body, highlights }) => (
            <div
              key={title}
              className="group bg-white border border-slate-200 hover:border-pink-300 rounded-3xl p-8 transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl overflow-hidden relative"
            >
              <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-0 group-hover:opacity-20 transition-opacity duration-500 bg-gradient-to-br ${color} translate-x-8 -translate-y-8`} />

              <span className="inline-block bg-slate-100 text-slate-600 text-xs font-semibold px-3 py-1 rounded-full mb-5">
                {tag}
              </span>

              <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${color} flex items-center justify-center mb-5 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                <Icon className="w-7 h-7 text-white" />
              </div>

              <h3 className="text-xl font-bold text-slate-900 mb-4" style={{ fontFamily: 'Outfit, sans-serif' }}>
                {title}
              </h3>
              <p className="text-slate-500 text-sm leading-relaxed mb-5">{body}</p>

              <ul className="space-y-2 border-t border-slate-200 pt-4">
                {highlights.map(h => (
                  <li key={h} className="flex items-center gap-2 text-xs text-violet-700">
                    <div className="w-1.5 h-1.5 rounded-full bg-violet-500 shrink-0" />
                    {h}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>


      </div>
    </section>
  );
}


/* ─────────────────────────────────────────────
   About Section
───────────────────────────────────────────── */
function AboutSection() {
  const stats = [
    { value: '5', label: 'Intensity Levels', suffix: '+' },
    { value: '99', label: 'Identity Preserved', suffix: '%' },
    { value: '0', label: 'Visible Artifacts', suffix: '' },
    { value: '1', label: 'Forward Pass', suffix: 'x' },
  ];

  const highlights = [
    {
      icon: Sparkles,
      color: 'from-violet-500 to-purple-600',
      title: 'Natural-Looking Results',
      desc: 'Our AI enhances your features while keeping everything that makes you uniquely you — skin texture, facial structure, and expression all preserved.',
    },
    {
      icon: Shield,
      color: 'from-blue-500 to-cyan-500',
      title: 'Privacy First',
      desc: 'Your photos are processed securely. No data stored, no identity shared. Your beauty journey stays completely private.',
    },
    {
      icon: Zap,
      color: 'from-pink-500 to-rose-500',
      title: 'Instant Transformation',
      desc: 'One upload, five stunning results — all generated in a single AI pass. See multiple beautification intensities side-by-side in seconds.',
    },
  ];

  return (
    <section
      id="about"
      className="py-24 px-6"
      style={{ background: 'linear-gradient(135deg, #f8f7ff 0%, #ede9fe 40%, #e0e7ff 100%)' }}
    >
      <div className="max-w-7xl mx-auto">

        {/* ── Header ── */}
        <div className="text-center mb-16">
          <span className="inline-block bg-violet-100 text-violet-700 text-xs font-semibold uppercase tracking-widest px-4 py-1.5 rounded-full mb-4">
            About BeautifyAI
          </span>
          <h2
            className="text-4xl md:text-6xl font-black leading-tight mb-5"
            style={{
              fontFamily: 'Outfit, sans-serif',
              background: 'linear-gradient(135deg, #1a202c 0%, #7c3aed 60%, #2563eb 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            Beauty, Redefined<br />by Intelligence
          </h2>
          <p className="text-slate-500 max-w-2xl mx-auto text-lg leading-relaxed">
            BeautifyAI uses cutting-edge deep learning to bring out your natural radiance —
            with precision, grace, and complete respect for your unique identity.
          </p>
        </div>

        {/* ── Stats bar ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-16">
          {stats.map(({ value, label, suffix }) => (
            <div
              key={label}
              className="rounded-3xl p-6 text-center"
              style={{ background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(124,58,237,0.15)', backdropFilter: 'blur(8px)' }}
            >
              <p
                className="text-4xl font-black mb-1"
                style={{ fontFamily: 'Outfit, sans-serif', color: '#7c3aed' }}
              >
                {value}<span className="text-2xl">{suffix}</span>
              </p>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</p>
            </div>
          ))}
        </div>

        {/* ── Highlights grid ── */}
        <div className="grid md:grid-cols-3 gap-6 mb-16">
          {highlights.map(({ icon: Icon, color, title, desc }) => (
            <div
              key={title}
              className="group rounded-3xl p-8 transition-all duration-400 hover:-translate-y-2 hover:shadow-2xl"
              style={{ background: 'rgba(255,255,255,0.8)', border: '1px solid rgba(124,58,237,0.12)', backdropFilter: 'blur(8px)' }}
            >
              <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${color} flex items-center justify-center mb-5 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                <Icon className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-3" style={{ fontFamily: 'Outfit, sans-serif' }}>
                {title}
              </h3>
              <p className="text-slate-500 text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>



      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   Footer
───────────────────────────────────────────── */
function Footer() {
  const year = new Date().getFullYear();

  const navLinks = [
    { label: 'Features', href: '#features' },
    { label: 'How It Works', href: '#how-it-works' },
    { label: 'Technology', href: '#technology' },
    { label: 'About', href: '#about' },
  ];

  const techLinks = [
    { label: 'FIBGAN Architecture', href: '#technology' },
    { label: 'Feature Pyramid Network', href: '#technology' },
    { label: 'Style Vector Control', href: '#technology' },
    { label: 'GAN Deep Dive', href: '#technology' },
  ];

  return (
    <footer
      style={{
        background: 'linear-gradient(135deg, #f8f7ff 0%, #ede9fe 40%, #e0e7ff 100%)',
        fontFamily: 'Outfit, sans-serif',
        borderTop: '1px solid rgba(124,58,237,0.15)',
      }}
    >
      {/* Main footer grid */}
      <div className="max-w-7xl mx-auto px-6 pt-16 pb-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">

          {/* ── Brand column ── */}
          <div className="lg:col-span-1">
            <div className="flex items-center gap-2.5 mb-5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center shadow-lg" style={{ boxShadow: '0 4px 16px rgba(124,58,237,0.3)' }}>
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <span className="font-extrabold text-2xl text-slate-900">
                Beautify<span style={{ color: '#7c3aed' }}>AI</span>
              </span>
            </div>
            <p className="text-sm leading-relaxed mb-6" style={{ color: '#64748b' }}>
              AI-powered multi-intensity facial beautification using the FIBGAN deep learning architecture.
              Identity-preserving. Artifact-free. Research-grade.
            </p>
            {/* Social icons */}
            <div className="flex gap-3">
              {[
                { icon: Github, label: 'GitHub' },
                { icon: Mail, label: 'Email' },
                { icon: Star, label: 'Star' },
              ].map(({ icon: Icon, label }) => (
                <a
                  key={label}
                  href="#"
                  aria-label={label}
                  className="w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200 hover:-translate-y-0.5"
                  style={{ background: 'rgba(124,58,237,0.1)', color: '#7c3aed', border: '1px solid rgba(124,58,237,0.2)' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(124,58,237,0.2)'; e.currentTarget.style.borderColor = 'rgba(124,58,237,0.5)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(124,58,237,0.1)'; e.currentTarget.style.borderColor = 'rgba(124,58,237,0.2)'; }}
                >
                  <Icon className="w-4 h-4" />
                </a>
              ))}
            </div>
          </div>

          {/* ── Quick Links ── */}
          <div>
            <h4 className="font-bold text-sm uppercase tracking-widest mb-5" style={{ color: '#1e293b' }}>Quick Links</h4>
            <ul className="space-y-3">
              {navLinks.map(({ label, href }) => (
                <li key={label}>
                  <a
                    href={href}
                    className="text-sm transition-colors duration-200 flex items-center gap-2"
                    style={{ color: '#64748b' }}
                    onMouseEnter={e => { e.currentTarget.style.color = '#7c3aed'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = '#64748b'; }}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ background: '#7c3aed' }}
                    />
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* ── Technology ── */}
          <div>
            <h4 className="font-bold text-sm uppercase tracking-widest mb-5" style={{ color: '#1e293b' }}>Technology</h4>
            <ul className="space-y-3">
              {techLinks.map(({ label, href }) => (
                <li key={label}>
                  <a
                    href={href}
                    className="text-sm transition-colors duration-200"
                    style={{ color: '#64748b' }}
                    onMouseEnter={e => { e.currentTarget.style.color = '#7c3aed'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = '#64748b'; }}
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* ── Contact / Info ── */}
          <div>
            <h4 className="font-bold text-sm uppercase tracking-widest mb-5" style={{ color: '#1e293b' }}>Contact</h4>
            <ul className="space-y-4">
              <li className="flex items-start gap-3">
                <Mail className="w-4 h-4 mt-0.5 shrink-0" style={{ color: '#7c3aed' }} />
                <span className="text-sm" style={{ color: '#64748b' }}>beautifyai@research.edu</span>
              </li>
              <li className="flex items-start gap-3">
                <Github className="w-4 h-4 mt-0.5 shrink-0" style={{ color: '#7c3aed' }} />
                <span className="text-sm" style={{ color: '#64748b' }}>github.com/beautifyai-fibgan</span>
              </li>
              <li className="flex items-start gap-3">
                <Sparkles className="w-4 h-4 mt-0.5 shrink-0" style={{ color: '#7c3aed' }} />
                <span className="text-sm" style={{ color: '#64748b' }}>Academic Research Project · {year}</span>
              </li>
            </ul>

            {/* Research Updates badge */}
            <div
              className="mt-6 rounded-2xl p-4"
              style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.25)' }}
            >
              <p className="text-xs font-semibold mb-1" style={{ color: '#7c3aed' }}>Research Updates</p>
              <p className="text-xs leading-relaxed" style={{ color: '#64748b' }}>
                Model weights &amp; code will be open-sourced post-evaluation.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div style={{ borderTop: '1px solid rgba(124,58,237,0.15)' }} />

      {/* Bottom bar */}
      <div className="max-w-7xl mx-auto px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-3">
        <p className="text-xs" style={{ color: '#94a3b8' }}>
          © {year} <span style={{ color: '#7c3aed', fontWeight: 600 }}>BeautifyAI</span>. All rights reserved.
        </p>
        <div className="flex items-center gap-1 text-xs" style={{ color: '#94a3b8' }}>
          <span>Powered by</span>
          <span className="font-semibold ml-1" style={{ color: '#7c3aed' }}>FIBGAN Deep Learning</span>
          <span className="mx-2">·</span>
          <span>Built with React + Vite</span>
        </div>
        <div className="flex gap-4 text-xs">
          <a href="#" style={{ color: '#94a3b8' }} onMouseEnter={e => e.currentTarget.style.color = '#7c3aed'} onMouseLeave={e => e.currentTarget.style.color = '#94a3b8'}>Privacy Policy</a>
          <a href="#" style={{ color: '#94a3b8' }} onMouseEnter={e => e.currentTarget.style.color = '#7c3aed'} onMouseLeave={e => e.currentTarget.style.color = '#94a3b8'}>Terms of Use</a>
        </div>
      </div>
    </footer>
  );
}

/* ─────────────────────────────────────────────
   Upload Page
───────────────────────────────────────────── */
function UploadPage({ onBack }) {
  const [selectedImage, setSelectedImage] = useState(null);
  const [originalImage, setOriginalImage] = useState(null); // always the raw upload
  const [selectedFile, setSelectedFile]   = useState(null);
  const [isEnhancing, setIsEnhancing]     = useState(false);
  const [enhanced, setEnhanced]           = useState(false);
  const [statusMsg, setStatusMsg]         = useState('');   // success / fallback msg
  const [statusType, setStatusType]       = useState('');   // 'success' | 'fallback' | 'error'
  const [errorMsg, setErrorMsg]           = useState('');

  // Intensity state with localStorage persistence
  const [intensity, setIntensity] = useState(() => {
    const saved = localStorage.getItem('beautify_intensity');
    return saved !== null ? parseFloat(saved) : 0.5;
  });

  useEffect(() => {
    localStorage.setItem('beautify_intensity', intensity.toString());
  }, [intensity]);

  const handleImageChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      const url = URL.createObjectURL(e.target.files[0]);
      setSelectedImage(url);
      setOriginalImage(url);
      setEnhanced(false);
      setStatusMsg('');
      setStatusType('');
      setErrorMsg('');
    }
  };

  const handleEnhance = async () => {
    if (!selectedFile) return;
    setIsEnhancing(true);
    setErrorMsg('');
    setStatusMsg('');
    setStatusType('');

    const formData = new FormData();
    formData.append('image', selectedFile);
    formData.append('intensity', intensity.toString());

    try {
      // Relative URL — proxied by Vite to http://localhost:8000/beautify
      const response = await fetch('/beautify', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        throw new Error(errText || `Server returned ${response.status}`);
      }

      // Read AI status from response headers
      const xStatus  = response.headers.get('X-Beautify-Status')  || 'success';
      const xMessage = response.headers.get('X-Beautify-Message') || '';

      const blob             = await response.blob();
      const enhancedImageUrl = URL.createObjectURL(blob);

      setSelectedImage(enhancedImageUrl);
      setEnhanced(true);
      setStatusType(xStatus);   // 'success' or 'fallback'
      setStatusMsg(xMessage);
    } catch (error) {
      console.error('Error beautifying image:', error);
      setErrorMsg(
        error.message.includes('Failed to fetch')
          ? 'Cannot reach the AI server. Is it running? (python main.py)'
          : `Error: ${error.message}`
      );
    } finally {
      setIsEnhancing(false);
    }
  };

  const handleDownload = () => {
    if (!selectedImage) return;
    const link = document.createElement('a');
    link.href = selectedImage;
    // Use original filename with "beautified_" prefix, or fallback
    const originalName = selectedFile ? selectedFile.name : 'image.jpg';
    const ext = originalName.lastIndexOf('.') !== -1 ? originalName.slice(originalName.lastIndexOf('.')) : '.jpg';
    const baseName = originalName.lastIndexOf('.') !== -1 ? originalName.slice(0, originalName.lastIndexOf('.')) : originalName;
    link.download = `beautified_${baseName}${ext}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleReset = () => {
    setSelectedImage(null);
    setOriginalImage(null);
    setSelectedFile(null);
    setEnhanced(false);
    setIsEnhancing(false);
    setStatusMsg('');
    setStatusType('');
    setErrorMsg('');
  };

  // Clamp the value to ensure it's strictly between 0 and 1
  const handleIntensityChange = (e) => {
    let val = parseFloat(e.target.value);
    if (isNaN(val)) val = 0.5;
    val = Math.max(0, Math.min(val, 1)); // Strict clamp
    setIntensity(val);

    // Reset enhanced state so user must re-enhance with new intensity
    if (enhanced) {
      setEnhanced(false);
      setStatusMsg('');
      setStatusType('');
      // Revert preview to original uploaded image
      if (originalImage) setSelectedImage(originalImage);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900 selection:bg-violet-200">
      {/* Simple header */}
      <nav className="bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2 cursor-pointer" onClick={onBack}>
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="font-extrabold text-xl text-slate-900" style={{ fontFamily: 'Outfit, sans-serif' }}>BeautifyAI</span>
        </div>
        <button onClick={onBack} className="text-sm font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1 transition-colors">
          <ArrowRight className="w-4 h-4 rotate-180" /> Back to Home
        </button>
      </nav>

      {/* Main Upload Area */}
      <main className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="max-w-xl w-full bg-white rounded-3xl shadow-xl border border-slate-100 p-8 md:p-12 text-center">
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4" style={{ fontFamily: 'Outfit, sans-serif' }}>
            {enhanced ? '✨ Enhancement Complete!' : selectedImage ? 'Your photo is ready' : 'Upload your photo'}
          </h1>
          <p className="text-slate-500 mb-8 max-w-sm mx-auto leading-relaxed">
            {enhanced
              ? 'Your photo has been beautified. Download it below or choose another image.'
              : selectedImage
              ? 'Image selected! You can download it now, or click Enhance Now for AI beautification.'
              : 'Select an image to see the AI beautification in action. For best results, use a clear portrait photo.'}
          </p>

          {!selectedImage ? (
            /* ── Drop zone ── */
            <label className="border-2 border-dashed border-violet-200 bg-violet-50/50 hover:bg-violet-50 rounded-3xl p-12 flex flex-col items-center justify-center cursor-pointer transition-colors group">
              <input type="file" className="hidden" accept="image/*" onChange={handleImageChange} />
              <div className="w-16 h-16 bg-white rounded-full shadow-sm flex items-center justify-center mb-4 group-hover:scale-110 group-active:scale-95 transition-transform">
                <Upload className="w-6 h-6 text-violet-500" />
              </div>
              <span className="font-semibold text-violet-700 text-lg">Click to browse or drag &amp; drop</span>
              <span className="text-slate-400 text-sm mt-2">JPG, PNG up to 10MB</span>
            </label>
          ) : (
            /* ── Preview + actions ── */
            <div className="flex flex-col items-center gap-6 w-full">

              {/* Image preview with subtle glow when enhanced */}
              <div
                className="relative rounded-2xl overflow-hidden shadow-lg"
                style={{
                  boxShadow: enhanced
                    ? '0 0 0 3px #7c3aed44, 0 12px 40px rgba(124,58,237,0.25)'
                    : '0 4px 20px rgba(0,0,0,0.1)',
                  transition: 'box-shadow 0.5s ease',
                }}
              >
                <img
                  src={selectedImage}
                  alt="Preview"
                  className="w-64 h-64 object-cover"
                  style={{ filter: enhanced ? `brightness(${1 + intensity * 0.12}) contrast(${1 + intensity * 0.08}) saturate(${1 + intensity * 0.2})` : 'none', transition: 'filter 0.6s ease' }}
                />
                {enhanced && (
                  <div
                    className="absolute top-3 right-3 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg flex items-center gap-1"
                    style={{
                      backdropFilter: 'blur(4px)',
                      background: statusType === 'fallback' ? '#d97706' : '#7c3aed',
                    }}
                  >
                    <Sparkles className="w-3 h-3" />
                    {statusType === 'fallback' ? 'Original (fallback)' : 'AI Enhanced'}
                  </div>
                )}
              </div>

              {/* Loading indicator while enhancing */}
              {isEnhancing && (
                <div className="flex flex-col items-center gap-3 py-2">
                  <div className="w-10 h-10 rounded-full border-4 border-violet-200 border-t-violet-600 animate-spin" />
                  <p className="text-sm text-slate-500 font-medium">AI is beautifying your photo…</p>
                </div>
              )}

              {/* Inline error message */}
              {errorMsg && (
                <div className="w-full bg-red-50 border border-red-200 text-red-700 text-sm font-medium px-4 py-3 rounded-xl flex items-start gap-2">
                  <span className="shrink-0 mt-0.5">⚠️</span>
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Status message (success / fallback) */}
              {enhanced && statusMsg && (
                <div
                  className="w-full text-xs font-medium px-4 py-2.5 rounded-xl flex items-center gap-2"
                  style={{
                    background: statusType === 'fallback' ? '#fffbeb' : '#f5f3ff',
                    border: `1px solid ${statusType === 'fallback' ? '#fcd34d' : '#c4b5fd'}`,
                    color: statusType === 'fallback' ? '#92400e' : '#5b21b6',
                  }}
                >
                  <span>{statusType === 'fallback' ? '⚠️' : '✨'}</span>
                  <span>{statusMsg}</span>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex flex-col gap-3 w-full">

                {/* Download button — shown as soon as an image is selected */}
                <button
                  id="download-btn"
                  onClick={handleDownload}
                  className="w-full py-4 px-6 rounded-2xl font-bold text-white flex items-center justify-center gap-3 transition-all duration-300 hover:-translate-y-1 active:scale-95"
                  style={{
                    background: enhanced
                      ? 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 50%, #2563eb 100%)'
                      : 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                    boxShadow: enhanced
                      ? '0 8px 30px rgba(124,58,237,0.45)'
                      : '0 6px 24px rgba(79,70,229,0.35)',
                    fontSize: '1.05rem',
                  }}
                >
                  <Download className="w-5 h-5" />
                  {enhanced ? 'Download Enhanced Image' : 'Download Image'}
                </button>

                {/* Enhance / secondary row */}
                <div className="flex flex-col sm:flex-row gap-3 w-full">
                  <button
                    onClick={handleReset}
                    className="flex-1 py-3.5 px-6 rounded-xl font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                  >
                    Choose Another
                  </button>

                  {!enhanced && (
                    <button
                      onClick={handleEnhance}
                      disabled={isEnhancing}
                      className="flex-1 py-3.5 px-6 rounded-xl font-bold text-white bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 shadow-lg shadow-violet-500/30 flex items-center justify-center gap-2 transition-all hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      <Star className="w-4 h-4" />
                      {isEnhancing ? 'Enhancing…' : 'Enhance Now'}
                    </button>
                  )}

                  {enhanced && (
                    <button
                      onClick={() => { setEnhanced(false); }}
                      className="flex-1 py-3.5 px-6 rounded-xl font-semibold text-violet-600 border-2 border-violet-300 hover:bg-violet-50 transition-colors flex items-center justify-center gap-2"
                    >
                      <Star className="w-4 h-4" /> Re-enhance
                    </button>
                  )}
                </div>

              </div>
            </div>
          )}

          {/* ── Intensity Control Slider ── */}
          <div className="mt-8 pt-8 border-t border-slate-100 w-full flex flex-col gap-4 text-left transition-all">
            <div className="flex justify-between items-center">
              <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-violet-500" />
                Beautification Intensity
              </label>
              <span className="text-xs font-bold px-2.5 py-1 bg-violet-100 text-violet-700 rounded-lg transition-all" style={{ width: '42px', textAlign: 'center' }}>
                {intensity.toFixed(2)}
              </span>
            </div>
            
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={intensity}
              onChange={handleIntensityChange}
              className="w-full h-2 bg-slate-200 rounded-lg cursor-pointer accent-violet-600 hover:accent-violet-500 transition-all"
            />

            <div className="flex justify-between text-xs text-slate-400 font-medium px-1">
              <span>Subtle (0.0)</span>
              <span>Dramatic (1.0)</span>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}

/* ─────────────────────────────────────────────
   App Root
───────────────────────────────────────────── */
export default function App() {
  const [currentHash, setCurrentHash] = useState(window.location.hash);

  useEffect(() => {
    const handleHashChange = () => {
      setCurrentHash(window.location.hash);
    };
    window.addEventListener('hashchange', handleHashChange);
    
    // Check initial direct load
    if (window.location.hash === '#upload-page' && !window.IS_LOGGED_IN) {
      window.location.hash = '';
      setTimeout(() => window.dispatchEvent(new Event('show_login_modal')), 100);
    }
    
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  return (
    <>
      <div style={{ display: currentHash === '#upload-page' ? 'none' : 'block' }}>
        <div className="min-h-screen font-sans text-slate-900 bg-white selection:bg-violet-200">
          <Navbar />
          <ElevatedBeautySection />
      <FeaturesSection />
      <HowItWorksSection />
      <TechnologySection />

      <AboutSection />
      <Footer />
        </div>
      </div>
      {currentHash === '#upload-page' && (
        <UploadPage onBack={() => { window.location.hash = ''; setCurrentHash(''); }} />
      )}
    </>
  );
}
