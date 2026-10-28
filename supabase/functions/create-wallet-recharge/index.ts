import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const apiKey = Deno.env.get('GENIUSPAY_API_KEY') || '';
    const apiSecret = Deno.env.get('GENIUSPAY_API_SECRET') || '';

    // URL de base officielle GeniusPay lue depuis les variables d'environnement
    const rawBaseUrl = Deno.env.get('GENIUSPAY_BASE_URL') || 'https://sandbox.geniuspay.ci/api/v1/merchant';
    const baseUrl = rawBaseUrl.replace(/\/+$/, '');

    // 1. Authentification obligatoire de l'utilisateur via session Supabase
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Session utilisateur requise. En-tête Authorization manquant.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.replace('Bearer ', '').trim();
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token).catch(() => ({ data: { user: null }, error: true }));

    if (!user || authErr) {
      return new Response(
        JSON.stringify({ error: 'Session invalide ou expirée. Veuillez vous reconnecter.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const authenticatedUserId = user.id;

    const body = await req.json().catch(() => ({}));
    const { amount_fcfa, amount: rawAmount, description, success_url, return_url, phone_number } = body;

    const amount = Math.round(Number(amount_fcfa || rawAmount) || 0);
    if (!amount || amount < 200) {
      return new Response(
        JSON.stringify({ error: 'Montant de recharge invalide. Le montant minimum est de 200 FCFA.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!apiKey || !apiSecret) {
      return new Response(
        JSON.stringify({ error: 'Secrets GeniusPay (GENIUSPAY_API_KEY, GENIUSPAY_API_SECRET) non configurés.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Appel POST direct à GENIUSPAY_BASE_URL + /payments
    // avec GENIUSPAY_API_KEY en header X-API-Key et GENIUSPAY_API_SECRET lue dans les secrets
    const targetUrl = baseUrl.endsWith('/payments') ? baseUrl : `${baseUrl}/payments`;

    const requestPayload = {
      amount: amount,
      description: description || `Recharge portefeuille ArtisanPro - ${amount} FCFA`,
      success_url: success_url || return_url || 'https://artisanpro.afrique/wallet?status=success'
    };

    let gpResponse: Response;
    try {
      gpResponse = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-API-Key': apiKey,
          'X-API-Secret': apiSecret
        },
        body: JSON.stringify(requestPayload)
      });
    } catch (netErr: any) {
      return new Response(
        JSON.stringify({
          success: false,
          error: netErr.message || 'Erreur réseau lors de la communication avec GeniusPay'
        }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Gestion stricte du retour GeniusPay
    // Si l'appel échoue ou si checkout_url est absent, renvoie l'erreur exacte de GeniusPay, sans inventer de lien
    if (!gpResponse.ok) {
      const errText = await gpResponse.text();
      let errJson: any = null;
      try {
        errJson = JSON.parse(errText);
      } catch {}

      const exactError = errJson?.error || errJson?.message || errText || `Erreur GeniusPay (${gpResponse.status})`;
      return new Response(
        JSON.stringify({
          success: false,
          error: exactError
        }),
        { status: gpResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const gpData = await gpResponse.json();
    const checkoutUrl = gpData.checkout_url || gpData.data?.checkout_url || gpData.payment_url || gpData.data?.payment_url || '';

    if (!checkoutUrl) {
      const exactError = gpData.error || gpData.message || 'Le champ checkout_url est absent de la réponse GeniusPay.';
      return new Response(
        JSON.stringify({
          success: false,
          error: exactError
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. Extraction de la véritable référence renvoyée par GeniusPay (aucune fabrication locale)
    const geniuspayReference = String(
      gpData.reference ||
      gpData.data?.reference ||
      gpData.id ||
      gpData.data?.id ||
      gpData.transaction_id ||
      gpData.data?.transaction_id ||
      ''
    );

    // Enregistrement de la référence renvoyée par GeniusPay en statut pending
    // Ne crédite jamais le portefeuille dans create-wallet-recharge
    const { data: insertedTx, error: txError } = await supabase
      .from('wallet_transactions')
      .insert({
        user_id: authenticatedUserId,
        amount: amount,
        status: 'pending',
        provider: 'geniuspay',
        phone: phone_number || null,
        reference: geniuspayReference || null,
        provider_ref: geniuspayReference || null,
        created_at: new Date().toISOString()
      })
      .select('id, reference, status, amount')
      .maybeSingle();

    if (txError) {
      console.warn('Note insertion wallet_transactions:', txError.message);
    }

    // 5. Renvoie au frontend le champ checkout_url de la réponse, que le frontend ouvre tel quel
    return new Response(
      JSON.stringify({
        success: true,
        checkout_url: checkoutUrl,
        reference: geniuspayReference,
        status: 'pending',
        transaction_id: insertedTx?.id || null
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || 'Erreur interne du serveur' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
