import React, { useEffect, useState } from 'react';
import { NavigationContainer,  } from '@react-navigation/native';
import { createNativeStackNavigator,  } from '@react-navigation/native-stack';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { Text, View, ActivityIndicator, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LoginScreen from './UnAuthViews/LoginScreen';
import RegisterScreen from './UnAuthViews/RegisterScreen';
import Dashboard from './Views/Dashboard';
import Crud from './Views/Crud';
import { initDatabase } from './xdb/database';
import AllRecords from './Views/AllRecords';
import MyFare from './Views/MyFare';
import MyTimesheet from './Views/MyTimeSheet';
import MergeFare from './Views/MergeFare';
import Settings from './Views/Settings';
import { CustomDrawerContent } from './Views/CustomDrawerContent';
import { MergeTimesheet } from './Views/MergeTimeSheet';

type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  Main: undefined; // Drawer will be loaded here
};

type DrawerParamList = {
  Dashboard: undefined;
  Crud: undefined;
  Settings: undefined;
  "All Records": undefined;
  "My Fare": undefined;
  "My Timesheet": undefined;
  "Merge Fare": undefined;
  "Merge Timesheet": undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Drawer = createDrawerNavigator<DrawerParamList>();



// Drawer for authenticated screens
function AuthenticatedDrawer() {
  return (
    <Drawer.Navigator
      initialRouteName="Dashboard"
      drawerContent={(props) => <CustomDrawerContent {...props} />}> 
      <Drawer.Screen name="Dashboard" component={Dashboard} />
      <Drawer.Screen name="All Records" component={AllRecords} />
      <Drawer.Screen name="My Fare" component={MyFare} />
      <Drawer.Screen name="My Timesheet" component={MyTimesheet} />
      <Drawer.Screen name="Merge Fare" component={MergeFare} />
      <Drawer.Screen name="Merge Timesheet" component={MergeTimesheet} />
      <Drawer.Screen name="Settings" component={Settings} />
    </Drawer.Navigator>
  );
}

export default function App() {
  const [dbReady, setDbReady] = useState(false);
  const [initialRoute, setInitialRoute] = useState<'Login' | 'Main'>('Login');

  useEffect(() => {
    const setupApp = async () => {
      try {
        // Initialize database
        await initDatabase();

        // Check if user is logged in
        const user = await AsyncStorage.getItem('currentUser');
        if (user) setInitialRoute('Main');
      } catch (error) {
        console.error('Setup error:', error);
      } finally {
        setDbReady(true);
      }
    };

    setupApp();
  }, []);

  if (!dbReady) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text style={{ marginTop: 10 }}>Loading...</Text>
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName={initialRoute}>
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Register" component={RegisterScreen} />
        <Stack.Screen
          name="Main"
          component={AuthenticatedDrawer}
          options={{ headerShown: false }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  screen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    fontSize: 20,
    fontWeight: '600',
  },
});
