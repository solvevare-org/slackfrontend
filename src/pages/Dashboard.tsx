import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";

interface IUser {
  _id?: string;
  id?: string;
  name?: string;
  role?: string;
  Role?: string;
}

const Dashboard = () => {
  const navigate = useNavigate();

  const [user, setUser] = useState<IUser | null>(null);
  const [users, setUsers] = useState<IUser[]>([]);
  const [loading, setLoading] = useState(true);

  const roleStr = (user?.role || user?.Role || "").toLowerCase();
  const isAdmin = roleStr === "admin";

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    const token = localStorage.getItem("token");

    if (!storedUser || !token) {
      navigate("/login");
      return;
    }

    const parsedUser: IUser = JSON.parse(storedUser);
    setUser(parsedUser);

    // Fetch all users
    fetch("http://localhost:9000/api/user/", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data?.result && Array.isArray(data.result)) {
          const filteredUsers = data.result.filter(
            (u: IUser) =>
              u._id !== parsedUser._id && u._id !== parsedUser.id
          );
          setUsers(filteredUsers);
        }
      })
      .catch((err) => {
        console.error("User fetch error:", err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="w-64 bg-gray-900 text-white p-4">
        <h2 className="text-2xl font-bold mb-8">Slack Clone</h2>

        <div className="space-y-4">
          <Button variant="ghost" className="w-full justify-start text-white hover:bg-gray-800">
            # general
          </Button>
          <Button variant="ghost" className="w-full justify-start text-white hover:bg-gray-800">
            # frontend
          </Button>
          <Button variant="ghost" className="w-full justify-start text-white hover:bg-gray-800">
            # backend
          </Button>
        </div>

        <div className="mt-8 pt-8 border-t border-gray-700">
          <h3 className="text-sm font-semibold text-gray-400 mb-4">
            Direct Messages
          </h3>

          {loading ? (
            <div className="text-sm text-gray-400">Loading...</div>
          ) : users.length > 0 ? (
            users.map((u) => (
              <Button
                key={u._id}
                variant="ghost"
                onClick={() => navigate(`/dm/${u._id}`)}
                className="w-full justify-start text-white hover:bg-gray-800 text-sm"
              >
                {u.name}
              </Button>
            ))
          ) : (
            <div className="text-sm text-gray-400">No users found</div>
          )}
        </div>
      </div>

      {/* Main Section */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 p-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-800"># general</h1>

          <div className="flex items-center gap-4">
            {user && (
              <div className="text-sm text-gray-600 text-right">
                <div className="font-semibold">
                  {user.name || "User"}
                </div>
                <div className="text-xs text-gray-500">
                  Role:{" "}
                  <span className="font-medium text-gray-700">
                    {user.role || user.Role || "member"}
                  </span>
                </div>
              </div>
            )}

            {isAdmin && (
              <Button onClick={() => navigate("/admin")}>
                Admin
              </Button>
            )}

            <Button
              variant="ghost"
              onClick={handleLogout}
              className="text-red-600 hover:bg-red-50"
            >
              Logout
            </Button>
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-4">
          <p className="text-gray-500 text-center py-8">
            Welcome to #general
          </p>
        </div>

        {/* Message Input */}
        <div className="bg-white border-t border-gray-200 p-4">
          <input
            type="text"
            placeholder="Type a message..."
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600"
          />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
