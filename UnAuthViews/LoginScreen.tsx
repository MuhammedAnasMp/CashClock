import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, Button, Alert, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform, Animated } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { getUserByEmpId } from '../xdb/database';  // your SQLite helper


type RootStackParamList = {
  Login: undefined;
  Register: { empId: string };
  Main: undefined;
  Crud: undefined;
};

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

const LoginScreen: React.FC<Props> = ({ navigation }) => {
  const [empId, setEmpId] = useState<string>('');
  const [userNotFound, setUserNotFound] = useState(false);
  useEffect(() => {
    AsyncStorage.getItem('currentUser').then((user) => {
      if (user) navigation.replace('Main');
    });
  }, []);

  const handleLogin = async () => {
    if (!empId.trim()) {
      return Alert.alert('Error', 'Please enter employee ID');
    }

    try {
      // Check user in DB
      const user = await getUserByEmpId(empId);

      if (user) {
        await AsyncStorage.setItem('currentUser', empId);
        navigation.replace('Main');
      } else {
        // Not found → show Register link
        setUserNotFound(true);
      }
    } catch (err: any) {
      console.error('Login error:', err);
      Alert.alert('Error', 'Something went wrong while logging in.');
    }
  };

  const handleCrud = () => {
    navigation.navigate('Crud');
  };

  const handleRegister = () => {
    navigation.navigate('Register', { empId });
  };
  const fadeAnim = useRef(new Animated.Value(0)).current; // initial opacity 0

  useEffect(() => {
    // Animate fade-in on mount
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim])

return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <Animated.View style={{ ...styles.formContainer, opacity: fadeAnim }}>
        <Text style={styles.title}>Employee Login</Text>

        <TextInput
          placeholder="Enter Employee ID"
          value={empId}
          onChangeText={(text) => {
            setEmpId(text);
            setUserNotFound(false); // hide link when editing
          }}
          style={styles.input}
          keyboardType="numeric"
        />

        <Button title="Login" onPress={handleLogin} />

        {userNotFound && (
          <TouchableOpacity onPress={handleRegister} style={styles.registerLink}>
            <Text style={styles.registerText}>
              Employee not found? <Text style={styles.link}>Register here</Text>
            </Text>
          </TouchableOpacity>
        )}
      </Animated.View>
    </KeyboardAvoidingView>
  );
};

export default LoginScreen;

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: '#f0f4f7' },
  formContainer: { padding: 20, backgroundColor: '#fff', borderRadius: 12, elevation: 5 },
  title: { fontSize: 24, marginBottom: 20, textAlign: 'center', fontWeight: '600', color: '#333' },
  input: { borderWidth: 1, borderColor: '#ccc', padding: 10, marginBottom: 20, borderRadius: 8 },
  registerLink: { marginTop: 16, alignItems: 'center' },
  registerText: { fontSize: 16, color: '#333' },
  link: { color: '#007BFF', fontWeight: 'bold' },
});