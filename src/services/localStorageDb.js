const USERS_KEY = '3dees_users';
const JOBS_KEY = '3dees_jobs';
const APPLICATIONS_KEY = '3dees_applications';
const AUDIT_LOG_KEY = '3dees_audit_log';

// Helper to generate IDs
const generateId = () => Math.random().toString(36).substring(2, 11);

// Configuration for EGI Portal
const EGI_PORTAL_ENDPOINT = import.meta.env.VITE_EGI_PORTAL_ENDPOINT || 'https://egi-portal.3dees.net/api/candidates';

export async function sendToEGIPortal(applicant, jobTitle) {
  const payload = {
    integrationEndpoint: EGI_PORTAL_ENDPOINT,
    referenceId: applicant.referenceId,
    fullName: applicant.personalInfo.fullName,
    email: applicant.personalInfo.email,
    phone: applicant.personalInfo.phone,
    jobTitle: jobTitle,
    applicationDate: applicant.submittedAt,
    status: applicant.status,
    documentsMetadata: Object.entries(applicant.documents).reduce((acc, [key, doc]) => {
      if (doc) {
        acc[key] = { name: doc.name, size: doc.size, type: doc.type };
      }
      return acc;
    }, {}),
  };

  console.log('Sending sync payload to EGI Portal:', payload);
  await new Promise((resolve) => setTimeout(resolve, 800));
  return true;
}

// Initial Seeds
const DEFAULT_SUPERADMIN = {
  id: 'u-super',
  name: 'SuperAdmin Commander',
  email: 'superadmin@3dees.net',
  passwordHash: 'Admin@3dees',
  role: 'superadmin',
  status: 'Active',
  createdAt: new Date('2025-01-10T08:00:00Z').toISOString(),
  lastLogin: new Date('2026-06-03T11:20:00Z').toISOString()
};

const DEFAULT_ADMIN = {
  id: 'u-admin1',
  name: 'Ahmed Bello',
  email: 'admin@3dees.net',
  passwordHash: 'Admin@3dees',
  role: 'admin',
  status: 'Active',
  createdAt: new Date('2025-02-15T09:00:00Z').toISOString(),
  lastLogin: new Date('2026-06-03T09:45:00Z').toISOString()
};

