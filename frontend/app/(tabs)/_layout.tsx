import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "@/src/lib/theme";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.brand,
        tabBarInactiveTintColor: theme.colors.textSecondary,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.borderSubtle,
          borderTopWidth: 1,
          paddingTop: 6,
          height: 64,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
      }}
    >
      <Tabs.Screen
        name="today"
        options={{
          title: "Today",
          tabBarIcon: ({ color, size }) => <Ionicons name="sunny-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="treatment"
        options={{
          title: "Treatment",
          tabBarIcon: ({ color, size }) => <Ionicons name="medkit-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          title: "Progress",
          tabBarIcon: ({ color, size }) => <Ionicons name="trending-up-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="support"
        options={{
          title: "Support",
          tabBarIcon: ({ color, size }) => <Ionicons name="heart-outline" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
