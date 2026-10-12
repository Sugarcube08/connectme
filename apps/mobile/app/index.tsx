import { useEffect } from "react";
import { useRouter } from "expo-router";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { getAuthToken } from "../lib/auth";

export default function IndexScreen() {
  const router = useRouter();

  useEffect(() => {
    async function checkAuth() {
      const token = await getAuthToken();
      if (token) {
        router.replace("/(tabs)");
      } else {
        router.replace("/login");
      }
    }

    checkAuth();
  }, [router]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#6D3CE8" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B0B10",
    alignItems: "center",
    justifyContent: "center",
  },
});
