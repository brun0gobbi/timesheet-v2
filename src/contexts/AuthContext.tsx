import React, { createContext, useContext, useState, useEffect } from 'react';
import { AUTH_CONFIG } from '../config/auth';

interface AuthContextType {
    isAuthenticated: boolean;
    login: (password: string) => boolean;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Check for existing session
        const storedAuth = localStorage.getItem(AUTH_CONFIG.STORAGE_KEY);
        if (storedAuth === 'true') {
            setIsAuthenticated(true);
        }
        setIsLoading(false);
    }, []);

    const login = (password: string): boolean => {
        if (password === AUTH_CONFIG.MASTER_PASSWORD) {
            localStorage.setItem(AUTH_CONFIG.STORAGE_KEY, 'true');
            setIsAuthenticated(true);
            return true;
        }
        return false;
    };

    const logout = () => {
        localStorage.removeItem(AUTH_CONFIG.STORAGE_KEY);
        setIsAuthenticated(false);
    };

    if (isLoading) {
        return null; // Don't render anything while checking auth status
    }

    return (
        <AuthContext.Provider value={{ isAuthenticated, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
