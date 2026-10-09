import React from 'react';
import { Later } from '../../ui/screens';
import { Screen } from '../../ui/Screen';
import { useWalkWorld } from '../../ui/context';
export default function ChallengesRoute() { const { c } = useWalkWorld(); return <Screen><Later c={c} kind="challenges" /></Screen>; }