const SEED_JOBS = [
  {
    id: 'job-1',
    title: 'Agribusiness Operations Manager',
    clientOrg: 'Ogun Premium Agro Farms',
    category: 'Agriculture',
    type: 'Full-time',
    location: 'Ogun (Abeokuta North)',
    openings: 2,
    salaryRange: '₦350,000 - ₦450,000 / month',
    description: 'We are seeking an experienced Agribusiness Operations Manager to oversee mechanized crop farming, supply chain management, and field staff operations. The candidate will manage large-scale agricultural projects on behalf of our client partners.',
    responsibilities: 'Oversee daily farm production and logistics.\nManage farm labor and machinery schedules.\nImplement safety, quality controls, and compliance reporting.\nLiaise with local government and cooperative stakeholders.',
    requirements: 'B.Sc. in Agribusiness, Agricultural Science or related discipline.\nAt least 3 years active experience in commercial farm management.\nExceptional leadership and negotiation structures.\nKnowledge of modern automated farming equipment.',
    closingDate: '2026-07-15',
    status: 'Active',
    postedBy: 'Ahmed Bello',
    createdAt: new Date('2026-05-15T10:00:00Z').toISOString(),
    applicationRequirements: {
      cvRequired: true,
      coverLetterRequired: false,
      academicCertRequired: true,
      nyscCertRequired: true,
      passportPhotoRequired: true,
      nationalIdRequired: true,
      dobRequired: true,
      stateOfOriginRequired: true,
      lgaRequired: true,
      yearsOfExpRequired: true,
      currentEmployerRequired: false,
    }
  },
  {
    id: 'job-2',
    title: 'Site Civil Engineer',
    clientOrg: 'Lagos Infrastructure Builders',
    category: 'Construction',
    type: 'Contract',
    location: 'Lagos (FESTAC)',
    openings: 5,
    salaryRange: '₦500,000 - ₦650,000 / month',
    description: 'Responsible for supervisions of concrete foundations, high-rise architectural fittings, and civil engineering compliance. This is a contractual opportunity for a prestigious government-endorsed development scheme.',
    responsibilities: 'Monitor contractor works and sign off on site engineering specs.\nPrepare daily progress reports and materials audits.\nTroubleshoot structural mismatches with standard designs.\nEnsure physical project safety regulations.',
    requirements: 'B.Eng. in Civil Engineering.\nCOREN certificate is a strong plus.\nSolid structural drafting expertise via AutoCAD or related packages.\n4+ years on commercial or major public infrastructure sites.',
    closingDate: '2026-06-30',
    status: 'Active',
    postedBy: 'Ahmed Bello',
    createdAt: new Date('2026-05-20T11:30:00Z').toISOString(),
    applicationRequirements: {
      cvRequired: true,
      coverLetterRequired: true,
      academicCertRequired: true,
      nyscCertRequired: true,
      passportPhotoRequired: false,
      nationalIdRequired: true,
      dobRequired: false,
      stateOfOriginRequired: true,
      lgaRequired: true,
      yearsOfExpRequired: true,
      currentEmployerRequired: true,
    }
  },
  {
    id: 'job-3',
    title: 'Executive Administrative Officer',
    clientOrg: 'Apex Capital Partners',
    category: 'Administration',
    type: 'Full-time',
    location: 'Abuja (Garki II)',
    openings: 1,
    salaryRange: '₦200,000 - ₦250,000 / month',
    description: 'A professional executive secretary with stellar organizational talent is required to support executive board functions at a fast-growing financial consulting firm.',
    responsibilities: 'Manage executive travel, meetings, and calendar agendas.\nStructure corporate letters, minutes of meetings, and digital databases.\nSupervise front desk administrative personnel.\nCoordinate visitor protocols and high-net-worth client hospitality.',
    requirements: 'HND or B.Sc. in Business Administration or Secretarial studies.\nFluency in English with sharp verbal and written style.\nExcellent competency in Microsoft Office (Excel, Word, PowerPoint).\nAt least 2 years in administrative executive support.',
    closingDate: '2026-06-25',
    status: 'Active',
    postedBy: 'Ahmed Bello',
    createdAt: new Date('2026-05-22T08:15:00Z').toISOString(),
    applicationRequirements: {
      cvRequired: true,
      coverLetterRequired: true,
      academicCertRequired: false,
      nyscCertRequired: false,
      passportPhotoRequired: true,
      nationalIdRequired: true,
      dobRequired: true,
      stateOfOriginRequired: false,
      lgaRequired: false,
      yearsOfExpRequired: true,
      currentEmployerRequired: false,
    }
  },
  {
    id: 'job-4',
    title: 'Inventory & Logistics Coordinator',
    clientOrg: 'Efab Distribution Hub',
    category: 'Logistics',
    type: 'Temporary',
    location: 'Abuja (Wuse II)',
    openings: 3,
    salaryRange: '₦180,000 / month',
    description: 'Provide operations support for raw materials intake, cargo routing, and dispatch documentation. This role supports the high-season procurement program of our logistics client.',
    responsibilities: 'Log inventory inflow and outflow on enterprise systems.\nVerify dispatch invoices and product delivery confirmations.\nSupervise warehouse load teams for accurate shipping distribution.\nMaintain clean safety audits in the warehouse complex.',
    requirements: 'OND/HND in logistics, science or business studies.\nStrong calculations and detailed documentation skills.\nAbility to manage tight deadlines with multi-tasking operations.\nPrior warehouse experience of 1-2 years.',
    closingDate: '2026-06-20',
    status: 'Active',
    postedBy: 'Ahmed Bello',
    createdAt: new Date('2026-05-24T14:10:00Z').toISOString(),
    applicationRequirements: {
      cvRequired: true,
      coverLetterRequired: false,
      academicCertRequired: false,
      nyscCertRequired: false,
      passportPhotoRequired: false,
      nationalIdRequired: true,
      dobRequired: false,
      stateOfOriginRequired: false,
      lgaRequired: false,
      yearsOfExpRequired: false,
      currentEmployerRequired: false,
    }
  },
  {
    id: 'job-5',
    title: 'Senior Financial Auditor',
    clientOrg: 'Garki Trust Bank PLC',
    category: 'Finance',
    type: 'Full-time',
    location: 'Abuja (Central Business District)',
    openings: 1,
    salaryRange: '₦700,000 - ₦850,000 / month',
    description: 'We are seeking an audit professional to lead internal controls reviews, taxation reports, and corporate risk mitigation operations on behalf of Garki Trust.',
    responsibilities: 'Conduct periodic departmental risk assessments.\nReview ledger balances, asset portfolios and treasury compliance.\nDraft definitive audit reviews for the Audit Committee.\nEnforce corporate governance codes.',
    requirements: 'B.Sc. in Accounting or Finance.\nICAN or ACCA certification is MANDATORY.\n5+ years in internal banking audit or Tier-1 audit firm.\nSparsely compromised records of integrity and professionalism.',
    closingDate: '2026-07-10',
    status: 'Active',
    postedBy: 'Ahmed Bello',
    createdAt: new Date('2026-05-28T09:30:00Z').toISOString(),
    applicationRequirements: {
      cvRequired: true,
      coverLetterRequired: true,
      academicCertRequired: true,
      nyscCertRequired: true,
      passportPhotoRequired: true,
      nationalIdRequired: true,
      dobRequired: true,
      stateOfOriginRequired: true,
      lgaRequired: true,
      yearsOfExpRequired: true,
      currentEmployerRequired: true,
    }
  }
];

