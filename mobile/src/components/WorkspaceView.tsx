import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, ActivityIndicator, Alert, Platform, Modal, TextInput } from 'react-native';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../lib/api';
import TopHeader from './TopHeader';

export default function WorkspaceView() {
    const [workspaces, setWorkspaces] = useState<any[]>([]);
    const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
    const [newWorkspaceName, setNewWorkspaceName] = useState('');
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        loadWorkspaces();
    }, []);

    const loadWorkspaces = async () => {
        setLoading(true);
        try {
            const res = await api.get('/api/workspaces/');
            const wsList = res.data.results || res.data || [];
            setWorkspaces(wsList);

            const cached = await AsyncStorage.getItem('gc_workspace');
            if (cached) {
                setActiveWorkspaceId(JSON.parse(cached).id);
            } else if (wsList.length > 0) {
                setActiveWorkspaceId(wsList[0].id);
                await AsyncStorage.setItem('gc_workspace', JSON.stringify({ id: wsList[0].id }));
            }
        } catch (err) {
            console.error('Error loading workspaces:', err);
        } finally {
            setLoading(false);
        }
    };

    const showAlert = (title: string, msg: string) => {
        if (Platform.OS === 'web') {
            window.alert(`${title}\n\n${msg}`);
        } else {
            Alert.alert(title, msg);
        }
    };

    const selectWorkspace = async (ws: any) => {
        try {
            await AsyncStorage.setItem('gc_workspace', JSON.stringify({ id: ws.id }));
            setActiveWorkspaceId(ws.id);
            showAlert('Workspace Changed', `Active workspace is now "${ws.name}". Refresh the dashboard to see changes.`);
        } catch (err) {
            console.error('Error setting workspace:', err);
        }
    };

    const handleCreateWorkspace = async () => {
        if (!newWorkspaceName.trim()) {
            showAlert('Error', 'Please enter a name for the new workspace.');
            return;
        }
        setCreating(true);
        try {
            const res = await api.post('/api/workspaces/', { name: newWorkspaceName.trim() });
            const newWs = res.data;

            setIsCreateModalVisible(false);
            setNewWorkspaceName('');

            // Refresh list
            const updatedRes = await api.get('/api/workspaces/');
            const updatedWsList = updatedRes.data.results || updatedRes.data || [];
            setWorkspaces(updatedWsList);

            // Auto-select the newly created workspace
            await AsyncStorage.setItem('gc_workspace', JSON.stringify({ id: newWs.id }));
            setActiveWorkspaceId(newWs.id);
            showAlert('Workspace Created', `Successfully created and switched to "${newWs.name}".`);
        } catch (err: any) {
            console.error('Error creating workspace:', err);
            showAlert('Error', err.response?.data?.error || 'Failed to create workspace.');
        } finally {
            setCreating(false);
        }
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <TopHeader />
                <View style={styles.centerLoading}>
                    <ActivityIndicator size="large" color="#1d4ed8" />
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <TopHeader />
            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                <View style={styles.topSectionRow}>
                    <View>
                        <Text style={styles.pageTitle}>Workspace Settings</Text>
                        <Text style={styles.pageSubtitle}>Manage your scheduling environments.</Text>
                    </View>
                    <TouchableOpacity style={styles.createBtn} onPress={() => setIsCreateModalVisible(true)}>
                        <Feather name="plus" size={16} color="#fff" />
                        <Text style={styles.createBtnText}>New</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.card}>
                    {workspaces.length === 0 ? (
                        <View style={styles.emptyContainer}>
                            <Feather name="layers" size={48} color="#e2e8f0" />
                            <Text style={styles.emptyText}>No Workspaces Found</Text>
                            <Text style={styles.emptySubtext}>Please create a workspace in the web setup first.</Text>
                        </View>
                    ) : (
                        workspaces.map((ws) => {
                            const isActive = ws.id === activeWorkspaceId;
                            return (
                                <TouchableOpacity
                                    key={ws.id}
                                    style={[styles.wsRow, isActive && styles.wsRowActive]}
                                    onPress={() => selectWorkspace(ws)}
                                >
                                    <View style={styles.wsInfo}>
                                        <View style={styles.wsIconBox}>
                                            <Feather name="folder" size={20} color={isActive ? "#0ea5e9" : "#64748b"} />
                                        </View>
                                        <View>
                                            <Text style={[styles.wsName, isActive && styles.wsNameActive]}>{ws.name}</Text>
                                            <Text style={styles.wsDetails}>
                                                {ws.courses_count || 0} Courses • {ws.rooms_count || 0} Rooms • {ws.lecturers_count || 0} Lecturers
                                            </Text>
                                        </View>
                                    </View>

                                    {isActive ? (
                                        <View style={styles.activeBadge}>
                                            <Text style={styles.activeBadgeText}>ACTIVE</Text>
                                        </View>
                                    ) : (
                                        <Feather name="chevron-right" size={20} color="#cbd5e1" />
                                    )}
                                </TouchableOpacity>
                            );
                        })
                    )}
                </View>
            </ScrollView>

            <Modal visible={isCreateModalVisible} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Create Workspace</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="e.g. Spring 2026"
                            value={newWorkspaceName}
                            onChangeText={setNewWorkspaceName}
                            autoFocus
                        />
                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsCreateModalVisible(false)}>
                                <Text style={styles.cancelBtnText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.saveBtn} onPress={handleCreateWorkspace} disabled={creating}>
                                {creating ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveBtnText}>Create</Text>}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    centerLoading: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center'
    },
    content: {
        flex: 1,
        paddingHorizontal: 20,
        paddingTop: 20,
    },
    topSectionRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 30,
    },
    createBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#0ea5e9',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 8,
        gap: 6,
    },
    createBtnText: {
        color: '#fff',
        fontWeight: '600',
    },
    pageTitle: {
        fontSize: 28,
        fontWeight: '800',
        color: '#0f172a',
        letterSpacing: -0.5,
    },
    pageSubtitle: {
        fontSize: 15,
        color: '#64748b',
        marginTop: 4,
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        overflow: 'hidden',
    },
    wsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    wsRowActive: {
        backgroundColor: '#f0f9ff',
    },
    wsInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    wsIconBox: {
        width: 48,
        height: 48,
        borderRadius: 12,
        backgroundColor: '#f1f5f9',
        justifyContent: 'center',
        alignItems: 'center',
    },
    wsName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#334155',
    },
    wsNameActive: {
        color: '#0ea5e9',
        fontWeight: '700',
    },
    wsDetails: {
        fontSize: 13,
        color: '#94a3b8',
        marginTop: 4,
    },
    activeBadge: {
        backgroundColor: '#0ea5e9',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 20,
    },
    activeBadgeText: {
        color: '#fff',
        fontSize: 11,
        fontWeight: '800',
    },
    emptyContainer: {
        padding: 60,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#475569',
        marginTop: 16,
    },
    emptySubtext: {
        fontSize: 14,
        color: '#94a3b8',
        marginTop: 8,
        textAlign: 'center',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContent: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 24,
        width: '100%',
        maxWidth: 400,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#0f172a',
        marginBottom: 16,
    },
    input: {
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        color: '#334155',
        marginBottom: 24,
    },
    modalActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 12,
    },
    cancelBtn: {
        paddingVertical: 10,
        paddingHorizontal: 16,
    },
    cancelBtnText: {
        color: '#64748b',
        fontWeight: '600',
        fontSize: 15,
    },
    saveBtn: {
        backgroundColor: '#0ea5e9',
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 8,
    },
    saveBtnText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 15,
    }
});
