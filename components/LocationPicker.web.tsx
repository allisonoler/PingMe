import { useState } from "react";
import { Modal, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, Column, Field, IconButton, Row } from "./ui";
import { colors, space, type } from "../lib/theme";

export type PickedPlace = {
  latitude: number;
  longitude: number;
  name: string;
};

type Point = { latitude: number; longitude: number };

/**
 * A pair of decimal degrees, however they were pasted in — comma-separated,
 * space-separated, or both, which is what copying out of a maps URL gives.
 * Anything off the globe is rejected rather than clamped, since a number out of
 * range means the paste was something other than a coordinate pair.
 */
function parsePoint(input: string): Point | null {
  const parts = input.split(/[,\s]+/).filter(Boolean);
  if (parts.length !== 2) return null;
  const [latitude, longitude] = parts.map(Number);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return { latitude, longitude };
}

/**
 * Web stand-in for the map picker. `react-native-maps` ships Fabric native
 * specs that crash on import under react-native-web, the same reason PingMap
 * has a stub here, so the web build takes coordinates by hand instead of
 * leaving the row a dead end: paste the pair out of a maps URL and name it.
 */
export function LocationPicker({
  initial,
  initialName,
  onCancel,
  onPick,
}: {
  initial?: Point | null;
  initialName?: string;
  onCancel: () => void;
  onPick: (place: PickedPlace) => void;
}) {
  const insets = useSafeAreaInsets();
  const [pair, setPair] = useState(
    initial ? `${initial.latitude}, ${initial.longitude}` : "",
  );
  const [label, setLabel] = useState(initialName?.trim() || "");
  const point = parsePoint(pair);
  const invalid = pair.trim().length > 0 && !point;

  return (
    <Modal visible animationType="slide" onRequestClose={onCancel}>
      <View style={[s.screen, { paddingTop: insets.top }]}>
        <Row spread style={s.header}>
          <IconButton
            icon="close"
            label="Cancel"
            onPress={onCancel}
            size={24}
          />
          <Text style={type.title}>Pick a spot</Text>
          <View style={s.headerSpacer} />
        </Row>
        <Column gap={space.lg} style={s.body}>
          <Text style={type.subtitle}>
            The map picker runs in the iOS and Android apps. Here, paste the
            coordinates from a maps URL.
          </Text>
          <Field
            label="Latitude and longitude"
            value={pair}
            onChangeText={setPair}
            placeholder="40.24969, -111.64930"
            error={invalid ? "Enter two numbers, like 40.24969, -111.64930" : undefined}
            autoCapitalize="none"
          />
          <Field
            label="What is this place called?"
            value={label}
            onChangeText={setLabel}
            placeholder="Lincoln Park courts"
            maxLength={80}
          />
          <Button
            title="Use this spot"
            disabled={!point}
            onPress={() => point && onPick({ ...point, name: label.trim() })}
          />
        </Column>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  header: { paddingHorizontal: space.lg, paddingVertical: space.md },
  headerSpacer: { width: 32 },
  body: { paddingHorizontal: space.xl, paddingTop: space.lg },
});
