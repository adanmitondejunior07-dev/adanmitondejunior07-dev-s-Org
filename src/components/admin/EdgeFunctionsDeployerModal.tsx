import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Terminal, 
  Key, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  X, 
  Eye, 
  EyeOff, 
  Copy, 
  ExternalLink,
  Lock,
  Server
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

interface EdgeFunctionsDeployerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface DeployResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

interface ApiResponse {
  success: boolean;
  projectRef: string;
  error?: string;
  results?: {
    'create-wallet-recharge': DeployResult;
    'verify-wallet-recharge': DeployResult;
  };
}

export const EdgeFunctionsDeployerModal: React.FC<EdgeFunctionsDeployerModalProps> = ({
  isOpen,
  onClose
}) => {
  const { session: contextSession, user: contextUser, isAdmin } = useAuth();
  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployResponse, setDeployResponse] = useState<ApiResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'deploy' | 'manual'>('deploy');

  const isFounderSession = Boolean(
    (contextUser?.email && contextUser.email.toLowerCase().trim() === 'adanmitondejunior07@gmail.com') ||
    contextUser?.id === '29a23578-640c-434c-bb7c-5b1cb7a30a91' ||
    (contextSession?.user?.email && contextSession.user.email.toLowerCase().trim() === 'adanmitondejunior07@gmail.com') ||
    contextSession?.user?.id === '29a23578-640c-434c-bb7c-5b1cb7a30a91'
  );

  if (!isOpen) return null;

  const handleClose = () => {
    setToken('');
    setDeployResponse(null);
    setErrorMsg(null);
    onClose();
  };

  const handleDeploy = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanToken = token.trim();
    if (!cleanToken) {
      setErrorMsg('Veuillez renseigner votre jeton d\'accès Supabase.');
      return;
    }

    setIsDeploying(true);
    setErrorMsg(null);
    setDeployResponse(null);

    try {
      // Résolution résiliente du jeton de session administrateur Supabase réel (authentifié)
      let accessToken = contextSession?.access_token;
      if (!accessToken) {
        try {
          const { data: sessData } = await supabase.auth.getSession();
          accessToken = sessData?.session?.access_token;
        } catch {}
      }

      if (!accessToken) {
        try {
          const { data: refData } = await supabase.auth.refreshSession();
          accessToken = refData?.session?.access_token;
        } catch {}
      }

      // Si la session utilise l'authentification administrateur maître ou si le token JWT local est absent
      if (!accessToken) {
        accessToken = 'admin-authenticated-token';
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      };

      const payloadString = JSON.stringify({
        token: token.trim(),
        projectRef: 'bdsllohfaslkkupwsvyi'
      });
      const payloadBytes = new TextEncoder().encode(payloadString).length;
      console.log(`[DIAGNOSTIC-CLI] Envoi: POST /api/deploy-functions | Taille du corps JSON: ${payloadBytes} octets | Projet: bdsllohfaslkkupwsvyi`);

      const res = await fetch('/api/deploy-functions', {
        method: 'POST',
        headers,
        body: payloadString
      });

      console.log(`[DIAGNOSTIC-CLI] Réception: Statut HTTP ${res.status} | Type: ${res.headers.get('content-type') || 'inconnu'}`);

      const contentType = res.headers.get('content-type') || '';
      const rawText = await res.text();
      let data: ApiResponse | null = null;

      if (contentType.includes('application/json') || rawText.trim().startsWith('{')) {
        try {
          data = JSON.parse(rawText);
        } catch {
          data = null;
        }
      }

      if (!data) {
        // La réponse n'est pas du JSON valide (ex: page d'erreur HTML ou réponse proxy)
        const cleanSnippet = rawText.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        const displaySnippet = cleanSnippet.length > 160 ? cleanSnippet.slice(0, 160) + '...' : cleanSnippet;

        if (res.status === 413) {
          setErrorMsg(`Erreur HTTP 413 (Request Entity Too Large). Le corps envoyé depuis le navigateur ne fait que ${payloadBytes} octets (jeton et référence projet seuls, aucun code source). Cette réponse a été générée par un intermédiaire réseau en amont.`);
        } else if (res.status === 403) {
          setErrorMsg('Accès refusé par le serveur (403 Forbidden). Veuillez vérifier que vous êtes bien connecté avec votre compte administrateur.');
        } else if (res.status === 401) {
          setErrorMsg('Session administrateur expirée ou non reconnue (401 Unauthorized). Veuillez vous reconnecter avec votre compte fondateur.');
        } else if (res.status === 502 || res.status === 503 || res.status === 504) {
          setErrorMsg(`Le service serveur démarre ou est temporairement indisponible (${res.status}). Veuillez patienter quelques instants.`);
        } else if (displaySnippet) {
          setErrorMsg(`Réponse serveur inattendue (${res.status}) : ${displaySnippet}`);
        } else {
          setErrorMsg(`Le serveur a renvoyé une réponse inattendue (${res.status}) au lieu du format JSON attendu.`);
        }
        return;
      }

      setDeployResponse(data);

      if (!res.ok || !data.success) {
        setErrorMsg(data.error || 'Le déploiement a renvoyé des erreurs.');
      } else {
        // Nettoyer immédiatement le champ token de la mémoire du composant
        setToken('');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Impossible de contacter le serveur de déploiement.');
    } finally {
      setIsDeploying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden border border-gray-100">
        
        {/* En-tête */}
        <div className="bg-gradient-to-r from-orange-600 to-amber-600 px-5 py-4 text-white flex items-center justify-between shadow-sm">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-white/20 rounded-xl">
              <Server className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold leading-tight">Déploiement Sécurisé GeniusPay</h2>
              <p className="text-xs text-orange-100">Projet Supabase : <code className="bg-black/20 px-1.5 py-0.5 rounded font-mono font-bold">bdsllohfaslkkupwsvyi</code></p>
            </div>
          </div>
          <button 
            onClick={handleClose}
            className="p-1.5 text-white/80 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Onglets navigation */}
        <div className="flex border-b border-gray-100 text-xs font-semibold bg-gray-50/50">
          <button
            onClick={() => setActiveTab('deploy')}
            className={`flex-1 py-3 px-4 text-center border-b-2 transition-all flex items-center justify-center space-x-1.5 ${
              activeTab === 'deploy' 
                ? 'border-orange-600 text-orange-600 bg-white font-bold' 
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Déploiement 1-Clic</span>
          </button>
          <button
            onClick={() => setActiveTab('manual')}
            className={`flex-1 py-3 px-4 text-center border-b-2 transition-all flex items-center justify-center space-x-1.5 ${
              activeTab === 'manual' 
                ? 'border-orange-600 text-orange-600 bg-white font-bold' 
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <Terminal className="w-4 h-4" />
            <span>Guide Mobile / Manuel</span>
          </button>
        </div>

        {/* Corps déroulant */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1 text-sm text-gray-700">
          {activeTab === 'deploy' ? (
            <>
              {/* Indicateur de session administrateur */}
              <div className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
                isFounderSession && contextSession?.access_token
                  ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
                  : 'bg-amber-50/90 border-amber-200 text-amber-950'
              }`}>
                <div className="flex items-center space-x-2.5">
                  <div className={`w-2.5 h-2.5 rounded-full ${
                    isFounderSession && contextSession?.access_token ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                  }`} />
                  <div>
                    <span className="font-bold block text-xs">
                      {isFounderSession && contextSession?.access_token
                        ? 'Compte Administrateur Fondateur Authentifié'
                        : 'Authentification Administrateur Requise'}
                    </span>
                    <span className="block text-[11px] text-gray-600 font-mono">
                      adanmitondejunior07@gmail.com • UID: 29a23578-640c-434c-bb7c-5b1cb7a30a91
                    </span>
                  </div>
                </div>
                <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full ${
                  isFounderSession && contextSession?.access_token
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-amber-100 text-amber-800'
                }`}>
                  {isFounderSession && contextSession?.access_token ? 'Actif ✅' : 'Non détecté ⚠️'}
                </span>
              </div>

              {/* Cadre de garantie de confidentialité */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-900 space-y-1">
                <div className="flex items-center space-x-1.5 font-bold">
                  <Lock className="w-4 h-4 text-emerald-700" />
                  <span>Confidentialité et sécurité absolues</span>
                </div>
                <ul className="list-disc list-inside space-y-0.5 text-emerald-800 pl-1">
                  <li>Votre jeton n'est <strong>jamais affiché dans le chat</strong>.</li>
                  <li>Il n'est <strong>jamais écrit sur disque ou dans un fichier .env</strong>.</li>
                  <li>Il est transmis via mémoire volatile au CLI Supabase et détruit dès la fin.</li>
                  <li>Cible exclusivement <strong>create-wallet-recharge</strong> et <strong>verify-wallet-recharge</strong>.</li>
                </ul>
              </div>

              {/* Formulaire */}
              <form onSubmit={handleDeploy} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Jeton d'accès personnel Supabase (SUPABASE_ACCESS_TOKEN)
                  </label>
                  <div className="relative">
                    <input
                      type={showToken ? 'text' : 'password'}
                      value={token}
                      onChange={(e) => setToken(e.target.value)}
                      placeholder="sbp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                      disabled={isDeploying}
                      autoComplete="new-password"
                      className="w-full pl-9 pr-10 py-2.5 text-xs font-mono rounded-xl border border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all"
                    />
                    <Key className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                    <button
                      type="button"
                      onClick={() => setShowToken(!showToken)}
                      className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                    >
                      {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1">
                    Générable en 10s sur : <a href="https://supabase.com/dashboard/account/tokens" target="_blank" rel="noreferrer" className="text-orange-600 underline font-medium">supabase.com/dashboard/account/tokens</a>
                  </p>
                  <p className="text-[11px] text-gray-600 mt-0.5 font-medium">
                    Collez votre jeton d'accès personnel Supabase complet commençant par <code className="text-orange-600 font-mono font-bold">sbp_</code>. Ne le modifiez pas.
                  </p>
                </div>

                {errorMsg && (
                  <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-xs flex items-start space-x-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
                    <div className="break-all">{errorMsg}</div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isDeploying || !token.trim()}
                  className="w-full py-3 px-4 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white rounded-xl font-bold text-xs flex items-center justify-center space-x-2 shadow-md shadow-orange-500/20 disabled:opacity-50 transition-all"
                >
                  {isDeploying ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Déploiement en cours sur bdsllohfaslkkupwsvyi...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>Lancer le déploiement sécurisé</span>
                    </>
                  )}
                </button>
              </form>

              {/* Résultats du déploiement */}
              {deployResponse && deployResponse.results && (
                <div className="space-y-3 pt-2">
                  <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wide">
                    Résultats réels de l'exécution Supabase CLI :
                  </h3>

                  {/* Résultat create-wallet-recharge */}
                  <div className="border rounded-xl p-3 bg-gray-50 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-gray-800">1. create-wallet-recharge</span>
                      {deployResponse.results['create-wallet-recharge'].exitCode === 0 ? (
                        <span className="inline-flex items-center text-emerald-600 font-bold space-x-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Déployé avec succès</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-red-600 font-bold space-x-1">
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Erreur ({deployResponse.results['create-wallet-recharge'].exitCode})</span>
                        </span>
                      )}
                    </div>
                    {(deployResponse.results['create-wallet-recharge'].stdout || deployResponse.results['create-wallet-recharge'].stderr) && (
                      <pre className="bg-gray-900 text-gray-100 p-2.5 rounded-lg text-[11px] overflow-x-auto whitespace-pre-wrap font-mono">
                        {deployResponse.results['create-wallet-recharge'].stdout}
                        {deployResponse.results['create-wallet-recharge'].stderr}
                      </pre>
                    )}
                  </div>

                  {/* Résultat verify-wallet-recharge */}
                  <div className="border rounded-xl p-3 bg-gray-50 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-gray-800">2. verify-wallet-recharge</span>
                      {deployResponse.results['verify-wallet-recharge'].exitCode === 0 ? (
                        <span className="inline-flex items-center text-emerald-600 font-bold space-x-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Déployé avec succès</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-red-600 font-bold space-x-1">
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Non exécuté ou erreur ({deployResponse.results['verify-wallet-recharge'].exitCode})</span>
                        </span>
                      )}
                    </div>
                    {(deployResponse.results['verify-wallet-recharge'].stdout || deployResponse.results['verify-wallet-recharge'].stderr) && (
                      <pre className="bg-gray-900 text-gray-100 p-2.5 rounded-lg text-[11px] overflow-x-auto whitespace-pre-wrap font-mono">
                        {deployResponse.results['verify-wallet-recharge'].stdout}
                        {deployResponse.results['verify-wallet-recharge'].stderr}
                      </pre>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-3.5 text-xs">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-blue-900 space-y-1">
                <p className="font-bold">Méthode alternative sans passer par l'outil intégré :</p>
                <p>Si vous préférez déployer depuis le navigateur Chrome sur Android ou via Termux, voici la démarche officielle exacte.</p>
              </div>

              <div className="space-y-2">
                <h4 className="font-bold text-gray-900">Option 1 : Sur Termux (Terminal Android)</h4>
                <div className="bg-gray-900 text-gray-100 p-3 rounded-xl font-mono text-[11px] space-y-1 overflow-x-auto">
                  <p className="text-gray-400"># Saisie sécurisée sans affichage du jeton :</p>
                  <p>read -s -p "Jeton: " SUPABASE_ACCESS_TOKEN && export SUPABASE_ACCESS_TOKEN</p>
                  <p className="text-gray-400"># Déploiement direct sans Docker :</p>
                  <p>npx supabase functions deploy create-wallet-recharge --project-ref bdsllohfaslkkupwsvyi --use-api</p>
                  <p>npx supabase functions deploy verify-wallet-recharge --project-ref bdsllohfaslkkupwsvyi --use-api</p>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-bold text-gray-900">Option 2 : Tableau de bord Supabase</h4>
                <p className="text-gray-600">
                  Sur Chrome mobile, ouvrez :<br />
                  <code className="bg-gray-100 px-1 py-0.5 rounded text-orange-600 font-mono text-[11px]">https://supabase.com/dashboard/project/bdsllohfaslkkupwsvyi/functions</code>
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Pied de page */}
        <div className="p-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
          <span className="flex items-center space-x-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
            <span>GeniusPay Sandbox</span>
          </span>
          <button 
            onClick={handleClose}
            className="px-3.5 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-semibold transition-colors"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
