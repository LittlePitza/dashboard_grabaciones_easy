// Rellena SUPABASE_URL y SUPABASE_ANON_KEY
const SUPABASE_URL = 'https://fpwttcyemwqfkjsvwxwz.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_izZUskrc3yT49khe14SptQ__YX9MGk3';
window.sb = (typeof supabase!=='undefined' && SUPABASE_URL.indexOf('TU_')===-1) ? supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY) : null;
