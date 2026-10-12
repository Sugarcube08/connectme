import { Tabs } from "expo-router";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: {
          backgroundColor: "#13121C",
        },
        headerTintColor: "#F3EFE7",
        headerTitleStyle: {
          fontWeight: "700",
          fontSize: 16,
        },
        tabBarStyle: {
          backgroundColor: "#13121C",
          borderTopColor: "#2F2B48",
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: "#7E4DF5",
        tabBarInactiveTintColor: "#777681",
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Overview",
          headerTitle: "Devcon Overview",
        }}
      />
      <Tabs.Screen
        name="codes"
        options={{
          title: "Codes & QR",
          headerTitle: "Access Codes & QR",
        }}
      />
      <Tabs.Screen
        name="contacts"
        options={{
          title: "Contacts",
          headerTitle: "Attendee Contacts",
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          headerTitle: "Settings & Profile",
        }}
      />
    </Tabs>
  );
}
