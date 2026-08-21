import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import useAuth from '../../hooks/useAuth';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ShieldCheck, Mail, ArrowLeft, Loader2, RefreshCw, Eye, EyeOff, Gem } from 'lucide-react';
import toast from 'react-hot-toast';
import authService from '../../services/authService';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

const LoginPage = () => {
  const { login, verifyOtp, resendOtp, isAuthenticated, isLoading, user } = useAuth();
  const navigate = useNavigate();

  // Step state: 'credentials' | 'otp'
  const [step, setStep] = useState('credentials');
  const [showPassword, setShowPassword] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(loginSchema),
  });

  // Already authenticated → redirect to role-based dashboard
  if (isAuthenticated && user) {
    const path = authService.getRoleDashboardPath(user.role);
    return <Navigate to={path} replace />;
  }

  const onSubmitCredentials = async (data) => {
    try {
      const res = await login(data.email, data.password);
      if (res && res.require_otp) {
        setUserEmail(data.email);
        setMaskedEmail(res.masked_email || data.email);
        setStep('otp');
        toast.success(res.message || 'OTP sent to your email address!');
      } else if (res && res.role) {
        toast.success(`Welcome back, ${res.full_name?.split(' ')[0] || 'User'}!`);
        const dashPath = authService.getRoleDashboardPath(res.role);
        navigate(dashPath, { replace: true });
      }
    } catch (error) {
      const msg =
        error.response?.data?.detail ||
        error.response?.data?.message ||
        'Login failed. Check your credentials.';
      toast.error(msg);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!otpCode || otpCode.length !== 6) {
      toast.error('Please enter the 6-digit OTP code sent to your email.');
      return;
    }

    setIsVerifying(true);
    try {
      const loggedInUser = await verifyOtp(userEmail, otpCode);
      toast.success(`OTP Verified! Welcome back, ${loggedInUser.full_name?.split(' ')[0] || 'Admin'}!`);
      const dashPath = authService.getRoleDashboardPath(loggedInUser.role);
      navigate(dashPath, { replace: true });
    } catch (error) {
      const msg =
        error.response?.data?.detail ||
        'Invalid or expired OTP code. Please try again.';
      toast.error(msg);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResendOtp = async () => {
    if (!userEmail) return;
    setIsResending(true);
    try {
      await resendOtp(userEmail);
      toast.success('A new OTP has been sent to your email address!');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to resend OTP.');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Logo + Brand */}
      <div className="text-center space-y-3">
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-2xl bg-[#C9972A]/15 text-[#8B6914] flex items-center justify-center shadow-sm">
            <Gem size={28} />
          </div>
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground" style={{ fontFamily: "'Playfair Display', serif" }}>
            Bindu Jewellery
          </h1>
          <p className="text-sm text-muted-foreground font-medium">Marketing App — Business Growth System</p>
        </div>
      </div>

      <Card className="shadow-xl border-border/50 backdrop-blur-sm">
        {step === 'credentials' ? (
          <>
            <CardHeader className="space-y-1 pb-4">
              <CardTitle className="text-lg font-semibold">Sign in to your account</CardTitle>
              <CardDescription className="text-sm">
                Enter your credentials to access your dashboard
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit(onSubmitCredentials)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="admin@bindujewellery.com"
                    autoComplete="email"
                    {...register('email')}
                    className={errors.email ? 'border-destructive focus-visible:ring-destructive' : ''}
                  />
                  {errors.email && (
                    <p className="text-xs text-destructive">{errors.email.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    <span className="text-xs text-muted-foreground cursor-not-allowed opacity-60">
                      Forgot password?
                    </span>
                  </div>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      {...register('password')}
                      className={`pr-10 ${errors.password ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none transition-colors p-1"
                      title={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="text-xs text-destructive">{errors.password.message}</p>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full bg-[#C9972A] hover:bg-[#7A5500] text-white font-semibold transition-colors"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 size={16} className="animate-spin mr-2" />
                      Authenticating…
                    </>
                  ) : (
                    'Sign In'
                  )}
                </Button>
              </form>
            </CardContent>
          </>
        ) : (
          /* Step 2: OTP Verification */
          <>
            <CardHeader className="space-y-1 pb-4 text-center">
              <div className="w-12 h-12 rounded-full bg-amber-100 text-[#C9972A] flex items-center justify-center mx-auto mb-2">
                <ShieldCheck size={24} />
              </div>
              <CardTitle className="text-lg font-bold text-gray-900">Security OTP Required</CardTitle>
              <CardDescription className="text-xs text-gray-500">
                A 6-digit verification code has been sent to:
              </CardDescription>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 border border-amber-200 rounded-full text-xs font-bold text-[#C9972A] mx-auto mt-1">
                <Mail size={12} /> {maskedEmail || userEmail}
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div className="space-y-2 text-center">
                  <Label htmlFor="otp" className="text-xs uppercase tracking-wider font-bold text-gray-600 block">
                    Enter 6-Digit OTP Code
                  </Label>
                  <Input
                    id="otp"
                    type="text"
                    maxLength={6}
                    autoFocus
                    placeholder="1 2 3 4 5 6"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, ''))}
                    className="text-center text-xl font-bold tracking-[0.4em] h-12 bg-white border-2 border-[#C9972A]/50 focus:border-[#C9972A] rounded-xl"
                  />
                  <p className="text-[11px] text-gray-400">Code expires in 5 minutes</p>
                </div>

                <Button
                  type="submit"
                  disabled={isVerifying || otpCode.length !== 6}
                  className="w-full bg-[#C9972A] hover:bg-[#7A5500] text-white font-bold h-11 rounded-xl transition-all shadow-md shadow-[#C9972A]/20"
                >
                  {isVerifying ? (
                    <>
                      <Loader2 size={16} className="animate-spin mr-2" />
                      Verifying OTP…
                    </>
                  ) : (
                    'Verify OTP & Sign In'
                  )}
                </Button>

                <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => { setStep('credentials'); setOtpCode(''); }}
                    className="text-xs text-gray-500 hover:text-gray-900 font-semibold flex items-center gap-1"
                  >
                    <ArrowLeft size={12} /> Back to Sign In
                  </button>

                  <button
                    type="button"
                    disabled={isResending}
                    onClick={handleResendOtp}
                    className="text-xs text-[#C9972A] hover:text-amber-700 font-bold flex items-center gap-1 disabled:opacity-50"
                  >
                    <RefreshCw size={12} className={isResending ? 'animate-spin' : ''} />
                    {isResending ? 'Sending...' : 'Resend Code'}
                  </button>
                </div>
              </form>
            </CardContent>
          </>
        )}
      </Card>

      {/* Role hint badges */}
      <div className="text-center">
        <p className="text-xs text-muted-foreground mb-2">Access levels</p>
        <div className="flex justify-center gap-2 flex-wrap">
          {[
            { label: 'Admin (OTP Secured)', color: 'bg-red-100 text-red-700' },
            { label: 'Owner (OTP Secured)', color: 'bg-amber-100 text-amber-700' },
            { label: 'Staff', color: 'bg-green-100 text-green-700' },
          ].map((r) => (
            <span key={r.label} className={`px-2 py-0.5 rounded-full text-xs font-medium ${r.color}`}>
              {r.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
