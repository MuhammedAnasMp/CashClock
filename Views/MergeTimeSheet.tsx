import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Modal, Button } from "react-native";
import { CameraView, CameraType, useCameraPermissions } from "expo-camera";
import QRCode from "react-native-qrcode-svg";

export default function MergeTimesheet() {
  const [showCamera, setShowCamera] = useState(false);
  const [facing, setFacing] = useState<CameraType>("back");
  const [scannedData, setScannedData] = useState<string | null>(null);
  const [showQRModal, setShowQRModal] = useState(false);

  const [permission, requestPermission] = useCameraPermissions();

  // Data to share as QR
  const shareData = {
    user: "John Doe",
    id: 10857,
    date: "2025-10-27",
  };

  const toggleCameraFacing = () => {
    setFacing(current => (current === "back" ? "front" : "back"));
  };

  const handleScanQR = () => {
    if (permission?.granted) {
      setShowCamera(true);
    } else {
      requestPermission();
    }
  };

  const handleBarcodeScanned = ({ data }: { data: string }) => {
    setScannedData(data);
    setShowCamera(false);
    alert(`Scanned QR: ${data}`);
  };

  if (!permission) return <View style={styles.container} />;

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>We need your permission to show the camera</Text>
        <Button title="Grant Permission" onPress={requestPermission} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Buttons shown initially */}
      {!showCamera && (
        <View style={styles.buttonSection}>
          <TouchableOpacity style={styles.mainButton} onPress={handleScanQR}>
            <Text style={styles.buttonText}>Scan QR Code</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.mainButton}
            onPress={() => setShowQRModal(true)}
          >
            <Text style={styles.buttonText}>Share QR Code</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Camera for scanning */}
      {showCamera && (
        <View style={styles.cameraContainer}>
          <CameraView
            style={styles.camera}
            facing={facing}
            onBarcodeScanned={handleBarcodeScanned}
          />

          {/* Overlay buttons */}
          <View style={styles.overlay}>
            <TouchableOpacity style={styles.button} onPress={toggleCameraFacing}>
              <Text style={{ color: "white" }}>Flip Camera</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, { marginTop: 10 }]} onPress={() => setShowCamera(false)}>
              <Text style={{ color: "white" }}>Close Camera</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* QR Code modal */}
      <Modal visible={showQRModal} transparent={true} animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.qrBox}>
            <Text style={{ marginBottom: 20, fontWeight: "bold" }}>Share QR Code</Text>
            <QRCode value={JSON.stringify(shareData)} size={200} />
            <Button title="Close" onPress={() => setShowQRModal(false)} />
          </View>
        </View>
      </Modal>

      {/* Last scanned data */}
      {scannedData && (
        <Text style={{ textAlign: "center", marginTop: 10 }}>
          Last Scanned: {scannedData}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center" },
  buttonSection: { width: "80%" },
  mainButton: {
    backgroundColor: "#007AFF",
    padding: 15,
    borderRadius: 8,
    marginVertical: 10,
  },
  buttonText: { color: "white", textAlign: "center", fontSize: 18 },
  cameraContainer: { flex: 1, width: "100%" },
  camera: { flex: 1 },
  overlay: {
    position: "absolute",
    bottom: 50,
    width: "100%",
    alignItems: "center",
  },
  button: {
    backgroundColor: "#00000080",
    padding: 10,
    borderRadius: 5,
  },
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#00000080",
  },
  qrBox: {
    width: 250,
    height: 300,
    backgroundColor: "white",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 10,
  },
  message: { textAlign: "center", paddingBottom: 10 },
});









// import React, { useEffect, useState } from "react";
// import {
//   View,
//   Text,
//   Button,
//   Modal,
//   StyleSheet,
//   ScrollView,
//   Alert,
//   TouchableOpacity,
// } from "react-native";
// import AsyncStorage from "@react-native-async-storage/async-storage";
// import QRCode from "react-native-qrcode-svg";
// import { CameraView, CameraType, useCameraPermissions } from "expo-camera";
// import Checkbox from "expo-checkbox";
// import { getDB, getUserByEmpId, insertUser, isLocationExist, upsertUser } from "../xdb/database";
// import { useFocusEffect } from "@react-navigation/native";

