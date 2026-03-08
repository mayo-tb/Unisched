import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ActivityIndicator,
    TouchableOpacity,
    ScrollView,
    TextInput,
    Switch,
    Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { lecturerApi } from '../lib/api';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

export const PreferencesView: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [workspaceId, setWorkspaceId] = useState<string | null>(null);

    const [maxHoursPerWeek, setMaxHoursPerWeek] = useState('20');
    const [maxDailyHours, setMaxDailyHours] = useState('6');
    const [preferredDays, setPreferredDays] = useState<number[]>([0, 1, 2, 3, 4]);
    const [avoidDays, setAvoidDays] = useState<number[]>([]);
    const [morningOnly, setMorningOnly] = useState(false);

    useEffect(() => {
        fetchPreferences();
    }, []);

    const fetchPreferences = async () => {
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

            const response = await lecturerApi.getPreferences(currentWsId || undefined);
            const prefs = response.data.preferences || {};

            setMaxHoursPerWeek(prefs.max_hours_per_week?.toString() ?? '20');
            setMaxDailyHours(prefs.max_daily_hours?.toString() ?? '6');
            setPreferredDays(prefs.preferred_days ?? [0, 1, 2, 3, 4]);
            setAvoidDays(prefs.avoid_days ?? []);
            setMorningOnly(prefs.morning_only ?? false);
            setError(null);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to load preferences.');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const data = {
                max_hours_per_week: parseInt(maxHoursPerWeek, 10),
                max_daily_hours: parseInt(maxDailyHours, 10),
                preferred_days: preferredDays,
                avoid_days: avoidDays,
                morning_only: morningOnly,
            };

            await lecturerApi.updatePreferences(data, workspaceId || undefined);
            Alert.alert('Success', 'Preferences saved successfully.');
        } catch (err: any) {
            Alert.alert('Error', err.response?.data?.error || 'Failed to save preferences.');
        } finally {
            setSaving(false);
        }
    };

    const toggleDay = (dayIdx: number, list: number[], setter: (v: number[]) => void) => {
        if (list.includes(dayIdx)) {
            setter(list.filter(d => d !== dayIdx));
        } else {
            setter([...list, dayIdx]);
        }
    };

    if (loading) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color="#0EA5E9" />
                <Text style={styles.loadingText}>Loading preferences...</Text>
            </View>
        );
    }

    return (
        <ScrollView style={styles.container}>
            <View style={styles.content}>
                <View style={styles.header}>
                    <Text style={styles.title}>Preferences</Text>
                    <Text style={styles.subtitle}>Set your scheduling availability</Text>
                </View>

                {error ? (
                    <View style={styles.errorBox}>
                        <Text style={styles.errorText}>{error}</Text>
                    </View>
                ) : null}

                <View style={styles.card}>
                    {/* Hours */}
                    <View style={styles.row}>
                        <View style={{ flex: 1, marginRight: 8 }}>
                            <Text style={styles.label}>Max Hours / Week</Text>
                            <TextInput
                                style={styles.input}
                                keyboardType="numeric"
                                value={maxHoursPerWeek}
                                onChangeText={setMaxHoursPerWeek}
                            />
                        </View>
                        <View style={{ flex: 1, marginLeft: 8 }}>
                            <Text style={styles.label}>Max Hours / Day</Text>
                            <TextInput
                                style={styles.input}
                                keyboardType="numeric"
                                value={maxDailyHours}
                                onChangeText={setMaxDailyHours}
                            />
                        </View>
                    </View>

                    {/* Preferred Days */}
                    <Text style={[styles.label, { marginTop: 24 }]}>Preferred Days to Teach</Text>
                    <View style={styles.daysWrapper}>
                        {DAYS.map((day, idx) => {
                            const isActive = preferredDays.includes(idx);
                            return (
                                <TouchableOpacity
                                    key={`pref-${idx}`}
                                    style={[styles.dayBadge, isActive ? styles.dayBadgeActive : null]}
                                    onPress={() => toggleDay(idx, preferredDays, setPreferredDays)}
                                >
                                    <Text style={[styles.dayText, isActive ? styles.dayTextActive : null]}>
                                        {day.substring(0, 3)}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    {/* Avoid Days */}
                    <Text style={[styles.label, { marginTop: 24, color: '#EF4444' }]}>Days to Avoid</Text>
                    <View style={styles.daysWrapper}>
                        {DAYS.map((day, idx) => {
                            const isActive = avoidDays.includes(idx);
                            return (
                                <TouchableOpacity
                                    key={`avoid-${idx}`}
                                    style={[styles.dayBadge, isActive ? styles.dayBadgeDanger : null]}
                                    onPress={() => toggleDay(idx, avoidDays, setAvoidDays)}
                                >
                                    <Text style={[styles.dayText, isActive ? styles.dayTextDanger : null]}>
                                        {day.substring(0, 3)}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    {/* Morning Only */}
                    <View style={styles.switchRow}>
                        <View>
                            <Text style={styles.label}>Morning Classes Only</Text>
                            <Text style={styles.helpText}>Prefer teaching before 12:00 PM</Text>
                        </View>
                        <Switch
                            value={morningOnly}
                            onValueChange={setMorningOnly}
                            trackColor={{ false: '#E2E8F0', true: '#38BDF8' }}
                            thumbColor={morningOnly ? '#FFFFFF' : '#FFFFFF'}
                        />
                    </View>

                    {/* Save Action */}
                    <TouchableOpacity
                        style={[styles.saveBtn, saving && { opacity: 0.7 }]}
                        onPress={handleSave}
                        disabled={saving}
                    >
                        {saving ? (
                            <ActivityIndicator color="#FFFFFF" />
                        ) : (
                            <Text style={styles.saveBtnText}>Save Preferences</Text>
                        )}
                    </TouchableOpacity>
                </View>
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' },
    loadingText: { marginTop: 12, fontSize: 14, color: '#64748B' },
    content: { padding: 16, paddingTop: 20 },
    header: { marginBottom: 20 },
    title: { fontSize: 24, fontWeight: '800', color: '#0F172A' },
    subtitle: { fontSize: 14, color: '#64748B', marginTop: 4 },
    errorBox: { padding: 12, backgroundColor: '#FEF2F2', borderRadius: 8, marginBottom: 16 },
    errorText: { color: '#EF4444', fontSize: 14 },
    card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
    row: { flexDirection: 'row', justifyContent: 'space-between' },
    label: { fontSize: 14, fontWeight: '600', color: '#334155', marginBottom: 8 },
    helpText: { fontSize: 12, color: '#94A3B8', marginTop: 2 },
    input: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 12, fontSize: 15, color: '#1E293B', backgroundColor: '#F8FAFC' },
    daysWrapper: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    dayBadge: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC' },
    dayBadgeActive: { backgroundColor: '#F0F9FF', borderColor: '#bae6fd' },
    dayBadgeDanger: { backgroundColor: '#FEF2F2', borderColor: '#FCA5A5' },
    dayText: { fontSize: 14, fontWeight: '500', color: '#64748B' },
    dayTextActive: { color: '#0284C7', fontWeight: '700' },
    dayTextDanger: { color: '#DC2626', fontWeight: '700' },
    switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 32, marginBottom: 24, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
    saveBtn: { backgroundColor: '#0EA5E9', borderRadius: 10, paddingVertical: 16, alignItems: 'center', marginTop: 12 },
    saveBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});

export default PreferencesView;
