import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-moniz-signature, x-signature, x-geniuspay-signature, x-hub-signature-256',
};

// Vérification de la signature HMAC-SHA256
async function verifyHmacSha256(rawBody: string, signature: string, secret: string): Promise<boolean> {
  if (!signature || !secret) return false;
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signatureBuffer = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(rawBody)
    );

    const hashArray = Array.from(new Uint8Array(signatureBuffer));
    const hexHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toLowerCase();
    const cleanSignature = signature.trim().toLowerCase().replace(/^sha256=/, '');

    return hexHash === cleanSignature;
  } catch (err) {
    console.error('Erreur calcul HMAC-SHA256:', err);
    return false;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const webhookSecret = 
      Deno.env.get('MONIZ_WEBHOOK_SECRET') || 
      Deno.env.get('GENIUSPAY_WEBHOOK_SECRET') || 
      Deno.env.get('GENIUSPAY_API_SECRET') || 
      '';

    const rawBody = await req.text();
    const signature = 
      req.headers.get('x-moniz-signature') ||
      req.headers.get('x-signature') ||
      req.headers.get('x-geniuspay-signature') ||
      req.headers.get('x-hub-signature-256') ||
      '';

    // 1. VÉRIFICATION STRICTE DE LA SIGNATURE HMAC-SHA256 AVANT TOUT CRÉDIT
    if (!webhookSecret) {
      console.error('MONIZ_WEBHOOK_SECRET ou GENIUSPAY_API_SECRET manquant dans les secrets Supabase.');
      return new Response(
        JSON.stringify({ error: 'Secret de webhook non configuré sur le serveur.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const isValidSignature = await verifyHmacSha256(rawBody, signature, webhookSecret);
    if (!isValidSignature) {
      console.warn('Rejet webhook : signature HMAC-SHA256 invalide ou manquante.');
      return new Response(
        JSON.stringify({ error: 'Signature HMAC-SHA256 invalide ou absente. Accès non autorisé.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. PARSING DU PAYLOAD DU WEBHOOK
    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return new Response(
        JSON.stringify({ error: 'Format JSON invalide dans le corps du webhook.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const dataObj = payload.data || payload;
    const reference = String(
      dataObj.reference ||
      dataObj.transaction_id ||
      dataObj.id ||
      payload.reference ||
      payload.transaction_id ||
      ''
    ).trim();

    if (!reference) {
      return new Response(
        JSON.stringify({ error: 'Référence de transaction absente du webhook.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const status = String(dataObj.status || payload.status || payload.event || '').toLowerCase().trim();
    const isSuccessful = 
      status === 'completed' || 
      status === 'successful' || 
      status === 'success' || 
      status === 'paid' ||
      status === 'payment.completed' ||
      status === 'charge.completed';

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 3. RECHERCHE DE LA TRANSACTION ET VÉRIFICATION D'IDEMPOTENCE (UNE SEULE FOIS PAR RÉFÉRENCE)
    const { data: existingTx, error: txErr } = await supabase
      .from('wallet_transactions')
      .select('*')
      .or(`reference.eq.${reference},provider_ref.eq.${reference}`)
      .maybeSingle();

    if (txErr) {
      console.error('Erreur recherche transaction webhook:', txErr.message);
      return new Response(
        JSON.stringify({ error: 'Erreur base de données lors de la recherche de transaction.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // SI LA TRANSACTION EST DÉJÀ COMPLÉTÉE : ARRÊT IMMÉDIAT SANS RE-CRÉDITER
    if (existingTx && existingTx.status === 'completed') {
      return new Response(
        JSON.stringify({
          success: true,
          already_processed: true,
          message: 'Webhook déjà traité pour cette référence. Aucun double crédit.',
          reference
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Si le statut n'est pas un succès de paiement, on met à jour le statut sans créditer
    if (!isSuccessful) {
      if (existingTx) {
        await supabase
          .from('wallet_transactions')
          .update({ status: status || 'failed' })
          .eq('id', existingTx.id);
      }
      return new Response(
        JSON.stringify({
          success: true,
          credited: false,
          status,
          message: 'Notification de statut non réussi enregistrée. Portefeuille non crédité.',
          reference
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. CRÉDITER LE PORTEFEUILLE UNE SEULE FOIS PAR RÉFÉRENCE
    let creditAmount = Number(existingTx?.amount || dataObj.amount || payload.amount || 0);
    const targetUserId = existingTx?.user_id || dataObj.user_id || dataObj.customer_id;

    if (!targetUserId || creditAmount < 200) {
      return new Response(
        JSON.stringify({ error: 'Montant invalide ou utilisateur introuvable pour le crédit.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Si la transaction existe dans wallet_transactions, exécuter la RPC atomique
    if (existingTx) {
      const { data: rpcRes, error: rpcErr } = await supabase.rpc('credit_wallet_transaction', {
        p_transaction_id: String(existingTx.id)
      });

      if (!rpcErr && rpcRes?.success) {
        return new Response(
          JSON.stringify({
            success: true,
            credited: true,
            new_balance: rpcRes.new_balance,
            reference,
            message: 'Portefeuille crédité avec succès via webhook sécurisé HMAC-SHA256.'
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // En cas de fallback sans RPC ou nouvelle transaction
    // Mise à jour ou insertion atomique
    if (existingTx) {
      await supabase
        .from('wallet_transactions')
        .update({
          status: 'completed',
          confirmed_at: new Date().toISOString()
        })
        .eq('id', existingTx.id);
    } else {
      await supabase
        .from('wallet_transactions')
        .insert({
          user_id: targetUserId,
          amount: creditAmount,
          status: 'completed',
          provider: 'geniuspay',
          reference: reference,
          provider_ref: reference,
          confirmed_at: new Date().toISOString(),
          created_at: new Date().toISOString()
        });
    }

    // Crédit du solde dans profiles
    const { data: userProf } = await supabase
      .from('profiles')
      .select('wallet_balance')
      .eq('id', targetUserId)
      .maybeSingle();

    const newBalance = (Number(userProf?.wallet_balance) || 0) + creditAmount;
    await supabase
      .from('profiles')
      .update({ wallet_balance: newBalance })
      .eq('id', targetUserId);

    // Si profil artisan, synchronisation solde
    try {
      const { data: artRow } = await supabase
        .from('artisans')
        .select('solde')
        .eq('id', targetUserId)
        .maybeSingle();

      if (artRow) {
        await supabase
          .from('artisans')
          .update({ solde: (Number(artRow.solde) || 0) + creditAmount })
          .eq('id', targetUserId);
      }
    } catch {}

    return new Response(
      JSON.stringify({
        success: true,
        credited: true,
        new_balance: newBalance,
        reference,
        message: 'Portefeuille crédité avec succès (une seule fois par référence).'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || 'Erreur interne du webhook' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
