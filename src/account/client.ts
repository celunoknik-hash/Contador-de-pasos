import 'react-native-url-polyfill/auto';
import { createClient, processLock } from '@supabase/supabase-js';
import { Database } from '../data/database.types';
import { secureStorage } from './secureStorage';
import { supabasePublishableKey, supabaseUrl } from './config';
export const supabase = createClient<Database>(supabaseUrl, supabasePublishableKey, {
  auth: { storage: secureStorage, storageKey: 'walkworld.auth.v1', persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, flowType: 'pkce', lock: processLock },
});