// interface UnifiedFare {
//   session_id: string;
//   date: string;
//   outbound_cost: number;
//   return_cost: number;
//   shared_from_emp?: string | null;
//   shared_to_emp?: string | null;
//   is_shared?: boolean;
//   location_code?: string | null;
//   location_name?: string | null;
//   ticket_fare_claimed?: number;
// }

// export default function MergeFare() {
//   const [mode, setMode] = useState<"send" | "receive" | "confirm" | null>(null);
//   const [facing, setFacing] = useState<CameraType>("back");
//   const [fares, setFares] = useState<UnifiedFare[]>([]);
//   const [selectedSessions, setSelectedSessions] = useState<string[]>([]);
//   const [qrPayload, setQrPayload] = useState<string | null>(null);
//   const [confirmationQR, setConfirmationQR] = useState<string | null>(null);
//   const [showQRModal, setShowQRModal] = useState(false);
//   const [permission, requestPermission] = useCameraPermissions();
//   const [scanned, setScanned] = useState(false);

//   useFocusEffect(
//     React.useCallback(() => {
//       const loadData = async () => {
//         try {
//           const empId = await AsyncStorage.getItem("currentUser");
//           const db = await getDB();

//           // WorkSessions: include location_name and location_code
//           const workRows = await db.getAllAsync(
//             `SELECT 
//           w.session_id, 
//           w.date,
//           l.location_name,
//           l.location_code,
//           w.outbound_cost, 
//           w.return_cost, 
//           w.ticket_fare_claimed
//        FROM WorkSessions w
//        JOIN Locations l ON w.location_id = l.location_id
//        WHERE w.emp_id = ?`,
//             [empId]
//           );

//           // BusFareDetails: include fallback location join (both name and code)
//           const busFareRows = await db.getAllAsync(
//             `SELECT 
//           b.session_id,
//           b.date,
//           b.outbound_cost,
//           b.return_cost,
//           COALESCE(u_from.username, b.shared_from_emp) AS shared_from_emp,
//           COALESCE(u_to.username, b.shared_to_emp) AS shared_to_emp,
//           COALESCE(l1.location_name, l2.location_name) AS location_name, -- ✅ fallback
//           COALESCE(l1.location_code, l2.location_code, b.location_code) AS location_code, -- ✅ fallback
//           b.ticket_fare_claimed
//        FROM BusFareDetails b
//        LEFT JOIN WorkSessions w ON b.session_id = w.session_id
//        LEFT JOIN Locations l1 ON w.location_id = l1.location_id
//        LEFT JOIN Locations l2 ON b.location_code = l2.location_code
//        LEFT JOIN Users u_from ON b.shared_from_emp = u_from.emp_id
//        LEFT JOIN Users u_to ON b.shared_to_emp = u_to.emp_id
//        WHERE b.emp_id = ? OR b.shared_to_emp = ? OR b.shared_from_emp = ?`,
//             [empId, empId, empId]
//           );

//           const map = new Map<string, UnifiedFare>();

//           // WorkSessions entries
//           (workRows || []).forEach((w: any) => {
//             const fare: UnifiedFare = {
//               session_id: w.session_id,
//               date: w.date,
//               location_name: w.location_name,
//               location_code: w.location_code,
//               outbound_cost: w.outbound_cost,
//               return_cost: w.return_cost,
//               shared_from_emp: null,
//               shared_to_emp: null,
//               is_shared: false,
//               ticket_fare_claimed: w.ticket_fare_claimed,
//             };
//             map.set(w.session_id, fare);
//           });

//           // BusFareDetails entries
//           (busFareRows || []).forEach((b: any) => {
//             const fare: UnifiedFare = {
//               session_id: b.session_id,
//               date: b.date,
//               location_name: b.location_name,
//               location_code: b.location_code,
//               outbound_cost: b.outbound_cost,
//               return_cost: b.return_cost,
//               shared_from_emp: b.shared_from_emp,
//               shared_to_emp: b.shared_to_emp,
//               is_shared: true,
//               ticket_fare_claimed: b.ticket_fare_claimed,
//             };
//             map.set(b.session_id, fare);
//           });

//           const unified = Array.from(map.values()).sort((a, b) => (a.date < b.date ? 1 : -1));

//           setFares(unified);
//         } catch (err) {
//           console.error("Error loading fares:", err);
//         }
//       };

//       loadData();
//     }, [mode])
//   );



