import { useState } from 'react';
import { Alert, ScrollView, Text } from 'react-native';
import { router } from 'expo-router';
import * as Linking from 'expo-linking';
import { Button, Field, Page, Title } from '../components/ui';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { colors } from '../lib/theme';

export default function SignIn() {
  const { configured } = useAuth();
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!email.trim() || password.length < 8) {
      Alert.alert('Check your details', 'Enter an email and a password with at least 8 characters.');
      return;
    }
    if (mode === 'up' && !/^[a-z0-9_]{3,24}$/i.test(username.trim())) {
      Alert.alert('Choose a username', 'Use 3-24 letters, numbers, or underscores.');
      return;
    }

    setBusy(true);
    const emailRedirectTo = Linking.createURL('auth/callback');
    const result = mode === 'in'
      ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
      : await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo,
            data: { username: username.trim().toLowerCase() },
          },
        });
    setBusy(false);

    if (result.error) {
      Alert.alert('Could not continue', result.error.message);
    } else if (mode === 'up' && !result.data.session) {
      Alert.alert('Check your inbox', 'Confirm your email to finish creating your account.');
    } else {
      router.replace('/home');
    }
  }

  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
      <Page style={{ justifyContent: 'center' }}>
        <Text style={{ fontSize: 40, color: colors.green, marginBottom: 15 }}>●</Text>
        <Title subtitle="Make plans happen, together.">
          {mode === 'in' ? 'Welcome back' : 'Join PingMe'}
        </Title>
        {!configured && (
          <Text style={{ color: colors.red, marginBottom: 14 }}>
            Add Supabase credentials to .env before signing in.
          </Text>
        )}
        {mode === 'up' && (
          <Field
            value={username}
            onChangeText={setUsername}
            placeholder="Username"
            autoCapitalize="none"
          />
        )}
        <Field
          value={email}
          onChangeText={setEmail}
          placeholder="Email"
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <Field
          value={password}
          onChangeText={setPassword}
          placeholder="Password (8+ characters)"
          secureTextEntry
        />
        <Button
          title={mode === 'in' ? 'Sign in' : 'Create account'}
          onPress={submit}
          loading={busy}
          disabled={!configured}
        />
        <Button
          title={mode === 'in' ? 'Create an account' : 'I already have an account'}
          onPress={() => setMode(mode === 'in' ? 'up' : 'in')}
          secondary
        />
        <Text style={{ color: colors.muted, textAlign: 'center', marginTop: 20 }}>
          Your location is only shared when you add it to a ping.
        </Text>
      </Page>
    </ScrollView>
  );
}
