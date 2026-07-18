# 3DEES Dynamic Requirements — Field Catalog (Draft for Review)

This is the proposed canonical field catalog. Every field has a **stable key**
(used in job configs, stored answers, and the EGI payload — never renamed once
live), a label, an input type, and validation. Review the classifications and
the flagged items, then we lock it and it becomes `src/config/fieldCatalog.js`
in the 3DEES backend.

**Input type legend:**
- `text` / `textarea` — free text (single line / multi line)
- `email`, `tel`, `date`, `number`, `year` — typed inputs with format validation
- `select` — dropdown, options listed
- `yesno` — Yes / No radio pair
- `declaration` — a checkbox that, when the field is *required*, MUST be ticked
  to submit (an unticked required declaration blocks submission — different
  from yesno, where "No" is a valid answer)
- `file` — upload, PDF/JPG/PNG, 5MB max (same rules as today)

---

## ⚠ Items flagged for your decision (see questions in chat)

| # | Issue | Recommendation |
|---|---|---|
| A | **Full Name** duplicates First + Middle + Last | Drop Full Name as an input; auto-derive it (`first + middle + last`) for display and the EGI payload |
| B | **Age** duplicates Date of Birth | Drop Age as an input; auto-compute from DOB and display it read-only on the form and to admins (a typed age can contradict the DOB; a computed one can't) |
| C | **Professional Registration Number** appears in both §6 and §9 | Keep ONE canonical field (in §6); the §9 duplicate is removed |
| D | **Position Applying For** and **Employment Type** (§2) | The applicant is already applying to a specific job — these are auto-filled from the job posting, shown read-only, not asked as questions |
| E | **Experience fields** (§9) | Proposed as `yesno`; confirm whether any need years/detail instead |

---

## 1. PERSONAL INFORMATION — section key `personal`

| Key | Label | Type | Options / validation | Notes |
|---|---|---|---|---|
| `firstName` | First Name | text | 1–100 chars | |
| `middleName` | Middle Name | text | 1–100 chars | |
| `lastName` | Last Name | text | 1–100 chars | |
| — | Full Name | *derived* | `firstName + middleName + lastName` | Flag A — not an input |
| `email` | Email Address | email | valid email format | |
| `phone` | Phone Number | tel | digits, +, spaces; 7–20 chars | |
| `altPhone` | Alternative Phone Number | tel | same | |
| `dateOfBirth` | Date of Birth | date | must be in the past; implies age ≥ 16 | |
| — | Age | *derived* | computed from `dateOfBirth`, shown read-only | Flag B — not an input |
| `gender` | Gender | select | Male, Female | |
| `maritalStatus` | Marital Status | select | Single, Married, Divorced, Widowed | |
| `nationality` | Nationality | select | Nigerian (default) + full country list | |
| `stateOfOrigin` | State of Origin | select | 36 Nigerian states + FCT | |
| `lga` | Local Government Area (LGA) | select | dependent dropdown — options filtered by chosen State of Origin (standard states→LGAs dataset bundled as static data) | falls back to text if state not selected |
| `residentialAddress` | Residential Address | textarea | 1–500 chars | |
| `currentAddress` | Current Address | textarea | 1–500 chars | for when different from residential |
| `city` | City | text | 1–100 chars | |
| `postalCode` | Postal Code | text | 3–10 chars | |
| `preferredWorkLocation` | Preferred Work Location | text | 1–150 chars | |

## 2. JOB INFORMATION — section key `jobInfo`

| Key | Label | Type | Options / validation | Notes |
|---|---|---|---|---|
| — | Position Applying For | *auto* | filled from the job posting, read-only | Flag D |
| — | Employment Type | *auto* | from the job posting, read-only | Flag D |
| `preferredJobLocation` | Preferred Job Location | text | 1–150 chars | kept separate from §1's work location in case admins want only one of them per job |
| `availableStartDate` | Available Start Date | date | today or later | |
| `willingToRelocate` | Willing to Relocate | yesno | | |
| `willingToWorkShifts` | Willing to Work Shift Patterns | yesno | | |
| `willingToTravel` | Willing to Travel | yesno | | |

## 3. EMPLOYMENT INFORMATION — section key `employment`

| Key | Label | Type | Options / validation | Notes |
|---|---|---|---|---|
| `currentEmployer` | Current Employer | text | 1–150 chars | |
| `currentJobTitle` | Current Job Title | text | 1–150 chars | |
| `employmentStatus` | Employment Status | select | Employed, Self-employed, Unemployed, Student | |
| `previousEmployers` | Previous Employer(s) | textarea | up to 1000 chars | |
| `employmentHistory` | Employment History | textarea | up to 3000 chars — roles, dates, duties | |
| `yearsOfExperience` | Years of Experience | number | 0–60 | |
| `relevantSkills` | Relevant Skills | textarea | up to 1000 chars | |
| `professionalSummary` | Professional Summary | textarea | up to 2000 chars | |
| `noticePeriod` | Notice Period | select | Immediate, 1 week, 2 weeks, 1 month, More than 1 month | |
| `expectedSalary` | Expected Salary (₦/month) | number | ≥ 0 | |

## 4. EDUCATION — section key `education`

| Key | Label | Type | Options / validation | Notes |
|---|---|---|---|---|
| `highestQualification` | Highest Qualification | select | None, Primary, SSCE/WAEC/NECO, Trade Certificate, OND, NCE, HND, B.Sc/B.A/B.Eng, M.Sc/M.A/MBA, Ph.D | |
| `institutionName` | Institution Name | text | 1–200 chars | |
| `courseOfStudy` | Course of Study | text | 1–150 chars | |
| `graduationYear` | Graduation Year | year | 1960–current year | |
| `gradeClass` | Grade / Class of Degree | select | First Class, Second Class Upper, Second Class Lower, Third Class, Pass, Distinction, Upper Credit, Lower Credit, Other | covers university + polytechnic scales |
| `nyscStatus` | NYSC Status | select | Completed, Currently Serving, Exempted, Not Applicable | |

## 5. DOCUMENT UPLOADS — section key `documents` (all type `file`)

| Key | Label |
|---|---|
| `cvUpload` | CV / Resume |
| `coverLetterUpload` | Cover Letter |
| `passportPhotoUpload` | Passport Photograph |
| `nationalIdUpload` | National ID |
| `intlPassportUpload` | International Passport |
| `driversLicenceUpload` | Driver's Licence |
| `birthCertificateUpload` | Birth Certificate |
| `academicCertUpload` | Academic Certificate |
| `professionalCertUpload` | Professional Certificate |
| `nyscCertUpload` | NYSC Certificate |
| `tradeCertUpload` | Trade Certificate |
| `professionalLicenceUpload` | Professional Licence |
| `referenceLetterUpload` | Reference Letter |
| `medicalCertUpload` | Medical Certificate |
| `otherDocsUpload` | Other Supporting Documents — allows **multiple** files (up to 5) |

File rules (all): PDF, JPG, PNG; 5MB per file. Passport photo: JPG/PNG only.

## 6. PROFESSIONAL INFORMATION — section key `professional`

| Key | Label | Type | Options / validation |
|---|---|---|---|
| `professionalMembership` | Professional Membership | text | 1–200 chars |
| `professionalRegNumber` | Professional Registration Number | text | 1–100 chars — canonical (Flag C) |
| `languagesSpoken` | Languages Spoken | text | 1–200 chars, comma-separated |
| `computerSkills` | Computer Skills | textarea | up to 500 chars |
| `technicalSkills` | Technical Skills | textarea | up to 500 chars |

## 7. REFEREES — section key `referees`

| Key | Label | Type |
|---|---|---|
| `referee1Name` | Referee 1 — Name | text |
| `referee1Occupation` | Referee 1 — Occupation | text |
| `referee1Organisation` | Referee 1 — Organisation | text |
| `referee1Phone` | Referee 1 — Phone Number | tel |
| `referee1Email` | Referee 1 — Email Address | email |
| `referee1Relationship` | Referee 1 — Relationship to You | text |
| `referee2Name` | Referee 2 — Name | text |
| `referee2Occupation` | Referee 2 — Occupation | text |
| `referee2Organisation` | Referee 2 — Organisation | text |
| `referee2Phone` | Referee 2 — Phone Number | tel |
| `referee2Email` | Referee 2 — Email Address | email |
| `referee2Relationship` | Referee 2 — Relationship to You | text |

Admins enable Referee 1 fields, Referee 2 fields, or both, per job.

## 8. ELIGIBILITY & DECLARATIONS — section key `declarations`

| Key | Label | Type | Notes |
|---|---|---|---|
| `rightToWork` | Right to Work in Nigeria | yesno | "No" is a valid (recorded) answer |
| `physicallyFit` | Physically Fit for the Role | yesno | |
| `medicalFitnessDecl` | Medical Fitness Declaration | declaration | must be ticked if required |
| `criminalRecordDecl` | Do you have any criminal record? | yesno | phrased as a question; "Yes" is recordable, not blocking |
| `consentBackgroundCheck` | Consent to Background Check | declaration | |
| `consentReferenceCheck` | Consent to Reference Check | declaration | |
| `agreeTerms` | Agree to Terms & Conditions | declaration | |
| `agreePrivacy` | Agree to Privacy Policy | declaration | |
| `declarationAccurate` | I declare the information provided is accurate | declaration | |

## 9. ROLE-SPECIFIC FIELDS — section key `roleSpecific`

| Key | Label | Type | Options / validation |
|---|---|---|---|
| `validDriversLicence` | Valid Driver's Licence | yesno | |
| `driversLicenceClass` | Driver's Licence Class | select | A, B, C, D, E, F, G, H, J (Nigerian classes) |
| `securityExperience` | Security Experience | yesno | Flag E |
| `militaryExperience` | Military Experience | yesno | |
| `policeExperience` | Police Experience | yesno | |
| `cctvExperience` | CCTV Experience | yesno | |
| `farmingExperience` | Farming Experience | yesno | |
| `cookingExperience` | Cooking Experience | yesno | |
| `generatorMaintenanceExperience` | Generator Maintenance Experience | yesno | |
| `plumbingExperience` | Plumbing Experience | yesno | |
| `electricalExperience` | Electrical Experience | yesno | |
| `droneOperationExperience` | Drone Operation Experience | yesno | |
| `warehouseExperience` | Warehouse / Storekeeping Experience | yesno | |
| `hospitalityExperience` | Hospitality Experience | yesno | |
| `cleaningExperience` | Cleaning Experience | yesno | |
| `leadershipExperience` | Leadership / Supervisory Experience | yesno | |
| `localCommunity` | Local Community / Village | text | 1–150 chars |
| `knowsLocalForestArea` | Knowledge of Local Forest Area | yesno | |
| `tradeSpecialisation` | Trade Specialisation | text | 1–150 chars |
| `securityLicenceNumber` | Security Licence Number | text | 1–100 chars |

---

## Admin-side VERIFICATION DOCUMENTS (not on the public form)

Uploaded by 3DEES admins through the candidate drawer after physical checks,
before approval. Stored separately from applicant uploads, clearly labelled
"Uploaded by 3DEES", and included in the EGI push under
`verificationDocuments`.

Proposed as a flexible list — the admin picks a type from a suggested set and
can always use "Other" with a custom label:

- Police / Criminal Record Check Report
- Medical Test Report
- Drug Test Report
- Reference Check Report
- Guarantor Form
- Address Verification Report
- Other (custom label)

*(Confirm or amend this list — see question 3 in chat.)*

---

## How a job's requirements config looks (for reference)

```json
{
  "firstName": "required",
  "lastName": "required",
  "email": "required",
  "phone": "required",
  "dateOfBirth": "required",
  "stateOfOrigin": "optional",
  "cvUpload": "required",
  "driversLicenceUpload": "required",
  "validDriversLicence": "required",
  "driversLicenceClass": "required",
  "consentBackgroundCheck": "required",
  "agreeTerms": "required",
  "declarationAccurate": "required"
}
```

Any field absent from the config simply does not appear on that job's
application form. The public form renders enabled sections as wizard steps,
in catalog order, with required fields marked and validated both client-side
and server-side against this same catalog.
