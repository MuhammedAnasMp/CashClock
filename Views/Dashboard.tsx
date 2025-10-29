import React, { useLayoutEffect, useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Modal,
    TextInput,
    Button,
    Alert,
    ScrollView,
    Platform,
    KeyboardAvoidingView,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDB } from '../xdb/database';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import { useFocusEffect } from '@react-navigation/native';

interface FormType {
    emp_id: string;
    location_id: number;
    date: Date;
    tap_in: Date;
    tap_out?: Date; // optional
    outbound_cost: number;
    return_cost: number;
}

type RootStackParamList = {
    Dashboard: undefined;
};

type Props = NativeStackScreenProps<RootStackParamList, 'Dashboard'>;

const costOptions = [0.25, 0.35, 0.5, 0.7, 0.75, 1.050];

const Dashboard: React.FC<Props> = ({ navigation }) => {
    const [modalVisible, setModalVisible] = useState(false);
    const [locations, setLocations] = useState<{ location_id: number; location_name: string }[]>([]);
    const [form, setForm] = useState<FormType>({
        emp_id: '',
        location_id: 0,
        date: new Date(),
        tap_in: new Date(),
        tap_out: undefined,
        outbound_cost: 0,
        return_cost: 0,
    });

    const [activeDaySessions, setActiveDaySession] = useState<any>({});
    const [activeUserId, setActiveUserID] = useState('')
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showTapInPicker, setShowTapInPicker] = useState(false);
    const [showTapOutPicker, setShowTapOutPicker] = useState(false);
    const fetchActiveSession = async () => {
        try {
            const db = await getDB();
            const today = new Date();
            const todayStr = today.toISOString().split('T')[0]; // "YYYY-MM-DD"

            console.log(activeUserId)
            const row = await db.getAllAsync(
                'SELECT * FROM WorkSessions WHERE date = ? AND emp_id = ?',
                [todayStr, await AsyncStorage.getItem('currentUser')]
            );

            setActiveDaySession(row || {}); // update state
            return row || null; // optionally return the session
        } catch (error) {
            console.error('Failed to fetch active session:', error);
            return null;
        }
    };

    useFocusEffect(
        useCallback(() => {

            const fetchLocations = async () => {
                const db = await getDB();
                const rows = (await db.getAllAsync(
                    'SELECT location_id, location_name FROM Locations'
                )) as { location_id: number; location_name: string }[];
                setLocations(rows);

                const empId = await AsyncStorage.getItem('currentUser');
                setActiveUserID(empId || '')
                if (empId) setForm(f => ({ ...f, emp_id: empId }));
            };

            fetchActiveSession();
            fetchLocations();
        }, [])
    );

    useLayoutEffect(() => {
        navigation.setOptions({
            headerRight: () =>
                // Object.keys(activeDaySessions).length === 0 ? (
                <TouchableOpacity onPress={() => {

                    setForm({
                        emp_id: form.emp_id,
                        location_id: 0,
                        date: new Date(),
                        tap_in: new Date(),
                        tap_out: undefined,
                        outbound_cost: 0,
                        return_cost: 0,
                    });
                    setModalVisible(true)
                }} style={{ marginRight: 15 }}>
                    <Ionicons name="add-circle-outline" size={28} color="green" />
                </TouchableOpacity>
            // ) : null,
        });
    }, [navigation, activeDaySessions]);

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



    const handleSave = async () => {
        try {
            // ✅ Validation: location must be selected
            if (!form.location_id) {
                Alert.alert('Error', 'Please select a location before saving.');
                return;
            }

            const db = await getDB();

            // Calculate hours worked
            const hoursWorked = calculateHoursWorked(); // make sure this reads from form
            const ticketFare = (form.outbound_cost || 0) + (form.return_cost || 0);

            if (isEditing && editingSessionId) {
                // Update existing session
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
            } else {
                // ➕ Create new session
                const sessionId = Math.random().toString(36).substring(2, 10);
                await db.runAsync(
                    `INSERT INTO WorkSessions 
                (session_id, emp_id, location_id, date, tap_in, tap_out, hours_worked, outbound_cost, return_cost, ticket_fare)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        sessionId,
                        form.emp_id,
                        form.location_id,
                        form.date.toISOString().split('T')[0],
                        formatTime(form.tap_in),
                        form.tap_out ? formatTime(form.tap_out) : null,
                        hoursWorked,
                        form.outbound_cost,
                        form.return_cost,
                        ticketFare,
                    ]
                );
                Alert.alert('Success', 'Work session saved!');
            }

            // Reset and refresh
            setModalVisible(false);
            setIsEditing(false);
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
            fetchActiveSession();
        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'Failed to save work session.');
        }
    };


    function getBestTapOuts(tapIn: Date) {
        const rounding = 14; // 14-minute tolerance window
        const cycles = Array.from({ length: 21 }, (_, i) => 3 + i * 0.5); // 3, 3.5 ... 13
        const suggestions: any[] = [];

        const tapInMs = tapIn.getTime();

        cycles.forEach((hours) => {
            const idealEnd = new Date(tapInMs + hours * 60 * 60 * 1000);
            const earliest = new Date(idealEnd.getTime() - rounding * 60 * 1000);

            const hour = earliest.getHours();

            if (hour >= 8 && hour <= 23) { // only keep 8 AM - 11 PM
                suggestions.push({
                    hoursWorked: hours,
                    time: earliest,
                });
            }
        });

        return suggestions.slice(-5);
    }
    const [isEditing, setIsEditing] = useState(false);
    const [editingSessionId, setEditingSessionId] = useState<string | null>(null);


    function formatTime2(date: any) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    function convertTo24Hour(time12h: string): string {
        if (!time12h) return '00:00:00';
        const [time, modifier] = time12h.split(' ');
        let [hours, minutes] = time.split(':').map(Number);
        if (modifier === 'PM' && hours < 12) hours += 12;
        if (modifier === 'AM' && hours === 12) hours = 0;
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00`;
    }


    return (
        <View style={styles.container}>
            <Text style={styles.title}>
                Today work session
            </Text>

            {/* Warning if 2 or more sessions */}
            {activeDaySessions.length >= 2 && (
                <Text style={{ color: 'red', marginBottom: 10 , alignItems: 'center' }}>
                    ⚠️ Multiple work detected ! This is unusual.
                </Text>
            )}

            {activeDaySessions.length > 0 && activeDaySessions.map((session: any) => (
                <TouchableOpacity
                    key={session.session_id} // unique key for each session
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
                        setIsEditing(true);
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
                            <Text>⏱️</Text>
                            <Text style={styles.cardText}>Tap Out: {session.tap_out}</Text>
                        </View>
                    )}
                    <View style={styles.cardRow}>
                        <Text>🎫</Text>
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
                </TouchableOpacity>
            ))}






            <Modal visible={modalVisible} animationType="slide" transparent={true}>
                <KeyboardAvoidingView
                    style={{ flex: 1 }}
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                >
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalContent}>
                            <ScrollView
                                contentContainerStyle={{ paddingBottom: 0 }}
                                keyboardShouldPersistTaps="handled"
                                showsVerticalScrollIndicator={false}
                            >
                                <Text style={styles.modalTitle}>
                                    {isEditing ? 'Edit Work Session' : 'Add Work Session'}
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
                                <TouchableOpacity
                                    onPress={() => setShowDatePicker(true)}
                                    style={styles.iconInput}
                                >
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
                                <TouchableOpacity
                                    onPress={() => setShowTapInPicker(true)}
                                    style={styles.iconInput}
                                >
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

                                {/* Suggested Tap Out Times */}
                                {form.tap_in && (
                                    <View style={{ marginVertical: 10 }}>
                                        <Text style={styles.label}>Suggested Tap Out Times</Text>
                                        {getBestTapOuts(form.tap_in)
                                            .slice(-5)
                                            .map((s, i) => (
                                                <View key={i} style={styles.suggestionRow}>
                                                    <Text style={styles.suggestionText}>
                                                        ⏰ {s.hoursWorked.toFixed(1)} hrs → {formatTime2(s.time)}
                                                    </Text>
                                                </View>
                                            ))}
                                    </View>
                                )}

                                {/* Tap Out */}
                                <Text style={styles.label}>Tap Out</Text>
                                <TouchableOpacity
                                    onPress={() => setShowTapOutPicker(true)}
                                    style={styles.iconInput}
                                >
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
                                    onChangeText={(text) =>
                                        setForm({ ...form, outbound_cost: parseFloat(text) || 0 })
                                    }
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
                                            <Text
                                                style={{ color: form.outbound_cost === c ? '#fff' : 'black' }}
                                            >
                                                {c.toFixed(3)}
                                            </Text>
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
                                    onChangeText={(text) =>
                                        setForm({ ...form, return_cost: parseFloat(text) || 0 })
                                    }
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
                                            <Text
                                                style={{ color: form.return_cost === c ? '#fff' : 'black' }}
                                            >
                                                {c.toFixed(3)}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>

                                {/* Buttons */}
                                <View
                                    style={{
                                        flexDirection: 'row',
                                        justifyContent: 'space-between',
                                        marginTop: 20,
                                        marginBottom: 10,
                                    }}
                                >
                                    <TouchableOpacity
                                        style={[styles.button, styles.cancelButton]}
                                        onPress={() => setModalVisible(false)}
                                    >
                                        <MaterialIcons name="cancel" size={20} color="white" style={styles.icon} />
                                        <Text style={styles.buttonText}>Cancel</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={[styles.button, styles.updateButton]}
                                        onPress={handleSave}
                                    >
                                        <MaterialIcons name="save" size={20} color="white" style={styles.icon} />
                                        <Text style={styles.buttonText}>Save</Text>
                                    </TouchableOpacity>
                                </View>
                            </ScrollView>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

        </View>
    );
};

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
        gap: 2,
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
        backgroundColor: '#4CAF50',
    },
    cancelButton: {
        backgroundColor: '#E53935',
    },
    icon: {
        marginRight: 8,
    },
    buttonText: {
        color: 'white',
        fontWeight: 'bold',
    },
});

export default Dashboard;
