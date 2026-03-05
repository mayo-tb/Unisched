import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { DrawerActions, useNavigation } from '@react-navigation/native';

export default function TopHeader() {
    const navigation = useNavigation();

    return (
        <View style={styles.header}>
            <View style={styles.headerLeft}>
                <TouchableOpacity
                    style={styles.menuBtn}
                    onPress={() => navigation.dispatch(DrawerActions.toggleDrawer())}
                >
                    <Feather name="menu" size={24} color="#0f172a" />
                </TouchableOpacity>
                <View>
                    <Text style={styles.logoTitle}>Genetics Cloud</Text>
                    <Text style={styles.logoSubtitle}>ENTERPRISE SCHEDULING ENGINE</Text>
                </View>
            </View>
            <View style={styles.headerRight}>
                <View style={styles.userInfo}>
                    <Text style={styles.userId}>22/0102</Text>
                    <Text style={styles.userRole}>ADMIN</Text>
                </View>
                <TouchableOpacity style={styles.logoutBtn}>
                    <Feather name="log-out" size={18} color="#64748b" />
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 30,
        paddingTop: 30,
        paddingBottom: 20,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    menuBtn: {
        padding: 8,
        borderRadius: 8,
        backgroundColor: '#f1f5f9',
    },
    logoTitle: {
        fontSize: 22,
        fontWeight: '800',
        color: '#0f172a',
        letterSpacing: -0.5,
    },
    logoSubtitle: {
        fontSize: 10,
        fontWeight: '800',
        color: '#3b82f6',
        letterSpacing: 1,
        marginTop: 2,
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    userInfo: {
        alignItems: 'flex-end',
    },
    userId: {
        fontSize: 14,
        fontWeight: '800',
        color: '#0f172a',
    },
    userRole: {
        fontSize: 10,
        fontWeight: '800',
        color: '#94a3b8',
        letterSpacing: 1,
    },
    logoutBtn: {
        width: 40,
        height: 40,
        borderRadius: 8,
        backgroundColor: '#f8fafc',
        justifyContent: 'center',
        alignItems: 'center',
    },
});
