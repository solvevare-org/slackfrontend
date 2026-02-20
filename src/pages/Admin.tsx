import { useNavigate, useLocation } from "react-router-dom";
import { useState, useRef, useEffect } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { Mail, UserPlus, Share2, Facebook, MessageCircle, Instagram, ArrowLeft, CheckCircle } from "lucide-react";

const Admin = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const inviteRef = useRef<HTMLDivElement | null>(null);

  const [email, setEmail] = useState("");
  const [role, setRole] = useState("User");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"error" | "success" | "">("");
  const [showSocial, setShowSocial] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [popupText, setPopupText] = useState("");
  const [loading, setLoading] = useState(false);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const validateEmail = (value: string) => /\S+@\S+\.\S+/.test(value);

  const handleInvite = async () => {
    if (loading) return;

    if (!validateEmail(email)) {
      setMessage("Valid email is required");
      setMessageType("error");
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const current = (() => {
        try {
          return JSON.parse(localStorage.getItem("currentWorkspace") || "null");
        } catch {
          return null;
        }
      })();

      if (!current?.id) {
        setMessage("Select a workspace before inviting");
        setMessageType("error");
        setLoading(false);
        return;
      }

      const body: any = { email, role, workspaceId: current.id };

      const res = await fetch("http://localhost:9000/api/auth/invite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(data?.msg || "Invite failed");
        setMessageType("error");
      } else {
        setMessage("Invite sent successfully");
        setMessageType("success");

        setPopupText(`Confirmation: Email has been sent to ${email}`);
        setShowPopup(true);

        timeoutRef.current = setTimeout(() => {
          setShowPopup(false);
          navigate("/dashboard");
        }, 3000);
      }
    } catch {
      setMessage("Server error");
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  };

  const handlePreview = async () => {
    if (!validateEmail(email)) {
      setMessage("Valid email is required");
      setMessageType("error");
      return null;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return null;
    }

    try {
      const url = new URL("http://localhost:9000/api/auth/invite/preview");
      url.searchParams.set("email", email);
      url.searchParams.set("role", role);

      const current = (() => {
        try {
          return JSON.parse(localStorage.getItem("currentWorkspace") || "null");
        } catch {
          return null;
        }
      })();

      if (current?.id) url.searchParams.set("workspaceId", current.id);

      const res = await fetch(url.toString(), {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(data?.msg || "Preview failed");
        setMessageType("error");
        return null;
      }

      await navigator.clipboard.writeText(data.link);
      setMessage("Invite link copied to clipboard");
      setMessageType("success");

      return data.link;
    } catch {
      setMessage("Server error");
      setMessageType("error");
      return null;
    }
  };

  const handleSocialShare = async (
    platform: "facebook" | "whatsapp" | "instagram"
  ) => {
    const link = await handlePreview();
    if (!link) return;

    if (platform === "facebook") {
      window.open(
        `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`,
        "_blank"
      );
    } else if (platform === "whatsapp") {
      window.open(
        `https://wa.me/?text=${encodeURIComponent("You are invited: " + link)}`,
        "_blank"
      );
    } else {
      alert("Link copied. Paste it into Instagram.");
    }
  };

  useEffect(() => {
    try {
      const state: any = location?.state || {};
      if (state.open === "invite") {
        setTimeout(() => {
          inviteRef.current?.scrollIntoView({ behavior: "smooth" });
          const input = inviteRef.current?.querySelector(
            "input"
          ) as HTMLInputElement | null;
          input?.focus();
        }, 80);
      }
    } catch {}
  }, [location]);

  return (
    <AppLayout>
      <div className="min-h-screen bg-[#0f1115] p-8">
        {showPopup && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div
              className="absolute inset-0 bg-black/70"
              onClick={() => setShowPopup(false)}
            />
            <div className="bg-[#1A1D21] border border-white/10 rounded-xl shadow-2xl p-6 z-10 max-w-sm w-full mx-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-green-500/20 rounded-full">
                  <CheckCircle className="text-green-500" size={24} />
                </div>
                <h3 className="text-lg font-semibold text-white">Email Sent</h3>
              </div>
              <p className="text-sm text-gray-400">{popupText}</p>
              <div className="mt-6 flex justify-end">
                <button onClick={() => setShowPopup(false)} className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition">
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-4 mb-8">
            <button onClick={() => navigate("/dashboard")} className="p-2 hover:bg-white/10 rounded-lg transition text-gray-400 hover:text-white">
              <ArrowLeft size={24} />
            </button>
            <h1 className="text-3xl font-bold text-white">Admin Dashboard</h1>
          </div>

          <div className="bg-[#1A1D21] border border-white/10 rounded-xl shadow-xl p-8" ref={inviteRef}>
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-purple-600/20 rounded-lg">
                <UserPlus className="text-purple-400" size={24} />
              </div>
              <h2 className="text-2xl font-semibold text-white">Invite User</h2>
            </div>

            <div className="space-y-5">
              <div>
                <label className="text-sm font-medium text-gray-300 mb-2 block flex items-center gap-2">
                  <Mail size={16} />
                  Email Address
                </label>
                <input 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  className="w-full p-3 bg-[#0f1115] border border-white/10 rounded-lg text-white focus:border-purple-600 focus:outline-none transition"
                  placeholder="user@example.com"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-300 mb-2 block">Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full p-3 bg-[#0f1115] border border-white/10 rounded-lg text-white focus:border-purple-600 focus:outline-none transition"
                >
                  <option>Developer</option>
                  <option>Sales</option>
                  <option>User</option>
                  <option>Admin</option>
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button 
                  onClick={() => setShowSocial((s) => !s)}
                  className="flex items-center gap-2 px-5 py-3 bg-white/5 text-white rounded-lg hover:bg-white/10 transition font-medium"
                >
                  <Share2 size={18} />
                  Share Via Social
                </button>

                <button 
                  onClick={handleInvite} 
                  disabled={loading}
                  className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-lg hover:from-purple-700 hover:to-purple-800 transition font-medium shadow-lg disabled:opacity-50"
                >
                  <Mail size={18} />
                  {loading ? "Sending..." : "Send Invite"}
                </button>
              </div>

              {message && (
                <div
                  className={`p-4 rounded-lg text-sm font-medium ${
                    messageType === "error"
                      ? "bg-red-500/20 text-red-400 border border-red-500/30"
                      : "bg-green-500/20 text-green-400 border border-green-500/30"
                  }`}
                >
                  {message}
                </div>
              )}

              {showSocial && (
                <div className="flex gap-3 p-4 bg-[#0f1115] rounded-lg border border-white/10">
                  <button 
                    onClick={() => handleSocialShare("facebook")}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                  >
                    <Facebook size={18} />
                    Facebook
                  </button>
                  <button 
                    onClick={() => handleSocialShare("whatsapp")}
                    className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition"
                  >
                    <MessageCircle size={18} />
                    WhatsApp
                  </button>
                  <button 
                    onClick={() => handleSocialShare("instagram")}
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-br from-purple-500 to-pink-500 text-white rounded-lg hover:opacity-80 transition"
                  >
                    <Instagram size={18} />
                    Instagram
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Admin;
