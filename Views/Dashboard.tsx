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
    Dimensions,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDB } from '../xdb/database';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import { useFocusEffect } from '@react-navigation/native';
const { width } = Dimensions.get('window');
const DEFAULT_KWD_TO_INR = 285;

interface WorkSession {
    session_id: string;
    emp_id: string;
    location_id: number;
    date: string;
    tap_in: string | null;
    tap_out: string | null;
    hours_worked: number;
    outbound_cost: number;
    return_cost: number;
    location_name?: string;
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
            loadConversionRate();
            fetchData()
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
            fetchData()
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
    const [thisMonthHours, setThisMonthHours] = useState<number>(0);
    const [thisMonthStores, setThisMonthStores] = useState<number>(0);
    const [prevMonthHours, setPrevMonthHours] = useState<number>(0);
    const [earningsKWD, setEarningsKWD] = useState<number>(0);
    const [earningsINR, setEarningsINR] = useState<number>(0);
    const [claimableTravelCost, setClaimableTravelCost] = useState<number>(0);
    const [conversionRate, setConversionRate] = useState<number>(DEFAULT_KWD_TO_INR);

    // Get month range from 25th to 24th
    const getCurrentPayPeriod = () => {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();
        const currentDate = now.getDate();

        let start, end;

        if (currentDate >= 25) {
            // Current month 25th to next month 24th
            start = new Date(currentYear, currentMonth, 25);
            end = new Date(currentYear, currentMonth + 1, 24);
        } else {
            // Previous month 25th to current month 24th
            start = new Date(currentYear, currentMonth - 1, 25);
            end = new Date(currentYear, currentMonth, 24);
        }

        return {
            start: start.toISOString().split("T")[0],
            end: end.toISOString().split("T")[0],
        };
    };

    const getPreviousPayPeriod = () => {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();
        const currentDate = now.getDate();

        let start, end;

        if (currentDate >= 25) {
            // Previous period: last month 25th to current month 24th
            start = new Date(currentYear, currentMonth - 1, 25);
            end = new Date(currentYear, currentMonth, 24);
        } else {
            // Previous period: month before last 25th to last month 24th
            start = new Date(currentYear, currentMonth - 2, 25);
            end = new Date(currentYear, currentMonth - 1, 24);
        }

        return {
            start: start.toISOString().split("T")[0],
            end: end.toISOString().split("T")[0],
        };
    };

    const loadConversionRate = async () => {
        try {
            const user = await AsyncStorage.getItem('currentUser');
            if (user) {
                const userData = JSON.parse(user);
                const savedRate = await AsyncStorage.getItem(`conversionRate_${userData.user_id}`);
                if (savedRate) {
                    setConversionRate(parseFloat(savedRate));
                }
            }
        } catch (error) {
            console.log("Error loading conversion rate:", error);
        }
    };

    const calculateEarnings = (rows: WorkSession[]) => {
        let total = 0;
        rows.forEach((r) => {
            const rate = r.location_name?.toLowerCase().includes("fahaheel") ? 0.75 : 0.65;
            total += (r.hours_worked || 0) * rate;
        });
        return total;
    };

    const fetchData = async () => {
        const db = await getDB();
        const { start, end } = getCurrentPayPeriod();
        const { start: prevStart, end: prevEnd } = getPreviousPayPeriod();

        // Current pay period data
        const currentPeriod = (await db.getAllAsync(
            `SELECT w.*, l.location_name 
         FROM WorkSessions w 
         JOIN Locations l ON w.location_id = l.location_id 
         WHERE date BETWEEN ? AND ? AND emp_id = ?`,
            [start, end, await AsyncStorage.getItem('currentUser')]
        )) as WorkSession[];

        // Previous pay period data
        const prevPeriod = (await db.getAllAsync(
            `SELECT hours_worked 
         FROM WorkSessions 
         WHERE date BETWEEN ? AND ? AND emp_id = ?`,
            [prevStart, prevEnd, await AsyncStorage.getItem('currentUser')]
        )) as WorkSession[];

        // 🔹 All unclaimed travel cost (ignore period)
        const unclaimedTravelRows = (await db.getAllAsync(
            `SELECT outbound_cost, return_cost 
         FROM WorkSessions 
         WHERE ticket_fare_claimed = 0  AND emp_id = ?`, [await AsyncStorage.getItem('currentUser')]
        )) as WorkSession[];

        const totalHours = currentPeriod.reduce((a, b) => a + (b.hours_worked || 0), 0);
        const totalStores = new Set(currentPeriod.map((r) => r.location_id)).size;
        const prevHours = prevPeriod.reduce((a, b) => a + (b.hours_worked || 0), 0);

        // 🔹 Use only unclaimed rows to calculate travel cost
        const travelCost = calculateTravelCost(unclaimedTravelRows);

        const kwd = calculateEarnings(currentPeriod);
        const inr = kwd * conversionRate;

        setThisMonthHours(totalHours);
        setThisMonthStores(totalStores);
        setPrevMonthHours(prevHours);
        setEarningsKWD(kwd);
        setEarningsINR(inr);
        setClaimableTravelCost(travelCost);
    };

