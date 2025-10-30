import React, { useCallback, useState } from 'react';
import { View, Text, Alert, TouchableOpacity, ScrollView, StyleSheet, Modal, TextInput, Button, Platform } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getDB } from '../xdb/database';
import { Calendar } from 'react-native-calendars';
import { Picker } from '@react-native-picker/picker';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialIcons } from '@expo/vector-icons';

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
}

interface FormType {
    emp_id: string;
    location_id: number;
    date: Date;
    tap_in: Date;
    tap_out?: Date; // optional
    outbound_cost: number;
    return_cost: number;
}
export default function Records() {
    const [sessions, setSessions] = useState<any[]>([]);
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [modalVisible, setModalVisible] = useState(false);
    const [showDatePicker, setShowDatePicker] = useState(false);
    useFocusEffect(
        useCallback(() => {
            loadSessions();
        }, [])
    );

    const [showTapInPicker, setShowTapInPicker] = useState(false);
    const [showTapOutPicker, setShowTapOutPicker] = useState(false);
    const costOptions = [0.25, 0.35, 0.5, 0.7, 0.75, 1.050];
    const [form, setForm] = useState<FormType>({
        emp_id: '',
        location_id: 0,
        date: new Date(),
        tap_in: new Date(),
        tap_out: undefined,
        outbound_cost: 0,
        return_cost: 0,
    });
    const loadSessions = async () => {
        try {
            const db = await getDB();

            const allSessions: WorkSession[] = await db.getAllAsync(
                `SELECT * FROM WorkSessions WHERE emp_id = ? ORDER BY date DESC`,
                [await AsyncStorage.getItem('currentUser')]
            );
            setSessions(allSessions);
        } catch (error) {
            console.error('Failed to fetch sessions:', error);
        }
    };

    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    // Mark dates on calendar that have sessions, plus today
    const getMarkedDates = (): any => {
        const marked: any = {};

        // Mark session dates
        sessions.forEach((s) => {
            marked[s.date] = {
                marked: true,
                dotColor: 'blue',
                activeOpacity: 0,
            };
        });

        // Highlight today
        marked[today] = {
            ...(marked[today] || {}),
            selected: true,
            selectedColor: 'green', // color for today
        };

        // Highlight user-selected date
        if (selectedDate && selectedDate !== today) {
            marked[selectedDate] = {
                ...(marked[selectedDate] || {}),
                selected: true,
                selectedColor: 'orange', // color for selected date
            };
        }

        return marked;
    };

    const sessionsForSelectedDate = sessions.filter(s => s.date === selectedDate);
    const [locations, setLocations] = useState<{ location_id: number; location_name: string }[]>([]);
    useFocusEffect(
        useCallback(() => {

            const fetchLocations = async () => {
                const db = await getDB();
                const rows = (await db.getAllAsync(
                    'SELECT location_id, location_name FROM Locations'
                )) as { location_id: number; location_name: string }[];
                setLocations(rows);

                const empId = await AsyncStorage.getItem('currentUser');
                if (empId) setForm(f => ({ ...f, emp_id: empId }));
            };
            fetchLocations();
        }, [])
    );
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

    const formatTime = (date: Date) => {
        let hours = date.getHours();
        const minutes = date.getMinutes();
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12 || 12;
        return `${hours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
    };

    const calculateHoursWorked = () => {
        if (!form.tap_in || !form.tap_out || !form.date) return 0;

        // Helper to get hours and minutes from string or Date
        const getHoursMinutes = (time: string | Date) => {
            if (time instanceof Date) {
                return { hours: time.getHours(), minutes: time.getMinutes() };
            } else {
                // 12-hour string like "6:00 PM"
                const [t, modifier] = time.trim().split(' ');
                let [hours, minutes] = t.split(':').map(Number);
                if (modifier.toUpperCase() === 'PM' && hours < 12) hours += 12;
                if (modifier.toUpperCase() === 'AM' && hours === 12) hours = 0;
                return { hours, minutes };
            }
        };

        const tapInTime = getHoursMinutes(form.tap_in);
        const tapOutTime = getHoursMinutes(form.tap_out);

        // Create Date objects based on session date
        const tapIn = new Date(form.date);
        tapIn.setHours(tapInTime.hours, tapInTime.minutes, 0, 0);

        let tapOut = new Date(form.date);
        tapOut.setHours(tapOutTime.hours, tapOutTime.minutes, 0, 0);

        // Overnight shift check
        if (tapOut <= tapIn) {
            tapOut.setDate(tapOut.getDate() + 1);
        }

        const diffMs = tapOut.getTime() - tapIn.getTime();
        const totalHours = diffMs / (1000 * 60 * 60);
        const hours = Math.floor(totalHours);
        const minutes = (totalHours - hours) * 60;

        // Round logic
        let roundedHours = hours;
        if (minutes <= 15) roundedHours = hours;
        else if (minutes > 15 && minutes < 46) roundedHours = hours + 0.5;
        else roundedHours = hours + 1;

        return roundedHours;
    };

    const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
    const handleSave = async () => {
        if (!form.location_id) {
            Alert.alert('Error', 'Please select a location.');
            return;
        }
        if (!form.date) {
            Alert.alert('Error', 'Please select a date.');
            return;
        }
        if (!form.tap_in) {
            Alert.alert('Error', 'Please enter tap-in time.');
            return;
        }
        if (!form.tap_out) {
            Alert.alert('Error', 'Please enter tap-out time.');
            return;
        }

        try {
            const db = await getDB();
            const hoursWorked = calculateHoursWorked();
            const ticketFare = form.outbound_cost + form.return_cost;
         
            await db.runAsync(
                `UPDATE WorkSessions 
                    SET location_id=?, date=?, tap_in=?, tap_out=?, hours_worked=?, outbound_cost=?, return_cost=?, ticket_fare=?
                    WHERE session_id=?`,
                [
                    form.location_id,
                    form.date.toISOString().split('T')[0],
                    formatTime(form.tap_in),
                    form.tap_out ? formatTime(form.tap_out) : null,
                    hoursWorked,
                    form.outbound_cost,
                    form.return_cost,
                    ticketFare,
                    editingSessionId,
                ]
            );
            Alert.alert('Updated', 'Work session updated successfully!');

            // Reset and refresh
            setModalVisible(false);
            // setIsEditing(false);
            setEditingSessionId(null);
            setForm({
                emp_id: form.emp_id,
                location_id: 0,
                date: new Date(),
                tap_in: new Date(),
                tap_out: undefined,
                outbound_cost: 0,
                return_cost: 0,
            });
            loadSessions();
        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'Failed to save work session.');
        }
    };
    function convertTo24Hour(time12h: string): string {
        if (!time12h) return '00:00:00';

        // Normalize input: remove extra spaces and uppercase AM/PM
        const parts = time12h.trim().toUpperCase().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/);
        if (!parts) return '00:00:00'; // invalid format fallback

        let hours = parseInt(parts[1], 10);
        const minutes = parseInt(parts[2], 10);
        const modifier = parts[3];

        if (modifier === 'PM' && hours < 12) hours += 12;
        if (modifier === 'AM' && hours === 12) hours = 0;

        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00`;
    }


    return (
        <View style={{ flex: 1, marginTop: 20 }}>
            <Calendar
                markingType={'simple' as any}
                markedDates={getMarkedDates()}
                onDayPress={(day) => setSelectedDate(day.dateString)}
            />

            {selectedDate ? (
                <ScrollView style={{ marginTop: 10 }}>
                    {sessionsForSelectedDate.length === 0 ? (
                        <Text style={{ textAlign: 'center', marginTop: 10 }}>No sessions for this date</Text>
                    ) : (
                        <>
                            {sessionsForSelectedDate.length > 1 && (
                                <View style={{ marginBottom: 10, padding: 10, backgroundColor: '#ffe6e6', borderRadius: 5 }}>
                                    <Text style={{
                                        color: 'red',
                                        fontWeight: 'bold',
                                        fontSize: 16,
                                        textAlign: 'center'
                                    }}>
                                        ⚠️ Danger! More than one session exists for this date. Remove duplicates now!
                                    </Text>
                                </View>
                            )}

                            {

                                sessionsForSelectedDate.map((session, index) => (
                                    <TouchableOpacity key={index}
                                        style={styles.sessionCard}
                                        activeOpacity={0.8}
                                        onPress={() => {
                                            // Fill form with existing session details
                                            setForm({
                                                emp_id: session.emp_id,
                                                location_id: session.location_id,
                                                date: new Date(session.date),
                                                tap_in: new Date(`1970-01-01T${convertTo24Hour(session.tap_in)}`),
                                                tap_out: session.tap_out
                                                    ? new Date(`1970-01-01T${convertTo24Hour(session.tap_out)}`)
                                                    : undefined,
                                                outbound_cost: session.outbound_cost,
                                                return_cost: session.return_cost,
                                            });
                                            setEditingSessionId(session.session_id);

                                            setModalVisible(true);
                                        }}
                                    >
                                        <View style={styles.cardRow}>
                                            <Text>📍</Text>
                                            <Text style={styles.cardText}>
                                                Location: {locations.find(l => l.location_id === session.location_id)?.location_name || 'N/A'}
                                            </Text>
                                        </View>
                                        <View style={styles.cardRow}>
                                            <Text>🗓️</Text>
                                            <Text style={styles.cardText}>Date: {session.date}</Text>
                                        </View>
                                        <View style={styles.cardRow}>
                                            <Text>⏱️</Text>
                                            <Text style={styles.cardText}>Tap In: {session.tap_in}</Text>
                                        </View>
                                        {session.tap_out && (
                                            <View style={styles.cardRow}>
                                               <Text>⏰</Text> 
                                                <Text style={styles.cardText}>Tap Out: {session.tap_out}</Text>
                                            </View>
                                        )}
                                        <View style={styles.cardRow}>
                                            <Text>
                                                🎫
                                            </Text>
                                            <Text style={styles.cardText}>
                                                Outbound: {session.outbound_cost?.toFixed(3)} | Return: {session.return_cost?.toFixed(3)}
                                            </Text>
                                        </View>
                                        <View style={styles.cardRow}>
                                            <Text>⏳</Text>
                                            <Text style={styles.cardText}>
                                                Hours Worked: {session.hours_worked?.toFixed(2)}
                                            </Text>
                                        </View>
                                        <View style={styles.cardRow}>
                                          
                                            <Text>🎫</Text>
                                            <Text style={styles.cardText}>
                                                Ticket Fare: {session.ticket_fare?.toFixed(3)}
                                            </Text>
                                        </View>
                                    </TouchableOpacity>
                                ))
                            }
                        </>
                    )}
                </ScrollView>
            ) :
                <>
                    <ScrollView style={{ marginTop: 10 }}>
                        <Text>
                            <Text style={{ textAlign: 'center', marginTop: 20 }}>Select any date view time record</Text>

                        </Text>
                    </ScrollView>
                </>

            }

            <Modal visible={modalVisible} animationType="slide" transparent={true}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <ScrollView>
                            <Text style={styles.modalTitle}>
                                Update  Work Session of {
                                    form.date
                                        ? `${form.date.getDate()} ${form.date.toLocaleString('default', { month: 'long' })} ${form.date.getFullYear()}`
                                        : ''
                                }
                            </Text>



                            {/* Location */}
                            <Text style={styles.label}>Location</Text>
                            <View style={styles.pickerWrapper}>
                                <Picker
                                    selectedValue={form.location_id}
                                    onValueChange={(value) => setForm({ ...form, location_id: value })}
                                    style={{ color: 'black', width: '100%' }}
                                    mode="dropdown"
                                >

                                    <Picker.Item label="📍 Select location" value={0} />
                                    {locations.map((loc) => (
                                        <Picker.Item key={loc.location_id} label={`📍 ${loc.location_name}`} value={loc.location_id} />
                                    ))}
                                </Picker>
                            </View>

                            {/* Date */}
                            <Text style={styles.label}>Date</Text>
                            <TouchableOpacity onPress={() => setShowDatePicker(true)} style={styles.iconInput}>
                                <Text>🗓️</Text>
                                <Text style={styles.iconText}>{form.date.toISOString().split('T')[0]}</Text>
                            </TouchableOpacity>
                            {showDatePicker && (
                                <DateTimePicker
                                    value={form.date}
                                    mode="date"
                                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                    onChange={(_, selectedDate) => {
                                        setShowDatePicker(false);
                                        if (selectedDate) setForm({ ...form, date: selectedDate });
                                    }}
                                />
                            )}

                            {/* Tap In */}
                            <Text style={styles.label}>Tap In</Text>
                            <TouchableOpacity onPress={() => setShowTapInPicker(true)} style={styles.iconInput}>
                                <Text>⏱️</Text>
                                <Text style={styles.iconText}>{formatTime(form.tap_in)}</Text>
                            </TouchableOpacity>
                            {showTapInPicker && (
                                <DateTimePicker
                                    value={form.tap_in}
                                    mode="time"
                                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                    onChange={(_, selectedTime) => {
                                        setShowTapInPicker(false);
                                        if (selectedTime) setForm({ ...form, tap_in: selectedTime });
                                    }}
                                />
                            )}



                            {/* Tap Out */}
                            <Text style={styles.label}>Tap Out</Text>
                            <TouchableOpacity onPress={() => setShowTapOutPicker(true)} style={styles.iconInput}>
                                <Text>⏰</Text>
                                <Text style={styles.iconText}>
                                    {form.tap_out ? formatTime(form.tap_out) : '--:--'}
                                </Text>

                            </TouchableOpacity>
                            {showTapOutPicker && (
                                <DateTimePicker
                                    value={form.tap_out ?? form.tap_in ?? new Date()}
                                    mode="time"
                                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                    onChange={(_, selectedTime) => {
                                        setShowTapOutPicker(false);
                                        if (selectedTime) setForm({ ...form, tap_out: selectedTime });
                                    }}
                                />
                            )}


                            {/* Outbound Cost */}
                            <Text style={styles.label}>Outbound Cost</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Or enter manually"
                                placeholderTextColor="gray"
                                keyboardType="numeric"
                                value={form.outbound_cost.toString()}
                                onChangeText={(text) => setForm({ ...form, outbound_cost: parseFloat(text) || 0 })}
                            />
                            <View style={styles.costContainer}>
                                {costOptions.map((c) => (
                                    <TouchableOpacity
                                        key={c}
                                        onPress={() => setForm({ ...form, outbound_cost: c })}
                                        style={[
                                            styles.iconButton,
                                            form.outbound_cost === c && { backgroundColor: '#4caf50' },
                                        ]}
                                    >
                                        <Text
                                            style={{ color: form.outbound_cost === c ? '#fff' : 'black' }}
                                        >

                                            🎫
                                        </Text>
                                        <Text style={{ color: form.outbound_cost === c ? '#fff' : 'black' }}>{c.toFixed(3)}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            {/* Return Cost */}
                            <Text style={styles.label}>Return Cost</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Or enter manually"
                                placeholderTextColor="gray"
                                keyboardType="numeric"
                                value={form.return_cost.toString()}
                                onChangeText={(text) => setForm({ ...form, return_cost: parseFloat(text) || 0 })}
                            />
                            <View style={styles.costContainer}>
                                {costOptions.map((c) => (
                                    <TouchableOpacity
                                        key={c}
                                        onPress={() => setForm({ ...form, return_cost: c })}
                                        style={[
                                            styles.iconButton,
                                            form.return_cost === c && { backgroundColor: '#4caf50' },
                                        ]}
                                    >
                                        <Text
                                            style={{ color: form.outbound_cost === c ? '#fff' : 'black' }}
                                        >

                                            🎫
                                        </Text>
                                        <Text style={{ color: form.return_cost === c ? '#fff' : 'black' }}>{c.toFixed(3)}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            {/* Save / Cancel */}
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 }}>

                                <TouchableOpacity
                                    style={[styles.button, styles.cancelButton]}
                                    onPress={() => setModalVisible(false)}
                                >
                                    <MaterialIcons name="cancel" size={20} color="white" style={styles.icon} />
                                    <Text style={styles.buttonText}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.button, styles.updateButton]} onPress={handleSave}>
                                    <MaterialIcons name="save" size={20} color="white" style={styles.icon} />
                                    <Text style={styles.buttonText}>Update</Text>
                                </TouchableOpacity>
                            </View>

                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </View>
    );
}



const styles = StyleSheet.create({
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center' },
    modalContent: { margin: 20, backgroundColor: '#fff', borderRadius: 10, padding: 20, maxHeight: '90%' },
    modalTitle: { fontSize: 20, marginBottom: 10, textAlign: 'center' },
    input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 5, padding: 10, marginVertical: 5, backgroundColor: '#fff' },
    label: { marginTop: 10, fontWeight: 'bold' },
    pickerWrapper: { borderWidth: 1, borderColor: '#ccc', borderRadius: 5, marginVertical: 5, backgroundColor: '#fff' },
    costContainer: { flexDirection: 'row', flexWrap: 'wrap', marginVertical: 5 },
    iconButton: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 8,
        borderWidth: 1,
        borderColor: '#aaa',
        borderRadius: 6,
        margin: 3,
        minWidth: 60,
        justifyContent: 'center',
    },
    iconInput: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 6,
        padding: 10,
        marginVertical: 5,
        backgroundColor: '#fff',
    },
    iconText: {
        marginLeft: 10,
        fontSize: 16,
        color: 'black',
    },
    suggestionRow: {
        backgroundColor: '#f1f8e9',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 6,
        marginVertical: 4,
    },
    suggestionText: {
        color: '#2e7d32',
        fontSize: 16,
        fontWeight: '600',
    },
    container: { flex: 1, padding: 15, backgroundColor: '#fff' },
    title: { fontSize: 20, fontWeight: 'bold', marginBottom: 10 },
    sessionCard: {
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 10,
        padding: 15,
        marginBottom: 15,
        backgroundColor: '#f9f9f9',
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 5,
        elevation: 3,
    },
    cardRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    cardText: { marginLeft: 8, fontSize: 14 },
    buttonContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 20,
    },
    button: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 8,
    },
    updateButton: {
        backgroundColor: '#62b8e0ff',
    },
    cancelButton: {
        backgroundColor: '#777777ff',
    },
    icon: {
        marginRight: 8,
    },
    buttonText: {
        color: 'white',
        fontWeight: 'bold',
    },
});