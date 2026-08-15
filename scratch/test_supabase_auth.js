const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://rnwpljhmflnxxefamfid.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJud3BsamhtZmxueHhlZmFtZmlkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY2MTMzNzUsImV4cCI6MjEwMjE4OTM3NX0.Rb21vhDbnT0l94z6uCwpYRldHObR_7KwFslDuWTdnEA';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testConnection() {
  console.log("Testing Supabase connection...");
  
  // 1. Check profiles table query
  const { data: profiles, error: pErr } = await supabase.from('profiles').select('*').limit(5);
  if (pErr) {
    console.error("Profiles Table Error:", pErr.message);
  } else {
    console.log("✓ Profiles Table connected successfully! Records found:", profiles.length);
    if (profiles.length > 0) {
      console.log("Sample profile:", profiles[0]);
    }
  }

  // 2. Check rooms table query
  const { data: rooms, error: rErr } = await supabase.from('rooms').select('*').limit(5);
  if (rErr) {
    console.error("Rooms Table Error:", rErr.message);
  } else {
    console.log("✓ Rooms Table connected successfully! Active rooms:", rooms.length);
  }

  // 3. Check players table query
  const { data: players, error: plErr } = await supabase.from('players').select('*').limit(5);
  if (plErr) {
    console.error("Players Table Error:", plErr.message);
  } else {
    console.log("✓ Players Table connected successfully!");
  }
}

testConnection();
