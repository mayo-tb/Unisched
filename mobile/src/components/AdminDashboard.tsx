import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, ActivityIndicator, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import TopHeader from './TopHeader';
import { api } from '../lib/api';

export default function AdminDashboard() {
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [metrics, setMetrics] = useState({
    coursesCount: 0,
    groupsCount: 0,
    lecturersCount: 0,
    roomsCount: 0,
    executionTime: 0,
    fitness: 0,
    hardViolations: 0,
    engineLoad: 'Stable'
  });
  const [runHistory, setRunHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [optimizing, setOptimizing] = useState(false);
  const [pollStatus, setPollStatus] = useState('');

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      // 1. Get Workspace Data
      let currentWsId = workspaceId;
      if (!currentWsId) {
        const wsData = await AsyncStorage.getItem('gc_workspace');
        if (wsData) {
          currentWsId = JSON.parse(wsData).id;
          setWorkspaceId(currentWsId);
        } else {
          const wsRes = await api.get('/api/workspaces/');
          const workspaces = wsRes.data.results || wsRes.data || [];
          if (workspaces && workspaces.length > 0) {
            currentWsId = workspaces[0].id;
            setWorkspaceId(currentWsId);
            await AsyncStorage.setItem('gc_workspace', JSON.stringify({ id: currentWsId }));
          }
        }
      }

      if (currentWsId) {
        // Find workspace to get basic counts
        const wsRes = await api.get('/api/workspaces/');
        const ws = (wsRes.data.results || wsRes.data || []).find((w: any) => w.id === currentWsId);

        // 2. Get Timetable Versions
        const verRes = await api.get('/api/timetable/versions/');
        const versions = verRes.data.results || verRes.data || [];
        // Filter versions for this workspace
        const wsVersions = versions.filter((v: any) => v.workspace === currentWsId)
          .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        setRunHistory(wsVersions);

        // Update metrics
        const latest = wsVersions.length > 0 ? wsVersions[0] : null;
        setMetrics({
          coursesCount: ws ? ws.courses_count : 0,
          groupsCount: ws ? ws.groups_count : 0,
          lecturersCount: ws ? ws.lecturers_count : 0,
          roomsCount: ws ? ws.rooms_count : 0,
          executionTime: latest ? latest.execution_time : 0,
          fitness: latest ? latest.fitness : 0,
          hardViolations: latest ? latest.hard_violations : 0,
          engineLoad: 'Stable'
        });
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const executeOptimization = async () => {
    if (!workspaceId) {
      showAlert('Error', 'No active workspace found. Please add resources first.');
      return;
    }

    setOptimizing(true);
    setPollStatus('Initializing Engine...');

    try {
      const res = await api.post(`/api/workspaces/${workspaceId}/generate/`, {});
      const taskId = res.data.task_id;

      // Start polling
      pollTask(taskId);
    } catch (err: any) {
      console.error('Failed to start optimization:', err);

      let errorMsg = 'Failed to start optimization.';
      if (err.response?.status === 429) {
        errorMsg = 'Rate limit exceeded. Please wait a moment before trying again.';
      } else if (err.response?.data?.error) {
        errorMsg = err.response.data.error;
      }

      showAlert('Error', errorMsg);
      setOptimizing(false);
      setPollStatus('');
    }
  };

  const pollTask = async (taskId: string) => {
    try {
      const res = await api.get(`/api/workspaces/status/${taskId}/`);
      const { state, progress, fitness, generation } = res.data;

      if (state === 'COMPLETED') {
        setPollStatus('Complete');
        setOptimizing(false);
        // Refresh data to show new metrics and history
        loadDashboardData();
        setTimeout(() => setPollStatus(''), 3000);
      } else if (state === 'FAILED') {
        setOptimizing(false);
        showAlert('Optimization Failed', res.data.error || 'An unknown error occurred.');
        setPollStatus('Failed');
        setTimeout(() => setPollStatus(''), 3000);
      } else {
        // STILL RUNNING OR PENDING
        setPollStatus(`Evolving Gen ${generation} (${progress}%)...`);
        setTimeout(() => pollTask(taskId), 2000); // Poll every 2 seconds
      }
    } catch (err: any) {
      console.error('Error polling task:', err);
      // Wait a bit longer and try again instead of giving up entirely on generic network blips

      // If we got a 429 while polling, back off heavily
      if (err.response?.status === 429) {
        setTimeout(() => pollTask(taskId), 10000);
      } else {
        setTimeout(() => pollTask(taskId), 5000);
      }
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

  const formatDate = (dateString: string) => {
    const d = new Date(dateString);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (loading && !runHistory.length) {
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
            <Text style={styles.pageTitle}>Intelligence Hub</Text>
            <Text style={styles.pageSubtitle}>Real-time scheduling performance and version control.</Text>
          </View>
          <TouchableOpacity
            style={[styles.executeBtn, optimizing && styles.executeBtnDisabled]}
            onPress={executeOptimization}
            disabled={optimizing}
          >
            {optimizing ? (
              <ActivityIndicator color="#fff" size="small" style={{ marginRight: 8 }} />
            ) : (
              <Feather name="zap" size={18} color="#fff" style={{ marginRight: 8 }} />
            )}
            <Text style={styles.executeBtnText}>
              {optimizing ? pollStatus : 'Execute Optimization'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.dashboardGrid}>
          {/* Left Column: Metrics & Summary */}
          <View style={styles.leftCol}>

            {/* Main Metrics Card */}
            <View style={styles.metricsCard}>
              <View style={styles.metricsHeaderRow}>
                <Feather name="activity" size={20} color="#38bdf8" />
                <Text style={styles.metricsTitle}>COMPUTATIONAL METRICS</Text>
              </View>

              <View style={styles.metricsDataRow}>
                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>EXEC. TIME</Text>
                  <View style={styles.metricValueRow}>
                    <Feather name="clock" size={14} color="#94a3b8" />
                    <Text style={styles.metricValue}>{Math.round(metrics.executionTime)} <Text style={styles.metricMs}>ms</Text></Text>
                  </View>
                </View>

                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>FITNESS</Text>
                  <Text style={[styles.metricValue, { color: '#34d399' }]}>{metrics.fitness.toFixed(4)}</Text>
                </View>

                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>HARD VIOLATIONS</Text>
                  <Text style={[styles.metricValue, metrics.hardViolations > 0 && { color: '#ef4444' }]}>
                    {metrics.hardViolations}
                  </Text>
                </View>

                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>ENGINE LOAD</Text>
                  <Text style={[styles.metricValue, { color: '#38bdf8' }]}>{metrics.engineLoad}</Text>
                </View>
              </View>
            </View>

            {/* Sub Summary Cards */}
            <View style={styles.subCardsRow}>
              <View style={[styles.subCard, { width: '48%' }]}>
                <View style={[styles.subCardIconWrapper, { backgroundColor: '#eff6ff', width: 48, height: 48 }]}>
                  <Feather name="book-open" size={20} color="#3b82f6" />
                </View>
                <View>
                  <Text style={styles.subCardValue}>{metrics.coursesCount}</Text>
                  <Text style={styles.subCardLabel}>COURSES</Text>
                </View>
              </View>

              <View style={[styles.subCard, { width: '48%' }]}>
                <View style={[styles.subCardIconWrapper, { backgroundColor: '#ecfdf5', width: 48, height: 48 }]}>
                  <Feather name="users" size={20} color="#10b981" />
                </View>
                <View>
                  <Text style={styles.subCardValue}>{metrics.lecturersCount}</Text>
                  <Text style={styles.subCardLabel}>LECTURERS</Text>
                </View>
              </View>
            </View>

            <View style={[styles.subCardsRow, { marginTop: 20 }]}>
              <View style={[styles.subCard, { width: '48%' }]}>
                <View style={[styles.subCardIconWrapper, { backgroundColor: '#fef3c7', width: 48, height: 48 }]}>
                  <Feather name="map-pin" size={20} color="#d97706" />
                </View>
                <View>
                  <Text style={styles.subCardValue}>{metrics.roomsCount}</Text>
                  <Text style={styles.subCardLabel}>ROOMS</Text>
                </View>
              </View>

              <View style={[styles.subCard, { width: '48%' }]}>
                <View style={[styles.subCardIconWrapper, { backgroundColor: '#f3e8ff', width: 48, height: 48 }]}>
                  <Feather name="users" size={20} color="#9333ea" />
                </View>
                <View>
                  <Text style={styles.subCardValue}>{metrics.groupsCount}</Text>
                  <Text style={styles.subCardLabel}>GROUPS</Text>
                </View>
              </View>
            </View>

          </View>

          {/* Right Column: Run History */}
          <View style={styles.rightCol}>
            <View style={styles.historyCard}>
              <View style={styles.historyHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Feather name="rotate-ccw" size={18} color="#0f172a" />
                  <Text style={styles.historyTitle}>Run History</Text>
                </View>
                <View style={styles.badgeSolid}>
                  <Text style={styles.badgeSolidText}>CACHED</Text>
                </View>
              </View>

              {runHistory.length === 0 ? (
                <View style={styles.emptyHistory}>
                  <Feather name="zap-off" size={32} color="#e2e8f0" />
                  <Text style={styles.emptyHistoryText}>NO ENGINE RUNS{'\n'}RECORDED YET</Text>
                </View>
              ) : (
                <View style={styles.historyList}>
                  {runHistory.map((run, index) => (
                    <View key={run.id} style={styles.historyItem}>
                      <View style={styles.historyItemLeft}>
                        {index === 0 && <View style={styles.activeDot} />}
                        <View>
                          <Text style={styles.runName}>Version {run.id.substring(0, 6)}</Text>
                          <Text style={styles.runDate}>{formatDate(run.created_at)}</Text>
                        </View>
                      </View>
                      <Text style={[styles.runFitness, { color: '#34d399' }]}>{run.fitness.toFixed(4)}</Text>
                    </View>
                  ))}
                </View>
              )}

            </View>
          </View>
        </View>
      </ScrollView>
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
    paddingHorizontal: 30,
    paddingTop: 40,
  },
  topSectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 40,
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
  executeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0ea5e9', // lighter blue as per screenshot
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    shadowColor: '#0ea5e9',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 4,
  },
  executeBtnDisabled: {
    backgroundColor: '#94a3b8',
    shadowOpacity: 0,
    elevation: 0,
  },
  executeBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  dashboardGrid: {
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
    gap: 30,
    paddingBottom: 40,
  },
  leftCol: {
    flex: 2,
    gap: 20,
  },
  rightCol: {
    flex: 1,
  },
  metricsCard: {
    backgroundColor: '#0f172a',
    borderRadius: 24,
    padding: 30,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 30,
    elevation: 10,
  },
  metricsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 40,
  },
  metricsTitle: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  metricsDataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 20,
  },
  metricItem: {
    gap: 8,
  },
  metricLabel: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  metricValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metricValue: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
  },
  metricMs: {
    fontSize: 16,
    color: '#94a3b8',
    fontWeight: '600',
  },
  subCardsRow: {
    flexDirection: 'row',
    gap: 20,
  },
  subCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 2,
  },
  subCardIconWrapper: {
    width: 60,
    height: 60,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  subCardValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 4,
  },
  subCardLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 1,
  },
  historyCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 30,
    flex: 1,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 2,
    minHeight: 300,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 30,
  },
  historyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  badgeSolid: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeSolidText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.5,
  },
  emptyHistory: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    opacity: 0.8,
  },
  emptyHistoryText: {
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 0.5,
    lineHeight: 22,
  },
  historyList: {
    gap: 20,
  },
  historyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
    paddingBottom: 16,
  },
  historyItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#34d399',
  },
  runName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 2,
  },
  runDate: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '500',
  },
  runFitness: {
    fontSize: 16,
    fontWeight: '800',
  }
});
