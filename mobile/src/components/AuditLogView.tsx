import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  SafeAreaView, ActivityIndicator, RefreshControl,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import TopHeader from './TopHeader';
import { auditLogApi, type AuditLogEntry } from '../lib/api';

export default function AuditLogView() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [workspaceId, setWorkspaceId] = useState<string | undefined>(undefined);

  useEffect(() => {
    initWorkspace();
  }, []);

  const initWorkspace = async () => {
    try {
      const wsData = await AsyncStorage.getItem('gc_workspace');
      if (wsData) {
        const wsId = JSON.parse(wsData).id;
        setWorkspaceId(wsId);
        loadLogs(wsId);
      } else {
        loadLogs(undefined);
      }
    } catch {
      loadLogs(undefined);
    }
  };

  const loadLogs = async (wsId?: string) => {
    try {
      const res = await auditLogApi.list(wsId);
      setLogs(res.data as AuditLogEntry[]);
    } catch (err) {
      console.error('Failed to load audit log:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadLogs(workspaceId);
  }, [workspaceId]);

  const formatTime = (ts: string) =>
    new Date(ts).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

  return (
    <SafeAreaView style={styles.container}>
      <TopHeader />
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0ea5e9']} />}
      >
        {/* Page Header */}
        <View style={styles.headerRow}>
          <Feather name="list" size={22} color="#0ea5e9" />
          <View style={{ marginLeft: 10 }}>
            <Text style={styles.pageTitle}>Audit Log</Text>
            <Text style={styles.pageSubtitle}>Pull down to refresh · System activity history</Text>
          </View>
        </View>

        {/* Log List */}
        <View style={styles.listCard}>
          <View style={styles.listHeader}>
            <Text style={styles.listHeaderTitle}>Activity Feed</Text>
          </View>

          {loading ? (
            <ActivityIndicator size="large" color="#0ea5e9" style={{ marginVertical: 50 }} />
          ) : logs.length === 0 ? (
            <View style={styles.emptyState}>
              <Feather name="inbox" size={32} color="#e2e8f0" />
              <Text style={styles.emptyText}>No activity recorded yet.</Text>
              <Text style={styles.emptySubText}>Resource changes and timetable runs will appear here.</Text>
            </View>
          ) : (
            logs.map((entry, index) => (
              <View key={entry.id} style={[styles.logRow, index === logs.length - 1 && { borderBottomWidth: 0 }]}>
                <View style={styles.avatarCircle}>
                  <Feather name="user" size={14} color="#64748b" />
                </View>
                <View style={styles.logContent}>
                  <Text style={styles.logAction} numberOfLines={2}>
                    <Text style={styles.actorName}>{entry.actor_name} </Text>
                    <Text>{entry.action}</Text>
                  </Text>
                  <View style={styles.timeRow}>
                    <Feather name="clock" size={11} color="#94a3b8" />
                    <Text style={styles.logTime}>{formatTime(entry.timestamp)}</Text>
                  </View>
                </View>
              </View>
            ))
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { flex: 1, paddingHorizontal: 20, paddingTop: 30 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  pageTitle: { fontSize: 24, fontWeight: '800', color: '#0f172a', letterSpacing: -0.5 },
  pageSubtitle: { fontSize: 12, color: '#64748b', marginTop: 2 },
  listCard: {
    borderWidth: 1, borderColor: '#f1f5f9', borderRadius: 16, overflow: 'hidden', marginBottom: 20,
  },
  listHeader: {
    padding: 14, backgroundColor: '#f8fafc',
    borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
  },
  listHeaderTitle: { fontSize: 13, fontWeight: '700', color: '#475569' },
  emptyState: { alignItems: 'center', paddingVertical: 50, gap: 10 },
  emptyText: { color: '#94a3b8', fontSize: 14, fontWeight: '600' },
  emptySubText: { color: '#cbd5e1', fontSize: 12, textAlign: 'center', paddingHorizontal: 30 },
  logRow: {
    flexDirection: 'row', alignItems: 'flex-start', padding: 14,
    borderBottomWidth: 1, borderBottomColor: '#f8fafc', gap: 12,
  },
  avatarCircle: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0',
    alignItems: 'center', justifyContent: 'center', marginTop: 2,
  },
  logContent: { flex: 1 },
  logAction: { fontSize: 13, color: '#334155', lineHeight: 19 },
  actorName: { fontWeight: '700', color: '#0ea5e9' },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  logTime: { fontSize: 11, color: '#94a3b8' },
});
