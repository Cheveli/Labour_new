const { createClient } = require('@supabase/supabase-js');
const url = 'https://placeholder.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2MDAwMDAwMDAsImV4cCI6MTkwMDAwMDAwMH0.placeholder';
const supabase = createClient(url, key, {
  auth: {
    experimental: {
      passkey: true
    }
  }
});
console.log("Auth Methods:", Object.getOwnPropertyNames(Object.getPrototypeOf(supabase.auth)).filter(m => m.toLowerCase().includes('passkey') || m.toLowerCase().includes('signin')));
console.log("Passkey Methods:", Object.keys(supabase.auth.passkey || {}));
