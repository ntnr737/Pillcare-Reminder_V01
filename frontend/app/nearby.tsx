import { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Linking, RefreshControl, Modal
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { track } from "@/src/lib/analytics";
import * as Location from "expo-location";

const BG = "#161826", SF = "#232532", N8 = "#3f424d", TX = "#e9e9ed",
  TM = "rgba(233,233,237,0.55)", AC = "#9184d9", A3 = "#a7a1db",
  AB = "rgba(145,132,217,0.14)", BD = "rgba(233,233,237,0.1)";

const BACKEND = process.env.EXPO_PUBLIC_BACKEND_URL || "https://pillcare-backend-1082668880575.europe-west1.run.app";

async function fetchWithTimeout(url: string, options: any = {}, ms = 15000): Promise<Response> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), ms);
    try {
          return await fetch(url, { ...options, signal: controller.signal });
    } finally {
          clearTimeout(id);
    }
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
  const params = useLocalSearchParams<{ type?: string }>();
  const [type, setType] = useState<PlaceType>((params.type as PlaceType) || "pharmacy");
  const [radius, setRadius] = useState(2000);
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(false);
  const [locError, setLocError] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const getLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      setLocError("PERMISSION_DENIED");
      return null;
    }
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return { lat: pos.coords.latitude, lng: pos.coords.longitude };
  };

  const search = useCallback(async (c?: { lat: number; lng: number }) => {
    setLoading(true); setLocError("");
    try {
      const loc = c || coords || await getLocation();
      if (!loc) { setLoading(false); return; }
      setCoords(loc);

      // Try backend endpoint first (Google Places)
      try {
        const token = await (await import("@/src/lib/auth")).getStoredToken();
      const res = await fetchWithTimeout(
          `${BACKEND}/api/nearby?lat=${loc.lat}&lng=${loc.lng}&radius=${radius}&type=${type}`,
          { headers: { Authorization: `Bearer ${token}` } }
      , 15000);
        if (res.ok) {
          const data = await res.json();
          if (data.places?.length) { setPlaces(data.places); setLoading(false); return; }
        }
      } catch {}

      // Fallback: Overpass API (OpenStreetMap) — completely free, no key
      const osmTag = type === "pharmacy" ? '"amenity"~"pharmacy|chemist"'
        : type === "diagnostic" ? '"healthcare"~"laboratory|diagnostics"'
        : '"amenity"~"hospital|clinic|doctors"';
      const query = `[out:json][timeout:20];
        (node[${osmTag}](around:${radius},${loc.lat},${loc.lng});
         way[${osmTag}](around:${radius},${loc.lat},${loc.lng}););
        out center 20;`;
const overpassMirrors = [
        "https://overpass-api.de/api/interpreter",
        "https://overpass.kumi.systems/api/interpreter",
        "https://overpass.openstreetmap.ru/api/interpreter",
      ];
          let osmData: any = null;
          for (const mirrorUrl of overpassMirrors) {
                  try {
                            const overpass = await fetchWithTimeout(mirrorUrl, {
                                        method: "POST",
                                        headers: { "Content-Type": "application/x-www-form-urlencoded" },
                                        body: `data=${encodeURIComponent(query)}`,
                            }, 12000);
                            if (!overpass.ok) continue;
                            osmData = await overpass.json();
                            break;
                  } catch {
                            continue;
                  }
          }
          if (!osmData) throw new Error("Overpass failed");
      const results: Place[] = (osmData.elements || []).slice(0, 15).map((el: any) => {
        const elLat = el.lat || el.center?.lat;
        const elLng = el.lon || el.center?.lon;
        const dlat = (elLat - loc.lat) * 111000;
        const dlng = (elLng - loc.lng) * 111000 * Math.cos(loc.lat * Math.PI / 180);
        const dist = Math.round(Math.sqrt(dlat * dlat + dlng * dlng));
        return {
          id: String(el.id),
          name: el.tags?.name || el.tags?.["name:en"] || "Medical Store",
          address: [el.tags?.["addr:street"], el.tags?.["addr:city"]].filter(Boolean).join(", ") || "Address not available",
          phone: el.tags?.phone || el.tags?.["contact:phone"],
          distance: dist, lat: elLat, lng: elLng,
          open: undefined, rating: undefined,
        };
      }).sort((a: Place, b: Place) => a.distance - b.distance);
      setPlaces(results);
      if (!results.length) setLocError("No results found nearby. Try a larger radius.");
    } catch (e) {
      setLocError("Could not fetch nearby places. Please check your internet connection and try again.");
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

      {/* Radius selector */}
      <View style={s.radRow}>
        <Text style={s.radLabel}>Radius:</Text>
        {RADII.map(r => (
          <TouchableOpacity key={r.value} onPress={() => setRadius(r.value)}
            style={[s.radBtn, radius === r.value && s.radBtnOn]}>
            <Text style={[s.radTx, radius === r.value && { color: A3, fontWeight: "700" }]}>{r.label}</Text>
          </TouchableOpacity>
        ))}
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

        {!loading && !locError && places.length === 0 && (
          <View style={[s.card, { alignItems: "center", padding: 32, gap: 10 }]}>
            <Ionicons name="search-outline" size={32} color={TM} />
            <Text style={s.cT}>No {cfg.label} found within {radius >= 1000 ? `${radius / 1000}km` : `${radius}m`}</Text>
            <Text style={s.cS}>Try increasing the radius</Text>
          </View>
        )}

        {places.map(p => (
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
              {p.phone ? (<>
                <TouchableOpacity style={[s.actionBtn, { borderColor: "rgba(74,222,128,0.3)", backgroundColor: "rgba(74,222,128,0.08)" }]}
                  onPress={e => { e.stopPropagation(); Linking.openURL(`tel:${(p.phone||"").replace(/[\s\-()]/g,"")}`); }}>
                  <Ionicons name="call" size={14} color="#4ade80" />
                  <Text style={[s.actionTx, { color: "#4ade80" }]}>Call now</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.actionBtn, { borderColor: "rgba(37,211,102,0.3)", backgroundColor: "rgba(37,211,102,0.08)" }]}
                  onPress={e => { e.stopPropagation(); const ph = (p.phone||"").replace(/[\s\-()]/g,""); Linking.openURL(`https://wa.me/${ph}?text=${encodeURIComponent("Hi, I found you on Pillcare. I would like to check availability.")}`); }}>
                  <Ionicons name="logo-whatsapp" size={14} color="#25D366" />
                  <Text style={[s.actionTx, { color: "#25D366" }]}>WhatsApp</Text>
                </TouchableOpacity>
              </>) : null}
              <TouchableOpacity style={[s.actionBtn, { flex: 1 }]} onPress={e => { e.stopPropagation(); openMaps(p); }}>
                <Ionicons name="navigate" size={14} color={A3} />
                <Text style={s.actionTx}>Directions</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        ))}

        {places.length > 0 && (
          <View style={{ paddingVertical: 8, alignItems: "center", gap: 4 }}>
            <Text style={s.cS}>Data from OpenStreetMap contributors</Text>
            <TouchableOpacity onPress={openGoogleMaps}>
              <Text style={{ fontSize: 11, color: A3, fontWeight: "600" }}>See all on Google Maps →</Text>
            </TouchableOpacity>
          </View>
        )}
        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Place detail sheet — shown inside app, no redirect */}
      <Modal visible={!!selectedPlace} transparent animationType="slide" onRequestClose={() => setSelectedPlace(null)}>
        <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.6)" }}>
          <View style={{ backgroundColor: SF, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, gap: 16, borderWidth: 1, borderColor: BD }}>
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
                <TouchableOpacity onPress={() => setSelectedPlace(null)} style={{ padding: 4 }}>
                  <Ionicons name="close" size={22} color={TM} />
                </TouchableOpacity>
              </View>

              {/* Action buttons — all inside the app */}
              {selectedPlace.phone ? (
                <TouchableOpacity style={[s.actionBtn, { paddingVertical: 14, justifyContent: "center", borderColor: "rgba(74,222,128,0.4)", backgroundColor: "rgba(74,222,128,0.1)" }]}
                  onPress={() => Linking.openURL(`tel:${(selectedPlace.phone||"").replace(/[\s\-()]/g,"")}`)}> 
                  <Ionicons name="call" size={18} color="#4ade80" />
                  <Text style={[s.actionTx, { color: "#4ade80", fontSize: 15 }]}>Call {selectedPlace.phone}</Text>
                </TouchableOpacity>
              ) : (
                <View style={[s.card, { padding: 12, alignItems: "center" }]}>
                  <Text style={{ fontSize: 13, color: TM }}>No phone number available for this location</Text>
                </View>
              )}

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
          </View>
        </View>
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
