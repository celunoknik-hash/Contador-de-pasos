import * as SecureStore from 'expo-secure-store';
import { randomUUID } from 'expo-crypto';
import { createSecureStorage } from '../domain/secureStorage';
export const secureStorage=createSecureStorage(SecureStore,randomUUID);
