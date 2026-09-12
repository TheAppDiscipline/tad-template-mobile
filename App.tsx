import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as Linking from 'expo-linking';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import './src/config/env-check';
import { handleIncomingAuthUrl } from './src/lib/backend/auth-links';

const Stack = createNativeStackNavigator();

function HomeScreen() {
  return null; // Replace with your first screen
}

export default function App() {
  useEffect(() => {
    Linking.getInitialURL().then(handleIncomingAuthUrl).catch(console.error);
    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleIncomingAuthUrl(url).catch(console.error);
    });

    return () => subscription.remove();
  }, []);

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator>
          <Stack.Screen name="Home" component={HomeScreen} />
        </Stack.Navigator>
      </NavigationContainer>
      <StatusBar style="auto" />
    </SafeAreaProvider>
  );
}
