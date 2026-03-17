import { useNavigate, useLocation } from "react-router-dom";
import { useState, useRef, useEffect } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { Mail, UserPlus, Share2, Facebook, MessageCircle, Instagram, ArrowLeft, CheckCircle, FileSpreadsheet, ChevronDown, Trash2 } from "lucide-react";
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
  const [toastType, setToastType] = useState<"success" | "error">("success");
  const [membersOpen, setMembersOpen] = useState(false);
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<any>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  const VALID_ROLES = ["Developer", "Sales", "User", "Admin"];

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast(msg);
    setToastType(type);
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
    if (!valid) { showToast("Please upload Correct file", "error"); e.target.value = ""; return; }
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
      if (entries.length === 0) { showToast("Upload Correct File", "error"); setCsvEntries([]); }
      else { setCsvEntries(entries); showToast(entries.length+" user(s) loaded from file", "success"); }
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
        showToast("Upload Correct File", "error");
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

  const handleRemoveUser = async (userId: string) => {
    if (removingUserId) return;
    
    const token = localStorage.getItem("token");
    if (!token) { navigate("/login"); return; }

    const ws = (() => {
      try { return JSON.parse(localStorage.getItem("currentWorkspace") || "null"); }
      catch { return null; }
    })();

    if (!ws?.id) {
      showToast("Select a workspace", "error");
      return;
    }

    setRemovingUserId(userId);
    try {
      const res = await fetch(`${API_URL}/api/workspaces/${ws.id}/members/${userId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        setUsers(prev => prev.filter(u => u._id !== userId));
        showToast("User removed from workspace", "success");
      } else {
        const data = await res.json();
        showToast(data?.msg || "Failed to remove user", "error");
      }
    } catch (e) {
      showToast("Error removing user", "error");
      console.error(e);
    } finally {
      setRemovingUserId(null);
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
    if (!token) {
      console.warn('No token found');
      return;
    }
    const ws = (() => { try { return JSON.parse(localStorage.getItem("currentWorkspace") || "null"); } catch { return null; } })();
    if (!ws?.id) {
      console.warn('No workspace ID found');
      return;
    }
    
    const url = `${API_URL}/api/workspaces/${ws.id}`;
    console.log('Fetching workspace from:', url);
    
    fetch(url, { 
      method: 'GET',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      } 
    })
      .then(r => {
        console.log('Response status:', r.status, r.statusText);
        return r.json();
      })
      .then(d => {
        console.log('Workspace response:', d);
        if (d.workspace) {
          setWorkspace(d.workspace);
          const membersList = d.workspace?.members || [];
          console.log('Members list:', membersList, 'Count:', membersList.length);
          setUsers(membersList);
        } else {
          console.warn('No workspace object in response');
        }
      })
      .catch(e => {
        console.error('Fetch error:', e);
      });
  }, []);

  return (
    <AppLayout>
      {toast && (<div className={`fixed top-6 right-6 z-[100] text-sm px-6 py-4 rounded-lg shadow-2xl border transition-all duration-300 animate-in fade-in slide-in-from-right-4 ${toastType === "success" ? "bg-gradient-to-r from-green-600 to-emerald-600 border-green-400 text-white font-medium shadow-green-500/20" : "bg-gradient-to-r from-red-600 to-rose-600 border-red-400 text-white font-medium shadow-red-500/20"}`}>{toast}</div>)}
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
            <button onClick={() => navigate("/dashboard")} className="p-2 hover:bg-white/10 rounded-lg transition text-gray-400 hover:text-white hover:scale-110">
              <ArrowLeft size={24} />
            </button>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">Admin Dashboard</h1>
              <p className="text-sm text-gray-500 mt-1">Manage workspace members and invitations</p>
            </div>
          </div>

          <div className="bg-gradient-to-br from-[#1A1D21] to-[#0f1115] border border-white/10 rounded-xl shadow-2xl p-8" ref={inviteRef}>
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-gradient-to-br from-purple-600 to-purple-800 rounded-lg shadow-lg shadow-purple-500/20">
                <UserPlus className="text-purple-300" size={24} />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">Invite User</h2>
                <p className="text-xs text-gray-400 mt-1">Send invitations to new team members</p>
              </div>
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

              <div className="flex items-center justify-between pt-2 gap-3 flex-wrap">
                <div className="flex gap-3 flex-wrap">
                  <button onClick={() => setShowSocial((s) => !s)} className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition font-medium shadow-lg hover:shadow-blue-500/20"><Share2 size={18} />Share Via Social</button>
                  <button type="button" onClick={() => csvInputRef.current?.click()} className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 transition font-medium shadow-lg hover:shadow-green-500/20"><FileSpreadsheet size={18} /> Upload CSV File</button>
                  <input ref={csvInputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleCsvUpload} />
                </div>
                <button onClick={handleInvite} disabled={loading} className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-lg hover:from-purple-700 hover:to-purple-800 transition font-medium shadow-lg hover:shadow-purple-500/20 disabled:opacity-50 disabled:cursor-not-allowed"><Mail size={18} />{loading ? "Sending..." : "Send Invite"}</button>
              </div>
              {csvEntries.length > 0 && (<p className="text-xs text-green-400 font-medium">✓ {csvEntries.length} user(s) ready from CSV</p>)}

              {message && (
                <div
                  className={`p-4 rounded-lg text-sm font-medium border transition-all ${ messageType === "error"
                      ? "bg-red-600/20 text-red-400 border border-red-500/40"
                      : "bg-green-600/20 text-green-400 border border-green-500/40"
                  }`}
                >
                  {message}
                </div>
              )}

              {showSocial && (
                <div className="flex gap-3 p-4 bg-gradient-to-r from-[#0f1115] to-[#1A1D21] rounded-lg border border-white/10 items-center flex-wrap">
                  <button 
                    onClick={() => handleSocialShare("facebook")}
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition shadow-lg hover:shadow-blue-500/20"
                  >
                    <Facebook size={18} />
                    Facebook
                  </button>
                  <button 
                    onClick={() => handleSocialShare("whatsapp")}
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:from-green-600 hover:to-green-700 transition shadow-lg hover:shadow-green-500/20"
                  >
                    <MessageCircle size={18} />
                    WhatsApp
                  </button>
                  <button 
                    onClick={() => handleSocialShare("instagram")}
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-br from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 transition shadow-lg hover:shadow-purple-500/20"
                  >
                    <Instagram size={18} />
                    Instagram
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
          {users.length > 0 && (<div className="max-w-4xl mx-auto"><div className="bg-gradient-to-br from-[#1A1D21] to-[#0f1115] border border-white/10 rounded-xl shadow-2xl mt-6 overflow-hidden"><button onClick={() => setMembersOpen(o => !o)} className="w-full flex items-center justify-between p-8 text-left hover:bg-white/5 transition group"><div className="flex items-center gap-4 flex-1"><div className="relative"><div className="p-3 bg-gradient-to-br from-purple-600 to-purple-800 rounded-lg group-hover:shadow-lg group-hover:shadow-purple-500/50 transition"><UserPlus className="text-purple-300" size={24} /></div></div><div><h2 className="text-2xl font-bold text-white">Workspace Members <span className="text-sm text-gray-400 font-normal">({users.length})</span></h2><p className="text-xs text-gray-500 mt-1">{workspace?.name || "Current Workspace"}</p></div></div><div className="flex items-center gap-4">{workspace?.image && <img src={imgUrl(workspace.image)} className="w-12 h-12 rounded-lg object-cover border border-white/20" />}<ChevronDown size={20} className={`text-gray-400 transition-transform duration-200 ${membersOpen ? 'rotate-180' : ''}`} /></div></button>{membersOpen && (<div className="px-8 pb-8 pt-4"><div className="space-y-3">{users.map(u => (<div key={u._id} className="flex items-center justify-between p-4 bg-[#0f1115]/50 rounded-lg hover:bg-white/5 transition border border-white/5 group"><div className="flex items-center gap-3 flex-1"><div className="relative">{u.avatar ? (<img src={imgUrl(u.avatar)} className="w-12 h-12 rounded-full object-cover border border-white/20" />) : (<div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-600 to-purple-800 flex items-center justify-center text-white font-bold text-sm">{u.name?.charAt(0)?.toUpperCase()}</div>)}</div><div><p className="text-sm text-white font-semibold">{u.name}</p><p className="text-xs text-gray-400">{u.email}</p></div></div><div className="flex items-center gap-2"><span className={`text-xs px-3 py-1 rounded-full font-medium ${ u.Role === "Admin" ? "bg-red-600/20 text-red-400" : u.Role === "Developer" ? "bg-blue-600/20 text-blue-400" : u.Role === "Sales" ? "bg-yellow-600/20 text-yellow-400" : "bg-purple-600/20 text-purple-400"}`}>{u.Role}</span><button onClick={() => setSelectedUser(u)} className="text-xs px-3 py-1.5 bg-white/5 text-gray-300 rounded-lg hover:bg-blue-600/30 hover:text-blue-300 transition">View Profile</button><button onClick={() => handleRemoveUser(u._id)} disabled={removingUserId === u._id} className="text-xs px-2 py-1.5 bg-red-600/20 text-red-400 rounded-lg hover:bg-red-600/40 transition disabled:opacity-50 flex items-center gap-1"><Trash2 size={14} /> {removingUserId === u._id ? '...' : 'Remove'}</button></div></div>))}</div></div>)}</div></div>)}
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
