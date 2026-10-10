import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import * as Crypto from 'expo-crypto';
import { ActivityRepository } from '../data/repository';
import { ActivityDay, Preferences, validDayKey, validGoal, validTotal } from '../domain/activity';
import { parseCell } from '../domain/exploration';
import { supabase } from './client';
import { supabaseUrl, supabasePublishableKey } from './config';
interface Snapshot { days: ActivityDay[]; cells: string[]; balance: number; profile: { display_name: string; avatar_key: Preferences['avatar'] }; preferences: { daily_goal:number; stride_meters:number; weight_kg:number; theme:Preferences['theme'] } }
function validate(value: Snapshot): Snapshot {
  if (!Array.isArray(value.days) || !Array.isArray(value.cells) || !Number.isSafeInteger(value.balance) || value.balance<0 || !value.profile || !value.preferences) throw new Error('Respuesta de sincronización no válida.');
  for(const day of value.days) if(!validDayKey(day.date) || !validTotal(day.steps) || !validGoal(day.goal) || !['sensor','health-connect'].includes(day.source)) throw new Error('Historial remoto no válido.');
  value.cells.forEach(parseCell); return value;
}
export function useSync(repo:ActivityRepository, userId:string|undefined, reload:()=>void) {
  const [busy,setBusy]=useState(false);
  const [status,setStatus]=useState(userId ? 'Preparando sincronización…' : 'Modo invitado · datos en este teléfono');
  const running=useRef(false); const alive=useRef(true); const controller=useRef<AbortController|null>(null);
  const [deviceId]=useState(()=>repo.deviceId(Crypto.randomUUID));
  const sync=useCallback(async () => {
    if(!userId || running.current || AppState.currentState!=='active' || !alive.current) return;
    running.current=true;setBusy(true);
    const abort=new AbortController();controller.current=abort;
    const timeout=setTimeout(()=>abort.abort(),20000);
    try {
      const {data,error}=await supabase.auth.getSession();
      if(error || data.session?.user.id!==userId) throw new Error('Vuelve a iniciar sesión para sincronizar. Tus datos locales se conservan.');
      const pending=repo.pending(); const days=pending.days.slice(0,100);const cells=pending.cells.slice(0,100);
      const response=await fetch(`${supabaseUrl}/functions/v1/walkworld-api`,{method:'POST',signal:abort.signal,headers:{Authorization:`Bearer ${data.session.access_token}`,apikey:supabasePublishableKey,'Content-Type':'application/json'},body:JSON.stringify({action:'sync',deviceId,days,cells,preferences:pending.preferences,editPreferences:pending.editPreferences})});
      const body=await response.json();
      if(!response.ok) throw new Error(body.error ?? 'La sincronización no se pudo completar.');
      if(!alive.current || abort.signal.aborted) return;
      const remote=validate(body);
      repo.saveRemote(remote);
      // A newer edit/reading made during the request remains queued.
      repo.acknowledge(days,cells.filter(cell=>remote.cells.includes(cell)),pending.preferenceRevision);
      if(!repo.pending().editPreferences) repo.restorePreferences({name:remote.profile.display_name,avatar:remote.profile.avatar_key,goal:remote.preferences.daily_goal,strideMeters:Number(remote.preferences.stride_meters),weightKg:Number(remote.preferences.weight_kg),theme:remote.preferences.theme});
      reload();
      const queued=repo.pending();
      setStatus(queued.days.length || queued.cells.length ? 'Parte sincronizada · quedan registros pendientes.' : `Sincronizado · ${new Date().toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit'})}`);
    } catch(error) { if(alive.current) setStatus(error instanceof Error && !(error instanceof TypeError) && error.name!=='AbortError' ? error.message : 'Sin conexión o tiempo agotado. Reintentaremos; tus datos siguen guardados.'); }
    finally { clearTimeout(timeout); controller.current=null;running.current=false;if(alive.current)setBusy(false); }
  },[repo,userId,reload,deviceId]);
  useEffect(()=>{
    alive.current=true;
    const first=setTimeout(()=>void sync(),0);
    const timer=setInterval(()=>void sync(),60000);
    const listener=AppState.addEventListener('change',state=>{if(state==='active')void sync();else controller.current?.abort();});
    return()=>{alive.current=false;clearTimeout(first);clearInterval(timer);listener.remove();controller.current?.abort();};
  },[sync]);
  return {sync,busy,status,deviceId};
}