    const calculateTravelCost = (rows: WorkSession[]) => {
        let total = 0;
        rows.forEach((r) => {
            total += (r.outbound_cost || 0) + (r.return_cost || 0);
        });
        return total;
    };



    return (
        <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
            <View style={styles.container}>
                {/* Warning if 2 or more sessions */}
                {activeDaySessions.length >= 2 && (
                    <Text style={{ color: 'red', marginBottom: 10, alignItems: 'center' }}>
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
                        <Text style={styles.infoTitle}> Today work session</Text>
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



                {/* Stats Grid */}
                <View style={styles.grid}>
                    {/* Current Period Hours */}
                    <View style={styles.statCard}>
                        <View style={[styles.iconContainer, { backgroundColor: '#e3f2fd' }]}>
                            <Text style={styles.icon}>⏱️</Text>
                        </View>
                        <Text style={styles.statValue}>{thisMonthHours.toFixed(1)}</Text>
                        <Text style={styles.statLabel}>Hours</Text>
                        <Text style={styles.statSubtitle}>This Period</Text>
                    </View>

                    {/* Stores Worked */}
                    <View style={styles.statCard}>
                        <View style={[styles.iconContainer, { backgroundColor: '#f3e5f5' }]}>
                            <Text style={styles.icon}>🏬</Text>
                        </View>
                        <Text style={styles.statValue}>{thisMonthStores}</Text>
                        <Text style={styles.statLabel}>Stores</Text>
                        <Text style={styles.statSubtitle}>Total Worked</Text>
                    </View>

                    {/* Previous Period */}
                    <View style={styles.statCard}>
                        <View style={[styles.iconContainer, { backgroundColor: '#e8f5e8' }]}>
                            <Text style={styles.icon}>📅</Text>
                        </View>
                        <Text style={styles.statValue}>{prevMonthHours.toFixed(1)}</Text>
                        <Text style={styles.statLabel}>Hours</Text>
                        <Text style={styles.statSubtitle}>Last Period</Text>
                    </View>
                </View>


                {/* Earnings Card */}
                <View style={styles.earningsCard}>
                    <View style={styles.earningsHeader}>
                        <View style={[styles.iconContainer, { backgroundColor: '#fff3cd' }]}>
                            <Text style={styles.icon}>💰</Text>
                        </View>
                        <View style={styles.earningsText}>
                            <Text style={styles.earningsLabel}>Period Earnings</Text>
                            <Text style={styles.earningsKWD}>{earningsKWD.toFixed(3)} KWD</Text>
                        </View>
                    </View>
                    <Text style={styles.earningsINR}>₹{earningsINR.toFixed(0)} INR</Text>
                </View>

                {/* Claimable Travel Cost Card */}
                <View style={[styles.card, styles.travelCard]}>
                    <View style={styles.cardHeader}>
                        <View style={[styles.iconContainer, { backgroundColor: '#ffe0e0' }]}>
                            <Text style={styles.icon}>🎫</Text>
                        </View>
                        <View style={styles.cardText}>
                            <Text style={styles.cardLabel}>Claimable Travel Cost</Text>
                            <Text style={styles.cardValue}>{claimableTravelCost.toFixed(3)} KWD</Text>
                        </View>
                    </View>
                    <Text style={styles.cardSubtitle}>Unclaimed travel expenses all period</Text>
                </View>

                {/* Info Section */}
                <View style={styles.infoSection}>
                    <Text style={styles.infoTitle}>Pay Period Info</Text>
                    <Text style={styles.infoText}>
                        • Current pay period: 25th → 24th of each month{"\n"}
                        • Travel costs include all *unclaimed* outbound & return fares (across all periods){"\n"}
                        • Only your logged sessions are counted{"\n"}
                        • Exchange rate: 1 KWD = ₹{conversionRate} ,Can be change in settings .
                    </Text>
                </View>
            </View>
        </ScrollView>
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
    title: { fontSize: 20, fontWeight: 'bold', marginBottom: 10 },
    sessionCard: {
        borderWidth: 1,
        borderColor: '#f8fafc',
        borderRadius: 14,
        padding: 15,
        marginBottom: 15,
        backgroundColor: '#fff',
        shadowColor: '#000',
        shadowOpacity: 0,
        shadowRadius: 5,
        elevation: 3,
    },
    cardRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    cardText: {
        marginLeft: 8, fontSize: 14,

        fontWeight: "600",
    },
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
        fontSize: 18,
    },
    buttonText: {
        color: 'white',
        fontWeight: 'bold',
    },
    container: {
        flex: 1,
        backgroundColor: "#f8fafc",
        paddingHorizontal: 8,
        paddingTop: 8,
    },
    header: {
        paddingVertical: 24,
        alignItems: 'center',
    },
    subtitle: {
        fontSize: 16,
        color: "#6366f1",
        marginTop: 4,
        fontWeight: "600",
    },
    rateBadge: {
        backgroundColor: "#6366f1",
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        marginTop: 8,
    },
    rateText: {
        fontSize: 12,
        color: "#fff",
        fontWeight: "600",
    },
    grid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 20,
    },
    statCard: {
        backgroundColor: "#fff",
        borderRadius: 20,
        padding: 16,
        width: (width - 48) / 3,
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 4,
    },
    iconContainer: {
        width: 44,
        height: 44,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    statValue: {
        fontSize: 18,
        fontWeight: "700",
        color: "#1a1a1a",
        marginBottom: 2,
    },
    statLabel: {
        fontSize: 13,
        fontWeight: "600",
        color: "#1a1a1a",
    },
    statSubtitle: {
        fontSize: 11,
        color: "#666",
        marginTop: 2,
    },
    earningsCard: {
        backgroundColor: "#fff",
        borderRadius: 20,
        padding: 20,
        marginBottom: 16,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 4,
    },
    earningsHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    earningsText: {
        marginLeft: 12,
        flex: 1,
    },
    earningsLabel: {
        fontSize: 15,
        color: "#666",
        fontWeight: "500",
    },
    earningsKWD: {
        fontSize: 20,
        fontWeight: "700",
        color: "#1a1a1a",
        marginTop: 2,
    },
    earningsINR: {
        fontSize: 16,
        fontWeight: "600",
        color: "#10b981",
        textAlign: 'center',
    },
    card: {
        backgroundColor: "#fff",
        borderRadius: 20,
        padding: 20,
        marginBottom: 16,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 4,
    },
    travelCard: {
        borderLeftWidth: 4,
        borderLeftColor: "#ef4444",
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    cardLabel: {
        fontSize: 15,
        color: "#666",
        fontWeight: "500",
    },
    cardValue: {
        fontSize: 20,
        fontWeight: "700",
        color: "#1a1a1a",
        marginTop: 2,
    },
    cardSubtitle: {
        fontSize: 13,
        color: "#666",
        fontStyle: 'italic',
    },
    infoSection: {
        backgroundColor: "#fff",
        borderRadius: 20,
        padding: 20,
        marginBottom: 20,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 4,
    },
    infoTitle: {
        fontSize: 16,
        fontWeight: "700",
        color: "#1a1a1a",
        marginBottom: 8,
    },
    infoText: {
        fontSize: 13,
        color: "#666",
        lineHeight: 20,
    },

});

export default Dashboard;
