import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder-url.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';

// Helper to determine if Supabase connection details are provided (ignoring default placeholders)
export const isSupabaseConfigured = !!(
  process.env.NEXT_PUBLIC_SUPABASE_URL && 
  process.env.NEXT_PUBLIC_SUPABASE_URL !== 'https://your-supabase-project-reference.supabase.co' &&
  !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('your-supabase-project-reference') &&
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY && 
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY !== 'your-actual-supabase-public-anon-key' &&
  !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.includes('your-actual-supabase-public-anon-key')
);

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

