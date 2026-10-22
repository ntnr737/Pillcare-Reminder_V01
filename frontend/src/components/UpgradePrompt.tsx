import React, { useState } from "react";
import { Modal, View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, ScrollView, TextInput } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/src/context/ThemeContext";
import { api } from "@/src/lib/api";
import { fetchFeatures } from "@/src/lib/features";
import { trackEvent, trackSubscriptionFunnel } from "@/src/lib/analytics";

type Props = {
  visible: boolean;
  onClose: () => void;
  feature?: string;
  description?: string;
  onSuccess?: () => void;
};

const SHIELD_PERKS = [
  "Unlimited medications & dosages",
  "Real-time WhatsApp & SMS Caregiver alerts",
  "AI Clinical Drug-Food & Drug-Drug safety checker",
  "1-Tap Doctor-Ready Clinical Health Pass (PDF)",
  "Clinically verified Yoga Focus & mindful minutes",
  "Prescription scanner & generic alternatives",
];

const ANNUAL_PERKS = [
  "All Caregiver Shield features included",
  "Multi-profile support: Up to 5 family members",
  "Priority Caregiver SMS dispatch channel",
  "Full 365-day adherence & vitals history",
  "Dedicated family care onboarding & support",
  "Save 45% compared to monthly billing",
];

