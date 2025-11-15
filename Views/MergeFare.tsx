import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Button,
  Modal,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import QRCode from "react-native-qrcode-svg";
import { CameraView, CameraType, useCameraPermissions } from "expo-camera";
import Checkbox from "expo-checkbox";
import { deleteBusFareDetailById, getDB, getLocations, getUserByEmpId, insertUser, isLocationExist, upsertUser } from "../xdb/database";
import { useFocusEffect } from "@react-navigation/native";
import { Directory, File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import XLSX from "xlsx-js-style";
interface FareRecord {
  session_id: string;
  location_name: string;
  date: string;
  outbound_cost?: number | string;
  return_cost?: number | string;
  ticket_fare_claimed: number;
  emp_id?: string;
  name?: string;
  location?: string;
  sub_total?: number;
}

interface GroupedData {
  [empId: string]: {
    name: string;
    locations: {
      [location: string]: {
        [date: string]: number;
      };
    };
  };
}
interface UnifiedFare {
  id?: any;
  session_id: string;
  emp_id: string;
  date: string;
  outbound_cost: number;
  return_cost: number;
  shared_from_emp?: string | null;
  shared_to_emp?: string | null;
  is_shared?: boolean;
  location_code?: string | null;
  location_name?: string | null;
  ticket_fare_claimed?: number;
  shared_from_emp_id?: any;
  claimed_by?: any;
}

export default function MergeFare() {
  const [mode, setMode] = useState<"send" | "receive" | "confirm" | null>(null);
  const [locations, setLocations] = useState<any>([]);
  const [facing, setFacing] = useState<CameraType>("back");
  const [fares, setFares] = useState<UnifiedFare[]>([]);
  const [selectedSessions, setSelectedSessions] = useState<string[]>([]);
  const [qrPayload, setQrPayload] = useState<string | null>(null);
  const [confirmationQR, setConfirmationQR] = useState<string | null>(null);
  const [showQRModal, setShowQRModal] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [empId, setEmpId] = useState<any>();
  const [update, setUpdate] = useState(false)
  useFocusEffect(
    React.useCallback(() => {
      const loadData = async () => {
        try {
          const empId = await AsyncStorage.getItem("currentUser");
          setEmpId(empId);
          const db = await getDB();
          const lc = await getLocations()
          setLocations(lc);
          // WorkSessions: include location_name and location_code
          const workRows = await db.getAllAsync(
            `SELECT 
                w.session_id, 
                w.date,
                l.location_name,
                l.location_code,
                w.outbound_cost, 
                w.return_cost, 
                w.ticket_fare_claimed,
                w.emp_id,
                w.claimed_by
            FROM WorkSessions w
            JOIN Locations l ON w.location_id = l.location_id
            WHERE w.emp_id = ?
              AND (w.outbound_cost + w.return_cost) != 0`,
            [empId]
          );

          // BusFareDetails: include fallback location join (both name and code)
          const busFareRows = await db.getAllAsync(
            `SELECT 
            b.id ,
          b.session_id,
          b.date,
          b.outbound_cost,
          b.return_cost,
          b.shared_from_emp_id,
          COALESCE(u_from.username, b.shared_from_emp) AS shared_from_emp,
          COALESCE(u_to.username, b.shared_to_emp) AS shared_to_emp,
          COALESCE(l1.location_name, l2.location_name) AS location_name, -- ✅ fallback
          COALESCE(l1.location_code, l2.location_code, b.location_code) AS location_code, -- ✅ fallback
          b.ticket_fare_claimed,
          b.emp_id
       FROM BusFareDetails b
       LEFT JOIN WorkSessions w ON b.session_id = w.session_id
       LEFT JOIN Locations l1 ON w.location_id = l1.location_id
       LEFT JOIN Locations l2 ON b.location_code = l2.location_code
       LEFT JOIN Users u_from ON b.shared_from_emp = u_from.emp_id
       LEFT JOIN Users u_to ON b.shared_to_emp = u_to.emp_id
       WHERE b.emp_id = ? OR b.shared_to_emp = ? OR b.shared_from_emp = ?`,
            [empId, empId, empId]
          );

          console.log('busFareRows', busFareRows)

          const map = new Map<string, UnifiedFare>();

          // WorkSessions entries
          (workRows || []).forEach((w: any) => {
            const fare: UnifiedFare = {
              session_id: w.session_id,
              date: w.date,
              emp_id: w.emp_id,
              location_name: w.location_name,
              location_code: w.location_code,
              outbound_cost: w.outbound_cost,
              return_cost: w.return_cost,
              shared_from_emp: null,
              shared_to_emp: null,
              is_shared: false,
              ticket_fare_claimed: w.ticket_fare_claimed,
              claimed_by: w.claimed_by


            };
            map.set(w.session_id, fare);
          });

          // BusFareDetails entries
          (busFareRows || []).forEach((b: any) => {
            const fare: UnifiedFare = {
              id: b.id,
              session_id: b.session_id,
              date: b.date,
              emp_id: b.emp_id,
              location_name: b.location_name,
              location_code: b.location_code,
              outbound_cost: b.outbound_cost,
              return_cost: b.return_cost,
              shared_from_emp: b.shared_from_emp,
              shared_to_emp: b.shared_to_emp,
              is_shared: true,
              ticket_fare_claimed: b.ticket_fare_claimed,
              shared_from_emp_id: b.shared_from_emp_id
            };
            map.set(b.session_id, fare);
          });

          const unified = Array.from(map.values()).sort((a, b) => (a.date < b.date ? 1 : -1));

          setFares(unified);
        } catch (err) {
          console.error("Error loading fares:", err);
        }
      };

      loadData();
    }, [mode, update])
  );



  const groupByMonth = (items: UnifiedFare[]) => {
    const grouped: Record<string, UnifiedFare[]> = {};
    items.forEach((item) => {
      const month = item.date?.slice(0, 7) || "unknown";
      if (!grouped[month]) grouped[month] = [];
      grouped[month].push(item);
    });
    return grouped;
  };

  const groupedFares = groupByMonth(fares);

  const toggleSelect = (sessionId: string) => {
    setSelectedSessions((prev) =>
      prev.includes(sessionId) ? prev.filter((id) => id !== sessionId) : [...prev, sessionId]
    );
  };

  const exportSelected = async () => {
    const selectedFares = fares.filter((f) => selectedSessions.includes(f.session_id));
    if (selectedFares.length === 0) {
      Alert.alert("No Selection", "Please select at least one fare to submit.");
      return;
    }

    const getLocationName = (locCode: string | null | undefined): string => {
      if (!locCode) return "Unknown";
      const loc = locations.find((l: any) => l.location_code === locCode);
      return loc?.location_name || "Unknown";
    };




    try {
      const db = await getDB();

      const man: any = await getUserByEmpId(empId || '');
      console.log("locations >", locations)
      console.log("selectedFares >", selectedFares)
      // Generate JSON for HR submission (this becomes your XLSX data)
      const jsonData = selectedFares.map(f => {
        const out = Number(f.outbound_cost) || 0;
        const ret = Number(f.return_cost) || 0;
        return {
          emp_id: f.is_shared ? f.shared_from_emp_id : empId,
          name: f.is_shared ? f.shared_from_emp : man.username || "unknown",
          location: getLocationName(f.location_code) || "Unknown",
          date: f.date,
          sub_total: out + ret
        };
      });
      console.log(jsonData)

      const correctNumber = Math.floor(Math.random() * 90) + 10;
      await generateExcel(jsonData, correctNumber);


      const numbers = [correctNumber];
      while (numbers.length < 3) {
        const n = Math.floor(Math.random() * 90) + 10;
        if (!numbers.includes(n)) numbers.push(n);
      }
      numbers.sort(() => Math.random() - 0.5);

      Alert.alert(
        "Confirm Submission",
        `Use the 2-digit code after the year to update fare status. Click the correct code`,
        numbers.map((num) => ({
          text: num.toString(),
          onPress: async () => {
            if (num !== correctNumber) {
              Alert.alert("Error", "Numbers do not match. Submission cancelled.");
              return;
            }

            try {
              // Update DB only if correct
              for (let f of selectedFares) {
                await db.runAsync(
                  `UPDATE WorkSessions SET ticket_fare_claimed = 1 WHERE session_id = ?`,
                  [f.session_id]
                );
              }

              Alert.alert("Success", "Selected fares marked as claimed!");
            } catch (error) {
              console.error(error);
              Alert.alert("Error", "Failed to update fares.");
            }
          },
        }))
      );

    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Failed to fetch username.");
    }

  };

  const handleDelete = async (
    id: number,
    sharedFrom: string | null,
    locationName: string | null
  ) => {
    Alert.alert(
      "Confirm Delete",
      `Are you sure you want to delete this entry?\n\nShared From: ${sharedFrom ?? "N/A"}\nLocation: ${locationName ?? "N/A"}`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await deleteBusFareDetailById(id);
            setUpdate((prev) => !prev)
          },
        },
      ]
    );
  };

  const generateExcel = async (data: any[], code: number): Promise<void> => {
    // Example data
    // const data: any[] = [
    //   { emp_id: "71289", name: "ASLAM", location: "FARWANIYA", date: "2025-10-04", sub_total: 0.5 },
    //   { emp_id: "71289", name: "ASLAM", location: "FARWANIYA", date: "2025-10-16", sub_total: 2.25 },
    //   { emp_id: "71289", name: "ASLAM", location: "JALEEB", date: "2025-10-04", sub_total: 1 },
    //   { emp_id: "71289", name: "ASLAM", location: "JALEEB", date: "2025-10-26", sub_total: 0.5 },
    //   { emp_id: "1486", name: "ANAS", location: "Mangaf", date: "2025-10-04", sub_total: 0.5 },
    //   { emp_id: "1486", name: "ANAS", location: "Mangaf", date: "2025-10-27", sub_total: 1 },
    // ];


    const allDates = [...new Set(data.map((r) => r.date))].sort();

    // Group data by employee & location
    const grouped: GroupedData = {};
    data.forEach((r) => {
      if (!grouped[r.emp_id]) grouped[r.emp_id] = { name: r.name, locations: {} };
      if (!grouped[r.emp_id].locations[r.location]) grouped[r.emp_id].locations[r.location] = {};
      grouped[r.emp_id].locations[r.location][r.date] = r.sub_total;
    });
    const formatDate = (date: string): string => {
      const d = new Date(date);
      const day = String(d.getDate()).padStart(2, "0");
      const month = d.toLocaleString("en-US", { month: "short" });
      const year = String(d.getFullYear()).slice(-2);
      return `${day}-${month}-${year}`;
    };
    const headerRow = ["NO", "EMP ID", "NAME", "LOCATION", ...allDates.map(formatDate), "TOTAL"];
    const monthName = new Date().toLocaleString("en-US", { month: "short" }).toUpperCase();
    const year = new Date().getFullYear();

    const rows: (string | number)[][] = [
      [`PART TIME CASHIER BUS FARE - ${monthName} - ${year}`],
      [],
      headerRow,
    ];

    let rowNo = 1;
    let grandTotal = 0;

    Object.keys(grouped).forEach((empId) => {
      const { name, locations } = grouped[empId];
      const locationNames = Object.keys(locations);

      locationNames.forEach((loc, locIndex) => {
        const row: (string | number)[] = [];
        if (locIndex === 0) {
          row.push(rowNo++, empId, name, loc);
        } else {
          row.push("", "", "", loc);
        }

        let total = 0;
        allDates.forEach((d) => {
          const val = locations[loc][d];
          if (val) {
            total += val;
            row.push(val);
          } else {
            row.push("");
          }
        });
        total = Number(total.toFixed(2));
        grandTotal += total;
        row.push(total);
        rows.push(row);
      });
      rows.push([]);
    });

    // GRAND TOTAL row
    const grandTotalRowIndex = rows.length;
    const grandTotalRow: (string | number)[] = Array(headerRow.length).fill("");
    grandTotalRow[headerRow.length - 2] = "SUBTOTAL";
    grandTotalRow[headerRow.length - 1] = Number(grandTotal.toFixed(2));
    rows.push(grandTotalRow);

    // Footer row
    rows.push([]);
    rows.push(["P/B:", "", "HRM:", "", "FM:", "", "COO:"]);

    // Worksheet
    const ws = XLSX.utils.aoa_to_sheet(rows);

    // Auto-fit columns based on header + data only (ignore merged title/footer)
    const startRow = 2; // header row
    const endRow = rows.length - 3; // skip footer row
    const colWidths: { wch: number }[] = [];
    for (let C = 0; C <= headerRow.length - 1; ++C) {
      let maxLength = 0;
      for (let R = startRow; R <= endRow; ++R) {
        const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
        const cell = ws[cellRef];
        if (cell && cell.v) {
          const cellLength = String(cell.v).length;
          if (cellLength > maxLength) maxLength = cellLength;
        }
      }
      colWidths[C] = { wch: Math.min(maxLength + 2, 30) }; // padding + max width
    }
    ws["!cols"] = colWidths;

    // Compact rows
    ws["!rows"] = Array(rows.length).fill({ hpt: 15 });

    // Page setup for single A4 landscape page
    ws["!pageSetup"] = {
      orientation: "landscape",
      paperSize: 9, // A4
      fitToWidth: 1,
      fitToHeight: 1,
      scale: 75,
      margins: { left: 0.5, right: 0.5, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 },
    };
    const range = XLSX.utils.decode_range(ws["!ref"]!);
    // Set print area
    ws["!printArea"] = XLSX.utils.encode_range(range);

    // Style cells
    for (let R = 0; R <= rows.length - 1; ++R) {
      for (let C = 0; C <= headerRow.length - 1; ++C) {
        const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
        const cell = ws[cellRef];
        if (!cell) continue;

        const isTitle = R === 0;
        const isHeader = R === 2;
        const isFooter = R === rows.length - 1;
        const isGrandTotalRow = R === grandTotalRowIndex;
        const isGrandTotalCell =
          isGrandTotalRow &&
          (C === headerRow.length - 2 || C === headerRow.length - 1);

        const showBorder = !isFooter && !isGrandTotalRow && !isTitle;

        cell.s = {
          font: { bold: isHeader || isTitle || isGrandTotalCell, sz: isTitle ? 14 : 11 },
          alignment: { horizontal: "center", vertical: "center" },
          border: showBorder || isGrandTotalCell
            ? {
              top: { style: "thin", color: { rgb: "000000" } },
              bottom: { style: "thin", color: { rgb: "000000" } },
              left: { style: "thin", color: { rgb: "000000" } },
              right: { style: "thin", color: { rgb: "000000" } },
            }
            : undefined,
        };
      }
    }

    // Merge title
    ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: headerRow.length - 1 } }];
    // Merge GRAND TOTAL first 4 columns
    ws["!merges"].push({ s: { r: grandTotalRowIndex, c: 0 }, e: { r: grandTotalRowIndex, c: 3 } });

    // Merge footer cells and align left
    const footerRowIndex = rows.length - 1;
    ws["!merges"].push({ s: { r: footerRowIndex, c: 0 }, e: { r: footerRowIndex, c: 1 } }); // PREPARED BY
    ws["!merges"].push({ s: { r: footerRowIndex, c: 2 }, e: { r: footerRowIndex, c: 3 } }); // HRM
    ws["!merges"].push({ s: { r: footerRowIndex, c: 4 }, e: { r: footerRowIndex, c: 5 } }); // FM
    ws["!merges"].push({ s: { r: footerRowIndex, c: 6 }, e: { r: footerRowIndex, c: 7 } }); // COO

    for (let C = 0; C <= 6; C += 2) {
      const cellRef = XLSX.utils.encode_cell({ r: footerRowIndex, c: C });
      if (ws[cellRef]) {
        ws[cellRef].s = {
          ...(ws[cellRef].s || {}),
          alignment: { horizontal: "left", vertical: "center" },
          font: { bold: true },
        };
      }
    }

    // Create workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Report");

    // Dynamic file name
    const employeeNames = [...new Set(data.map((r) => r.name))].join("-").toLowerCase();
    const fileName = `${employeeNames}-fare-${monthName}-${year}_${code}.xlsx`;

    const dir = new Directory(Paths.cache);
    const file = new File(dir, fileName);

    await file.write(XLSX.write(wb, { type: "base64", bookType: "xlsx" }), {
      encoding: "base64",
    });

    await Sharing.shareAsync(file.uri, {
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      dialogTitle: "Share Bus Fare Report",
    });
  };



  const generateShareQR = async () => {
    if (selectedSessions.length === 0) {
      Alert.alert("Select at least one fare to share");
      return;
    }
    const user = await AsyncStorage.getItem("currentUser");
    const selectedFares = fares.filter(
      (f) => selectedSessions.includes(f.session_id) && !f.is_shared
    );
    const skipped = selectedSessions.filter(
      (id) => !selectedFares.find((f) => f.session_id === id)
    );

    if (selectedFares.length === 0) {
      Alert.alert("No selectable fares to share (selected items are shared receipts).");
      return;
    }

    const man = await getUserByEmpId(user || '');



    const payload = {
      type: "fare_share",
      from_user: man,
      sessions: selectedFares.map((s) => (
        {
          session_id: s.session_id,
          date: s.date,
          outbound_cost: s.outbound_cost,
          return_cost: s.return_cost,
          total_fare: s.outbound_cost + s.return_cost,
          location_code: s.location_code,
          location_name: s.location_name,
        })),
    };






    if (skipped.length) {
      Alert.alert("Note", `Skipped ${skipped.length} shared card(s) from the share payload.`);
    }
    setQrPayload(JSON.stringify(payload));
    setShowQRModal(true);
    setMode("send");

  };

  const handleScannedQR = async (data: string) => {
    try {
      const parsed = JSON.parse(data);



      if (parsed.type === "fare_share") {
        const missingLocations: { code: string; name?: string | null }[] = [];

        for (const s of parsed.sessions) {
          const exists = await isLocationExist(s.location_code);

          if (!exists) {
            missingLocations.push({ code: s.location_code, name: s.location_name });
          }
        }


        if (missingLocations.length > 0) {
          const formatted = missingLocations
            .map(
              (loc) =>
                `${loc.code}${loc.name ? ` (${loc.name})` : ""}`
            )
            .join(", ");

          Alert.alert(
            "Error",
            `❌ The following location codes mismatch do not exist: ${formatted}.  Please create them on the receiving device first.`
          );

          setMode(null);
          setScanned(false);
          return;
        } else {
          if (scanned) return;
          setScanned(true);
        }

        console.log("✅ All locations exist!");
      }





      const db = await getDB();

      if (parsed.type === "fare_confirmation") {

        await upsertUser(parsed.to_user.emp_id, parsed.to_user.username);

        for (const id of parsed.received_sessions) {
          await db.runAsync(`UPDATE WorkSessions SET ticket_fare_claimed = 1 , claimed_by = ?  WHERE session_id = ? `, [parsed.to_user.emp_id, id]);
        }
        Alert.alert("✅ Confirmation received and updated!");
        setMode(null);
        setShowQRModal(false);
        setScanned(false);
        return;
      }

      if (parsed.type === "fare_share") {



        const empId = await AsyncStorage.getItem("currentUser");

        // If all locations exist, continue with the inserts
        await upsertUser(parsed.from_user.emp_id, parsed.from_user.username);


        for (const s of parsed.sessions) {
          await db.runAsync(
            `INSERT INTO BusFareDetails (
        session_id, emp_id, date, outbound_cost, return_cost, shared_from_emp, shared_to_emp, location_code , shared_from_emp_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?,?, ?)`,
            [s.session_id, empId, s.date, s.outbound_cost, s.return_cost, parsed.from_user.emp_id, empId, s.location_code, parsed.from_user.emp_id]
          );
        }
        const user = await AsyncStorage.getItem("currentUser")
        const man = await getUserByEmpId(user || '');
        const confirmationPayload = {
          type: "fare_confirmation",
          received_sessions: parsed.sessions.map((s: any) => s.session_id),
          from_user: parsed.from_user,
          to_user: man,
        };

        setConfirmationQR(JSON.stringify(confirmationPayload));
        setShowQRModal(true);
        setMode("confirm");

      }
    } catch (err: any) {
      console.error("Error processing shared fare:", err.message);
      // ✅ show readable error in React Native
    }
    setScanned(false);
  };

  const handleCloseModal = () => {
    setShowQRModal(false);
    if (mode === "send") {
      setMode("receive");
      setScanned(false);
      if (!permission || !permission.granted) {
        requestPermission();
      }
    } else {
      setMode(null);
    }
  };

  const hasSharedSelected = selectedSessions.some(
    (id) => fares.find((f) => f.session_id === id)?.is_shared
  );





  return (
    <View style={{ flex: 1, padding: 15, backgroundColor: "#f9fafb" }}>
      {!mode && (
        <>
          {/* Scrollable card list */}
          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>


            {Object.keys(groupedFares).length === 0 && (
              <Text style={{ marginBottom: 12 }}>No fares found.</Text>
            )}

            {Object.keys(groupedFares).map((month) => (
              <View key={`month-${month}`} style={styles.monthContainer}>
                <Text style={styles.monthTitle}>📅 {month}</Text>

                {groupedFares[month].map((item) => {
                  const selected = selectedSessions.includes(item.session_id);
                  return (
                    <View
                      key={`${month}-${item.session_id}`}
                      style={[styles.card, selected && styles.selectedCard]}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                        }}
                      >
                        <Text style={styles.cardTitle}>
                          🏪 {item.location_name}{" "}
                          {item.is_shared && (
                            <Text style={styles.sharedBadge}>🔁 Shared</Text>
                          )}
                        </Text>

                        <Checkbox
                          value={selected}
                          onValueChange={() => toggleSelect(item.session_id)}
                          color={selected ? "#1170feff" : undefined}
                        />
                      </View>
                      {item.is_shared && (
                        <Text style={styles.sharedBadge}>
                          👥 From: {item.shared_from_emp || "Unknown"}
                        </Text>
                      )}
                      <Text>📆 {item.date}</Text>
                      <Text>➡️ Outbound: {item.outbound_cost}</Text>
                      <Text>⬅️ Return: {item.return_cost}</Text>
                      <View style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "center"
                      }}>
                        <Text>🎫 Total: {item.outbound_cost + item.return_cost}</Text>

                        <Text
                          style={[
                            styles.status,
                            {
                              color: item.ticket_fare_claimed == 1 ? "#28a745" : "#d9534f",
                            },
                          ]}
                        >
                          {item.ticket_fare_claimed == 1 ?  "✅ Excel Generated" : "❌ Not Generated"}
                        </Text>
                      </View>

                      {item.is_shared && (
                            <TouchableOpacity
                              onPress={async () => {
                                await deleteBusFareDetailById(item.id);
                                handleDelete(
                                  item.id,
                                  item.shared_from_emp ?? null,
                                  item.location_name ?? null
                                )
                              }}
                              style={{
                                alignSelf: "flex-start",       // fits the text
                                backgroundColor: "#ff4d4f",    // red button feel
                                paddingVertical: 6,
                                paddingHorizontal: 12,
                                borderRadius: 6,
                                shadowColor: "#000",           // subtle shadow (iOS)
                                shadowOffset: { width: 0, height: 2 },
                                shadowOpacity: 0.25,
                                shadowRadius: 3.84,
                                elevation: 5,                  // shadow for Android
                              }}
                              activeOpacity={0.7}              // touch feedback
                            >
                              <Text style={{ color: "#fff", fontWeight: "bold" }}>Delete Shared</Text>  
                            </TouchableOpacity>
                          )}


                    </View> 
                  );
                })}
              </View>
            ))}
            
          </ScrollView>

          {/* Fixed bottom buttons */}
          {
            selectedSessions.length >0 &&
          <View style={{ paddingVertical: 10, borderTopWidth: 1, borderColor: "#ddd", paddingBottom: 50 }}>
            {!hasSharedSelected && (
              <>
                <Button
                  title="Share My Fare "
                  onPress={generateShareQR}
                />
                <View style={{ height: 10 }} />
                <Button title="Receive Any Fare" onPress={() => setMode("receive")} />
                <View style={{ height: 10 }} />
              </>
            )}
            <Button title="Generate Excel " onPress={exportSelected} />
          </View>
          }
        </>
      )}
     

      {/* Receive and QR modal sections remain unchanged */}
      {mode === "receive" && (
        <View style={{ flex: 1 }}>
          {!permission || !permission.granted ? (
            <View style={styles.center}>
              <Text>Camera access required</Text>
              <Button title="Grant Permission" onPress={requestPermission} />
            </View>
          ) : (
            <>
              <Text style={styles.header}>📷 Scan QR </Text>
              <CameraView
                facing={facing}
                style={{ flex: 1, borderRadius: 12, marginTop: 10 }}
                barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                onBarcodeScanned={({ data }) => data && handleScannedQR(data)}
              />

              <View style={{ marginBottom: 50, marginTop: 50 }}>
                <TouchableOpacity
                  onPress={() => {
                    setFacing(prev => {
                      if (prev === 'back') {
                        return 'front';
                      } else {
                        return 'back';
                      }
                    });
                  }}
                  style={{
                    bottom: 8,
                    alignItems: 'center',
                    borderColor: "gray",
                    borderWidth: 1,
                    paddingVertical: 4,
                    paddingHorizontal: 8,
                    borderRadius: 6,
                  }}
                >
                  <Text style={{ fontSize: 16 }}>Camera 🔃</Text>
                </TouchableOpacity>
                <Button title="Back" onPress={() => setMode(null)} />
              </View>
            </>
          )}
        </View>
      )}

      <Modal visible={showQRModal} transparent animationType="fade">
        <View style={styles.modalContainer}>
          <View style={styles.qrContainer}>
            {mode === "send" && qrPayload && (
              <>
                <Text style={{ marginBottom: 8 }}>
                  📤 Scan QR then only click open scanner
                </Text>
                <QRCode value={qrPayload} size={250} />
              </>
            )}
            {mode === "confirm" && confirmationQR && (
              <>
                <Text style={{ marginBottom: 8 }}>
                  ✅ Show this QR to sender for confirmation:
                </Text>
                <QRCode value={confirmationQR} size={250} />
              </>
            )}
            <View style={{ height: 12 }} />
            <Button title={mode === "send" && qrPayload ? 'Open Scanner' : 'Close confirmation'} onPress={handleCloseModal} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { fontSize: 22, fontWeight: "bold", marginBottom: 15, textAlign: 'center' },
  monthContainer: { marginBottom: 20 },
  monthTitle: { fontWeight: "700", fontSize: 16, marginBottom: 6 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  selectedCard: {
    borderColor: "#1170feff",
    borderWidth: 1,
    // backgroundColor: "#dcfce7",
  },
  sharedBadge: {
    marginTop: 6,
    color: "#1e3a8a",
    fontWeight: "600",
  },
  cardTitle: { fontWeight: "600", marginBottom: 6 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  modalContainer: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  qrContainer: {
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 12,
    alignItems: "center",
  },
  status: {
    marginTop: 8,
    fontWeight: "600",
    textAlign: "right",
  },
});
