// supabase/functions/stripe-webhook/index.ts
// Stripe webhook handler — updates profiles on subscription events

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

async function verifyStripeSignature(payload: string, sigHeader: string, secret: string): Promise<boolean> {
  const parts = sigHeader.split(',');
  const tsEntry = parts.find((p) => p.startsWith('t='));
  const v1Entry = parts.find((p) => p.startsWith('v1='));
  if (!tsEntry || !v1Entry) return false;

  const ts = tsEntry.slice(2);
  const v1 = v1Entry.slice(3);

  const signedPayload = `${ts}.${payload}`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sigBytes = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signedPayload));
  const expected = Array.from(new Uint8Array(sigBytes)).map((b) => b.toString(16).padStart(2, '0')).join('');

  return expected === v1;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');

  if (!webhookSecret || !stripeKey) {
    console.error('[stripe-webhook] Missing STRIPE_WEBHOOK_SECRET or STRIPE_SECRET_KEY');
    return new Response('Webhook not configured', { status: 503, headers: corsHeaders });
  }

  const payload = await req.text();
  const sig = req.headers.get('stripe-signature') ?? '';

  const isValid = await verifyStripeSignature(payload, sig, webhookSecret);
  if (!isValid) {
    console.error('[stripe-webhook] Invalid signature');
    return new Response('Invalid signature', { status: 400, headers: corsHeaders });
  }

  const event = JSON.parse(payload) as { type: string; data: { object: Record<string, unknown> } };

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  console.log(`[stripe-webhook] Processing event: ${event.type}`);

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = (session.metadata as Record<string, string>)?.supabase_user_id;
        if (!userId) break;

        const expiresAt = new Date();
        expiresAt.setMonth(expiresAt.getMonth() + 1);

        await supabaseAdmin
          .from('profiles')
          .update({
            plan: 'pro',
            plan_expires_at: expiresAt.toISOString(),
            stripe_customer_id: session.customer as string,
          })
          .eq('id', userId);

        // Log event
        await supabaseAdmin.from('events').insert({
          user_id: userId,
          event_type: 'subscription_activated',
          payload: { plan: 'pro', session_id: session.id },
        });

        console.log(`[stripe-webhook] Upgraded user ${userId} to Pro`);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const customerId = subscription.customer as string;

        // Find user by stripe_customer_id
        const { data: profiles } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .limit(1);

        if (profiles && profiles.length > 0) {
          const userId = (profiles[0] as { id: string }).id;
          await supabaseAdmin
            .from('profiles')
            .update({ plan: 'starter', plan_expires_at: null })
            .eq('id', userId);

          await supabaseAdmin.from('events').insert({
            user_id: userId,
            event_type: 'subscription_cancelled',
            payload: { customer_id: customerId },
          });

          console.log(`[stripe-webhook] Downgraded user ${userId} to Starter`);
        }
        break;
      }

      case 'invoice.payment_failed': {
        console.log('[stripe-webhook] Payment failed for customer:', event.data.object.customer);
        // Could send notification here
        break;
      }

      default:
        console.log(`[stripe-webhook] Unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[stripe-webhook] Error:', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