//   const groupByMonth = (items: UnifiedFare[]) => {
//     const grouped: Record<string, UnifiedFare[]> = {};
//     items.forEach((item) => {
//       const month = item.date?.slice(0, 7) || "unknown";
//       if (!grouped[month]) grouped[month] = [];
//       grouped[month].push(item);
//     });
//     return grouped;
//   };

//   const groupedFares = groupByMonth(fares);

//   const toggleSelect = (sessionId: string) => {
//     setSelectedSessions((prev) =>
//       prev.includes(sessionId) ? prev.filter((id) => id !== sessionId) : [...prev, sessionId]
//     );
//   };

//   const exportSelected = () => {
//     const selected = fares.filter((f) => selectedSessions.includes(f.session_id));
//     console.log("selected",selected)
//     Alert.alert(`Console logged ${selected.length} selected items (for Excel).`);
//   };

//   const generateShareQR = async () => {
//     if (selectedSessions.length === 0) {
//       Alert.alert("Select at least one fare to share");
//       return;
//     }
//     const user = await AsyncStorage.getItem("currentUser");
//     const selectedFares = fares.filter(
//       (f) => selectedSessions.includes(f.session_id) && !f.is_shared
//     );
//     const skipped = selectedSessions.filter(
//       (id) => !selectedFares.find((f) => f.session_id === id)
//     );

//     if (selectedFares.length === 0) {
//       Alert.alert("No selectable fares to share (selected items are shared receipts).");
//       return;
//     }

//     const man = await getUserByEmpId(user || '');



//     const payload = {
//       type: "fare_share",
//       from_user: man,
//       sessions: selectedFares.map((s) => (
//         {
//           session_id: s.session_id,
//           date: s.date,
//           outbound_cost: s.outbound_cost,
//           return_cost: s.return_cost,
//           total_fare: s.outbound_cost + s.return_cost,
//           location_code: s.location_code,
//           location_name: s.location_name,
//         })),
//     };






//     if (skipped.length) {
//       Alert.alert("Note", `Skipped ${skipped.length} shared card(s) from the share payload.`);
//     }
//     setQrPayload(JSON.stringify(payload));
//     setShowQRModal(true);
//     setMode("send");

//   };

//   const handleScannedQR = async (data: string) => {
//     try {
//       const parsed = JSON.parse(data);



//       if (parsed.type === "fare_share") {
//         const missingLocations: { code: string; name?: string | null }[] = [];

//         for (const s of parsed.sessions) {
//           const exists = await isLocationExist(s.location_code);

//           if (!exists) {
//             missingLocations.push({ code: s.location_code, name: s.location_name });
//           }
//         }


//         if (missingLocations.length > 0) {
//           const formatted = missingLocations
//             .map(
//               (loc) =>
//                 `${loc.code}${loc.name ? ` (${loc.name})` : ""}`
//             )
//             .join(", ");

//           Alert.alert(
//             "Error",
//             `❌ The following location codes mismatch do not exist: ${formatted}.  Please create them on the receiving device first.`
//           );

//           setMode(null);
//           setScanned(false);
//           return;
//         } else {
//           if (scanned) return;
//           setScanned(true);
//         }

//         console.log("✅ All locations exist!");
//       }





//       const db = await getDB();

//       if (parsed.type === "fare_confirmation") {

//         await upsertUser(parsed.from_user.emp_id, parsed.from_user.username);

//         for (const id of parsed.received_sessions) {
//           await db.runAsync(`UPDATE WorkSessions SET ticket_fare_claimed = 1 WHERE session_id = ?`, [
//             id,
//           ]);
//         }
//         Alert.alert("✅ Confirmation received and updated!");
//         setMode(null);
//         setShowQRModal(false);
//         setScanned(false);
//         return;
//       }

//       if (parsed.type === "fare_share") {



//         const empId = await AsyncStorage.getItem("currentUser");

//         // If all locations exist, continue with the inserts
//         await upsertUser(parsed.from_user.emp_id, parsed.from_user.username);

