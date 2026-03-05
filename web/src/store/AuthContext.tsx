import React, { createContext, useContext, useState, useEffect } from "react";
import { authApi, workspacesApi } from "../lib/api";

export interface User {
    id: string;
    name: string;
    email: string;
    role: "admin" | "faculty" | "student";
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
    login: (role: "admin" | "faculty") => Promise<void>;
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

    const login = async (role: "admin" | "faculty") => {
        setIsLoading(true);
        setError(null);

        try {
            const credentials =
                role === "admin"
                    ? { username: "admin", password: "adminpass123" }
                    : { username: "faculty", password: "facultypass123" };

            // 1. Authenticate → get JWT tokens
            const { data: tokens } = await authApi.login(credentials);
            localStorage.setItem("gc_tokens", JSON.stringify(tokens));

            // 2. Fetch real profile from backend
            const { data: meData } = await authApi.me();
            const userData: User = {
                id: String(meData.id),
                name: meData.username,
                email: meData.email || "",
                role: (meData.role as User["role"]) || role,
            };
            setUser(userData);
            localStorage.setItem("gc_user", JSON.stringify(userData));

            // FIX: Load the REAL first workspace from the API instead of
            // hardcoding 'default-ws' which caused all resource API calls
            // to fail with 404/400 since 'default-ws' doesn't exist in the DB.
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
                // Non-fatal: workspace loading failed, user can still navigate
                console.warn("Could not load workspaces after login.");
            }

        } catch (err: any) {
            console.error("Login failed:", err);
            const detail = err?.response?.data?.detail || err?.message || "Login failed.";
            setError(String(detail));
            // Clean up any partial tokens
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
