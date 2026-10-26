import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { colors } from '../../lib/theme';

export default function AuthCallback(){const {code}=useLocalSearchParams<{code?:string}>();const [message,setMessage]=useState('Confirming your email…');
 useEffect(()=>{let active=true;(async()=>{if(!code){if(active)setMessage('This confirmation link is incomplete. Open a fresh link from your email.');return;}const {error}=await supabase.auth.exchangeCodeForSession(code);if(error){if(active){setMessage('Could not confirm your email. Please request a new link.');Alert.alert('Confirmation failed',error.message);}return;}if(active)router.replace('/home');})();return()=>{active=false;};},[code]);
 return <View style={{flex:1,backgroundColor:'#F7F8F5',justifyContent:'center',alignItems:'center',padding:28}}><ActivityIndicator color={colors.green}/><Text style={{marginTop:14,color:colors.ink,textAlign:'center'}}>{message}</Text></View>;
}
