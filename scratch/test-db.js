import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://bzsmwmkgmropuadpkcku.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_VLdhRDLScUw840uLwBNI1w_LVrWuDfU';

console.log('Connecting to:', supabaseUrl);
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const userId = '7b198892-b107-4c66-81d0-1944a60d141d';
  console.log(`Sending maybeSingle query to users table for id: ${userId}...`);
  try {
    const start = Date.now();
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    console.log('Query finished in', Date.now() - start, 'ms');
    if (error) {
      console.error('Error:', error);
    } else {
      console.log('Data:', data);
    }
  } catch (err) {
    console.error('Catch Error:', err);
  }
}

run();
