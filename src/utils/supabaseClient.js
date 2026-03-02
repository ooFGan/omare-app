/**
 * supabaseClient.js - Inicialización del cliente Supabase
 */
const supabaseUrl = 'https://czggfauyqsnzjrrhbgft.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6Z2dmYXV5cXNuempycmhiZ2Z0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzOTM4MjQsImV4cCI6MjA4Nzk2OTgyNH0.Hnrbc5ANW5rr2MKGwCcDf2VsEZHknh64HH0zQJg_ndg';
window.supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);
