// Deno Edge Function to create new users securely by Managers
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

// Initialize Supabase admin client with service role key
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('origin') || '';
  const productionOrigin = Deno.env.get('ALLOWED_ORIGIN') || '';
  const allowedOrigins = [
    "http://localhost:5173",
    "http://localhost:3000",
    "capacitor://localhost",
    "ionic://localhost",
  ];
  if (productionOrigin) {
    productionOrigin.split(',').forEach(o => allowedOrigins.push(o.trim()));
  }
  
  const isAllowed = allowedOrigins.includes(origin) || 
                    origin.startsWith('http://localhost:') ||
                    origin.endsWith('.vercel.app') ||
                    origin.startsWith('https://taskflow-');
  
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : allowedOrigins[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

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
    if (!companyId && callerProfile.role !== 'super_admin') {
      return new Response(JSON.stringify({ error: 'Manager is not assigned to a company' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 3. Parse input body parameters
    const body = await req.json();
    const action = body.action || 'create';

    if (action === 'create') {
      const { email, password, name, role } = body;
      if (!email || !password || !name || !role) {
        return new Response(JSON.stringify({ error: 'Name, email, password, and role are required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        return new Response(JSON.stringify({ error: 'Invalid email format' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (password.length < 6) {
        return new Response(JSON.stringify({ error: 'Password must be at least 6 characters' }), {
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

    } else if (action === 'create_manager_for_company') {
      if (callerProfile.role !== 'super_admin') {
        return new Response(JSON.stringify({ error: 'Access denied: Only super admins can use this action' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const { email, name, targetCompanyId, redirectTo } = body;
      if (!email || !name || !targetCompanyId) {
        return new Response(JSON.stringify({ error: 'Email, name, and targetCompanyId are required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        return new Response(JSON.stringify({ error: 'Invalid email format' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Generate cryptographically secure random password
      const array = new Uint8Array(16);
      crypto.getRandomValues(array);
      const tempPassword = Array.from(array, dec => dec.toString(16).padStart(2, '0')).join('') + 'Aa1!';

      console.log(`[AdminRegister] Super Admin ${callerUser.email} is creating manager ${email} for company ${targetCompanyId}`);

      // 1. Create user in auth schema via admin API
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { name }
      });

      if (authError || !authData.user) {
        throw authError || new Error('Auth creation failed');
      }

      const newUserId = authData.user.id;

      // 2. Create manager profile in public.users table
      const { error: insertError } = await supabaseAdmin
        .from('users')
        .insert({
          id: newUserId,
          name,
          email,
          role: 'manager',
          company_id: targetCompanyId,
          created_at: Date.now()
        });

      if (insertError) {
        // Rollback auth user creation if profile creation fails
        await supabaseAdmin.auth.admin.deleteUser(newUserId);
        throw insertError;
      }

      // 3. Trigger Supabase reset password email automatically
      try {
        const resetRedirect = redirectTo || 'http://localhost:5173/reset-password';
        const { error: resetError } = await supabaseAdmin.auth.resetPasswordForEmail(email, {
          redirectTo: resetRedirect
        });
        if (resetError) {
          console.error('[AdminRegister] Password reset email trigger failed:', resetError.message);
        }
      } catch (emailErr) {
        console.error('[AdminRegister] Failed to send reset email:', emailErr);
      }

      return new Response(JSON.stringify({ 
        message: 'Manager created and invitation email triggered successfully',
        user: { id: newUserId, name, email, role: 'manager' } 
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } else if (action === 'update') {
      const { userId, email, password, name, role } = body;
      if (!userId) {
        return new Response(JSON.stringify({ error: 'User ID is required for update action' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // 1. Verify target user belongs to same company
      const { data: targetUser, error: targetUserError } = await supabaseAdmin
        .from('users')
        .select('company_id, role')
        .eq('id', userId)
        .single();

      if (targetUserError || !targetUser) {
        return new Response(JSON.stringify({ error: 'Target user not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (targetUser.company_id !== companyId && callerProfile.role !== 'super_admin') {
        return new Response(JSON.stringify({ error: 'Access denied: Target user is in a different tenant' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (targetUser.role === 'super_admin' && callerProfile.role !== 'super_admin') {
        return new Response(JSON.stringify({ error: 'Access denied: Cannot edit super admin' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email.trim())) {
          return new Response(JSON.stringify({ error: 'Invalid email format' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

      if (password && password.length < 6) {
        return new Response(JSON.stringify({ error: 'Password must be at least 6 characters' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      console.log(`[AdminRegister] Manager ${callerUser.email} is updating user ${userId}`);

      // 2. Update Auth schema
      const authUpdates: any = {};
      if (email) authUpdates.email = email;
      if (password) authUpdates.password = password;
      if (name) authUpdates.user_metadata = { name };

      if (Object.keys(authUpdates).length > 0) {
        const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(userId, authUpdates);
        if (authUpdateError) throw authUpdateError;
      }

      // 3. Update public.users profile
      const profileUpdates: any = {};
      if (name) profileUpdates.name = name;
      if (email) profileUpdates.email = email;
      if (role) {
        if (role !== 'employee' && role !== 'manager') {
          return new Response(JSON.stringify({ error: 'Invalid user role' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        profileUpdates.role = role;
      }

      if (Object.keys(profileUpdates).length > 0) {
        const { error: profileUpdateError } = await supabaseAdmin
          .from('users')
          .update(profileUpdates)
          .eq('id', userId);
        if (profileUpdateError) throw profileUpdateError;
      }

      return new Response(JSON.stringify({ 
        message: 'User updated successfully'
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } else if (action === 'delete') {
      const { userId } = body;
      if (!userId) {
        return new Response(JSON.stringify({ error: 'User ID is required for delete action' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // 1. Verify target user belongs to same company
      const { data: targetUser, error: targetUserError } = await supabaseAdmin
        .from('users')
        .select('company_id, role')
        .eq('id', userId)
        .single();

      if (targetUserError || !targetUser) {
        return new Response(JSON.stringify({ error: 'Target user not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (targetUser.company_id !== companyId && callerProfile.role !== 'super_admin') {
        return new Response(JSON.stringify({ error: 'Access denied: Target user is in a different tenant' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (targetUser.role === 'super_admin' && callerProfile.role !== 'super_admin') {
        return new Response(JSON.stringify({ error: 'Access denied: Cannot delete super admin' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      console.log(`[AdminRegister] Manager ${callerUser.email} is deleting user ${userId}`);

      // 2. Delete user in Auth (this cascades to users table)
      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
      if (deleteError) throw deleteError;

      return new Response(JSON.stringify({ 
        message: 'User deleted successfully'
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } else if (action === 'delete_company') {
      const { targetCompanyId } = body;
      if (!targetCompanyId) {
        return new Response(JSON.stringify({ error: 'Target Company ID is required for delete_company action' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (callerProfile.role !== 'super_admin') {
        return new Response(JSON.stringify({ error: 'Access denied: Only super admins can delete company users' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      console.log(`[AdminRegister] Super Admin ${callerUser.email} is deleting users for company ${targetCompanyId}`);

      // 1. Fetch all users belonging to targetCompanyId
      const { data: targetUsers, error: fetchUsersError } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('company_id', targetCompanyId);

      if (fetchUsersError) {
        throw fetchUsersError;
      }

      // 2. Delete each user from auth (cascades to public.users)
      if (targetUsers && targetUsers.length > 0) {
        for (const u of targetUsers) {
          const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(u.id);
          if (deleteError) {
            console.error(`Failed to delete user ${u.id}:`, deleteError.message);
          }
        }
      }

      return new Response(JSON.stringify({ 
        message: 'All company users deleted successfully'
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } else {
      return new Response(JSON.stringify({ error: 'Invalid action parameter' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

  } catch (err: any) {
    console.error('[AdminRegister] Error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
