import 'react-native-gesture-handler';
import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createDrawerNavigator, DrawerContentScrollView, DrawerItemList, DrawerItem } from '@react-navigation/drawer';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ActivityIndicator, View, Alert, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';

// Auth
import LoginScreen from './src/components/LoginScreen';

// Admin Views
import AdminDashboard from './src/components/AdminDashboard';
import ResourcesView from './src/components/ResourcesView';
import WeeklyScheduleView from './src/components/WeeklyScheduleView';
import WorkspaceView from './src/components/WorkspaceView';

// Lecturer Views
import MyScheduleView from './src/components/MyScheduleView';
import PreferencesView from './src/components/PreferencesView';

// Shared
import ComplaintsView from './src/components/ComplaintsView';

const Drawer = createDrawerNavigator();

export const AuthContext = React.createContext({
  logout: () => { },
});

function CustomDrawerContent(props: any) {
  const { logout } = React.useContext(AuthContext);

  return (
    <DrawerContentScrollView {...props} contentContainerStyle={{ flex: 1 }}>
      <View style={{ flex: 1 }}>
        <DrawerItemList {...props} />
      </View>
      <View style={{ marginBottom: 20, borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 10 }}>
        <DrawerItem
          label="Logout"
          inactiveTintColor="#ef4444"
          icon={({ size }) => <Feather name="log-out" size={size} color="#ef4444" />}
          onPress={() => {
            if (Platform.OS === 'web') {
              if (window.confirm('Are you sure you want to log out?')) {
                logout();
              }
            } else {
              Alert.alert(
                'Logout',
                'Are you sure you want to log out?',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Logout',
                    style: 'destructive',
                    onPress: logout,
                  },
                ]
              );
            }
          }}
        />
      </View>
    </DrawerContentScrollView>
  );
}

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState<'ADMIN' | 'LECTURER' | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const tokenData = await AsyncStorage.getItem('gc_tokens');
      const userData = await AsyncStorage.getItem('gc_user');

      if (tokenData && userData) {
        const { access } = JSON.parse(tokenData);
        const { role } = JSON.parse(userData);
        if (access) {
          setIsAuthenticated(true);
          setUserRole(role || 'ADMIN'); // Fallback if old data
        }
      }
    } catch (err) {
      console.warn('Auth check error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLoginSuccess = async () => {
    await checkAuth();
  };

  const handleLogout = async () => {
    try {
      await AsyncStorage.multiRemove(['gc_tokens', 'gc_user', 'gc_workspace']);
    } catch (e) {
      console.error(e);
    }

    // Explicitly update state to unmount the Drawer and show LoginScreen
    setIsAuthenticated(false);
    setUserRole(null);

    // If on web, we can also force a hard reload to ensure clean slate
    if (Platform.OS === 'web') {
      window.location.reload();
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#0EA5E9" />
      </View>
    );
  }

  if (!isAuthenticated) {
    return (
      <SafeAreaProvider>
        <LoginScreen onLoginSuccess={handleLoginSuccess} />
        <Toast />
      </SafeAreaProvider>
    );
  }

  return (
    <AuthContext.Provider value={{ logout: handleLogout }}>
      <SafeAreaProvider>
        <NavigationContainer>
          <Drawer.Navigator
            drawerContent={(props) => <CustomDrawerContent {...props} />}
            initialRouteName={userRole === 'LECTURER' ? 'MySchedule' : 'Dashboard'}
            screenOptions={{
              headerShown: true, // We show header now so drawer button is visible
              drawerActiveTintColor: userRole === 'LECTURER' ? '#10B981' : '#0EA5E9',
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
            {userRole === 'ADMIN' ? (
              /* ── ADMIN NAVIGATION ────────────────────── */
              <>
                <Drawer.Screen
                  name="Dashboard"
                  component={AdminDashboard}
                  options={{ title: 'Intelligence Hub', headerShown: false }}
                />
                <Drawer.Screen
                  name="Workspace"
                  component={WorkspaceView}
                  options={{ title: 'Workspace Settings', headerShown: false }}
                />
                <Drawer.Screen
                  name="Schedules"
                  component={WeeklyScheduleView}
                  options={{ title: 'Full Schedules' }}
                />
                <Drawer.Screen
                  name="Resources"
                  component={ResourcesView}
                  options={{ title: 'Manage Resources', headerShown: false }}
                />
                <Drawer.Screen
                  name="Complaints"
                  component={ComplaintsView}
                  options={{ title: 'Complaints' }}
                />
              </>
            ) : (
              /* ── LECTURER NAVIGATION ─────────────────── */
              <>
                <Drawer.Screen
                  name="MySchedule"
                  component={MyScheduleView}
                  options={{ title: 'My Schedule' }}
                />
                <Drawer.Screen
                  name="Preferences"
                  component={PreferencesView}
                  options={{ title: 'Preferences' }}
                />
                <Drawer.Screen
                  name="Complaints"
                  component={ComplaintsView}
                  options={{ title: 'Complaints' }}
                />
              </>
            )}
          </Drawer.Navigator>
        </NavigationContainer>
        <Toast />
      </SafeAreaProvider>
    </AuthContext.Provider>
  );
};

export default App;
