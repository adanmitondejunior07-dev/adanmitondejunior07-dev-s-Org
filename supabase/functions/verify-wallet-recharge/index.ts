import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ADMIN_EMAIL = 'adanmitondejunior07@gmail.com';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const apiKey = Deno.env.get('GENIUSPAY_API_KEY') || '';
    const apiSecret = Deno.env.get('GENIUSPAY_API_SECRET') || '';

    // URL de base officielle GeniusPay API Marchand (documentation : https://geniuspay.ci/docs/api)
    const rawBaseUrl = Deno.env.get('GENIUSPAY_BASE_URL') || 'https://sandbox.geniuspay.ci/api/v1/merchant';
    const baseUrl = rawBaseUrl.replace(/\/+$/, '');

    // 1. Authentification obligatoire de l'utilisateur par session Supabase
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
        JSON.stringify({ error: 'Session invalide ou expirée. Authentification requise.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const reference = typeof body.reference === 'string' ? body.reference.trim() : '';
    const transactionId = typeof body.transaction_id === 'string' ? body.transaction_id.trim() : '';
    const providerRef = typeof body.provider_ref === 'string' ? body.provider_ref.trim() : '';

    const lookupKey = reference || providerRef || transactionId;
    if (!lookupKey) {
      return new Response(
        JSON.stringify({ error: 'Identifiant unique de transaction manquant (reference ou provider_ref requis).' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Recherche stricte par identifiant unique exact (JAMAIS par numéro de téléphone)
    let query = supabase.from('wallet_transactions').select('*');

    if (reference) {
      query = query.eq('reference', reference);
    } else if (providerRef) {
      query = query.eq('provider_ref', providerRef);
    } else {
      query = query.eq('id', transactionId);
    }

    const { data: transaction, error: fetchErr } = await query.maybeSingle();

    if (fetchErr || !transaction) {
      return new Response(
        JSON.stringify({ error: 'Transaction introuvable avec cet identifiant unique.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Exigence 5 : Ne JAMAIS faire confiance à un user_id envoyé par le client.
    // L'utilisateur connecté doit obligatoirement être le propriétaire de la transaction ou l'administrateur.
    const isOwner = user.id === transaction.user_id;
    const isAdmin = (user.email || '').toLowerCase() === ADMIN_EMAIL.toLowerCase();

    if (!isOwner && !isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Accès interdit : vous ne pouvez pas vérifier la transaction d\'un autre compte.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const expectedAmount = Number(transaction.amount) || 0;

    // Exigence 3 : Montant minimal de 200 FCFA
    if (!expectedAmount || expectedAmount < 200) {
      return new Response(
        JSON.stringify({ error: 'Montant de transaction enregistré invalide (minimum 200 FCFA requis).' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Exigence 6 : Idempotence stricte (si déjà complétée, arrêt immédiat sans recréditer)
    if (transaction.status === 'completed') {
      const { data: currentProfile } = await supabase
        .from('profiles')
        .select('wallet_balance')
        .eq('id', transaction.user_id)
        .maybeSingle();

      return new Response(
        JSON.stringify({
          success: true,
          status: 'completed',
          already_processed: true,
          amount_fcfa: expectedAmount,
          new_balance: currentProfile?.wallet_balance || 0,
          reference: transaction.reference,
          provider_ref: transaction.provider_ref,
          message: 'Transaction déjà confirmée et créditée précédemment. Aucun double crédit.'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Vérifier que le statut en base est strictement 'pending'
    if (transaction.status !== 'pending') {
      return new Response(
        JSON.stringify({
          success: false,
          status: transaction.status,
          error: `Transaction inéligible : le statut actuel est '${transaction.status}' (statut pending requis).`
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Vérifier que le fournisseur est bien GeniusPay
    if (String(transaction.provider || '').toLowerCase() !== 'geniuspay') {
      return new Response(
        JSON.stringify({ error: 'Transaction non éligible : fournisseur différent de GeniusPay.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ====================================================================
    // 4. Exigence 1, 2, 5 : VÉRIFICATION STRICTE AUPRÈS DE L'API GENIUSPAY
    // ====================================================================
    if (!apiKey || !apiSecret) {
      return new Response(
        JSON.stringify({ error: 'Secrets GeniusPay (GENIUSPAY_API_KEY, GENIUSPAY_API_SECRET) non configurés sur Supabase.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Interroger GeniusPay avec la véritable référence fournisseur ou la référence marchand
    const queryRef = transaction.provider_ref || transaction.reference;
    if (!queryRef) {
      return new Response(
        JSON.stringify({ error: 'Référence de transaction introuvable pour la vérification GeniusPay.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let gpData: any = null;
    let gpFetchOk = false;

    try {
      // Documentation officielle : GET https://geniuspay.ci/api/v1/merchant/payments/:reference
      let endpointUrl = baseUrl.endsWith('/payments')
        ? `${baseUrl}/${encodeURIComponent(queryRef)}`
        : `${baseUrl}/payments/${encodeURIComponent(queryRef)}`;

      let gpResponse = await fetch(endpointUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'X-API-Key': apiKey,
          'X-API-Secret': apiSecret
        }
      });

      let errorText = '';
      let isNotFound = false;

      if (gpResponse.ok) {
        gpData = await gpResponse.json();
        gpFetchOk = true;

        if (
          gpData?.code === 'TRANSACTION_NOT_FOUND' ||
          gpData?.error === 'TRANSACTION_NOT_FOUND' ||
          gpData?.status === 'TRANSACTION_NOT_FOUND' ||
          gpData?.data?.status === 'TRANSACTION_NOT_FOUND'
        ) {
          isNotFound = true;
        }
      } else {
        errorText = await gpResponse.text();
        console.warn('API GeniusPay statut non-200:', gpResponse.status, errorText);

        let errJson: any = null;
        try { errJson = JSON.parse(errorText); } catch {}

        if (
          errorText.includes('TRANSACTION_NOT_FOUND') ||
          errJson?.code === 'TRANSACTION_NOT_FOUND' ||
          errJson?.error === 'TRANSACTION_NOT_FOUND' ||
          errJson?.message === 'TRANSACTION_NOT_FOUND' ||
          (errJson?.message && String(errJson.message).toUpperCase().includes('NOT_FOUND')) ||
          gpResponse.status === 404
        ) {
          isNotFound = true;
        }
      }

      // En sandbox, si verify-wallet-recharge reçoit TRANSACTION_NOT_FOUND, laisse le statut pending.
      if (isNotFound) {
        return new Response(
          JSON.stringify({
            success: false,
            status: 'pending',
            is_paid: false,
            message: 'Transaction en attente de validation (TRANSACTION_NOT_FOUND). Statut maintenu en pending.',
            reference: transaction.reference
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } catch (networkErr: any) {
      console.error('Erreur réseau appel API GeniusPay:', networkErr);
    }

    // Si GeniusPay ne répond pas ou renvoie une erreur -> NE JAMAIS CRÉDITER
    if (!gpFetchOk || !gpData) {
      return new Response(
        JSON.stringify({
          success: false,
          status: 'pending',
          is_paid: false,
          message: 'Données GeniusPay injoignables ou invérifiables auprès de la passerelle. Le portefeuille reste non crédité.',
          reference: transaction.reference
        }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extraction et normalisation des données retournées par GeniusPay
    const paymentPayload = gpData.data || gpData;
    const gpStatus = String(paymentPayload.status || '').toLowerCase().trim();
    const gpAmount = Number(paymentPayload.amount !== undefined ? paymentPayload.amount : NaN);
    const gpCurrency = String(paymentPayload.currency || '').toUpperCase().trim();
    const gpRef = String(paymentPayload.reference || paymentPayload.transaction_id || paymentPayload.id || '').trim();

    // ====================================================================
    // EXIGENCE 2 & 5 : CONTRÔLE STRICT DES 4 CRITÈRES OBLIGATOIRES
    // ====================================================================
    // 1. Exigence 2 : "completed" comme SEUL statut de paiement réussi
    const isStatusCompleted = gpStatus === 'completed';

    // 2. Montant exact vérifié
    const isAmountValid = !isNaN(gpAmount) && gpAmount === expectedAmount;

    // 3. Devise vérifiée
    const isCurrencyValid = gpCurrency === 'XOF' || gpCurrency === 'FCFA';

    // 4. Concordance de référence
    const isRefMatching = gpRef === transaction.reference || gpRef === transaction.provider_ref;

    // Exigence 5 : Ne crédite jamais le portefeuille si la référence, le montant, la devise ou le statut sont absents ou incohérents
    if (!isStatusCompleted || !isAmountValid || !isCurrencyValid || !isRefMatching) {
      return new Response(
        JSON.stringify({
          success: false,
          status: gpStatus || transaction.status,
          is_paid: false,
          error: `Données GeniusPay non conformes ou paiement non complété (statut: '${gpStatus || 'manquant'}', montant: ${gpAmount || 'invalide'} ${gpCurrency || ''}, référence: '${gpRef || 'manquante'}'). Aucun crédit effectué.`,
          reference: transaction.reference
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ====================================================================
    // 5. Exigence 6 & 7 : EXÉCUTION DE LA RPC POSTGRESQL ATOMIQUE
    // ====================================================================
    // Appel sécurisé par la clé de service interne (service_role)
    const { data: rpcResult, error: rpcError } = await supabase.rpc('credit_wallet_transaction', {
      p_transaction_id: String(transaction.id)
    });

    if (rpcError) {
      console.error('Erreur exécution RPC credit_wallet_transaction:', rpcError);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Échec de la validation atomique en base : ' + (rpcError.message || 'Erreur RPC')
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const resObj = (rpcResult || {}) as any;

    if (!resObj.success) {
      return new Response(
        JSON.stringify({
          success: false,
          error: resObj.error || 'Échec de validation de la transaction'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        status: 'completed',
        already_processed: Boolean(resObj.already_processed),
        amount_fcfa: expectedAmount,
        new_balance: resObj.new_balance,
        reference: transaction.reference,
        provider_ref: transaction.provider_ref || gpRef,
        message: resObj.already_processed
          ? 'Transaction déjà confirmée et créditée précédemment.'
          : `Paiement certifié par GeniusPay (Montant: ${expectedAmount.toLocaleString('fr-FR')} FCFA, Devise: XOF, Statut: completed). Portefeuille crédité dans profiles.wallet_balance.`
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || 'Erreur interne de vérification' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
