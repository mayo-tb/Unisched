import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { api } from '../../lib/api';

interface Room {
    id: number;
    name: string;
    capacity: number;
    building: string;
}

interface RoomViewProps {
    onAdd: () => void;
    onEdit: (room: Room) => void;
    refreshTrigger: number;
}

export default function RoomView({ onAdd, onEdit, refreshTrigger }: RoomViewProps) {
    const [rooms, setRooms] = useState<Room[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchRooms();
    }, [refreshTrigger]);

    const fetchRooms = async () => {
        try {
            setLoading(true);
            const res = await api.get('/api/resources/rooms/');
            setRooms(res.data.results || res.data || []);
        } catch (err) {
            console.error('Failed to fetch rooms:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = (id: number) => {
        const confirmDelete = () => {
            api.delete(`/api/resources/rooms/${id}/`)
                .then(() => setRooms(prev => prev.filter(r => r.id !== id)))
                .catch(err => console.error('Delete failed:', err));
        };

        if (Platform.OS === 'web') {
            if (window.confirm("Are you sure you want to delete this room?")) {
                confirmDelete();
            }
        } else {
            Alert.alert("Delete Room", "Are you sure you want to delete this room?", [
                { text: "Cancel", style: "cancel" },
                { text: "Delete", style: "destructive", onPress: confirmDelete }
            ]);
        }
    };

    const renderItem = ({ item }: { item: Room }) => (
        <View style={styles.card}>
            <View style={styles.cardHeader}>
                <View style={styles.iconWrapper}>
                    <Feather name="map-pin" size={20} color="#ea580c" />
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
            <Text style={styles.buildingText}>{item.building.toUpperCase()}</Text>

            <View style={styles.badge}>
                <Text style={styles.badgeText}>{item.capacity} SEATS</Text>
            </View>
        </View>
    );

    return (
        <View style={styles.container}>
            <View style={styles.headerRow}>
                <Text style={styles.heading}>PHYSICAL FACILITIES</Text>
                <TouchableOpacity style={styles.addBtn} onPress={onAdd}>
                    <Feather name="plus" size={16} color="#fff" style={styles.addIcon} />
                    <Text style={styles.addBtnText}>Add Facility</Text>
                </TouchableOpacity>
            </View>

            {loading ? (
                <ActivityIndicator style={{ marginTop: 40 }} color="#1a73e8" />
            ) : (
                <FlatList
                    data={rooms}
                    keyExtractor={item => item.id.toString()}
                    numColumns={3}
                    columnWrapperStyle={styles.row}
                    contentContainerStyle={{ paddingBottom: 20 }}
                    renderItem={renderItem}
                    ListEmptyComponent={<Text style={styles.emptyText}>No facilities found.</Text>}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
        borderRadius: 24,
        padding: 30,
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowRadius: 20,
        elevation: 2,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 30,
    },
    heading: {
        fontSize: 18,
        fontWeight: '800',
        color: '#0f172a',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    addBtn: {
        backgroundColor: '#0f172a',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 20,
    },
    addIcon: {
        marginRight: 6,
    },
    addBtnText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 13,
    },
    row: {
        gap: 20,
        marginBottom: 20,
    },
    card: {
        flex: 1,
        backgroundColor: '#f8fafc',
        borderRadius: 24,
        padding: 24,
        minWidth: '30%',
        shadowColor: '#000',
        shadowOpacity: 0.02,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 20,
    },
    iconWrapper: {
        width: 44,
        height: 44,
        borderRadius: 14,
        backgroundColor: '#ffedd5',
        justifyContent: 'center',
        alignItems: 'center',
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
        marginBottom: 4,
    },
    buildingText: {
        fontSize: 11,
        fontWeight: '800',
        color: '#94a3b8',
        letterSpacing: 0.5,
        marginBottom: 16,
    },
    badge: {
        backgroundColor: '#fff',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 6,
        alignSelf: 'flex-start',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    badgeText: {
        fontSize: 10,
        fontWeight: '800',
        color: '#94a3b8',
        letterSpacing: 0.5,
    },
    emptyText: {
        color: '#94a3b8',
        marginTop: 40,
    }
});
