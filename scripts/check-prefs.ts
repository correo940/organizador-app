import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  console.log('Checking user_preferences table...');
  const { data, error } = await supabaseAdmin.from('user_preferences').select('*');
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Preferences count:', data.length);
    console.log(JSON.stringify(data, null, 2));
  }
}

main();
