// supabase/functions/github-repos/index.ts
// Phase 1: List repos accessible via GitHub App installation
// Auth-protected. Uses stored installation token to list repos.
// POST { installation_id: number }
// Returns { repos: GitHubRepo[] }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, handleCors } from '../_shared/cors.ts';

interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  owner: { login: string };
  description: string | null;
  html_url: string;
  language: string | null;
  stargazers_count: number;
  default_branch: string;
  private: boolean;
  updated_at: string;
}

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

    // Get profile to retrieve stored token and installation_id
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('github_access_token, github_installation_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return new Response(JSON.stringify({ error: 'Profile not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!profile.github_access_token) {
      return new Response(
        JSON.stringify({ error: 'GitHub not connected. Complete GitHub App installation first.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const installationId = profile.github_installation_id;
    if (!installationId) {
      return new Response(
        JSON.stringify({ error: 'No GitHub App installation found. Install the yfitops-ai app first.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    console.log(`[github-repos] Listing repos for installation_id=${installationId}`);

    // Fetch repos accessible to this installation
    const reposRes = await fetch(
      `https://api.github.com/user/installations/${installationId}/repositories?per_page=100`,
      {
        headers: {
          Authorization: `Bearer ${profile.github_access_token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'YFitOps-IDE/1.0',
        },
      },
    );

    if (!reposRes.ok) {
      const errBody = await reposRes.text();
      // 403 can mean the token doesn't have installation scope — try listing user repos instead
      if (reposRes.status === 403 || reposRes.status === 401) {
        console.warn(`[github-repos] Installation listing failed (${reposRes.status}), falling back to user repos`);
        const fallbackRes = await fetch(
          'https://api.github.com/user/repos?sort=updated&per_page=100&affiliation=owner,collaborator',
          {
            headers: {
              Authorization: `Bearer ${profile.github_access_token}`,
              Accept: 'application/vnd.github+json',
              'X-GitHub-Api-Version': '2022-11-28',
              'User-Agent': 'YFitOps-IDE/1.0',
            },
          },
        );
        if (!fallbackRes.ok) {
          throw new Error(`GitHub API error ${fallbackRes.status}: ${await fallbackRes.text()}`);
        }
        const repos = await fallbackRes.json() as GitHubRepo[];
        return new Response(JSON.stringify({ repos, source: 'user' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw new Error(`GitHub API error ${reposRes.status}: ${errBody.slice(0, 200)}`);
    }

    const data = await reposRes.json() as { repositories: GitHubRepo[]; total_count: number };
    const repos = data.repositories ?? [];

    console.log(`[github-repos] Found ${repos.length} repos`);

    return new Response(JSON.stringify({ repos, total: data.total_count, source: 'installation' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[github-repos] Error:', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
