// =====================================================
//  FieldCorrect Mobile — Navigation
// =====================================================

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { RootStackParamList, MainTabParamList } from '@/types';
import { colors, typography } from '@/shared/theme';

// Screens — lazy imports keep the navigator file lean
import LoginScreen from '@/screens/LoginScreen';
import ProjectsScreen from '@/screens/ProjectsScreen';
import MapScreen from '@/screens/MapScreen';
import LayersScreen from '@/screens/LayersScreen';
import CorrectionsScreen from '@/screens/CorrectionsScreen';
import CorrectionFormScreen from '@/screens/CorrectionFormScreen';
import ProfileScreen from '@/screens/ProfileScreen';
import SettingsScreen from '@/screens/SettingsScreen';
import SyncScreen from '@/screens/SyncScreen';
import LayerConfigScreen from '@/screens/LayerConfigScreen';
import ImportWizardScreen from '@/screens/ImportWizardScreen';
import ConflictMergeScreen from '@/screens/ConflictMergeScreen';
import ProjectMembersScreen from '@/screens/ProjectMembersScreen';
import ZoneAssignScreen from '@/screens/ZoneAssignScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

const mapTabIcon = ({ color, size }: { color: string; size: number }) => (
  <Icon name="map" size={size} color={color} />
);

const layersTabIcon = ({ color, size }: { color: string; size: number }) => (
  <Icon name="layers" size={size} color={color} />
);

const correctionsTabIcon = ({ color, size }: { color: string; size: number }) => (
  <Icon name="pencil-box-outline" size={size} color={color} />
);

const profileTabIcon = ({ color, size }: { color: string; size: number }) => (
  <Icon name="account-circle" size={size} color={color} />
);

/* ───── Bottom Tab Navigator ───── */

function MainTabs() {
  return (
    <Tab.Navigator
      id="MainTabs"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          borderTopColor: colors.border,
          backgroundColor: colors.white,
          height: 60,
          paddingBottom: 8,
        },
        tabBarLabelStyle: { ...typography.caption },
      }}
    >
      <Tab.Screen
        name="Map"
        component={MapScreen}
        options={{
          tabBarLabel: 'Carte',
          tabBarIcon: mapTabIcon,
        }}
      />
      <Tab.Screen
        name="Layers"
        component={LayersScreen}
        options={{
          tabBarLabel: 'Couches',
          tabBarIcon: layersTabIcon,
        }}
      />
      <Tab.Screen
        name="Corrections"
        component={CorrectionsScreen}
        options={{
          tabBarLabel: 'Corrections',
          tabBarIcon: correctionsTabIcon,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Profil',
          tabBarIcon: profileTabIcon,
        }}
      />
    </Tab.Navigator>
  );
}

/* ───── Root Stack Navigator ───── */

export default function RootNavigator() {
  return (
    <Stack.Navigator
      id="RootStack"
      screenOptions={{
        headerStyle: { backgroundColor: colors.white },
        headerTintColor: colors.textPrimary,
        headerTitleStyle: typography.h3,
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen
        name="Login"
        component={LoginScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Projects"
        component={ProjectsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Main"
        component={MainTabs}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="CorrectionForm"
        component={CorrectionFormScreen}
        options={{ title: 'Nouvelle correction' }}
      />
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: 'Paramètres' }}
      />
      <Stack.Screen
        name="Sync"
        component={SyncScreen}
        options={{ title: 'Synchronisation' }}
      />
      <Stack.Screen
        name="LayerConfig"
        component={LayerConfigScreen}
        options={{ title: 'Configuration couche' }}
      />
      <Stack.Screen
        name="ImportWizard"
        component={ImportWizardScreen}
        options={{ title: 'Importer une couche' }}
      />
      <Stack.Screen
        name="ConflictMerge"
        component={ConflictMergeScreen}
        options={{ title: 'Résolution de conflit' }}
      />
      <Stack.Screen
        name="ProjectMembers"
        component={ProjectMembersScreen}
        options={{ title: 'Membres du projet' }}
      />
      <Stack.Screen
        name="ZoneAssign"
        component={ZoneAssignScreen}
        options={{ title: 'Zones d\'enquête' }}
      />
    </Stack.Navigator>
  );
}
