# PillCare - UI Specification & Accessibility Guidelines

## 1. Accessibility First Design Principles (Senior-Friendly Standards)
1. **Minimum Touch Targets**: All interactive buttons, cards, and checkboxes must strictly satisfy $\ge 48\text{dp} \times 48\text{dp}$ touch area.
2. **High-Contrast Text**: Text elements meet WCAG AAA contrast ratio ($\ge 7:1$) against background surfaces.
3. **Typography Scale**: Default body text $\ge 16\text{sp}$; headline text $\ge 24\text{sp}$.
4. **Haptic & Audio Feedback**: Tactile haptic pulse (`expo-haptics`) paired with custom sound effects (`expo-notifications`) for dose confirmation.

---

## 2. Color System Tokens

```css
:root {
  /* Brand Core Colors */
  --color-primary-dark-teal: #002B2B;  /* Deep Emerald Background */
  --color-primary-emerald:   #0A5C36;  /* Primary Brand Buttons */
  --color-accent-lavender:   #9184D9;  /* Wellness Accent */
  --color-warning-amber:     #D97706;  /* Low Stock Alerts */
  --color-danger-crimson:    #DC2626;  /* Missed Dose / Critical */
  
  /* Surface Tokens (Dark Glassmorphism) */
  --color-surface-card:      rgba(10, 40, 40, 0.75);
  --color-surface-border:    rgba(255, 255, 255, 0.12);
  --color-text-primary:      #FFFFFF;
  --color-text-secondary:    #9CA3AF;
}
```

---

## 3. Responsive Breakpoints & Device Layout Rules
- **Mobile Handsets (<600dp width)**: Single-column vertical flow with sticky bottom action tabs.
- **Tablets (>=600dp width)**: Master-detail split view (Medication list on left, detailed scheduling/log history on right).
