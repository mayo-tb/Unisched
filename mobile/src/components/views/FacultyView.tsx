import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { api } from '../../lib/api';

interface Lecturer {
    id: number;
    name: string;
    department: string;
    preferences?: Record<string, any>;
}

interface FacultyViewProps {
    onAdd: () => void;
    onEdit: (lecturer: Lecturer) => void;
    refreshTrigger: number;
}

export default function FacultyView({ onAdd, onEdit, refreshTrigger }: FacultyViewProps) {
    const [faculty, setFaculty] = useState<Lecturer[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchFaculty();
    }, [refreshTrigger]);

    const fetchFaculty = async () => {
        try {
            setLoading(true);
            const res = await api.get('/api/resources/lecturers/');
            setFaculty(res.data.results || res.data || []);
        } catch (err) {
            console.error('Failed to fetch faculty:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = (id: number) => {
        const confirmDelete = () => {
            api.delete(`/api/resources/lecturers/${id}/`)
                .then(() => setFaculty(prev => prev.filter(f => f.id !== id)))
                .catch(err => console.error('Delete failed:', err));
        };

        if (Platform.OS === 'web') {
            if (window.confirm("Are you sure you want to delete this lecturer?")) {
                confirmDelete();
            }
        } else {
            Alert.alert("Delete Lecturer", "Are you sure you want to delete this lecturer?", [
                { text: "Cancel", style: "cancel" },
                { text: "Delete", style: "destructive", onPress: confirmDelete }
            ]);
        }
    };

    const renderItem = ({ item }: { item: Lecturer }) => {
        // Determine initials
        const initials = item.name.split(' ').map(n => n.charAt(0)).join('').substring(0, 2).toUpperCase();

        return (
            <View style={styles.card}>
                <View style={styles.cardHeader}>
                    <View style={styles.avatarWrapper}>
                        <Text style={styles.avatarText}>{initials}</Text>
                    </View>
                    <View style={styles.actions}>
                        <TouchableOpacity style={styles.iconBtn} onPress={() => onEdit(item)}>
                            <Feather name="edit-2" size={16} color="#cbd5e1" />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.iconBtn} onPress={() => handleDelete(item.id)}>
                            <Feather name="trash-2" size={16} color="#cbd5e1" />
                        </TouchableOpacity>
                    </View>
                </View>

                <Text style={styles.cardTitle}>{item.name}</Text>
                <Text style={styles.departmentText}>{item.department.toUpperCase()}</Text>

                {/* Placeholder badge for preferences if needed */}
                {Object.keys(item.preferences || {}).length > 0 && (
                    <View style={styles.prefBadge}>
                        <Text style={styles.prefBadgeText}>HAS PREFERENCES</Text>
                    </View>
                )}
            </View>
        );
    };

    const renderAddCard = () => (
        <TouchableOpacity style={styles.addCard} onPress={onAdd}>
            <View style={styles.addIconWrapper}>
                <Feather name="plus" size={24} color="#94a3b8" />
            </View>
            <Text style={styles.addCardText}>ADD NEW LECTURER</Text>
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            {loading ? (
                <ActivityIndicator style={{ marginTop: 40 }} color="#1a73e8" />
            ) : (
                <FlatList
                    data={[{ id: 'add-btn', isAddNode: true } as any, ...faculty]}
                    keyExtractor={item => item.id.toString()}
                    numColumns={3}
                    columnWrapperStyle={styles.row}
                    contentContainerStyle={{ paddingBottom: 20 }}
                    renderItem={({ item }) => {
                        if (item.isAddNode) return renderAddCard();
                        return renderItem({ item });
                    }}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        marginTop: 10, // Margin to separate from nav bar
    },
    row: {
        gap: 20,
        marginBottom: 20,
    },
    card: {
        flex: 1,
        backgroundColor: '#fff',
        borderRadius: 24,
        padding: 24,
        minWidth: '30%',
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowRadius: 20,
        elevation: 2,
        marginHorizontal: 10,
    },
    addCard: {
        flex: 1,
        backgroundColor: '#f8fafc',
        borderRadius: 24,
        padding: 24,
        minWidth: '30%',
        marginHorizontal: 10,
        borderWidth: 2,
        borderColor: '#e2e8f0',
        borderStyle: 'dashed',
        justifyContent: 'center',
        alignItems: 'center',
    },
    addIconWrapper: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#f1f5f9',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    addCardText: {
        fontSize: 12,
        fontWeight: '800',
        color: '#94a3b8',
        letterSpacing: 1,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 20,
    },
    avatarWrapper: {
        width: 48,
        height: 48,
        borderRadius: 16,
        backgroundColor: '#eff6ff',
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarText: {
        color: '#3b82f6',
        fontWeight: '800',
        fontSize: 18,
    },
    actions: {
        flexDirection: 'row',
        gap: 12,
    },
    iconBtn: {
        padding: 4,
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#0f172a',
        marginBottom: 6,
    },
    departmentText: {
        fontSize: 11,
        fontWeight: '800',
        color: '#94a3b8',
        letterSpacing: 0.5,
        marginBottom: 16,
    },
    prefBadge: {
        backgroundColor: '#fffbeb',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 6,
        alignSelf: 'flex-start',
        borderWidth: 1,
        borderColor: '#fef3c7',
    },
    prefBadgeText: {
        fontSize: 10,
        fontWeight: '800',
        color: '#d97706',
        letterSpacing: 0.5,
    },
});
