import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const apiKey = Deno.env.get('GENIUSPAY_API_KEY') || '';
    const apiSecret = Deno.env.get('GENIUSPAY_API_SECRET') || '';

    // URL de base officielle GeniusPay API Marchand (documentation : https://geniuspay.ci/docs/api)
    // En production : https://geniuspay.ci/api/v1/merchant
    // En sandbox : https://sandbox.geniuspay.ci/api/v1/merchant (ou URL personnalisée via GENIUSPAY_BASE_URL)
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

    // Exigence 5 : Ne JAMAIS faire confiance à un user_id envoyé par le client.
    // L'identifiant utilisateur est UNIQUEMENT celui extrait de la session vérifiée.
    const authenticatedUserId = user.id;

    // Vérifier que le profil existe dans public.profiles (solde officiel)
    const { data: userProfile, error: profileErr } = await supabase
      .from('profiles')
      .select('id, email, full_name, wallet_balance')
      .eq('id', authenticatedUserId)
      .maybeSingle();

    if (!userProfile || profileErr) {
      return new Response(
        JSON.stringify({ error: 'Profil utilisateur introuvable dans public.profiles.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { amount_fcfa, phone_number, customer_name, return_url, payment_method } = body;

    // Exigence 3 : Montant minimum obligatoire de 200 FCFA
    const amount = Math.round(Number(amount_fcfa) || 0);
    if (!amount || amount < 200) {
      return new Response(
        JSON.stringify({ error: 'Montant de recharge invalide. Le montant minimum est de 200 FCFA.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Normalisation de la méthode de paiement GeniusPay
    let normalizedMethod = (payment_method || '').toLowerCase().trim();
    if (['wave', 'orange_money', 'mtn_money', 'moov_money', 'card'].includes(normalizedMethod)) {
      // Méthode valide
    } else if (normalizedMethod === 'mtn_momo') {
      normalizedMethod = 'mtn_money';
    } else {
      normalizedMethod = 'wave';
    }

    // Référence marchand unique générée pour GeniusPay
    const merchantReference = `GP_REF_${Date.now()}_${crypto.randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase()}`;

    // 2. Enregistrer l'intention de transaction en statut 'pending' dans wallet_transactions
    const insertPayload: Record<string, any> = {
      user_id: authenticatedUserId,
      amount: amount,
      status: 'pending',
      provider: 'geniuspay',
      phone: phone_number || null,
      reference: merchantReference,
      created_at: new Date().toISOString()
    };

    const { data: insertedTx, error: txError } = await supabase
      .from('wallet_transactions')
      .insert(insertPayload)
      .select('id, reference, amount, status')
      .single();

    if (txError) {
      console.error('Erreur insertion transaction dans wallet_transactions:', txError.message);
      return new Response(
        JSON.stringify({
          error: 'Impossible d\'enregistrer la transaction en base. Prérequis : la colonne "reference" doit exister dans wallet_transactions.'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Appel de l'API officielle GeniusPay pour initialiser la session de paiement
    let checkoutUrl = '';
    let geniuspayTransactionId = '';
    let apiErrorMessage = '';

    if (apiKey && apiSecret) {
      try {
        const payload = {
          amount: amount,
          currency: 'XOF',
          reference: merchantReference,
          description: `Recharge portefeuille ArtisanPro - ${normalizedMethod.toUpperCase()}`,
          payment_method: normalizedMethod,
          customer: {
            name: customer_name || userProfile.full_name || user.email || 'Client',
            email: user.email || 'client@artisanpro.afrique',
            phone: phone_number || ''
          },
          return_url: return_url || 'https://artisanpro.afrique/wallet?status=return'
        };

        // En-têtes d'authentification stricts selon https://geniuspay.ci/docs/api
        // (X-API-Key et X-API-Secret exclusivement)
        const gpHeaders = {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-API-Key': apiKey,
          'X-API-Secret': apiSecret
        };

        // Route officielle : POST https://geniuspay.ci/api/v1/merchant/payments
        // (ou fallback direct sur /payments si baseUrl inclut déjà le sous-chemin)
        let endpointUrl = baseUrl.endsWith('/payments') ? baseUrl : `${baseUrl}/payments`;

        let gpResponse = await fetch(endpointUrl, {
          method: 'POST',
          headers: gpHeaders,
          body: JSON.stringify(payload)
        });

        if (gpResponse.ok) {
          const gpData = await gpResponse.json();

          // Extraction de l'URL de paiement documentée
          checkoutUrl = gpData.checkout_url || 
                        gpData.url || 
                        gpData.payment_url || 
                        gpData.data?.checkout_url || 
                        gpData.data?.url || 
                        gpData.data?.payment_url || 
                        '';

          // Exigence 1 & 4 : Extraire la VÉRITABLE référence retournée par GeniusPay.
          // NE JAMAIS utiliser un identifiant interne Supabase comme référence fournisseur de secours.
          geniuspayTransactionId = gpData.id || 
                                  gpData.data?.id || 
                                  gpData.transaction_id || 
                                  gpData.data?.transaction_id || 
                                  '';

          // Enregistrer la véritable référence GeniusPay dans provider_ref
          if (geniuspayTransactionId) {
            await supabase
              .from('wallet_transactions')
              .update({ provider_ref: String(geniuspayTransactionId) })
              .eq('id', insertedTx.id);
          }
        } else {
          apiErrorMessage = await gpResponse.text();
          console.error('Réponse non OK de l\'API GeniusPay:', gpResponse.status, apiErrorMessage);
        }
      } catch (err: any) {
        apiErrorMessage = err.message || 'Erreur réseau vers l\'API GeniusPay';
        console.error('Exception appel GeniusPay:', err);
      }
    } else {
      apiErrorMessage = 'Secrets GeniusPay (GENIUSPAY_API_KEY, GENIUSPAY_API_SECRET) non configurés sur Supabase';
    }

    // Si aucune URL de guichet n'a été obtenue : échec formel, aucun pending orphelin
    if (!checkoutUrl) {
      await supabase
        .from('wallet_transactions')
        .update({ status: 'failed' })
        .eq('id', insertedTx.id);

      return new Response(
        JSON.stringify({
          success: false,
          error: `Échec de communication avec GeniusPay (${apiErrorMessage || 'Aucune URL de guichet retournée'}). Aucun débit ni crédit n'a été effectué.`,
          reference: merchantReference
        }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        reference: merchantReference,
        provider_ref: geniuspayTransactionId || null,
        transaction_id: insertedTx.id,
        amount_fcfa: amount,
        payment_method: normalizedMethod,
        status: 'pending',
        checkout_url: checkoutUrl,
        message: 'Intention de recharge créée en statut pending. Redirection vers le guichet de paiement GeniusPay.'
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
