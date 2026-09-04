import React from 'react';
import { Outlet } from 'react-router-dom';

const AuthLayout = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAF6EE] relative">
      <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-[#0F172A] via-[#C9972A] to-[#0F172A]" />
      <div className="w-full max-w-md p-6">
        <Outlet />
      </div>
      <footer className="absolute bottom-4 text-center w-full text-sm text-muted-foreground">
        <img src="/logo-gold.png" alt="" className="h-7 w-7 object-contain mx-auto mb-2 opacity-80" />
        © {new Date().getFullYear()} Bindu Jewellery. All rights reserved.
      </footer>
    </div>
  );
};

export default AuthLayout;
