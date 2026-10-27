import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Button, Row } from "./ui";
import { nameOf } from "../lib/identity";
import { colors, space, type } from "../lib/theme";
import type { Ping } from "../lib/pings";

export function Contributions({ ping, currentUser, busy, onClaim }: {
  ping: Ping;
  currentUser?: string;
  busy: boolean;
  onClaim: (label: string) => void;
}) {
  if (!ping.contribution_requests?.length) return null;
  const canClaim = !!currentUser && (ping.accepted || ping.is_own);
  return (
    <View style={{ gap: space.md, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: space.md }}>
      <Text style={type.fieldLabel}>Help make it happen</Text>
      {ping.contributions_unavailable ? (
        <Text style={type.small}>Contributions couldn’t load. Pull to refresh and try again.</Text>
      ) : (
        <>
          {ping.contribution_requests.map((label) => {
            const claim = ping.contribution_claims?.find((item) => item.label === label);
            const own = !!claim && !!currentUser && claim.user_id === currentUser;
            const person = claim?.user_id ? nameOf({ username: claim.username || "", display_name: claim.display_name }) : "A friend";
            return (
              <Row key={label} spread gap={space.md}>
                <Ionicons name={claim ? "checkmark-circle" : "ellipse-outline"} size={20} color={claim ? colors.green : colors.muted} />
                <View style={{ flex: 1 }}>
                  <Text style={type.bodyStrong}>{label}</Text>
                  <Text style={type.small}>{claim ? (own ? "You’ve got this" : `${person} has this covered`) : "Up for grabs"}</Text>
                </View>
                {!claim || own ? (
                  <Button title={own ? "Release" : "Claim"} compact variant="secondary" disabled={busy || !canClaim} onPress={() => onClaim(label)} />
                ) : null}
              </Row>
            );
          })}
          {!canClaim ? <Text style={type.small}>Tap “I’m in” to claim something and help out.</Text> : null}
        </>
      )}
    </View>
  );
}
