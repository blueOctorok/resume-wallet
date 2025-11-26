# Profile Completeness System - Integration Guide

## 🎯 Overview

The Profile Completeness System automatically syncs your DOT application data to create a rich driver profile, calculates a completion score (0-100%), and uses AvA to guide drivers through completing their profiles.

## 📊 What Was Built

### 1. **Profile Score Calculator**
- Calculates score based on available data
- Returns missing fields sorted by importance
- Checks eligibility to apply for jobs

### 2. **DOT → Profile Auto-Sync**
- Extracts CDL info, experience, miles from completed DOT apps
- Auto-populates driver_profiles table
- Calculates and updates completion score

### 3. **Visual Components**
- `ProfileCompleteness` component shows progress
- Integrated into Apply modal
- Theme-aware, responsive design

### 4. **AvA AI Guidance**
- Monitors profile score
- Provides contextual suggestions
- Celebrates milestones

## 🔧 How to Integrate

### Step 1: Call DOT Sync After Application Completion

When a driver completes their DOT application (Form 3, final step), call the sync API:

```typescript
// In your DOT application completion handler
const syncProfile = async () => {
  try {
    const response = await fetch('/api/driver/sync-from-dot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        walletAddress: user.address 
      })
    })
    
    if (response.ok) {
      const data = await response.json()
      console.log('Profile synced:', data.completeness)
      // data.completeness contains the score and missing fields
    }
  } catch (error) {
    console.error('Profile sync failed:', error)
  }
}

// Call it after DOT application is marked complete
await syncProfile()
```

### Step 2: Pass Profile Completeness to AvA (Optional)

If you want AvA to provide guidance, fetch the profile and pass it:

```typescript
// In page.tsx or wherever TAssistant is rendered
const [profileCompleteness, setProfileCompleteness] = useState(null)

// Fetch profile completeness
useEffect(() => {
  if (userAddress && userRole === 'driver') {
    fetchProfileCompleteness()
  }
}, [userAddress, userRole])

const fetchProfileCompleteness = async () => {
  const response = await fetch('/api/driver/profile', {
    method: 'POST',
    body: JSON.stringify({ walletAddress: userAddress })
  })
  
  if (response.ok) {
    const { profile } = await response.json()
    const completeness = calculateProfileScore(profile)
    setProfileCompleteness(completeness)
  }
}

// Pass to TAssistant
<TAssistant
  {...otherProps}
  profileCompleteness={profileCompleteness}
/>
```

### Step 3: Test the Flow

1. **Complete DOT Application** → All 3 forms submitted
2. **Check Database** → `driver_profiles` should be populated
3. **Open Apply Modal** → Profile completeness shows
4. **Check AvA** → Should provide guidance based on score

## 🧪 Testing Scenarios

### Scenario 1: Fresh User (No Profile)
- Complete DOT application → Profile created automatically
- Score calculated based on DOT data
- AvA says: "Add resume for +10 points"

### Scenario 2: Incomplete Profile (<40%)
- Try to apply for job → Blocked
- Modal shows: "Profile Incomplete - Add CDL Class"
- Button disabled: "Complete Profile to Apply"

### Scenario 3: Basic Profile (40-69%)
- Can apply to jobs
- AvA says: "You can apply! Here are quick wins..."
- Modal shows progress and missing fields

### Scenario 4: Complete Profile (90%+)
- Apply button enabled
- AvA celebrates: "🎉 Profile complete!"
- Modal shows all green checkmarks

## 📁 Files to Review

### New Files:
- `src/lib/profile-completeness.ts` - Score calculator
- `src/app/api/driver/sync-from-dot/route.ts` - Sync API
- `src/components/ProfileCompleteness.tsx` - Visual component

### Modified Files:
- `src/components/ApplyWithVereeModal.tsx` - Shows completeness
- `src/components/TAssistant.tsx` - AvA guidance
- `src/app/api/driver/profile/route.ts` - Auto-creates profiles

## 💡 Key Features

### Automatic Data Flow:
```
Resume Upload → AI Extract → Form Prefill
     ↓
DOT Application (3 forms)
     ↓
Complete → /api/driver/sync-from-dot
     ↓
driver_profiles populated
     ↓
Score calculated (0-100%)
     ↓
AvA provides guidance
```

### Score Breakdown:
- **Core (50 pts)**: CDL class (15), state (10), number (10), endorsements (10), experience (5)
- **Resume (30 pts)**: Resume (10), DOT app (15), miles (5)
- **Preferences (20 pts)**: Job types (5), salary (5), states (5), relocate (2), start date (3)

### Eligibility Rules:
- **Can't apply** if missing: CDL class OR CDL state
- **Can apply** with score ≥ 40% and required fields

## 🎨 Visual Design

The ProfileCompleteness component uses:
- **Frosted glass** aesthetic (matches DOT forms)
- **Theme-aware** colors (light/dark mode)
- **Status-based** colors:
  - Red: Incomplete (<40%)
  - Orange: Basic (40-69%)
  - Blue: Good (70-89%)
  - Green: Excellent (90%+)

## 🚀 Next Steps

1. **Test Integration**: Complete a DOT app and verify sync
2. **Monitor AvA**: Check that guidance messages appear
3. **Try Applying**: Test with different profile completion levels
4. **Future**: Build dedicated profile management page

## ❓ FAQs

**Q: When should I call `/api/driver/sync-from-dot`?**
A: After the driver completes all 3 DOT forms and `is_complete = true`.

**Q: What if the driver hasn't uploaded a resume?**
A: Profile still syncs! Resume just won't be linked. Score will reflect missing resume.

**Q: Can I manually update profile fields?**
A: Yes! Update `driver_profiles` directly. Score auto-recalculates on next fetch.

**Q: Does AvA spam messages?**
A: No. It uses a ref to track the last score and only sends messages on score changes.

**Q: What if DOT app is incomplete?**
A: Sync will still work, but extracted data will be partial. Better to wait until `is_complete = true`.

---

Built with ❤️ to make driver applications better!

