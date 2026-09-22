# PillCare - Stitch Design System Guidelines

## 1. System Overview
The **PillCare Stitch Design System** combines modern dark glassmorphism, fluid micro-interactions, and medical clarity to evoke trust, calm, and precision.

---

## 2. Component Specifications

### 2.1 Medication Card Component (`MedicationCard.tsx`)
- **Background**: Glassmorphic blur (`expo-blur` intensity 40) with `#0A2828` tinted container.
- **Border**: `1px solid rgba(255, 255, 255, 0.12)` with `16px` border-radius.
- **Elevation**: Subtle drop shadow (`shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 8`).

### 2.2 Primary CTA Button
- **Height**: `52px` minimum.
- **Background**: Linear Gradient (`#0A5C36` $\rightarrow$ `#004D25`).
- **Typography**: Semibold 16sp white uppercase text with 1px letter spacing.
- **Active State**: Scale down animation (`transform: [{ scale: 0.96 }]`) paired with medium haptic pulse.

### 2.3 Flash Announcement Banner Component (`FlashAnnouncementBanner.tsx`)
- **Gradient Fill**: Swiggy/Zomato brand gradient (`#FF5200` $\rightarrow$ `#E23744` or Deep Purple/Gold for Pro upgrades).
- **Positioning**: Fixed top banner above Today screen adherence progress card.
- **Dismissability**: Includes dismiss cross icon with 24-hour cookie suppression.
