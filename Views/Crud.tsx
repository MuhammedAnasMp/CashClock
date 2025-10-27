import React, { useEffect, useState } from 'react';
import { View, Text, Button, FlatList, TextInput, StyleSheet } from 'react-native';
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
import { User , Location } from '../types';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
type Props = NativeStackScreenProps<RootStackParamList, 'Crud'>;
const  Crud : React.FC<Props> = ({ navigation }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [newUserName, setNewUserName] = useState('');
  const [newEmpId, setNewEmpId] = useState('');
  const [newLocationId, setNewLocationId] = useState('');
  const [newLocationName, setNewLocationName] = useState('');

  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [editingUserName, setEditingUserName] = useState('');
  const [editingEmpId, setEditingEmpId] = useState('');

  const [editingLocationId, setEditingLocationId] = useState<number | null>(null);
  const [editingLocationName, setEditingLocationName] = useState('');

  useEffect(() => {
    initDatabase().catch(console.error);
    loadData();
    
  }, []);

  const loadData = async () => {
    setUsers(await getUsers());
    setLocations(await getLocations());
  };

 

  const handleUpdateUser = async (user: User) => {
    setEditingUserId(user.user_id);
    setEditingUserName(user.username);
    setEditingEmpId(user.emp_id);
  };

  const handleSaveUser = async () => {
    if (editingUserId === null) return;
    await updateUser(editingUserId, editingEmpId, editingUserName);
    setEditingUserId(null);
    setEditingUserName('');
    setEditingEmpId('');
    await loadData();
  };

  const handleDeleteUser = async (userId: number) => {
    await deleteUser(userId);
    await loadData();
  };

  // Locations CRUD
  const handleAddLocation = async () => {
    if (!newLocationName) return;
    await insertLocation({  location_id: Number(newLocationId), location_name: newLocationName });
    alert(newLocationName)
    alert(newLocationId)

    setNewLocationName('');
    await loadData();
  };

  const handleUpdateLocation = async (location: Location) => {
    setEditingLocationId(location.location_id);
    setEditingLocationName(location.location_name);
  };

  const handleSaveLocation = async () => {
    if (editingLocationId === null) return;
    await updateLocation(editingLocationId, editingLocationName);
    setEditingLocationId(null);
    setEditingLocationName('');
    await loadData();
  };

  const handleDeleteLocation = async (locationId: number) => {
    await deleteLocation(locationId);
    await loadData();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Database Sync App</Text>


      {/* Users List */}
      <Text style={styles.subtitle}>Users:</Text>
      <FlatList
        data={users}
        keyExtractor={(item) => item.user_id.toString()}
        renderItem={({ item }) => (
          <View style={styles.item}>
            {editingUserId === item.user_id ? (
              <>
                <TextInput style={styles.editInput} value={editingEmpId} onChangeText={setEditingEmpId} />
                <TextInput style={styles.editInput} value={editingUserName} onChangeText={setEditingUserName} />
                <Button title="Save" onPress={handleSaveUser} />
              </>
            ) : (
              <>
                <Text>{item.emp_id} - {item.username}</Text>
                <Button title="Edit" onPress={() => handleUpdateUser(item)} />
                <Button title="Delete" onPress={() => handleDeleteUser(item.user_id)} />
              </>
            )}
          </View>
        )}
      />

      {/* Add Location */}
      <TextInput style={styles.input} placeholder="Location Id" value={newLocationId} onChangeText={setNewLocationId} />
      <TextInput style={styles.input} placeholder="Location Name" value={newLocationName} onChangeText={setNewLocationName} />
      <Button title="Add Location" onPress={handleAddLocation} />

      {/* Locations List */}
      <Text style={styles.subtitle}>Locations:</Text>
      <FlatList
        data={locations}
        keyExtractor={(item) => item.location_id.toString()}
        renderItem={({ item }) => (
          <View style={styles.item}>
            {editingLocationId === item.location_id ? (
              <>
                <TextInput style={styles.editInput} keyboardType='numeric' value={editingLocationName} onChangeText={setEditingLocationName} />
                <Button title="Save" onPress={handleSaveLocation} />
              </>
            ) : (
              <>
                <Text>{item.location_name}</Text>
                <Button title="Edit" onPress={() => handleUpdateLocation(item)} />
                <Button title="Delete" onPress={() => handleDeleteLocation(item.location_id)} />
              </>
            )}
          </View>
        )}
      />

    </View>
  );
}


 export default Crud ;


const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  subtitle: { fontSize: 20, marginTop: 20, marginBottom: 10 },
  item: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5, flexWrap: 'wrap' },
  input: { borderWidth: 1, borderColor: '#ccc', padding: 8, marginVertical: 5 },
  editInput: { borderWidth: 1, borderColor: '#888', padding: 6, marginVertical: 2, width: 120 },
});
