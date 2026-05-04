// supabase/functions/github-oauth/index.ts
// Phase 1: GitHub App OAuth callback handler
// Exchanges OAuth code for a user access token, saves it + installation_id to profiles.
// POST { code: string, installation_id: number }
// Returns { token: string, installation_id: number }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, handleCors } from '../_shared/cors.ts';

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    // Authenticate caller
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', ''),
    );

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json() as { code?: string; installation_id?: number };
    const { code, installation_id } = body;

    if (!code || !installation_id) {
      return new Response(JSON.stringify({ error: 'code and installation_id are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const clientId = Deno.env.get('GITHUB_APP_CLIENT_ID');
    const clientSecret = Deno.env.get('GITHUB_APP_CLIENT_SECRET');

    if (!clientId || !clientSecret) {
      return new Response(JSON.stringify({ error: 'GitHub App credentials not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Exchange code for user access token
    console.log(`[github-oauth] Exchanging code for token, installation_id=${installation_id}`);

    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'YFitOps-IDE/1.0',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
      }),
    });

    const tokenData = await tokenRes.json() as {
      access_token?: string;
      error?: string;
      error_description?: string;
    };

    if (!tokenRes.ok || tokenData.error || !tokenData.access_token) {
      const errMsg = tokenData.error_description ?? tokenData.error ?? `GitHub error ${tokenRes.status}`;
      console.error('[github-oauth] Token exchange failed:', errMsg);
      return new Response(JSON.stringify({ error: errMsg }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = tokenData.access_token;

    // Fetch GitHub user to get username
    let githubUsername: string | null = null;
    try {
      const ghUserRes = await fetch('https://api.github.com/user', {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'YFitOps-IDE/1.0',
        },
      });
      if (ghUserRes.ok) {
        const ghUser = await ghUserRes.json() as { login?: string };
        githubUsername = ghUser.login ?? null;
      }
    } catch (e) {
      console.warn('[github-oauth] Could not fetch GitHub user:', e);
    }

    // Save token + installation_id to profiles
    const updatePayload: Record<string, unknown> = {
      github_access_token: token,
      github_installation_id: installation_id,
    };
    if (githubUsername) updatePayload['github_username'] = githubUsername;

    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update(updatePayload)
      .eq('id', user.id);

    if (updateError) {
      console.error('[github-oauth] Failed to update profile:', updateError.message);
      return new Response(JSON.stringify({ error: `Failed to save token: ${updateError.message}` }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[github-oauth] Token saved for user ${user.id}, github_username=${githubUsername}`);

    return new Response(
      JSON.stringify({ token, installation_id, github_username: githubUsername }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[github-oauth] Unexpected error:', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
