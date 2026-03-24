'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Shield, Eye, EyeOff, AlertTriangle, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(searchParams.get('error') ? 'Invalid credentials' : '');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await signIn('credentials', {
        email: email.toLowerCase().trim(),
        password,
        redirect: false,
      });

      if (result?.error) {
        setError(result.error === 'CredentialsSignin'
          ? 'Invalid email or password'
          : result.error);
        setLoading(false);
      } else {
        router.push('/overview');
        router.refresh();
      }
    } catch {
      setError('Connection error. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      {/* Background grid effect */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(245, 158, 11, 0.3) 1px, transparent 1px),
            linear-gradient(90deg, rgba(245, 158, 11, 0.3) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
        }}
      />

      {/* Ambient glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full opacity-[0.04]"
        style={{ background: 'radial-gradient(circle, #f59e0b 0%, transparent 70%)' }}
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 w-full max-w-[420px] mx-4"
      >
        {/* Logo + branding */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.15, duration: 0.5 }}
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-5"
            style={{
              background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(20, 184, 166, 0.1))',
              border: '1px solid rgba(245, 158, 11, 0.2)',
            }}
          >
            <Shield className="w-8 h-8 text-vemio-amber" />
          </motion.div>

          <h1 className="text-2xl font-bold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
            <span className="text-vemio-amber">VEMIO</span>
            <span className="text-vemio-text-dim text-sm font-medium align-super ml-0.5">™</span>
          </h1>
          <p className="text-vemio-text-muted text-sm mt-1">
            Network Intelligence Dashboard
          </p>
        </div>

        {/* Login card */}
        <div
          className="rounded-2xl p-8"
          style={{
            background: 'var(--color-vemio-surface)',
            border: '1px solid var(--color-vemio-border)',
            boxShadow: '0 4px 24px rgba(0, 0, 0, 0.3)',
          }}
        >
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Error message */}
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="flex items-start gap-2 p-3 rounded-lg text-sm"
                style={{
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  color: '#fca5a5',
                }}
              >
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </motion.div>
            )}

            {/* Email */}
            <div>
              <label className="block text-xs font-medium text-vemio-text-muted mb-2 uppercase tracking-wider">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                autoComplete="email"
                placeholder="you@company.com"
                className="w-full px-4 py-3 rounded-lg text-sm transition-all duration-200 placeholder:text-vemio-text-dim"
                style={{
                  background: 'var(--color-vemio-surface-raised)',
                  border: '1px solid var(--color-vemio-border)',
                  color: 'var(--color-vemio-text)',
                  outline: 'none',
                }}
                onFocus={(e) => e.target.style.borderColor = 'var(--color-vemio-amber)'}
                onBlur={(e) => e.target.style.borderColor = 'var(--color-vemio-border)'}
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-medium text-vemio-text-muted mb-2 uppercase tracking-wider">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="w-full px-4 py-3 pr-11 rounded-lg text-sm transition-all duration-200 placeholder:text-vemio-text-dim"
                  style={{
                    background: 'var(--color-vemio-surface-raised)',
                    border: '1px solid var(--color-vemio-border)',
                    color: 'var(--color-vemio-text)',
                    outline: 'none',
                  }}
                  onFocus={(e) => e.target.style.borderColor = 'var(--color-vemio-amber)'}
                  onBlur={(e) => e.target.style.borderColor = 'var(--color-vemio-border)'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-vemio-text-dim hover:text-vemio-text transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !email || !password}
              className="w-full py-3 rounded-lg text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: loading
                  ? 'rgba(245, 158, 11, 0.3)'
                  : 'linear-gradient(135deg, #f59e0b, #d97706)',
                color: '#0a0e17',
                boxShadow: loading ? 'none' : '0 2px 12px rgba(245, 158, 11, 0.3)',
              }}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Authenticating...
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-vemio-text-dim mt-6">
          Secured by{' '}
          <a
            href="https://vinayenterprises.co.in"
            target="_blank"
            rel="noopener noreferrer"
            className="text-vemio-text-muted hover:text-vemio-amber transition-colors"
          >
            Vinay Enterprises
          </a>
          {' '}· Est. 1992
        </p>
      </motion.div>
    </div>
  );
}