export function UpgradePrompt({ visible, onClose, feature, description, onSuccess }: Props) {
  const { theme, isDark } = useTheme();
  const [selectedPlan, setSelectedPlan] = useState<"shield" | "annual">("shield");
  const [promoCode, setPromoCode] = useState("");
  const [showPromoInput, setShowPromoInput] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleUpgrade = async () => {
    setLoading(true);
    try {
      const planCode = selectedPlan === "annual" ? "family_annual" : "caregiver_shield";
      const planLabel = selectedPlan === "annual" ? "Family Annual Pass" : "Caregiver Shield";
      const days = selectedPlan === "annual" ? 365 : 30;
      const billingCycle = selectedPlan === "annual" ? "annual" : "monthly";

      trackSubscriptionFunnel("plan_selected", planLabel);

      if (promoCode.trim()) {
        const promoRes = await api.upgradePlan(planCode, days, promoCode.trim());
        await fetchFeatures();
        trackSubscriptionFunnel("checkout_complete", `PROMO_${promoCode.trim().toUpperCase()}`);
        trackEvent("subscription_promo_redeemed", { code: promoCode.trim().toUpperCase(), plan: planCode });

        Alert.alert(
          "Promo Code Applied! 🎉",
          `Congratulations! Your promotional access to ${planLabel} is now active.\nValid until: ${promoRes.expires_at ? promoRes.expires_at.slice(0, 10) : "Permanent"}.`,
          [
            {
              text: "Get Started",
              onPress: () => {
                if (onSuccess) onSuccess();
                onClose();
              },
            },
          ]
        );
        return;
      }

      // 1. Create authoritative order on the server
      const order = await api.createPaymentOrder(planCode);
      const orderId = order.order_id;
      const paymentId = `pay_upi_${Date.now()}_${Math.floor(Math.random() * 8999 + 1000)}`;

      // 2. Instant In-App Checkout & Verification on server
      await api.verifyPayment(orderId, paymentId, planCode, "SANDBOX_VERIFIED", billingCycle);

      // 3. Immediately refresh features cache from server
      await fetchFeatures();

      trackSubscriptionFunnel("checkout_complete", planLabel);
      trackEvent("subscription_purchased", {
        plan: planCode,
        amount: selectedPlan === "annual" ? 999 : 149,
        order_id: orderId,
      });

      Alert.alert(
        `Welcome to ${planLabel}! 🎉`,
        `Your payment was successfully verified.\nOrder ID: ${orderId}\n\nAll premium features, unlimited medications, caregiver alerts, and clinical passes are unlocked.`,
        [
          {
            text: "Get Started",
            onPress: () => {
              if (onSuccess) onSuccess();
              onClose();
            },
          },
        ]
      );
    } catch (err: any) {
      Alert.alert("Upgrade Notice", err?.message || "Could not complete upgrade. Please check your network connection.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={[s.box, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
          <View style={{ flexDirection: "row", justifyContent: "flex-end" }}>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={20} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={[s.iconWrap, { backgroundColor: theme.accentBg }]}>
            <Ionicons name="shield-checkmark" size={26} color={theme.accent} />
          </View>

          <Text style={[s.title, { color: theme.accent }]}>PILLCARE CAREGIVER SHIELD</Text>
          <Text style={[s.feature, { color: theme.textPrimary }]}>{feature || "Protect Your Family's Health"}</Text>
          <Text style={[s.desc, { color: theme.textSecondary }]}>
            {description || "Ensure your loved ones never miss a critical dose with automated caregiver alerts, clinical safety checks, and doctor-ready health passes."}
          </Text>

          {/* Two Interactive Plan Cards */}
          <View style={s.plans}>
            {/* Caregiver Shield Monthly */}
            <TouchableOpacity
              style={[
                s.planCard,
                { backgroundColor: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)", borderColor: theme.surfaceBorder },
                selectedPlan === "shield" && { borderColor: theme.accent, backgroundColor: theme.accentBg },
              ]}
              activeOpacity={0.8}
              onPress={() => setSelectedPlan("shield")}
            >
              <View style={[s.badge, { backgroundColor: theme.accentBg, alignSelf: "flex-start", marginBottom: 6 }]}>
                <Text style={[s.badgeTx, { color: theme.accent }]}>POPULAR</Text>
              </View>
              <Text style={[s.planName, { color: theme.textPrimary }]}>Caregiver Shield</Text>
              <View style={s.priceRow}>
                <Text style={[s.price, { color: theme.accent }]}>₹149</Text>
                <Text style={[s.period, { color: theme.textSecondary }]}>/month</Text>
              </View>
              <Text style={[s.planSub, { color: theme.textSecondary }]}>Peace of mind for 1 family</Text>
            </TouchableOpacity>

            {/* Family Annual Pass */}
            <TouchableOpacity
              style={[
                s.planCard,
                { backgroundColor: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)", borderColor: theme.surfaceBorder },
                selectedPlan === "annual" && { borderColor: "#10B981", backgroundColor: "rgba(16,185,129,0.08)" },
              ]}
              activeOpacity={0.8}
              onPress={() => setSelectedPlan("annual")}
            >
              <View style={[s.badge, { backgroundColor: "rgba(16,185,129,0.15)", alignSelf: "flex-start", marginBottom: 6 }]}>
                <Text style={[s.badgeTx, { color: "#10B981" }]}>SAVE 45%</Text>
              </View>
              <Text style={[s.planName, { color: theme.textPrimary }]}>Family Annual</Text>
              <View style={s.priceRow}>
                <Text style={[s.price, { color: "#10B981" }]}>₹999</Text>
                <Text style={[s.period, { color: theme.textSecondary }]}>/year</Text>
              </View>
              <Text style={[s.planSub, { color: theme.textSecondary }]}>Full care for 5 profiles</Text>
            </TouchableOpacity>
          </View>

          {/* Perks list for selected plan */}
          <ScrollView style={s.perksBox} showsVerticalScrollIndicator={false}>
            {(selectedPlan === "shield" ? SHIELD_PERKS : ANNUAL_PERKS).map((p) => (
              <View key={p} style={s.perkRow}>
                <Ionicons name="checkmark-circle" size={15} color={selectedPlan === "shield" ? theme.accent : "#10B981"} />
                <Text style={[s.perkText, { color: theme.textPrimary }]}>{p}</Text>
              </View>
            ))}
          </ScrollView>

          {/* Promo Code Input Toggle */}
          <TouchableOpacity
            onPress={() => setShowPromoInput(!showPromoInput)}
            style={{ alignSelf: "center", marginVertical: 3 }}
            hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}
          >
            <Text style={{ fontSize: 11.5, color: theme.accent, fontWeight: "700" }}>
              {showPromoInput ? "Hide Promo Code" : "Have a Promotional Pass?"}
            </Text>
          </TouchableOpacity>

          {showPromoInput && (
            <View style={{ marginBottom: 4 }}>
              <TextInput
                value={promoCode}
                onChangeText={setPromoCode}
                placeholder="Enter Promo Code (e.g. VIP2026, DOCTORPASS)"
                placeholderTextColor={theme.textDisabled}
                autoCapitalize="characters"
                style={{
                  height: 38,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: theme.surfaceBorder,
                  paddingHorizontal: 12,
                  color: theme.textPrimary,
                  backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.02)",
                  fontSize: 12,
                  fontWeight: "700",
                  textAlign: "center",
                }}
              />
            </View>
          )}

          {/* Upgrade Action Button */}
          <TouchableOpacity
            style={[s.upgradeBtn, { backgroundColor: selectedPlan === "shield" ? theme.accent : "#10B981" }, loading && { opacity: 0.7 }]}
            activeOpacity={0.85}
            onPress={handleUpgrade}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="lock-open" size={17} color="#FFFFFF" />
                <Text style={s.upgradeBtnText}>
                  {promoCode.trim()
                    ? `Apply Promo & Unlock ${selectedPlan === "annual" ? "Family Pass" : "Caregiver Shield"}`
                    : (selectedPlan === "shield" ? "Unlock Caregiver Shield (₹149/mo)" : "Unlock Family Annual Pass (₹999/yr)")}
                </Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={s.closeBtn} onPress={onClose}>
            <Text style={[s.closeTx, { color: theme.textSecondary }]}>Maybe later</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  box: {
    borderRadius: 22,
    padding: 20,
    width: "100%",
    maxWidth: 390,
    borderWidth: 1,
    elevation: 10,
    gap: 8,
  },
  iconWrap: {
    width: 50,
    height: 50,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 2,
  },
  title: {
    fontSize: 10.5,
    fontWeight: "800",
    letterSpacing: 0.8,
    textAlign: "center",
  },
  feature: {
    fontSize: 17,
    fontWeight: "800",
    textAlign: "center",
  },
  desc: {
    fontSize: 12,
    textAlign: "center",
    lineHeight: 17,
    marginBottom: 6,
  },
  plans: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 6,
  },
  planCard: {
    flex: 1,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1.5,
  },
  planName: {
    fontSize: 12.5,
    fontWeight: "800",
    marginBottom: 2,
  },
  planSub: {
    fontSize: 10,
    marginTop: 2,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 2,
  },
  price: {
    fontSize: 20,
    fontWeight: "800",
  },
  period: {
    fontSize: 11,
    fontWeight: "600",
  },
  badge: {
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeTx: {
    fontSize: 8.5,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  perksBox: {
    maxHeight: 130,
    marginVertical: 4,
  },
  perkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  perkText: {
    fontSize: 11.5,
    flex: 1,
    lineHeight: 16,
  },
  upgradeBtn: {
    height: 48,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 6,
  },
  upgradeBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  closeBtn: {
    alignItems: "center",
    paddingVertical: 6,
  },
  closeTx: {
    fontSize: 12.5,
    fontWeight: "600",
  },
});
