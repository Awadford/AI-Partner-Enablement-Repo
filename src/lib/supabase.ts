import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://nvzkmqumglqlvkrokzkn.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im52emttcXVtZ2xxbHZrcm9remtuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwOTc3MDUsImV4cCI6MjA5MzY3MzcwNX0.obkBnd8r7F4lWeB5zhHZE0xzK_MS05kBk77V_5cOot4'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
