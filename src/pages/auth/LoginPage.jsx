import React from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import useAuth from '../../hooks/useAuth';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Gem, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import authService from '../../services/authService';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

const LoginPage = () => {
  const { login, isAuthenticated, isLoading, user } = useAuth();
  const navigate = useNavigate();

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(loginSchema),
  });

  // Already authenticated → redirect to role-based dashboard
  if (isAuthenticated && user) {
    const path = authService.getRoleDashboardPath(user.role);
    return <Navigate to={path} replace />;
  }

  const onSubmit = async (data) => {
    try {
      const loggedInUser = await login(data.email, data.password);
      toast.success(`Welcome back, ${loggedInUser.full_name?.split(' ')[0] || 'User'}!`);
      // Role-based redirect
      const dashPath = authService.getRoleDashboardPath(loggedInUser.role);
      navigate(dashPath, { replace: true });
    } catch (error) {
      const msg =
        error.response?.data?.detail ||
        error.response?.data?.message ||
        'Login failed. Check your credentials.';
      toast.error(msg);
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Logo + Brand */}
      <div className="text-center space-y-3">
        <div className="flex justify-center">
          <div className="w-16 h-16 flex items-center justify-center shadow-lg">
            <img src="/logo-gold.png" alt="Bindu Jewellery" className="w-16 h-16 object-contain" />
          </div>
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground" style={{ fontFamily: "'Playfair Display', serif" }}>
            Bindu Jewellery
          </h1>
          <p className="text-sm text-muted-foreground">Business Growth System</p>
        </div>
      </div>

      <Card className="shadow-xl border-border/50 backdrop-blur-sm">
        <CardHeader className="space-y-1 pb-4">
          <CardTitle className="text-lg font-semibold">Sign in to your account</CardTitle>
          <CardDescription className="text-sm">
            Enter your credentials to access your dashboard
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                {...register('password')}
                className={errors.password ? 'border-destructive focus-visible:ring-destructive' : ''}
              />
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
                  Signing in…
                </>
              ) : (
                'Sign In'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Role hint badges */}
      <div className="text-center">
        <p className="text-xs text-muted-foreground mb-2">Access levels</p>
        <div className="flex justify-center gap-2 flex-wrap">
          {[
            { label: 'Admin', color: 'bg-red-100 text-red-700' },
            { label: 'Manager', color: 'bg-amber-100 text-amber-700' },
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
