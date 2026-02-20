import { Eye, EyeOff, Mail, Lock } from "lucide-react";
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
        "http://localhost:9000/api/auth/login",
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
          const acceptRes = await fetch(`http://localhost:9000/api/auth/invite/accept-existing?token=${encodeURIComponent(inviteToken)}`, {
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
      if (role === 'admin') navigate('/workspace')
      else navigate('/dashboard')
    } catch (err) {
      setError("Server error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-white">
      {/* LEFT SLIDER */}
      <div className="lg:flex-1 relative hidden lg:block">
        <div className="absolute inset-0">
          {slides.map((slide, index) => (
            <div
              key={index}
              className={`absolute inset-0 transition-opacity duration-700 ${
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

        <div className="absolute inset-0 bg-black/40" />

        <div className="relative h-full flex flex-col justify-end p-12 text-white">
          <h1 className="text-3xl font-bold mb-4">
            {slides[currentSlide].title}
          </h1>
          <p>{slides[currentSlide].description}</p>

          <div className="flex gap-2 mt-6">
            {slides.map((_, index) => (
              <div
                key={index}
                onClick={() => setCurrentSlide(index)}
                className={`h-2 rounded-full cursor-pointer transition-all ${
                  index === currentSlide
                    ? "w-8 bg-white"
                    : "w-2 bg-gray-400"
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* RIGHT FORM */}
      
      <div className="lg:flex-1 flex items-center justify-center px-6 py-10">

        
        <div className="w-full max-w-md">
          <h1 className="text-7xl font-bold text-[#4A154B] mb-6">SOLVEVARE</h1>
        

          <h2 className="text-3xl font-bold mb-8 text-[#4A154B]" >LOGIN HERE</h2>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* Email */}
            <div>
              <label className="text-sm font-medium">Email</label>
              <div className="relative mt-2">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="email"
                  placeholder="Enter your email"
                  {...register("email")}
                  className="w-full rounded-full border border-gray-300 pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>
              {errors.email && (
                <p className="text-red-500 text-sm mt-1">
                  {errors.email.message}
                </p>
              )}
            </div>

            {/* Password */}
            <div>
              <label className="text-sm font-medium">Password</label>
              <div className="relative mt-2">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  {...register("password")}
                  className="w-full rounded-full border border-gray-300 pl-10 pr-10 py-2.5 focus:outline-none focus:ring-2 focus:ring-black"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                >
                  {showPassword ? (
                    <EyeOff size={18} />
                  ) : (
                    <Eye size={18} />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="text-red-500 text-sm mt-1">
                  {errors.password.message}
                </p>
              )}
            </div>

            {error && (
              <p className="text-red-500 text-sm text-center bg-red-50 p-2 rounded">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#4A154B] text-white rounded-full py-2.5 hover:bg-[#3A103B] transition"
            >
              {isLoading ? "Signing in..." : "Login"}
            </button>

            <button
              type="button"
              className="flex items-center justify-center gap-3 w-full bg-gray-200 rounded-full py-2.5 hover:bg-gray-300 transition"
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
