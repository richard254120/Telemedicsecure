import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';

export type Language = 'en' | 'sw';

export interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: (key: string, fallback?: string) => string;
}

const translations: Record<Language, Record<string, string>> = {
  en: {
    // Branding & General
    'brand.title': 'TeleMedSecure',
    'brand.subtitle': 'Decentralized Healthcare & Telemedicine Network',
    'common.login': 'Sign In',
    'common.logout': 'Sign Out',
    'common.dashboard': 'Dashboard',
    'common.refresh': 'Refresh',
    'common.search': 'Search...',
    'common.filter': 'Filter',
    'common.cancel': 'Cancel',
    'common.confirm': 'Confirm',
    'common.save': 'Save Changes',
    'common.submit': 'Submit',
    'common.back': 'Back',
    'common.status': 'Status',
    'common.actions': 'Actions',
    'common.loading': 'Loading station…',
    'common.syncing': 'SYNCING…',
    'common.updated': 'UPDATED',
    'common.language': 'Language',
    'common.active': 'Active',
    'common.completed': 'Completed',
    'common.pending': 'Pending',
    'common.rescheduled': 'Rescheduled',

    // Roles
    'role.patient': 'Patient',
    'role.doctor': 'Doctor',
    'role.nurse': 'Nurse',
    'role.pharmacist': 'Pharmacist',
    'role.lab_technician': 'Lab Technician',
    'role.radiologist': 'Radiologist',
    'role.billing_officer': 'Billing Officer',
    'role.triage_officer': 'Triage Officer',
    'role.care_coordinator': 'Care Coordinator',
    'role.admin': 'Administrator',
    'role.receptionist': 'Front Desk Receptionist',

    // Navigation Tabs & Stations
    'nav.home': 'Home',
    'nav.consultations': 'Consultations',
    'nav.prescriptions': 'Prescriptions',
    'nav.vitals': 'Vitals & NEWS2',
    'nav.triage': 'Emergency Triage',
    'nav.med_admin': 'e-MAR Medication Admin',
    'nav.care_plans': 'Care Coordination',
    'nav.patients': 'Assigned Patients',
    'nav.patient_hub': 'Patient Hub',
    'nav.schedule': 'Appointment Schedule',
    'nav.records': 'Medical Records',
    'nav.diagnostics': 'Diagnostics & PACS',
    'nav.chat': 'Care Chat',
    'nav.waiting_room': 'Waiting Room',
    'nav.video_call': 'Start Video Call',

    // Nurse Station
    'nurse.station_title': 'Nursing & Triage Station',
    'nurse.vitals_capture': 'Patient Vital Sign Capture',
    'nurse.vitals_desc': 'Captured measurements are encrypted on dispatch with AES-256-GCM envelope encryption.',
    'nurse.bp': 'Blood Pressure',
    'nurse.hr': 'Heart Rate (bpm)',
    'nurse.spo2': 'Oxygen Saturation (%)',
    'nurse.temp': 'Core Temperature (°C)',
    'nurse.resp': 'Respiratory Rate (bpm)',
    'nurse.consciousness': 'Consciousness Level',
    'nurse.oxygen': 'Patient on Supplemental O₂',
    'nurse.submit_vitals': 'Encrypt & Record Vitals',
    'nurse.triage_title': 'Clinical Nursing Emergency Triage Station',
    'nurse.triage_desc': 'Classify acute arrival acuity levels using the 5-level Emergency Severity Index (ESI) & fast-track patients.',
    'nurse.care_title': 'Nursing Care Plans & Population Coordination',
    'nurse.care_desc': 'Interdisciplinary nursing diagnoses, care goals, 48-hr post-discharge protocols, and patient task monitoring.',
    'nurse.emar_title': 'electronic Medication Administration Record (e-MAR)',
    'nurse.emar_desc': 'Enforce the 5 Rights of Medication Administration: Right Patient, Right Drug, Right Dose, Right Route, Right Time.',
    'nurse.give_sign': 'Give & Sign',
    'nurse.enter_vitals': 'Enter Vitals',

    // Doctor Command Center
    'doctor.command_center': 'Clinical Patient Command Center',
    'doctor.active_patient': 'Active Patient',
    'doctor.no_patient': 'No Patient Selected',
    'doctor.key_required': 'Protected by Patient Access Key',
    'doctor.key_granted': 'Decrypted with Access Key',
    'doctor.unlock_btn': 'Unlock Records',
    'doctor.lock_btn': 'Lock Chart',
    'doctor.key_placeholder': 'Enter patient cryptographic access key or PIN...',
    'doctor.visits': 'Visits',
    'doctor.issued': 'Issued',
    'doctor.awaiting_calls': 'Awaiting Calls',
    'doctor.completed_calls': 'Completed Calls',
    'doctor.rescheduled_calls': 'Rescheduled Encounters',

    // Admin & Workforce
    'admin.reset_pass': 'Reset Pass',
    'admin.suspend': 'Suspend',
    'admin.restore': 'Restore',
    'admin.purge': 'Purge',
    'admin.totp': '2FA Enrolment',
    'admin.workforce': 'Workforce & RBAC',
    'admin.password_reset_title': 'Reset Password for User',
    'admin.custom_pass': 'Custom New Password',
    'admin.require_rotation': 'Require user to change password upon next login',
    'admin.issue_pass': 'Issue Password',
  },
  sw: {
    // Branding & General
    'brand.title': 'TeleMedSecure',
    'brand.subtitle': 'Mfumo wa Afya na Matibabu ya Mtandao ya Kidijitali',
    'common.login': 'Ingia Kwenye Mfumo',
    'common.logout': 'Toka Kwenye Mfumo',
    'common.dashboard': 'Dashibodi Kuu',
    'common.refresh': 'Pakia Upya',
    'common.search': 'Tafuta hapa...',
    'common.filter': 'Chuja',
    'common.cancel': 'Ghairi',
    'common.confirm': 'Thibitisha',
    'common.save': 'Hifadhi Mabadiliko',
    'common.submit': 'Wasilisha',
    'common.back': 'Rudi Nyuma',
    'common.status': 'Hali',
    'common.actions': 'Vitendo',
    'common.loading': 'Inapakia kituo cha afya…',
    'common.syncing': 'INASASISHA…',
    'common.updated': 'IMESASISHWA',
    'common.language': 'Lugha',
    'common.active': 'Inayofanya Kazi',
    'common.completed': 'Imekamilika',
    'common.pending': 'Inasubiri',
    'common.rescheduled': 'Imeahirishwa',

    // Roles
    'role.patient': 'Mgonjwa',
    'role.doctor': 'Daktari',
    'role.nurse': 'Muuguzi / Nesi',
    'role.pharmacist': 'Afisa Duka la Dawa (Mfamasia)',
    'role.lab_technician': 'Mtaalamu wa Maabara',
    'role.radiologist': 'Mtaalamu wa Mionzi (X-Ray)',
    'role.billing_officer': 'Afisa wa Fedha na Bili',
    'role.triage_officer': 'Afisa wa Mapokezi ya Dharura',
    'role.care_coordinator': 'Mratibu wa Huduma za Wagonjwa',
    'role.admin': 'Msimamizi Mkuu wa Mfumo',
    'role.receptionist': 'Mapokezi ya Hospitali',

    // Navigation Tabs & Stations
    'nav.home': 'Nyumbani',
    'nav.consultations': 'Ushauri na Vipindi vya Video',
    'nav.prescriptions': 'Maagizo ya Dawa',
    'nav.vitals': 'Vipimo vya Uhai na NEWS2',
    'nav.triage': 'Dharura na Uainishaji (Triage)',
    'nav.med_admin': 'Utoaji wa Dawa kwa Mgonjwa (e-MAR)',
    'nav.care_plans': 'Uratibu wa Huduma za Wagonjwa',
    'nav.patients': 'Orodha ya Wagonjwa Waliopangiwa',
    'nav.patient_hub': 'Kituo cha Mgonjwa',
    'nav.schedule': 'Ratiba ya Miadi',
    'nav.records': 'Kumbukumbu za Kimatibabu',
    'nav.diagnostics': 'Vipimo vya Picha na Maabara',
    'nav.chat': 'Mazungumzo ya Kimatibabu',
    'nav.waiting_room': 'Chumba cha Kusubiri',
    'nav.video_call': 'Anzisha Simu ya Video',

    // Nurse Station
    'nurse.station_title': 'Kituo Kikuu cha Uuguzi na Dharura',
    'nurse.vitals_capture': 'Kurekodi Vipimo vya Uhai vya Mgonjwa',
    'nurse.vitals_desc': 'Vipimo vyote vinasimbwa kwa njia ya siri ya AES-256-GCM kabla ya kuhifadhiwa.',
    'nurse.bp': 'Shinikizo la Damu (mmHg)',
    'nurse.hr': 'Kasi ya Mapigo ya Moyo (bpm)',
    'nurse.spo2': 'Kiwango cha Oksijeni Mwilini (%)',
    'nurse.temp': 'Joto la Mwili (°C)',
    'nurse.resp': 'Kasi ya Upumuaji (bpm)',
    'nurse.consciousness': 'Kiwango cha Fahamu (AVPU)',
    'nurse.oxygen': 'Mgonjwa Yuko Kwenye Oksijeni ya Ziada',
    'nurse.submit_vitals': 'Simba na Hifadhi Vipimo vya Uhai',
    'nurse.triage_title': 'Kituo cha Uuguzi cha Uainishaji wa Dharura (Triage)',
    'nurse.triage_desc': 'Panga ukali wa dharura ya mgonjwa kwa kutumia viwango 5 vya ESI na upate huduma ya haraka.',
    'nurse.care_title': 'Mipango ya Huduma ya Uuguzi na Ufuatiliaji',
    'nurse.care_desc': 'Utambuzi wa kiuguzi, malengo ya matibabu, ufuatiliaji wa saa 48 baada ya kuruhusiwa, na majukumu.',
    'nurse.emar_title': 'Kumbukumbu ya Kidijitali ya Utoaji Dawa (e-MAR)',
    'nurse.emar_desc': 'Kuzingatia Haki 5 za Utoaji Dawa: Mgonjwa Sahihi, Dawa Sahihi, Kipimo Sahihi, Njia Sahihi, na Wakati Sahihi.',
    'nurse.give_sign': 'Mpe Dawa & Saini',
    'nurse.enter_vitals': 'Weka Vipimo vya Uhai',

    // Doctor Command Center
    'doctor.command_center': 'Kituo Kikuu cha Daktari cha Wagonjwa',
    'doctor.active_patient': 'Mgonjwa Anayehudumiwa Hivi Sasa',
    'doctor.no_patient': 'Hakuna Mgonjwa Aliyechaguliwa',
    'doctor.key_required': 'Imelindwa na Ufunguo wa Siri wa Mgonjwa',
    'doctor.key_granted': 'Imefunguliwa kwa Ufunguo wa Siri',
    'doctor.unlock_btn': 'Fungua Faili la Mgonjwa',
    'doctor.lock_btn': 'Funga Faili la Mgonjwa',
    'doctor.key_placeholder': 'Weka ufunguo wa siri wa mgonjwa au nambari ya siri...',
    'doctor.visits': 'Vipindi vya Matibabu',
    'doctor.issued': 'Zilizotolewa',
    'doctor.awaiting_calls': 'Simu Zinazosubiriwa',
    'doctor.completed_calls': 'Simu Zilizokamilika',
    'doctor.rescheduled_calls': 'Miadi Iliyoahirishwa',

    // Admin & Workforce
    'admin.reset_pass': 'Badilisha Nenosiri',
    'admin.suspend': 'Simamisha',
    'admin.restore': 'Rejesha',
    'admin.purge': 'Futa Kabisa',
    'admin.totp': 'Uthibitishaji wa Hatua Mbili (2FA)',
    'admin.workforce': 'Wafanyakazi na Majukumu (RBAC)',
    'admin.password_reset_title': 'Weka Nenosiri Jipya la Mtumiaji',
    'admin.custom_pass': 'Nenosiri Jipya la Mtumiaji',
    'admin.require_rotation': 'Mlazimishe mtumiaji kubadilisha nenosiri anapoingia tena',
    'admin.issue_pass': 'Weka na Toa Nenosiri',
  }
};

const LanguageContext = createContext<LanguageContextType>({
  language: 'en',
  setLanguage: () => {},
  toggleLanguage: () => {},
  t: (key: string, fallback?: string) => fallback || key,
});

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const stored = localStorage.getItem('telemed_lang');
      if (stored === 'sw' || stored === 'en') return stored;
    } catch (e) {
      // localStorage disabled or private browsing
    }
    return 'en';
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem('telemed_lang', lang);
      document.documentElement.lang = lang;
    } catch (e) {}
  };

  const toggleLanguage = () => {
    setLanguage(language === 'en' ? 'sw' : 'en');
  };

  useEffect(() => {
    try {
      document.documentElement.lang = language;
    } catch (e) {}
  }, [language]);

  const t = (key: string, fallback?: string): string => {
    const langDict = translations[language] || translations.en;
    if (langDict[key]) return langDict[key];
    if (translations.en[key]) return translations.en[key];
    return fallback !== undefined ? fallback : key;
  };

  const value = useMemo(() => ({
    language,
    setLanguage,
    toggleLanguage,
    t
  }), [language]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
