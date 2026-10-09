import React from 'react';
import { Home } from '../../ui/screens';
import { Screen } from '../../ui/Screen';
import { useWalkWorld } from '../../ui/context';
export default function HomeRoute() { const props = useWalkWorld(); return <Screen><Home {...props} /></Screen>; }
