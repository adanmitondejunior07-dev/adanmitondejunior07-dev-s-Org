# Plan Technique Complet : Intégration Sécurisée GeniusPay Sandbox

Ce document présente l'intégralité du plan technique pour l'intégration de **GeniusPay** (en mode Sandbox) dans l'application **ArtisanPro Afrique**.

---

## 1. Engagements Formels & Sécurité

1. **Aucune Suppression ni Remplacement** :
   - Aucun fichier, aucune table, aucune fonction Edge existante, aucune donnée utilisateur ni aucune fonctionnalité existante (Social, Artisans, Marketplace, Chat, Vidéos, Profil, etc.) ne sera supprimé ou écrasé.
2. **Préservation Totale de Moniz** :
   - Le secret `MONIZ_WEBHOOK_SECRET` ainsi que toute logique ou webhook existant lié à Moniz restent **100% intacts**. Aucun changement n'y sera apporté.
3. **Environnement Sandbox Uniquement** :
   - Aucun paiement réel ne sera débité pendant les tests. Les clés et endpoints utilisés sont strictement ceux de la **Sandbox GeniusPay**.
4. **Secret Server-Side Strict** :
   - Les clés secrètes (`GENIUSPAY_API_KEY`, `GENIUSPAY_API_SECRET`, `GENIUSPAY_BASE_URL`) sont lues **exclusivement côté serveur** via `Deno.env.get(...)` dans la fonction Edge Supabase. Elles ne sont **jamais** exposées au navigateur, au code client ou à l'application mobile.
5. **Validation Préalable** :
   - Aucune modification de code source ne sera exécutée sans votre validation explicite.

---

## 2. Inventaire Exact des Fichiers (Créations & Modifications)

### A. Fichiers qui seront CRÉÉS (Nouveaux Fichiers Isolés)
1. `supabase/functions/create-wallet-recharge/index.ts`
   - **Rôle** : Fonction Edge Supabase isolée pour initier une demande de recharge.
   - **Actions** :
     - Reçoit la requête HTTP POST avec le montant et le JWT de l'utilisateur.
     - Valide l'utilisateur connecté via Supabase Auth.
     - Enregistre une transaction avec le statut obligatoire `'pending'` et une référence unique (ex: `GP-REC-XXXX`).
     - Lit les secrets `GENIUSPAY_API_KEY`, `GENIUSPAY_API_SECRET` et `GENIUSPAY_BASE_URL` (Sandbox).
     - Appelle l'API GeniusPay Sandbox pour créer la session de paiement.
     - Renvoie au client l'URL du guichet de paiement (`checkout_url`) et la référence de transaction.
