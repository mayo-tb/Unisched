/**
 * Genetics Cloud — Login Screen
 * User authentication with username/password
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

/**
 * LoginScreen — User authentication
 */
export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('demo');
  const [password, setPassword] = useState('demo123');
  const [loading, setLoading] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  const handleLogin = async () => {
    if (!username || !password) {
      Alert.alert('Missing Fields', 'Please enter username and password');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/api/auth/login/', {
        username: username.trim(),
        password: password.trim(),
      });

      const { access, refresh } = response.data;

      // Store tokens in AsyncStorage
      await AsyncStorage.setItem(
        'gc_tokens',
        JSON.stringify({ access, refresh })
      );

      // Update axios default header
      api.defaults.headers.common['Authorization'] = `Bearer ${access}`;

      Alert.alert('Success', 'Logged in successfully!');
      onLoginSuccess();
    } catch (error: any) {
      console.error('Login error:', error);
      const message =
        error.response?.data?.detail ||
        error.message ||
        'Login failed. Check your credentials.';
      Alert.alert('Login Failed', message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!username || !password || !email || !firstName || !lastName) {
      Alert.alert('Missing Fields', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      await api.post('/api/auth/register/', {
        username: username.trim(),
        password: password.trim(),
        email: email.trim(),
        first_name: firstName.trim(),
        last_name: lastName.trim(),
      });

      Alert.alert(
        'Success',
        'Registration successful! Now log in with your credentials.'
      );

      // Clear fields and switch back to login
      setUsername('');
      setPassword('');
      setEmail('');
      setFirstName('');
      setLastName('');
      setShowRegister(false);
    } catch (error: any) {
      console.error('Register error:', error);
      let message = 'Registration failed';
      if (error.response?.data) {
        if (typeof error.response.data === 'string') {
          message = error.response.data;
        } else {
          message = Object.entries(error.response.data)
            .map(([field, errors]) => `${field}: ${Array.isArray(errors) ? errors.join(', ') : errors}`)
            .join('\n');
        }
      } else if (error.message) {
        message = error.message;
      }
      Alert.alert('Registration Failed', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>UniSched</Text>
          <Text style={styles.subtitle}>University Timetable System</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          {/* Demo Hint */}
          {!showRegister && (
            <View style={{ backgroundColor: '#e8f5e9', padding: 12, borderRadius: 8, marginBottom: 16 }}>
              <Text style={{ color: '#2e7d32', fontSize: 12, fontWeight: '500' }}>
                💡 Try demo / demo123 to test the app!
              </Text>
            </View>
          )}

          {/* Username */}
          <Text style={styles.label}>Username</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your username"
            value={username}
            onChangeText={setUsername}
            editable={!loading}
            autoCapitalize="none"
          />

          {/* Password */}
          <Text style={[styles.label, { marginTop: 16 }]}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            editable={!loading}
          />

          {/* Email (only if registering) */}
          {showRegister && (
            <>
              <Text style={[styles.label, { marginTop: 16 }]}>Email</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your email"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                editable={!loading}
                autoCapitalize="none"
              />

              <Text style={[styles.label, { marginTop: 16 }]}>First Name</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your first name"
                value={firstName}
                onChangeText={setFirstName}
                editable={!loading}
              />

              <Text style={[styles.label, { marginTop: 16 }]}>Last Name</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your last name"
                value={lastName}
                onChangeText={setLastName}
                editable={!loading}
              />
            </>
          )}

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={showRegister ? handleRegister : handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>
                {showRegister ? 'Register' : 'Login'}
              </Text>
            )}
          </TouchableOpacity>

          {/* Toggle Register */}
          <TouchableOpacity
            style={styles.toggleButton}
            onPress={() => {
              setShowRegister(!showRegister);
              setUsername('');
              setPassword('');
              setEmail('');
              setFirstName('');
              setLastName('');
            }}
            disabled={loading}
          >
            <Text style={styles.toggleText}>
              {showRegister
                ? 'Already have an account? Login'
                : "Don't have an account? Register"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Demo Info */}
        <View style={styles.demoBox}>
          <Text style={styles.demoTitle}>🧪 Demo Credentials</Text>
          <Text style={styles.demoText}>
            To test the app:
          </Text>
          <Text style={styles.demoCode}>
            Username: testuser{'\n'}
            Password: secure123
          </Text>
          <Text style={[styles.demoText, { marginTop: 12, fontSize: 12, color: '#666' }]}>
            Or register a new account
          </Text>
        </View>
      </View>
    </ScrollView>
  );
};

// ═════════════════════════════════════════════════════════════
// STYLES
// ═════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  content: {
    flex: 1,
    padding: 16,
    justifyContent: 'center',
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
    borderRadius: 12,
    padding: 24,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
    backgroundColor: '#F9FAFB',
  },
  button: {
    backgroundColor: '#0EA5E9',
    borderRadius: 8,
    paddingVertical: 12,
    marginTop: 24,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  toggleButton: {
    marginTop: 16,
    paddingVertical: 8,
  },
  toggleText: {
    color: '#0EA5E9',
    fontSize: 14,
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
  demoBox: {
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
  },
  demoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400E',
    marginBottom: 8,
  },
  demoText: {
    fontSize: 13,
    color: '#78350F',
    lineHeight: 18,
  },
  demoCode: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#78350F',
    backgroundColor: '#FEFCE8',
    padding: 8,
    borderRadius: 4,
    marginTop: 8,
    lineHeight: 18,
  },
});

export default LoginScreen;
