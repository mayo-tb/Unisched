/**
 * Genetics Cloud — Mobile Student Schedule View
 * React Native + Expo component for weekly timetable display with interactive Grid layout.
 */

import React, { useState, useEffect } from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Platform,
  Dimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Feather } from '@expo/vector-icons';
import { api } from '../lib/api';

const { width } = Dimensions.get('window');

// CSS Grid Timetable Settings
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const HOURS = Array.from({ length: 11 }, (_, i) => i + 8); // 8 AM to 6 PM
const HOUR_HEIGHT = 80;

interface WeeklyScheduleViewProps {
  onLogout?: () => void;
}

const getCourseColors = (courseCode: string) => {
  const palettes = [
    { bg: '#EFF6FF', border: '#3B82F6', text: '#1E3A8A' }, // Blue
    { bg: '#F0FDF4', border: '#22C55E', text: '#14532D' }, // Green
    { bg: '#FEF2F2', border: '#EF4444', text: '#7F1D1D' }, // Red
    { bg: '#FFFBEB', border: '#F59E0B', text: '#78350F' }, // Yellow
    { bg: '#FAF5FF', border: '#A855F7', text: '#4C1D95' }, // Purple
    { bg: '#FDF4FF', border: '#D946EF', text: '#701A75' }, // Fuchsia
  ];
  const charSum = courseCode.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return palettes[charSum % palettes.length];
};