const SEED_APPLICATIONS = [
  // ── existing: already attended to ──────────────────────────────────────────
  {
    id: 'app-seed-1',
    jobId: 'job-3',
    referenceId: '3DEES-260529-873A',
    personalInfo: {
      fullName: 'Chidi Henry Nnaji',
      email: 'chidi.nnaji@gmail.com',
      phone: '+2348034567890',
      dob: '1998-04-12',
      gender: 'Male',
      stateOfOrigin: 'Enugu',
      lga: 'Udi',
      residentialAddress: 'Block F, Flat 12, Garki II Estate, Abuja FCT'
    },
    educationInfo: {
      highestQualification: 'B.Sc. Business Administration',
      institution: 'University of Nigeria, Nsukka',
      yearOfGraduation: '2021',
      yearsOfExperience: '3',
      currentEmployer: 'Decagon Logistics',
      workSummary: 'Provided front-line administrative and executive scheduling. Supported the Regional Logistics Chief with meetings and corporate database compliance.'
    },
    documents: {
      cv: { name: 'Chidi_Nnaji_Corporate_CV.pdf', size: '1.4 MB', url: '#mock-cv', type: 'application/pdf' },
      passportPhoto: { name: 'Chidi_Passport.jpg', size: '250 KB', url: '#mock-photo', type: 'image/jpeg' },
      coverLetter: { name: 'Chidi_Nnaji_Cover_Letter.pdf', size: '920 KB', url: '#mock-cl', type: 'application/pdf' }
    },
    status: 'Pending',
    statusHistory: [
      { status: 'Pending', changedBy: 'System Seed', timestamp: new Date('2026-05-29T10:45:00Z').toISOString() }
    ],
    notes: 'Strong candidate presentation during system trial.',
    egiSyncStatus: 'Pending',
    submittedAt: new Date('2026-05-29T10:45:00Z').toISOString()
  },
  {
    id: 'app-seed-2',
    jobId: 'job-3',
    referenceId: '3DEES-260530-911B',
    personalInfo: {
      fullName: 'Aisha Aminu',
      email: 'aisha.aminu99@gmail.com',
      phone: '+2349077654321',
      dob: '1999-09-22',
      gender: 'Female',
      stateOfOrigin: 'Kano',
      lga: 'Kano Municipal',
      residentialAddress: 'Suite 15, Silver Plaza, Area 11, Garki, Abuja'
    },
    educationInfo: {
      highestQualification: 'HND Secretarial Studies',
      institution: 'Kaduna Polytechnic',
      yearOfGraduation: '2022',
      yearsOfExperience: '2',
      currentEmployer: 'Bello & Associates Law Firm',
      workSummary: 'Managed frontdesk reception and organized filing systems, digital calendars and corporate visitor registries.'
    },
    documents: {
      cv: { name: 'Aisha_Aminu_Secretarial_CV.pdf', size: '1.2 MB', url: '#mock-cv', type: 'application/pdf' },
      passportPhoto: { name: 'Aisha_Aminu.png', size: '420 KB', url: '#mock-photo', type: 'image/png' },
      coverLetter: { name: 'Aisha_Aminu_CoverLetter.pdf', size: '850 KB', url: '#mock-cl', type: 'application/pdf' }
    },
    status: 'Shortlisted',
    statusHistory: [
      { status: 'Pending', changedBy: 'System Seed', timestamp: new Date('2026-05-30T11:15:00Z').toISOString() },
      { status: 'Shortlisted', changedBy: 'Ahmed Bello', timestamp: new Date('2026-06-01T15:20:00Z').toISOString() }
    ],
    notes: 'Candidate meets local secretarial expectations. High priority shortlist.',
    egiSyncStatus: 'Pending',
    submittedAt: new Date('2026-05-30T11:15:00Z').toISOString()
  },
  {
    id: 'app-seed-3',
    jobId: 'job-1',
    referenceId: '3DEES-260531-152C',
    personalInfo: {
      fullName: 'Tunde Joseph Ogunlade',
      email: 'tunde.joseph@outlook.com',
      phone: '+2348123456789',
      dob: '1994-01-30',
      gender: 'Male',
      stateOfOrigin: 'Osun',
      lga: 'Ilesa West',
      residentialAddress: 'Abeokuta Bypass Road, Shagamu, Ogun State'
    },
    educationInfo: {
      highestQualification: 'B.Sc. Crop Science',
      institution: 'Federal University of Agriculture, Abeokuta (FUNAAB)',
      yearOfGraduation: '2016',
      yearsOfExperience: '6',
      currentEmployer: 'Okomu Agricultural Holdings',
      workSummary: 'Oversaw a 20-person plantation crew dealing with cocoa extraction, mechanized farming setups, and supply line distribution.'
    },
    documents: {
      cv: { name: 'Tunde_Ogunlade_CV_Agro.pdf', size: '2.1 MB', url: '#mock-cv', type: 'application/pdf' },
      passportPhoto: { name: 'Ogunlade_Passport.jpg', size: '512 KB', url: '#mock-photo', type: 'image/jpeg' },
      academicCert: { name: 'FUNAAB_Graduate_Degree.pdf', size: '1.8 MB', url: '#mock-cert', type: 'application/pdf' },
      nyscCert: { name: 'NYSC_Ogun_Discharge.pdf', size: '1.1 MB', url: '#mock-nysc', type: 'application/pdf' },
      nationalId: { name: 'NIN_Slip.jpg', size: '480 KB', url: '#mock-nin', type: 'image/jpeg' }
    },
    status: 'Approved',
    statusHistory: [
      { status: 'Pending', changedBy: 'System Seed', timestamp: new Date('2026-05-31T09:00:00Z').toISOString() },
      { status: 'Shortlisted', changedBy: 'Ahmed Bello', timestamp: new Date('2026-06-01T10:00:00Z').toISOString() },
      { status: 'Approved', changedBy: 'Ahmed Bello', timestamp: new Date('2026-06-02T16:30:00Z').toISOString() }
    ],
    notes: 'Exceedingly excellent farm manager background. Synced to EGI Data Portal with 100% credentials verified.',
    egiSyncStatus: 'Synced',
    submittedAt: new Date('2026-05-31T09:00:00Z').toISOString()
  },

  // ── NEW pending applications ────────────────────────────────────────────────

  {
    id: 'app-seed-4',
    jobId: 'job-2',
    referenceId: '3DEES-260606-334D',
    personalInfo: {
      fullName: 'Emeka Chibuike Okafor',
      email: 'emeka.okafor@yahoo.com',
      phone: '+2348056781234',
      dob: '1992-07-18',
      gender: 'Male',
      stateOfOrigin: 'Anambra',
      lga: 'Onitsha North',
      residentialAddress: '14 Adekunle Crescent, Surulere, Lagos'
    },
    educationInfo: {
      highestQualification: 'B.Eng. Civil Engineering',
      institution: 'University of Lagos',
      yearOfGraduation: '2015',
      yearsOfExperience: '8',
      currentEmployer: 'Cappa & D\'Alberto PLC',
      workSummary: 'Led structural design and on-site supervision for three major Lagos state highway expansion projects. Managed a 35-person civil works team and coordinated with government inspectors on compliance sign-off procedures.'
    },
    documents: {
      cv: { name: 'Emeka_Okafor_Civil_CV.pdf', size: '1.9 MB', url: '#mock-cv', type: 'application/pdf' },
      coverLetter: { name: 'Emeka_Okafor_CoverLetter.pdf', size: '780 KB', url: '#mock-cl', type: 'application/pdf' },
      academicCert: { name: 'UNILAG_Civil_Engineering_Cert.pdf', size: '2.2 MB', url: '#mock-cert', type: 'application/pdf' },
      nyscCert: { name: 'NYSC_Lagos_Discharge_Okafor.pdf', size: '1.0 MB', url: '#mock-nysc', type: 'application/pdf' },
      nationalId: { name: 'Emeka_NIN_Slip.jpg', size: '390 KB', url: '#mock-nin', type: 'image/jpeg' }
    },
    status: 'Pending',
    statusHistory: [
      { status: 'Pending', changedBy: 'Self-Service Portal', timestamp: new Date('2026-06-06T08:22:00Z').toISOString() }
    ],
    notes: '',
    egiSyncStatus: 'Pending',
    submittedAt: new Date('2026-06-06T08:22:00Z').toISOString()
  },

  {
    id: 'app-seed-5',
    jobId: 'job-5',
    referenceId: '3DEES-260607-518E',
    personalInfo: {
      fullName: 'Ngozi Adaeze Eze',
      email: 'ngozi.eze@gmail.com',
      phone: '+2349012345678',
      dob: '1990-03-05',
      gender: 'Female',
      stateOfOrigin: 'Imo',
      lga: 'Owerri Municipal',
      residentialAddress: 'Plot 7, Cadastral Zone, Wuse 2, Abuja FCT'
    },
    educationInfo: {
      highestQualification: 'B.Sc. Accounting',
      institution: 'University of Nigeria, Enugu Campus',
      yearOfGraduation: '2013',
      yearsOfExperience: '10',
      currentEmployer: 'KPMG Nigeria',
      workSummary: 'Served as a Senior Audit Associate at KPMG for six years, leading financial statement audits for Tier-1 and Tier-2 Nigerian banks. ICAN-certified since 2016. Currently heading internal controls review for a mid-size asset management company.'
    },
    documents: {
      cv: { name: 'Ngozi_Eze_Audit_CV.pdf', size: '2.4 MB', url: '#mock-cv', type: 'application/pdf' },
      coverLetter: { name: 'Ngozi_Eze_CoverLetter.pdf', size: '910 KB', url: '#mock-cl', type: 'application/pdf' },
      academicCert: { name: 'UNN_Accounting_Degree.pdf', size: '1.7 MB', url: '#mock-cert', type: 'application/pdf' },
      nyscCert: { name: 'NYSC_Discharge_Eze.pdf', size: '1.1 MB', url: '#mock-nysc', type: 'application/pdf' },
      nationalId: { name: 'Ngozi_NIN_Slip.jpg', size: '430 KB', url: '#mock-nin', type: 'image/jpeg' },
      passportPhoto: { name: 'Ngozi_Passport_Photo.jpg', size: '310 KB', url: '#mock-photo', type: 'image/jpeg' }
    },
    status: 'Pending',
    statusHistory: [
      { status: 'Pending', changedBy: 'Self-Service Portal', timestamp: new Date('2026-06-07T14:05:00Z').toISOString() }
    ],
    notes: '',
    egiSyncStatus: 'Pending',
    submittedAt: new Date('2026-06-07T14:05:00Z').toISOString()
  },

  {
    id: 'app-seed-6',
    jobId: 'job-4',
    referenceId: '3DEES-260608-729F',
    personalInfo: {
      fullName: 'Fatima Bello Garba',
      email: 'fatima.garba@hotmail.com',
      phone: '+2348098765432',
      dob: '2000-11-14',
      gender: 'Female',
      stateOfOrigin: 'Kaduna',
      lga: 'Kaduna North',
      residentialAddress: '22B Ahmadu Bello Way, Wuse Zone 4, Abuja FCT'
    },
    educationInfo: {
      highestQualification: 'HND Purchasing & Supply',
      institution: 'Kaduna Polytechnic',
      yearOfGraduation: '2022',
      yearsOfExperience: '2',
      currentEmployer: 'Sahara Stores Limited',
      workSummary: 'Managed inbound stock records and coordinated with three dispatch riders for daily delivery runs at a fast-moving consumer goods distributor. Familiar with inventory software including Odoo and SAP Lite.'
    },
    documents: {
      cv: { name: 'Fatima_Garba_Logistics_CV.pdf', size: '1.1 MB', url: '#mock-cv', type: 'application/pdf' },
      nationalId: { name: 'Fatima_NIN_Card.jpg', size: '350 KB', url: '#mock-nin', type: 'image/jpeg' }
    },
    status: 'Pending',
    statusHistory: [
      { status: 'Pending', changedBy: 'Self-Service Portal', timestamp: new Date('2026-06-08T09:50:00Z').toISOString() }
    ],
    notes: '',
    egiSyncStatus: 'Pending',
    submittedAt: new Date('2026-06-08T09:50:00Z').toISOString()
  },

  {
    id: 'app-seed-7',
    jobId: 'job-1',
    referenceId: '3DEES-260609-841G',
    personalInfo: {
      fullName: 'Oluwaseun Adeyemi Rasheed',
      email: 'seun.rasheed@gmail.com',
      phone: '+2348071234567',
      dob: '1996-06-22',
      gender: 'Male',
      stateOfOrigin: 'Ogun',
      lga: 'Abeokuta South',
      residentialAddress: 'No. 5, Fajuyi Road, Idi-Aba, Abeokuta, Ogun State'
    },
    educationInfo: {
      highestQualification: 'B.Sc. Agricultural Economics',
      institution: 'Olabisi Onabanjo University',
      yearOfGraduation: '2019',
      yearsOfExperience: '4',
      currentEmployer: 'Amo Byng Nigeria Limited',
      workSummary: 'Supervised poultry and crop integration projects for a mid-scale agribusiness. Managed procurement schedules, farm input logistics, and weekly output reports to senior management. Led a team of 12 field operatives.'
    },
    documents: {
      cv: { name: 'Seun_Rasheed_Agro_CV.pdf', size: '1.6 MB', url: '#mock-cv', type: 'application/pdf' },
      academicCert: { name: 'OOU_AgroEcon_Degree.pdf', size: '1.5 MB', url: '#mock-cert', type: 'application/pdf' },
      nyscCert: { name: 'NYSC_Ogun_Discharge_Rasheed.pdf', size: '980 KB', url: '#mock-nysc', type: 'application/pdf' },
      nationalId: { name: 'Seun_NIN_Slip.jpg', size: '415 KB', url: '#mock-nin', type: 'image/jpeg' },
      passportPhoto: { name: 'Seun_Passport.jpg', size: '295 KB', url: '#mock-photo', type: 'image/jpeg' }
    },
    status: 'Pending',
    statusHistory: [
      { status: 'Pending', changedBy: 'Self-Service Portal', timestamp: new Date('2026-06-09T07:30:00Z').toISOString() }
    ],
    notes: '',
    egiSyncStatus: 'Pending',
    submittedAt: new Date('2026-06-09T07:30:00Z').toISOString()
  }
];

