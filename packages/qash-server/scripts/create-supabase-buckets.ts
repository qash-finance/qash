import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const buckets = [
  { name: 'user-avatars', public: true },
  { name: 'company-logos', public: true },
  { name: 'multisig-logos', public: true },
];

async function createBuckets() {
  // Use service role key to have admin permissions
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  for (const bucket of buckets) {
    try {
      console.log(`Creating bucket: ${bucket.name}...`);
      
      const { data, error } = await supabase.storage.createBucket(bucket.name, {
        public: bucket.public,
      });

      if (error) {
        if (error.message.includes('already exists')) {
          console.log(`✓ Bucket ${bucket.name} already exists`);
        } else {
          console.error(`✗ Error creating bucket ${bucket.name}:`, error.message);
        }
      } else {
        console.log(`✓ Bucket ${bucket.name} created successfully`);
      }
    } catch (err) {
      console.error(`✗ Exception creating bucket ${bucket.name}:`, err);
    }
  }
}

createBuckets();
