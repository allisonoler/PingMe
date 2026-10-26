import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { supabase } from "../../lib/supabase";
import { colors, space, type } from "../../lib/theme";

export default function AuthCallback() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  const [message, setMessage] = useState("Confirming your email…");
  useEffect(() => {
    let active = true;
    (async () => {
      if (!code) {
        if (active)
          setMessage(
            "This confirmation link is incomplete. Open a fresh link from your email.",
          );
        return;
      }
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        if (active) {
          setMessage(
            "Could not confirm your email. Please request a new link.",
          );
          Alert.alert("Confirmation failed", error.message);
        }
        return;
      }
      if (active) router.replace("/home");
    })();
    return () => {
      active = false;
    };
  }, [code]);
  return (
    <View style={styles.screen}>
      <ActivityIndicator color={colors.green} />
      <Text style={[type.body, { marginTop: space.lg, textAlign: "center" }]}>
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.canvas,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: space.xl,
  },
});
