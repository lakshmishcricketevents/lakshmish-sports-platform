import { Play, Phone, MessageCircle } from 'lucide-react';

const InstagramIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
  </svg>
);

const YoutubeIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 0 0-1.95 1.96A29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58 2.78 2.78 0 0 0 1.95 1.96C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.96A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z" />
    <polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" fill="currentColor" />
  </svg>
);


export default function Footer() {
  return (
    <footer className="border-t border-purple-500/10 bg-dark-950/80 backdrop-blur-md mt-auto py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          
          {/* Brand */}
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg">
              <Play className="h-4.5 w-4.5 text-white fill-white" />
            </div>
            <div>
              <span className="font-black tracking-wider text-white text-sm uppercase">
                Lakshmish sports hub
              </span>
              <p className="text-[10px] text-dark-400 font-semibold uppercase">
                Karnataka's Premier Sports Broadcasting Platform
              </p>
            </div>
          </div>

          {/* Social Links */}
          <div className="flex items-center space-x-4">
            <a 
              href="tel:+919876543210" 
              className="p-2 rounded-lg bg-dark-900 border border-dark-800 text-dark-300 hover:text-purple-400 hover:border-purple-500/20 transition-all flex items-center justify-center"
              title="Call Contact"
            >
              <Phone className="h-4.5 w-4.5" />
            </a>
            <a 
              href="https://instagram.com" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="p-2 rounded-lg bg-dark-900 border border-dark-800 text-dark-300 hover:text-purple-400 hover:border-purple-500/20 transition-all flex items-center justify-center"
              title="Instagram"
            >
              <InstagramIcon className="h-4.5 w-4.5" />
            </a>
            <a 
              href="https://youtube.com" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="p-2 rounded-lg bg-dark-900 border border-dark-800 text-dark-300 hover:text-purple-400 hover:border-purple-500/20 transition-all flex items-center justify-center"
              title="YouTube Channel"
            >
              <YoutubeIcon className="h-4.5 w-4.5" />
            </a>

            <a 
              href="https://wa.me/919876543210" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="p-2 rounded-lg bg-dark-900 border border-dark-800 text-dark-300 hover:text-purple-400 hover:border-purple-500/20 transition-all flex items-center justify-center"
              title="WhatsApp Chat"
            >
              <MessageCircle className="h-4.5 w-4.5" />
            </a>
          </div>

          {/* Credits & Copyright */}
          <div className="text-center md:text-right">
            <p className="text-xs text-dark-400 font-semibold">
              © {new Date().getFullYear()} Lakshmish Sports Hub. All Rights Reserved.
            </p>
            <p className="text-[10px] text-purple-400 font-extrabold uppercase tracking-widest mt-1">
              Engineered for Cricket & Kabaddi Leagues
            </p>
          </div>

        </div>
      </div>
    </footer>
  );
}
