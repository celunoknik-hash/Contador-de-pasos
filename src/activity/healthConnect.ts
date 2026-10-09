import { Platform } from 'react-native';
import { dayWindow } from '../domain/activity';
type HealthApi = typeof import('react-native-health-connect');
let client: HealthApi | undefined;
async function api() {
  if (Platform.OS !== 'android') throw new Error('Health Connect está disponible en Android.');
  try { client ??= await import('react-native-health-connect'); }
  catch { throw new Error('Health Connect necesita el APK o una compilación de desarrollo; no está incluido en Expo Go.'); }
  if (!await client.initialize()) throw new Error('Health Connect no está disponible. Instálalo o actualízalo desde Google Play y conecta una fuente de pasos.');
  return client;
}
export async function connectHealth() {
  const hc = await api();
  const granted = await hc.requestPermission([{ accessType: 'read', recordType: 'Steps' }]);
  if (!granted.some(p => p.accessType === 'read' && p.recordType === 'Steps')) throw new Error('No se concedió permiso para leer pasos.');
}
export async function healthTotal(day: string) {
  const hc = await api();
  const permissions = await hc.getGrantedPermissions();
  if (!permissions.some(p => p.accessType === 'read' && p.recordType === 'Steps')) throw new Error('Permiso de Health Connect revocado. Vuelve a conectarlo desde Perfil.');
  const { start, end } = dayWindow(day);
  if (end <= start) return 0;
  const result = await hc.aggregateRecord({ recordType: 'Steps', timeRangeFilter: {
    operator: 'between', startTime: start.toISOString(), endTime: end.toISOString(),
  }});
  return result.COUNT_TOTAL ?? 0;
}
export async function healthSettings() { (await api()).openHealthConnectSettings(); }
