import React, { useState } from 'react';
import { Alert, TextInput, View } from 'react-native';
import { useAccount } from './context';
import { useWalkWorld } from '../ui/context';
import { Button, Card, Label } from '../ui/components';
import { openRepository } from '../data/local';
export function AccountCard() {
  const auth=useAccount();const {c,model,repo,sync}=useWalkWorld();
  const [email,setEmail]=useState('');const [password,setPassword]=useState('');const [link,setLink]=useState('');
  const field=(label:string,value:string,change:(value:string)=>void,secret=false)=><TextInput accessibilityLabel={label} placeholder={label} placeholderTextColor={c.muted} value={value} onChangeText={change} secureTextEntry={secret} autoCapitalize="none" autoCorrect={false} keyboardType={label==='Correo electrónico'?'email-address':'default'} style={{color:c.text,borderColor:c.line,borderWidth:1,borderRadius:12,padding:14,minHeight:48}} />;
  const perform=(work:()=>Promise<void>)=>{void work().finally(()=>setPassword(''));};
  return <Card c={c}><Label c={c} bold>Tu cuenta WalkWorld</Label>{auth.user ? <>
    <Label c={c} muted>{auth.user.email ?? 'Cuenta conectada'}</Label><Label c={c} muted size={13}>{sync.status}</Label>
    <Button c={c} disabled={sync.busy || auth.busy} title={sync.busy?'Sincronizando…':'Sincronizar ahora'} onPress={()=>void sync.sync()} />
    <Button c={c} secondary disabled={auth.busy} title="Importar historial de invitado" onPress={()=>Alert.alert('Importar datos de este teléfono','Se copiarán pasos y sectores del modo invitado a esta cuenta. Los días que ya existen no se sumarán. El historial de invitado permanece en el teléfono.',[{text:'Cancelar',style:'cancel'},{text:'Importar',onPress:()=>{try{repo.importGuest(openRepository().exportGuest());model.reload();void sync.sync();}catch{Alert.alert('Error','No se pudo importar el historial.');}}}])} />
    <Button c={c} secondary disabled={auth.busy} title="Cerrar sesión" onPress={()=>{model.pause();perform(auth.logout);}} />
    <Button c={c} secondary disabled={auth.busy} title="Eliminar cuenta y datos" onPress={()=>Alert.alert('Eliminar cuenta','Se borrarán permanentemente tu cuenta y sus datos en Supabase, y el historial de esta cuenta en este teléfono. Requiere internet. Las copias en otros teléfonos pueden permanecer sin conexión; borra allí el almacenamiento desde Android.',[{text:'Cancelar',style:'cancel'},{text:'Eliminar definitivamente',style:'destructive',onPress:()=>{model.pause();perform(auth.deleteAccount);}}])} />
  </> : <><Label c={c} muted size={14}>Puedes caminar sin cuenta. Al crear una, se guardarán en Supabase tu perfil, pasos, recompensas y sectores privados. El historial de invitado se importa solo si lo eliges.</Label>
    {field('Correo electrónico',email,setEmail)}{field('Contraseña (mínimo 10 caracteres)',password,setPassword,true)}
    <Button c={c} disabled={auth.busy} title={auth.busy?'Procesando…':'Iniciar sesión'} onPress={()=>perform(()=>auth.login(email,password))} />
    <Button c={c} secondary disabled={auth.busy} title="Crear cuenta" onPress={()=>perform(()=>auth.signup(email,password))} />
    <Button c={c} secondary disabled={auth.busy} title="Recuperar contraseña" onPress={()=>perform(()=>auth.reset(email))} />
  </>}
    {auth.recovery && <View style={{gap:10}}>{field('Nueva contraseña',password,setPassword,true)}<Button c={c} disabled={auth.busy} title="Guardar nueva contraseña" onPress={()=>perform(()=>auth.newPassword(password))} /></View>}
    <>{field('Pegar enlace de confirmación del correo',link,setLink)}<Button c={c} secondary disabled={auth.busy || !link.trim()} title="Confirmar enlace" onPress={()=>{perform(()=>auth.confirm(link));setLink('');}} /></>
    {!!auth.message && <Label c={c} muted size={13}>{auth.message}</Label>}
  </Card>;
}
