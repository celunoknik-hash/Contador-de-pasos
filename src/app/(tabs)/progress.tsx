import React from 'react';
import { Progress } from '../../ui/screens';
import { Screen } from '../../ui/Screen';
import { useWalkWorld } from '../../ui/context';
export default function ProgressRoute() { const props = useWalkWorld(); return <Screen><Progress {...props} /></Screen>; }
