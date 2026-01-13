# 🧠 Ava Brain - Quick Reference Diagram

## The Big Picture

```
                    ┌─────────────────────┐
                    │   USER ACTION       │
                    │  (Any interaction)   │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │   AVA BRAIN         │
                    │   (Smart Router)     │
                    └──────────┬──────────┘
                               │
                ┌──────────────┴──────────────┐
                │                             │
                ▼                             ▼
    ┌───────────────────┐        ┌───────────────────┐
    │   TEMPLATE?       │        │   NEEDS AI?       │
    │   (80% cases)     │        │   (20% cases)     │
    └───────────┬───────┘        └───────────┬───────┘
                │                            │
                │ YES                        │ YES
                ▼                            ▼
    ┌───────────────────┐        ┌───────────────────┐
    │  Instant Response │        │  AI API Call      │
    │  • 0ms            │        │  • 1-3 seconds    │
    │  • Free           │        │  • Costs credits  │
    │  • Consistent      │        │  • Personalized   │
    └───────────────────┘        └───────────────────┘
                │                            │
                └────────────┬───────────────┘
                             │
                             ▼
                    ┌─────────────────────┐
                    │   USER SEES AVA     │
                    │   (Same experience) │
                    └─────────────────────┘
```

## Decision Tree

```
User Action
    │
    ├─> Navigation? ──────────────> Template: "Welcome to Form 2..."
    │
    ├─> Form Saved? ──────────────> Template: "✅ Saved!"
    │
    ├─> Milestone? ────────────────> Template: "🎉 Form 1 Complete!"
    │
    ├─> Error? ────────────────────> Template: "⚠️ Try again?"
    │
    ├─> Question with "?"? ────────> AI: "What is FMCSR?" → AI Response
    │
    ├─> "what/why/how"? ───────────> AI: Complex question → AI Response
    │
    ├─> "FMCSR/regulation"? ───────> AI: Regulation question → AI Response
    │
    └─> Simple "hi/thanks"? ───────> Silent (no response needed)
```

## Cost Comparison

```
┌─────────────────────────────────────────────────────────────┐
│                    BEFORE: Always AI                        │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ Every action → AI API → Response                      │ │
│  │ • 100% AI calls                                       │ │
│  │ • 1-3 second delay                                    │ │
│  │ • $$$$ Expensive                                      │ │
│  └───────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    AFTER: Smart Routing                     │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ Action → Check Template → AI Only If Needed          │ │
│  │ • 80% Templates (free, instant)                      │ │
│  │ • 20% AI (when needed)                               │ │
│  │ • 80% cost savings                                   │ │
│  │ • Instant UX for most cases                          │ │
│  └───────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## What Gets Templates vs AI

```
TEMPLATES (80%) - Instant, Free
├── Navigation hints
├── Form confirmations
├── Milestone celebrations
├── Error messages
├── Inactivity prompts
└── Simple acknowledgments

AI (20%) - Smart, Contextual
├── Questions with "?"
├── "what/why/how" questions
├── DOT/FMCSA regulations
├── Career advice
└── Complex explanations
```

## Real Example

```
User: "hi"
  → Brain checks → No template, no AI pattern
  → Silent (no response)

User: Navigates to Form 2
  → Brain checks → Template match: "nav:form2"
  → Instant: "Welcome to Form 2: Driving Experience..."

User: "what is FMCSR?"
  → Brain checks → AI pattern match (regulation keyword)
  → AI call: "FMCSR stands for Federal Motor Carrier..."

User: Completes Form 1
  → Brain checks → Milestone: "form1_complete"
  → Instant: "🎉 Form 1 Complete! You're 1/3 of the way..."

User: Idle 30s on Form 2
  → Brain checks → Inactivity detected
  → Instant: "Need help with this field?"
```

## The Magic

```
User Experience:  Ava feels "omniscient" ✨
                  Always aware, always helpful

Reality:          Smart routing system 🧠
                  80% templates, 20% AI

Result:           Best of both worlds 🎯
                  Great UX + Low Cost
```
