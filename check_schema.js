const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://kgrxlznhimwuvwhjfzhv.supabase.co';
const SUPABASE_KEY = 'sb_publishable_L4_HhLhbj_m6wbEc3ZqhcQ_QNGOLWXU';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkSchema() {
    console.log("Checking first news item to see columns...");
    const { data, error } = await supabase.from('news').select('*').limit(1).single();
    if (error) {
        console.error("Error fetching data:", error);
        return;
    }
    console.log("Columns found:", Object.keys(data).join(', '));
    console.log("Sample data:", JSON.stringify(data, null, 2));
}

checkSchema();
