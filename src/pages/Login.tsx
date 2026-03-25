import { Eye, EyeOff, Mail, Lock, Sparkles, ArrowRight, RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FcGoogle } from "react-icons/fc";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoginSchema, type LoginSchemaType } from "@/schema/loginSchema";
import { API_URL } from "@/lib/config";

// Flow states
type Stage = 'login' | 'otp' | 'reset';

const Login = () => {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [stage, setStage] = useState<Stage>('login');
  const [emailForReset, setEmailForReset] = useState('');

  // OTP stage
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [otpError, setOtpError] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Reset stage
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState('');

  const { register, handleSubmit, getValues, formState: { errors } } = useForm<LoginSchemaType>({
    resolver: zodResolver(LoginSchema),
  });

  useEffect(() => {
    const raw = localStorage.getItem("user");
    if (raw) {
      try {
        const u = JSON.parse(raw);
        navigate('/dashboard');
      } catch (e) { navigate('/dashboard'); }
    }
  }, [navigate]);

  const slides = [
    { image: "https://images.pexels.com/photos/3184306/pexels-photo-3184306.jpeg", title: "Welcome to SolveVare", description: "Connect, chat and collaborate with your team." },
    { image: "https://images.pexels.com/photos/3184338/pexels-photo-3184338.jpeg", title: "Secure Communication", description: "Real-time messaging with secure backend." },
    { image: "https://images.pexels.com/photos/3184292/pexels-photo-3184292.jpeg", title: "Organize Teams", description: "Create groups and manage your workspace easily." },
  ];

  useEffect(() => {
    const interval = setInterval(() => setCurrentSlide(p => (p + 1) % slides.length), 5000);
    return () => clearInterval(interval);
  }, []);

  // ── LOGIN ──
  const onSubmit = async (data: LoginSchemaType) => {
    try {
      setIsLoading(true); setError('');
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data), credentials: 'include',
      });
      const result = await res.json();
      if (!res.ok) { setError(result.msg || 'Login failed'); setFailedAttempts(p => p + 1); return; }

      localStorage.setItem('token', result.access);
      localStorage.setItem('user', JSON.stringify(result.user));

      const inviteToken = new URLSearchParams(window.location.search).get('token');
      if (inviteToken) {
        try {
          const ar = await fetch(`${API_URL}/api/auth/invite/accept-existing?token=${encodeURIComponent(inviteToken)}`, { method: 'POST', headers: { Authorization: `Bearer ${result.access}` } });
          const ad = await ar.json().catch(() => ({}));
          if (ar.ok && ad.workspaceId) { localStorage.setItem('currentWorkspace', JSON.stringify({ id: ad.workspaceId, name: ad.workspaceName || 'Workspace', members: [] })); navigate('/dashboard'); return; }
        } catch {}
      }

      try {
        const wr = await fetch(`${API_URL}/api/workspaces`, { headers: { Authorization: `Bearer ${result.access}` } });
        const wd = await wr.json();
        const wss = wd.workspaces || [];
        if (wss.length > 0) { const ws = wss[0]; localStorage.setItem('currentWorkspace', JSON.stringify({ id: ws._id, name: ws.name, image: ws.image, members: ws.members || [] })); localStorage.setItem('lastSelectedWorkspaceId', ws._id); }
      } catch {}
      sessionStorage.removeItem('hasSeenWelcome');
      navigate('/dashboard');
    } catch { setError('Server error'); } finally { setIsLoading(false); }
  };

  // ── SEND OTP ──
  const sendOtp = async (email: string) => {
    setOtpLoading(true); setOtpError('');
    try {
      const res = await fetch(`${API_URL}/api/auth/forgot-password/send-otp`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const d = await res.json();
      if (!res.ok) { setOtpError(d.msg || 'Failed to send OTP'); return false; }
      return true;
    } catch { setOtpError('Server error'); return false; } finally { setOtpLoading(false); }
  };

  const handleForgotPassword = async () => {
    const email = getValues('email');
    if (!email) { setError('Please enter your email first'); return; }
    setEmailForReset(email);
    const ok = await sendOtp(email);
    if (ok) { setStage('otp'); setOtpDigits(['', '', '', '', '', '']); setTimeout(() => otpRefs.current[0]?.focus(), 100); }
  };

  // ── OTP INPUT ──
  const handleOtpChange = (idx: number, val: string) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...otpDigits]; next[idx] = val;
    setOtpDigits(next);
    if (val && idx < 5) otpRefs.current[idx + 1]?.focus();
  };

  const handleOtpPaste = (e: React.ClipboardEvent, idx: number) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    const next = [...otpDigits];
    for (let i = 0; i < pasted.length; i++) {
      if (idx + i < 6) next[idx + i] = pasted[i];
    }
    setOtpDigits(next);
    const focusIdx = Math.min(idx + pasted.length, 5);
    otpRefs.current[focusIdx]?.focus();
  };

  const handleOtpKeyDown = (idx: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otpDigits[idx] && idx > 0) otpRefs.current[idx - 1]?.focus();
  };

  const handleVerifyOtp = async () => {
    const code = otpDigits.join('');
    if (code.length < 6) { setOtpError('Enter all 6 digits'); return; }
    setOtpLoading(true); setOtpError('');
    try {
      // Verify by trying a dummy reset - we just check if code is valid by moving to reset stage
      // We'll verify on actual reset. For now just move to reset stage.
      setStage('reset');
    } catch { setOtpError('Server error'); } finally { setOtpLoading(false); }
  };

  const handleResendOtp = async () => {
    setOtpDigits(['', '', '', '', '', '']);
    setOtpError('');
    await sendOtp(emailForReset);
    setTimeout(() => otpRefs.current[0]?.focus(), 100);
  };

  // ── RESET PASSWORD ──
  const handleResetPassword = async () => {
    if (!newPassword || !confirmPassword) { setResetError('Both fields required'); return; }
    if (newPassword !== confirmPassword) { setResetError('Passwords do not match'); return; }
    if (newPassword.length < 6) { setResetError('Password must be at least 6 characters'); return; }
    setResetLoading(true); setResetError('');
    try {
      const code = otpDigits.join('');
      const res = await fetch(`${API_URL}/api/auth/forgot-password/verify`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailForReset, code, newPassword }),
      });
      const d = await res.json();
      if (!res.ok) {
        if (d.msg?.toLowerCase().includes('invalid')) { setStage('otp'); setOtpError('Invalid code. Try again.'); }
        else setResetError(d.msg || 'Reset failed');
        return;
      }
      setStage('login'); setFailedAttempts(0); setError('Password updated! Please login.');
    } catch { setResetError('Server error'); } finally { setResetLoading(false); }
  };

  const handleGoogleLogin = () => { window.location.href = `${API_URL}/api/auth/google`; };

  // ── RENDER FORM CONTENT ──
  const renderForm = () => {
    // OTP Stage
    if (stage === 'otp') return (
      <div className="space-y-5">
        <div>
          <p className="text-gray-300 text-sm mb-1">Enter the 6-digit code sent to</p>
          <p className="text-purple-400 font-semibold text-sm">{emailForReset}</p>
        </div>
        {/* 6 digit OTP boxes */}
        <div className="flex gap-2 justify-between">
          {otpDigits.map((d, i) => (
            <input
              key={i}
              ref={el => { otpRefs.current[i] = el; }}
              type="text" inputMode="numeric" maxLength={1}
              value={d}
              onChange={e => handleOtpChange(i, e.target.value)}
              onKeyDown={e => handleOtpKeyDown(i, e)}
              onPaste={e => handleOtpPaste(e, i)}
              className="w-12 h-14 text-center text-xl font-bold rounded-xl border border-purple-500/30 bg-[#0a0b0d]/50 text-white focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
            />
          ))}
        </div>
        {otpError && <p className="text-red-400 text-sm">{otpError}</p>}
        <div className="flex gap-3">
          <button
            type="button" onClick={handleVerifyOtp} disabled={otpLoading || otpDigits.join('').length < 6}
            className="flex-1 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white rounded-xl py-3.5 font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {otpLoading ? 'Verifying...' : <><ArrowRight size={18} /> Verify Code</>}
          </button>
          <button
            type="button" onClick={handleResendOtp} disabled={otpLoading}
            className="px-4 rounded-xl border border-purple-500/30 text-purple-400 hover:bg-purple-500/10 transition-all flex items-center gap-1.5 text-sm font-medium disabled:opacity-50"
          >
            <RefreshCw size={14} /> Resend
          </button>
        </div>
        <button type="button" onClick={() => setStage('login')} className="text-gray-500 text-sm hover:text-gray-300 transition">← Back to Login</button>
      </div>
    );

    // Reset Stage
    if (stage === 'reset') return (
      <div className="space-y-5">
        <div>
          <label className="text-sm font-medium text-gray-300 mb-2 block">New Password</label>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-purple-400" />
            <input
              type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
              placeholder="Enter new password"
              className="w-full rounded-xl border border-purple-500/30 bg-[#0a0b0d]/50 pl-12 pr-4 py-3.5 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
            />
          </div>
        </div>
        <div>
          <label className="text-sm font-medium text-gray-300 mb-2 block">Confirm Password</label>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-purple-400" />
            <input
              type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              className="w-full rounded-xl border border-purple-500/30 bg-[#0a0b0d]/50 pl-12 pr-4 py-3.5 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
            />
          </div>
        </div>
        {resetError && <p className="text-red-400 text-sm">{resetError}</p>}
        <button
          type="button" onClick={handleResetPassword} disabled={resetLoading}
          className="w-full bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white rounded-xl py-3.5 font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {resetLoading ? 'Updating...' : 'Update'}
        </button>
      </div>
    );

    // Login Stage
    return (
      <>
        <div>
          <label className="text-sm font-medium text-gray-300 mb-2 block">Email Address</label>
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-purple-400" />
            <input type="email" placeholder="Enter your email" {...register("email")}
              className="w-full rounded-xl border border-purple-500/30 bg-[#0a0b0d]/50 pl-12 pr-4 py-3.5 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
            />
          </div>
          {errors.email && <p className="text-red-400 text-sm mt-2">{errors.email.message}</p>}
        </div>

        <div>
          <label className="text-sm font-medium text-gray-300 mb-2 block">Password</label>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-purple-400" />
            <input
              type={showPassword ? "text" : "password"} placeholder="Enter your password" {...register("password")}
              className="w-full rounded-xl border border-purple-500/30 bg-[#0a0b0d]/50 pl-12 pr-12 py-3.5 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
            />
            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-purple-400 hover:text-purple-300 transition-colors">
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
          {errors.password && <p className="text-red-400 text-sm mt-2">{errors.password.message}</p>}
        </div>

        {error && <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm p-4 rounded-xl">{error}</div>}

        <div className="flex gap-3">
          <button type="submit" disabled={isLoading}
            className={`bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white rounded-xl py-3.5 font-semibold transition-all hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-900/50 flex items-center justify-center gap-2 ${failedAttempts >= 3 ? 'flex-1' : 'w-full'}`}
          >
            {isLoading ? "Signing in..." : <><span>Login</span><ArrowRight size={18} /></>}
          </button>
          {failedAttempts >= 3 && (
            <button type="button" onClick={handleForgotPassword} disabled={otpLoading}
              className="flex-1 rounded-xl py-3.5 font-semibold transition-all hover:scale-[1.02] shadow-lg flex items-center justify-center gap-2 bg-white disabled:opacity-50"
              style={{ color: '#4A154B' }}
            >
              {otpLoading ? 'Sending...' : 'Forget Password'}
            </button>
          )}
        </div>

        <button type="button" onClick={handleGoogleLogin}
          className="flex items-center justify-center gap-3 w-full bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white rounded-xl py-3.5 font-medium transition-all hover:scale-[1.02]"
        >
          <FcGoogle size={22} /> Continue with Google
        </button>
      </>
    );
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-gradient-to-br from-[#0a0b0d] via-[#1a1d21] to-[#0f1115]">
      {/* LEFT SLIDER */}
      <div className="lg:flex-1 relative hidden lg:block">
        <div className="absolute inset-0">
          {slides.map((slide, index) => (
            <div key={index} className={`absolute inset-0 transition-opacity duration-1000 ${index === currentSlide ? "opacity-100" : "opacity-0"}`}>
              <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${slide.image})` }} />
            </div>
          ))}
        </div>
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/50 via-black/40 to-pink-900/30" />
        <div className="relative h-full flex flex-col justify-end p-12 text-white">
          <div className="mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-500/20 backdrop-blur-md border border-purple-500/30 rounded-full mb-6">
              <Sparkles className="w-4 h-4 text-purple-300" />
              <span className="text-sm font-medium text-purple-200">Welcome Back</span>
            </div>
            <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent">{slides[currentSlide].title}</h1>
            <p className="text-lg text-gray-200">{slides[currentSlide].description}</p>
          </div>
          <div className="flex gap-3 mt-6">
            {slides.map((_, index) => (
              <div key={index} onClick={() => setCurrentSlide(index)}
                className={`h-1.5 rounded-full cursor-pointer transition-all duration-300 ${index === currentSlide ? "w-12 bg-gradient-to-r from-purple-400 to-pink-400" : "w-8 bg-white/30 hover:bg-white/50"}`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* RIGHT FORM */}
      <div className="lg:flex-1 flex items-center justify-center px-6 py-10 bg-gradient-to-br from-[#1a1d21]/50 to-[#0f1115]/50 backdrop-blur-xl">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-gradient-to-br from-purple-600 to-purple-800 rounded-2xl shadow-lg">
                <Sparkles className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-5xl font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-purple-500 bg-clip-text text-transparent">SOLVEVARE</h1>
            </div>
            <h2 className="text-3xl font-bold text-white mb-2">
              {stage === 'otp' ? 'Verify Code' : stage === 'reset' ? 'Reset Password' : 'Welcome Back'}
            </h2>
            <p className="text-gray-400">
              {stage === 'otp' ? 'Check your email for the 6-digit code' : stage === 'reset' ? 'Enter your new password' : 'Sign in to continue to your workspace'}
            </p>
          </div>

          <form onSubmit={stage === 'login' ? handleSubmit(onSubmit) : e => e.preventDefault()} className="space-y-5">
            {renderForm()}
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
