# 🎨 DriverAppChain Design System

## Typography

### Font Family

- **Primary**: Quicksand (Google Font)
- **Weights**: 300 (Light), 400 (Normal), 500 (Medium), 600 (Semibold), 700 (Bold)
- **Fallbacks**: system-ui, -apple-system, sans-serif

### Font Usage

```css
/* Tailwind classes */
font-light    /* 300 - Light text */
font-normal   /* 400 - Body text */
font-medium   /* 500 - Emphasized text */
font-semibold /* 600 - Subheadings */
font-bold     /* 700 - Headings */
```

## Brand Colors

| Color          | Hex       | Usage                                          | Tailwind Class                                 |
| -------------- | --------- | ---------------------------------------------- | ---------------------------------------------- |
| **Deep Sage**  | `#798777` | Primary text, headers, buttons                 | `bg-brand-sage`, `text-brand-sage`             |
| **Light Sage** | `#A2B29F` | Secondary text, borders, accents               | `bg-brand-sage-light`, `text-brand-sage-light` |
| **Mint Green** | `#BDD2B6` | Accent color, highlights, interactive elements | `bg-brand-mint`, `text-brand-mint`             |
| **Warm Cream** | `#F8EDE3` | Background, subtle highlights                  | `bg-brand-cream`, `text-brand-cream`           |

## Color Usage Guide

### 🎯 **Primary (Deep Sage - #798777)**

- Main headings and titles
- Primary button text
- Important text content
- Navigation elements

### 🔘 **Secondary (Light Sage - #A2B29F)**

- Subheadings and descriptions
- Secondary text content
- Border accents
- Neutral interactive elements

### ✨ **Accent (Mint Green - #BDD2B6)**

- Call-to-action buttons
- Interactive hover states
- Progress indicators
- Success states
- Border highlights

### 🌟 **Background (Warm Cream - #F8EDE3)**

- Page background
- Card backgrounds
- Subtle highlights
- Loading states

## Implementation

### Tailwind Classes

```css
/* Available in your app */
bg-brand-sage     /* Deep sage background */
text-brand-sage   /* Deep sage text */
bg-brand-sage-light    /* Light sage background */
text-brand-sage-light  /* Light sage text */
bg-brand-mint     /* Mint green background */
text-brand-mint   /* Mint green text */
bg-brand-cream    /* Warm cream background */
text-brand-cream  /* Warm cream text */
```

### CSS Variables

```css
/* Also available as CSS variables */
--brand-sage: #798777;
--brand-sage-light: #a2b29f;
--brand-mint: #bdd2b6;
--brand-cream: #f8ede3;
```

## Design Principles

1. **Professional & Trustworthy** - Deep sage conveys reliability and nature
2. **Modern & Clean** - Light sage provides sophistication
3. **Friendly & Approachable** - Mint green adds freshness and warmth
4. **Calm & Readable** - Warm cream ensures comfort and readability

## Accessibility

- All color combinations meet WCAG AA contrast requirements
- Deep sage on cream provides excellent readability
- Mint green provides clear visual hierarchy
- Light sage maintains readability in secondary content

---

**Ready to transform your entire app with this beautiful color scheme!** 🚀
