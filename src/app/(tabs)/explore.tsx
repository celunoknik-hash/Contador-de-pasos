import React from 'react';
import { Later } from '../../ui/screens';
import { Screen } from '../../ui/Screen';
import { useWalkWorld } from '../../ui/context';
export default function ExploreRoute() { const { c } = useWalkWorld(); return <Screen><Later c={c} kind="map" /></Screen>; }
