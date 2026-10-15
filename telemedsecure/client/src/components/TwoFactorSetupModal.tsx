import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import {
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  Copy,
  Check,
  X,
  Smartphone,
  Lock,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { API_BASE } from '../config';
import { useAuth } from '../context/AuthContext';

interface TwoFactorSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStatusChanged?: (isEnabled: boolean) => void;
}

export const TwoFactorSetupModal: React.FC<TwoFactorSetupModalProps> = ({
  isOpen,
  onClose,
  onStatusChanged
}) => {
  const { getAuthHeaders } = useAuth();

  const [loading, setLoading] = useState(true);
  const [isEnabled, setIsEnabled] = useState(false);
  const [generatedSecret, setGeneratedSecret] = useState<string | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      check2FAStatus();
    }
  }, [isOpen]);

  const check2FAStatus = async () => {
    setLoading(true);
    setStatusMessage(null);
    try {
      const res = await fetch(`${API_BASE}/auth/2fa/status`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setIsEnabled(!!data.isEnabled);
      }
    } catch (e) {
      console.error('Failed to check 2FA status', e);
    } finally {
      setLoading(false);
    }
  };

  const startSetup = async () => {
    setIsSubmitting(true);
    setStatusMessage(null);
    try {
      const res = await fetch(`${API_BASE}/auth/2fa/generate`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setGeneratedSecret(data.secret);
        const qrUrl = await QRCode.toDataURL(data.otpauthUrl, {
          width: 220,
          margin: 1,
          color: { dark: '#0f172a', light: '#ffffff' }
        });
        setQrCodeUrl(qrUrl);
      } else {
        setStatusMessage({ text: 'Failed to generate 2FA key', type: 'error' });
      }
    } catch (e) {
      setStatusMessage({ text: 'Error connecting to server', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyAndEnable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verificationCode || !generatedSecret) return;

    setIsSubmitting(true);
    setStatusMessage(null);
    try {
      const res = await fetch(`${API_BASE}/auth/2fa/enable`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret: generatedSecret, token: verificationCode })
      });
      const data = await res.json();
      if (res.ok) {
        setIsEnabled(true);
        setGeneratedSecret(null);
        setQrCodeUrl(null);
        setVerificationCode('');
        setStatusMessage({ text: '2FA successfully activated on your account!', type: 'success' });
        if (onStatusChanged) onStatusChanged(true);
      } else {
        setStatusMessage({ text: data.error || 'Invalid code. Please try again.', type: 'error' });
      }
    } catch (e) {
      setStatusMessage({ text: 'Verification failed. Please check network.', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDisable2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verificationCode) return;

    setIsSubmitting(true);
    setStatusMessage(null);
    try {
      const res = await fetch(`${API_BASE}/auth/2fa/disable`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: verificationCode })
      });
      const data = await res.json();
      if (res.ok) {
        setIsEnabled(false);
        setVerificationCode('');
        setStatusMessage({ text: '2FA has been disabled.', type: 'success' });
        if (onStatusChanged) onStatusChanged(false);
      } else {
        setStatusMessage({ text: data.error || 'Invalid code. Could not disable 2FA.', type: 'error' });
      }
    } catch (e) {
      setStatusMessage({ text: 'Failed to disable 2FA', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden my-8 p-6 sm:p-8 space-y-6 animate-fadeIn">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Two-Factor Authentication (TOTP)</h3>
              <p className="text-xs text-slate-400">DEA EPCS & HIPAA Multi-Factor Security</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {statusMessage && (
          <div className={`p-4 rounded-2xl text-xs flex items-center space-x-2 ${
            statusMessage.type === 'success'
              ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
              : 'bg-red-500/10 border border-red-500/30 text-red-300'
          }`}>
            {statusMessage.type === 'success' ? <Check className="w-4 h-4 shrink-0 text-emerald-400" /> : <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {loading ? (
          <div className="p-8 text-center text-slate-400 space-y-3">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-purple-400" />
            <p className="text-xs">Checking security status...</p>
          </div>
        ) : isEnabled && !generatedSecret ? (
          /* State: 2FA is currently active */
          <div className="space-y-6">
            <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center space-x-3 text-emerald-300">
              <ShieldCheck className="w-8 h-8 text-emerald-400 shrink-0" />
              <div>
                <h4 className="text-sm font-bold text-white">Two-Factor Authentication is Enabled</h4>
                <p className="text-xs text-slate-300 mt-0.5">
                  Your account is protected by hardware or app-based authenticator codes required during sensitive clinical operations.
                </p>
              </div>
            </div>

            <form onSubmit={handleDisable2FA} className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
              <div>
                <h5 className="text-xs font-bold text-white uppercase tracking-wider">Disable 2FA Protection</h5>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Enter your current 6-digit authenticator code to confirm deactivation.
                </p>
              </div>

              <div>
                <input
                  type="text"
                  maxLength={6}
                  value={verificationCode}
                  onChange={e => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  className="w-full text-center tracking-widest text-lg font-mono px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-red-500"
                />
              </div>

              <button
                type="submit"
                disabled={verificationCode.length !== 6 || isSubmitting}
                className="w-full py-2.5 rounded-xl bg-red-600/20 hover:bg-red-600 text-red-300 hover:text-white border border-red-500/30 font-bold text-xs transition disabled:opacity-50"
              >
                {isSubmitting ? 'Verifying...' : 'Disable Two-Factor Authentication'}
              </button>
            </form>
          </div>
        ) : generatedSecret ? (
          /* State: Setup in progress - Scan QR Code */
          <form onSubmit={handleVerifyAndEnable} className="space-y-5 animate-fadeIn">
            <div className="text-xs text-slate-300 leading-relaxed">
              Scan this QR code with <strong>Google Authenticator</strong>, <strong>Authy</strong>, or your mobile authenticator app.
            </div>

            <div className="flex flex-col items-center justify-center p-4 bg-white rounded-2xl shadow-inner max-w-[240px] mx-auto border border-slate-300">
              {qrCodeUrl ? (
                <img src={qrCodeUrl} alt="2FA QR Code" className="w-48 h-48 object-contain" />
              ) : (
                <div className="w-48 h-48 bg-slate-100 flex items-center justify-center text-slate-400">
                  <RefreshCw className="w-6 h-6 animate-spin" />
                </div>
              )}
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Manual Secret Key:</span>
              <div className="flex items-center justify-between font-mono text-xs text-cyan-400 break-all select-all">
                <span>{generatedSecret}</span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(generatedSecret);
                    setCopiedKey(true);
                    setTimeout(() => setCopiedKey(false), 2000);
                  }}
                  className="p-1 rounded text-slate-400 hover:text-white shrink-0 ml-2"
                >
                  {copiedKey ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                Enter 6-Digit Authenticator Code:
              </label>
              <input
                type="text"
                maxLength={6}
                value={verificationCode}
                onChange={e => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                placeholder="123456"
                required
                className="w-full text-center tracking-widest text-xl font-mono px-4 py-3 rounded-xl bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-purple-500"
              />
            </div>

            <div className="flex items-center space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setGeneratedSecret(null)}
                className="w-1/3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={verificationCode.length !== 6 || isSubmitting}
                className="w-2/3 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs transition shadow-lg shadow-purple-600/30 disabled:opacity-50"
              >
                {isSubmitting ? 'Verifying...' : 'Verify & Enable 2FA'}
              </button>
            </div>
          </form>
        ) : (
          /* State: 2FA is not yet configured */
          <div className="space-y-6">
            <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
              <div className="flex items-center space-x-2 text-amber-400 text-xs font-bold uppercase tracking-wider">
                <ShieldAlert className="w-4 h-4" />
                <span>2FA Protection Not Active</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Enabling Two-Factor Authentication secures your clinical identity against unauthorized access and fulfills DEA EPCS mandatory dual-factor authorization criteria.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center space-x-2 text-xs text-slate-300">
                <Smartphone className="w-4 h-4 text-purple-400 shrink-0" />
                <span>Compatible with Google Authenticator, Microsoft Authenticator, and Authy</span>
              </div>
              <div className="flex items-center space-x-2 text-xs text-slate-300">
                <Lock className="w-4 h-4 text-purple-400 shrink-0" />
                <span>Encrypted time-based one-time password (TOTP - RFC 6238)</span>
              </div>
            </div>

            <button
              type="button"
              onClick={startSetup}
              disabled={isSubmitting}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs transition shadow-lg shadow-purple-600/30 flex items-center justify-center space-x-2"
            >
              <KeyRound className="w-4 h-4" />
              <span>Begin 2FA Setup</span>
            </button>
          </div>
        )}

      </div>
    </div>
  );
};
