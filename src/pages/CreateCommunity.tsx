import { useEffect, useState, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import AppLayout from "@/components/layout/AppLayout";

interface IUser {
  _id: string;
  name?: string;
}

const CreateCommunity = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [name, setName] = useState("");
  const [members, setMembers] = useState<string[]>([]);
  const [admins, setAdmins] = useState<string[]>([]);
  const [allUsers, setAllUsers] = useState<IUser[]>([]);
  const [image, setImage] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [creating, setCreating] = useState(false);
  const [showUserPicker, setShowUserPicker] = useState(false);

  const pickerRef = useRef<HTMLDivElement | null>(null);

  /* ================= CLOSE PICKER ================= */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!pickerRef.current) return;
      if (!(e.target instanceof Node)) return;
      if (!pickerRef.current.contains(e.target)) {
        setShowUserPicker(false);
      }
    };

    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  /* ================= FETCH USERS ================= */
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }

    fetch("http://72.60.97.98:6006/api/user/", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d?.result)) {
          setAllUsers(d.result);
        }
      })
      .catch(() => {});
  }, [navigate]);

  useEffect(() => {
    try {
      const state: any = (location && (location.state as any)) || {};
      if (state.open === "community") {
        setTimeout(() => {
          containerRef.current?.scrollIntoView({ behavior: "smooth" });
          const input = containerRef.current?.querySelector("input") as HTMLInputElement | null;
          if (input) input.focus();
        }, 80);
      }
    } catch (e) {}
  }, [location]);

  /* ================= TOGGLE MEMBER ================= */
  const toggleMember = (id: string) => {
    setMembers((prev) => {
      const exists = prev.includes(id);
      if (exists) {
        setAdmins((a) => a.filter((x) => x !== id));
        return prev.filter((x) => x !== id);
      }
      return [...prev, id];
    });
  };

  /* ================= TOGGLE ADMIN ================= */
  const toggleAdmin = (id: string) => {
    setAdmins((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : [...prev, id]
    );
  };

  /* ================= CREATE COMMUNITY ================= */
  const handleCreate = async () => {
    if (creating) return;

    if (!name.trim()) {
      setMessage("Community name is required");
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }

    setCreating(true);
    setMessage("");

    try {
      const fd = new FormData();
      fd.append("name", name.trim());
      fd.append("members", JSON.stringify(members));
      fd.append("admins", JSON.stringify(admins));
      if (image) fd.append("image", image);

      const res = await fetch(
        "http://72.60.97.98:6006/api/community",
        {
          method: "POST",
          body: fd,
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const data = await res.json();

      if (!res.ok) {
        setMessage(data?.msg || "Create failed");
      } else {
        const id = data?.group?._id || data?.group?.id;
        if (id) navigate(`/group/${id}`);
        else navigate("/dashboard");
      }
    } catch {
      setMessage("Server error");
    } finally {
      setCreating(false);
    }
  };

  return (
    <AppLayout>
      <div className="min-h-full p-8 bg-transparent">
        <div
          ref={containerRef}
          className={
            (location && (location.state as any) && (location.state as any).open === 'community')
              ? 'max-w-6xl mx-auto bg-white p-12 rounded shadow h-[80vh] overflow-auto'
              : 'max-w-2xl mx-auto bg-white p-6 rounded shadow'
          }
        >
          <h1 className="text-2xl font-semibold mb-4">
            Create Community
          </h1>

          {/* NAME */}
          <label className="text-sm">Community Name</label>
          <Input
            value={name}
            onChange={(e) =>
              setName((e.target as HTMLInputElement).value)
            }
          />

          <p className="text-xs text-gray-500 mt-2">
            Members are hidden from each other in communities.
          </p>

          {/* MEMBERS */}
          <label className="text-sm mt-4 block">
            Add Members
          </label>

          <div className="relative mt-2">
            <div className="flex items-center justify-between border p-2 rounded">
              <div className="text-sm text-gray-700">
                {members.length
                  ? `${members.length} selected`
                  : "No members selected"}
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowUserPicker((s) => !s);
                }}
                className="p-2 rounded bg-gray-100"
              >
                +
              </button>
            </div>

            {showUserPicker && (
              <div
                ref={pickerRef}
                className="absolute left-0 right-0 mt-2 bg-white border rounded shadow max-h-60 overflow-y-auto z-50 p-2"
              >
                {allUsers.map((u) => (
                  <div
                    key={u._id}
                    className="flex items-center justify-between p-1"
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={members.includes(u._id)}
                        onChange={() =>
                          toggleMember(u._id)
                        }
                      />
                      <div>{u.name}</div>
                    </div>

                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={admins.includes(u._id)}
                        onChange={() => {
                          if (
                            !members.includes(u._id)
                          )
                            toggleMember(u._id);
                          toggleAdmin(u._id);
                        }}
                      />
                      Admin
                    </label>
                  </div>
                ))}

                <div className="flex justify-end mt-2">
                  <button
                    onClick={() =>
                      setShowUserPicker(false)
                    }
                    className="text-sm text-gray-500"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* IMAGE */}
          <label className="text-sm mt-4 block">
            Community Image (optional)
          </label>
          <input
            type="file"
            onChange={(e) =>
              setImage(
                e.target.files
                  ? e.target.files[0]
                  : null
              )
            }
            className="mt-2"
          />

          {/* MESSAGE */}
          {message && (
            <div className="mt-4 text-sm text-red-600">
              {message}
            </div>
          )}

          {/* ACTIONS */}
          <div className="mt-4 flex gap-2">
            <Button
              onClick={handleCreate}
              disabled={creating}
            >
              {creating
                ? "Creating..."
                : "Create Community"}
            </Button>

            <Button
              onClick={() =>
                navigate("/dashboard")
              }
              variant="ghost"
            >
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default CreateCommunity;
