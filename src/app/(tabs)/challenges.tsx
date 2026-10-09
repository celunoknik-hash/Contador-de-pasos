import React from 'react';
import { Challenges } from '../../ui/screens';
import { Screen } from '../../ui/Screen';
import { useWalkWorld } from '../../ui/context';
export default function ChallengesRoute() { const { c, model } = useWalkWorld(); return <Screen><Challenges c={c} model={model} /></Screen>; }
