import React, { useState, useEffect } from 'react';
import {
    Modal, View, Text, TextInput, TouchableOpacity,
    StyleSheet, ActivityIndicator, Platform, ScrollView
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import DropDownPicker from 'react-native-dropdown-picker';
import Toast from 'react-native-toast-message';
import { api } from '../lib/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

type ResourceType = 'Lecturer' | 'Student Group' | 'Course' | 'Room' | null;

interface ResourceModalProps {
    visible: boolean;
    type: ResourceType;
    initialData?: any; // If provided, we are in Edit mode
    onClose: () => void;
    onSuccess: () => void;
}

export default function ResourceModal({ visible, type, initialData, onClose, onSuccess }: ResourceModalProps) {
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    const isEdit = !!initialData;

    // Generic fields
    const [name, setName] = useState('');

    // Lecturer fields
    const [department, setDepartment] = useState('');
    const [morningOnly, setMorningOnly] = useState(false);
    const [avoidDays, setAvoidDays] = useState<number[]>([]);

    // Student Group fields
    const [size, setSize] = useState('');

    // Course Fields
    const [code, setCode] = useState('');
    const [duration, setDuration] = useState('1');
    const [selectedLecturer, setSelectedLecturer] = useState<number | null>(null);
    const [selectedGroup, setSelectedGroup] = useState<number | null>(null);

    // Relational options for Course
    const [lecturersOptions, setLecturersOptions] = useState<any[]>([]);
    const [groupsOptions, setGroupsOptions] = useState<any[]>([]);
    const [lecturerPickerOpen, setLecturerPickerOpen] = useState(false);
    const [groupPickerOpen, setGroupPickerOpen] = useState(false);

    // Room Fields
    const [capacity, setCapacity] = useState('');
    const [building, setBuilding] = useState('Main');

    // Pre-fill form if initialData exists
    useEffect(() => {
        if (visible) {
            if (type === 'Course') {
                fetchRelations();
            }

            if (initialData) {
                setName(initialData.name || '');
                if (type === 'Lecturer') {
                    setDepartment(initialData.department || '');
                    setMorningOnly(initialData.preferences?.morning_only || false);
                    setAvoidDays(initialData.preferences?.avoid_days || []);
                }
                if (type === 'Student Group') setSize(initialData.size?.toString() || '');
                if (type === 'Course') {
                    setCode(initialData.code || '');
                    setDuration(initialData.duration_hours?.toString() || '1');
                    setSelectedLecturer(initialData.lecturer || null);
                    setSelectedGroup(initialData.student_group || null);
                }
                if (type === 'Room') {
                    setCapacity(initialData.capacity?.toString() || '');
                    setBuilding(initialData.building || 'Main');
                }
            } else {
                resetForm();
            }
        }
    }, [visible, initialData, type]);

    const fetchRelations = async () => {
        try {
            const [lecRes, grpRes] = await Promise.all([
                api.get('/api/resources/lecturers/'),
                api.get('/api/resources/groups/')
            ]);
            setLecturersOptions(lecRes.data.results || lecRes.data || []);
            setGroupsOptions(grpRes.data.results || grpRes.data || []);
        } catch (err) {
            console.error('Failed to fetch relations for dropdowns:', err);
        }
    };

    const resetForm = () => {
        setName('');
        setDepartment('');
        setMorningOnly(false);
        setAvoidDays([]);
        setSize('');
        setCode('');
        setDuration('1');
        setSelectedLecturer(null);
        setSelectedGroup(null);
        setCapacity('');
        setBuilding('Main');
        setErrorMsg('');
    };

    const handleClose = () => {
        resetForm();
        onClose();
    };

    const showAlert = (title: string, msg: string, type: 'success' | 'error' = 'error') => {
        Toast.show({
            type: type,
            text1: title,
            text2: msg,
            position: 'top',
        });
    };

    const handleSubmit = async () => {
        if (!name.trim()) {
            setErrorMsg('Name is required');
            return;
        }

        setLoading(true);
        setErrorMsg('');

        try {
            let workspaceId = '';

            // if editing, workspace is usually already in initialData, but let's grab it anyway
            if (initialData && initialData.workspace) {
                workspaceId = initialData.workspace;
            } else {
                const wsData = await AsyncStorage.getItem('gc_workspace');
                if (wsData) {
                    workspaceId = JSON.parse(wsData).id;
                } else {
                    const wsResponse = await api.get('/api/workspaces/');
                    if (wsResponse.data && wsResponse.data.length > 0) {
                        workspaceId = wsResponse.data[0].id;
                        await AsyncStorage.setItem('gc_workspace', JSON.stringify({ id: workspaceId }));
                    } else {
                        const newWs = await api.post('/api/workspaces/', { name: 'Default Workspace' });
                        workspaceId = newWs.data.id;
                        await AsyncStorage.setItem('gc_workspace', JSON.stringify({ id: workspaceId }));
                    }
                }
            }

            let endpoint = '';
            let payload: any = { workspace: workspaceId };

            switch (type) {
                case 'Lecturer':
                    if (!department.trim()) throw new Error('Department is required');
                    endpoint = '/api/resources/lecturers/';
                    payload = {
                        ...payload,
                        name,
                        department,
                        preferences: {
                            morning_only: morningOnly,
                            avoid_days: avoidDays
                        }
                    };
                    break;

                case 'Student Group':
                    if (!size || isNaN(Number(size))) throw new Error('Valid size is required');
                    endpoint = '/api/resources/groups/';
                    payload = { ...payload, name, size: Number(size) };
                    break;

                case 'Course':
                    if (!code.trim()) throw new Error('Course code is required');
                    endpoint = '/api/resources/courses/';
                    payload = {
                        ...payload,
                        name,
                        code,
                        duration_hours: Number(duration) || 1,
                        lecturer: selectedLecturer,
                        student_group: selectedGroup
                    };
                    break;

                case 'Room':
                    if (!capacity || isNaN(Number(capacity))) throw new Error('Valid capacity is required');
                    endpoint = '/api/resources/rooms/';
                    payload = { ...payload, name, capacity: Number(capacity), building };
                    break;
            }

            if (isEdit) {
                await api.put(`${endpoint}${initialData.id}/`, payload);
                showAlert('Success!', `Successfully updated ${type}: ${name}`, 'success');
            } else {
                await api.post(endpoint, payload);
                showAlert('Success!', `Successfully created ${type}: ${name}`, 'success');
            }

            onSuccess();
            handleClose();

        } catch (err: any) {
            console.error(`Error saving ${type}:`, err);
            const msg = err.response?.data?.detail
                || err.response?.data?.name?.[0]
                || err.message
                || 'An error occurred';
            setErrorMsg(`Failed: ${msg}`);
        } finally {
            setLoading(false);
        }
    };

    const renderFields = () => {
        switch (type) {
            case 'Lecturer':
                return (
                    <>
                        <Text style={styles.label}>Full Name</Text>
                        <TextInput
                            style={styles.input}
                            value={name}
                            onChangeText={setName}
                            placeholder="e.g. Dr. Jane Smith"
                        />

                        <Text style={styles.label}>Department</Text>
                        <TextInput
                            style={styles.input}
                            value={department}
                            onChangeText={setDepartment}
                            placeholder="e.g. Computer Science"
                        />

                        <View style={styles.preferencesSection}>
                            <Text style={styles.sectionHeader}>Scheduling Constraints</Text>

                            <TouchableOpacity
                                style={styles.switchRow}
                                onPress={() => setMorningOnly(!morningOnly)}
                            >
                                <Text style={styles.switchLabel}>Morning Classes Only</Text>
                                <View style={[styles.switchTrack, morningOnly && styles.switchTrackActive]}>
                                    <View style={[styles.switchThumb, morningOnly && styles.switchThumbActive]} />
                                </View>
                            </TouchableOpacity>

                            <Text style={styles.label}>Unavailable Days</Text>
                            <View style={styles.daysContainer}>
                                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((day, idx) => {
                                    const isSelected = avoidDays.includes(idx);
                                    return (
                                        <TouchableOpacity
                                            key={day}
                                            style={[styles.dayButton, isSelected && styles.dayButtonActive]}
                                            onPress={() => {
                                                if (isSelected) {
                                                    setAvoidDays(prev => prev.filter(d => d !== idx));
                                                } else {
                                                    setAvoidDays(prev => [...prev, idx]);
                                                }
                                            }}
                                        >
                                            <Text style={[styles.dayText, isSelected && styles.dayTextActive]}>{day}</Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </View>
                    </>
                );
            case 'Student Group':
                return (
                    <>
                        <Text style={styles.label}>Cohort Name</Text>
                        <TextInput
                            style={styles.input}
                            value={name}
                            onChangeText={setName}
                            placeholder="e.g. CS Year 1"
                        />

                        <Text style={styles.label}>Number of Students</Text>
                        <TextInput
                            style={styles.input}
                            value={size}
                            onChangeText={setSize}
                            keyboardType="numeric"
                            placeholder="e.g. 50"
                        />
                    </>
                );
            case 'Course':
                return (
                    <>
                        <Text style={styles.label}>Course Title</Text>
                        <TextInput
                            style={styles.input}
                            value={name}
                            onChangeText={setName}
                            placeholder="e.g. Intro to Programming"
                        />

                        <Text style={styles.label}>Course Code</Text>
                        <TextInput
                            style={styles.input}
                            value={code}
                            onChangeText={setCode}
                            placeholder="e.g. CS101"
                        />

                        <Text style={styles.label}>Duration (Hours per week/session)</Text>
                        <TextInput
                            style={styles.input}
                            value={duration}
                            onChangeText={setDuration}
                            keyboardType="numeric"
                            placeholder="e.g. 2"
                        />

                        <Text style={styles.label}>Assigned Lecturer (Optional)</Text>
                        <DropDownPicker
                            open={lecturerPickerOpen}
                            value={selectedLecturer}
                            items={[
                                { label: 'None (Unassigned)', value: null },
                                ...lecturersOptions.map(lec => ({ label: lec.name, value: lec.id }))
                            ]}
                            setOpen={setLecturerPickerOpen}
                            setValue={setSelectedLecturer}
                            searchable={true}
                            searchPlaceholder="Search lecturers..."
                            placeholder="Select a Lecturer"
                            style={styles.dropdownPicker}
                            dropDownContainerStyle={styles.dropdownContainer}
                            textStyle={styles.dropdownText}
                            zIndex={3000}
                            zIndexInverse={1000}
                        />

                        {/* Adjust zIndex to prevent overlapping dropdowns */}
                        <Text style={[styles.label, { zIndex: -1 }]}>Student Group (Optional)</Text>
                        <DropDownPicker
                            open={groupPickerOpen}
                            value={selectedGroup}
                            items={[
                                { label: 'All Cohorts (Any)', value: null },
                                ...groupsOptions.map(grp => ({ label: grp.name, value: grp.id }))
                            ]}
                            setOpen={setGroupPickerOpen}
                            setValue={setSelectedGroup}
                            searchable={true}
                            searchPlaceholder="Search student groups..."
                            placeholder="Select a Group"
                            style={styles.dropdownPicker}
                            dropDownContainerStyle={styles.dropdownContainer}
                            textStyle={styles.dropdownText}
                            zIndex={2000}
                            zIndexInverse={2000}
                        />
                    </>
                );
            case 'Room':
                return (
                    <>
                        <Text style={styles.label}>Facility Name/Number</Text>
                        <TextInput
                            style={styles.input}
                            value={name}
                            onChangeText={setName}
                            placeholder="e.g. Room 402"
                        />

                        <Text style={styles.label}>Capacity (Seats)</Text>
                        <TextInput
                            style={styles.input}
                            value={capacity}
                            onChangeText={setCapacity}
                            keyboardType="numeric"
                            placeholder="e.g. 30"
                        />

                        <Text style={styles.label}>Building</Text>
                        <TextInput
                            style={styles.input}
                            value={building}
                            onChangeText={setBuilding}
                            placeholder="e.g. Science Block"
                        />
                    </>
                );
            default:
                return null;
        }
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={handleClose}
        >
            <View style={styles.overlay}>
                <View style={[styles.modalContent, type === 'Course' && { maxHeight: '90%' }]}>
                    <Text style={styles.modalTitle}>{isEdit ? 'Edit' : 'Add New'} {type}</Text>

                    {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

                    {type === 'Course' ? (
                        <ScrollView style={styles.scrollFormContainer} showsVerticalScrollIndicator={false}>
                            {renderFields()}
                            {/* Dummy space for scrolling past the picker */}
                            <View style={{ height: 20 }} />
                        </ScrollView>
                    ) : (
                        <View style={styles.formContainer}>
                            {renderFields()}
                        </View>
                    )}

                    <View style={styles.btnRow}>
                        <TouchableOpacity
                            style={[styles.btn, styles.cancelBtn]}
                            onPress={handleClose}
                            disabled={loading}
                        >
                            <Text style={styles.cancelBtnText}>Cancel</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.btn, styles.submitBtn]}
                            onPress={handleSubmit}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.submitBtnText}>{isEdit ? 'Save Changes' : `Create ${type}`}</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
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
    formContainer: {
        marginBottom: 24,
    },
    scrollFormContainer: {
        marginBottom: 24,
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
    dropdownPicker: {
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 12,
        backgroundColor: '#fff',
        minHeight: 50,
    },
    dropdownContainer: {
        borderColor: '#e2e8f0',
        borderRadius: 12,
        backgroundColor: '#fff',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 5,
    },
    dropdownText: {
        fontSize: 15,
        color: '#0f172a',
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
    btnRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 16,
    },
    btn: {
        flex: 1,
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cancelBtn: {
        backgroundColor: '#f1f5f9',
    },
    submitBtn: {
        backgroundColor: '#1d4ed8',
    },
    cancelBtnText: {
        color: '#64748b',
        fontSize: 15,
        fontWeight: '700',
    },
    submitBtnText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '700',
    },
    preferencesSection: {
        marginTop: 24,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
    },
    sectionHeader: {
        fontSize: 14,
        fontWeight: '800',
        color: '#0f172a',
        marginBottom: 16,
    },
    switchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    switchLabel: {
        fontSize: 14,
        color: '#334155',
        fontWeight: '600',
    },
    switchTrack: {
        width: 44,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#e2e8f0',
        padding: 2,
    },
    switchTrackActive: {
        backgroundColor: '#1d4ed8',
    },
    switchThumb: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: '#fff',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    switchThumbActive: {
        transform: [{ translateX: 20 }],
    },
    daysContainer: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 8,
    },
    dayButton: {
        flex: 1,
        height: 40,
        borderRadius: 8,
        backgroundColor: '#f1f5f9',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    dayButtonActive: {
        backgroundColor: '#ef4444',
        borderColor: '#dc2626',
    },
    dayText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#64748b',
    },
    dayTextActive: {
        color: '#fff',
    },
});
