export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  return path.startsWith('walkworld://auth/callback') ? '/auth-callback' : path;
}