//         for (const s of parsed.sessions) {
//           await db.runAsync(
//             `INSERT INTO BusFareDetails (
//         session_id, emp_id, date, outbound_cost, return_cost, shared_from_emp, shared_to_emp, location_code
//       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
//             [s.session_id, empId, s.date, s.outbound_cost, s.return_cost, parsed.from_user.emp_id, empId, s.location_code]
//           );
//         }
//         const user = await AsyncStorage.getItem("currentUser")
//         const man = await getUserByEmpId(user || '');
//         const confirmationPayload = {
//           type: "fare_confirmation",
//           received_sessions: parsed.sessions.map((s: any) => s.session_id),
//           from_user: parsed.from_user,
//           to_user: man,
//         };

//         setConfirmationQR(JSON.stringify(confirmationPayload));
//         setShowQRModal(true);
//         setMode("confirm");

//       }
//     } catch (err: any) {
//       console.error("Error processing shared fare:", err.message);
//       // ✅ show readable error in React Native
//     }
//     setScanned(false);
//   };

//   const handleCloseModal = () => {
//     setShowQRModal(false);
//     if (mode === "send") {
//       setMode("receive");
//       setScanned(false);
//       if (!permission || !permission.granted) {
//         requestPermission();
//       }
//     } else {
//       setMode(null);
//     }
//   };

//   const hasSharedSelected = selectedSessions.some(
//     (id) => fares.find((f) => f.session_id === id)?.is_shared
//   );





//   return (
//     <View style={{ flex: 1, padding: 15, backgroundColor: "#f9fafb" }}>
//       {!mode && (
//         <>
//           {/* Scrollable card list */}
//           <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
//             <Text style={styles.header}>🚌 Merge Fare Overview</Text>

//             {Object.keys(groupedFares).length === 0 && (
//               <Text style={{ marginBottom: 12 }}>No fares found.</Text>
//             )}

//             {Object.keys(groupedFares).map((month) => (
//               <View key={`month-${month}`} style={styles.monthContainer}>
//                 <Text style={styles.monthTitle}>📅 {month}</Text>

//                 {groupedFares[month].map((item) => {
//                   const selected = selectedSessions.includes(item.session_id);
//                   return (
//                     <View
//                       key={`${month}-${item.session_id}`}
//                       style={[styles.card, selected && styles.selectedCard]}
//                     >
//                       <View
//                         style={{
//                           flexDirection: "row",
//                           alignItems: "center",
//                           justifyContent: "space-between",
//                         }}
//                       >
//                         <Text style={styles.cardTitle}>
//                           🏪 {item.location_name}{" "}
//                           {item.is_shared && (
//                             <Text style={styles.sharedBadge}>🔁 Shared</Text>
//                           )}
//                         </Text>

//                         <Checkbox
//                           value={selected}
//                           onValueChange={() => toggleSelect(item.session_id)}
//                           color={selected ? "#1170feff" : undefined}
//                         />
//                       </View>
//                       {item.is_shared && (
//                         <Text style={styles.sharedBadge}>
//                           👥 From: {item.shared_from_emp || "Unknown"}
//                         </Text>
//                       )}
//                       <Text>📆 {item.date}</Text>
//                       <Text>➡️ Outbound: {item.outbound_cost}</Text>
//                       <Text>⬅️ Return: {item.return_cost}</Text>
//                       <Text>🎫 Total: {item.outbound_cost + item.return_cost}</Text>

//                       <Text
//                         style={[
//                           styles.status,
//                           {
//                             color: item.ticket_fare_claimed == 1 ? "#28a745" : "#d9534f",
//                           },
//                         ]}
//                       >
//                         {item.ticket_fare_claimed == 1 ? "✅ Claimed" : "❌ Not Claimed"}
//                       </Text>
//                       {
//                         item.is_shared &&

//                         <TouchableOpacity
//                           onPress={() => { }} // replace with your delete handler
//                           style={{
//                             position: "absolute",
//                             bottom: 8,
//                             left: 12,
//                             borderColor: "gray",
//                             borderWidth: 1,
//                             paddingVertical: 4,
//                             paddingHorizontal: 8,
//                             borderRadius: 6,
//                           }}
//                         >
//                           <Text style={{ color: "#d9534f", fontSize: 16 }}>🗑️</Text>
//                         </TouchableOpacity>
//                       }
//                     </View>
//                   );
//                 })}
//               </View>
//             ))}
//           </ScrollView>