export const WeeklyScheduleView: React.FC<WeeklyScheduleViewProps> = ({
  onLogout,
}) => {
  const [scheduleData, setScheduleData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [optimizing, setOptimizing] = useState(false);
  const [pollStatus, setPollStatus] = useState('');
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [hoveredEntry, setHoveredEntry] = useState<any | null>(null);

  // Fetch schedule from API
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

      // Pass workspace_id to tell backend which one Admin is previewing
      const url = currentWsId ? `/api/student/schedule/?workspace_id=${currentWsId}` : '/api/student/schedule/';
      const response = await api.get(url);
      setScheduleData(response.data);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load schedule. Try running Optimization first.');
      setScheduleData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedule();
  }, []);

  const showAlert = (title: string, msg: string) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n\n${msg}`);
    } else {
      Alert.alert(title, msg);
    }
  };

  const executeOptimization = async () => {
    if (!workspaceId) {
      showAlert('Error', 'No active workspace. Please add a workspace first.');
      return;
    }

    setOptimizing(true);
    setPollStatus('Initializing Engine...');

    try {
      const res = await api.post(`/api/workspaces/${workspaceId}/generate/`, {});
      const taskId = res.data.task_id;
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
      const { state, progress } = res.data;

      if (state === 'COMPLETED') {
        setPollStatus('Complete');
        setOptimizing(false);
        showAlert('Optimization Complete 🎉', 'Your new timetable has been successfully generated and is now displayed on your schedule.');
        fetchSchedule(); // Refresh timetable immediately
        setTimeout(() => setPollStatus(''), 3000);
      } else if (state === 'FAILED') {
        setOptimizing(false);
        showAlert('Optimization Failed', res.data.error || 'Check engine logs.');
        setPollStatus('Failed');
        setTimeout(() => setPollStatus(''), 3000);
      } else {
        setPollStatus(`Evolving (${progress}%)...`);
        setTimeout(() => pollTask(taskId), 2000);
      }
    } catch (err: any) {
      if (err.response?.status === 429) {
        setTimeout(() => pollTask(taskId), 10000);
      } else {
        setTimeout(() => pollTask(taskId), 5000);
      }
    }
  };

  const handleExportCSV = async () => {
    if (!workspaceId) return showAlert('Error', 'No active workspace to export.');
    try {
      if (Platform.OS === 'web') {
        const res = await api.get(`/api/workspaces/${workspaceId}/export_csv/`, { responseType: 'blob' });
        const url = window.URL.createObjectURL(new Blob([res.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'timetable.csv');
        document.body.appendChild(link);
        link.click();
        link.remove();
      } else {
        const res = await api.get(`/api/workspaces/${workspaceId}/export_csv/`, { responseType: 'text' });
        const fileUri = `${FileSystem.documentDirectory}timetable.csv`;
        await FileSystem.writeAsStringAsync(fileUri, res.data, { encoding: FileSystem.EncodingType.UTF8 });

        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri, { mimeType: 'text/csv', dialogTitle: 'Download Timetable CSV' });
        } else {
          showAlert('Export Failed', 'Sharing is not available on this device.');
        }
      }
    } catch (err: any) {
      console.error(err);
      showAlert('Export Failed', 'Unable to download CSV.');
    }
  };

  const handleExportExcel = async () => {
    if (!workspaceId) return showAlert('Error', 'No active workspace to export.');
    try {
      if (Platform.OS === 'web') {
        const res = await api.get(`/api/workspaces/${workspaceId}/export_excel/`, { responseType: 'blob' });
        const url = window.URL.createObjectURL(new Blob([res.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'timetable.xlsx');
        document.body.appendChild(link);
        link.click();
        link.remove();
      } else {
        const token = await AsyncStorage.getItem('accessToken');
        const baseUrl = api.defaults.baseURL || 'http://localhost:8000';
        const url = `${baseUrl}/api/workspaces/${workspaceId}/export_excel/`;
        const fileUri = `${FileSystem.documentDirectory}timetable.xlsx`;

        await FileSystem.downloadAsync(url, fileUri, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri, { mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', dialogTitle: 'Download Timetable Excel' });
        } else {
          showAlert('Export Failed', 'Sharing is not available on this device.');
        }
      }
    } catch (err: any) {
      console.error(err);
      showAlert('Export Failed', 'Unable to download Excel.');
    }
  };


  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#0EA5E9" />
        <Text style={styles.loadingText}>Loading schedule...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.buttonEngine} onPress={executeOptimization} disabled={optimizing}>
          {optimizing ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.buttonText}>🧠 Run Engine</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={[styles.buttonEngine, { backgroundColor: '#f1f5f9', marginTop: 12 }]} onPress={() => fetchSchedule()}>
          <Text style={[styles.buttonText, { color: '#0f172a' }]}>Refresh View</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!scheduleData) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyText}>No schedule available</Text>
      </View>
    );
  }

  const { student_name, group_name, entries, class_count, fitness_score } = scheduleData;

  const renderGridEntry = (entry: any, index: number) => {
    const startHour = parseInt(entry.start_time.split(':')[0], 10);
    const startMin = parseInt(entry.start_time.split(':')[1], 10);
    const endHour = parseInt(entry.end_time.split(':')[0], 10);

    // Safety bounds (only render between 8 AM and 6 PM loosely)
    if (startHour < 8 || startHour > 18) return null;

    const topOffset = ((startHour - 8) + (startMin / 60)) * HOUR_HEIGHT;
    const height = entry.duration_hours * HOUR_HEIGHT;
    const colors = getCourseColors(entry.course_code);

    return (
      <View
        key={`entry-${entry.id || index}`}
        // @ts-ignore - Web interactive hover
        onMouseEnter={() => Platform.OS === 'web' && setHoveredEntry(entry)}
        onMouseLeave={() => Platform.OS === 'web' && setHoveredEntry(null)}
        style={[styles.courseBlockWrapper, { top: topOffset, height: height }]}
      >
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setHoveredEntry(hoveredEntry?.id === entry.id ? null : entry)}
          style={[styles.courseBlock, { backgroundColor: colors.bg, borderLeftColor: colors.border }]}
        >
          <Text style={[styles.courseBlockCode, { color: colors.text }]} numberOfLines={1}>{entry.course_code}</Text>
          <Text style={[styles.courseBlockName, { color: colors.text }]} numberOfLines={2}>{entry.course_name}</Text>
          <Text style={[styles.courseBlockRoom, { color: colors.text }]} numberOfLines={1}>📍 {entry.room_name}</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header Panel */}
      <View style={styles.headerPanel}>
        <View style={styles.headerLeft}>
          <Text style={styles.studentName}>{student_name}</Text>
          <Text style={styles.groupName}>{group_name}</Text>
          <Text style={styles.statsLabel}>Classes: {class_count} | Auto-Fitness: {(fitness_score * 100).toFixed(0)}%</Text>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.exportCSVButton} onPress={handleExportCSV}>
            <Text style={styles.exportButtonText}>📥 CSV</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.exportExcelButton} onPress={handleExportExcel}>
            <Text style={styles.exportButtonText}>📊 Excel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.buttonEngine} onPress={executeOptimization} disabled={optimizing}>
            {optimizing ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.buttonText}>🧠 Run Engine</Text>}
          </TouchableOpacity>
        </View>
      </View>

      {/* Grid Timetable Container */}
      <ScrollView style={styles.gridScrollWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={true} contentContainerStyle={styles.gridHorizontalContainer}>
          <View style={styles.gridBoard}>

            {/* Top Fixed Header Rows */}
            <View style={styles.gridHeaderRow}>
              <View style={styles.timeAxisHeader}>
                <Text style={styles.timeAxisHeaderText}>HOUR</Text>
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
                const dayEntries = entries?.filter((e: any) => e.day === dayIndex) || [];
                return (
                  <View key={day} style={styles.dayColumn}>
                    {/* Render empty state discrete boxes for each hour */}
                    {HOURS.slice(0, -1).map(hour => (
                      <View key={`empty-${hour}`} style={[styles.emptyCellState, { height: HOUR_HEIGHT }]} />
                    ))}
                    {/* Render absolute-placed blocks over the empty boxes */}
                    {dayEntries.map(renderGridEntry)}
                  </View>
                );
              })}
            </View>

          </View>
        </ScrollView>
      </ScrollView>

      {/* Floating Hover Tooltip Summary 'Quick Look' */}
      {hoveredEntry && (
        <View style={styles.tooltipOverlay}>
          <View style={styles.tooltipCard}>
            <View style={styles.tooltipHeader}>
              <Text style={styles.tooltipCode}>{hoveredEntry.course_code}</Text>
              <TouchableOpacity onPress={() => setHoveredEntry(null)}>
                <Feather name="x" size={20} color="#94A3B8" />
              </TouchableOpacity>
            </View>
            <Text style={styles.tooltipName}>{hoveredEntry.course_name}</Text>
            <View style={styles.tooltipDivider} />
            <Text style={styles.tooltipDetail}>👨‍🏫 {hoveredEntry.lecturer_name}</Text>
            <Text style={styles.tooltipDetail}>📍 {hoveredEntry.room_name} (Capacity: {hoveredEntry.room_capacity})</Text>
            <Text style={styles.tooltipDetail}>🕒 {hoveredEntry.start_time.slice(0, 5)} - {hoveredEntry.end_time.slice(0, 5)}</Text>
          </View>
        </View>
      )}
    </View>
  );
};

// ═════════════════════════════════════════════════════════════
// STYLES
// ═════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC', // Sleek background color
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748B',
  },
  errorText: {
    fontSize: 16,
    color: '#EF4444',
    marginBottom: 16,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#94A3B8',
  },

  // Header Info
  headerPanel: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    flexWrap: 'wrap',
    gap: 12,
  },
  headerLeft: {
    flex: 1,
    minWidth: 200,
  },
  studentName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
  },
  groupName: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '600',
  },
  statsLabel: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 6,
  },

  headerActions: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  exportCSVButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    borderRadius: 8,
  },
  exportExcelButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
    borderWidth: 1,
    borderRadius: 8,
  },
  exportButtonText: {
    color: '#334155',
    fontWeight: '600',
    fontSize: 14,
  },
  buttonEngine: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#0EA5E9',
    borderRadius: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },

  // Grid Layout
  gridScrollWrapper: {
    flex: 1,
    paddingHorizontal: 10,
    paddingTop: 10,
  },
  gridHorizontalContainer: {
    minWidth: Math.max(800, width - 20),
    paddingBottom: 40,
  },
  gridBoard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 3,
  },
  gridHeaderRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  timeAxisHeader: {
    width: 70,
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingLeft: 16,
  },
  timeAxisHeaderText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.5,
  },
  dayHeaderCell: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    borderLeftWidth: 1,
    borderLeftColor: '#F1F5F9',
  },
  dayHeaderText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    letterSpacing: 0.5,
  },

  gridBody: {
    flexDirection: 'row',
    flex: 1,
  },
  timeAxis: {
    width: 70,
    borderRightWidth: 1,
    borderRightColor: '#F1F5F9',
    backgroundColor: '#FFFFFF',
  },
  timeLabelContainer: {
    paddingTop: 10,
    paddingRight: 12,
    alignItems: 'flex-end',
    borderBottomWidth: 1,
    borderBottomColor: 'transparent', // clean borders for time
  },
  timeLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1E293B',
  },

  dayColumn: {
    flex: 1,
    position: 'relative',
    borderLeftWidth: 1,
    borderLeftColor: '#F1F5F9',
  },
  emptyCellState: {
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC', // faint clean grid lines
  },

  courseBlockWrapper: {
    position: 'absolute',
    left: 4,
    right: 4,
    zIndex: 10,
    paddingTop: 2,
    paddingBottom: 2,
  },
  courseBlock: {
    flex: 1,
    borderRadius: 10,
    borderLeftWidth: 4,
    padding: 10,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  courseBlockCode: {
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 2,
  },
  courseBlockName: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 6,
    lineHeight: 14,
  },
  courseBlockRoom: {
    fontSize: 10,
    fontWeight: '500',
    opacity: 0.8,
  },

  // Tooltip
  tooltipOverlay: {
    position: 'absolute',
    bottom: 30, // Hover card pops cleanly at the bottom center
    left: '50%',
    marginLeft: -150, // Half of width (300)
    width: 300,
    zIndex: 1000,
    backgroundColor: 'transparent',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 15,
    elevation: 10,
  },
  tooltipCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    width: '100%',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  tooltipHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  tooltipCode: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0EA5E9',
  },
  tooltipName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 8,
  },
  tooltipDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 8,
  },
  tooltipDetail: {
    fontSize: 13,
    color: '#475569',
    marginBottom: 4,
    fontWeight: '500',
  },
});

export default WeeklyScheduleView;
