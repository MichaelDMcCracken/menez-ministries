/**
 * Supabase configuration for the public sermon library.
 *
 * Replace the placeholder values below with your actual Supabase
 * project URL and anon (public) key, then run `node build.js` to
 * regenerate the sermon pages.
 *
 * The anon key is safe to expose here because Row Level Security
 * ensures public visitors can only read published sermons.
 *
 * DO NOT use the service-role key here.
 */
window.__SUPABASE_CONFIG__ = {
  url:     'YOUR_SUPABASE_URL',      // e.g. https://abcdefgh.supabase.co
  anonKey: 'YOUR_SUPABASE_ANON_KEY', // starts with "eyJ..."
};
