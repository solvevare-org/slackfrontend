import { useNavigate, useLocation } from "react-router-dom";
import { useState, useRef, useEffect } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { Mail, UserPlus, Share2, Facebook, MessageCircle, Instagram, ArrowLeft, CheckCircle, FileSpreadsheet, ChevronDown } from "lucide-react";
import { API_URL } from "@/lib/config";
import ProfileSession from "@/components/layout/ProfileSession";
import { imgUrl } from "@/lib/utils";
import * as XLSX from "xlsx";

const Admin = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const inviteRef = useRef<HTMLDivElement | null>(null);

  const [emailInput, setEmailInput] = useState("");
  const [emails, setEmails] = useState<string[]>([]);
  const [role, setRole] = useState("User");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"error" | "success" | "">("");
  const [showSocial, setShowSocial] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [popupText, setPopupText] = useState("");
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [csvEntries, setCsvEntries] = useState<{ email: string; role: string }[]>([]);
  const [toast, setToast] = useState("");
  const [membersOpen, setMembersOpen] = useState(false);
  const csvInputRef = useRef<HTMLInputElement>(null);

  const VALID_ROLES = ["Developer", "Sales", "User", "Admin"];

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  };

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const validateEmail = (value: string) => /\S+@\S+\.\S+/.test(value);

  const parseEmails = (val: string): string[] =>
    val.split(",").map(e => e.trim()).filter(e => e.length > 0);

  const handleEmailKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "," || e.key === "Enter") {
      e.preventDefault();
      const newEmails = parseEmails(emailInput).filter(em => validateEmail(em) && !emails.includes(em));
      if (newEmails.length) setEmails(prev => [...prev, ...newEmails]);
      setEmailInput("");
        setCsvEntries([]);
    }
  };

  const handleEmailBlur = () => {
    const newEmails = parseEmails(emailInput).filter(em => validateEmail(em) && !emails.includes(em));
    if (newEmails.length) setEmails(prev => [...prev, ...newEmails]);
    setEmailInput("");
        setCsvEntries([]);
  };

  const removeEmail = (em: string) => setEmails(prev => prev.filter(e => e !== em));

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const name = file.name.toLowerCase();
    const valid = name.endsWith(".csv") || name.endsWith(".xlsx") || name.endsWith(".xls");
    if (!valid) { showToast("Please upload Correct file"); e.target.value = ""; return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const data = new Uint8Array(ev.target?.result as ArrayBuffer);
      const wb = XLSX.read(data, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });
      const entries: { email: string; role: string }[] = [];
      for (const row of rows) {
        const em = String(row["email"] || row["Email"] || "").trim();
        const rl = String(row["role"] || row["Role"] || "").trim();
        const normalizedRole = VALID_ROLES.find(r => r.toLowerCase() === rl.toLowerCase());
        if (validateEmail(em) && normalizedRole) entries.push({ email: em, role: normalizedRole });
      }
      if (entries.length === 0) { showToast("Upload Correct File"); setCsvEntries([]); }
      else { setCsvEntries(entries); showToast(entries.length+" user(s) loaded from file"); }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  };

  const handleInvite = async () => {
    if (loading) return;

    const manualEmails = [...emails, ...parseEmails(emailInput).filter(validateEmail)];
    const manualEntries = manualEmails.map(em => ({ email: em, role }));
    const allEntries = [...manualEntries, ...csvEntries];

    if (allEntries.length === 0) {
      if (csvEntries.length === 0 && manualEmails.length === 0) {
        showToast("Upload Correct File");
      }
      setMessage("At least one valid email is required");
      setMessageType("error");
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) { navigate("/login"); return; }

    const current = (() => {
      try { return JSON.parse(localStorage.getItem("currentWorkspace") || "null"); }
      catch { return null; }
    })();

    if (!current?.id) {
      setMessage("Select a workspace before inviting");
      setMessageType("error");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const results = await Promise.all(
        allEntries.map(({ email: em, role: rl }) =>
          fetch(`${API_URL}/api/auth/invite`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ email: em, role: rl, workspaceId: current.id }),
          }).then(r => r.json().then(d => ({ ok: r.ok, email: em, msg: d?.msg })))
        )
      );

      const failed = results.filter(r => !r.ok);
      if (failed.length) {
        setMessage(`Failed: ${failed.map(f => f.email).join(", ")}`);
        setMessageType("error");
      } else {
        setMessage("Invites sent successfully");
        setMessageType("success");
        setPopupText(`Confirmation: Invites sent to ${allEntries.map(e => e.email).join(", ")}`);
        setShowPopup(true);
        setEmails([]);
        setEmailInput("");
        setCsvEntries([]);
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
    const firstEmail = emails[0] || parseEmails(emailInput).find(validateEmail) || "";
    if (!validateEmail(firstEmail)) {
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
      const url = new URL(`${API_URL}/api/auth/invite/preview`);
      url.searchParams.set("email", firstEmail);
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

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    const ws = (() => { try { return JSON.parse(localStorage.getItem("currentWorkspace") || "null"); } catch { return null; } })();
    if (!ws?.id) return;
    fetch(`${API_URL}/api/workspaces/${ws.id}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => setUsers(d.workspace?.members || [])).catch(() => {});
  }, []);

  return (
    <AppLayout>
      {toast && (<div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] bg-[#1A1D21] border border-white/10 text-white text-sm px-5 py-3 rounded-lg shadow-xl">{toast}</div>)}
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
                <div className="w-full min-h-[48px] p-2 bg-[#0f1115] border border-white/10 rounded-lg flex flex-wrap gap-2 focus-within:border-purple-600 transition cursor-text" onClick={() => (document.getElementById('email-tag-input') as HTMLInputElement)?.focus()}>
                  {emails.map(em => (
                    <span key={em} className="flex items-center gap-1 bg-purple-600/30 text-purple-300 text-sm px-2 py-1 rounded-full">
                      {em}
                      <button type="button" onClick={() => removeEmail(em)} className="text-purple-300 hover:text-white leading-none">&times;</button>
                    </span>
                  ))}
                  <input
                    id="email-tag-input"
                    value={emailInput}
                    onChange={e => setEmailInput(e.target.value)}
                    onKeyDown={handleEmailKeyDown}
                    onBlur={handleEmailBlur}
                    className="flex-1 min-w-[160px] bg-transparent text-white outline-none text-sm py-1 px-1"
                    placeholder={emails.length === 0 ? "user@example.com, user2@example.com" : "Add more..."}
                  />
                </div>
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

              <div className="flex items-center justify-between pt-2">
                <div className="flex gap-3">
                  <button onClick={() => setShowSocial((s) => !s)} className="flex items-center gap-2 px-5 py-3 bg-white/5 text-white rounded-lg hover:bg-white/10 transition font-medium"><Share2 size={18} />Share Via Social</button>
                  <button type="button" onClick={() => csvInputRef.current?.click()} className="flex items-center gap-2 px-5 py-3 bg-white/5 text-white rounded-lg hover:bg-white/10 transition font-medium"><FileSpreadsheet size={18} /> Upload CSV File</button>
                  <input ref={csvInputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleCsvUpload} />
                </div>
                <button onClick={handleInvite} disabled={loading} className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-lg hover:from-purple-700 hover:to-purple-800 transition font-medium shadow-lg disabled:opacity-50"><Mail size={18} />{loading ? "Sending..." : "Send Invite"}</button>
              </div>
              {csvEntries.length > 0 && (<p className="text-xs text-green-400">{csvEntries.length} user(s) ready from CSV</p>)}

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
          {users.length > 0 && (<div className="max-w-4xl mx-auto"><div className="bg-[#1A1D21] border border-white/10 rounded-xl shadow-xl mt-6 overflow-hidden"><button onClick={() => setMembersOpen(o => !o)} className="w-full flex items-center justify-between p-8 text-left hover:bg-white/5 transition"><div className="flex items-center gap-3"><div className="p-3 bg-purple-600/20 rounded-lg"><UserPlus className="text-purple-400" size={24} /></div><h2 className="text-2xl font-semibold text-white">Workspace Members <span className="text-sm text-gray-400 font-normal">({users.length})</span></h2></div><ChevronDown size={20} className={`text-gray-400 transition-transform duration-200 ${membersOpen ? 'rotate-180' : ''}`} /></button>{membersOpen && (<div className="px-8 pb-8"><div className="space-y-2">{users.map(u => (<div key={u._id} className="flex items-center justify-between p-3 bg-[#0f1115] rounded-lg hover:bg-white/5 transition"><div className="flex items-center gap-3">{u.avatar ? (<img src={imgUrl(u.avatar)} className="w-9 h-9 rounded-full object-cover" />) : (<div className="w-9 h-9 rounded-full bg-purple-600/40 flex items-center justify-center text-white font-bold text-sm">{u.name?.charAt(0)?.toUpperCase()}</div>)}<div><p className="text-sm text-white font-medium">{u.name}</p><p className="text-xs text-gray-400">{u.email}</p></div></div><div className="flex items-center gap-3"><span className="text-xs px-2 py-1 bg-purple-600/20 text-purple-400 rounded-full">{u.Role}</span><button onClick={() => setSelectedUser(u)} className="text-xs px-3 py-1.5 bg-white/5 text-gray-300 rounded-lg hover:bg-white/10 transition">View Profile</button></div></div>))}</div></div>)}</div></div>)}
        </div>
          {selectedUser && (
        <ProfileSession
          isOpen={true}
          onClose={() => setSelectedUser(null)}
          user={selectedUser}
          isOwnProfile={false}
          isAdmin={true}
          onRoleChange={(uid, newRole) => setUsers(prev => prev.map(u => u._id === uid ? { ...u, Role: newRole } : u))}
        />
      )}
    </AppLayout>
  );
};

export default Admin;
