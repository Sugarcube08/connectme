import React from "react";
import { View, Text, StyleSheet, Platform } from "react-native";
import { Tabs } from "expo-router";
import {
  DashboardIcon,
  QrCodeIcon,
  UsersIcon,
  SettingsIcon,
  SparklesIcon,
} from "../../components/Icons";
import { Theme } from "../../constants/theme";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: {
          backgroundColor: Theme.colors.background,
          borderBottomWidth: 1,
          borderBottomColor: Theme.colors.surfaceElevated,
          elevation: 0,
          shadowOpacity: 0,
        },
        headerTintColor: Theme.colors.textPrimary,
        headerTitleStyle: {
          fontWeight: "800",
          fontSize: 17,
          letterSpacing: 0.5,
          color: Theme.colors.textPrimary,
        },
        headerRight: () => (
          <View style={styles.headerBadge}>
            <SparklesIcon size={12} color={Theme.colors.gold} />
            <Text style={styles.headerBadgeText}>CONNECT ME</Text>
          </View>
        ),
        tabBarShowLabel: true,
        tabBarActiveTintColor: Theme.colors.textPrimary,
        tabBarInactiveTintColor: Theme.colors.textMuted,
        tabBarStyle: {
          position: "absolute",
          bottom: Platform.OS === "ios" ? 24 : 16,
          left: 16,
          right: 16,
          height: 66,
          borderRadius: 33,
          backgroundColor: "rgba(19, 18, 28, 0.96)",
          borderWidth: 1.5,
          borderColor: Theme.colors.border,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.5,
          shadowRadius: 20,
          elevation: 16,
          paddingBottom: 8,
          paddingTop: 8,
          paddingHorizontal: 8,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "700",
          letterSpacing: 0.3,
          marginTop: -2,
        },
        tabBarItemStyle: {
          paddingVertical: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Overview",
          headerTitle: "Executive Overview",
          tabBarIcon: ({ focused }) => (
            <View style={[styles.tabIconWrapper, focused && styles.tabIconFocused]}>
              <DashboardIcon
                size={19}
                color={focused ? Theme.colors.textPrimary : Theme.colors.textMuted}
              />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="codes"
        options={{
          title: "Codes & QR",
          headerTitle: "Access Codes & QR",
          tabBarIcon: ({ focused }) => (
            <View style={[styles.tabIconWrapper, focused && styles.tabIconFocused]}>
              <QrCodeIcon
                size={19}
                color={focused ? Theme.colors.textPrimary : Theme.colors.textMuted}
              />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="contacts"
        options={{
          title: "Contacts",
          headerTitle: "Collected Contacts",
          tabBarIcon: ({ focused }) => (
            <View style={[styles.tabIconWrapper, focused && styles.tabIconFocused]}>
              <UsersIcon
                size={19}
                color={focused ? Theme.colors.textPrimary : Theme.colors.textMuted}
              />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          headerTitle: "System & Settings",
          tabBarIcon: ({ focused }) => (
            <View style={[styles.tabIconWrapper, focused && styles.tabIconFocused]}>
              <SettingsIcon
                size={19}
                color={focused ? Theme.colors.textPrimary : Theme.colors.textMuted}
              />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  headerBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: Theme.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Theme.radius.full,
    marginRight: 16,
  },
  headerBadgeText: {
    color: Theme.colors.gold,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  tabIconWrapper: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: Theme.radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  tabIconFocused: {
    backgroundColor: Theme.colors.primaryMuted,
  },
});
