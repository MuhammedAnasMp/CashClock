import AsyncStorage from "@react-native-async-storage/async-storage";
import { DrawerContentScrollView, DrawerItem, DrawerItemList } from "@react-navigation/drawer";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { View } from "react-native";
type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  Main: undefined; // Drawer will be loaded here
};



export  function CustomDrawerContent(props: any) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const handleLogout = async () => {
    try {
      await AsyncStorage.removeItem('currentUser'); // clear stored user
      navigation.replace('Login'); // navigate to login screen
    } catch (err) {
      console.error('Logout error:', err);
   
    }
  };

  return (
    <DrawerContentScrollView {...props}>
      <DrawerItemList {...props} />

      {/* Spacing */}
      <View style={{ height: 20 }} />

      {/* Logout Button */}
      <DrawerItem label="Logout" onPress={handleLogout} />
    </DrawerContentScrollView>
  );
}