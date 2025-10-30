import React, { useEffect, useLayoutEffect, useState } from 'react';
import { View, Text, Button, FlatList, TextInput, StyleSheet, TouchableOpacity, ScrollView, Alert, Platform } from 'react-native';
import {
  initDatabase,
  insertUser,
  insertLocation,
  getUsers,
  getLocations,
  updateUser,
  updateLocation,
  deleteUser,
  deleteLocation
} from '../xdb/database';
type RootStackParamList = {
  Login: undefined;
  Dashboard: undefined;
  Crud: undefined;
};
import { User, Location } from '../types';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import Settings from './Settings';
import { useFocusEffect } from '@react-navigation/native';

const Crud: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [newLocationId, setNewLocationId] = useState('');
  const [newLocationName, setNewLocationName] = useState('');

  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [editingUserName, setEditingUserName] = useState('');
  const [editingEmpId, setEditingEmpId] = useState('');

  const [editingLocationId, setEditingLocationId] = useState<number | null>(null);
  const [editingLocationName, setEditingLocationName] = useState('');

  useFocusEffect(
    React.useCallback(() => {
      initDatabase().catch(console.error);
      loadData();
    }, [])
  );



  const loadData = async () => {
    setUsers(await getUsers());
    setLocations(await getLocations());
  };




  const handleSaveUser = async () => {
    if (editingUserId === null) return;
    await updateUser(editingUserId, editingEmpId, editingUserName);
    setEditingUserId(null);
    setEditingUserName('');
    setEditingEmpId('');
    await loadData();
  };



  const handleAddLocation = async () => {
    if (!newLocationName || !newLocationId) {
      Alert.alert('Error', 'Please enter both a Location ID and Name.');
      return;
    }

    // Step 1 — Initial confirmation
    Alert.alert(
      'Add New Location',
      `You are about to add a new location.\n\nLocation ID: ${newLocationId}\nLocation Name: ${newLocationName}\n\n⚠️ The location ID must be confirmed by another person to ensure accuracy.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          onPress: () =>
            verifyLocationIdWithSecondPerson(Number(newLocationId), newLocationName),
        },
      ]
    );
  };

  // Step 2 — Require another person to confirm the Location ID
  const verifyLocationIdWithSecondPerson = (locationId: number, locationName: string) => {
    if (Platform.OS === 'ios') {
      // On iOS, you can use Alert.prompt for text input
      Alert.prompt(
        'Supervisor Verification',
        `Ask another person to verify the correct Location ID.\nPlease enter the verified Location ID below:`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Confirm',
            onPress: async (input: any) => {
              if (String(input) === String(locationId)) {
                await finalizeAddLocation(locationId, locationName);
              } else {
                Alert.alert(
                  'ID Mismatch',
                  `The verified ID (${input}) does not match the entered ID (${locationId}). Please recheck with the supervisor.`
                );
              }
            },
          },
        ],
        'plain-text'
      );
    } else {
      // Android fallback
      Alert.alert(
        'Supervisor Confirmation Required',
        `Please verify with another person that the Location ID is correct:\n\n${locationId}\n\nOnly continue if it has been double-checked.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Verified',
            onPress: async () => await finalizeAddLocation(locationId, locationName),
          },
        ]
      );
    }
  };

  // Step 3 — Perform the actual insertion
  const finalizeAddLocation = async (locationId: number, locationName: string) => {
    try {
      await insertLocation({ location_id: locationId, location_name: locationName });
      setNewLocationId('');
      setNewLocationName('');
      await loadData();
      Alert.alert('Success', `Location ID ${locationId} added successfully.`);
    } catch (error) {
      Alert.alert('Error', 'Failed to add location.');
    }
  };



  const handleSaveLocation = async () => {
    if (editingLocationId === null) return;
    await updateLocation(editingLocationId, editingLocationName);
    setEditingLocationId(null);
    setEditingLocationName('');
    await loadData();
  };

  const handleDeleteLocation = async (locationId: number) => {
    // First confirmation

    Alert.alert(
      'Delete Location',
      `Are you sure you want to delete location ID: ${locationId}?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Yes, delete it',
          onPress: () => confirmDelete(locationId),
          style: 'destructive',
        },
      ]
    );
  };

  const confirmDelete = (locationId: number) => {
    // Second confirmation
    Alert.alert(
      'Confirm Again',
      `This action cannot be undone.\nAre you absolutely sure you want to delete location ID: ${locationId}?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Yes, I’m sure',
          onPress: async () => {
            try {
              await deleteLocation(locationId);
              await loadData();
              Alert.alert('Deleted', `Location ID ${locationId} has been deleted.`);
            } catch (error) {
              Alert.alert('Error', 'Failed to delete location.');
            }
          },
          style: 'destructive',
        },
      ]
    );
  };

  return (
    <ScrollView >

      {/* Users Section */}
      <View >

        <FlatList
          data={users}
          scrollEnabled={false}
          keyExtractor={(item) => item.user_id.toString()}
          renderItem={({ item }) => (
            <View style={styles.listItem}>
              {editingUserId === item.user_id ? (
                <View style={styles.editForm}>
                  <View style={styles.inputRow}>
                    <Text style={styles.editInput}>{editingEmpId}</Text>
                    <TextInput
                      style={styles.editInput}
                      value={editingUserName}
                      onChangeText={setEditingUserName}
                      placeholder="Username"
                    />
                  </View>
                  <View style={styles.editActions}>
                    <TouchableOpacity style={styles.saveButton} onPress={handleSaveUser}>
                      <Ionicons name="checkmark" size={18} color="white" />
                      <Text style={styles.buttonText}>Save</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.cancelButton}
                      onPress={() => setEditingUserId(null)}
                    >
                      <Ionicons name="close" size={18} color="#6b7280" />
                      <Text style={styles.cancelButtonText}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={styles.itemContent}>
                  <View style={styles.userInfo}>
                    <View style={styles.avatar}>
                      <Ionicons name="person" size={20} color="#6366f1" />
                    </View>
                    <View>
                      <Text style={styles.userName}>{item.username}</Text>
                      <Text style={styles.empId}>EMP: {item.emp_id}</Text>
                    </View>
                  </View>
                  <View style={styles.itemActions}>
                    {/* <TouchableOpacity
                      style={styles.iconButton}
                      onPress={() => handleUpdateUser(item)}
                    >
                      <Ionicons name="create-outline" size={18} color="#6366f1" />
                    </TouchableOpacity> */}
                    {/* <TouchableOpacity 
                    style={[styles.iconButton, styles.deleteButton]} 
                    onPress={() => handleDeleteUser(item.user_id)}
                  >
                    <Ionicons name="trash-outline" size={18} color="#ef4444" />
                  </TouchableOpacity> */}
                  </View>
                </View>
              )}
            </View>
          )}
        />
      </View>

      {/* Locations Section */}
      <View>
        <View style={styles.sectionHeader}>
          <Ionicons name="location" size={24} color="#10b981" />
          <Text style={styles.sectionTitle}>Locations Creation</Text>
        </View>

        {/* Add Location Form */}
        <View style={styles.addForm}>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="Location ID"
              placeholderTextColor="#9ca3af"
              value={newLocationId}
              onChangeText={setNewLocationId}
            />
            <TextInput
              style={styles.input}
              placeholder="Location Name"
              placeholderTextColor="#9ca3af"
              value={newLocationName}
              onChangeText={setNewLocationName}
            />
          </View>
          <TouchableOpacity style={styles.primaryButton} onPress={handleAddLocation}>
            <Ionicons name="add" size={20} color="white" />
            <Text style={styles.buttonText}>Add Location</Text>
          </TouchableOpacity>
        </View>

        {/* Locations List */}
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
          <Ionicons name="location" size={24} color="#10b981" />
          <Text style={[styles.sectionTitle, { marginLeft: 4 }]}>Locations List</Text>
        </View>

        <FlatList
          data={locations}
          scrollEnabled={false}
          keyExtractor={(item) => item.location_id.toString()}
          renderItem={({ item }) => (
            <View style={styles.listItem}>
              {editingLocationId === item.location_id ? (
                <View style={styles.editForm}>
                  <TextInput
                    style={[styles.editInput, styles.fullWidth]}
                    keyboardType='numeric'
                    value={editingLocationName}
                    onChangeText={setEditingLocationName}
                    placeholder="Location Name"
                  />
                  <View style={styles.editActions}>
                    <TouchableOpacity style={styles.saveButton} onPress={handleSaveLocation}>
                      <Ionicons name="checkmark" size={18} color="white" />
                      <Text style={styles.buttonText}>Save</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.cancelButton}
                      onPress={() => setEditingLocationId(null)}
                    >
                      <Ionicons name="close" size={18} color="#6b7280" />
                      <Text style={styles.cancelButtonText}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={styles.itemContent}>
                  <View style={styles.locationInfo}>
                    <View style={[styles.avatar, styles.locationAvatar]}>
                      <Ionicons name="location" size={18} color="#10b981" />
                    </View>

                    <View>
                      <Text style={styles.locationName}>{item.location_name}</Text>
                      <Text style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
                        Code: {item.location_code}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.itemActions}>

                    <TouchableOpacity
                      style={[styles.iconButton, styles.deleteButton]}
                      onPress={() => handleDeleteLocation(item.location_id)}
                    >
                      <Ionicons name="trash-outline" size={18} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          )}
        />
      </View>

    </ScrollView>
  );
}


export default Crud;


const styles = StyleSheet.create({
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
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
    marginTop: 6,
    marginLeft: 3
  },
  addForm: {

    padding: 0,
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
});