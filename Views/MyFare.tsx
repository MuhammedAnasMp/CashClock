import React, { useCallback, useState } from "react";
import { View, Text, FlatList, StyleSheet, Alert, Button } from "react-native";
import Checkbox from "expo-checkbox";
import { getDB } from "../xdb/database";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { ActionSheetIOS } from "react-native";
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

interface GroupedFares {
  month: string;
  data: FareRecord[];
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

export default function MyFare() {
  const [fares, setFares] = useState<FareRecord[]>([]);
  const [selected, setSelected] = useState<{ [key: string]: boolean }>({});

  useFocusEffect(
    useCallback(() => {
      loadFares();
    }, [])
  );

  const loadFares = async () => {
    try {
      const db = await getDB();
      const empId = await AsyncStorage.getItem("currentUser");

      const results: FareRecord[] = await db.getAllAsync(
        `SELECT 
          ws.session_id,
          l.location_name,
          ws.date,
          ws.outbound_cost,
          ws.return_cost,
          ws.ticket_fare_claimed
        FROM WorkSessions ws
        JOIN Locations l ON ws.location_id = l.location_id
        WHERE ws.emp_id = ?
        ORDER BY ws.date DESC`,
        [empId]
      );

      // Filter out empty/zero fares
      const filtered = results.filter((item) => {
        const out = Number(item.outbound_cost) || 0;
        const ret = Number(item.return_cost) || 0;
        return out > 0 || ret > 0;
      });
      console.log(filtered)
      setFares(filtered);

      // Reset selection
      const initSelected: { [key: string]: boolean } = {};
      filtered.forEach((item) => {
        initSelected[item.session_id] = false;
      });
      setSelected(initSelected);
    } catch (error) {
      console.error("Error loading fares:", error);
    }
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const submitSelected = async () => {
    const selectedFares = fares.filter(f => selected[f.session_id]);
    if (selectedFares.length === 0) {
      Alert.alert("No Selection", "Please select at least one fare to submit.");
      return;
    }

    try {
      const db = await getDB();
      const empId = await AsyncStorage.getItem("currentUser");

      // Get username from Users table
      const user: { username: string }[] = await db.getAllAsync(
        `SELECT username FROM Users WHERE emp_id = ?`,
        [empId]
      );
      const username = user.length > 0 ? user[0].username : "Unknown";

      // Generate JSON for HR submission (this becomes your XLSX data)
      const jsonData = selectedFares.map(f => {
        const out = Number(f.outbound_cost) || 0;
        const ret = Number(f.return_cost) || 0;
        return {
          emp_id: empId,
          name: username,
          location: f.location_name,
          date: f.date,
          sub_total: out + ret
        };
      });


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

              loadFares();
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

  const formatDate = (date: string): string => {
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, "0");
    const month = d.toLocaleString("en-US", { month: "short" });
    const year = String(d.getFullYear()).slice(-2);
    return `${day}-${month}-${year}`;
  };

  const groupByMonth = (items: FareRecord[]): GroupedFares[] => {
    const groups: { [key: string]: FareRecord[] } = {};

    items.forEach((item) => {
      const d = new Date(item.date);
      const monthYear = d.toLocaleString("en-GB", { month: "long", year: "numeric" });
      if (!groups[monthYear]) groups[monthYear] = [];
      groups[monthYear].push(item);
    });

    return Object.keys(groups).map((month) => ({
      month,
      data: groups[month].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    }));
  };
  const groupedData = groupByMonth(fares);


 const renderItem = ({ item }: { item: FareRecord }) => {
  const out = Number(item.outbound_cost) || 0;
  const ret = Number(item.return_cost) || 0;
  const total = out + ret;

  const formattedDate = new Date(item.date).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    <View style={styles.card}>
      {/* Header Row */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.location}>📍 {item.location_name}</Text>
          <Text style={styles.date}>🗓️ {formattedDate}</Text>
        </View>

        <Checkbox
          value={selected[item.session_id]}
          onValueChange={() => toggleSelect(item.session_id)}
          color={selected[item.session_id] ? "#007AFF" : undefined}
        />
      </View>

      {/* Fare Details */}
      <View style={styles.costRow}>
        <Text style={styles.label}>🚍 Outbound:</Text>
        <Text style={styles.value}>KWD {out.toFixed(2)}</Text>
      </View>

      <View style={styles.costRow}>
        <Text style={styles.label}>🚌 Return:</Text>
        <Text style={styles.value}>KWD {ret.toFixed(2)}</Text>
      </View>

      <View style={[styles.costRow, { marginTop: 6 }]}>
        <Text style={styles.totalLabel}>💰 Total:</Text>
        <Text style={styles.totalValue}>KWD {total.toFixed(2)}</Text>
      </View>

      {/* Status */}
      <Text
        style={[
          styles.status,
          {
            color: item.ticket_fare_claimed ? "#28a745" : "#d9534f",
          },
        ]}
      >
        {item.ticket_fare_claimed ? "✅ Claimed" : "❌ Not Claimed"}
      </Text>
    </View>
  );
};

const renderSection = ({ item }: { item: GroupedFares }) => (
  <View>
    <Text style={styles.monthHeader}>📆 {item.month}</Text>
    <FlatList
      data={item.data}
      keyExtractor={(subItem) => subItem.session_id}
      renderItem={renderItem}
      scrollEnabled={false}
    />
  </View>
);

 return (
  <View style={styles.container}>
    {fares.length === 0 ? (
      <Text style={styles.empty}>🚫 No valid fare records found.</Text>
    ) : (
      <>
        <FlatList
          data={groupedData}
          keyExtractor={(item) => item.month}
          renderItem={renderSection}
        />
        <View style={styles.buttonContainer}>
          <Button title="🚀 Submit Selected Fares" onPress={submitSelected} />
        </View>
      </>
    )}
  </View>
);
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: "#F5F7FB",
  },
  monthHeader: {
    fontSize: 20,
    fontWeight: "700",
    color: "#222",
    marginTop: 16,
    marginBottom: 8,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  location: {
    fontSize: 17,
    fontWeight: "600",
    color: "#111",
  },
  date: {
    fontSize: 13,
    color: "#666",
    marginTop: 2,
  },
  costRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: 2,
  },
  label: {
    fontSize: 14,
    color: "#555",
  },
  value: {
    fontSize: 14,
    fontWeight: "500",
    color: "#111",
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111",
  },
  totalValue: {
    fontSize: 15,
    fontWeight: "700",
    color: "#007AFF",
  },
  status: {
    marginTop: 8,
    fontWeight: "600",
    textAlign: "right",
  },
  buttonContainer: {
    paddingBottom: 40,
    paddingTop: 10,
  },
  empty: {
    textAlign: "center",
    color: "#888",
    fontSize: 16,
    marginTop: 40,
  },
});