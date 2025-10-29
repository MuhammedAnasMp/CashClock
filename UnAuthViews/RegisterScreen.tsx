import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Button,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { insertUser } from '../xdb/database';
import AsyncStorage from '@react-native-async-storage/async-storage';

type RootStackParamList = {
  Register: { empId: string };
  Dashboar: undefined;
};

type RegisterRouteProp = RouteProp<RootStackParamList, 'Register'>;

const RegisterScreen: React.FC = () => {
  const route = useRoute<RegisterRouteProp>();
  const navigation = useNavigation();
  const { empId } = route.params;

  const [username, setUsername] = useState('');

  const handleRegister = async () => {
    if (!username.trim()) {
      Alert.alert('Validation', 'Please enter your name.');
      return;
    }

    try {
      await insertUser(empId, username);
      await AsyncStorage.setItem('currentUser', empId);
      navigation.navigate('Main' as never);
    } catch (error) {
      console.error('Register error:', error);
      Alert.alert('Error', 'Failed to register user.');
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>New Employee Registration</Text>

        <Text style={styles.label}>Employee ID</Text>
        <TextInput
          value={empId}
          editable={false}
          style={[styles.input, { backgroundColor: '#f2f2f2' }]}
        />

        <Text style={styles.label}>Full Name</Text>
        <TextInput
          value={username}
          onChangeText={setUsername}
          placeholder="Enter your name"
          style={styles.input}
        />

        <View style={styles.buttonContainer}>
          <Button title="Register" onPress={handleRegister} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default RegisterScreen;

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 24,
    textAlign: 'center',
  },
  label: {
    fontSize: 16,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 10,
    borderRadius: 8,
    marginBottom: 16,
  },
  buttonContainer: {
    marginTop: 20,
  },
});
