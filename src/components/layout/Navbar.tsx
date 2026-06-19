'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Trophy, Play, Gavel, UserCheck, Home, Menu, X, Shield } from 'lucide-react';

export default function Navbar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  const navLinks = [
    { href: '/', label: 'Dashboard', icon: Home },
    { href: '/tournaments', label: 'Tournaments', icon: Trophy },
    { href: '/auction', label: 'Auction Hub', icon: Gavel },
    { href: '/admin', label: 'Admin Console', icon: Shield },
  ];

  const isActive = (path: string) => {
    if (path === '/') return pathname === '/';
    return pathname.startsWith(path);
  };

  return (
    <nav className="glass-panel border-b border-gold-500/20 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo / Branding */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center space-x-3 group">
              <div className="p-2 bg-gradient-to-br from-gold-400 to-gold-600 rounded-lg shadow-lg shadow-gold-500/10 group-hover:scale-105 transition-transform">
                <Trophy className="h-6 w-6 text-dark-950 font-bold" />
              </div>
              <div className="flex flex-col">
                <span className="text-lg font-bold tracking-wider gold-gradient-text uppercase font-sans">
                  Lakshmish
                </span>
                <span className="text-[10px] tracking-widest text-gold-400/80 uppercase -mt-1">
                  Cricket Events
                </span>
              </div>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-1">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const active = isActive(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    active
                      ? 'bg-gold-500/10 text-gold-400 border border-gold-500/30 glow-gold'
                      : 'text-dark-300 hover:text-gold-400 hover:bg-gold-500/5 hover:border-gold-500/10 border border-transparent'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </div>

          {/* Live indicator on desktop */}
          <div className="hidden md:flex items-center space-x-3">
            <div className="flex items-center space-x-2 px-3 py-1 bg-red-950/40 border border-red-500/30 rounded-full">
              <span className="h-2 w-2 rounded-full bg-red-500 animate-ping" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-red-400">
                Live Scoring
              </span>
            </div>
          </div>

          {/* Mobile hamburger menu */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="p-2 rounded-md text-dark-300 hover:text-gold-400 hover:bg-gold-500/10 focus:outline-none"
            >
              {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer menu */}
      {isOpen && (
        <div className="md:hidden glass-panel border-t border-gold-500/10 px-2 pt-2 pb-4 space-y-1 sm:px-3">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const active = isActive(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setIsOpen(false)}
                className={`flex items-center space-x-3 px-4 py-3 rounded-lg text-base font-medium transition-all ${
                  active
                    ? 'bg-gold-500/15 text-gold-400 border border-gold-500/30'
                    : 'text-dark-300 hover:text-gold-400 hover:bg-gold-500/5'
                }`}
              >
                <Icon className="h-5 w-5" />
                <span>{link.label}</span>
              </Link>
            );
          })}
          
          <div className="pt-4 px-4">
            <div className="flex items-center justify-center space-x-2 py-2 bg-red-950/40 border border-red-500/30 rounded-lg">
              <span className="h-2 w-2 rounded-full bg-red-500 animate-ping" />
              <span className="text-xs font-bold uppercase tracking-wider text-red-400">
                Live Scoring Active
              </span>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
