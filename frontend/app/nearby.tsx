import { useCallback, useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Location from "expo-location";
import { theme } from "@/src/lib/theme";
import { Card } from "@/src/components/PrimaryButton";

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL || "";

const RADIUS_OPTIONS = [
  { value: 200, label: "200m" },
  { value: 500, label: "500m" },
  { value: 1000, label: "1 km" },
  { value: 2000, label: "2 km" },
];

export default function Nearby() {
  const router = useRouter();
  const [places, setPlaces] = useState<any[]>([]);
  const [placeTypes, setPlaceTypes] = useState<any[]>([]);
  const [selectedType, setSelectedType] = useState("pharmacy");
  const [radius, setRadius] = useState(1000);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  useEffect(() => {
    loadPlaceTypes();
    requestLocationAndFetch();
  }, []);

  const loadPlaceTypes = async () => {
    try {
      const res = await fetch(`${BASE}/api/places/types`);
      const data = await res.json();
      setPlaceTypes(data.types || []);
    } catch (e) {
      console.warn("Could not load place types", e);
    }
  };

  const requestLocationAndFetch = async () => {
    setLoading(true);
    setError(null);

    try {
      // Request permission
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== "granted") {
        setError("Location permission is required to find nearby places. Please enable it in Settings.");
        setLoading(false);
        return;
      }

      // Get current location
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      setLocation({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });

      // Fetch nearby places
      await fetchNearbyPlaces(loc.coords.latitude, loc.coords.longitude);
    } catch (e: any) {
      console.error("Location error:", e);
      setError("Could not fetch nearby places. Make sure Location permission is allowed for PillCare in Settings.");
    } finally {
      setLoading(false);
    }
  };

  const fetchNearbyPlaces = async (lat: number, lng: number) => {
    try {
      const res = await fetch(
        `${BASE}/api/places/nearby?lat=${lat}&lng=${lng}&radius=${radius}&place_type=${selectedType}`
      );

      if (!res.ok) {
        throw new Error("Failed to fetch places");
      }

      const data = await res.json();
      setPlaces(data.places || []);
    } catch (e: any) {
      console.error("Fetch error:", e);
      setError("Could not load nearby places. Please try again.");
    }
  };

  const refresh = () => {
    if (location) {
      setLoading(true);
      setError(null);
      fetchNearbyPlaces(location.latitude, location.longitude).finally(() => setLoading(false));
    } else {
      requestLocationAndFetch();
    }
  };

  const changeTypeAndRefresh = (type: string) => {
    setSelectedType(type);
    if (location) {
      setLoading(true);
      fetchNearbyPlaces(location.latitude, location.longitude).finally(() => setLoading(false));
    }
  };

  const changeRadiusAndRefresh = (newRadius: number) => {
    setRadius(newRadius);
    if (location) {
      setLoading(true);
      fetchNearbyPlaces(location.latitude, location.longitude).finally(() => setLoading(false));
    }
  };

  const openMap = (lat: number, lng: number, name: string) => {
    // Open in maps app
    const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}&query_place_id=${name}`;
    Alert.alert("Navigate", `Open ${name} in maps?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Open Maps", onPress: () => console.log("Open:", url) },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} testID="back-btn">
          <Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Nearby</Text>
        <TouchableOpacity onPress={refresh} testID="refresh-btn">
          <Ionicons name="refresh" size={24} color={theme.colors.brand} />
        </TouchableOpacity>
      </View>

      {/* Place Type Filter */}
      <View style={styles.filterSection}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {placeTypes.map((type) => (
            <TouchableOpacity
              key={type.key}
              testID={`type-${type.key}`}
              onPress={() => changeTypeAndRefresh(type.key)}
              style={[styles.chip, selectedType === type.key && styles.chipActive]}
            >
              <Ionicons
                name={type.icon as any}
                size={16}
                color={selectedType === type.key ? theme.colors.textInverse : theme.colors.textSecondary}
              />
              <Text style={[styles.chipText, selectedType === type.key && styles.chipTextActive]}>
                {type.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Radius Filter */}
      <View style={styles.radiusSection}>
        <Text style={styles.radiusLabel}>Radius:</Text>
        {RADIUS_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.value}
            testID={`radius-${opt.value}`}
            onPress={() => changeRadiusAndRefresh(opt.value)}
            style={[styles.radiusChip, radius === opt.value && styles.radiusChipActive]}
          >
            <Text style={[styles.radiusText, radius === opt.value && styles.radiusTextActive]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Error State */}
      {error && (
        <View style={styles.errorBox}>
          <Ionicons name="wifi-outline" size={48} color={theme.colors.textSecondary} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={requestLocationAndFetch} style={styles.retryBtn} testID="try-again-btn">
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Loading State */}
      {loading && !error && (
        <View style={styles.loadingBox}>
          <Text style={styles.loadingText}>Finding nearby places...</Text>
        </View>
      )}

      {/* Places List */}
      {!loading && !error && (
        <ScrollView contentContainerStyle={styles.list}>
          {places.length === 0 && (
            <Card>
              <Text style={styles.empty}>No places found within {radius}m radius.</Text>
              <Text style={styles.emptySub}>Try increasing the search radius.</Text>
            </Card>
          )}
          {places.map((place) => (
            <TouchableOpacity
              key={place.id}
              testID={`place-${place.id}`}
              onPress={() => openMap(place.lat, place.lng, place.name)}
              activeOpacity={0.7}
            >
              <Card style={{ marginBottom: 12 }}>
                <View style={styles.placeRow}>
                  <View style={styles.iconCircle}>
                    <Ionicons
                      name={
                        place.type === "pharmacy"
                          ? "medical"
                          : place.type === "hospital"
                          ? "fitness"
                          : "flask"
                      }
                      size={20}
                      color={theme.colors.brand}
                    />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.placeName}>{place.name}</Text>
                    <Text style={styles.placeAddress}>{place.address}</Text>
                    <View style={styles.metaRow}>
                      <Text style={styles.distance}>📍 {place.distance}m away</Text>
                      {place.rating && (
                        <Text style={styles.rating}>⭐ {place.rating.toFixed(1)}</Text>
                      )}
                      {place.open_now !== undefined && (
                        <Text style={[styles.status, { color: place.open_now ? theme.colors.success : theme.colors.error }]}>
                          {place.open_now ? "Open" : "Closed"}
                        </Text>
                      )}
                    </View>
                    {place.phone && <Text style={styles.phone}>📞 {place.phone}</Text>}
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
                </View>
              </Card>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  title: { color: theme.colors.textPrimary, fontSize: 20, fontWeight: "700" },
  filterSection: { backgroundColor: theme.colors.bg, paddingVertical: 12 },
  chips: { paddingHorizontal: 16, gap: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
  },
  chipActive: {
    backgroundColor: theme.colors.brand,
    borderColor: theme.colors.brand,
  },
  chipText: { color: theme.colors.textSecondary, fontSize: 13, fontWeight: "600" },
  chipTextActive: { color: theme.colors.textInverse },
  radiusSection: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    backgroundColor: theme.colors.bg,
  },
  radiusLabel: { color: theme.colors.textSecondary, fontSize: 14, fontWeight: "600" },
  radiusChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
  },
  radiusChipActive: {
    backgroundColor: theme.colors.brand,
    borderColor: theme.colors.brand,
  },
  radiusText: { color: theme.colors.textSecondary, fontSize: 13, fontWeight: "600" },
  radiusTextActive: { color: theme.colors.textInverse },
  errorBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  errorText: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    textAlign: "center",
    marginTop: 16,
    marginBottom: 20,
    lineHeight: 24,
  },
  retryBtn: {
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: theme.colors.brand,
  },
  retryText: { color: theme.colors.brand, fontSize: 16, fontWeight: "700" },
  loadingBox: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingText: { color: theme.colors.textSecondary, fontSize: 16 },
  list: { padding: 16, paddingBottom: 40 },
  empty: { color: theme.colors.textSecondary, fontSize: 16, textAlign: "center" },
  emptySub: {
    color: theme.colors.textDisabled,
    fontSize: 14,
    textAlign: "center",
    marginTop: 4,
  },
  placeRow: { flexDirection: "row", alignItems: "center" },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.brandMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  placeName: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: "700",
  },
  placeAddress: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  metaRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 6,
    flexWrap: "wrap",
  },
  distance: { color: theme.colors.brand, fontSize: 12, fontWeight: "600" },
  rating: { color: theme.colors.textSecondary, fontSize: 12, fontWeight: "600" },
  status: { fontSize: 12, fontWeight: "700" },
  phone: { color: theme.colors.textPrimary, fontSize: 13, marginTop: 4 },
});
