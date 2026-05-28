# Falls Risk Calculator Research Summary

This prototype is designed to be better than simple imported screening scales by following four rules:

1. Do not reuse one threshold across different care settings.
2. Do not reduce fall risk to a single nursing checklist.
3. Do not hide uncertainty when key measurements are missing.
4. Do return modifiable drivers and prevention actions.

## Why older tools are not enough

- The 2016 study the user linked compared Ontario Modified STRATIFY, Northern Hospital Modified STRATIFY, and STRATIFY in acute geriatric inpatients and concluded that the tools had limited accuracy. STRATIFY performed best, but overall accuracy was only about 63%.
- A 2025 systematic review of fall prediction models in hospitalized older adults found AUCs from 0.630 to 0.851, but concluded that all identified models had important methodological limitations and that none could be recommended for clinical use yet.
- NICE's 2024 falls guideline rationale explicitly supports using risk tools only alongside a comprehensive falls assessment because falls are multifactorial.

## Current evidence used in the design

### Major risk factors repeatedly supported in the literature

- Prior falls
- Recurrent falls
- Balance or gait disorder
- Fear of falling
- Dementia or cognitive impairment
- Vision impairment
- Depression / frailty / deconditioning
- Orthostasis, dizziness, syncope, or cardiovascular contributors
- Fall-risk-increasing drugs and polypharmacy
- Environmental hazards

Examples from recent syntheses:

- A 2023 meta-analysis in community-dwelling older adults reported strong associations for history of falls, balance disorders, fear of falling, and dementia.
- A 2024 cardiovascular systematic review found important associations for stroke, peripheral arterial disease, atrial fibrillation, and orthostatic hypotension.
- A 2024 USPSTF evidence review found that multifactorial interventions reduce fall rate, supporting action-oriented output instead of score-only output.

## Dataset map for a real trainable version

The prototype in this folder is heuristic and transparent. A production model should be trained and calibrated on multiple cohorts and kept setting-specific.

### Population and survey datasets

- CDC BRFSS older adult falls data
  - Large state-level surveillance.
  - Useful for prevalence priors and public-health benchmarking.
- CDC WONDER mortality / NVSS
  - Useful for fatal-fall trend calibration.
- NHATS
  - Nationally representative U.S. cohort of Medicare beneficiaries age 65+ with fall history and functional data.
- HRS
  - Public longitudinal U.S. aging survey with falls, chronic disease, function, and socioeconomic variables.
- ELSA
  - English aging cohort useful for external validation.
- TILDA
  - Irish aging cohort with detailed frailty, falls, and physical measures.
- UK Biobank
  - Very large cohort for feature discovery, subgroup analysis, and genetics-enabled research.

### Clinical EHR and inpatient datasets

- MIMIC-IV
  - Rich inpatient EHR data for hospital-setting model development, including transfers, medications, labs, vitals, and orders.

### Sensor and biomechanics datasets

- PhysioNet Long Term Movement Monitoring Database
  - 3-day accelerometer recordings from 71 older community residents.
- PhysioNet one-legged stand multimodal dataset
  - Motion capture, force plate, and radar data from 32 participants.
- PhysioNet KINECAL
  - Balance and posturography dataset.
- PhysioNet balance / force-plate datasets
  - Useful for testing digital biomarkers and functional signal features.

## Better calculator architecture

### 1. Setting-specific entry point

- Community / primary care
- Hospital inpatient
- Long-term care / residential care

Each setting needs separate baseline risk, outcome horizon, and calibration.

### 2. Layered model structure

- Layer A: sentinel events
  - prior falls, recurrent falls, injurious fall, syncope, acute confusion
- Layer B: function
  - TUG, chair stands, static balance, gait/balance concerns, mobility aid use
- Layer C: medical drivers
  - cognition, neurologic disease, orthostasis, incontinence, vision, frailty
- Layer D: medication burden
  - sedatives, psychotropics, antihypertensives, polypharmacy, FRIDs
- Layer E: environment and context
  - lighting, clutter, footwear, night-time toileting, supervision gaps

### 3. Multiple outputs, not one score

- Risk band
- Top contributing drivers
- Data-completeness score
- Suggested intervention bundle
- Harm amplification flag if fracture vulnerability is high

### 4. Model governance for a real deployment

- Keep separate models for community, inpatient, and long-term care
- Report calibration, not just discrimination
- Require external validation
- Audit subgroup performance by age, sex, cognition, and mobility aid use
- Recalibrate locally before operational use

## Source links

- PubMed 26991034: https://pubmed.ncbi.nlm.nih.gov/26991034/
- 2025 BMC Geriatrics review: https://link.springer.com/article/10.1186/s12877-025-05688-0
- NICE guideline NG249: https://www.nice.org.uk/guidance/ng249
- NICE recommendations: https://www.nice.org.uk/guidance/ng249/chapter/Recommendations/
- NICE rationale and impact: https://www.nice.org.uk/guidance/ng249/chapter/Rationale-and-impact
- CDC STEADI clinical resources: https://www.cdc.gov/steadi/hcp/clinical-resources/index.html
- CDC STEADI algorithm PDF: https://www.cdc.gov/steadi/media/pdfs/STEADI-Algorithm-508.pdf
- CDC older adult falls data: https://www.cdc.gov/falls/data-research/index.html
- CDC STEADI validation paper entry: https://stacks.cdc.gov/view/cdc/50545
- Frontiers 2023 community risk factor meta-analysis: https://www.frontiersin.org/articles/10.3389/fmed.2022.1019094/full
- Gerontology cardiovascular disorders and falls review: https://academic.oup.com/biomedgerontology/article/79/2/glad221/7279335
- USPSTF/JAMA evidence review: https://pubmed.ncbi.nlm.nih.gov/38833257/
- NHATS: https://www.nhats.org/nhats
- HRS public survey data: https://hrsdata.isr.umich.edu/data-products/public-survey-data
- ELSA: https://natcen.ac.uk/elsa
- TILDA: https://tilda.tcd.ie/
- UK Biobank falls publication page: https://www.ukbiobank.ac.uk/publications/the-genetics-of-falling-susceptibility-and-identification-of-causal-risk-factors/
- MIMIC-IV docs: https://mimic.mit.edu/docs/IV/
- PhysioNet falls-risk index: https://physionet.org/content/?topic=falls-risk
