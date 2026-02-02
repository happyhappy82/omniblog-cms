import { useState, useEffect } from 'react';
import { AuthSession } from '../types';
import { CONFIG } from '../config';

const SESSION_KEY = 'omni_auth_session';

export const useAuth = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // 비밀번호 해싱 (SHA-256)
  const hashPassword = async (password: string): Promise<string> => {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  // 세션 검증 (7일 만료)
  const checkSession = (): boolean => {
    const stored = localStorage.getItem(SESSION_KEY);
    if (!stored) return false;

    try {
      const session: AuthSession = JSON.parse(stored);
      const daysSinceLogin = (Date.now() - session.timestamp) / (1000 * 60 * 60 * 24);

      if (daysSinceLogin > CONFIG.SESSION_DURATION_DAYS) {
        localStorage.removeItem(SESSION_KEY);
        return false;
      }

      return session.isAuthenticated;
    } catch (error) {
      console.error('Session validation error:', error);
      localStorage.removeItem(SESSION_KEY);
      return false;
    }
  };

  // 로그인 처리
  const login = async (password: string): Promise<boolean> => {
    const envPassword = import.meta.env.VITE_APP_PASSWORD;

    if (!envPassword || password !== envPassword) {
      return false;
    }

    const session: AuthSession = {
      isAuthenticated: true,
      timestamp: Date.now(),
      passwordHash: await hashPassword(password)
    };

    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    setIsAuthenticated(true);
    return true;
  };

  // 로그아웃 처리
  const logout = () => {
    localStorage.removeItem(SESSION_KEY);
    setIsAuthenticated(false);
  };

  // 초기 세션 확인
  useEffect(() => {
    const isValid = checkSession();
    setIsAuthenticated(isValid);
    setIsLoading(false);
  }, []);

  return {
    isAuthenticated,
    isLoading,
    login,
    logout
  };
};
