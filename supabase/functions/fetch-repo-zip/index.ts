// supabase/functions/fetch-repo-zip/index.ts
// Proxies GitHub repository zip archive to bypass CORS restrictions
// Client uses fflate (if installed) or stores the raw zip for extraction

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse request
    const { owner, repo, branch = 'main' } = await req.json() as {
      owner: string;
      repo: string;
      branch?: string;
    };

    if (!owner || !repo) {
      return new Response(JSON.stringify({ error: 'owner and repo are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get GitHub token from profile
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('github_access_token')
      .eq('id', user.id)
      .single();

    if (!profile?.github_access_token) {
      return new Response(JSON.stringify({ error: 'GitHub not connected — please add your personal access token in Settings' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch zip from GitHub
    const zipUrl = `https://api.github.com/repos/${owner}/${repo}/zipball/${branch}`;
    console.log(`[fetch-repo-zip] Fetching ${zipUrl}`);

    const githubRes = await fetch(zipUrl, {
      headers: {
        Authorization: `Bearer ${profile.github_access_token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'YFitOps-IDE/1.0',
      },
      redirect: 'follow',
    });

    if (!githubRes.ok) {
      const errText = await githubRes.text();
      throw new Error(`GitHub API error ${githubRes.status}: ${errText.slice(0, 200)}`);
    }

    const zipBuffer = await githubRes.arrayBuffer();
    console.log(`[fetch-repo-zip] Downloaded ${zipBuffer.byteLength} bytes for ${owner}/${repo}@${branch}`);

    return new Response(zipBuffer, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${repo}-${branch}.zip"`,
        'X-File-Count': String(zipBuffer.byteLength),
      },
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[fetch-repo-zip] Error:', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