const SEED_AUDIT_LOGS = [
  {
    id: 'log-1',
    applicationId: 'app-seed-2',
    applicantName: 'Aisha Aminu',
    jobTitle: 'Executive Administrative Officer',
    prevStatus: 'Pending',
    newStatus: 'Shortlisted',
    changedBy: 'Ahmed Bello',
    timestamp: new Date('2026-06-01T15:20:00Z').toISOString()
  },
  {
    id: 'log-2',
    applicationId: 'app-seed-3',
    applicantName: 'Tunde Joseph Ogunlade',
    jobTitle: 'Agribusiness Operations Manager',
    prevStatus: 'Pending',
    newStatus: 'Shortlisted',
    changedBy: 'Ahmed Bello',
    timestamp: new Date('2026-06-01T10:00:00Z').toISOString()
  },
  {
    id: 'log-3',
    applicationId: 'app-seed-3',
    applicantName: 'Tunde Joseph Ogunlade',
    jobTitle: 'Agribusiness Operations Manager',
    prevStatus: 'Shortlisted',
    newStatus: 'Approved',
    changedBy: 'Ahmed Bello',
    timestamp: new Date('2026-06-02T16:30:00Z').toISOString()
  }
];

export function initializeDb() {
  if (!localStorage.getItem(USERS_KEY)) {
    localStorage.setItem(USERS_KEY, JSON.stringify([DEFAULT_SUPERADMIN, DEFAULT_ADMIN]));
  }
  if (!localStorage.getItem(JOBS_KEY)) {
    localStorage.setItem(JOBS_KEY, JSON.stringify(SEED_JOBS));
  }
  if (!localStorage.getItem(APPLICATIONS_KEY)) {
    localStorage.setItem(APPLICATIONS_KEY, JSON.stringify(SEED_APPLICATIONS));
  }
  if (!localStorage.getItem(AUDIT_LOG_KEY)) {
    localStorage.setItem(AUDIT_LOG_KEY, JSON.stringify(SEED_AUDIT_LOGS));
  }
}

