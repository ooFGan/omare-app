const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://czggfauyqsnzjrrhbgft.supabase.co';
// Using the anon key from supabaseClient.js
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6Z2dmYXV5cXNuempycmhiZ2Z0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDAxNzE3NjAsImV4cCI6MjA1NTc0Nzc2MH0.2jLpW81C-wAhP_6X54n1N4KikB1FmF5Vn0q0VqA-W5c';
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
    console.log('Logging in...');
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: 'prueba@gmail.es',
        password: 'password123' // I don't know the password... let's just create a new test user
    });

    if (authError) {
        console.log('Failed login, registering new user...');
        await supabase.auth.signUp({ email: 'test33@omare.com', password: 'password123' });
        const { data: authData2 } = await supabase.auth.signInWithPassword({
            email: 'test33@omare.com',
            password: 'password123'
        });
        console.log('Logged in as:', authData2?.session?.user?.id);
    } else {
        console.log('Logged in as:', authData?.session?.user?.id);
    }

    console.log('Inserting with explicit user_id...');
    const user = (await supabase.auth.getUser()).data.user;

    const { data, error } = await supabase
        .from('clientes')
        .insert([{ nombre: 'NodeJS Test', user_id: user.id }])
        .select()
        .single();

    if (error) {
        console.error('Insert Error:', error);
    } else {
        console.log('Insert Success:', data);
    }
}

test();
