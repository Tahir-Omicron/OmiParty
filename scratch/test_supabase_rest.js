const SUPABASE_URL = 'https://rnwpljhmflnxxefamfid.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJud3BsamhtZmxueHhlZmFtZmlkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY2MTMzNzUsImV4cCI6MjEwMjE4OTM3NX0.Rb21vhDbnT0l94z6uCwpYRldHObR_7KwFslDuWTdnEA';

async function testSupabaseRest() {
  console.log("--- Testing Supabase REST Endpoints ---");
  
  // 1. Test Profiles Table
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles?select=*&limit=3`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      }
    });
    console.log("Profiles status:", res.status);
    const data = await res.json();
    console.log("Profiles data sample:", data);
  } catch(e) {
    console.error("Profiles error:", e);
  }

  // 2. Test Rooms Table
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rooms?select=*&limit=3`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      }
    });
    console.log("Rooms status:", res.status);
    const data = await res.json();
    console.log("Rooms count:", data.length);
  } catch(e) {
    console.error("Rooms error:", e);
  }
}

testSupabaseRest();
