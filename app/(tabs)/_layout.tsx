import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";

type TabIconProps = {
  color: string;
  size: number;
  focused: boolean;
};

export default function Layout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#60A5FA",
        tabBarInactiveTintColor: "#A0A0A0",
        tabBarStyle: {
          backgroundColor: "#0b1220",
          borderColor: "#0b1220",
          borderTopWidth: 0,
        },
        contentStyle: { backgroundColor: "#0b1220" },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }: TabIconProps) => (
            <Ionicons name="home" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="wishlist"
        options={{
          title: "Wishlist",
          tabBarIcon: ({ color, size }: TabIconProps) => (
            <Ionicons name="heart" size={size} color={color} />
          ),
        }}
      />

      {/* Hidden stack for game detail */}
      <Tabs.Screen
        name="game"
        options={{
          href: null, // hides the whole game stack from the tab bar
        }}
      />

      <Tabs.Screen
        name="Account"
        options={{
          title: "Account",
          tabBarIcon: ({ color, size }: TabIconProps) => (
            <Ionicons name="person" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
