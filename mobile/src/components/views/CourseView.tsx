import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { api } from '../../lib/api';

interface Course {
    id: number;
    name: string;
    code: string;
    description: string;
    duration_hours: number;
    lecturer: number | null;
    student_group: number | null;
}

interface CourseViewProps {
    onAdd: () => void;
    onEdit: (course: Course) => void;
    refreshTrigger: number;
}

export default function CourseView({ onAdd, onEdit, refreshTrigger }: CourseViewProps) {
    const [courses, setCourses] = useState<Course[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchCourses();
    }, [refreshTrigger]);

    const fetchCourses = async () => {
        try {
            setLoading(true);
            const res = await api.get('/api/resources/courses/');
            setCourses(res.data.results || res.data || []);
        } catch (err) {
            console.error('Failed to fetch courses:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = (id: number) => {
        const confirmDelete = () => {
            api.delete(`/api/resources/courses/${id}/`)
                .then(() => {
                    setCourses(prev => prev.filter(c => c.id !== id));
                })
                .catch(err => console.error('Delete failed:', err));
        };

        if (Platform.OS === 'web') {
            if (window.confirm("Are you sure you want to delete this course?")) {
                confirmDelete();
            }
        } else {
            Alert.alert("Delete Course", "Are you sure you want to delete this course?", [
                { text: "Cancel", style: "cancel" },
                { text: "Delete", style: "destructive", onPress: confirmDelete }
            ]);
        }
    };

    const renderItem = ({ item }: { item: Course }) => (
        <View style={styles.tableRow}>
            <Text style={[styles.cell, styles.codeCell]}>
                <View style={styles.badge}><Text style={styles.badgeText}>{item.code}</Text></View>
            </Text>
            <View style={[styles.cell, styles.titleCell]}>
                <Text style={styles.titleText}>{item.name}</Text>
                <Text style={styles.descText} numberOfLines={1}>
                    {item.description || "Course duration: " + item.duration_hours + " hrs"}
                </Text>
            </View>
            <Text style={[styles.cell, styles.instructorCell]}>
                {item.lecturer ? `Lecturer ID: ${item.lecturer}` : 'Unassigned'}
            </Text>
            <Text style={[styles.cell, styles.cohortCell]}>
                {item.student_group ? `Group ID: ${item.student_group}` : 'All'}
            </Text>
            <View style={[styles.cell, styles.actionCell]}>
                <TouchableOpacity style={styles.iconBtn} onPress={() => onEdit(item)}>
                    <Feather name="edit-2" size={18} color="#9095a0" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.iconBtn} onPress={() => handleDelete(item.id)}>
                    <Feather name="trash-2" size={18} color="#9095a0" />
                </TouchableOpacity>
            </View>
        </View>
    );

    return (
        <View style={styles.container}>
            <View style={styles.headerRow}>
                <View>
                    <Text style={styles.heading}>Academic Curriculum</Text>
                    <Text style={styles.subHeading}>Assign lecturers, descriptions, and target cohorts.</Text>
                </View>
                <TouchableOpacity style={styles.addBtn} onPress={onAdd}>
                    <Feather name="plus" size={18} color="#fff" style={styles.addIcon} />
                    <Text style={styles.addBtnText}>Add Course</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.tableContainer}>
                {/* Table Header */}
                <View style={styles.tableHeader}>
                    <Text style={[styles.th, styles.codeCell]}>CODE</Text>
                    <Text style={[styles.th, styles.titleCell]}>TITLE & DESCRIPTION</Text>
                    <Text style={[styles.th, styles.instructorCell]}>INSTRUCTOR</Text>
                    <Text style={[styles.th, styles.cohortCell]}>COHORT</Text>
                    <Text style={[styles.th, styles.actionCell, { textAlign: 'right' }]}>ACTIONS</Text>
                </View>

                {loading ? (
                    <ActivityIndicator style={{ marginTop: 40 }} color="#1a73e8" />
                ) : (
                    <FlatList
                        data={courses}
                        keyExtractor={item => item.id.toString()}
                        renderItem={renderItem}
                        contentContainerStyle={{ paddingBottom: 20 }}
                        ListEmptyComponent={<Text style={styles.emptyText}>No courses found.</Text>}
                    />
                )}
            </View>
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
        marginBottom: 40,
    },
    heading: {
        fontSize: 22,
        fontWeight: '800',
        color: '#1e293b',
    },
    subHeading: {
        fontSize: 14,
        color: '#64748b',
        marginTop: 6,
    },
    addBtn: {
        backgroundColor: '#1d4ed8',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 12,
        shadowColor: '#1d4ed8',
        shadowOpacity: 0.3,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
    },
    addIcon: {
        marginRight: 8,
    },
    addBtnText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 14,
    },
    tableContainer: {
        flex: 1,
    },
    tableHeader: {
        flexDirection: 'row',
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
        marginBottom: 8,
    },
    th: {
        fontSize: 11,
        fontWeight: '800',
        color: '#94a3b8',
        letterSpacing: 1,
    },
    tableRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 18,
        borderBottomWidth: 1,
        borderBottomColor: '#f8fafc',
    },
    cell: {
        justifyContent: 'center',
    },
    codeCell: { flex: 1 },
    titleCell: { flex: 3 },
    instructorCell: { flex: 1.5, fontSize: 13, color: '#475569' },
    cohortCell: { flex: 1.5, fontSize: 13, color: '#475569' },
    actionCell: { flex: 1, flexDirection: 'row', justifyContent: 'flex-end', gap: 16 },

    badge: {
        backgroundColor: '#eff6ff',
        alignSelf: 'flex-start',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 6,
    },
    badgeText: {
        color: '#1d4ed8',
        fontSize: 12,
        fontWeight: '700',
    },
    titleText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1e293b',
        marginBottom: 4,
    },
    descText: {
        fontSize: 12,
        color: '#94a3b8',
        fontStyle: 'italic',
    },
    iconBtn: {
        padding: 4,
    },
    emptyText: {
        textAlign: 'center',
        color: '#94a3b8',
        marginTop: 40,
    }
});
