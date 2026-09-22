import React from "react";
import { Modal, View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "@/src/constants/theme";

export interface ActionOption {
  icon: string;
  title: string;
  body: string;
  fn: () => void;
}

interface ActionSheetModalProps {
  visible: boolean;
  onClose: () => void;
  options: ActionOption[];
  title?: string;
}

export function ActionSheetModal({ visible, onClose, options, title = "What would you like to do?" }: ActionSheetModalProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={onClose}>
        <View style={s.sheetBox}>
          <View style={s.handle} />
          <View style={s.headerRow}>
            <Text style={s.title}>{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={20} color={COLORS.TM} />
            </TouchableOpacity>
          </View>
          {options.map((o) => (
            <TouchableOpacity key={o.title} style={s.optCard} onPress={o.fn}>
              <View style={s.iconWrap}>
                <Ionicons name={o.icon as any} size={17} color={COLORS.A3} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.optTitle}>{o.title}</Text>
                <Text style={s.optBody}>{o.body}</Text>
              </View>
              <Ionicons name="chevron-forward" size={14} color={COLORS.TM} />
            </TouchableOpacity>
          ))}
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  sheetBox: {
    backgroundColor: "#3f424d",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 22,
    gap: 12,
    zIndex: 10,
    elevation: 10,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(233,233,237,0.2)",
    alignSelf: "center",
    marginBottom: 6,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 2,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.TX,
  },
  optCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#232532",
    borderRadius: 14,
    padding: 13,
    borderWidth: 1,
    borderColor: "rgba(233,233,237,0.1)",
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(145,132,217,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  optTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.TX,
  },
  optBody: {
    fontSize: 10,
    color: COLORS.TM,
    marginTop: 1,
  },
});
