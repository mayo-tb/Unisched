import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, SafeAreaView } from 'react-native';
import { Feather } from '@expo/vector-icons';

import TopHeader from './TopHeader';
import CourseView from './views/CourseView';
import ClassGroupView from './views/ClassGroupView';
import FacultyView from './views/FacultyView';
import RoomView from './views/RoomView';
import ConstraintView from './views/ConstraintView';
import ResourceModal from './ResourceModal';

type Tab = 'Courses' | 'Class Groups' | 'Lecturers' | 'Rooms' | 'Schedule' | 'Constraints';
type ResourceType = 'Course' | 'Student Group' | 'Lecturer' | 'Room' | null;

export default function ResourcesView() {
    const [activeTab, setActiveTab] = useState<Tab>('Courses');

    const [modalVisible, setModalVisible] = useState(false);
    const [modalType, setModalType] = useState<ResourceType>(null);

    // We'll pass this down to subviews to trigger a re-fetch when modal finishes successfully
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    // If we are in edit mode, hold the object data
    const [editingResource, setEditingResource] = useState<any>(null);

    const openAddModal = (type: ResourceType) => {
        setModalType(type);
        setEditingResource(null);
        setModalVisible(true);
    };

    const openEditModal = (type: ResourceType, resource: any) => {
        setModalType(type);
        setEditingResource(resource);
        setModalVisible(true);
    };

    const handleSuccess = () => {
        setRefreshTrigger(prev => prev + 1);
    };

    const renderActiveView = () => {
        switch (activeTab) {
            case 'Courses':
                return <CourseView
                    onAdd={() => openAddModal('Course')}
                    onEdit={(course) => openEditModal('Course', course)}
                    refreshTrigger={refreshTrigger}
                />;
            case 'Class Groups':
                return <ClassGroupView
                    onAdd={() => openAddModal('Student Group')}
                    onEdit={(group) => openEditModal('Student Group', group)}
                    refreshTrigger={refreshTrigger}
                />;
            case 'Lecturers':
                return <FacultyView
                    onAdd={() => openAddModal('Lecturer')}
                    onEdit={(lecturer) => openEditModal('Lecturer', lecturer)}
                    refreshTrigger={refreshTrigger}
                />;
            case 'Rooms':
                return <RoomView
                    onAdd={() => openAddModal('Room')}
                    onEdit={(room) => openEditModal('Room', room)}
                    refreshTrigger={refreshTrigger}
                />;
            case 'Constraints':
                return <ConstraintView />;
            case 'Schedule':
                // Next iteration for Schedule rendering
                return <View style={styles.placeholder}><Text>Schedule View Coming Soon</Text></View>;
            default:
                return null;
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <TopHeader />

            {/* Tabs and Search Bar */}
            <View style={styles.toolbar}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll}>
                    <View style={styles.tabContainer}>
                        <TabButton title="Courses" icon="book-open" isActive={activeTab === 'Courses'} onPress={() => setActiveTab('Courses')} />
                        <TabButton title="Class Groups" icon="users" isActive={activeTab === 'Class Groups'} onPress={() => setActiveTab('Class Groups')} />
                        <TabButton title="Lecturers" icon="briefcase" isActive={activeTab === 'Lecturers'} onPress={() => setActiveTab('Lecturers')} />
                        <TabButton title="Rooms" icon="map-pin" isActive={activeTab === 'Rooms'} onPress={() => setActiveTab('Rooms')} />
                        <TabButton title="Schedule" icon="calendar" isActive={activeTab === 'Schedule'} onPress={() => setActiveTab('Schedule')} />
                        <TabButton title="Constraints" icon="shield" isActive={activeTab === 'Constraints'} onPress={() => setActiveTab('Constraints')} />
                    </View>
                </ScrollView>
                <View style={styles.searchContainer}>
                    <Feather name="search" size={18} color="#94a3b8" style={styles.searchIcon} />
                    <TextInput style={styles.searchInput} placeholder="Search records..." placeholderTextColor="#94a3b8" />
                </View>
            </View>

            {/* Content Area */}
            <View style={styles.content}>
                {renderActiveView()}
            </View>

            {modalVisible && modalType && (
                <ResourceModal
                    visible={modalVisible}
                    type={modalType}
                    initialData={editingResource}
                    onClose={() => {
                        setModalVisible(false);
                        setEditingResource(null);
                    }}
                    onSuccess={handleSuccess}
                />
            )}
        </SafeAreaView>
    );
}

// Sub-component for tabs
function TabButton({ title, icon, isActive, onPress }: { title: string, icon: any, isActive: boolean, onPress: () => void }) {
    return (
        <TouchableOpacity style={[styles.tabBtn, isActive && styles.tabBtnActive]} onPress={onPress}>
            <Feather name={icon} size={16} color={isActive ? "#1d4ed8" : "#64748b"} />
            <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{title}</Text>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    toolbar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 30,
        paddingVertical: 20,
        gap: 20,
    },
    tabScroll: {
        flex: 1,
    },
    tabContainer: {
        flexDirection: 'row',
        backgroundColor: '#f1f5f9',
        borderRadius: 12,
        padding: 6,
    },
    tabBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 8,
        gap: 8,
    },
    tabBtnActive: {
        backgroundColor: '#fff',
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2,
    },
    tabText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#64748b',
    },
    tabTextActive: {
        color: '#1d4ed8',
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 12,
        paddingHorizontal: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        minWidth: 250,
    },
    searchIcon: {
        marginRight: 8,
    },
    searchInput: {
        flex: 1,
        height: 44,
        fontSize: 14,
        color: '#0f172a',
    },
    content: {
        flex: 1,
        paddingHorizontal: 30,
        paddingBottom: 30,
    },
    placeholder: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 24,
    }
});
