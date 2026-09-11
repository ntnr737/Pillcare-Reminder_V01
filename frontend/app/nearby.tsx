import { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Linking, RefreshControl, Modal, Alert, TextInput
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { track } from "@/src/lib/analytics";
import { get, K } from "@/src/lib/store";
import * as Location from "expo-location";

const BG = "#0B0D14", SF = "#161926", N8 = "#2A2E42", TX = "#F9FAFB",
  TM = "rgba(249, 250, 251, 0.65)", AC = "#8B5CF6", A3 = "#A78BFA",
  AB = "rgba(139, 92, 246, 0.18)", BD = "rgba(255, 255, 255, 0.08)";

const BACKEND = process.env.EXPO_PUBLIC_BACKEND_URL || "http://localhost:8000";

async function fetchWithTimeout(url: string, options: any = {}, ms = 15000): Promise<Response> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), ms);
    try {
          return await fetch(url, { ...options, signal: controller.signal });
    } finally {
          clearTimeout(id);
    }
}

function formatWhatsAppPhone(phone?: string): string | null {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length === 10) {
    digits = "91" + digits;
  } else if (digits.length === 11 && digits.startsWith("0")) {
    digits = "91" + digits.substring(1);
  }
  return digits.length >= 10 ? digits : null;
}

type PlaceType = "pharmacy" | "diagnostic" | "hospital";
type Place = {
  id: string; name: string; address: string; phone?: string;
  distance: number; rating?: number; open?: boolean;
  lat: number; lng: number;
};

const TYPE_CONFIG: Record<PlaceType, { label: string; icon: string; color: string; mapQuery: string }> = {
  pharmacy:   { label: "Medical Stores",    icon: "medkit-outline",      color: "#4ade80", mapQuery: "pharmacy+medical+store+chemist" },
  diagnostic: { label: "Diagnostic Labs",   icon: "flask-outline",       color: A3,        mapQuery: "diagnostic+lab+pathology+blood+test" },
  hospital:   { label: "Hospitals & Clinics", icon: "medical-outline",  color: "#f472b6", mapQuery: "hospital+clinic+nursing+home" },
};

const RADII = [
  { label: "200m", value: 200 },
  { label: "500m", value: 500 },
  { label: "1 km", value: 1000 },
  { label: "2 km", value: 2000 },
];

function fmt(m: number) {
  return m < 1000 ? `${m}m away` : `${(m / 1000).toFixed(1)} km away`;
}

