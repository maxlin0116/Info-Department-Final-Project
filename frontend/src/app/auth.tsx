import { createContext, useContext, useState } from "react";

const STORAGE_KEY = "mks-auth";
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL
  ? import.meta.env.VITE_API_BASE_URL.replace(/\/$/, "")
  : "";

export interface AuthUser {
  id: string;
  name: string;
  grade: string;
  studentId: string;
  personalEmail: string;
  role: string;
}

interface AuthState {
  token: string | null;
  user: AuthUser | null;
}

interface LoginInput {
  studentId: string;
  password: string;
}

interface RegisterInput {
  name: string;
  grade: string;
  studentId: string;
  personalEmail: string;
  password: string;
}

interface AuthContextValue {
  token: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function normalizeUser(payload: unknown): AuthUser {
  const source = (payload ?? {}) as Record<string, unknown>;

  return {
    id: String(source.id ?? source._id ?? ""),
    name: String(source.name ?? ""),
    grade: String(source.grade ?? ""),
    studentId: String(source.studentId ?? source.student_id ?? ""),
    personalEmail: String(source.personalEmail ?? source.personal_email ?? ""),
    role: String(source.role ?? "user"),
  };
}

function loadStoredAuth(): AuthState {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return { token: null, user: null };
  }

  try {
    const parsed = JSON.parse(raw) as Partial<AuthState>;
    return {
      token: typeof parsed.token === "string" ? parsed.token : null,
      user: parsed.user ? normalizeUser(parsed.user) : null,
    };
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
    return { token: null, user: null };
  }
}

function persistAuth(state: AuthState) {
  if (!state.token || !state.user) {
    window.localStorage.removeItem(STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

async function readApiPayload(response: Response) {
  const text = await response.text();
  let payload: unknown = null;

  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { error: text };
    }
  }

  if (!response.ok) {
    const source = payload as { error?: unknown } | null;
    throw new Error(
      source && typeof source.error === "string"
        ? source.error
        : "Request failed with status " + response.status
    );
  }

  return payload;
}

function getEndpoint(path: string) {
  return API_BASE_URL ? API_BASE_URL + path : path;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>(loadStoredAuth);
  const isAuthenticated = Boolean(authState.token && authState.user);

  const login = async ({ studentId, password }: LoginInput) => {
    const response = await fetch(getEndpoint("/api/auth/login"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ studentId, password }),
    });

    const payload = (await readApiPayload(response)) as {
      token: string;
      user: unknown;
    };

    const nextState = {
      token: payload.token,
      user: normalizeUser(payload.user),
    };

    setAuthState(nextState);
    persistAuth(nextState);
  };

  const register = async ({ name, grade, studentId, personalEmail, password }: RegisterInput) => {
    const response = await fetch(getEndpoint("/api/auth/register"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        grade,
        studentId,
        personalEmail,
        password,
      }),
    });

    const payload = (await readApiPayload(response)) as {
      token: string;
      user: unknown;
    };

    const nextState = {
      token: payload.token,
      user: normalizeUser(payload.user),
    };

    setAuthState(nextState);
    persistAuth(nextState);
  };

  const logout = () => {
    const nextState = { token: null, user: null };
    setAuthState(nextState);
    persistAuth(nextState);
  };

  return (
    <AuthContext.Provider
      value={{
        token: authState.token,
        user: authState.user,
        isAuthenticated,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return value;
}
