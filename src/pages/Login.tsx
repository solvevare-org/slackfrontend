import { Eye, EyeOff, Mail, Lock, Sparkles, ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { FcGoogle } from "react-icons/fc";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoginSchema, type LoginSchemaType } from "@/schema/loginSchema";

const Login = () => {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // React Hook Form
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginSchemaType>({
    resolver: zodResolver(LoginSchema),
  });

  // Check if already logged in
  useEffect(() => {
    const raw = localStorage.getItem("user");
    if (raw) {
      try {
        const u = JSON.parse(raw)
        const role = (u.role || u.Role || '').toString().toLowerCase()
        if (role === 'admin') navigate('/workspace')
        else navigate('/dashboard')
      } catch (e) {
        navigate('/workspace')
      }
    }
  }, [navigate]);

  // Slider Data
  const slides = [
    {
      image:
        "https://images.pexels.com/photos/3184306/pexels-photo-3184306.jpeg",
      title: "Welcome to SolveVare",
      description: "Connect, chat and collaborate with your team.",
    },
    {
      image:
        "https://images.pexels.com/photos/3184338/pexels-photo-3184338.jpeg",
      title: "Secure Communication",
      description: "Real-time messaging with secure backend.",
    },
    {
      image:
        "https://images.pexels.com/photos/3184292/pexels-photo-3184292.jpeg",
      title: "Organize Teams",
      description: "Create groups and manage your workspace easily.",
    },
  ];

  // Auto Slide
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Submit Logic (Tumhara Original Backend Logic)
  const onSubmit = async (data: LoginSchemaType) => {
    try {
      setIsLoading(true);
      setError("");

      const response = await fetch(
        "http://72.60.97.98:6006/api/auth/login",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(data),
          credentials: "include",
        }
      );

      const result = await response.json();

      if (!response.ok) {
        setError(result.msg || "Login failed");
        return;
      }

      localStorage.setItem("token", result.access);
      localStorage.setItem("user", JSON.stringify(result.user));

      // if invite token present in URL, attempt to accept the invite for the logged-in user
      const inviteToken = new URLSearchParams(window.location.search).get('token');
      if (inviteToken) {
        try {
          const acceptRes = await fetch(`http://72.60.97.98:6006/api/auth/invite/accept-existing?token=${encodeURIComponent(inviteToken)}`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${result.access}` },
          });
          const acceptData = await acceptRes.json().catch(() => ({}));
          if (acceptRes.ok && acceptData.workspaceId) {
            try { localStorage.setItem('currentWorkspace', JSON.stringify({ id: acceptData.workspaceId, name: acceptData.workspaceName || 'Workspace', members: [] })); } catch (e) {}
            navigate('/dashboard');
            return;
          }
        } catch (e) {
          // ignore and continue
        }
      }

      const role = (result.user?.role || result.user?.Role || '').toString().toLowerCase()
      // Clear welcome flag to show welcome message on workspace page
      sessionStorage.removeItem('hasSeenWelcome');
      navigate('/workspace')
    } catch (err) {
      setError("Server error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    // Redirect to backend Google OAuth endpoint
    window.location.href = 'http://72.60.97.98:6006/api/auth/google';
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-gradient-to-br from-[#0a0b0d] via-[#1a1d21] to-[#0f1115]">
      {/* LEFT SLIDER */}
      <div className="lg:flex-1 relative hidden lg:block">
        <div className="absolute inset-0">
          {slides.map((slide, index) => (
            <div
              key={index}
              className={`absolute inset-0 transition-opacity duration-1000 ${
                index === currentSlide ? "opacity-100" : "opacity-0"
              }`}
            >
              <div
                className="absolute inset-0 bg-cover bg-center"
                style={{ backgroundImage: `url(${slide.image})` }}
              />
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
            <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent">
              {slides[currentSlide].title}
            </h1>
            <p className="text-lg text-gray-200">{slides[currentSlide].description}</p>
          </div>

          <div className="flex gap-3 mt-6">
            {slides.map((_, index) => (
              <div
                key={index}
                onClick={() => setCurrentSlide(index)}
                className={`h-1.5 rounded-full cursor-pointer transition-all duration-300 ${
                  index === currentSlide
                    ? "w-12 bg-gradient-to-r from-purple-400 to-pink-400"
                    : "w-8 bg-white/30 hover:bg-white/50"
                }`}
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
            <h2 className="text-3xl font-bold text-white mb-2">Welcome Back</h2>
            <p className="text-gray-400">Sign in to continue to your workspace</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* Email */}
            <div>
              <label className="text-sm font-medium text-gray-300 mb-2 block">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-purple-400" />
                <input
                  type="email"
                  placeholder="Enter your email"
                  {...register("email")}
                  className="w-full rounded-xl border border-purple-500/30 bg-[#0a0b0d]/50 pl-12 pr-4 py-3.5 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                />
              </div>
              {errors.email && (
                <p className="text-red-400 text-sm mt-2 flex items-center gap-1">
                  <span className="w-1 h-1 bg-red-400 rounded-full"></span>
                  {errors.email.message}
                </p>
              )}
            </div>

            {/* Password */}
            <div>
              <label className="text-sm font-medium text-gray-300 mb-2 block">Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-purple-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  {...register("password")}
                  className="w-full rounded-xl border border-purple-500/30 bg-[#0a0b0d]/50 pl-12 pr-12 py-3.5 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-purple-400 hover:text-purple-300 transition-colors"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              {errors.password && (
                <p className="text-red-400 text-sm mt-2 flex items-center gap-1">
                  <span className="w-1 h-1 bg-red-400 rounded-full"></span>
                  {errors.password.message}
                </p>
              )}
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm p-4 rounded-xl">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white rounded-xl py-3.5 font-semibold transition-all hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-900/50 flex items-center justify-center gap-2"
            >
              {isLoading ? "Signing in..." : (
                <>
                  Login
                  <ArrowRight size={18} />
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleGoogleLogin}
              className="flex items-center justify-center gap-3 w-full bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white rounded-xl py-3.5 font-medium transition-all hover:scale-[1.02]"
            >
              <FcGoogle size={22} />
              Continue with Google
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
