# CV Risk Lipid Helper

Static browser app for pasted lipid panels plus Framingham Risk Score input.

Guideline source:
- CCS Dyslipidemia Pocket Guide (2022 PDF carrying 2021 recommendations): https://ccs.ca/wp-content/uploads/2022/07/2022-Lipids-Gui-PG-EN.pdf

What it does:
- Parses pasted lab text for `CHOL`, `TG`, `HDL`, `LDL`, `NON-HDL`, and `CHOL/HDL`
- Accepts FRS and optional ApoB/Lp(a)
- Applies a narrow, explicit CCS-aligned ruleset for statin initiation and common add-on thresholds
- Shows the parsed lipid values, risk category, statin answer, secondary-test suggestions, and rationale

Scope limits:
- This is decision support, not a medical device
- It does not calculate FRS from raw demographics or vitals; you enter FRS directly
- It does not cover every clinical nuance in the pocket guide
- Follow-up testing suggestions are limited to the CCS items encoded in the app: Lp(a), ApoB, FPG/A1c, eGFR, ACR, fasting repeat lipids, CAC, and periodic reassessment

Run:
- Open [/Users/aaharris/Desktop/CODEX/CV risk/index.html](/Users/aaharris/Desktop/CODEX/CV risk/index.html) in a browser
