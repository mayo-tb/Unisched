import 'react-native-gesture-handler';
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';

import AdminDashboard from './src/components/AdminDashboard';
import ResourcesView from './src/components/ResourcesView';
import WeeklyScheduleView from './src/components/WeeklyScheduleView';
import WorkspaceView from './src/components/WorkspaceView';
import { View, Text } from 'react-native';

const Drawer = createDrawerNavigator();



const App: React.FC = () => {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Drawer.Navigator
          initialRouteName="Dashboard"
          screenOptions={{
            headerShown: false,
            drawerActiveTintColor: '#1d4ed8',
            drawerInactiveTintColor: '#64748b',
            drawerStyle: {
              backgroundColor: '#fff',
              width: 280,
            },
            drawerLabelStyle: {
              fontWeight: '700',
              fontSize: 15,
            }
          }}
        >
          <Drawer.Screen
            name="Dashboard"
            component={AdminDashboard}
            options={{ title: 'Intelligence Hub' }}
          />
          <Drawer.Screen
            name="Schedules"
            component={WeeklyScheduleView}
            options={{ title: 'My Schedules', headerShown: true }}
          />
          <Drawer.Screen
            name="Resources"
            component={ResourcesView}
            options={{ title: 'Manage Resources', headerShown: false }}
          />
          <Drawer.Screen
            name="Workspace"
            component={WorkspaceView}
            options={{ title: 'Workspace Settings', headerShown: false }}
          />
        </Drawer.Navigator>
      </NavigationContainer>
      <Toast />
    </SafeAreaProvider>
  );
};

export default App;
