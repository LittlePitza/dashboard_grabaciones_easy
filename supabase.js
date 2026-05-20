const SUPABASE_URL = 'https://fpwttcyemwqfkjsvwxwz.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_izZUskrc3yT49khe14SptQ__YX9MGk3';
window.supabaseClient = (SUPABASE_URL.includes('TU_') || SUPABASE_ANON_KEY.includes('TU_')) ? null : window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
