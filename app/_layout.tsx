import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '../lib/auth';
import { colors } from '../lib/theme';

export default function Layout() { return <AuthProvider><StatusBar style="dark" /><Stack screenOptions={{headerShown:false,contentStyle:{backgroundColor:colors.paper}}} /></AuthProvider>; }
