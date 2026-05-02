// supabase/functions/create-checkout/index.ts
// Stripe Checkout session creator — creates a hosted checkout for plan upgrades

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
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
    // ── Auth ────────────────────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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

    // ── Parse request body ──────────────────────────────────────────────────
    const { priceId } = await req.json() as { priceId: string };
    if (!priceId) {
      return new Response(JSON.stringify({ error: 'Missing priceId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Stripe API key ──────────────────────────────────────────────────────
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeKey) {
      return new Response(JSON.stringify({ error: 'Stripe not configured — STRIPE_SECRET_KEY missing' }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Get or create Stripe customer ───────────────────────────────────────
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('stripe_customer_id,email,full_name')
      .eq('id', user.id)
      .single();

    let customerId = profile?.stripe_customer_id as string | null;

    if (!customerId) {
      // Create Stripe customer
      const customerRes = await fetch('https://api.stripe.com/v1/customers', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${stripeKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          email: profile?.email ?? user.email ?? '',
          name: profile?.full_name ?? '',
          metadata: JSON.stringify({ supabase_user_id: user.id }),
        }),
      });

      const customer = await customerRes.json() as { id?: string; error?: { message: string } };
      if (!customerRes.ok || !customer.id) {
        throw new Error(`Stripe: ${customer.error?.message ?? 'Failed to create customer'}`);
      }

      customerId = customer.id;

      // Save customer ID to profile
      await supabaseAdmin
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id);
    }

    // ── Create Checkout Session ─────────────────────────────────────────────
    const origin = req.headers.get('origin') ?? 'https://yfitops.onspace.app';

    const checkoutRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        'customer': customerId,
        'mode': 'subscription',
        'line_items[0][price]': priceId,
        'line_items[0][quantity]': '1',
        'success_url': `${origin}/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
        'cancel_url': `${origin}/billing?canceled=true`,
        'metadata[supabase_user_id]': user.id,
        'allow_promotion_codes': 'true',
        'billing_address_collection': 'auto',
      }),
    });

    const session = await checkoutRes.json() as { url?: string; error?: { message: string } };

    if (!checkoutRes.ok || !session.url) {
      throw new Error(`Stripe: ${session.error?.message ?? 'Failed to create checkout session'}`);
    }

    console.log(`[create-checkout] Session created for user ${user.id}: ${session.url}`);

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[create-checkout] Error:', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
