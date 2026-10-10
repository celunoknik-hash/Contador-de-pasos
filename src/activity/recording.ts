import { requireNativeModule } from 'expo';
import { Platform } from 'react-native';

interface RecordingModule {
  start(owner: string): Promise<number>;
  readSteps(owner: string, epoch: number, start: number, end: number): Promise<number>;
  stop(): Promise<void>;
}
function api() {
  if (Platform.OS !== 'android') throw new Error('Recording API está disponible en Android.');
  try { return requireNativeModule<RecordingModule>('WalkWorldRecording'); }
  catch { throw new Error('Instala el nuevo APK de WalkWorld para contar en segundo plano. Recording API no está incluida en Expo Go.'); }
}
// Serialize native operations across account changes, including a pending subscribe/unsubscribe.
let queue: Promise<unknown> = Promise.resolve();
function serial<T>(work: () => Promise<T>): Promise<T> {
  const next = queue.catch(() => undefined).then(work);
  queue = next;
  return next;
}
export const recording = {
  start: (owner: string) => serial(() => api().start(owner)),
  read: (owner: string, epoch: number, start: number, end: number) => serial(() => api().readSteps(owner, epoch, start, end)),
  stop: () => serial(() => api().stop()),
};
