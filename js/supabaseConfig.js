/**
 * Supabase Configuration Module
 * 
 * Initializes and exports the Supabase client for use by other modules.
 * Uses the Supabase JavaScript client library loaded via CDN.
 * 
 * @module supabaseConfig
 */

// Supabase project configuration
const SUPABASE_URL = 'https://luhxiuuslhwffyunkdyo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1aHhpdXVzbGh3ZmZ5dW5rZHlvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc0NDEzMDksImV4cCI6MjA4MzAxNzMwOX0.-eNU7TpKdE61v5ZEgR6vFPF0mFnCWrT3AZY_N2c03XQ';

/**
 * Initialize Supabase client
 * The supabase global is available from the CDN script loaded in index.html
 */
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Export for use by other modules
export { supabase, SUPABASE_URL, SUPABASE_ANON_KEY };