//           {/* Fixed bottom buttons */}
//           <View style={{ paddingVertical: 10, borderTopWidth: 1, borderColor: "#ddd", paddingBottom: 50 }}>
//             {!hasSharedSelected && (
//               <>
//                 <Button
//                   title="📤 Share Selected "
//                   onPress={generateShareQR}
//                 />
//                 <View style={{ height: 10 }} />
//                 <Button title="📥 Receive Fare" onPress={() => setMode("receive")} />
//                 <View style={{ height: 10 }} />
//               </>
//             )}
//             <Button title="📦 Export Selected" onPress={exportSelected} />
//           </View>
//         </>
//       )}

//       {/* Receive and QR modal sections remain unchanged */}
//       {mode === "receive" && (
//         <View style={{ flex: 1 }}>
//           {!permission || !permission.granted ? (
//             <View style={styles.center}>
//               <Text>Camera access required</Text>
//               <Button title="Grant Permission" onPress={requestPermission} />
//             </View>
//           ) : (
//             <>
//               <Text style={styles.header}>📷 Scan QR </Text>
//               <CameraView
//                 facing={facing}
//                 style={{ flex: 1, borderRadius: 12, marginTop: 10 }}
//                 barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
//                 onBarcodeScanned={({ data }) => data && handleScannedQR(data)}
//               />

//               <View style={{ marginBottom: 50, marginTop: 50 }}>
//                 <TouchableOpacity
//                   onPress={() => {
//                     setFacing(prev => {
//                       if (prev === 'back') {
//                         return 'front';
//                       } else {
//                         return 'back';
//                       }
//                     });
//                   }}
//                   style={{
//                     bottom: 8,
//                     alignItems: 'center',
//                     borderColor: "gray",
//                     borderWidth: 1,
//                     paddingVertical: 4,
//                     paddingHorizontal: 8,
//                     borderRadius: 6,
//                   }}
//                 >
//                   <Text style={{ fontSize: 16 }}>Camera 🔃</Text>
//                 </TouchableOpacity>
//                 <Button title="Back" onPress={() => setMode(null)} />
//               </View>
//             </>
//           )}
//         </View>
//       )}

//       <Modal visible={showQRModal} transparent animationType="fade">
//         <View style={styles.modalContainer}>
//           <View style={styles.qrContainer}>
//             {mode === "send" && qrPayload && (
//               <>
//                 <Text style={{ marginBottom: 8 }}>
//                   📤 Scan QR then only click open scanner
//                 </Text>
//                 <QRCode value={qrPayload} size={250} />
//               </>
//             )}
//             {mode === "confirm" && confirmationQR && (
//               <>
//                 <Text style={{ marginBottom: 8 }}>
//                   ✅ Show this QR to sender for confirmation:
//                 </Text>
//                 <QRCode value={confirmationQR} size={250} />
//               </>
//             )}
//             <View style={{ height: 12 }} />
//             <Button title={mode === "send" && qrPayload ? 'Open Scanner' : 'Close confirmation'} onPress={handleCloseModal} />
//           </View>
//         </View>
//       </Modal>
//     </View>
//   );
// }

// const styles = StyleSheet.create({
//   header: { fontSize: 22, fontWeight: "bold", marginBottom: 15, textAlign: 'center' },
//   monthContainer: { marginBottom: 20 },
//   monthTitle: { fontWeight: "700", fontSize: 16, marginBottom: 6 },
//   card: {
//     backgroundColor: "#fff",
//     borderRadius: 12,
//     padding: 12,
//     marginBottom: 10,
//     shadowColor: "#000",
//     shadowOpacity: 0.08,
//     shadowRadius: 4,
//     elevation: 2,
//   },
//   selectedCard: {
//     borderColor: "#1170feff",
//     borderWidth: 1,
//     // backgroundColor: "#dcfce7",
//   },
//   sharedBadge: {
//     marginTop: 6,
//     color: "#1e3a8a",
//     fontWeight: "600",
//   },
//   cardTitle: { fontWeight: "600", marginBottom: 6 },
//   center: { flex: 1, justifyContent: "center", alignItems: "center" },
//   modalContainer: {
//     flex: 1,
//     backgroundColor: "rgba(0,0,0,0.5)",
//     justifyContent: "center",
//     alignItems: "center",
//   },
//   qrContainer: {
//     backgroundColor: "#fff",
//     padding: 20,
//     borderRadius: 12,
//     alignItems: "center",
//   },
//   status: {
//     marginTop: 8,
//     fontWeight: "600",
//     textAlign: "right",
//   },
// });
