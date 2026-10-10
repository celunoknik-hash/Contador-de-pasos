import React, { createContext, useContext } from 'react';
import { useAuth } from './useAuth';
const Context=createContext<ReturnType<typeof useAuth>|null>(null);
export function AccountProvider({children}:{children:React.ReactNode}) { const auth=useAuth(); return <Context.Provider value={auth}>{children}</Context.Provider>; }
export function useAccount() { const value=useContext(Context);if(!value)throw new Error('Cuenta no disponible.');return value; }
