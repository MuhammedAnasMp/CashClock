import React, { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, Button, Alert, TouchableOpacity, FlatList, Modal, ScrollView, ActivityIndicator, RefreshControl } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getDB } from "../xdb/database";
import XLSX from "xlsx-js-style";
import { Directory, File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

interface WorkRow {
  session_id: string;
  emp_id: string;
  username: string;
  location_name: string;
  date: string; // YYYY-MM-DD
  hours_worked: number;
  timesheet_submitted: number;
}

// Map multiple location names to a single group label
// Edit this as needed to combine locations into one Excel file
const locationGroupMap: Record<string, string> = {
  // example: "MAHBOULA - 1": "MAHBOULA",
  // example: "MAHBOULA - 2": "MAHBOULA",
};

function getLocationGroup(name: string): string {
  const direct = locationGroupMap[name];
  if (direct) return direct;
  // default: use the location name as its own group
  return name;
}

export default function MyTimesheet() {
  const [monthOffset, setMonthOffset] = useState(0); // 25-to-25 period offset
  const [rows, setRows] = useState<WorkRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [showGroupModal, setShowGroupModal] = useState(false);


  const { periodStart, periodEnd, periodLabel, titleMonth, titleYear } = useMemo(() => {
    const today = new Date();

    const anchorMonth = today.getDate() >= 25 ? today.getMonth() : today.getMonth() - 1;
    const anchorYear = today.getFullYear();
    const anchor = new Date(Date.UTC(anchorYear, anchorMonth, 25));

    const start = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + monthOffset, 25));
    const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 25)); // exclusive

    const startDisp = new Date(start);
    const endDisp = new Date(end.getTime() - 24 * 60 * 60 * 1000);

    const periodText =
      `25 ${startDisp.toLocaleString("en-US", { month: "short" })} ${startDisp.getUTCFullYear()} - ` +
      `24 ${endDisp.toLocaleString("en-US", { month: "short" })} ${endDisp.getUTCFullYear()}`;

    const titleDate = endDisp;
    const tMonth = titleDate.toLocaleString("en-US", { month: "long" }).toUpperCase();
    const tYear = titleDate.getUTCFullYear();

    return { periodStart: start, periodEnd: end, periodLabel: periodText, titleMonth: tMonth, titleYear: tYear };
  }, [monthOffset]);


  // Load data when header/layout is ready and whenever month changes
  const loadPeriodData = async () => {
    try {
      setLoading(true);
      const db = await getDB();
      const empId = await AsyncStorage.getItem("currentUser");
      if (!empId) return;

      const startStr = periodStart.toISOString().slice(0, 10);
      const endStr = periodEnd.toISOString().slice(0, 10);


      console.log({ startStr, endStr })

      const q = `
  SELECT ws.session_id, ws.emp_id, u.username, l.location_name, ws.date, ws.hours_worked, ws.timesheet_submitted
  FROM WorkSessions ws
  JOIN Locations l ON ws.location_id = l.location_id
  JOIN Users u ON ws.emp_id = u.emp_id
  WHERE ws.emp_id = ? AND ws.date >= ? AND ws.date < ?
  ORDER BY ws.date ASC
`;
      const result = await db.getAllAsync<WorkRow>(q, [empId, startStr, endStr]);

      setRows(result);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };



  useFocusEffect(
    React.useCallback(() => {
      loadPeriodData();
      return () => { };
    }, [periodStart.getTime(), periodEnd.getTime()])
  );

  const groups = useMemo(() => {
    const byGroup: Record<string, WorkRow[]> = {};
    rows.forEach(r => {
      const g = getLocationGroup(r.location_name);
      if (!byGroup[g]) byGroup[g] = [];
      byGroup[g].push(r);
    });
    return byGroup;
  }, [rows]);



  function buildTwoDigitChallenge(): number {
    return Math.floor(Math.random() * 90) + 10; // 10..99
  }

  async function exportGroup(groupName: string, groupRows: WorkRow[]) {
    if (groupRows.length === 0) return;

    const empId = groupRows[0].emp_id;
    const username = groupRows[0].username || "";

    const allDates = [...new Set(groupRows.map(r => r.date))].sort();

    const headerRow = ["EMP ID", "NAME", "LOC", ...allDates.map(d => new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })), "TOTAL"];

    const monthTitleFull = `${titleMonth}-${titleYear}`;
    const title = `PART TIME CASHIER - ${monthTitleFull} (${groupName})`;

    const rowsAoa: (string | number)[][] = [[title], [], headerRow];

    // Aggregate hours per date for this user and group
    const hoursByDate: Record<string, number> = {};
    groupRows.forEach(r => {
      const key = r.date;
      hoursByDate[key] = (hoursByDate[key] || 0) + (Number(r.hours_worked) || 0);
    });

    let total = 0;
    const line: (string | number)[] = [empId, username, groupName];
    allDates.forEach(d => {
      const v = Number(hoursByDate[d] || 0);
      total += v;
      line.push(v === 0 ? "" : v);
    });
    total = Number(total.toFixed(2));
    line.push(total);
    rowsAoa.push(line);

    // Subtotal row in red (as in sample)
    const subtotalRowIndex = rowsAoa.length;
    const subtotalRow: (string | number)[] = Array(headerRow.length).fill("");
    subtotalRow[headerRow.length - 1] = total;
    rowsAoa.push(subtotalRow);

    // Footer signature line like sample
    rowsAoa.push([]);
    rowsAoa.push(["PREPARED BY", "", "MANAGER"]);

    const ws = XLSX.utils.aoa_to_sheet(rowsAoa);

    // Column widths
    ws["!cols"] = Array(headerRow.length).fill({ wch: 12 });

    // Compact rows
    ws["!rows"] = Array(rowsAoa.length).fill({ hpt: 18 });

    // Style cells
    const titleRowIndex = 0;
    const headerRowIndex = 2;
    const footerRowIndex = rowsAoa.length - 1;
    for (let R = 0; R < rowsAoa.length; R++) {
      for (let C = 0; C < headerRow.length; C++) {
        const ref = XLSX.utils.encode_cell({ r: R, c: C });
        const cell = ws[ref];
        if (!cell) continue;
        const isTitle = R === titleRowIndex;
        const isHeader = R === headerRowIndex;
        const isSubtotal = R === subtotalRowIndex && C === headerRow.length - 1;
        const isFooter = R === footerRowIndex;
        cell.s = {
          font: { bold: isTitle || isHeader || isSubtotal || isFooter, color: isSubtotal ? { rgb: "FF0000" } : undefined, sz: isTitle ? 14 : 11 },
          alignment: { horizontal: "center", vertical: "center" },
          border: (isHeader || (R > headerRowIndex && !isFooter)) ? {
            top: { style: "thin", color: { rgb: "000000" } },
            bottom: { style: "thin", color: { rgb: "000000" } },
            left: { style: "thin", color: { rgb: "000000" } },
            right: { style: "thin", color: { rgb: "000000" } },
          } : undefined,
          numFmt: typeof cell.v === "number" ? "0.00" : undefined,
        } as any;
      }
    }

    // Merge title across all columns
    ws["!merges"] = [{ s: { r: titleRowIndex, c: 0 }, e: { r: titleRowIndex, c: headerRow.length - 1 } }];
    // Merge footer caption groups similar to sample (optional aesthetic)
    ws["!merges"].push({ s: { r: footerRowIndex, c: 0 }, e: { r: footerRowIndex, c: 1 } });
    ws["!merges"].push({ s: { r: footerRowIndex, c: 2 }, e: { r: footerRowIndex, c: 3 } });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, groupName.slice(0, 31));
    const correct = buildTwoDigitChallenge();
    const fileName = `${username.replace(/\s+/g, "-").toLowerCase()}-timesheet-${groupName.replace(/\s+/g, "-").toLowerCase()}-${titleMonth.toLowerCase()}-${titleYear}_${correct}.xlsx`;
    const dir = new Directory(Paths.cache);
    const file = new File(dir, fileName);
    await file.write(XLSX.write(wb, { type: "base64", bookType: "xlsx" }), { encoding: "base64" });
    await Sharing.shareAsync(file.uri, {
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      dialogTitle: "Share Timesheet",
    });

    // Two-digit challenge validation before flag update (like MyFare)
    const options: number[] = [correct];
    while (options.length < 3) {
      const n = buildTwoDigitChallenge();
      if (!options.includes(n)) options.push(n);
    }
    options.sort(() => Math.random() - 0.5);

    Alert.alert(
      "Confirm Submission",
      "Use the 2-digit code after the year to update timesheet status. Click the correct code",
      options.map(num => ({
        text: num.toString(),
        onPress: async () => {
          if (num !== correct) {
            Alert.alert("Error", "Numbers do not match. Submission cancelled.");
            return;
          }
          const db = await getDB();
          const ids = groupRows.map(r => r.session_id);
          try {
            await db.execAsync("BEGIN");
            for (const id of ids) {
              await db.runAsync("UPDATE WorkSessions SET timesheet_submitted = 1 WHERE session_id = ?", [id]);
            }
            await db.execAsync("COMMIT");
            Alert.alert("Success", "Selected cards marked as submitted!");
            await loadPeriodData();
            setShowGroupModal(false);
          } catch (e) {
            await db.execAsync("ROLLBACK");
            console.error(e);
            Alert.alert("Error", "Failed to update timesheet.");
          }
        }
      }))
    );
  }

  async function exportAll() {
    for (const [groupName, groupRows] of Object.entries(groups)) {
      await exportGroup(groupName, groupRows);
    }
  }

  const renderGroupCard = ({ item }: { item: [string, WorkRow[]] }) => {
    const [g, list] = item;
    const submittedCount = list.filter(r => r.timesheet_submitted === 1).length;
    const totalHours = list.reduce((acc, r) => acc + (Number(r.hours_worked) || 0), 0);
    // Build compact month -> days mapping like: "jun 26,34"; "mar 2,4,6,9,17,24"
    const uniqueDates = Array.from(new Set(list.map(r => r.date))).sort((a, b) => a.localeCompare(b));
    const monthToDays: Record<string, number[]> = {};
    uniqueDates.forEach(d => {
      const dateObj = new Date(d);
      const mon = dateObj.toLocaleString('en-US', { month: 'short' });
      const day = dateObj.getDate();
      if (!monthToDays[mon]) monthToDays[mon] = [];
      if (!monthToDays[mon].includes(day)) monthToDays[mon].push(day);
    });
    const monthLines = Object.keys(monthToDays).sort((a, b) => {
      // sort by calendar month order using a temp date
      const ai = new Date(`${a} 1, 2000`).getMonth();
      const bi = new Date(`${b} 1, 2000`).getMonth();
      return ai - bi;
    }).map(mon => `${mon} ${monthToDays[mon].sort((x, y) => x - y).join(',')}`);
    return (
      <TouchableOpacity style={styles.card} activeOpacity={0.9} onPress={() => { setSelectedGroup(g); setShowGroupModal(true); }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View>
            <Text style={{ fontSize: 16, fontWeight: 'bold' }}>{g}</Text>
            <Text style={{ fontSize: 14, color: '#555' }}>
              <Text style={{ fontWeight: 'bold', color: '#ff5722' }}>{list.length}</Text> {list.length === 1 ? 'Work day' : 'Work Days'}
            </Text>
          </View>

          {monthLines.length > 0 ? (
            <View style={styles.dateList}>
              {monthLines.map((ln) => (
                <Text key={ln} style={styles.dateLine}>{ln}</Text>
              ))}
            </View>
          ) : null}
        </View>
        <View style={{ flexDirection: "row", marginTop: 8, flexWrap: "wrap" }}>
          <View style={[styles.chip, submittedCount === 0 ? { backgroundColor: "#FFEBEE" } : { backgroundColor: "#e3f2fd" }]}>
            <Text style={[styles.chipText, submittedCount === 0 ? { color: "#C62828" } : null]}>Generated: {submittedCount}</Text>
          </View>
          <View style={[styles.chip, { backgroundColor: "#E8F5E9" }]}>
            <Text style={[styles.chipText, { color: "#2E7D32" }]}>Total Worked: {totalHours.toFixed(2)} hrs</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.subtitle}>{titleMonth} {titleYear} • {periodLabel}</Text>

      <View style={styles.row}>
        <TouchableOpacity style={styles.navBtn} onPress={() => setMonthOffset(v => v - 1)}>
          <Text style={styles.navText}>◀️ Prev</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navBtn} onPress={() => setMonthOffset(0)}>
          <Text style={styles.navText}>🗓️ This Month</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navBtn} onPress={() => setMonthOffset(v => v + 1)}>
          <Text style={styles.navText}>Next ▶️</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.navBtn, { backgroundColor: "#e6f4ff" }]} onPress={loadPeriodData}>
          <Text style={[styles.navText, { color: "#0969da" }]}>⟲ Refresh</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionHeader}>📍 Locations</Text>
      <FlatList
        data={Object.entries(groups)}
        keyExtractor={([g]) => g}
        renderItem={renderGroupCard}
        ListEmptyComponent={<Text style={{ textAlign: "center", marginTop: 20 }}>{loading ? "Loading..." : "No part-time shifts this month."}</Text>}
        contentContainerStyle={{ paddingBottom: 16 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadPeriodData} />}
      />

      {/** Export All button removed as requested */}
      <Modal visible={showGroupModal} animationType="slide" transparent={true} onRequestClose={() => setShowGroupModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{selectedGroup}</Text>
            {/* <Text style={{ textAlign: "center", color: "#666", marginBottom: 8 }}>{titleMonth} {titleYear} • {periodLabel}</Text> */}
            <ScrollView style={{ maxHeight: 320 }}>
              {selectedGroup && groups[selectedGroup] && groups[selectedGroup].map((s, idx) => (
                <View key={s.session_id} style={styles.sessionRow}>
                  <Text style={styles.sessionDate}>{new Date(s.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</Text>
                  <Text style={styles.sessionHours}>{(Number(s.hours_worked) || 0).toFixed(2)} hrs</Text>
                  <View style={[styles.statusPill, { backgroundColor: s.timesheet_submitted ? "#C8E6C9" : "#FFE0B2" }]}>
                    <Text style={{ color: s.timesheet_submitted ? "#2E7D32" : "#E65100", fontWeight: "600" }}>{s.timesheet_submitted ? "Gerated" : "Not Generated"}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 16 }}>
              <TouchableOpacity style={[styles.navBtn, { backgroundColor: "#eee" }]} onPress={() => setShowGroupModal(false)}>
                <Text style={styles.navText}>✖️ Close</Text>
              </TouchableOpacity>
              {selectedGroup && (
                <TouchableOpacity style={styles.exportBtn} onPress={() => exportGroup(selectedGroup, groups[selectedGroup])}>
                  <Text style={styles.exportText}>📤 Generate Excel</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#fff" },
  title: { fontSize: 20, fontWeight: "700", marginBottom: 4 },
  subtitle: { fontSize: 16, color: "#444", marginBottom: 12 },
  row: { flexDirection: "row", gap: 8, marginBottom: 12, alignItems: "center" },
  navBtn: { backgroundColor: "#f0f0f0", paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
  navText: { color: "#000" },
  groupRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#ddd" },
  groupName: { fontWeight: "600" },
  groupMeta: { color: "#666" },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 12, marginBottom: 12, shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 6, elevation: 3 },
  cardGrid: { flexBasis: "48%" },
  exportBtn: { backgroundColor: "#007AFF", paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
  exportText: { color: "#fff", fontWeight: "600" },
  chip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, marginRight: 8, marginBottom: 4 },
  chipText: { color: "#1565C0", fontWeight: "600" },
  datePill: { backgroundColor: "#f1f1f1", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  datePillText: { color: "#333", fontWeight: "700" },
  dateList: { alignItems: "flex-end", marginLeft: 12 },
  dateLine: { color: "#333", fontWeight: "700" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", padding: 16 },
  modalContent: { backgroundColor: "#fff", borderRadius: 12, padding: 16 },
  modalTitle: { fontSize: 18, fontWeight: "700", textAlign: "center", marginBottom: 6 },
  sessionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#eee" },
  sessionDate: { fontWeight: "600", color: "#333" },
  sessionHours: { color: "#555" },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  sectionHeader: { fontSize: 16, fontWeight: "700", marginTop: 8, marginBottom: 8, color: "#222" },
  table: { backgroundColor: "#fafafa", borderRadius: 10, overflow: "hidden", borderWidth: StyleSheet.hairlineWidth, borderColor: "#e5e5e5" },
  tableRow: { flexDirection: "row", paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#e5e5e5" },
  tableCell: { color: "#333" },
});