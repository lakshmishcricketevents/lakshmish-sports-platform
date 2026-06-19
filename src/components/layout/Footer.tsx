import { Trophy } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="border-t border-gold-500/10 bg-dark-950/80 backdrop-blur-md mt-auto py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          
          {/* Brand */}
          <div className="flex items-center space-x-3">
            <div className="p-1.5 bg-gold-500 rounded-md">
              <Trophy className="h-5 w-5 text-dark-950" />
            </div>
            <div>
              <span className="font-bold tracking-wider text-white text-sm uppercase">
                Lakshmish Cricket Events
              </span>
              <p className="text-[10px] text-dark-400">
                Premium Tournament Live Streaming & Scoring Engine
              </p>
            </div>
          </div>

          {/* Credits */}
          <div className="text-center md:text-right">
            <p className="text-xs text-dark-400">
              © {new Date().getFullYear()} Lakshmish Cricket Events. All Rights Reserved.
            </p>
            <p className="text-[10px] text-gold-500/60 mt-1">
              Crafted for Professional Leagues & Local Matches
            </p>
          </div>

        </div>
      </div>
    </footer>
  );
}