export default function Nearby() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ type?: string }>();
  const [type, setType] = useState<PlaceType>((params.type as PlaceType) || "pharmacy");
  const [radius, setRadius] = useState(2000);
  const [openOnly, setOpenOnly] = useState(false);
  const [hasPhoneOnly, setHasPhoneOnly] = useState(false);
  const [places, setPlaces] = useState<Place[]>([]);
  const [source, setSource] = useState<"google" | "osm" | null>(null);
  const [loading, setLoading] = useState(false);
  const [locError, setLocError] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [phonePromptPlace, setPhonePromptPlace] = useState<{ place: Place; message: string } | null>(null);
  const [manualPhone, setManualPhone] = useState("");

  const sendWhatsAppPrescription = async (p: Place, overridePhone?: string) => {
    try {
      let targetPhone = overridePhone || p.phone;

      // Smart check: If phone is missing on local place object, attempt fast 3s lookup via backend
      if (!targetPhone && p.id) {
        try {
          const token = await (await import("@/src/lib/auth")).getStoredToken();
          const res = await fetchWithTimeout(
            `${BACKEND}/api/place-phone?place_id=${encodeURIComponent(p.id)}`,
            { headers: { Authorization: `Bearer ${token}` } },
            3500
          );
          if (res.ok) {
            const data = await res.json();
            if (data.phone) {
              targetPhone = data.phone;
              p.phone = data.phone; // Cache on place object so Call button & future taps reuse it!
            }
          }
        } catch {}
      }

      const formattedPhone = formatWhatsAppPhone(targetPhone);

      const meds = (await get<any[]>(K.medications)) || [];
      const activeMeds = meds.filter((m: any) => m.active !== false);
      let medText = "";
      if (activeMeds.length > 0) {
        medText = activeMeds.map((m: any) => `• ${m.name} ${m.dosage ? m.dosage + " " + (m.unit || "") : ""}`).join("\n");
      } else {
        medText = "• Prescription medicines list";
      }

      const msg = `Hi ${p.name}, I found your listing on PillCare.\n\nI would like to inquire / order:\n${medText}\n\nPlease confirm availability & price. Thank you!`;
      const encodedMsg = encodeURIComponent(msg);

      if (formattedPhone) {
        if (overridePhone) p.phone = overridePhone;
        Linking.openURL(`https://wa.me/${formattedPhone}?text=${encodedMsg}`);
      } else {
        // Only if phone number is completely unlisted across Google & OSM
        setManualPhone("");
        setPhonePromptPlace({ place: p, message: msg });
      }
    } catch {
      Alert.alert("Error", "Could not prepare WhatsApp message. Please try again.");
    }
  };

  const getLocation = async () => {
    // 1. Instant resolution for Web Browser
    if (typeof window !== "undefined" && navigator.geolocation) {
      try {
        const webPos = await new Promise<{ lat: number; lng: number } | null>((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
            () => resolve(null),
            { timeout: 4000, enableHighAccuracy: false }
          );
        });
        if (webPos) return webPos;
      } catch {}
    }

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setLocError("PERMISSION_DENIED");
        return null;
      }
      // Try fast last known position first (50ms)
      const lastKnown = await Location.getLastKnownPositionAsync().catch(() => null);
      if (lastKnown?.coords) {
        return { lat: lastKnown.coords.latitude, lng: lastKnown.coords.longitude };
      }
      // Current position with fallback timeout
      const posPromise = Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000));
      const pos = await Promise.race([posPromise, timeoutPromise]);
      if (pos?.coords) {
        return { lat: pos.coords.latitude, lng: pos.coords.longitude };
      }
    } catch {}

    // Default fallback coordinates (New Delhi) if location hardware times out
    return { lat: 28.6139, lng: 77.2090 };
  };

  const search = useCallback(async (c?: { lat: number; lng: number }) => {
    setLoading(true); setLocError("");
    try {
      const loc = c || coords || await getLocation();
      if (!loc) { setLoading(false); return; }
      setCoords(loc);

      const searchRadius = Math.max(radius, 5000);

      // Try backend endpoint first (Google Places / Server Overpass)
      try {
        const token = await (await import("@/src/lib/auth")).getStoredToken().catch(() => null);
        const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await fetchWithTimeout(
          `${BACKEND}/api/nearby?lat=${loc.lat}&lng=${loc.lng}&radius=${searchRadius}&type=${type}`,
          { headers },
          7000
        );
        if (res.ok) {
          const data = await res.json();
          if (data.places?.length) {
            setPlaces(data.places);
            setSource(data.source === "osm" ? "osm" : "google");
            setLoading(false);
            return;
          }
        }
      } catch {}

      // Fallback: Comprehensive Overpass API (OpenStreetMap)
      let query = "";
      if (type === "pharmacy") {
        query = `[out:json][timeout:8];(node["amenity"="pharmacy"](around:${searchRadius},${loc.lat},${loc.lng});node["shop"="chemist"](around:${searchRadius},${loc.lat},${loc.lng});node["shop"="pharmacy"](around:${searchRadius},${loc.lat},${loc.lng});way["amenity"="pharmacy"](around:${searchRadius},${loc.lat},${loc.lng}););out center 25;`;
      } else if (type === "diagnostic") {
        query = `[out:json][timeout:8];(node["healthcare"="laboratory"](around:${searchRadius},${loc.lat},${loc.lng});node["healthcare"="pathology"](around:${searchRadius},${loc.lat},${loc.lng});node["amenity"="laboratory"](around:${searchRadius},${loc.lat},${loc.lng});node["shop"="medical_lab"](around:${searchRadius},${loc.lat},${loc.lng});way["healthcare"="laboratory"](around:${searchRadius},${loc.lat},${loc.lng});way["amenity"="clinic"](around:${searchRadius},${loc.lat},${loc.lng}););out center 25;`;
      } else {
        query = `[out:json][timeout:8];(node["amenity"="hospital"](around:${searchRadius},${loc.lat},${loc.lng});node["amenity"="clinic"](around:${searchRadius},${loc.lat},${loc.lng});node["healthcare"="hospital"](around:${searchRadius},${loc.lat},${loc.lng});way["amenity"="hospital"](around:${searchRadius},${loc.lat},${loc.lng}););out center 25;`;
      }

      const overpassMirrors = [
        "https://overpass-api.de/api/interpreter",
        "https://overpass.kumi.systems/api/interpreter",
        "https://overpass.openstreetmap.ru/api/interpreter",
      ];
      let osmData: any = null;
      const mirrorResults = await Promise.allSettled(overpassMirrors.map(mirrorUrl =>
        fetchWithTimeout(mirrorUrl, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: `data=${encodeURIComponent(query)}`,
        }, 5000).then(r => { if (!r.ok) throw new Error("bad status"); return r.json(); })
      ));
      const firstOk = mirrorResults.find(r => r.status === "fulfilled") as PromiseFulfilledResult<any> | undefined;
      if (firstOk) osmData = firstOk.value;
      if (!osmData) throw new Error("Overpass failed");

      const results: Place[] = (osmData.elements || [])
        .map((el: any) => {
          const elLat = el.lat || el.center?.lat;
          const elLng = el.lon || el.center?.lon;
          const dlat = (elLat - loc.lat) * 111000;
          const dlng = (elLng - loc.lng) * 111000 * Math.cos(loc.lat * Math.PI / 180);
          const dist = Math.round(Math.sqrt(dlat * dlat + dlng * dlng));
          const tags = el.tags || {};
          const storeName = tags.name || tags["name:en"] || tags.brand || tags.operator || tags.official_name || (type === "pharmacy" ? "Medical Store / Pharmacy" : type === "diagnostic" ? "Diagnostic & Pathology Lab" : "Hospital / Clinic");
          const phone = tags.phone || tags["contact:phone"] || tags["contact:mobile"] || tags.mobile || null;
          return {
            id: String(el.id),
            name: storeName,
            address: [tags["addr:street"], tags["addr:suburb"], tags["addr:city"]].filter(Boolean).join(", ") || tags["addr:full"] || "Location near you",
            phone: phone,
            distance: dist, lat: elLat, lng: elLng,
            open: undefined, rating: 4.5,
          };
        })
        .filter((p: Place) => {
          if (type === "diagnostic") {
            const plower = p.name.toLowerCase();
            const isPharm = (plower.includes("pharmacy") || plower.includes("chemist") || plower.includes("medicos") || plower.includes("medical store")) &&
                            !plower.includes("lab") && !plower.includes("pathology") && !plower.includes("diagnostic") && !plower.includes("test") && !plower.includes("scan");
            if (isPharm) return false;
          }
          return true;
        })
        .slice(0, 20)
        .sort((a: Place, b: Place) => a.distance - b.distance);

      setPlaces(results);
      setSource("osm");
      if (!results.length) setLocError("No results found nearby. Try expanding your search radius.");
    } catch (e) {
      setLocError("Could not fetch nearby places. Please check your network and try again.");
    } finally { setLoading(false); setRefreshing(false); }
  }, [radius, type, coords]);

  useEffect(() => { search(); }, [type, radius]);

  const openMaps = (p: Place) => {
    // Directions via Google Maps (external) — only when user explicitly taps Directions
    Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}&travelmode=walking`);
  };

  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);

  const openGoogleMaps = () => {
    if (!coords) return;
    const q = encodeURIComponent(TYPE_CONFIG[type].mapQuery);
    Linking.openURL(`https://www.google.com/maps/search/${q}/@${coords.lat},${coords.lng},15z`);
  };

  const cfg = TYPE_CONFIG[type];

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.hdr}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={20} color={TX} />
        </TouchableOpacity>
        <Text style={s.title}>Nearby</Text>
        <TouchableOpacity onPress={openGoogleMaps} style={s.mapBtn}>
          <Ionicons name="map-outline" size={18} color={A3} />
        </TouchableOpacity>
      </View>

      {/* Type tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.typeTabs}>
        {(Object.entries(TYPE_CONFIG) as [PlaceType, typeof TYPE_CONFIG[PlaceType]][]).map(([t, cfg]) => (
          <TouchableOpacity key={t} onPress={() => setType(t)}
            style={[s.typeTab, type === t && { backgroundColor: AB, borderColor: AC }]}>
            <Ionicons name={cfg.icon as any} size={13} color={type === t ? A3 : TM} />
            <Text style={[s.typeTabTx, type === t && { color: A3 }]}>{cfg.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Radius selector & Quick Filters */}
      <View style={s.radRow}>
        <Text style={s.radLabel}>Radius:</Text>
        {RADII.map(r => (
          <TouchableOpacity key={r.value} onPress={() => setRadius(r.value)}
            style={[s.radBtn, radius === r.value && s.radBtnOn]}>
            <Text style={[s.radTx, radius === r.value && { color: A3, fontWeight: "700" }]}>{r.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={{ flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingBottom: 10 }}>
        <TouchableOpacity
          onPress={() => setOpenOnly(!openOnly)}
          style={[s.filterChip, openOnly && s.filterChipOn]}>
          <Ionicons name="time-outline" size={12} color={openOnly ? "#4ade80" : TM} />
          <Text style={[s.filterChipTx, openOnly && { color: "#4ade80", fontWeight: "700" }]}>Open Now</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setHasPhoneOnly(!hasPhoneOnly)}
          style={[s.filterChip, hasPhoneOnly && s.filterChipOn]}>
          <Ionicons name="logo-whatsapp" size={12} color={hasPhoneOnly ? "#25D366" : TM} />
          <Text style={[s.filterChipTx, hasPhoneOnly && { color: "#25D366", fontWeight: "700" }]}>WhatsApp Ready</Text>
        </TouchableOpacity>
      </View>

      {/* Results */}
      <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); search(); }} tintColor={A3} />}>

        {loading && (
          <View style={s.center}><ActivityIndicator color={A3} size="large" /><Text style={s.cS}>Finding nearby {cfg.label.toLowerCase()}…</Text></View>
        )}

        {locError ? (
          <View style={[s.card, { alignItems: "center", gap: 12, padding: 28 }]}>
            <Ionicons name={locError === "PERMISSION_DENIED" ? "location-outline" : "wifi-outline"} size={36} color={TM} />
            <Text style={[s.cT, { textAlign: "center", lineHeight: 22 }]}>
              {locError === "PERMISSION_DENIED"
                ? "Location permission required"
                : locError}
            </Text>
            {locError === "PERMISSION_DENIED" ? (
              <>
                <Text style={[s.cS, { textAlign: "center" }]}>
                  {"Go to Settings → Apps → PillCare → Permissions → Location → Allow while using app"}
                </Text>
                <TouchableOpacity style={[s.retryBtn, { backgroundColor: "rgba(145,132,217,0.2)" }]}
                  onPress={() => Linking.openURL("app-settings:")}>
                  <Text style={{ color: AC, fontWeight: "700", fontSize: 13 }}>Open Settings</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity style={s.retryBtn} onPress={() => search()}>
                  <Text style={{ color: A3, fontWeight: "600", fontSize: 13 }}>Try Again</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.retryBtn, { marginTop: 10 }]} onPress={openGoogleMaps}>
                  <Text style={{ color: A3, fontWeight: "600", fontSize: 13 }}>Open in Google Maps</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        ) : null}

        {!loading && !locError && places.filter(p => (!openOnly || p.open !== false) && (!hasPhoneOnly || !!p.phone)).length === 0 && (
          <View style={[s.card, { alignItems: "center", padding: 32, gap: 10 }]}>
            <Ionicons name="search-outline" size={32} color={TM} />
            <Text style={s.cT}>No {cfg.label} found matching filters</Text>
            <Text style={s.cS}>Try expanding radius or resetting quick filters</Text>
          </View>
        )}

        {places
          .filter(p => (!openOnly || p.open !== false) && (!hasPhoneOnly || !!p.phone))
          .map(p => (
          <TouchableOpacity key={p.id} style={s.card} onPress={() => setSelectedPlace(p)}>
            <View style={s.cardTop}>
              <View style={[s.placeIco, { backgroundColor: `${cfg.color}18` }]}>
                <Ionicons name={cfg.icon as any} size={18} color={cfg.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.cT} numberOfLines={1}>{p.name}</Text>
                <Text style={s.cS} numberOfLines={1}>{p.address}</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 3 }}>
                  <View style={s.distBadge}>
                    <Ionicons name="navigate-outline" size={10} color={A3} />
                    <Text style={{ fontSize: 10, color: A3, fontWeight: "600" }}>{fmt(p.distance)}</Text>
                  </View>
                  {p.open !== undefined && (
                    <View style={[s.distBadge, { backgroundColor: p.open ? "rgba(74,222,128,0.1)" : "rgba(229,133,133,0.1)" }]}>
                      <Text style={{ fontSize: 10, color: p.open ? "#4ade80" : "#e58585", fontWeight: "600" }}>
                        {p.open ? "Open" : "Closed"}
                      </Text>
                    </View>
                  )}
                  {p.rating && (
                    <View style={s.distBadge}>
                      <Ionicons name="star" size={10} color="#fbbf24" />
                      <Text style={{ fontSize: 10, color: "#fbbf24", fontWeight: "600" }}>{p.rating.toFixed(1)}</Text>
                    </View>
                  )}
                </View>
              </View>
              <Ionicons name="chevron-forward" size={14} color={TM} />
            </View>

            <View style={s.cardActions}>
              {p.phone ? (
                <TouchableOpacity style={[s.actionBtn, { borderColor: "rgba(74,222,128,0.3)", backgroundColor: "rgba(74,222,128,0.08)" }]}
                  onPress={e => { e.stopPropagation(); Linking.openURL(`tel:${(p.phone||"").replace(/[\s\-()]/g,"")}`); }}>
                  <Ionicons name="call" size={14} color="#4ade80" />
                  <Text style={[s.actionTx, { color: "#4ade80" }]}>Call now</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity style={[s.actionBtn, { borderColor: "rgba(37,211,102,0.4)", backgroundColor: "rgba(37,211,102,0.12)" }]}
                onPress={e => { e.stopPropagation(); sendWhatsAppPrescription(p); }}>
                <Ionicons name="logo-whatsapp" size={14} color="#25D366" />
                <Text style={[s.actionTx, { color: "#25D366", fontWeight: "700" }]}>WhatsApp Order</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.actionBtn, { flex: 1 }]} onPress={e => { e.stopPropagation(); openMaps(p); }}>
                <Ionicons name="navigate" size={14} color={A3} />
                <Text style={s.actionTx}>Directions</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        ))}

        {places.length > 0 && (
          <View style={{ paddingVertical: 8, alignItems: "center", gap: 4 }}>
            <Text style={s.cS}>{source === "osm" ? "Data from OpenStreetMap contributors" : "Data from Google"}</Text>
            <TouchableOpacity onPress={openGoogleMaps}>
              <Text style={{ fontSize: 11, color: A3, fontWeight: "600" }}>See all on Google Maps →</Text>
            </TouchableOpacity>
          </View>
        )}
        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Place detail sheet — shown inside app, no redirect */}
      <Modal visible={!!selectedPlace} transparent animationType="slide" onRequestClose={() => setSelectedPlace(null)}>
        <TouchableOpacity style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.6)" }} activeOpacity={1} onPress={() => setSelectedPlace(null)}>
          <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation?.()} style={{ backgroundColor: SF, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: insets.bottom + 20, gap: 16, borderWidth: 1, borderColor: BD }}>
            {selectedPlace && (<>
              <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
                <View style={{ flex: 1, gap: 4 }}>
                  <View style={[s.placeIco, { backgroundColor: `${cfg.color}18`, marginBottom: 8 }]}>
                    <Ionicons name={cfg.icon as any} size={20} color={cfg.color} />
                  </View>
                  <Text style={{ fontSize: 17, fontWeight: "700", color: TX }}>{selectedPlace.name}</Text>
                  <Text style={{ fontSize: 13, color: TM }}>{selectedPlace.address}</Text>
                  <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
                    <View style={s.distBadge}>
                      <Ionicons name="navigate-outline" size={10} color={A3} />
                      <Text style={{ fontSize: 11, color: A3, fontWeight: "600" }}>{fmt(selectedPlace.distance)}</Text>
                    </View>
                    {selectedPlace.rating ? (
                      <View style={s.distBadge}>
                        <Ionicons name="star" size={10} color="#fbbf24" />
                        <Text style={{ fontSize: 11, color: "#fbbf24", fontWeight: "600" }}>{selectedPlace.rating.toFixed(1)}</Text>
                      </View>
                    ) : null}
                    {selectedPlace.open !== undefined ? (
                      <View style={[s.distBadge, { backgroundColor: selectedPlace.open ? "rgba(74,222,128,0.1)" : "rgba(229,133,133,0.1)" }]}>
                        <Text style={{ fontSize: 11, color: selectedPlace.open ? "#4ade80" : "#e58585", fontWeight: "600" }}>
                          {selectedPlace.open ? "Open now" : "Closed"}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </View>
                <TouchableOpacity onPress={() => setSelectedPlace(null)} style={{ padding: 4 }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons name="close" size={22} color={TM} />
                </TouchableOpacity>
              </View>

              {/* Action buttons — WhatsApp Prescription Order & Phone Call */}
              <TouchableOpacity style={[s.actionBtn, { paddingVertical: 14, justifyContent: "center", borderColor: "rgba(37,211,102,0.4)", backgroundColor: "rgba(37,211,102,0.12)" }]}
                onPress={() => sendWhatsAppPrescription(selectedPlace)}>
                <Ionicons name="logo-whatsapp" size={18} color="#25D366" />
                <Text style={[s.actionTx, { color: "#25D366", fontSize: 15, fontWeight: "700" }]}>Send Prescription via WhatsApp</Text>
              </TouchableOpacity>

              {selectedPlace.phone ? (
                <TouchableOpacity style={[s.actionBtn, { paddingVertical: 14, justifyContent: "center", borderColor: "rgba(74,222,128,0.4)", backgroundColor: "rgba(74,222,128,0.1)" }]}
                  onPress={() => Linking.openURL(`tel:${(selectedPlace.phone||"").replace(/[\s\-()]/g,"")}`)}> 
                  <Ionicons name="call" size={18} color="#4ade80" />
                  <Text style={[s.actionTx, { color: "#4ade80", fontSize: 15 }]}>Call {selectedPlace.phone}</Text>
                </TouchableOpacity>
              ) : null}

              <View style={{ flexDirection: "row", gap: 10 }}>
                <TouchableOpacity style={[s.actionBtn, { flex: 1, paddingVertical: 12, justifyContent: "center" }]}
                  onPress={() => openMaps(selectedPlace)}>
                  <Ionicons name="navigate" size={16} color={A3} />
                  <Text style={[s.actionTx, { fontSize: 13 }]}>Walking directions</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.actionBtn, { flex: 1, paddingVertical: 12, justifyContent: "center" }]}
                  onPress={() => Linking.openURL(`https://www.google.com/maps/search/${encodeURIComponent(selectedPlace.name)}/@${selectedPlace.lat},${selectedPlace.lng},17z`)}>
                  <Ionicons name="car-outline" size={16} color={A3} />
                  <Text style={[s.actionTx, { fontSize: 13 }]}>Driving route</Text>
                </TouchableOpacity>
              </View>
              <View style={{ height: 8 }} />
            </>)}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Phone prompt modal when location has no phone registered */}
      <Modal visible={!!phonePromptPlace} transparent animationType="fade" onRequestClose={() => setPhonePromptPlace(null)}>
        <TouchableOpacity style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.7)", padding: 20 }} activeOpacity={1} onPress={() => setPhonePromptPlace(null)}>
          <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation?.()} style={{ width: "100%", maxWidth: 400, backgroundColor: SF, borderRadius: 16, padding: 20, gap: 14, borderWidth: 1, borderColor: BD }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Ionicons name="logo-whatsapp" size={20} color="#25D366" />
                <Text style={{ fontSize: 15, fontWeight: "700", color: TX, flex: 1 }} numberOfLines={1}>
                  WhatsApp {phonePromptPlace?.place.name}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setPhonePromptPlace(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={20} color={TM} />
              </TouchableOpacity>
            </View>
            <Text style={{ fontSize: 12, color: TM, lineHeight: 17 }}>
              This location does not have a public phone number listed. Enter their mobile / WhatsApp number below to chat directly:
            </Text>
            <TextInput
              style={{ height: 44, backgroundColor: BG, borderRadius: 10, borderWidth: 1, borderColor: BD, paddingHorizontal: 14, color: TX, fontSize: 14 }}
              placeholder="e.g. 98765 43210"
              placeholderTextColor={TM}
              keyboardType="phone-pad"
              value={manualPhone}
              onChangeText={setManualPhone}
            />
            <TouchableOpacity
              style={[s.actionBtn, { height: 44, justifyContent: "center", backgroundColor: "#25D366", borderColor: "#25D366" }]}
              onPress={() => {
                if (!manualPhone.trim()) {
                  Alert.alert("Enter Phone Number", "Please enter a valid mobile number.");
                  return;
                }
                const p = phonePromptPlace?.place;
                setPhonePromptPlace(null);
                if (p) sendWhatsAppPrescription(p, manualPhone.trim());
              }}>
              <Ionicons name="send" size={16} color="#fff" />
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>Send WhatsApp Message</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.actionBtn, { height: 38, justifyContent: "center", backgroundColor: "transparent", borderColor: BD }]}
              onPress={() => {
                const p = phonePromptPlace?.place;
                setPhonePromptPlace(null);
                if (p) {
                  Linking.openURL(`https://www.google.com/search?q=${encodeURIComponent(p.name + " " + p.address + " phone number")}`);
                }
              }}>
              <Ionicons name="search-outline" size={14} color={A3} />
              <Text style={{ color: A3, fontSize: 12, fontWeight: "600" }}>Search Store Phone on Google</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  hdr: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: BD },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  mapBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: AB, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 16, fontWeight: "700", color: TX },
  typeTabs: { gap: 8, paddingHorizontal: 16, paddingVertical: 10 },
  typeTab: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, height: 34, borderRadius: 999, borderWidth: 1, borderColor: BD },
  typeTabTx: { fontSize: 12, color: TM, fontWeight: "600" },
  radRow: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, paddingBottom: 10 },
  radLabel: { fontSize: 11, color: TM, fontWeight: "600" },
  radBtn: { paddingHorizontal: 12, height: 28, borderRadius: 999, borderWidth: 1, borderColor: BD, alignItems: "center", justifyContent: "center" },
  radBtnOn: { backgroundColor: AB, borderColor: AC },
  radTx: { fontSize: 11, color: TM },
  filterChip: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, height: 26, borderRadius: 999, borderWidth: 1, borderColor: BD, backgroundColor: "transparent" },
  filterChipOn: { backgroundColor: "rgba(139, 92, 246, 0.12)", borderColor: AC },
  filterChipTx: { fontSize: 11, color: TM },
  body: { padding: 16, gap: 10, paddingBottom: 40 },
  center: { alignItems: "center", paddingVertical: 48, gap: 12 },
  card: { backgroundColor: SF, borderRadius: 14, padding: 13, gap: 10, borderWidth: 1, borderColor: BD },
  cardTop: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  placeIco: { width: 42, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  cT: { fontSize: 13, fontWeight: "700", color: TX },
  cS: { fontSize: 10, color: TM, marginTop: 1, lineHeight: 14 },
  distBadge: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 7, paddingVertical: 2, backgroundColor: AB, borderRadius: 999 },
  cardActions: { flexDirection: "row", gap: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: BD },
  actionBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingHorizontal: 12, height: 32, borderRadius: 9, backgroundColor: "rgba(233,233,237,0.06)", borderWidth: 1, borderColor: BD },
  actionTx: { fontSize: 11, color: A3, fontWeight: "600" },
  retryBtn: { paddingHorizontal: 20, height: 36, borderRadius: 10, backgroundColor: AB, borderWidth: 1, borderColor: AC, alignItems: "center", justifyContent: "center" },
});
