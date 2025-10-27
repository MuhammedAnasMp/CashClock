import React, { useCallback, useEffect, useState } from 'react';
import {
    Text,
    View,
    ScrollView,
    TouchableOpacity,
    TextInput,
    Button,
    Alert,
} from 'react-native';
import { getDB } from '../xdb/database';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';

interface WorkSession {
    session_id: string;
    emp_id: string;
    location_id: number;
    date: string;
    tap_in?: string;
    tap_out?: string;
    hours_worked?: number;
    outbound_cost?: number;
    return_cost?: number;
    ticket_fare?: number;
    claimed_by?: number;
    timesheet_submitted?: number;
    ticket_fare_claimed?: number;
}

export default function Records() {
    const [sessions, setSessions] = useState<WorkSession[]>([]);
    const [editingSession, setEditingSession] = useState<WorkSession | null>(null);
    const [form, setForm] = useState<Partial<WorkSession>>({});

    useFocusEffect(
        useCallback(() => {
            console.log("all records")
            loadSessions();
        }, [])
    );

    const loadSessions = async () => {
        try {
            const db = await getDB();
            const allSessions: WorkSession[] = await db.getAllAsync(
                `SELECT * FROM WorkSessions ORDER BY date DESC`
            );

            setSessions(allSessions);
        } catch (error) {
            console.error('Failed to fetch sessions:', error);
        }
    };

    const deleteSession = async (id: string) => {
        Alert.alert('Delete', 'Are you sure you want to delete this session?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    const db = await getDB();
                    await db.execAsync(`DELETE FROM WorkSessions WHERE session_id = '${id}'`);
                    loadSessions();
                },
            },
        ]);
    };

    const startEditing = (session: WorkSession) => {
        setEditingSession(session);
        setForm({ ...session });
    };

    const saveSession = async () => {
        if (!editingSession) return;

        try {
            const db = await getDB();
            await db.runAsync(
                `UPDATE WorkSessions 
         SET tap_in=?, tap_out=?, hours_worked=?, outbound_cost=?, return_cost=?, ticket_fare=?
         WHERE session_id=?`,
                [
                    form.tap_in || null,
                    form.tap_out || null,
                    form.hours_worked || null,
                    form.outbound_cost || null,
                    form.return_cost || null,
                    form.ticket_fare || null,
                    editingSession.session_id,
                ]
            );

            setEditingSession(null);
            setForm({});
            loadSessions();
        } catch (error) {
            console.error('Failed to update session:', error);
        }
    };

    return (
        <ScrollView style={{ flex: 1, marginTop: 20 }}>
            {sessions.map((session) => (
                <View
                    key={session.session_id}
                    style={{
                        backgroundColor: '#fff',
                        padding: 10,
                        marginBottom: 5,
                        borderRadius: 8,
                        shadowColor: '#000',
                        shadowOpacity: 0.1,
                        shadowRadius: 5,
                        elevation: 3,
                    }}
                >
                    <Text>Date: {session.date}</Text>
                    <Text>Tap In: {session.tap_in || '-'}</Text>
                    <Text>Tap Out: {session.tap_out || '-'}</Text>
                    <Text>Hours Worked: {session.hours_worked ?? '-'}</Text>
                    <Text>Outbound Cost: {session.outbound_cost ?? '-'}</Text>
                    <Text>Return Cost: {session.return_cost ?? '-'}</Text>
                    <Text>Ticket Fare: {session.ticket_fare ?? '-'}</Text>
                    <View style={{ flexDirection: 'row', marginTop: 5 }}>
                        <TouchableOpacity style={{ marginRight: 10 }} onPress={() => startEditing(session)}>
                            <Text style={{ color: 'blue' }}>Edit</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => deleteSession(session.session_id)}>
                            <Text style={{ color: 'red' }}>Delete</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            ))}

           
        </ScrollView>
    );
}
