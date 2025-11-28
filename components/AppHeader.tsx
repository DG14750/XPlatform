// components/AppHeader.tsx
// A simple app header with title and sign-out button to reuse across screens

import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

type AppHeaderProps = {
  title: string;
  onSignOut?: () => void;
};

export default function AppHeader({ title, onSignOut }: AppHeaderProps) {
  return (
    <View style={styles.topBar}>
      <View>
        <Text style={styles.brand}>GameSeerr</Text>
        <Text style={styles.heading}>{title}</Text>
      </View>

      {onSignOut && (
        <TouchableOpacity onPress={onSignOut}>
          <Text style={styles.signOut}>Sign Out</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    paddingHorizontal: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    paddingTop: 8,
  },
  brand: {
    color: "#F9FAFB",
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  heading: {
    color: "#F3F4F6",
    fontSize: 18,
    fontWeight: "700",
    marginTop: 2,
  },
  signOut: {
    color: "#60A5FA",
    fontSize: 14,
    fontWeight: "600",
  },
});
