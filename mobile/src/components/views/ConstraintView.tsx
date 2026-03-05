import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Switch, Platform, Modal, TextInput } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../../lib/api';

interface Constraint {
    id: string | number;
    name: string;
    logic_type: string;
    type: string;
    weight: number;
    enabled: boolean;
}

export default function ConstraintView() {
    const [loading, setLoading] = useState(true);
    const [constraints, setConstraints] = useState<Constraint[]>([]);
    const [modalVisible, setModalVisible] = useState(false);

    // Modal state
    const [newName, setNewName] = useState('');
    const [newLogic, setNewLogic] = useState('room_conflict');
    const [newType, setNewType] = useState('hard');
    const [newWeight, setNewWeight] = useState('1000');
    const [saving, setSaving] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    useEffect(() => {
        fetchConstraints();
    }, []);

    const fetchConstraints = async () => {
        setLoading(true);
        try {
            const res = await api.get('/api/resources/constraints/');
            // Handle paginated or list response
            const data = Array.isArray(res.data) ? res.data : (res.data.results || []);
            setConstraints(data);
        } catch (error) {
            console.error('Failed to fetch constraints:', error);
            showAlert('Error', 'Could not load constraints.');
        } finally {
            setLoading(false);
        }
    };

    const toggleSwitch = async (id: string | number, currentEnabled: boolean) => {
        // Optimistic UI update
        setConstraints(prev => prev.map(c =>
            c.id === id ? { ...c, enabled: !currentEnabled } : c
        ));

        try {
            await api.patch(`/api/resources/constraints/${id}/`, {
                enabled: !currentEnabled
            });
        } catch (error) {
            console.error('Failed to update constraint:', error);
            // Revert on failure
            setConstraints(prev => prev.map(c =>
                c.id === id ? { ...c, enabled: currentEnabled } : c
            ));
            showAlert('Error', 'Failed to update constraint status.');
        }
    };

    const showAlert = (title: string, msg: string) => {
        if (Platform.OS === 'web') {
            window.alert(`${title}\n\n${msg}`);
        } else {
            const { Alert } = require('react-native');
            Alert.alert(title, msg);
        }
    };

    const getDescription = (logic_type: string) => {
        switch (logic_type) {
            case 'lecturer_conflict': return '"Prevent lecturers from being in two places at once."';
            case 'room_conflict': return '"Prevent two classes in the same room at the same time."';
            case 'group_conflict': return '"Prevent groups from having two classes scheduled at once."';
            case 'capacity_overflow': return '"Ensure number of members fits inside the facility."';
            default: return '"Rule to guide scheduling accuracy."';
        }
    };

    const handleAddConstraint = async () => {
        if (!newName.trim()) {
            setErrorMsg('Constraint name is required');
            return;
        }

        const weightParsed = parseInt(newWeight, 10);
        if (isNaN(weightParsed) || weightParsed < 1) {
            setErrorMsg('Weight must be a positive integer');
            return;
        }

        setSaving(true);
        setErrorMsg('');

        try {
            // Get current workspace
            const wsDataStr = await AsyncStorage.getItem('gc_workspace');
            if (!wsDataStr) throw new Error('No active workspace selected.');
            const workspaceId = JSON.parse(wsDataStr).id;

            const payload = {
                name: newName.trim(),
                logic_type: newLogic,
                type: newType,
                weight: weightParsed,
                enabled: true,
                workspace: workspaceId
            };

            const response = await api.post('/api/resources/constraints/', payload);

            // Append newest constraint to existing array natively
            setConstraints(prev => [...prev, response.data]);

            setModalVisible(false);
            setNewName('');
            setNewLogic('room_conflict');
            setNewType('hard');
            setNewWeight('1000');
            showAlert('Success', 'Constraint added successfully!');
        } catch (error: any) {
            console.error('Failed to create constraint:', error);
            setErrorMsg(error.response?.data?.name?.[0] || 'Failed to create constraint.');
        } finally {
            setSaving(false);
        }
    };

    const renderItem = ({ item }: { item: Constraint }) => (
        <View style={styles.card}>
            <View style={styles.headerRow}>
                <View style={styles.titleInfo}>
                    <View style={[styles.iconWrapper, !item.enabled && { backgroundColor: '#e2e8f0' }]}>
                        <Feather name="zap" size={24} color={item.enabled ? "#fff" : "#94a3b8"} />
                    </View>
                    <View>
                        <Text style={styles.cardTitle}>{item.name}</Text>
                        <View style={styles.typeBadge}>
                            <Text style={styles.typeBadgeText}>{item.type.toUpperCase()}</Text>
                        </View>
                    </View>
                </View>
                <Switch
                    trackColor={{ false: "#e2e8f0", true: "#3b82f6" }}
                    thumbColor={"#fff"}
                    ios_backgroundColor="#e2e8f0"
                    onValueChange={() => toggleSwitch(item.id, item.enabled)}
                    value={item.enabled}
                />
            </View>

            <Text style={styles.description}>{getDescription(item.logic_type)}</Text>

            <View style={styles.footerRow}>
                <View style={styles.severityBadge}>
                    <Text style={styles.severityText}>SEVERITY</Text>
                    <Text style={styles.severityVal}>{item.weight}</Text>
                </View>
                <TouchableOpacity style={styles.editBtn}>
                    <Feather name="edit-2" size={16} color="#cbd5e1" />
                </TouchableOpacity>
            </View>
        </View>
    );

    return (
        <View style={styles.container}>
            <View style={styles.headerArea}>
                <Text style={styles.pageSubtitle}>Regulate engine behavior with soft and hard constraints</Text>
                <TouchableOpacity style={styles.addBtn} onPress={() => setModalVisible(true)}>
                    <Feather name="plus" size={16} color="#fff" />
                    <Text style={styles.addBtnText}>Add Custom Constraint</Text>
                </TouchableOpacity>
            </View>

            {loading ? (
                <ActivityIndicator style={{ marginTop: 40 }} color="#1a73e8" />
            ) : (
                <FlatList
                    data={constraints}
                    keyExtractor={item => item.id.toString()}
                    numColumns={2}
                    columnWrapperStyle={styles.row}
                    contentContainerStyle={{ paddingBottom: 20 }}
                    renderItem={renderItem}
                />
            )}

            <Modal
                visible={modalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>New Constraint</Text>

                        {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

                        <Text style={styles.label}>Constraint Name</Text>
                        <TextInput
                            style={styles.input}
                            value={newName}
                            onChangeText={setNewName}
                            placeholder="e.g. Teacher Morning Focus"
                        />

                        <Text style={styles.label}>Constraint Logic Engine</Text>
                        <View style={styles.pickerContainer}>
                            <Picker
                                selectedValue={newLogic}
                                onValueChange={(val) => setNewLogic(val)}
                                style={styles.picker}
                            >
                                <Picker.Item label="Room Double Booking" value="room_conflict" />
                                <Picker.Item label="Lecturer Double Booking" value="lecturer_conflict" />
                                <Picker.Item label="Group Double Booking" value="group_conflict" />
                                <Picker.Item label="Room Capacity Exceeded" value="capacity_overflow" />
                                <Picker.Item label="Lecturer Preferences" value="lecturer_preference" />
                            </Picker>
                        </View>

                        <Text style={styles.label}>Severity / Type</Text>
                        <View style={styles.pickerContainer}>
                            <Picker
                                selectedValue={newType}
                                onValueChange={(val) => setNewType(val)}
                                style={styles.picker}
                            >
                                <Picker.Item label="Hard (Invalidates Schedule)" value="hard" />
                                <Picker.Item label="Soft (Penalizes Fitness)" value="soft" />
                            </Picker>
                        </View>

                        <Text style={styles.label}>Penalty Weighting Engine Score</Text>
                        <TextInput
                            style={styles.input}
                            value={newWeight}
                            onChangeText={setNewWeight}
                            keyboardType="numeric"
                            placeholder="e.g. 1000"
                        />

                        <View style={styles.btnRow}>
                            <TouchableOpacity style={[styles.modalBtn, styles.cancelBtn]} onPress={() => setModalVisible(false)} disabled={saving}>
                                <Text style={styles.cancelBtnText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.modalBtn, styles.saveBtn]} onPress={handleAddConstraint} disabled={saving}>
                                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Constraint</Text>}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        marginTop: 10,
    },
    row: {
        gap: 30,
        marginBottom: 30,
    },
    card: {
        flex: 1,
        backgroundColor: '#fff',
        borderRadius: 24,
        padding: 30,
        minWidth: '45%',
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowRadius: 20,
        elevation: 2,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 30,
    },
    titleInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    iconWrapper: {
        width: 56,
        height: 56,
        borderRadius: 16,
        backgroundColor: '#e11d48',
        justifyContent: 'center',
        alignItems: 'center',
    },
    cardTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: '#0f172a',
        marginBottom: 4,
    },
    typeBadge: {
        borderWidth: 1,
        borderColor: '#fce7f3',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
        alignSelf: 'flex-start',
    },
    typeBadgeText: {
        color: '#e11d48',
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    description: {
        fontSize: 15,
        color: '#475569',
        lineHeight: 24,
        marginBottom: 30,
    },
    footerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
        paddingTop: 20,
    },
    severityBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        gap: 8,
    },
    severityText: {
        fontSize: 10,
        fontWeight: '800',
        color: '#94a3b8',
        letterSpacing: 0.5,
    },
    severityVal: {
        fontSize: 12,
        fontWeight: '800',
        color: '#0f172a',
    },
    editBtn: {
        padding: 4,
    },
    headerArea: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    pageSubtitle: {
        fontSize: 14,
        color: '#64748b',
        fontWeight: '500',
    },
    addBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#10b981',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 8,
        gap: 8,
    },
    addBtnText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '700',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.4)',
        justifyContent: 'center',
        padding: 20,
    },
    modalContent: {
        backgroundColor: '#fff',
        borderRadius: 24,
        padding: 30,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 10,
    },
    modalTitle: {
        fontSize: 22,
        fontWeight: '800',
        color: '#0f172a',
        marginBottom: 24,
        textAlign: 'center',
        letterSpacing: -0.5,
    },
    errorText: {
        color: '#e11d48',
        marginBottom: 10,
        textAlign: 'center',
        fontWeight: '700',
        backgroundColor: '#fff1f2',
        padding: 10,
        borderRadius: 8,
    },
    label: {
        fontSize: 12,
        fontWeight: '800',
        color: '#94a3b8',
        marginBottom: 8,
        marginTop: 16,
        letterSpacing: 0.5,
    },
    input: {
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 12,
        padding: 16,
        fontSize: 15,
        backgroundColor: '#fff',
        color: '#0f172a',
    },
    pickerContainer: {
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 12,
        backgroundColor: '#fff',
        overflow: 'hidden',
    },
    picker: {
        height: 50,
        width: '100%',
        color: '#0f172a',
    },
    btnRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 24,
        gap: 16,
    },
    modalBtn: {
        flex: 1,
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cancelBtn: {
        backgroundColor: '#f1f5f9',
    },
    saveBtn: {
        backgroundColor: '#1d4ed8',
    },
    cancelBtnText: {
        color: '#64748b',
        fontSize: 15,
        fontWeight: '700',
    },
    saveBtnText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '700',
    }
});
