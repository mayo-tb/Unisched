import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  SafeAreaView, ActivityIndicator, Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import TopHeader from './TopHeader';
import { api, auditLogApi, type AuditLogEntry } from '../lib/api';

export default function AdminDashboard() {
  const navigation = useNavigation<any>();
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [workspaceName, setWorkspaceName] = useState<string | null>(null);
  const [metrics, setMetrics] = useState({
    coursesCount: 0, groupsCount: 0, lecturersCount: 0, roomsCount: 0,
    executionTime: 0, fitness: 0, hardViolations: 0, engineLoad: 'Stable'
  });
  const [runHistory, setRunHistory] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [optimizing, setOptimizing] = useState(false);
  const [pollStatus, setPollStatus] = useState('');
  const [showGA, setShowGA] = useState(false);

  useEffect(() => { loadDashboardData(); }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      let currentWsId = workspaceId;
      let currentWsName = workspaceName;
      if (!currentWsId) {
        const wsData = await AsyncStorage.getItem('gc_workspace');
        if (wsData) {
          const parsed = JSON.parse(wsData);
          currentWsId = parsed.id;
          currentWsName = parsed.name || null;
          setWorkspaceId(currentWsId);
        } else {
          const wsRes = await api.get('/api/workspaces/');
          const workspaces = wsRes.data.results || wsRes.data || [];
          if (workspaces.length > 0) {
            currentWsId = workspaces[0].id;
            currentWsName = workspaces[0].name;
            setWorkspaceId(currentWsId);
            setWorkspaceName(currentWsName);
            await AsyncStorage.setItem('gc_workspace', JSON.stringify({ id: currentWsId, name: currentWsName }));
          }
        }
        if (currentWsName) setWorkspaceName(currentWsName);
      }

      if (currentWsId) {
        const wsRes = await api.get('/api/workspaces/');
        const ws = (wsRes.data.results || wsRes.data || []).find((w: any) => w.id === currentWsId);

        const verRes = await api.get('/api/timetable/versions/');
        const versions = verRes.data.results || verRes.data || [];
        const wsVersions = versions
          .filter((v: any) => v.workspace === currentWsId)
          .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setRunHistory(wsVersions);

        const latest = wsVersions.length > 0 ? wsVersions[0] : null;
        setMetrics({
          coursesCount: ws?.courses_count ?? 0,
          groupsCount: ws?.groups_count ?? 0,
          lecturersCount: ws?.lecturers_count ?? 0,
          roomsCount: ws?.rooms_count ?? 0,
          executionTime: latest?.execution_time ?? 0,
          fitness: latest?.fitness ?? 0,
          hardViolations: latest?.hard_violations ?? 0,
          engineLoad: 'Stable',
        });
        if (ws?.name) setWorkspaceName(ws.name);

        // Load recent audit log
        try {
          const logRes = await auditLogApi.list(currentWsId);
          setAuditLogs((logRes.data as AuditLogEntry[]).slice(0, 6));
        } catch { /* non-fatal: user might not be admin */ }
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const executeOptimization = async () => {
    if (!workspaceId) { showAlert('Error', 'No active workspace found.'); return; }
    setOptimizing(true); setPollStatus('Initializing Engine...');
    try {
      const res = await api.post(`/api/workspaces/${workspaceId}/generate/`, {});
      pollTask(res.data.task_id);
    } catch (err: any) {
      let msg = err.response?.status === 429
        ? 'Rate limit exceeded. Please wait before trying again.'
        : err.response?.data?.error || 'Failed to start optimization.';
      showAlert('Error', msg);
      setOptimizing(false); setPollStatus('');
    }
  };

  const pollTask = async (taskId: string) => {
    try {
      const res = await api.get(`/api/workspaces/status/${taskId}/`);
      const { state, progress, generation } = res.data;
      if (state === 'COMPLETED') {
        setPollStatus('Complete'); setOptimizing(false);
        loadDashboardData();
        setTimeout(() => setPollStatus(''), 3000);
      } else if (state === 'FAILED') {
        setOptimizing(false);
        showAlert('Optimization Failed', res.data.error || 'Unknown error.');
        setPollStatus('Failed');
        setTimeout(() => setPollStatus(''), 3000);
      } else {
        setPollStatus(`Evolving Gen ${generation} (${progress}%)...`);
        setTimeout(() => pollTask(taskId), 2000);
      }
    } catch (err: any) {
      const delay = err.response?.status === 429 ? 10000 : 5000;
      setTimeout(() => pollTask(taskId), delay);
    }
  };

  const showAlert = (title: string, msg: string) => {
    if (Platform.OS === 'web') window.alert(`${title}\n\n${msg}`);
    else Alert.alert(title, msg);
  };

  const formatTime = (ts: string) =>
    new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  const { Alert } = require('react-native');

  if (loading && !runHistory.length) {
    return (
      <SafeAreaView style={styles.container}>
        <TopHeader />
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color="#0ea5e9" />
        </View>
      </SafeAreaView>
    );
  }

  const quickLinks = [
    { label: 'Manage Resources', icon: 'book-open', color: '#eff6ff', iconColor: '#3b82f6', nav: 'Resources' },
    { label: 'Timetable Officers', icon: 'users', color: '#f3e8ff', iconColor: '#9333ea', nav: 'Officers' },
    { label: 'Feedback',          icon: 'message-square', color: '#fff1f2', iconColor: '#f43f5e', nav: 'Complaints' },
    { label: 'Audit Log',         icon: 'list', color: '#ecfdf5', iconColor: '#10b981', nav: 'AuditLog' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <TopHeader />
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>

        {/* Page Title */}
        <Text style={styles.pageTitle}>Command Hub</Text>
        <Text style={styles.pageSubtitle}>Central hub for your academic scheduling system.</Text>

        {/* ── Active Session Banner ────────────────────── */}
        <View style={styles.sessionBanner}>
          <View style={styles.sessionIconWrap}>
            <Feather name="layers" size={18} color="#0ea5e9" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.sessionLabel}>ACTIVE ACADEMIC MANAGEMENT SESSION</Text>
            <Text style={styles.sessionName}>{workspaceName ?? 'No session selected'}</Text>
          </View>
          <View style={styles.sessionActiveDot} />
        </View>

        {/* ── Quick Links ──────────────────────────────── */}
        <Text style={styles.sectionHeading}>Quick Links</Text>
        <View style={styles.quickLinksGrid}>
          {quickLinks.map(link => (
            <TouchableOpacity
              key={link.label}
              style={[styles.quickCard, { backgroundColor: link.color }]}
              onPress={() => navigation.navigate(link.nav)}
              activeOpacity={0.75}
            >
              <View style={[styles.quickIconWrap, { backgroundColor: link.iconColor + '22' }]}>
                <Feather name={link.icon as any} size={20} color={link.iconColor} />
              </View>
              <Text style={styles.quickLabel}>{link.label}</Text>
              <Feather name="arrow-right" size={14} color="#94a3b8" style={{ marginTop: 8 }} />
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Resource Counts ──────────────────────────── */}
        <Text style={styles.sectionHeading}>Resources Overview</Text>
        <View style={styles.countRow}>
          {[
            { label: 'COURSES',   val: metrics.coursesCount,   color: '#3b82f6' },
            { label: 'LECTURERS', val: metrics.lecturersCount, color: '#10b981' },
            { label: 'ROOMS',     val: metrics.roomsCount,     color: '#f59e0b' },
            { label: 'GROUPS',    val: metrics.groupsCount,    color: '#9333ea' },
          ].map(m => (
            <View key={m.label} style={styles.countCard}>
              <Text style={[styles.countValue, { color: m.color }]}>{m.val}</Text>
              <Text style={styles.countLabel}>{m.label}</Text>
            </View>
          ))}
        </View>

        {/* ── GA Engine (Collapsible) ───────────────────── */}
        <TouchableOpacity style={styles.gaSectionHeader} onPress={() => setShowGA(!showGA)}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Feather name="zap" size={16} color="#f59e0b" />
            <Text style={styles.sectionHeadingInline}>GA Engine</Text>
          </View>
          <Feather name={showGA ? 'chevron-up' : 'chevron-down'} size={18} color="#94a3b8" />
        </TouchableOpacity>

        {showGA && (
          <View style={styles.gaPanel}>
            <View style={styles.gaMetricRow}>
              {[
                { l: 'FITNESS',    v: metrics.fitness.toFixed(4) },
                { l: 'EXEC TIME',  v: `${Math.round(metrics.executionTime)}ms` },
                { l: 'VIOLATIONS', v: String(metrics.hardViolations) },
                { l: 'STATUS',     v: metrics.engineLoad },
              ].map(m => (
                <View key={m.l} style={styles.gaMetric}>
                  <Text style={styles.gaMetricLabel}>{m.l}</Text>
                  <Text style={styles.gaMetricValue}>{m.v}</Text>
                </View>
              ))}
            </View>
            <TouchableOpacity
              style={[styles.executeBtn, optimizing && styles.executeBtnDisabled]}
              onPress={executeOptimization}
              disabled={optimizing}
            >
              {optimizing
                ? <ActivityIndicator color="#fff" size="small" style={{ marginRight: 8 }} />
                : <Feather name="play" size={16} color="#fff" style={{ marginRight: 8 }} />}
              <Text style={styles.executeBtnText}>{optimizing ? pollStatus : 'Execute Optimization'}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Recent Activity ───────────────────────────── */}
        <Text style={styles.sectionHeading}>Recent Activity</Text>
        <View style={styles.activityCard}>
          {auditLogs.length === 0 ? (
            <View style={styles.emptyActivity}>
              <Feather name="clock" size={24} color="#e2e8f0" />
              <Text style={styles.emptyActivityText}>No activity recorded yet.</Text>
            </View>
          ) : (
            auditLogs.map((entry, i) => (
              <View key={entry.id} style={[styles.activityRow, i === auditLogs.length - 1 && { borderBottomWidth: 0 }]}>
                <View style={styles.activityDot} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.activityText} numberOfLines={1}>
                    <Text style={styles.actorName}>{entry.actor_name}</Text>
                    {' — '}{entry.action}
                  </Text>
                  <Text style={styles.activityTime}>{formatTime(entry.timestamp)}</Text>
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
  centerLoading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { flex: 1, paddingHorizontal: 20, paddingTop: 24 },

  pageTitle: { fontSize: 26, fontWeight: '800', color: '#0f172a', letterSpacing: -0.5 },
  pageSubtitle: { fontSize: 13, color: '#64748b', marginTop: 2, marginBottom: 20 },

  // Session Banner
  sessionBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#f0f9ff', borderColor: '#bae6fd', borderWidth: 1,
    borderRadius: 14, padding: 16, marginBottom: 24,
  },
  sessionIconWrap: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: '#e0f2fe', alignItems: 'center', justifyContent: 'center',
  },
  sessionLabel: { fontSize: 9, fontWeight: '800', color: '#0284c7', letterSpacing: 1, marginBottom: 2 },
  sessionName: { fontSize: 16, fontWeight: '800', color: '#0f172a' },
  sessionActiveDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#10b981' },

  // Section Headings
  sectionHeading: { fontSize: 11, fontWeight: '800', color: '#94a3b8', letterSpacing: 1, marginBottom: 12, textTransform: 'uppercase' },
  sectionHeadingInline: { fontSize: 14, fontWeight: '700', color: '#0f172a' },

  // Quick Links
  quickLinksGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 28 },
  quickCard: {
    width: '47%', borderRadius: 14, padding: 16,
    shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 2 }, shadowRadius: 6, elevation: 2,
  },
  quickIconWrap: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  quickLabel: { fontSize: 13, fontWeight: '700', color: '#0f172a' },

  // Resource Counts
  countRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  countCard: {
    flex: 1, backgroundColor: '#f8fafc', borderRadius: 12, padding: 14,
    alignItems: 'center', borderWidth: 1, borderColor: '#f1f5f9',
  },
  countValue: { fontSize: 22, fontWeight: '800' },
  countLabel: { fontSize: 9, fontWeight: '800', color: '#94a3b8', letterSpacing: 0.5, marginTop: 2 },

  // GA Engine
  gaSectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 14, borderTopWidth: 1, borderTopColor: '#f1f5f9', marginBottom: 0,
  },
  gaPanel: {
    backgroundColor: '#0f172a', borderRadius: 16, padding: 20, marginBottom: 24,
  },
  gaMetricRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  gaMetric: { alignItems: 'center' },
  gaMetricLabel: { fontSize: 9, fontWeight: '800', color: '#64748b', letterSpacing: 0.5 },
  gaMetricValue: { fontSize: 18, fontWeight: '800', color: '#fff', marginTop: 4 },
  executeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#0ea5e9', borderRadius: 12, paddingVertical: 14,
  },
  executeBtnDisabled: { backgroundColor: '#64748b' },
  executeBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  // Recent Activity
  activityCard: {
    borderWidth: 1, borderColor: '#f1f5f9', borderRadius: 14, overflow: 'hidden', marginBottom: 20,
  },
  emptyActivity: { alignItems: 'center', paddingVertical: 30, gap: 8 },
  emptyActivityText: { color: '#94a3b8', fontSize: 13 },
  activityRow: {
    flexDirection: 'row', alignItems: 'flex-start', padding: 14,
    borderBottomWidth: 1, borderBottomColor: '#f8fafc', gap: 12,
  },
  activityDot: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: '#0ea5e9', marginTop: 5,
  },
  activityText: { fontSize: 13, color: '#334155', lineHeight: 18 },
  actorName: { fontWeight: '700', color: '#0ea5e9' },
  activityTime: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
});
