import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  SafeAreaView, ActivityIndicator, TextInput, Alert, Platform,
  KeyboardAvoidingView, Modal,
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

  // Edit state
  const [editingOfficer, setEditingOfficer] = useState<OfficerResponse | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [toggling, setToggling] = useState<number | null>(null);

  useEffect(() => { loadOfficers(); }, []);

  const loadOfficers = async () => {
    try {
      setLoading(true);
      const res = await officersApi.list();
      setOfficers(res.data as OfficerResponse[]);
    } catch (err) {
      console.error('Failed to load officers:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!fullName.trim() || !email.trim()) { setError('Full name and email are required.'); return; }
    setError(null);
    setSubmitting(true);
    try {
      const res = await officersApi.register({ full_name: fullName.trim(), email: email.trim(), department: department.trim() || undefined });
      setResult(res.data as RegisterOfficerResult);
      setFullName(''); setEmail(''); setDepartment('');
      setShowForm(false);
      loadOfficers();
    } catch (err: any) {
      setError(err.response?.data?.email?.[0] || err.response?.data?.detail || 'Registration failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const openEdit = (officer: OfficerResponse) => {
    setEditingOfficer(officer);
    setEditName(officer.full_name);
    setEditEmail(officer.email);
    setEditError(null);
  };

  const handleEditSave = async () => {
    if (!editingOfficer) return;
    setEditSubmitting(true);
    setEditError(null);
    try {
      await officersApi.update(editingOfficer.id, { full_name: editName.trim(), email: editEmail.trim() });
      setEditingOfficer(null);
      loadOfficers();
    } catch (err: any) {
      setEditError(err.response?.data?.error || 'Update failed.');
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleToggleActive = async (officer: OfficerResponse) => {
    const action = officer.is_active ? 'Deactivate' : 'Activate';
    const confirmMsg = `${action} ${officer.full_name}'s account?`;
    const doToggle = async () => {
      setToggling(officer.id);
      try {
        await officersApi.toggleActive(officer.id);
        loadOfficers();
      } catch {
        /* silent */
      } finally {
        setToggling(null);
      }
    };
    if (Platform.OS === 'web') {
      if (window.confirm(confirmMsg)) doToggle();
    } else {
      Alert.alert(action, confirmMsg, [
        { text: 'Cancel', style: 'cancel' },
        { text: action, style: officer.is_active ? 'destructive' : 'default', onPress: doToggle },
      ]);
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
                <Text style={styles.successTitle}>Officer registered! Credentials sent by email (if SMTP configured).</Text>
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
                  <TextInput style={styles.input} placeholder="e.g. Dr. Jane Smith" placeholderTextColor="#94a3b8" value={fullName} onChangeText={setFullName} />
                </View>
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>EMAIL ADDRESS *</Text>
                <View style={styles.inputRow}>
                  <Feather name="mail" size={16} color="#94a3b8" style={styles.inputIcon} />
                  <TextInput style={styles.input} placeholder="e.g. jane@university.edu" placeholderTextColor="#94a3b8" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
                </View>
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>DEPARTMENT (optional)</Text>
                <View style={styles.inputRow}>
                  <Feather name="briefcase" size={16} color="#94a3b8" style={styles.inputIcon} />
                  <TextInput style={styles.input} placeholder="e.g. Computer Science" placeholderTextColor="#94a3b8" value={department} onChangeText={setDepartment} />
                </View>
              </View>
              <Text style={styles.formNote}>A secure password will be auto-generated and emailed to the officer.</Text>
              <TouchableOpacity style={[styles.submitBtn, submitting && { opacity: 0.6 }]} onPress={handleRegister} disabled={submitting}>
                {submitting ? <ActivityIndicator color="#fff" size="small" style={{ marginRight: 8 }} /> : <Feather name="user-plus" size={16} color="#fff" style={{ marginRight: 8 }} />}
                <Text style={styles.submitBtnText}>{submitting ? 'Registering...' : 'Register Officer'}</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Officers List */}
          <View style={styles.listCard}>
            <Text style={styles.listCardTitle}>Registered Officers ({officers.length})</Text>
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
                  <View style={[styles.avatarCircle, !officer.is_active && { backgroundColor: '#94a3b8' }]}>
                    <Text style={styles.avatarText}>{getInitials(officer.full_name)}</Text>
                  </View>
                  <View style={styles.officerInfo}>
                    <Text style={styles.officerName}>{officer.full_name}</Text>
                    <Text style={styles.officerEmail}>{officer.email}</Text>
                  </View>
                  <View style={styles.officerMeta}>
                    <View style={[styles.statusBadge, !officer.is_active && styles.statusBadgeInactive]}>
                      <Text style={[styles.statusBadgeText, !officer.is_active && styles.statusBadgeTextInactive]}>
                        {officer.is_active ? 'Active' : 'Inactive'}
                      </Text>
                    </View>
                    <Text style={styles.officerDate}>{formatDate(officer.date_joined)}</Text>
                  </View>
                  {/* Action Buttons */}
                  <View style={styles.actionBtns}>
                    <TouchableOpacity style={styles.iconBtn} onPress={() => openEdit(officer)}>
                      <Feather name="edit-2" size={15} color="#64748b" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.iconBtn, toggling === officer.id && { opacity: 0.4 }]}
                      onPress={() => handleToggleActive(officer)}
                      disabled={toggling === officer.id}
                    >
                      <Feather
                        name={officer.is_active ? 'power' : 'power'}
                        size={15}
                        color={officer.is_active ? '#ef4444' : '#10b981'}
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>

        {/* Edit Modal */}
        <Modal visible={!!editingOfficer} transparent animationType="fade" onRequestClose={() => setEditingOfficer(null)}>
          <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Edit Officer</Text>
                <TouchableOpacity onPress={() => setEditingOfficer(null)}>
                  <Feather name="x" size={20} color="#64748b" />
                </TouchableOpacity>
              </View>

              {editError && (
                <View style={styles.errorBanner}>
                  <Feather name="alert-circle" size={14} color="#ef4444" />
                  <Text style={[styles.errorText, { fontSize: 12 }]}>{editError}</Text>
                </View>
              )}

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>FULL NAME</Text>
                <View style={styles.inputRow}>
                  <Feather name="user" size={16} color="#94a3b8" style={styles.inputIcon} />
                  <TextInput style={styles.input} value={editName} onChangeText={setEditName} placeholderTextColor="#94a3b8" />
                </View>
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>EMAIL ADDRESS</Text>
                <View style={styles.inputRow}>
                  <Feather name="mail" size={16} color="#94a3b8" style={styles.inputIcon} />
                  <TextInput style={styles.input} value={editEmail} onChangeText={setEditEmail} keyboardType="email-address" autoCapitalize="none" placeholderTextColor="#94a3b8" />
                </View>
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.cancelActionBtn} onPress={() => setEditingOfficer(null)}>
                  <Text style={styles.cancelActionText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.saveBtn, editSubmitting && { opacity: 0.6 }]} onPress={handleEditSave} disabled={editSubmitting}>
                  {editSubmitting && <ActivityIndicator color="#fff" size="small" style={{ marginRight: 6 }} />}
                  <Text style={styles.saveBtnText}>Save Changes</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { flex: 1, paddingHorizontal: 20, paddingTop: 30 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  pageTitle: { fontSize: 22, fontWeight: '800', color: '#0f172a', letterSpacing: -0.5 },
  pageSubtitle: { fontSize: 12, color: '#64748b', marginTop: 2 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#0ea5e9', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 },
  cancelBtn: { backgroundColor: '#64748b' },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  errorBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fef2f2', borderColor: '#fca5a5', borderWidth: 1, borderRadius: 10, padding: 10, marginBottom: 14 },
  errorText: { color: '#ef4444', fontSize: 13, flex: 1 },
  successCard: { backgroundColor: '#f0fdf4', borderColor: '#86efac', borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 18 },
  successHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  successTitle: { color: '#166534', fontWeight: '700', fontSize: 12, flex: 1 },
  credRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  credLabel: { color: '#64748b', fontSize: 12 },
  credValue: { color: '#0f172a', fontSize: 12 },
  credNote: { color: '#94a3b8', fontSize: 11, marginTop: 6 },
  formCard: { backgroundColor: '#f8fafc', borderColor: '#e2e8f0', borderWidth: 1, borderRadius: 16, padding: 18, marginBottom: 18 },
  formTitle: { fontSize: 15, fontWeight: '700', color: '#0f172a', marginBottom: 14 },
  inputGroup: { marginBottom: 12 },
  inputLabel: { fontSize: 9, fontWeight: '800', color: '#94a3b8', letterSpacing: 1, marginBottom: 5 },
  inputRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, backgroundColor: '#fff', paddingHorizontal: 10 },
  inputIcon: { marginRight: 6 },
  input: { flex: 1, paddingVertical: 11, fontSize: 14, color: '#0f172a' },
  formNote: { color: '#94a3b8', fontSize: 11, marginBottom: 12 },
  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0ea5e9', borderRadius: 10, paddingVertical: 13 },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  listCard: { borderWidth: 1, borderColor: '#f1f5f9', borderRadius: 16, overflow: 'hidden', marginBottom: 20 },
  listCardTitle: { fontSize: 12, fontWeight: '700', color: '#475569', padding: 12, backgroundColor: '#f8fafc', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  emptyState: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  emptyStateText: { color: '#94a3b8', fontSize: 14 },
  officerRow: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: '#f8fafc', gap: 10 },
  avatarCircle: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#0ea5e9', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  officerInfo: { flex: 1, minWidth: 0 },
  officerName: { fontSize: 13, fontWeight: '700', color: '#0f172a' },
  officerEmail: { fontSize: 11, color: '#64748b', marginTop: 1 },
  officerMeta: { alignItems: 'flex-end' },
  statusBadge: { backgroundColor: '#e0f2fe', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  statusBadgeInactive: { backgroundColor: '#f1f5f9' },
  statusBadgeText: { fontSize: 10, fontWeight: '800', color: '#0ea5e9' },
  statusBadgeTextInactive: { color: '#94a3b8' },
  officerDate: { fontSize: 10, color: '#94a3b8', marginTop: 3 },
  actionBtns: { flexDirection: 'column', gap: 4, flexShrink: 0 },
  iconBtn: { padding: 6, borderRadius: 8, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#f1f5f9' },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#fff', borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 24, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 16 },
  cancelActionBtn: { flex: 1, paddingVertical: 13, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, alignItems: 'center' },
  cancelActionText: { color: '#64748b', fontWeight: '600' },
  saveBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0ea5e9', paddingVertical: 13, borderRadius: 12 },
  saveBtnText: { color: '#fff', fontWeight: '700' },
});
