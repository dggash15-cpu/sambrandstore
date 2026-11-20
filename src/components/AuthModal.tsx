import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  X,
  ShieldCheck,
  LogOut,
  LayoutDashboard,
  LogIn,
  Eye,
  EyeOff,
  Lock,
  KeyRound,
  ArrowLeft,
  CheckCircle2,
} from 'lucide-react';
import { api } from '../lib/api';
import type { AuthUser } from '../types';
import { useTranslation } from '../lib/i18n';

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  user: AuthUser | null;
  onAuthenticated: (user: AuthUser) => void;
  onLogout: () => void;
  onOpenAdmin: () => void;
}

export function AuthModal({
  open,
  onClose,
  user,
  onAuthenticated,
  onLogout,
  onOpenAdmin,
}: AuthModalProps) {
  const { isRtl, lang, translateRole, translateScope } = useTranslation();
  const [mode, setMode] = useState<'login' | 'reset'>('login');
  const [resetMethod, setResetMethod] = useState<'current' | 'code'>('current');

  // Login fields (blank by default so hidden portal never leaks credentials)
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Password reset fields
  const [resetEmail, setResetEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [codeRequested, setCodeRequested] = useState(false);
  const [devCodeHint, setDevCodeHint] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Authenticated inline change password toggle
  const [showProfileChangePw, setShowProfileChangePw] = useState(false);

  useEffect(() => {
    if (!open) {
      setError(null);
      setSuccessMsg(null);
      setPassword('');
      setCurrentPassword('');
      setResetCode('');
      setNewPassword('');
      setConfirmNewPassword('');
      setCodeRequested(false);
      setDevCodeHint(null);
      setShowProfileChangePw(false);
    }
  }, [open]);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await api.login(email, password);
      onAuthenticated(res.user);
      setPassword('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestResetCode = async () => {
    const target = (user?.email || resetEmail).trim();
    if (!target) {
      setError('Enter your admin or employee email first.');
      return;
    }
    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await api.requestPasswordReset(target);
      setCodeRequested(true);
      setDevCodeHint(res.demoVerificationCode || null);
      setSuccessMsg(res.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to request reset code.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (newPassword.trim().length < 6) {
      setError('New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setError('New password and confirmation do not match.');
      return;
    }

    setLoading(true);
    try {
      const targetEmail = (user?.email || resetEmail).trim();
      const res = await api.resetPassword({
        email: targetEmail,
        currentPassword: resetMethod === 'current' ? currentPassword : undefined,
        resetCode: resetMethod === 'code' ? resetCode : undefined,
        newPassword,
      });

      setSuccessMsg(res.message);
      setCurrentPassword('');
      setResetCode('');
      setNewPassword('');
      setConfirmNewPassword('');
      setCodeRequested(false);
      setDevCodeHint(null);

      if (!user) {
        setEmail(targetEmail);
        setTimeout(() => {
          setMode('login');
        }, 900);
      } else {
        setTimeout(() => {
          setShowProfileChangePw(false);
        }, 1200);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reset password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-[#0F1B2D]/65 backdrop-blur-xs"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 10 }}
            className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-[#E6ECF4] bg-white shadow-2xl"
          >
            {/* Branded Top Header */}
            <div className="flex items-center justify-between bg-[#0F1B2D] px-6 py-4 text-white">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="h-5 w-5 text-[#3C9BF0]" />
                <div>
                  <h2 className="font-display text-base font-bold tracking-tight">
                    {user
                      ? (lang === 'ar' ? 'حساب مساحة العمل' : 'Workspace Account')
                      : mode === 'reset'
                      ? (lang === 'ar' ? 'إعادة تعيين كلمة المرور' : 'Reset Staff Password')
                      : (lang === 'ar' ? 'بوابة الإدارة الخاصة' : 'Private Admin Portal')}
                  </h2>
                  <p className="text-[11px] text-[#94A3B8]">
                    {user
                      ? translateRole(user.roleName)
                      : (lang === 'ar' ? 'دخول مقيد للإدارة والموظفين المصرح لهم فقط' : 'Restricted Store Admin & Authorized Staff Access')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close portal modal"
                className="rounded-lg p-1.5 text-[#CBD5E1] hover:bg-white/10 hover:text-white cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className={`p-6 ${isRtl ? 'text-right' : 'text-left'}`}>
              {user ? (
                <div className="space-y-4">
                  <div className="rounded-xl border border-[#E6ECF4] bg-[#F7FAFD] p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-[#1180E1]">
                      {translateRole(user.roleName)}
                    </p>
                    <p className="mt-1 font-display text-lg font-bold text-[#0F1B2D]">
                      {user.name}
                    </p>
                    <p className="text-xs text-[#6B7A8D]">{user.email}</p>

                    <div className="mt-3 border-t border-[#E6ECF4] pt-3 text-xs text-[#475569]">
                      <p>
                        {lang === 'ar' ? 'نطاق القسم:' : 'Department Scope:'}{' '}
                        <span className="font-semibold text-[#0F1B2D]">
                          {translateScope(user.departmentScope)}
                        </span>
                      </p>
                      <p className="mt-1 font-mono text-[11px] text-[#0F1B2D]">
                        {user.permissions.length} {lang === 'ar' ? 'قواعد نشطة · أقصى استرداد $' : 'active rules · Max Refund $'}
                        {user.maxRefundAmount}
                      </p>
                    </div>
                  </div>

                  {error && (
                    <p className="rounded-lg border border-[#FECACA] bg-[#FEF2F2] p-2.5 text-xs font-medium text-[#991B1B]">
                      {error}
                    </p>
                  )}

                  {successMsg && (
                    <p className="flex items-center gap-2 rounded-lg border border-[#BBF7D0] bg-[#F0FDF4] p-2.5 text-xs font-medium text-[#166534]">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-[#16A34A]" />
                      <span>{successMsg}</span>
                    </p>
                  )}

                  {showProfileChangePw ? (
                    <form
                      onSubmit={handleResetSubmit}
                      className="space-y-3 rounded-xl border border-[#E6ECF4] bg-[#F7FAFD] p-4 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-[#0F1B2D]">
                          {lang === 'ar' ? 'تحديث كلمة المرور' : 'Update Password'}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setShowProfileChangePw(false);
                            setError(null);
                          }}
                          className="text-[11px] font-semibold text-[#6B7A8D] hover:text-[#0F1B2D] cursor-pointer"
                        >
                          {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                        </button>
                      </div>

                      <input
                        required
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder={lang === 'ar' ? 'كلمة المرور الحالية' : 'Current password'}
                        className="w-full rounded-lg border border-[#D4DFEE] bg-white px-3 py-2 text-xs focus:border-[#1180E1] focus:outline-none"
                      />
                      <input
                        required
                        minLength={6}
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder={lang === 'ar' ? 'كلمة المرور الجديدة (6+ أحرف)' : 'New password (6+ chars)'}
                        className="w-full rounded-lg border border-[#D4DFEE] bg-white px-3 py-2 text-xs focus:border-[#1180E1] focus:outline-none"
                      />
                      <input
                        required
                        minLength={6}
                        type="password"
                        value={confirmNewPassword}
                        onChange={(e) => setConfirmNewPassword(e.target.value)}
                        placeholder={lang === 'ar' ? 'تأكيد كلمة المرور الجديدة' : 'Confirm new password'}
                        className="w-full rounded-lg border border-[#D4DFEE] bg-white px-3 py-2 text-xs focus:border-[#1180E1] focus:outline-none"
                      />
                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full rounded-lg bg-[#0F1B2D] py-2 font-semibold text-white hover:bg-[#1180E1] disabled:opacity-50 cursor-pointer"
                      >
                        {loading
                          ? (lang === 'ar' ? 'جارٍ التحديث...' : 'Updating...')
                          : (lang === 'ar' ? 'حفظ كلمة المرور الجديدة' : 'Save New Password')}
                      </button>
                    </form>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onOpenAdmin();
                        }}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#1180E1] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#0D6BC0] cursor-pointer"
                      >
                        <LayoutDashboard className="h-4 w-4" />
                        <span>{lang === 'ar' ? 'فتح لوحة تحكم الإدارة' : 'Open Admin Dashboard'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setResetMethod('current');
                          setShowProfileChangePw(true);
                          setError(null);
                          setSuccessMsg(null);
                        }}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[#D4DFEE] bg-white px-4 py-2.5 text-xs font-semibold text-[#0F1B2D] hover:bg-[#F7FAFD] cursor-pointer"
                      >
                        <KeyRound className="h-4 w-4 text-[#1180E1]" />
                        <span>{lang === 'ar' ? 'إعادة تعيين كلمة المرور' : 'Reset My Password'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          onLogout();
                          onClose();
                        }}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[#D4DFEE] bg-white px-4 py-2.5 text-xs font-semibold text-[#0F1B2D] hover:bg-[#FEF2F2] hover:text-[#DC2626] cursor-pointer"
                      >
                        <LogOut className="h-4 w-4" />
                        <span>{lang === 'ar' ? 'تسجيل الخروج' : 'Sign Out'}</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : mode === 'login' ? (
                <>
                  <div className="flex items-start gap-2.5 rounded-xl border border-[#E6ECF4] bg-[#F7FAFD] p-3 text-xs text-[#475569]">
                    <Lock className="mt-0.5 h-4 w-4 shrink-0 text-[#1180E1]" />
                    <p>
                      {lang === 'ar'
                        ? 'مخصص لمدراء وموظفي متجر سام ستور المصرح لهم فقط. أدخل بيانات الدخول للوصول إلى أدوات التحكم بالمتجر.'
                        : 'Authorized Sam Brand Store administrators & staff only. Enter your provisioned credentials to access store controls.'}
                    </p>
                  </div>

                  {error && (
                    <p className="mt-3 rounded-lg border border-[#FECACA] bg-[#FEF2F2] p-2.5 text-xs font-medium text-[#991B1B]">
                      {error}
                    </p>
                  )}

                  {successMsg && (
                    <p className="mt-3 flex items-center gap-2 rounded-lg border border-[#BBF7D0] bg-[#F0FDF4] p-2.5 text-xs font-medium text-[#166534]">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-[#16A34A]" />
                      <span>{successMsg}</span>
                    </p>
                  )}

                  <form onSubmit={handleLoginSubmit} className="mt-4 space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-[#475569]">
                        {lang === 'ar' ? 'البريد الإلكتروني للإدارة / الموظف' : 'Admin / Staff Email'}
                      </label>
                      <input
                        required
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="admin@sambrandstore.com"
                        className="mt-1 w-full rounded-lg border border-[#D4DFEE] px-3 py-2 text-sm focus:border-[#1180E1] focus:outline-none"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-medium text-[#475569]">
                          {lang === 'ar' ? 'كلمة المرور' : 'Password'}
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setResetEmail(email);
                            setMode('reset');
                            setError(null);
                            setSuccessMsg(null);
                          }}
                          className="text-[11px] font-semibold text-[#1180E1] hover:underline cursor-pointer"
                        >
                          {lang === 'ar' ? 'نسيت كلمة المرور؟' : 'Reset password?'}
                        </button>
                      </div>
                      <div className="relative mt-1">
                        <input
                          required
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder={lang === 'ar' ? 'أدخل كلمة المرور' : 'Enter your password'}
                          className="w-full rounded-lg border border-[#D4DFEE] py-2 pl-3 pr-10 text-sm focus:border-[#1180E1] focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                          className={`absolute ${isRtl ? 'left-2.5' : 'right-2.5'} top-1/2 -translate-y-1/2 text-[#6B7A8D] hover:text-[#0F1B2D] cursor-pointer`}
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#0F1B2D] px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-[#1180E1] disabled:opacity-50 cursor-pointer"
                    >
                      <LogIn className="h-4 w-4" />
                      <span>
                        {loading
                          ? (lang === 'ar' ? 'جارٍ التحقق...' : 'Authenticating...')
                          : (lang === 'ar' ? 'تسجيل الدخول لبوابة الإدارة' : 'Sign In to Admin Portal')}
                      </span>
                    </button>
                  </form>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('login');
                      setError(null);
                      setSuccessMsg(null);
                    }}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#475569] hover:text-[#0F1B2D] cursor-pointer"
                  >
                    <ArrowLeft className={`h-3.5 w-3.5 ${isRtl ? 'rotate-180' : ''}`} />
                    <span>{lang === 'ar' ? 'العودة لتسجيل الدخول' : 'Back to Sign In'}</span>
                  </button>

                  {/* Reset Method Toggle */}
                  <div className="mt-3 grid grid-cols-2 gap-1.5 rounded-xl border border-[#E6ECF4] bg-[#F7FAFD] p-1 text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        setResetMethod('current');
                        setError(null);
                      }}
                      className={`rounded-lg py-1.5 font-semibold transition-colors cursor-pointer ${
                        resetMethod === 'current'
                          ? 'bg-white text-[#0F1B2D] shadow-xs'
                          : 'text-[#6B7A8D] hover:text-[#0F1B2D]'
                      }`}
                    >
                      {lang === 'ar' ? 'بكلمة المرور الحالية' : 'Use Current Password'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setResetMethod('code');
                        setError(null);
                      }}
                      className={`rounded-lg py-1.5 font-semibold transition-colors cursor-pointer ${
                        resetMethod === 'code'
                          ? 'bg-white text-[#0F1B2D] shadow-xs'
                          : 'text-[#6B7A8D] hover:text-[#0F1B2D]'
                      }`}
                    >
                      {lang === 'ar' ? 'برمز التحقق' : 'Use Reset Code'}
                    </button>
                  </div>

                  {error && (
                    <p className="mt-3 rounded-lg border border-[#FECACA] bg-[#FEF2F2] p-2.5 text-xs font-medium text-[#991B1B]">
                      {error}
                    </p>
                  )}

                  {successMsg && (
                    <div className="mt-3 rounded-lg border border-[#BBF7D0] bg-[#F0FDF4] p-2.5 text-xs font-medium text-[#166534]">
                      <p>{successMsg}</p>
                      {devCodeHint && (
                        <p className="mt-1 font-mono font-bold text-[#0F1B2D]">
                          {lang === 'ar' ? 'رمز التحقق:' : 'Verification Code:'} {devCodeHint}
                        </p>
                      )}
                    </div>
                  )}

                  <form onSubmit={handleResetSubmit} className="mt-3 space-y-3 text-xs">
                    <div>
                      <label className="block font-medium text-[#475569]">
                        {lang === 'ar' ? 'بريد الحساب' : 'Account Email'}
                      </label>
                      <div className="mt-1 flex gap-2">
                        <input
                          required
                          type="email"
                          value={resetEmail}
                          onChange={(e) => setResetEmail(e.target.value)}
                          placeholder="staff@sambrandstore.com"
                          className="flex-1 rounded-lg border border-[#D4DFEE] px-3 py-2 text-sm focus:border-[#1180E1] focus:outline-none"
                        />
                        {resetMethod === 'code' && (
                          <button
                            type="button"
                            disabled={loading}
                            onClick={handleRequestResetCode}
                            className="rounded-lg bg-[#1180E1] px-3 py-2 font-semibold text-white hover:bg-[#0D6BC0] whitespace-nowrap disabled:opacity-50 cursor-pointer"
                          >
                            {codeRequested
                              ? (lang === 'ar' ? 'إعادة الإرسال' : 'Resend')
                              : (lang === 'ar' ? 'طلب الرمز' : 'Get Code')}
                          </button>
                        )}
                      </div>
                    </div>

                    {resetMethod === 'current' ? (
                      <div>
                        <label className="block font-medium text-[#475569]">
                          {lang === 'ar' ? 'كلمة المرور الحالية' : 'Current Password'}
                        </label>
                        <input
                          required
                          type="password"
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          placeholder={lang === 'ar' ? 'أدخل كلمة المرور الحالية' : 'Enter existing password'}
                          className="mt-1 w-full rounded-lg border border-[#D4DFEE] px-3 py-2 text-sm focus:border-[#1180E1] focus:outline-none"
                        />
                      </div>
                    ) : (
                      <div>
                        <label className="block font-medium text-[#475569]">
                          {lang === 'ar' ? 'رمز التحقق (6 أرقام)' : '6-Digit Reset Verification Code'}
                        </label>
                        <input
                          required
                          type="text"
                          inputMode="numeric"
                          maxLength={6}
                          value={resetCode}
                          onChange={(e) => setResetCode(e.target.value.replace(/\D/g, ''))}
                          placeholder={lang === 'ar' ? 'أدخل الرمز' : 'Enter 6-digit code'}
                          className="mt-1 w-full rounded-lg border border-[#D4DFEE] px-3 py-2 font-mono text-sm focus:border-[#1180E1] focus:outline-none"
                        />
                      </div>
                    )}

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label className="block font-medium text-[#475569]">
                          {lang === 'ar' ? 'كلمة المرور الجديدة' : 'New Password'}
                        </label>
                        <input
                          required
                          minLength={6}
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder={lang === 'ar' ? '6+ أحرف' : '6+ characters'}
                          className="mt-1 w-full rounded-lg border border-[#D4DFEE] px-3 py-2 text-sm focus:border-[#1180E1] focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block font-medium text-[#475569]">
                          {lang === 'ar' ? 'تأكيد كلمة المرور' : 'Confirm'}
                        </label>
                        <input
                          required
                          minLength={6}
                          type="password"
                          value={confirmNewPassword}
                          onChange={(e) => setConfirmNewPassword(e.target.value)}
                          placeholder={lang === 'ar' ? 'أعد إدخال كلمة المرور' : 'Repeat password'}
                          className="mt-1 w-full rounded-lg border border-[#D4DFEE] px-3 py-2 text-sm focus:border-[#1180E1] focus:outline-none"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#0F1B2D] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#1180E1] disabled:opacity-50 cursor-pointer"
                    >
                      <KeyRound className="h-4 w-4" />
                      <span>
                        {loading
                          ? (lang === 'ar' ? 'جارٍ التحديث...' : 'Updating Password...')
                          : (lang === 'ar' ? 'تأكيد إعادة التعيين' : 'Confirm Password Reset')}
                      </span>
                    </button>
                  </form>
                </>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
