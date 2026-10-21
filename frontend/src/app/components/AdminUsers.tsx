import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router";
import {
  AlertCircle,
  Check,
  Copy,
  KeyRound,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  UserX,
  X,
} from "lucide-react";
import { useAuth } from "../auth";
import { useLanguage, translateGrade } from "../i18n";

interface ManagedUser {
  id: string;
  name: string;
  grade: string;
  studentId: string;
  personalEmail: string;
  role: "admin" | "user" | string;
  mustChangePassword?: boolean;
  isActive?: boolean;
  createdAt: string;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL
  ? import.meta.env.VITE_API_BASE_URL.replace(/\/$/, "")
  : "";

const GRADE_OPTIONS = [
  { value: "Freshman", zh: "大一", en: "Freshman" },
  { value: "Sophomore", zh: "大二", en: "Sophomore" },
  { value: "Junior", zh: "大三", en: "Junior" },
  { value: "Senior", zh: "大四", en: "Senior" },
  { value: "Master's", zh: "碩士班", en: "Master's" },
  { value: "PhD", zh: "博士班", en: "PhD" },
];

export function AdminUsers() {
  const { user: currentUser, token, isAuthenticated } = useAuth();
  const { lang, tx } = useLanguage();

  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Create User Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newUserData, setNewUserData] = useState({
    name: "",
    grade: "Freshman",
    studentId: "",
    personalEmail: "",
    role: "user",
    password: "",
  });
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Password Reveal Modal (after creation or reset)
  const [revealedCredentials, setRevealedCredentials] = useState<{
    studentId: string;
    name: string;
    temporaryPassword: string;
    title: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  // Delete User Confirmation Modal
  const [userToDelete, setUserToDelete] = useState<ManagedUser | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fetchUsers = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || tx("無法載入使用者清單", "Failed to load users"));
      }
      setUsers(data.users || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : tx("取得使用者列表錯誤", "Error fetching user list"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated && currentUser?.role === "admin" && token) {
      fetchUsers();
    }
  }, [token, isAuthenticated, currentUser?.role]);

  const handleCopyPassword = () => {
    if (!revealedCredentials) return;
    navigator.clipboard.writeText(revealedCredentials.temporaryPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setCreateSubmitting(true);
    setCreateError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(newUserData),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || tx("建立使用者失敗", "Failed to create user"));
      }

      setShowCreateModal(false);
      setNewUserData({
        name: "",
        grade: "Freshman",
        studentId: "",
        personalEmail: "",
        role: "user",
        password: "",
      });

      setRevealedCredentials({
        studentId: data.user.studentId,
        name: data.user.name,
        temporaryPassword: data.temporaryPassword,
        title: tx("帳號已成功建立", "Account Created Successfully"),
      });

      fetchUsers();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : tx("建立使用者失敗", "Failed to create user"));
    } finally {
      setCreateSubmitting(false);
    }
  };

  const handleResetPassword = async (user: ManagedUser) => {
    if (!token) return;
    if (!window.confirm(tx(`確定要為 ${user.name} (${user.studentId}) 生成新的臨時密碼嗎？`, `Generate a new temporary password for ${user.name} (${user.studentId})?`))) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/users/${user.id}/reset-password`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || tx("重設密碼失敗", "Failed to reset password"));
      }

      setRevealedCredentials({
        studentId: user.studentId,
        name: user.name,
        temporaryPassword: data.temporaryPassword,
        title: tx("已生成重設密碼", "Password Reset Generated"),
      });

      fetchUsers();
    } catch (err) {
      alert(err instanceof Error ? err.message : tx("重設密碼失敗", "Failed to reset password"));
    }
  };

  const handleToggleRole = async (user: ManagedUser) => {
    if (!token) return;
    if (user.id === currentUser?.id) {
      alert(tx("您不能修改自己的管理員權限。", "You cannot modify your own administrative role."));
      return;
    }

    const nextRole = user.role === "admin" ? "user" : "admin";
    if (!window.confirm(tx(`將 ${user.name} 的角色變更為 "${nextRole.toUpperCase()}" 嗎？`, `Change ${user.name}'s role to "${nextRole.toUpperCase()}"?`))) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/users/${user.id}/role`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ role: nextRole }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || tx("更新角色失敗", "Failed to update role"));
      }

      fetchUsers();
    } catch (err) {
      alert(err instanceof Error ? err.message : tx("更新角色失敗", "Failed to update role"));
    }
  };

  const handleToggleStatus = async (user: ManagedUser) => {
    if (!token) return;
    if (user.id === currentUser?.id) {
      alert(tx("您不能停用自己的帳號。", "You cannot suspend your own account."));
      return;
    }

    const nextStatus = user.isActive === false ? true : false;
    const actionLabel = nextStatus ? tx("啟用", "activate") : tx("停權", "suspend");

    if (!window.confirm(tx(`確定要${actionLabel}帳號 ${user.name} (${user.studentId}) 嗎？`, `Are you sure you want to ${actionLabel} account ${user.name} (${user.studentId})?`))) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/users/${user.id}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ isActive: nextStatus }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || tx("更新狀態失敗", "Failed to update status"));
      }

      fetchUsers();
    } catch (err) {
      alert(err instanceof Error ? err.message : tx("更新狀態失敗", "Failed to update status"));
    }
  };

  const handleDeleteUser = async () => {
    if (!token || !userToDelete) return;
    setDeleteSubmitting(true);
    setDeleteError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/users/${userToDelete.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || tx("刪除使用者失敗", "Failed to delete user"));
      }

      setUserToDelete(null);
      fetchUsers();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : tx("刪除使用者失敗", "Failed to delete user"));
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const q = searchQuery.trim().toLowerCase();
      const matchesQuery =
        !q ||
        u.name.toLowerCase().includes(q) ||
        u.studentId.toLowerCase().includes(q) ||
        u.personalEmail.toLowerCase().includes(q);

      const matchesRole = roleFilter === "all" || u.role === roleFilter;

      const isSuspended = u.isActive === false;
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && !isSuspended) ||
        (statusFilter === "suspended" && isSuspended);

      return matchesQuery && matchesRole && matchesStatus;
    });
  }, [users, searchQuery, roleFilter, statusFilter]);

  const stats = useMemo(() => {
    const total = users.length;
    const admins = users.filter((u) => u.role === "admin").length;
    const suspended = users.filter((u) => u.isActive === false).length;
    const pendingPwd = users.filter((u) => u.mustChangePassword).length;
    return { total, admins, suspended, pendingPwd };
  }, [users]);

  if (!isAuthenticated || currentUser?.role !== "admin") {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30">
              <Users className="w-5 h-5 text-cyan-400" />
            </div>
            <h1 className="text-2xl font-bold font-mono text-slate-100 tracking-tight">{tx("帳號與權限管理", "Account Administration")}</h1>
          </div>
          <p className="text-xs text-slate-400">
            {tx("集中管理使用者名冊、發行臨時密碼與調整管理權限。", "Centrally manage user roster, issue temporary passwords, and regulate permissions.")}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchUsers}
            disabled={loading}
            className="p-2.5 rounded-lg border border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-slate-100 transition-colors cursor-pointer"
            title={tx("重新整理使用者", "Refresh Users")}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs font-mono rounded-lg transition-all shadow-[0_0_15px_rgba(16,185,129,0.2)] flex items-center gap-2 cursor-pointer uppercase tracking-tight"
          >
            <UserPlus className="w-4 h-4" />
            {tx("新增帳號", "Add User")}
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/40">
          <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500">{tx("總使用者數", "Total Users")}</div>
          <div className="text-2xl font-bold font-mono text-slate-100 mt-1">{stats.total}</div>
        </div>
        <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/40">
          <div className="text-[10px] font-mono uppercase tracking-widest text-amber-500">{tx("管理員", "Admins")}</div>
          <div className="text-2xl font-bold font-mono text-amber-300 mt-1">{stats.admins}</div>
        </div>
        <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/40">
          <div className="text-[10px] font-mono uppercase tracking-widest text-rose-500">{tx("停權帳號", "Suspended")}</div>
          <div className="text-2xl font-bold font-mono text-rose-400 mt-1">{stats.suspended}</div>
        </div>
        <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/40">
          <div className="text-[10px] font-mono uppercase tracking-widest text-cyan-500">{tx("持臨時密碼", "Temp Passwords")}</div>
          <div className="text-2xl font-bold font-mono text-cyan-300 mt-1">{stats.pendingPwd}</div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-slate-900/40 p-3 rounded-xl border border-slate-800">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={tx("搜尋學號、姓名、電子郵件...", "Search student ID, name, email...")}
            className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none"
          >
            <option value="all">{tx("所有角色", "All Roles")}</option>
            <option value="user">{tx("僅一般使用者", "Users only")}</option>
            <option value="admin">{tx("僅管理員", "Admins only")}</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none"
          >
            <option value="all">{tx("所有狀態", "All Statuses")}</option>
            <option value="active">{tx("僅正常帳號", "Active only")}</option>
            <option value="suspended">{tx("僅停權帳號", "Suspended only")}</option>
          </select>
        </div>
      </div>

      {/* Error alert */}
      {error && (
        <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300 text-xs flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Users Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/30 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 border-b border-slate-800 text-[10px] uppercase font-mono tracking-wider text-slate-400">
              <tr>
                <th className="px-5 py-3">{tx("學號", "Student ID")}</th>
                <th className="px-5 py-3">{tx("姓名與年級", "Name & Grade")}</th>
                <th className="px-5 py-3">{tx("電子郵件", "Email")}</th>
                <th className="px-5 py-3">{tx("角色", "Role")}</th>
                <th className="px-5 py-3">{tx("狀態", "Status")}</th>
                <th className="px-5 py-3">{tx("密碼狀態", "Password")}</th>
                <th className="px-5 py-3 text-right">{tx("操作", "Actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {loading && users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-500">
                    {tx("載入帳號清單中...", "Loading accounts...")}
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-500">
                    {tx("沒有符合條件的使用者。", "No users matching criteria.")}
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const isCurrentUser = u.id === currentUser?.id;
                  const isSuspended = u.isActive === false;

                  return (
                    <tr
                      key={u.id}
                      className={`hover:bg-slate-900/50 transition-colors ${
                        isSuspended ? "opacity-60 bg-rose-950/10" : ""
                      }`}
                    >
                      <td className="px-5 py-3.5 font-bold text-slate-200">
                        {u.studentId}
                        {isCurrentUser && (
                          <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-normal">
                            {tx("目前帳號", "You")}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="text-slate-200 font-sans font-medium">{u.name}</div>
                        <div className="text-[10px] text-slate-500">{translateGrade(u.grade, lang)}</div>
                      </td>
                      <td className="px-5 py-3.5 text-slate-400 font-sans">{u.personalEmail}</td>
                      <td className="px-5 py-3.5">
                        <button
                          onClick={() => handleToggleRole(u)}
                          disabled={isCurrentUser}
                          title={isCurrentUser ? tx("無法變更自己的權限", "Cannot change own role") : tx("點擊切換角色", "Click to toggle role")}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-semibold uppercase tracking-wider transition-all ${
                            u.role === "admin"
                              ? "bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25"
                              : "bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700"
                          } ${isCurrentUser ? "cursor-not-allowed opacity-80" : "cursor-pointer"}`}
                        >
                          <Shield className="w-3 h-3" />
                          {u.role}
                        </button>
                      </td>
                      <td className="px-5 py-3.5">
                        <button
                          onClick={() => handleToggleStatus(u)}
                          disabled={isCurrentUser}
                          title={isCurrentUser ? tx("無法停用自己的帳號", "Cannot suspend yourself") : tx("點擊切換狀態", "Click to toggle status")}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-semibold uppercase tracking-wider transition-all ${
                            isSuspended
                              ? "bg-rose-500/15 text-rose-300 border border-rose-500/30 hover:bg-rose-500/25"
                              : "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25"
                          } ${isCurrentUser ? "cursor-not-allowed opacity-80" : "cursor-pointer"}`}
                        >
                          {isSuspended ? <UserX className="w-3 h-3" /> : <UserCheck className="w-3 h-3" />}
                          {isSuspended ? tx("已停權", "Suspended") : tx("正常", "Active")}
                        </button>
                      </td>
                      <td className="px-5 py-3.5">
                        {u.mustChangePassword ? (
                          <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                            {tx("待變更 (臨時)", "Temp Active")}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-500">{tx("已建立", "Established")}</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right space-x-1">
                        <button
                          onClick={() => handleResetPassword(u)}
                          className="px-2.5 py-1 text-[11px] rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors inline-flex items-center gap-1 cursor-pointer"
                          title={tx("生成新的臨時密碼", "Generate new temporary password")}
                        >
                          <KeyRound className="w-3 h-3 text-cyan-400" />
                          {tx("重設", "Reset")}
                        </button>
                        {!isCurrentUser && (
                          <button
                            onClick={() => {
                              setUserToDelete(u);
                              setDeleteError(null);
                            }}
                            className="p-1.5 rounded bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-300 border border-slate-700 hover:border-rose-800 transition-colors cursor-pointer inline-flex items-center"
                            title={tx("刪除帳號", "Delete Account")}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE USER MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-slate-100 font-bold font-mono">
                <UserPlus className="w-4 h-4 text-emerald-400" />
                {tx("新增使用者帳號", "Add New User Account")}
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-500 hover:text-slate-300 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {createError && (
              <div className="p-3 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-300 text-xs">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateUser} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-slate-400 font-medium">{tx("學號（1個英文字母 + 8個數字）", "Student ID (1 letter + 8 digits)")}</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. b11901001"
                  value={newUserData.studentId}
                  onChange={(e) => setNewUserData({ ...newUserData, studentId: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-400 font-medium">{tx("完整姓名", "Full Name")}</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Alice Chen"
                  value={newUserData.name}
                  onChange={(e) => setNewUserData({ ...newUserData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-400 font-medium">{tx("年級", "Grade")}</label>
                  <select
                    value={newUserData.grade}
                    onChange={(e) => setNewUserData({ ...newUserData, grade: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500"
                  >
                    {GRADE_OPTIONS.map((g) => (
                      <option key={g.value} value={g.value}>{lang === "zh" ? g.zh : g.en}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-slate-400 font-medium">{tx("角色", "Role")}</label>
                  <select
                    value={newUserData.role}
                    onChange={(e) => setNewUserData({ ...newUserData, role: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-slate-400 font-medium">{tx("個人或學校 Email", "Personal / School Email")}</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. student@ntu.edu.tw"
                  value={newUserData.personalEmail}
                  onChange={(e) => setNewUserData({ ...newUserData, personalEmail: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-400 font-medium">{tx("初始密碼（選填）", "Initial Password (Optional)")}</label>
                <input
                  type="text"
                  placeholder={tx("留空將自動生成安全隨機密碼", "Leave blank to auto-generate secure password")}
                  value={newUserData.password}
                  onChange={(e) => setNewUserData({ ...newUserData, password: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  {tx("取消", "Cancel")}
                </button>
                <button
                  type="submit"
                  disabled={createSubmitting}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg transition-colors cursor-pointer disabled:opacity-60"
                >
                  {createSubmitting ? tx("建立中...", "Creating...") : tx("建立帳號", "Create Account")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREDENTIAL REVEAL MODAL */}
      {revealedCredentials && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-cyan-500/40 rounded-2xl p-6 max-w-md w-full shadow-[0_0_40px_rgba(6,182,212,0.2)] space-y-5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-cyan-500/15 border border-cyan-500/30 rounded-xl">
                <KeyRound className="w-5 h-5 text-cyan-300" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-100">{revealedCredentials.title}</h3>
                <p className="text-xs text-slate-400">
                  {tx("帳號: ", "Account: ")}<span className="font-mono text-cyan-300">{revealedCredentials.studentId}</span> ({revealedCredentials.name})
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-slate-800 bg-slate-950 space-y-2">
              <div className="text-[10px] uppercase font-mono tracking-wider text-slate-500">
                {tx("臨時初始密碼", "Temporary Initial Password")}
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="font-mono text-lg font-bold text-emerald-400 tracking-wider select-all">
                  {revealedCredentials.temporaryPassword}
                </span>
                <button
                  onClick={handleCopyPassword}
                  className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-mono inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? tx("已複製", "Copied") : tx("複製", "Copy")}
                </button>
              </div>
            </div>

            <div className="text-xs text-slate-400 bg-slate-950/60 p-3 rounded-lg border border-slate-800 space-y-1 leading-relaxed">
              <span className="font-semibold text-slate-300 block">{tx("後續步驟：", "Next Steps:")}</span>
              {tx("請透過官方 NTU 管道將此憑證交付使用者。使用者於首次登入時將被要求設定新密碼。", "Share this credential with the user through official NTU channels. The user will be requested to set a new password on their first login.")}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setRevealedCredentials(null)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-100 font-medium text-xs rounded-lg transition-colors cursor-pointer"
              >
                {tx("完成", "Done")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-rose-500/40 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-rose-500/15 border border-rose-500/30 rounded-xl">
                <ShieldAlert className="w-5 h-5 text-rose-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-100">{tx("確認刪除帳號", "Confirm Account Deletion")}</h3>
                <p className="text-xs text-slate-400">
                  {userToDelete.name} (<span className="font-mono">{userToDelete.studentId}</span>)
                </p>
              </div>
            </div>

            {deleteError && (
              <div className="p-3 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-300 text-xs">
                {deleteError}
              </div>
            )}

            <p className="text-xs text-slate-300 leading-relaxed">
              {tx("確定要永久刪除此使用者嗎？若該使用者已有歷史預約記錄，建議改用「停權」以保留審計紀錄。", "Are you sure you want to permanently delete this user? If this user has previous reservations, consider suspending the account instead to preserve audit logs.")}
            </p>

            <div className="pt-2 flex items-center justify-end gap-2 text-xs">
              <button
                onClick={() => setUserToDelete(null)}
                className="px-4 py-2 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors cursor-pointer"
              >
                {tx("取消", "Cancel")}
              </button>
              <button
                onClick={handleDeleteUser}
                disabled={deleteSubmitting}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg transition-colors cursor-pointer disabled:opacity-60"
              >
                {deleteSubmitting ? tx("刪除中...", "Deleting...") : tx("永久刪除", "Permanently Delete")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