// Database Getters & Setters
export function getData(key) {
  initializeDb();
  const raw = localStorage.getItem(key);
  return raw ? JSON.parse(raw) : [];
}

export function saveData(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}

// UserService
export const localStorageDb = {
  getUsers: () => getData(USERS_KEY),
  saveUsers: (users) => saveData(USERS_KEY, users),

  getJobs: () => getData(JOBS_KEY),
  saveJobs: (jobs) => saveData(JOBS_KEY, jobs),

  getApplications: () => getData(APPLICATIONS_KEY),
  saveApplications: (apps) => saveData(APPLICATIONS_KEY, apps),

  getAuditLogs: () => getData(AUDIT_LOG_KEY),
  saveAuditLogs: (logs) => saveData(AUDIT_LOG_KEY, logs),

  addAuditEntry: (applicationId, applicantName, jobTitle, prevStatus, newStatus, changedBy) => {
    const logs = getData(AUDIT_LOG_KEY);
    const newEntry = {
      id: 'log-' + generateId(),
      applicationId,
      applicantName,
      jobTitle,
      prevStatus,
      newStatus,
      changedBy,
      timestamp: new Date().toISOString()
    };
    logs.push(newEntry);
    saveData(AUDIT_LOG_KEY, logs);
  },

  // Auth Operations
  loginUser: (email, passwordHash) => {
    const users = getData(USERS_KEY);
    const user = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (!user || user.passwordHash !== passwordHash) {
      return null;
    }
    if (user.status === 'Suspended') {
      throw new Error('Account suspended');
    }

    user.lastLogin = new Date().toISOString();
    const updatedUsers = users.map((u) => (u.id === user.id ? user : u));
    saveData(USERS_KEY, updatedUsers);

    return {
      user,
      token: `mock-jwt-token-for-${user.id}-${user.role}`
    };
  }
};