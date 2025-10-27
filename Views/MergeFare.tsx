import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Modal, Button } from "react-native";
import { CameraView, CameraType, useCameraPermissions } from "expo-camera";
import QRCode from "react-native-qrcode-svg";

export default function MergeFare() {
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
