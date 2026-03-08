/**
 * UniSched — Login Screen
 * Admin vs Staff segmented tabs
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../lib/api';

interface LoginScreenProps {
  onLoginSuccess: () => void;
}

type TabType = 'admin' | 'staff';
type StaffMode = 'login' | 'signup';

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [activeTab, setActiveTab] = useState<TabType>('admin');
  const [loading, setLoading] = useState(false);

  // Admin state
  const [adminUsername, setAdminUsername] = useState('demo');
  const [adminPassword, setAdminPassword] = useState('demo123');

  // Staff state
  const [staffMode, setStaffMode] = useState<StaffMode>('login');
  const [staffId, setStaffId] = useState('');
  const [staffPassword, setStaffPassword] = useState('');
  const [staffFullName, setStaffFullName] = useState('');

  const processTokensAndStore = async (data: any, expectedRole: 'ADMIN' | 'LECTURER') => {
    const { access, refresh, role: userRole, staff_id, user_id, username, full_name } = data;

    await AsyncStorage.setItem('gc_tokens', JSON.stringify({ access, refresh }));
    await AsyncStorage.setItem(
      'gc_user',
      JSON.stringify({
        id: user_id,
        username,
        full_name,
        role: userRole,
        staff_id,
      })
    );

    api.defaults.headers.common['Authorization'] = `Bearer ${access}`;
    Alert.alert('Success', `Logged in as ${userRole === 'ADMIN' ? 'Admin' : 'Lecturer'}`);
    onLoginSuccess();
  };

  const handleAdminLogin = async () => {
    if (!adminUsername || !adminPassword) {
      Alert.alert('Missing Fields', 'Please enter username and password');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/api/auth/login/', {
        credential: adminUsername.trim(),
        password: adminPassword.trim(),
      });
      await processTokensAndStore(response.data, 'ADMIN');
    } catch (error: any) {
      console.error('Login error:', error);
      let message = 'Login failed. Please try again later.';
      if (error.response?.status === 401 || error.response?.data?.detail) {
        message = 'Wrong credentials. Please check your username and password.';
      }
      Alert.alert('Login Failed', message);
    } finally {
      setLoading(false);
    }
  };

  const handleStaffLogin = async () => {
    if (!staffId || !staffPassword) {
      Alert.alert('Missing Fields', 'Please enter Staff ID and password');
      return;
    }

    setLoading(true);
    try {
      if (staffMode === 'signup') {
        if (!staffFullName) {
          Alert.alert('Missing Fields', 'Please enter your Full Name');
          setLoading(false);
          return;
        }

        // 1. Register
        await api.post('/api/auth/register/', {
          full_name: staffFullName.trim(),
          staff_id: staffId.trim(),
          password: staffPassword.trim(),
          role: 'LECTURER',
        });
      }

      // 2. Login
      const response = await api.post('/api/auth/login/', {
        credential: staffId.trim(),
        password: staffPassword.trim(),
      });
      await processTokensAndStore(response.data, 'LECTURER');
    } catch (error: any) {
      console.error('Staff Auth error:', error);
      let message = 'Operation failed';

      if (error.response?.status === 401) {
        message = 'Wrong credentials. Please check your staff ID and password.';
      } else if (error.response?.data?.detail) {
        // Fallback for other standard API errors, but override default JWT message
        if (String(error.response.data.detail).includes('No active account')) {
          message = 'Wrong credentials. Please check your staff ID and password.';
        } else {
          message = error.response.data.detail;
        }
      } else if (typeof error.response?.data === 'string') {
        message = error.response.data;
      } else if (error.response?.data) {
        message = Object.entries(error.response.data)
          .map(([k, v]) => `${k}: ${v}`)
          .join('\n');
      }

      Alert.alert('Auth Failed', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Nexus</Text>
          <Text style={styles.subtitle}>University Timetable System</Text>
        </View>

        {/* Form Card */}
        <View style={styles.form}>
          {/* Custom Segmented Control */}
          <View style={styles.segmentContainer}>
            <TouchableOpacity
              style={[styles.segmentBtn, activeTab === 'admin' && styles.segmentBtnActive]}
              onPress={() => setActiveTab('admin')}
            >
              <Text style={[styles.segmentText, activeTab === 'admin' && styles.segmentTextActive]}>
                🛡️ Admin
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.segmentBtn, activeTab === 'staff' && styles.segmentBtnActive]}
              onPress={() => setActiveTab('staff')}
            >
              <Text style={[styles.segmentText, activeTab === 'staff' && styles.segmentTextActive]}>
                👨‍🏫 Staff
              </Text>
            </TouchableOpacity>
          </View>

          {activeTab === 'admin' ? (
            /* ── Admin Form ───────────────── */
            <>
              <Text style={styles.label}>Username</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter admin username"
                value={adminUsername}
                onChangeText={setAdminUsername}
                editable={!loading}
                autoCapitalize="none"
              />

              <Text style={[styles.label, { marginTop: 16 }]}>Password</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter password"
                value={adminPassword}
                onChangeText={setAdminPassword}
                secureTextEntry
                editable={!loading}
              />

              <TouchableOpacity
                style={[styles.button, { backgroundColor: '#0EA5E9' }, loading && styles.buttonDisabled]}
                onPress={handleAdminLogin}
                disabled={loading}
              >
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Admin Login</Text>}
              </TouchableOpacity>
            </>
          ) : (
            /* ── Staff Form ───────────────── */
            <>
              {staffMode === 'signup' && (
                <>
                  <Text style={styles.label}>Full Name</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. Dr. John Smith"
                    value={staffFullName}
                    onChangeText={setStaffFullName}
                    editable={!loading}
                  />
                  <View style={{ height: 16 }} />
                </>
              )}

              <Text style={styles.label}>Staff ID</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. STF001"
                value={staffId}
                onChangeText={setStaffId}
                editable={!loading}
                autoCapitalize="characters"
              />

              <Text style={[styles.label, { marginTop: 16 }]}>Password</Text>
              <TextInput
                style={styles.input}
                placeholder={staffMode === 'signup' ? 'Create a password' : 'Enter password'}
                value={staffPassword}
                onChangeText={setStaffPassword}
                secureTextEntry
                editable={!loading}
              />

              <TouchableOpacity
                style={[styles.button, { backgroundColor: '#10B981' }, loading && styles.buttonDisabled]}
                onPress={handleStaffLogin}
                disabled={loading}
              >
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{staffMode === 'signup' ? 'Sign Up & Login' : 'Staff Login'}</Text>}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.toggleButton}
                onPress={() => setStaffMode(staffMode === 'login' ? 'signup' : 'login')}
                disabled={loading}
              >
                <Text style={styles.toggleText}>
                  {staffMode === 'login' ? 'New staff? Sign Up' : 'Already registered? Login'}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Demo Box */}
        <View style={styles.demoBox}>
          <Text style={styles.demoTitle}>ℹ️ Access Info</Text>
          <Text style={styles.demoText}>
            Admins log in with username 'demo' and password 'demo123'. Staff members use their specific Staff ID.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  content: {
    flex: 1,
    padding: 16,
    justifyContent: 'center',
    paddingTop: 60,
  },
  header: {
    marginBottom: 32,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#0EA5E9',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  form: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  segmentContainer: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 4,
    marginBottom: 24,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  segmentBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  segmentTextActive: {
    color: '#0F172A',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: '#1E293B',
    backgroundColor: '#F8FAFC',
  },
  button: {
    borderRadius: 10,
    paddingVertical: 14,
    marginTop: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  toggleButton: {
    marginTop: 16,
    paddingVertical: 12,
  },
  toggleText: {
    color: '#0EA5E9',
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '500',
  },
  demoBox: {
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#3B82F6',
  },
  demoTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E3A8A',
    marginBottom: 4,
  },
  demoText: {
    fontSize: 13,
    color: '#1E40AF',
    lineHeight: 20,
  },
});

export default LoginScreen;
