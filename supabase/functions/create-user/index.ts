// Deno Edge Function to create new users securely by Managers
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

// Initialize Supabase admin client with service role key
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Authenticate the caller (Manager)
    const authHeader = req.headers.get('Authorization') || '';
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization Header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Verify the caller's identity using their JWT token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user: callerUser }, error: callerError } = await supabaseAdmin.auth.getUser(token);
    if (callerError || !callerUser) {
      return new Response(JSON.stringify({ error: 'Unauthorized user token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 2. Query caller's profile to confirm they are indeed a Manager
    const { data: callerProfile, error: profileError } = await supabaseAdmin
      .from('users')
      .select('role, company_id')
      .eq('id', callerUser.id)
      .single();

    if (profileError || !callerProfile || (callerProfile.role !== 'manager' && callerProfile.role !== 'super_admin')) {
      return new Response(JSON.stringify({ error: 'Only managers and super admins can register new users' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const companyId = callerProfile.company_id;
    if (!companyId) {
      return new Response(JSON.stringify({ error: 'Manager is not assigned to a company' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 3. Parse input body parameters
    const { email, password, name, role } = await req.json();
    if (!email || !password || !name || !role) {
      return new Response(JSON.stringify({ error: 'Name, email, password, and role are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (role !== 'employee' && role !== 'manager') {
      return new Response(JSON.stringify({ error: 'Invalid user role' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Fetch company info to check employee limit
    const { data: company, error: companyError } = await supabaseAdmin
      .from('companies')
      .select('plan, max_employees')
      .eq('id', companyId)
      .single();

    if (companyError || !company) {
      return new Response(JSON.stringify({ error: 'Failed to retrieve company subscription details' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Count current employees in this company
    const { count: currentEmployeeCount, error: countError } = await supabaseAdmin
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('role', 'employee');

    if (countError) {
      return new Response(JSON.stringify({ error: 'Failed to count company employees' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Only enforce limits on 'employee' roles
    if (role === 'employee' && (currentEmployeeCount ?? 0) >= company.max_employees) {
      return new Response(JSON.stringify({ 
        error: `لقد تجاوزت الحد الأقصى للموظفين المسموح به لباقة اشتراكك (${company.max_employees} موظفين). يرجى الترقية لإضافة المزيد.` 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`[AdminRegister] Manager ${callerUser.email} is creating user ${email}`);

    // 4. Create user in auth schema via admin API
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name }
    });

    if (authError || !authData.user) {
      throw authError || new Error('Auth creation failed');
    }

    const newUserId = authData.user.id;

    // 5. Create user profile in public.users table
    const { error: insertError } = await supabaseAdmin
      .from('users')
      .insert({
        id: newUserId,
        name,
        email,
        role,
        company_id: companyId,
        created_at: Date.now()
      });

    if (insertError) {
      // Rollback auth user creation if profile creation fails
      await supabaseAdmin.auth.admin.deleteUser(newUserId);
      throw insertError;
    }

    return new Response(JSON.stringify({ 
      message: 'User created successfully',
      user: { id: newUserId, name, email, role } 
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err: any) {
    console.error('[AdminRegister] Error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
