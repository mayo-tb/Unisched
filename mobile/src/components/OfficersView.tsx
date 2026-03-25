import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  SafeAreaView, ActivityIndicator, TextInput, Alert, Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import TopHeader from './TopHeader';
import { officersApi, type OfficerResponse, type RegisterOfficerResult } from '../lib/api';

export default function OfficersView() {
  const [officers, setOfficers] = useState<OfficerResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [department, setDepartment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<RegisterOfficerResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadOfficers();
  }, []);

  const loadOfficers = async () => {
    try {
      setLoading(true);
      const res = await officersApi.list();
      setOfficers(res.data as OfficerResponse[]);
    } catch (err: any) {
      console.error('Failed to load officers:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!fullName.trim() || !email.trim()) {
      setError('Full name and email are required.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await officersApi.register({
        full_name: fullName.trim(),
        email: email.trim(),
        department: department.trim() || undefined,
      });
      setResult(res.data as RegisterOfficerResult);
      setFullName(''); setEmail(''); setDepartment('');
      setShowForm(false);
      loadOfficers();
    } catch (err: any) {
      const msg = err.response?.data?.email?.[0] || err.response?.data?.detail || 'Registration failed.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const getInitials = (name: string) =>
    name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  const formatDate = (ds: string) =>
    new Date(ds).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

  return (
    <SafeAreaView style={styles.container}>
      <TopHeader />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          {/* Header Row */}
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.pageTitle}>Timetable Officers</Text>
              <Text style={styles.pageSubtitle}>Register and manage officer accounts.</Text>
            </View>
            <TouchableOpacity
              style={[styles.addBtn, showForm && styles.cancelBtn]}
              onPress={() => { setShowForm(!showForm); setResult(null); setError(null); }}
            >
              <Feather name={showForm ? 'x' : 'plus'} size={18} color="#fff" />
              <Text style={styles.addBtnText}>{showForm ? 'Cancel' : 'Register'}</Text>
            </TouchableOpacity>
          </View>

          {/* Error Banner */}
          {error && (
            <View style={styles.errorBanner}>
              <Feather name="alert-circle" size={16} color="#ef4444" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Success: Generated Credentials */}
          {result && (
            <View style={styles.successCard}>
              <View style={styles.successHeaderRow}>
                <Feather name="check-circle" size={18} color="#10b981" />
                <Text style={styles.successTitle}>Officer registered! Credentials sent by email.</Text>
              </View>
              <View style={styles.credRow}>
                <Text style={styles.credLabel}>Email / Username:</Text>
                <Text style={styles.credValue}>{result.email}</Text>
              </View>
              <View style={styles.credRow}>
                <Text style={styles.credLabel}>Generated Password:</Text>
                <Text style={[styles.credValue, { color: '#f59e0b', fontWeight: '800' }]}>{result.generated_password}</Text>
              </View>
              <Text style={styles.credNote}>⚠️ Save this password — it won't be shown again.</Text>
            </View>
          )}

          {/* Registration Form */}
          {showForm && (
            <View style={styles.formCard}>
              <Text style={styles.formTitle}>New Officer Details</Text>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>FULL NAME *</Text>
                <View style={styles.inputRow}>
                  <Feather name="user" size={16} color="#94a3b8" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. Dr. Jane Smith"
                    placeholderTextColor="#94a3b8"
                    value={fullName}
                    onChangeText={setFullName}
                  />
                </View>
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>EMAIL ADDRESS *</Text>
                <View style={styles.inputRow}>
                  <Feather name="mail" size={16} color="#94a3b8" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. jane@university.edu"
                    placeholderTextColor="#94a3b8"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>DEPARTMENT (optional)</Text>
                <View style={styles.inputRow}>
                  <Feather name="briefcase" size={16} color="#94a3b8" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. Computer Science"
                    placeholderTextColor="#94a3b8"
                    value={department}
                    onChangeText={setDepartment}
                  />
                </View>
              </View>
              <Text style={styles.formNote}>A secure password will be auto-generated and emailed to the officer.</Text>
              <TouchableOpacity
                style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
                onPress={handleRegister}
                disabled={submitting}
              >
                {submitting
                  ? <ActivityIndicator color="#fff" size="small" style={{ marginRight: 8 }} />
                  : <Feather name="user-plus" size={16} color="#fff" style={{ marginRight: 8 }} />
                }
                <Text style={styles.submitBtnText}>{submitting ? 'Registering...' : 'Register Officer'}</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Officers List */}
          <View style={styles.listCard}>
            <Text style={styles.listCardTitle}>Registered Officers</Text>
            {loading ? (
              <ActivityIndicator size="large" color="#0ea5e9" style={{ marginVertical: 40 }} />
            ) : officers.length === 0 ? (
              <View style={styles.emptyState}>
                <Feather name="users" size={32} color="#e2e8f0" />
                <Text style={styles.emptyStateText}>No officers registered yet.</Text>
              </View>
            ) : (
              officers.map((officer) => (
                <View key={officer.id} style={styles.officerRow}>
                  <View style={styles.avatarCircle}>
                    <Text style={styles.avatarText}>{getInitials(officer.full_name)}</Text>
                  </View>
                  <View style={styles.officerInfo}>
                    <Text style={styles.officerName}>{officer.full_name}</Text>
                    <Text style={styles.officerEmail}>{officer.email}</Text>
                  </View>
                  <View style={styles.officerBadge}>
                    <Text style={styles.officerBadgeText}>Officer</Text>
                    <Text style={styles.officerDate}>{formatDate(officer.date_joined)}</Text>
                  </View>
                </View>
              ))
            )}
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { flex: 1, paddingHorizontal: 20, paddingTop: 30 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  pageTitle: { fontSize: 24, fontWeight: '800', color: '#0f172a', letterSpacing: -0.5 },
  pageSubtitle: { fontSize: 13, color: '#64748b', marginTop: 2 },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#0ea5e9', paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: 10, shadowColor: '#0ea5e9', shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 }, shadowRadius: 8, elevation: 4,
  },
  cancelBtn: { backgroundColor: '#64748b', shadowColor: '#64748b' },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fef2f2', borderColor: '#fca5a5', borderWidth: 1,
    borderRadius: 10, padding: 12, marginBottom: 16,
  },
  errorText: { color: '#ef4444', fontSize: 13, flex: 1 },
  successCard: {
    backgroundColor: '#f0fdf4', borderColor: '#86efac', borderWidth: 1,
    borderRadius: 14, padding: 16, marginBottom: 20,
  },
  successHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  successTitle: { color: '#166534', fontWeight: '700', fontSize: 13, flex: 1 },
  credRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  credLabel: { color: '#64748b', fontSize: 13 },
  credValue: { color: '#0f172a', fontSize: 13 },
  credNote: { color: '#94a3b8', fontSize: 11, marginTop: 8 },
  formCard: {
    backgroundColor: '#f8fafc', borderColor: '#e2e8f0', borderWidth: 1,
    borderRadius: 16, padding: 20, marginBottom: 20,
  },
  formTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a', marginBottom: 16 },
  inputGroup: { marginBottom: 14 },
  inputLabel: { fontSize: 10, fontWeight: '800', color: '#94a3b8', letterSpacing: 1, marginBottom: 6 },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10,
    backgroundColor: '#fff', paddingHorizontal: 12,
  },
  inputIcon: { marginRight: 8 },
  input: { flex: 1, paddingVertical: 12, fontSize: 14, color: '#0f172a' },
  formNote: { color: '#94a3b8', fontSize: 11, marginBottom: 14 },
  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#0ea5e9', borderRadius: 10, paddingVertical: 14,
  },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  listCard: {
    borderWidth: 1, borderColor: '#f1f5f9', borderRadius: 16, overflow: 'hidden', marginBottom: 20,
  },
  listCardTitle: {
    fontSize: 13, fontWeight: '700', color: '#475569',
    padding: 14, backgroundColor: '#f8fafc', borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
  },
  emptyState: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  emptyStateText: { color: '#94a3b8', fontSize: 14 },
  officerRow: {
    flexDirection: 'row', alignItems: 'center', padding: 14,
    borderBottomWidth: 1, borderBottomColor: '#f8fafc', gap: 12,
  },
  avatarCircle: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#0ea5e9', alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  officerInfo: { flex: 1 },
  officerName: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
  officerEmail: { fontSize: 12, color: '#64748b', marginTop: 1 },
  officerBadge: { alignItems: 'flex-end' },
  officerBadgeText: {
    fontSize: 10, fontWeight: '800', color: '#0ea5e9',
    backgroundColor: '#e0f2fe', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2,
  },
  officerDate: { fontSize: 10, color: '#94a3b8', marginTop: 4 },
});
