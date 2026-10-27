import { useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import * as Linking from "expo-linking";
import { Ionicons } from "@expo/vector-icons";
import {
  Button,
  Column,
  Field,
  Footnote,
  Page,
  PasswordField,
  TextAction,
} from "../components/ui";
import { useAuth } from "../lib/auth";
import { useDemo } from "../lib/demo";
import { supabase } from "../lib/supabase";
import { colors, radius, space, type } from "../lib/theme";
import {
  DISPLAY_NAME_HINT,
  DISPLAY_NAME_MAX,
  USERNAME_HINT,
  USERNAME_MIN,
  isValidUsername,
  normalizeUsername,
} from "../lib/identity";

export default function SignIn() {
  const { configured } = useAuth();
  const { setDemoMode } = useDemo();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);

  // The field can only hold storable characters, so the only rule left to fail
  // is the length — and saying so while they type beats an alert after submit.
  const usernameError =
    username.length > 0 && username.length < USERNAME_MIN
      ? `At least ${USERNAME_MIN} characters.`
      : undefined;

  async function submit() {
    if (!email.trim() || password.length < 8) {
      Alert.alert(
        "Check your details",
        "Enter an email and a password with at least 8 characters.",
      );
      return;
    }
    if (mode === "up" && !isValidUsername(username)) {
      Alert.alert("Choose a username", USERNAME_HINT);
      return;
    }

    setBusy(true);
    const emailRedirectTo = Linking.createURL("auth/callback");
    const result =
      mode === "in"
        ? await supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
          })
        : await supabase.auth.signUp({
            email: email.trim(),
            password,
            options: {
              emailRedirectTo,
              // Both are read by the handle_new_user trigger in
              // supabase/schema.sql when it creates the profile row.
              data: {
                username,
                display_name: displayName.trim(),
              },
            },
          });
    setBusy(false);

    if (result.error) {
      Alert.alert("Could not continue", result.error.message);
    } else if (mode === "up" && !result.data.session) {
      Alert.alert(
        "Check your inbox",
        "Confirm your email to finish creating your account.",
      );
    } else {
      router.replace("/home");
    }
  }

  return (
    <ScrollView
      contentContainerStyle={{ flexGrow: 1 }}
      keyboardShouldPersistTaps="handled"
    >
      <Page style={{ justifyContent: "center", paddingBottom: space.xxxl }}>
        <View style={styles.mark}>
          <Ionicons name="radio" size={26} color={colors.green} />
        </View>
        <Text style={[type.display, { marginTop: space.xl }]}>
          {mode === "in" ? "Welcome back" : "Join PingMe"}
        </Text>
        <Text style={[type.subtitle, { marginTop: space.xs }]}>
          Make plans happen, together.
        </Text>
        {!configured && (
          <Text
            style={[type.small, { color: colors.red, marginTop: space.md }]}
          >
            Add Supabase credentials to .env before signing in.
          </Text>
        )}
        <Column gap={space.lg} style={{ marginTop: space.xxl }}>
          {mode === "up" && (
            <>
              <Field
                label="Username"
                hint={USERNAME_HINT}
                error={usernameError}
                prefix="@"
                value={username}
                onChangeText={(text) => setUsername(normalizeUsername(text))}
                placeholder="yourhandle"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="username"
              />
              <Field
                label="Display name"
                hint={DISPLAY_NAME_HINT}
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Full name (optional)"
                maxLength={DISPLAY_NAME_MAX}
                autoComplete="name"
              />
            </>
          )}
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />
          <PasswordField
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="8+ characters"
          />
          <Button
            title={mode === "in" ? "Sign in" : "Create account"}
            onPress={submit}
            loading={busy}
            disabled={!configured}
          />
          <View style={{ alignItems: "center" }}>
            <Button
              title="Explore the demo"
              variant="secondary"
              onPress={() => {
                setDemoMode(true);
                router.replace("/home");
              }}
            />
            <TextAction
              label={
                mode === "in"
                  ? "Create an account"
                  : "I already have an account"
              }
              onPress={() => setMode(mode === "in" ? "up" : "in")}
            />
          </View>
        </Column>
        <View style={{ marginTop: space.xl }}>
          <Footnote>
            Your location is only shared when you add it to a ping.
          </Footnote>
        </View>
      </Page>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  mark: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: colors.mint,
    alignItems: "center",
    justifyContent: "center",
  },
});
