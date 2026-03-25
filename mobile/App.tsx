import 'react-native-gesture-handler';
import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createDrawerNavigator, DrawerContentScrollView, DrawerItemList, DrawerItem } from '@react-navigation/drawer';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ActivityIndicator, View, Text, Alert, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';

// Auth
import LoginScreen from './src/components/LoginScreen';

// Admin Views
import AdminDashboard from './src/components/AdminDashboard';
import ResourcesView from './src/components/ResourcesView';
import WeeklyScheduleView from './src/components/WeeklyScheduleView';
import WorkspaceView from './src/components/WorkspaceView';
import OfficersView from './src/components/OfficersView';
import AuditLogView from './src/components/AuditLogView';

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
  const { role } = props;

  return (
    <DrawerContentScrollView {...props} contentContainerStyle={{ flex: 1 }}>
      {/* Brand Header */}
      <View style={{
        paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16,
        borderBottomWidth: 1, borderBottomColor: '#f1f5f9', marginBottom: 8,
      }}>
        <Text style={{ fontSize: 18, fontWeight: '800', color: '#0f172a' }}>UniSched</Text>
        <Text style={{ fontSize: 12, color: '#64748b', fontWeight: '600', marginTop: 2 }}>
          {role === 'LECTURER' ? 'Staff Portal' : 'Admin Portal'}
        </Text>
      </View>

      {/* Navigation label */}
      <Text style={{ fontSize: 10, fontWeight: '800', color: '#94a3b8', letterSpacing: 1, paddingHorizontal: 20, paddingBottom: 4, textTransform: 'uppercase' }}>
        Navigation
      </Text>

      <View style={{ flex: 1 }}>
        <DrawerItemList {...props} />
      </View>

      {/* Logout */}
      <View style={{ marginBottom: 20, borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 10 }}>
        <DrawerItem
          label="Logout"
          inactiveTintColor="#ef4444"
          icon={({ size }) => <Feather name="log-out" size={size} color="#ef4444" />}
          onPress={() => {
            if (Platform.OS === 'web') {
              if (window.confirm('Are you sure you want to log out?')) logout();
            } else {
              Alert.alert('Logout', 'Are you sure you want to log out?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Logout', style: 'destructive', onPress: logout },
              ]);
            }
          }}
        />
      </View>
    </DrawerContentScrollView>
  );
}

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState<'ADMIN' | 'LECTURER' | 'OFFICER' | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { checkAuth(); }, []);

  const checkAuth = async () => {
    try {
      const tokenData = await AsyncStorage.getItem('gc_tokens');
      const userData = await AsyncStorage.getItem('gc_user');
      if (tokenData && userData) {
        const { access } = JSON.parse(tokenData);
        const { role } = JSON.parse(userData);
        if (access) {
          setIsAuthenticated(true);
          setUserRole(role || 'ADMIN');
        }
      }
    } catch (err) {
      console.warn('Auth check error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLoginSuccess = async () => { await checkAuth(); };

  const handleLogout = async () => {
    try { await AsyncStorage.multiRemove(['gc_tokens', 'gc_user', 'gc_workspace']); }
    catch (e) { console.error(e); }
    setIsAuthenticated(false);
    setUserRole(null);
    if (Platform.OS === 'web') window.location.reload();
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

  // Officers are treated as admins (full access)
  const isAdmin = userRole === 'ADMIN' || userRole === 'OFFICER';
  const activeTintColor = userRole === 'LECTURER' ? '#10B981' : '#0EA5E9';

  return (
    <AuthContext.Provider value={{ logout: handleLogout }}>
      <SafeAreaProvider>
        <NavigationContainer>
          <Drawer.Navigator
            drawerContent={(props) => <CustomDrawerContent {...props} role={userRole} />}
            initialRouteName={userRole === 'LECTURER' ? 'MySchedule' : 'Dashboard'}
            screenOptions={{
              headerShown: true,
              drawerActiveTintColor: activeTintColor,
              drawerInactiveTintColor: '#64748b',
              drawerStyle: { backgroundColor: '#fff', width: 290 },
              drawerLabelStyle: { fontWeight: '700', fontSize: 14 },
            }}
          >
            {isAdmin ? (
              /* ── ADMIN / OFFICER NAVIGATION ─────────── */
              <>
                <Drawer.Screen
                  name="Dashboard"
                  component={AdminDashboard}
                  options={{
                    title: 'Command Hub',
                    headerShown: false,
                    drawerIcon: ({ color, size }) => <Feather name="grid" size={size} color={color} />,
                  }}
                />
                <Drawer.Screen
                  name="Workspace"
                  component={WorkspaceView}
                  options={{
                    title: 'Session Settings',
                    headerShown: false,
                    drawerIcon: ({ color, size }) => <Feather name="layers" size={size} color={color} />,
                  }}
                />
                <Drawer.Screen
                  name="Schedules"
                  component={WeeklyScheduleView}
                  options={{
                    title: 'Schedules',
                    drawerIcon: ({ color, size }) => <Feather name="calendar" size={size} color={color} />,
                  }}
                />
                <Drawer.Screen
                  name="Resources"
                  component={ResourcesView}
                  options={{
                    title: 'Manage Resources',
                    headerShown: false,
                    drawerIcon: ({ color, size }) => <Feather name="book-open" size={size} color={color} />,
                  }}
                />
                <Drawer.Screen
                  name="Officers"
                  component={OfficersView}
                  options={{
                    title: 'Timetable Officers',
                    headerShown: false,
                    drawerIcon: ({ color, size }) => <Feather name="users" size={size} color={color} />,
                  }}
                />
                <Drawer.Screen
                  name="Complaints"
                  component={ComplaintsView}
                  options={{
                    title: 'Feedback',
                    drawerIcon: ({ color, size }) => <Feather name="message-square" size={size} color={color} />,
                  }}
                />
                <Drawer.Screen
                  name="AuditLog"
                  component={AuditLogView}
                  options={{
                    title: 'Audit Log',
                    headerShown: false,
                    drawerIcon: ({ color, size }) => <Feather name="list" size={size} color={color} />,
                  }}
                />
              </>
            ) : (
              /* ── LECTURER NAVIGATION ─────────────────── */
              <>
                <Drawer.Screen
                  name="MySchedule"
                  component={MyScheduleView}
                  options={{
                    title: 'My Schedule',
                    drawerIcon: ({ color, size }) => <Feather name="calendar" size={size} color={color} />,
                  }}
                />
                <Drawer.Screen
                  name="Preferences"
                  component={PreferencesView}
                  options={{
                    title: 'Preferences',
                    drawerIcon: ({ color, size }) => <Feather name="sliders" size={size} color={color} />,
                  }}
                />
                <Drawer.Screen
                  name="Complaints"
                  component={ComplaintsView}
                  options={{
                    title: 'Feedback',
                    drawerIcon: ({ color, size }) => <Feather name="message-square" size={size} color={color} />,
                  }}
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
