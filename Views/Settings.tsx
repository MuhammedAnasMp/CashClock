import React, { useEffect, useLayoutEffect, useState } from "react";
import { View, Text, TouchableOpacity, Alert, FlatList, StyleSheet, ScrollView, SectionList, TextInput } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getDB } from "../xdb/database";
import Crud from "./Crud";
import { Ionicons } from "@expo/vector-icons";

const Settings = () => {
  const [xGroupedSessions, setXGroupedSessions] = useState<any>({});

  useLayoutEffect(() => {
    fetchSessions();
    loadConversionRate()
  }, []);

  const fetchSessions = async () => {
    const db = await getDB();
    const userId = await AsyncStorage.getItem("currentUser");
    if (!userId) return;

    const rows = (await db.getAllAsync(
      `
    SELECT w.*, l.location_name
    FROM WorkSessions w
    JOIN Locations l ON w.location_id = l.location_id
    WHERE w.emp_id = ?
    ORDER BY w.date DESC
    `,
      [userId] // use the variable, not another AsyncStorage call
    )) as any[];

    const grouped = groupByPayPeriod(rows);
    setXGroupedSessions(grouped);
  };



  // Group sessions by pay period (25 → 24)
  const groupByPayPeriod = (sessions: any[]) => {
    const groups: any = {};

    sessions.forEach((s) => {
      const date = new Date(s.date);
      const periodKey = getPayPeriodKey(date);
      if (!groups[periodKey]) groups[periodKey] = [];
      groups[periodKey].push(s);
    });

    return groups;
  };

  const getPayPeriodKey = (date: Date) => {
    let year = date.getFullYear();
    let month = date.getMonth();

    if (date.getDate() < 25) {
      month -= 1;
      if (month < 0) {
        month = 11;
        year -= 1;
      }
    }

    const start = new Date(year, month, 25);
    const end = new Date(year, month + 1, 24);
    return `${start.toLocaleString("default", {
      month: "short",
    })} ${year} → ${end.toLocaleString("default", {
      month: "short",
    })} ${end.getFullYear()}`;
  };

  const deleteSession = async (sessionId: string) => {
    Alert.alert(
      "🗑️ Delete Session",
      "Are you sure you want to delete this session? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const db = await getDB();
            await db.runAsync("DELETE FROM WorkSessions WHERE session_id = ?", [sessionId]);
            Alert.alert("✅ Deleted", "Session deleted successfully.");
            fetchSessions(); // refresh list
          },
        },
      ]
    );
  };
  const sections = Object.entries(xGroupedSessions).map(([period, sessions]: any) => ({
    title: period,
    data: sessions,
  }));

  const renderSession = ({ item }: { item: any }) => (
    <View style={xStyles.xListItem}>
      <View style={xStyles.xItemContent}>
        <View style={xStyles.xSessionInfo}>
          <Text style={xStyles.xSessionDate}>📅 {item.date}</Text>
          <Text style={xStyles.xLocation}>🏬 {item.location_name}</Text>
          <Text style={xStyles.xHours}>⏱️ {item.hours_worked?.toFixed(2) || 0} hrs</Text>
        </View>
        <TouchableOpacity
          style={[xStyles.xIconButton, xStyles.xDeleteButton]}
          onPress={() => deleteSession(item.session_id)}
        >
          <Text>🗑️</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderSectionHeader = ({ section }: any) => (
    <Text style={xStyles.xSectionTitle}>  {section.title}</Text>
  );
  const [conversionRateInput, setConversionRateInput] = useState<string>(""); // string for TextInput
  const [savedConversionRate, setSavedConversionRate] = useState<number>(0); // number for actual value
  const loadConversionRate = async () => {
    try {
      const user = await AsyncStorage.getItem("currentUser");
      if (!user) return;

      const userData = JSON.parse(user);
      const savedRate = await AsyncStorage.getItem(`conversionRate_${userData.user_id}`);
      const rateNum = savedRate ? parseFloat(savedRate) : 0;
      setSavedConversionRate(rateNum);
      setConversionRateInput(rateNum ? rateNum.toString() : ""); // string for input
    } catch (error) {
      console.log("Error loading conversion rate:", error);
    }
  };

  // Save handler
  const handleSaveRate = async () => {
    try {
      const user = await AsyncStorage.getItem("currentUser");
      if (!user) return;

      const userData = JSON.parse(user);
      const num = parseFloat(conversionRateInput);
      if (isNaN(num) || num <= 0) {
        Alert.alert("⚠️ Invalid Value", "Please enter a valid number.");
        return;
      }

      await AsyncStorage.setItem(`conversionRate_${userData.user_id}`, num.toString());
      setSavedConversionRate(num);
      setConversionRateInput(""); // clear input if desired

      Alert.alert(
        "✅ Saved",
        `Conversion rate set to ${num}\nAll dashboard earnings will be recalculated based on the new rate.`
      );
    } catch (error) {
      console.log("Error saving conversion rate:", error);
    }
  };



  return (


    <View style={{ flex: 1, backgroundColor: "#f8fafc", padding: 16 }}>
      {sections.length === 0 ? (
        <Text style={xStyles.xEmptyText}>No sessions found 🙂</Text>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.session_id}
          renderItem={renderSession}
          renderSectionHeader={renderSectionHeader}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={{ paddingBottom: 40 }}
          ListHeaderComponent={
            <View>
              <Crud />


              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
                <Ionicons name="location" size={24} color="#10b981" />
                <Text style={xStyles.xConversionTitle}> {`Conversion (1 KWD → ${conversionRateInput || savedConversionRate.toString()} INR)`}</Text>
              </View>
              <View style={xStyles.xConversionContainer}>

                <TextInput
                  style={xStyles.xConversionInput}
                  placeholder={savedConversionRate.toString() || "Enter conversion rate"}
                  placeholderTextColor="#9ca3af"
                  keyboardType="numeric"
                  value={conversionRateInput}
                  onChangeText={setConversionRateInput}
                />

                <TouchableOpacity style={xStyles.xConversionButton} onPress={handleSaveRate}>
                  <Text style={xStyles.xConversionButtonText}>💾 Save Rate</Text>
                </TouchableOpacity>
              </View>
            </View>
          }

        />
      )}

    </View>
  );
};

