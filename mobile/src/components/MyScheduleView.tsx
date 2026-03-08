import React, { useState, useEffect } from 'react';
import {
    ScrollView,
    View,
    Text,
    StyleSheet,
    ActivityIndicator,
    TouchableOpacity,
    Dimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { lecturerApi, ScheduleEntry } from '../lib/api';

const { width } = Dimensions.get('window');

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const HOURS = Array.from({ length: 11 }, (_, i) => i + 8); // 8 AM to 6 PM
const HOUR_HEIGHT = 80;

export const MyScheduleView: React.FC = () => {
    const [entries, setEntries] = useState<ScheduleEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [workspaceId, setWorkspaceId] = useState<string | null>(null);

    const fetchSchedule = async () => {
        setLoading(true);
        try {
            let currentWsId = workspaceId;
            if (!currentWsId) {
                const wsData = await AsyncStorage.getItem('gc_workspace');
                if (wsData) {
                    currentWsId = JSON.parse(wsData).id;
                    setWorkspaceId(currentWsId);
                }
            }

            const response = await lecturerApi.schedule(currentWsId || undefined);
            setEntries(response.data.entries || []);
            setError(null);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to load schedule.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSchedule();
    }, []);

    if (loading) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color="#10B981" />
                <Text style={styles.loadingText}>Loading my schedule...</Text>
            </View>
        );
    }

    if (error) {
        return (
            <View style={styles.centerContainer}>
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity style={styles.refreshBtn} onPress={fetchSchedule}>
                    <Text style={styles.refreshBtnText}>Try Again</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const renderGridEntry = (entry: ScheduleEntry, index: number) => {
        // We map 'timeslot_index' to day and hour
        const slotsPerDay = 9; // For timeslot labels length
        const dayIndex = Math.floor(entry.timeslot_index / slotsPerDay);
        const hourOffset = entry.timeslot_index % slotsPerDay; // offset from 8 AM

        // Safety
        if (dayIndex < 0 || dayIndex > 4) return null;

        const startHour = 8 + hourOffset;
        if (startHour < 8 || startHour > 18) return null;

        const topOffset = (startHour - 8) * HOUR_HEIGHT;
        const height = HOUR_HEIGHT; // Assuming duration is 1 timeslot = 1 hour

        return (
            <View
                key={`entry-${index}`}
                style={[styles.courseBlockWrapper, { top: topOffset, height: height }]}
            >
                <View style={styles.courseBlock}>
                    <Text style={styles.courseBlockCode} numberOfLines={1}>{entry.course_code}</Text>
                    <Text style={styles.courseBlockName} numberOfLines={1}>{entry.course_name}</Text>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                        <Text style={styles.courseBlockDetail} numberOfLines={1}>📍 {entry.room_name}</Text>
                        <Text style={styles.courseBlockDetail} numberOfLines={1}>👥 {entry.group_name}</Text>
                    </View>
                </View>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            {/* Header Panel */}
            <View style={styles.headerPanel}>
                <Text style={styles.headerTitle}>My Schedule</Text>
                <Text style={styles.headerSubtitle}>{entries.length} classes assigned</Text>
            </View>

            {/* Grid Timetable Container */}
            <ScrollView style={styles.gridScrollWrapper}>
                <ScrollView horizontal showsHorizontalScrollIndicator={true} contentContainerStyle={styles.gridHorizontalContainer}>
                    <View style={styles.gridBoard}>

                        {/* Top Fixed Header Rows */}
                        <View style={styles.gridHeaderRow}>
                            <View style={styles.timeAxisHeader}>
                                <Text style={styles.timeAxisHeaderText}>TIME</Text>
                            </View>
                            {DAYS.map(day => (
                                <View key={day} style={styles.dayHeaderCell}>
                                    <Text style={styles.dayHeaderText}>{day.toUpperCase()}</Text>
                                </View>
                            ))}
                        </View>

                        {/* Timetable Body */}
                        <View style={styles.gridBody}>
                            {/* Left Y-Axis (Hours) */}
                            <View style={styles.timeAxis}>
                                {HOURS.slice(0, -1).map(hour => (
                                    <View key={hour} style={[styles.timeLabelContainer, { height: HOUR_HEIGHT }]}>
                                        <Text style={styles.timeLabel}>{`${hour.toString().padStart(2, '0')}:00`}</Text>
                                    </View>
                                ))}
                            </View>

                            {/* Data Columns (Days) */}
                            {DAYS.map((day, dayIndex) => {
                                const dayEntries = entries.filter(e => Math.floor(e.timeslot_index / 9) === dayIndex);
                                return (
                                    <View key={day} style={styles.dayColumn}>
                                        {HOURS.slice(0, -1).map(hour => (
                                            <View key={`empty-${hour}`} style={[styles.emptyCellState, { height: HOUR_HEIGHT }]} />
                                        ))}
                                        {dayEntries.map(renderGridEntry)}
                                    </View>
                                );
                            })}
                        </View>

                    </View>
                </ScrollView>
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' },
    loadingText: { marginTop: 12, fontSize: 14, color: '#64748B' },
    errorText: { fontSize: 16, color: '#EF4444', marginBottom: 16, textAlign: 'center' },
    refreshBtn: { padding: 12, backgroundColor: '#10B981', borderRadius: 8 },
    refreshBtnText: { color: '#FFF', fontWeight: 'bold' },
    headerPanel: { padding: 20, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
    headerTitle: { fontSize: 24, fontWeight: '800', color: '#0F172A' },
    headerSubtitle: { fontSize: 14, color: '#64748B', marginTop: 4 },
    gridScrollWrapper: { flex: 1, padding: 10 },
    gridHorizontalContainer: { minWidth: Math.max(800, width - 20), paddingBottom: 40 },
    gridBoard: { flex: 1, backgroundColor: '#FFF', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', overflow: 'hidden' },
    gridHeaderRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#E2E8F0', backgroundColor: '#F8FAFC' },
    timeAxisHeader: { width: 70, justifyContent: 'center', alignItems: 'center' },
    timeAxisHeaderText: { fontSize: 10, fontWeight: '700', color: '#94A3B8' },
    dayHeaderCell: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 16, borderLeftWidth: 1, borderLeftColor: '#F1F5F9' },
    dayHeaderText: { fontSize: 12, fontWeight: '700', color: '#475569' },
    gridBody: { flexDirection: 'row', flex: 1 },
    timeAxis: { width: 70, borderRightWidth: 1, borderRightColor: '#F1F5F9', backgroundColor: '#FFF' },
    timeLabelContainer: { paddingTop: 10, paddingRight: 10, alignItems: 'flex-end', borderBottomWidth: 1, borderBottomColor: 'transparent' },
    timeLabel: { fontSize: 11, fontWeight: '600', color: '#64748B' },
    dayColumn: { flex: 1, position: 'relative', borderLeftWidth: 1, borderLeftColor: '#F1F5F9' },
    emptyCellState: { borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
    courseBlockWrapper: { position: 'absolute', left: 4, right: 4, zIndex: 10, paddingTop: 2, paddingBottom: 2 },
    courseBlock: { flex: 1, backgroundColor: '#ECFDF5', borderRadius: 8, borderLeftWidth: 4, borderLeftColor: '#10B981', padding: 8 },
    courseBlockCode: { fontSize: 12, fontWeight: 'bold', color: '#065F46' },
    courseBlockName: { fontSize: 11, color: '#047857', marginTop: 2 },
    courseBlockDetail: { fontSize: 10, color: '#064E3B', marginTop: 4 },
});

export default MyScheduleView;
