// =====================================================
//  FieldCorrect Mobile — Supabase Client
// =====================================================

import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SUPABASE_URL = 'http://localhost:8000'; // Override via env
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzcxNjM2NjE3LCJleHAiOjIwODY5OTY2MTd9.rXJyUcWAksQDMyvsQLkCEur2VSiX_pF_9yEnDs7IqwY';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage as any,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
