require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

// SEC-12: Validación de variables de entorno
if (!supabaseUrl || !supabaseKey) {
    throw new Error("Faltan SUPABASE_URL y/o SUPABASE_ANON_KEY en el entorno (.env).");
}

const supabaseClient = createClient(supabaseUrl, supabaseKey);

module.exports = { supabaseClient };