2. `supabase/functions/verify-wallet-recharge/index.ts`
   - **Rôle** : Endpoint serveur sécurisé de vérification de paiement et de webhook GeniusPay.
   - **Actions** :
     - Reçoit la référence de la transaction ou le webhook signé de GeniusPay.
     - Interroge l'API GeniusPay avec la clé secrète serveur pour vérifier que le paiement est réellement `'completed'` / `'paid'`.
     - Applique la protection anti-double crédit (verrou d'idempotence).
     - Crédite le portefeuille de l'utilisateur et passe le statut à `'completed'`.

### B. Fichiers Existants qui seront AJUSTÉS (Modifications Additives Minimales)
1. `src/types/index.ts`
   - **Changement** : Ajout de la valeur `'geniuspay'` dans le type `PaymentProvider` existant :
     ```ts
     export type PaymentProvider = 'orange_money' | 'mtn_momo' | 'moov_money' | 'wave' | 'wallet_internal' | 'geniuspay';
     ```
   - Aucune autre ligne n'est modifiée.
2. `src/lib/dataStore.ts`
   - **Changement** : Ajout de deux méthodes non-destructives :
     - `initiateGeniusPayRecharge(userId, amount, reference)` : enregistre la transaction locale en statut `'pending'`.
     - `confirmGeniusPayRecharge(reference, confirmedAmount)` : vérifie que la transaction n'est pas déjà créditée avant d'incrémenter le solde.
3. `src/components/wallet/WalletModal.tsx`
   - **Changement** : Ajout d'une option de paiement en ligne dans l'écran de recharge :
     - Bouton « ⚡ Payer en ligne via GeniusPay Sandbox (Orange, MTN, Moov, Wave) ».
     - Appel de la fonction `create-wallet-recharge` via le SDK Supabase.
     - Redirection sécurisée vers le guichet Sandbox GeniusPay.
     - Bouton « Actualiser / Vérifier mon paiement » qui déclenche la vérification serveur sans créditer artificiellement le compte.

---

## 3. Tables Supabase Utilisées & Schéma de Données

Les tables utilisées s'appuient sur les structures de données du portefeuille existant, sans migration destructive :

### Table 1 : `wallets`
| Colonne | Type | Description |
| :--- | :--- | :--- |
| `id` | `uuid` / `text` | Identifiant unique du portefeuille (`wlt-...`) |
| `user_id` | `uuid` | Référence de l'utilisateur propriétaire |
| `balance_fcfa` | `bigint` / `integer` | Solde disponible en unités entières FCFA |
| `currency` | `text` | Devise (`'FCFA'`) |
| `updated_at` | `timestamptz` | Date et heure de dernière mise à jour |

### Table 2 : `wallet_transactions`
| Colonne | Type | Description |
| :--- | :--- | :--- |
| `id` | `text` / `uuid` | Identifiant unique de la transaction (`tx-...`) |
| `wallet_id` | `text` / `uuid` | Identifiant du portefeuille associé |
| `user_id` | `uuid` | Utilisateur payeur |
| `type` | `text` | `'deposit'` |
| `amount_fcfa` | `integer` | Montant de la recharge en FCFA |
| `status` | `text` | **`'pending'`** à l'initiation, **`'completed'`** après validation certifiée |
| `provider` | `text` | `'geniuspay'` |
| `reference` | `text` | Référence unique générée par la plateforme (clé d'idempotence) |
| `provider_ref` | `text` | Identifiant de paiement retourné par GeniusPay |
| `description` | `text` | Libellé de l'opération |
| `created_at` | `timestamptz` | Date d'initiation |
| `confirmed_at` | `timestamptz` | Date de validation définitive |

---

## 4. Vérification Côté Serveur & Protection Anti-Double Crédit

### A. Règle du Statut Initial `pending`
- Dès que l'utilisateur soumet sa demande de recharge, l'Edge Function enregistre la transaction avec `status: 'pending'`.
- **Le portefeuille n'est JAMAIS crédité à cette étape**.
- Le retour de l'utilisateur sur l'application (même avec une URL de retour de type `/success` ou `status=success`) **ne crédite jamais le compte**.

### B. Vérification Authentifiée auprès de GeniusPay
- Le crédit intervient uniquement par l'intermédiaire de `verify-wallet-recharge` :
  1. L'Edge Function effectue un appel HTTP sortant vers l'API GeniusPay :
     ```
     GET ${GENIUSPAY_BASE_URL}/merchant/payments/${provider_ref}
     Headers:
       X-API-Key: ${GENIUSPAY_API_KEY}
       X-API-Secret: ${GENIUSPAY_API_SECRET}
     ```
  2. Si GeniusPay confirme que le statut officiel est `completed` ou `paid` :
     - La procédure de crédit est engagée.
  3. Si GeniusPay renvoie un statut `pending`, `failed` ou une anomalie :
     - Le solde reste inchangé.

### C. Mécanisme Strict Anti-Double Crédit (Idempotence)
Pour empêcher qu'un rechargement de page, un double clic ou un webhook répété ne crédite le compte plusieurs fois :
```ts
// 1. Recherche de la transaction par référence unique
const transaction = await getTransactionByReference(reference);

// 2. VERROU D'IDEMPOTENCE :
// Si la transaction est déjà marquée 'completed', STOP IMMÉDIAT
if (transaction.status === 'completed') {
  return new Response(JSON.stringify({ 
    success: true, 
    message: 'Transaction déjà traitée et créditée précédemment' 
  }), { status: 200 });
}

// 3. Mise à jour atomique du statut AVANT ou PENDANT le crédit
transaction.status = 'completed';
transaction.confirmed_at = new Date().toISOString();

// 4. Crédit unique du portefeuille
wallet.balance_fcfa += transaction.amount_fcfa;
wallet.updated_at = new Date().toISOString();
```
Ce verrou garantit mathématiquement qu'une transaction ne peut créditer le portefeuille qu'**une seule et unique fois**.
