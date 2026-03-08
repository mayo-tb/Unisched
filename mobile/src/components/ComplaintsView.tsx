import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ActivityIndicator,
    TouchableOpacity,
    ScrollView,
    TextInput,
    Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { complaintsApi, ComplaintResponse } from '../lib/api';

export const ComplaintsView: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [complaints, setComplaints] = useState<ComplaintResponse[]>([]);
    const [userRole, setUserRole] = useState<'ADMIN' | 'LECTURER'>('LECTURER');

    // Form
    const [showForm, setShowForm] = useState(false);
    const [subject, setSubject] = useState('');
    const [description, setDescription] = useState('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        loadInitData();
    }, []);

    const loadInitData = async () => {
        setLoading(true);
        try {
            const userData = await AsyncStorage.getItem('gc_user');
            if (userData) {
                const { role } = JSON.parse(userData);
                setUserRole(role);
            }
            await fetchComplaints();
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const fetchComplaints = async () => {
        try {
            const response = await complaintsApi.list();
            // The backend returns an object { complaints: [...] } or just an array [...] depending on the endpoint.
            // Defensive approach:
            const data = response.data;
            if (data.complaints && Array.isArray(data.complaints)) {
                setComplaints(data.complaints);
            } else if (Array.isArray(data)) {
                setComplaints(data);
            } else {
                setComplaints([]);
            }
        } catch (err: any) {
            Alert.alert('Error', err.response?.data?.error || 'Failed to load complaints.');
        }
    };

    const handleSubmit = async () => {
        if (!subject.trim() || !description.trim()) {
            Alert.alert('Missing Fields', 'Please fill out both subject and description.');
            return;
        }

        setSubmitting(true);
        try {
            await complaintsApi.create({ subject, description });
            Alert.alert('Success', 'Complaint submitted successfully.');
            setSubject('');
            setDescription('');
            setShowForm(false);
            await fetchComplaints();
        } catch (err: any) {
            Alert.alert('Error', err.response?.data?.detail || 'Failed to submit complaint.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleResolve = async (id: number) => {
        try {
            await complaintsApi.update(id, { status: 'RESOLVED' });
            await fetchComplaints();
        } catch (err) {
            Alert.alert('Error', 'Failed to resolve the complaint.');
        }
    };

    if (loading) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color="#F59E0B" />
                <Text style={styles.loadingText}>Loading complaints...</Text>
            </View>
        );
    }

    const isAdmin = userRole === 'ADMIN';

    return (
        <View style={styles.container}>
            <View style={styles.headerPanel}>
                <View style={{ flex: 1 }}>
                    <Text style={styles.headerTitle}>{isAdmin ? 'All Complaints' : 'My Complaints'}</Text>
                    <Text style={styles.headerSubtitle}>
                        {isAdmin ? 'Review and resolve staff issues' : 'Submit scheduling feedback'}
                    </Text>
                </View>
                {!isAdmin && (
                    <TouchableOpacity
                        style={styles.newBtn}
                        onPress={() => setShowForm(!showForm)}
                    >
                        <Text style={styles.newBtnText}>{showForm ? 'Cancel' : '+ New'}</Text>
                    </TouchableOpacity>
                )}
            </View>

            <ScrollView style={styles.content}>
                {showForm && (
                    <View style={styles.formCard}>
                        <Text style={styles.formTitle}>New Complaint</Text>

                        <Text style={styles.label}>Subject</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="e.g. Room conflict"
                            value={subject}
                            onChangeText={setSubject}
                        />

                        <Text style={[styles.label, { marginTop: 16 }]}>Description</Text>
                        <TextInput
                            style={[styles.input, { height: 100, textAlignVertical: 'top' }]}
                            placeholder="Detail the issue..."
                            value={description}
                            onChangeText={setDescription}
                            multiline
                        />

                        <TouchableOpacity
                            style={[styles.submitBtn, submitting && { opacity: 0.7 }]}
                            onPress={handleSubmit}
                            disabled={submitting}
                        >
                            {submitting ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitBtnText}>Submit Complaint</Text>}
                        </TouchableOpacity>
                    </View>
                )}

                {complaints.length === 0 ? (
                    <View style={styles.emptyBox}>
                        <Text style={styles.emptyText}>No complaints found.</Text>
                    </View>
                ) : (
                    complaints.map(c => (
                        <View key={c.id} style={styles.card}>
                            <View style={styles.cardHeader}>
                                <View style={[styles.badge, c.status === 'RESOLVED' ? styles.badgeSuccess : styles.badgeWarning]}>
                                    <Text style={[styles.badgeText, c.status === 'RESOLVED' ? styles.badgeTextSuccess : styles.badgeTextWarning]}>
                                        {c.status}
                                    </Text>
                                </View>
                                {isAdmin && c.lecturer_name && (
                                    <Text style={styles.lecturerName}>by {c.lecturer_name}</Text>
                                )}
                            </View>

                            <Text style={styles.subject}>{c.subject}</Text>
                            <Text style={styles.description}>{c.description}</Text>
                            <Text style={styles.date}>
                                {new Date(c.created_at).toLocaleDateString()}
                            </Text>

                            {isAdmin && c.status === 'OPEN' && (
                                <TouchableOpacity
                                    style={styles.resolveBtn}
                                    onPress={() => handleResolve(c.id)}
                                >
                                    <Text style={styles.resolveBtnText}>✓ Resolve</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    ))
                )}
                <View style={{ height: 40 }} />
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' },
    loadingText: { marginTop: 12, fontSize: 14, color: '#64748B' },
    headerPanel: { flexDirection: 'row', alignItems: 'center', padding: 20, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
    headerTitle: { fontSize: 24, fontWeight: '800', color: '#0F172A' },
    headerSubtitle: { fontSize: 13, color: '#64748B', marginTop: 4 },
    newBtn: { backgroundColor: '#F59E0B', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
    newBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 14 },
    content: { padding: 16 },
    formCard: { backgroundColor: '#FFF', borderRadius: 12, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: '#FDE68A' },
    formTitle: { fontSize: 18, fontWeight: 'bold', color: '#D97706', marginBottom: 16 },
    label: { fontSize: 13, fontWeight: '600', color: '#475569', marginBottom: 6 },
    input: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, padding: 12, backgroundColor: '#F8FAFC', fontSize: 15 },
    submitBtn: { backgroundColor: '#F59E0B', borderRadius: 8, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
    submitBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
    emptyBox: { padding: 40, alignItems: 'center' },
    emptyText: { color: '#94A3B8', fontSize: 16 },
    card: { backgroundColor: '#FFF', borderRadius: 12, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    badgeWarning: { backgroundColor: '#FEF3C7' },
    badgeSuccess: { backgroundColor: '#D1FAE5' },
    badgeText: { fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase' },
    badgeTextWarning: { color: '#D97706' },
    badgeTextSuccess: { color: '#059669' },
    lecturerName: { fontSize: 12, color: '#64748B', fontStyle: 'italic' },
    subject: { fontSize: 16, fontWeight: 'bold', color: '#1E293B', marginBottom: 6 },
    description: { fontSize: 14, color: '#475569', lineHeight: 20 },
    date: { fontSize: 12, color: '#94A3B8', marginTop: 12 },
    resolveBtn: { alignSelf: 'flex-start', marginTop: 12, backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#10B981', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
    resolveBtnText: { color: '#059669', fontWeight: 'bold', fontSize: 13 },
});

export default ComplaintsView;
