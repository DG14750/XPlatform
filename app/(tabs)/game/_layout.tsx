// app/(tabs)/game/_layout.tsx
import { Stack } from "expo-router";
import React from "react";

export default function GameStackLayout() {
  console.log(">>> GameStackLayout loaded"); // debug – remove later

  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* This tells Expo Router that / (tabs) / game / [id] exists */}
      <Stack.Screen name="[id]" />
    </Stack>
  );
}