export default Settings;

const xStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    padding: 16,
  },
  section: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
    marginLeft: 8,
  },
  addForm: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  formTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    backgroundColor: 'white',
    color: '#1f2937',
  },
  editInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#6366f1',
    borderRadius: 6,
    padding: 10,
    fontSize: 14,
    backgroundColor: 'white',
    color: '#1f2937',
  },
  fullWidth: {
    flex: 1,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6366f1',
    borderRadius: 8,
    padding: 12,
    gap: 8,
  },
  buttonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  listTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  listItem: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  itemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#e0e7ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  locationAvatar: {
    backgroundColor: '#d1fae5',
  },
  userName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  empId: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  locationName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  itemActions: {
    flexDirection: 'row',
    gap: 8,
  },
  iconButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#f8fafc',
  },
  deleteButton: {
    backgroundColor: '#fef2f2',
  },
  editForm: {
    gap: 12,
  },
  editActions: {
    flexDirection: 'row',
    gap: 8,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10b981',
    borderRadius: 6,
    padding: 10,
    gap: 6,
    flex: 1,
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 6,
    padding: 10,
    gap: 6,
    flex: 1,
  },
  cancelButtonText: {
    color: '#6b7280',
    fontWeight: '600',
    fontSize: 14,
  },
  xHeader: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1f2937",
    marginBottom: 16,
  },
  xSectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
  },
  xListItem: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  xItemContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  xSessionInfo: {
    flex: 1,
  },
  xSessionDate: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1f2937",
  },
  xLocation: {
    fontSize: 13,
    color: "#4b5563",
  },
  xHours: {
    fontSize: 13,
    color: "#6b7280",
  },
  xIconButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: "#f3f4f6",
  },
  xDeleteButton: {
    backgroundColor: "#fee2e2",
  },
  xEmptyText: {
    textAlign: "center",
    color: "#6b7280",
    marginTop: 40,
  },
  xConversionContainer: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: "white",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#f3f4f6",
  },
  xConversionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#6b7280",
   
  },
  xConversionInput: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    marginBottom: 12,
    backgroundColor: "white",
    color: "#1f2937",
  },
  xConversionButton: {
    backgroundColor: "#6366f1",
    padding: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  xConversionButtonText: {
    color: "white",
    fontWeight: "600",
    fontSize: 14,
  },
});