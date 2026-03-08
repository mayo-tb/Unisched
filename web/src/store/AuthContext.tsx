import React, { createContext, useContext, useState, useEffect } from "react";
import { authApi, workspacesApi } from "../lib/api";

export interface User {
    id: string;
    name: string;
    email: string;
    role: "ADMIN" | "LECTURER";
    staff_id?: string | null;
    avatar?: string;
}

export interface Workspace {
    id: string;
    name: string;
    lastActive: number;
}

interface AuthContextType {
    user: User | null;
    workspace: Workspace | null;
    login: (credential: string, password: string) => Promise<void>;
    logout: () => void;
    isAuthenticated: boolean;
    isLoading: boolean;
    error: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [workspace, setWorkspace] = useState<Workspace | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Initialize from localStorage
    useEffect(() => {
        const storedUser = localStorage.getItem("gc_user");
        const storedWorkspace = localStorage.getItem("gc_workspace");
        const storedTokens = localStorage.getItem("gc_tokens");

        if (storedUser && storedTokens) {
            setUser(JSON.parse(storedUser));
        }
        if (storedWorkspace) {
            setWorkspace(JSON.parse(storedWorkspace));
        }
    }, []);

    const login = async (credential: string, password: string) => {
        setIsLoading(true);
        setError(null);

        try {
            // 1. Authenticate → get JWT tokens + role
            const { data } = await authApi.login({ credential, password });
            localStorage.setItem(
                "gc_tokens",
                JSON.stringify({ access: data.access, refresh: data.refresh })
            );

            // 2. Build user from login response (no extra /me/ call needed)
            const userData: User = {
                id: String(data.user_id),
                name: data.full_name || data.username,
                email: "",
                role: data.role,
                staff_id: data.staff_id,
            };

            // Optionally fetch full profile for email/avatar
            try {
                const { data: meData } = await authApi.me();
                userData.email = meData.email || "";
                userData.avatar = meData.avatar_url || "";
            } catch {
                // Non-fatal: login response has enough data
            }

            setUser(userData);
            localStorage.setItem("gc_user", JSON.stringify(userData));

            // 3. Load workspace
            try {
                const { data: workspaces } = await workspacesApi.list();
                if (workspaces && workspaces.length > 0) {
                    const firstWs = workspaces[0];
                    const wsData: Workspace = {
                        id: firstWs.id,
                        name: firstWs.name,
                        lastActive: Date.now(),
                    };
                    setWorkspace(wsData);
                    localStorage.setItem("gc_workspace", JSON.stringify(wsData));
                } else {
                    // No workspace yet — create a default one
                    const { data: newWs } = await workspacesApi.create("Default Workspace");
                    const wsData: Workspace = {
                        id: newWs.id,
                        name: newWs.name,
                        lastActive: Date.now(),
                    };
                    setWorkspace(wsData);
                    localStorage.setItem("gc_workspace", JSON.stringify(wsData));
                }
            } catch {
                console.warn("Could not load workspaces after login.");
            }

        } catch (err: any) {
            console.error("Login failed:", err);
            const detail =
                err?.response?.data?.non_field_errors?.[0] ||
                err?.response?.data?.detail ||
                err?.message ||
                "Login failed.";
            setError(String(detail));
            localStorage.removeItem("gc_tokens");
        } finally {
            setIsLoading(false);
        }
    };

    const logout = () => {
        setUser(null);
        setWorkspace(null);
        localStorage.removeItem("gc_user");
        localStorage.removeItem("gc_workspace");
        localStorage.removeItem("gc_tokens");
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                workspace,
                login,
                logout,
                isAuthenticated: !!user,
                isLoading,
                error,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) throw new Error("useAuth must be used within AuthProvider");
    return context;
}
