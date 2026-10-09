import React from 'react';
import { Profile } from '../../ui/screens';
import { Screen } from '../../ui/Screen';
import { useWalkWorld } from '../../ui/context';
export default function ProfileRoute() { const props = useWalkWorld(); return <Screen><Profile {...props} /></Screen>; }
