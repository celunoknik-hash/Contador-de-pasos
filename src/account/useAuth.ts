import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import * as Linking from 'expo-linking';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './client';
import { secureStorage } from './secureStorage';
import { queueAccountDeletion } from '../data/local';
import { supabaseUrl } from './config';

export interface Identity { id: string; email?: string }
export function useAuth() {
  const [user,setUser] = useState<Identity | null>(null);
  const [ready,setReady] = useState(false);
  const [recovery,setRecovery] = useState(false);
  const [message,setMessage] = useState('');
  const [busy,setBusy] = useState(false);
  const busyRef = useRef(false);
  useEffect(() => {
    let active = true; let cacheWrites=Promise.resolve();
    const cache=(session:Session|null)=>{cacheWrites=cacheWrites.catch(()=>undefined).then(()=>session ? secureStorage.setItem('walkworld.identity',JSON.stringify({id:session.user.id,email:session.user.email})) : secureStorage.removeItem('walkworld.identity'));void cacheWrites.catch(()=>{if(active)setMessage('No se pudo guardar la sesión segura.');});};
    const apply = (session: Session | null) => { if (active) { setUser(session?.user ? { id: session.user.id, email: session.user.email } : null); setReady(true); } };
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event,session) => {
      if(event!=='INITIAL_SESSION') apply(session);
      if (event==='PASSWORD_RECOVERY') setRecovery(true);
      if(event==='SIGNED_IN' || event==='TOKEN_REFRESHED' || event==='SIGNED_OUT') cache(session);
    });
    void (async () => {
      try {
        const saved = await secureStorage.getItem('walkworld.identity');
        if (saved && active) {const identity=JSON.parse(saved); if(/^[0-9a-f-]{36}$/i.test(identity.id ?? ''))setUser(identity);}
        const { data,error } = await supabase.auth.getSession();
        if (!error) apply(data.session); else if(active) setMessage('Sin conexión: conserva tus datos locales y vuelve a iniciar sesión cuando tengas internet.');
      } catch { if(active) setMessage('No se pudo cargar la sesión segura.'); }
      finally { if(active) setReady(true); }
    })();
    const handleLink = async (url: string) => {
      if (!url.startsWith('walkworld://auth/callback')) return;
      try {
        const parsed = new URL(url);
        const code = parsed.searchParams.get('code');
        if (code) { const {error} = await supabase.auth.exchangeCodeForSession(code); if(error) throw error; }
      } catch { if(active) setMessage('El enlace caducó o pertenece a otro dispositivo. Puedes confirmar desde Perfil.'); }
    };
    void Linking.getInitialURL().then(url => { if(url) void handleLink(url); });
    const links = Linking.addEventListener('url',event => void handleLink(event.url));
    const app = AppState.addEventListener('change',state => { if(state==='active') supabase.auth.startAutoRefresh(); else supabase.auth.stopAutoRefresh(); });
    if(AppState.currentState!=='active') supabase.auth.stopAutoRefresh();
    return () => { active=false; subscription.unsubscribe(); links.remove(); app.remove(); supabase.auth.stopAutoRefresh(); };
  },[]);
  const run = async (work: () => Promise<string>) => {
    if(busyRef.current) return; busyRef.current=true; setBusy(true); setMessage('');
    try { setMessage(await work()); }
    catch(error) { setMessage(authMessage(error)); }
    finally { busyRef.current=false; setBusy(false); }
  };
  return { user,ready,recovery,busy,message,
    login: (email:string,password:string) => run(async () => { const {error} = await supabase.auth.signInWithPassword({email:email.trim(),password}); if(error) throw error; return 'Sesión iniciada.'; }),
    signup: (email:string,password:string) => run(async () => {
      if(password.length<10) throw new Error('Usa una contraseña de al menos 10 caracteres.');
      const {data,error}=await supabase.auth.signUp({email:email.trim(),password,options:{emailRedirectTo:'walkworld://auth/callback'}});
      if(error) throw error;
      return data.session ? 'Cuenta creada.' : 'Revisa tu correo y confirma la cuenta. Si el enlace no abre WalkWorld, puedes pegarlo abajo para confirmar aquí.';
    }),
    confirm: (link:string) => run(async () => {
      let url:URL;try{url=new URL(link.trim());}catch{throw new Error('Pega el enlace completo recibido por correo.');}
      if(url.origin!==supabaseUrl || !url.pathname.startsWith('/auth/v1/verify')) throw new Error('Pega únicamente el enlace de confirmación de WalkWorld recibido por correo.');
      const token=url.searchParams.get('token'); const type=url.searchParams.get('type');
      if(!token || !['signup','recovery','email'].includes(type ?? '')) throw new Error('Enlace de confirmación no válido.');
      const {error}=await supabase.auth.verifyOtp({token_hash:token,type:type as 'signup'|'recovery'|'email'});if(error)throw error;
      if(type==='recovery')setRecovery(true);return 'Correo confirmado.';
    }),
    reset: (email:string) => run(async () => { const {error}=await supabase.auth.resetPasswordForEmail(email.trim(),{redirectTo:'walkworld://auth/callback'});if(error)throw error;return 'Si la cuenta existe, recibirás un correo para recuperar el acceso.'; }),
    newPassword: (password:string) => run(async () => { if(password.length<10)throw new Error('Usa al menos 10 caracteres.'); const {error}=await supabase.auth.updateUser({password});if(error)throw error;setRecovery(false);return 'Contraseña actualizada.'; }),
    logout: () => run(async () => { const {error}=await supabase.auth.signOut({scope:'local'}); await secureStorage.removeItem('walkworld.auth.v1');await secureStorage.removeItem('walkworld.identity');setUser(null);return error ? 'Sesión cerrada en el teléfono. Sin conexión no se pudo revocar la sesión remota.' : 'Sesión cerrada.'; }),
    deleteAccount: () => run(async () => {
      const {data,error}=await supabase.functions.invoke('walkworld-api',{body:{action:'delete-account',confirm:'ELIMINAR'}});
      if(error || !data?.deleted)throw new Error('La cuenta no pudo eliminarse. Conéctate a internet e inténtalo de nuevo.');
      const id=user?.id;if(id)queueAccountDeletion(id); await supabase.auth.signOut({scope:'local'});await secureStorage.removeItem('walkworld.auth.v1');await secureStorage.removeItem('walkworld.identity');setUser(null);
      return 'Cuenta y datos eliminados.';
    }),
  };
}


function authMessage(error:unknown) {
 const messages:Record<string,string>={invalid_credentials:'Correo o contraseña incorrectos.',email_not_confirmed:'Confirma tu correo antes de iniciar sesión.',over_email_send_rate_limit:'Se alcanzó el límite de correos. Espera y vuelve a intentarlo.',over_request_rate_limit:'Demasiados intentos. Espera antes de continuar.',signup_disabled:'El registro no está habilitado.',email_address_not_authorized:'El servicio de correo aún no permite enviar a esta dirección. Falta configurar SMTP para usuarios externos.',user_already_exists:'Esta cuenta ya existe. Prueba iniciar sesión o recuperar tu contraseña.',otp_expired:'El enlace caducó. Solicita otro correo.',weak_password:'Elige una contraseña más segura.'};
 if(error instanceof Error && error.name.startsWith('Auth')) {const code='code' in error ? String(error.code) : '';return messages[code] ?? 'No se pudo completar la operación de cuenta. Revisa tu conexión y los datos e inténtalo de nuevo.';}
 return error instanceof Error ? error.message : 'No se pudo completar la operación.';
}
