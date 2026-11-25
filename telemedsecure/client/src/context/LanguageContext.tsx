import React, { createContext, useContext, useState, useEffect, useMemo, useRef } from 'react';

export type Language = 'en' | 'sw';

export interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: (keyOrText: string, fallback?: string) => string;
}

// Comprehensive English -> Kiswahili Clinical & Application Translation Dictionary
export const SW_DICTIONARY: Record<string, string> = {
  // Navigation & General UI
  'TeleMedSecure': 'TeleMedSecure',
  'Decentralized Healthcare & Telemedicine Network': 'Mtandao wa Afya na Matibabu ya Kidijitali',
  'Zero-Knowledge Medical Platform': 'Jukwaa Salama la Matibabu Yenye Usiri Mkubwa',
  'Sign In': 'Ingia Kwenye Mfumo',
  'Sign Out': 'Toka Kwenye Mfumo',
  'Log in': 'Ingia Kwenye Mfumo',
  'Login': 'Ingia',
  'Logout': 'Toka',
  'Home': 'Nyumbani',
  'Dashboard': 'Dashibodi',
  'Command': 'Uongozi',
  'Integrity': 'Uadilifu',
  'Operations': 'Uendeshaji',
  'Identity': 'Utambulisho',
  'Refresh': 'Pakia Upya',
  'Search': 'Tafuta',
  'Filter': 'Chuja',
  'Cancel': 'Ghairi',
  'Confirm': 'Thibitisha',
  'Save Changes': 'Hifadhi Mabadiliko',
  'Submit': 'Wasilisha',
  'Back': 'Rudi Nyuma',
  'Status': 'Hali',
  'Actions': 'Vitendo',
  'Active': 'Inayofanya Kazi',
  'Completed': 'Imekamilika',
  'Pending': 'Inasubiri',
  'Rescheduled': 'Imeahirishwa',
  'Cancelled': 'Imeghairiwa',
  'Declined': 'Imekataliwa',
  'Accept': 'Kubali',
  'Decline': 'Kataa',
  'Reschedule': 'Ahirisha / Panga Upya',
  'Join Call': 'Jiunge na Simu',
  'Waiting Room': 'Chumba cha Kusubiri',
  'Start Video Call': 'Anzisha Simu ya Video',
  'Launch E2EE Call': 'Anzisha Simu Salama ya Video',
  'Care Chat': 'Mazungumzo ya Kimatibabu',
  'Clinical Chat': 'Mazungumzo ya Kliniki',
  'Total Patients': 'Jumla ya Wagonjwa',
  'All Encounters': 'Mikutano Yote',
  'Awaiting Calls': 'Simu Zinazosubiriwa',
  'Completed Calls': 'Simu Zilizokamilika',
  'Rescheduled Encounters': 'Miadi Iliyoahirishwa',
  'Rescheduled Visit': 'Ziara Iliyoahirishwa',
  'Account Verified': 'Akaunti Imethibitishwa',
  'Patient MRN': 'Nambari ya Faili ya Mgonjwa (MRN)',
  'Registered Email': 'Barua Pepe Iliyosajiliwa',
  'Consultations': 'Vipindi vya Ushauri',
  'Prescriptions': 'Maagizo ya Dawa',
  'Issue e-Prescription': 'Toa Agizo la Dawa Mtandaoni',
  'Schedule Appointment': 'Panga Miadi Mpya',
  'Schedule New Visit': 'Panga Miadi Mpya',
  'Medical Records': 'Kumbukumbu za Kimatibabu',
  'Appointment Calendar': 'Kalenda ya Miadi',
  'Verify Prescription': 'Thibitisha Agizo la Dawa',
  'Verify Report': 'Thibitisha Ripoti',
  'Verify RX': 'Thibitisha Dawa',
  'Compliance Hub': 'Kituo cha Uzingatiaji Sheria',
  'Audit Chain': 'Mlolongo wa Ukaguzi wa Usalama',
  'Forensics Studio': 'Uchunguzi wa Kiuchunguzi (Forensics)',

  // Roles
  'Patient': 'Mgonjwa',
  'Doctor': 'Daktari',
  'Nurse': 'Muuguzi / Nesi',
  'Pharmacist': 'Afisa Duka la Dawa (Mfamasia)',
  'Lab Technician': 'Mtaalamu wa Maabara',
  'Radiologist': 'Mtaalamu wa Mionzi (X-Ray)',
  'Billing Officer': 'Afisa wa Bili na Malipo',
  'Triage Officer': 'Afisa wa Uainishaji Dharura',
  'Care Coordinator': 'Mratibu wa Huduma za Wagonjwa',
  'Administrator': 'Msimamizi Mkuu',
  'Admin': 'Msimamizi',
  'Receptionist': 'Mhudumu wa Mapokezi',
  'Front Desk': 'Mapokezi ya Mbele',

  // Stations & Titles
  'Nursing Station': 'Kituo Kikuu cha Uuguzi',
  'Nursing & Triage': 'Uuguzi na Uainishaji wa Dharura',
  'Physician Station': 'Kituo Kikuu cha Daktari',
  'Doctor Station': 'Kituo cha Daktari',
  'Patient Portal': 'Lango la Mgonjwa',
  'Admin Console': 'Dashibodi ya Msimamizi Mkuu',
  'Pharmacy Workbench': 'Kituo cha Duka la Dawa',
  'Lab Workbench': 'Kituo cha Maabara ya Uchunguzi',
  'Radiology Workbench': 'Kituo cha Picha za Mionzi (Radiology)',
  'Billing Workbench': 'Kituo cha Fedha na Bili',
  'Triage Workbench': 'Kituo cha Mapokezi ya Dharura',
  'Care Coordinator Workbench': 'Kituo cha Uratibu wa Huduma',

  // Nurse Dashboard & Clinical Duties
  'Vitals & NEWS2': 'Vipimo vya Uhai na NEWS2',
  'Emergency Triage': 'Uainishaji wa Dharura (Triage)',
  'e-MAR Medication Admin': 'Utoaji wa Dawa kwa Mgonjwa (e-MAR)',
  'Care Coordination': 'Uratibu wa Huduma za Wagonjwa',
  'Assigned Patients': 'Orodha ya Wagonjwa Waliopangiwa',
  'Patient Vital Sign Capture': 'Kurekodi Vipimo vya Uhai vya Mgonjwa',
  'Captured measurements are encrypted on dispatch with AES-256-GCM envelope encryption.':
    'Vipimo vyote vinasimbwa kwa njia salama ya AES-256-GCM kabla ya kuhifadhiwa.',
  'Blood Pressure': 'Shinikizo la Damu',
  'Blood Pressure (mmHg)': 'Shinikizo la Damu (mmHg)',
  'Heart Rate (bpm)': 'Mapigo ya Moyo (bpm)',
  'Heart Rate': 'Mapigo ya Moyo',
  'Oxygen Saturation (%)': 'Kiwango cha Oksijeni Mwilini (%)',
  'Oxygen Saturation': 'Kiwango cha Oksijeni',
  'Core Temperature (°C)': 'Joto la Mwili (°C)',
  'Core Temperature': 'Joto la Mwili',
  'Respiratory Rate (bpm)': 'Kasi ya Upumuaji (bpm)',
  'Respiratory Rate': 'Kasi ya Upumuaji',
  'Consciousness Level': 'Kiwango cha Fahamu (AVPU)',
  'Patient on Supplemental O₂': 'Mgonjwa Yuko Kwenye Oksijeni ya Ziada',
  'Encrypt & Record Vitals': 'Simba na Hifadhi Vipimo vya Uhai',
  'Capture Vitals': 'Rekodi Vipimo vya Uhai',
  'Enter Vitals': 'Weka Vipimo vya Uhai',
  'Record Vitals': 'Rekodi Vipimo vya Uhai',
  'Select Consultation Session / Patient': 'Chagua Mkutano wa Daktari au Mgonjwa',
  'Select a patient / consultation...': 'Chagua mgonjwa au miadi...',
  'Select a consultation...': 'Chagua miadi ya mgonjwa...',
  'Clinical Nursing Emergency Triage Station': 'Kituo cha Uuguzi cha Uainishaji wa Dharura (Triage)',
  'Classify acute arrival acuity levels using the 5-level Emergency Severity Index (ESI) & fast-track patients.':
    'Panga ukali wa dharura ya mgonjwa kwa kutumia viwango 5 vya ESI na upate huduma ya haraka.',
  'Nursing Care Plans & Population Coordination': 'Mipango ya Huduma ya Uuguzi na Uratibu wa Wagonjwa',
  'Interdisciplinary nursing diagnoses, care goals, 48-hr post-discharge protocols, and patient task monitoring.':
    'Utambuzi wa kiuguzi, malengo ya matibabu, ufuatiliaji wa saa 48 baada ya kuruhusiwa, na majukumu.',
  'electronic Medication Administration Record (e-MAR)': 'Kumbukumbu ya Kidijitali ya Utoaji Dawa (e-MAR)',
  'Enforce the 5 Rights of Medication Administration: Right Patient, Right Drug, Right Dose, Right Route, Right Time.':
    'Kuzingatia Haki 5 za Utoaji Dawa: Mgonjwa Sahihi, Dawa Sahihi, Kipimo Sahihi, Njia Sahihi, na Wakati Sahihi.',
  'Active Physician Orders Awaiting Administration': 'Maagizo ya Daktari Yanayosubiri Kupewa Mgonjwa',
  'Shift Administration Sign-offs': 'Saini za Utoaji Dawa Kwenye Zamu Hii',
  'Give & Sign': 'Mpe Mgonjwa Dawa & Saini',
  'Dose verified & signed': 'Kipimo kimethibitishwa na kusainiwa',
  'No active e-prescriptions on record.': 'Hakuna maagizo ya dawa yanayopatikana kwa sasa.',
  'No medications administered on this shift yet.': 'Bado hakuna dawa iliyotolewa kwenye zamu hii.',
  'Assigned Patient Roster': 'Orodha ya Wagonjwa Waliopangiwa',
  'No assigned patients found.': 'Hakuna wagonjwa waliopangiwa kwa sasa.',
  'REGISTERED PATIENT': 'MGONJWA ALIYENUKULIWA',

  // Doctor Dashboard
  'Clinical Patient Command Center': 'Kituo Kikuu cha Daktari cha Wagonjwa',
  'Active Patient': 'Mgonjwa Anayehudumiwa Hivi Sasa',
  'No Patient Selected': 'Hakuna Mgonjwa Aliyechaguliwa',
  'Patient Clinical Record': 'Faili la Kimatibabu la Mgonjwa',
  'Patient Health Records Cryptographically Locked': 'Kumbukumbu za Mgonjwa Zimefungwa kwa Siri',
  'HIPAA PRIVACY SHIELD': 'ULINZI WA USIRI WA MATIBABU (HIPAA)',
  'Enter Patient Cryptographic Access Key or 6-Digit Encounter PIN:':
    'Weka Ufunguo wa Siri wa Mgonjwa au Nambari ya Siri (PIN ya Tarakimu 6):',
  'Unlock Records': 'Fungua Faili la Mgonjwa',
  'Unlock Records with Key': 'Fungua Faili kwa Ufunguo',
  'Lock Chart': 'Funga Faili la Mgonjwa',
  'Verifying Key...': 'Inathibitisha Ufunguo...',
  'Patient medical records unlocked and decrypted successfully.':
    'Kumbukumbu za mgonjwa zimefunguliwa na kusimbuliwa kwa mafanikio.',
  'Patient chart records have been re-locked for confidentiality.':
    'Kumbukumbu za mgonjwa zimefungwa tena kwa ajili ya usiri.',
  '🔓 DECRYPTED WITH ACCESS KEY': '🔓 IMEFUNGULIWA KWA UFUNGUO WA SIRI',
  '🔒 PROTECTED BY PATIENT ACCESS KEY': '🔒 IMELINDWA NA UFUNGUO WA MGONJWA',
  '🔓 KEY GRANTED': '🔓 UFUNGUO UMEPATIKANA',
  '🔒 KEY REQUIRED': '🔒 UFUNGUO UNAHITAJIKA',
  'Scheduled Telemedicine Encounters': 'Miadi ya Matibabu ya Video Iliyoratibiwa',
  'Filter awaiting calls, completed clinical sessions, and rescheduled appointments in real-time.':
    'Chuja simu zinazosubiriwa, vipindi vilivyokamilika, na miadi iliyoahirishwa papo hapo.',
  'Select a patient from the directory to begin clinical encounter.':
    'Chagua mgonjwa kutoka kwenye orodha ili kuanza kutoa huduma ya kimatibabu.',
  'Under patient sovereignty and zero-knowledge encryption policy, patient clinical histories, past SOAP notes, and sensitive prescription data are locked until you enter the patient\'s authorization key or active consultation authorization code.':
    'Chini ya haki ya mgonjwa na usiri wa hali ya juu, historia ya mgonjwa, maelezo ya SOAP na dawa zimefungwa mpaka uweke ufunguo wa siri uliotolewa na mgonjwa.',

  // Admin & Password Reset
  'Workforce & RBAC': 'Wafanyakazi na Majukumu (RBAC)',
  'Staff, roles, provisioning': 'Wafanyakazi, majukumu, usajili',
  'Reset Pass': 'Weka Nenosiri Jipya',
  'Suspend': 'Simamisha',
  'Restore': 'Rejesha',
  'Purge': 'Futa Kabisa',
  '2FA': 'Hatua 2 (2FA)',
  'Issue Password': 'Weka Nenosiri',
  'Custom New Password': 'Nenosiri Jipya la Kibinafsi',
  'Require user to change password upon next login': 'Mlazimishe mtumiaji kubadilisha nenosiri anapoingia tena',
  'New Password Issued': 'Nenosiri Jipya Limetolewa',
  'Done — Credential Delivered': 'Imekamilika — Nenosiri Limewasilishwa',
  'Share these credentials securely with the account holder. The password is displayed once and will not be stored in plaintext.':
    'Mpe mtumiaji nenosiri hili kwa njia salama. Nenosiri linaonyeshwa mara moja tu na halitahifadhiwa wazi.',

  // Vitals & Clinical Flags
  'Normal': 'Kawaida',
  'Abnormal': 'Isiyo ya Kawaida',
  'Critical': 'Hali ya Hatari',
  'Urgent': 'Dharura Kubwa',
  'Low Risk': 'Hatari Ndogo',
  'Medium Risk': 'Hatari ya Wastani',
  'High Risk': 'Hatari Kubwa',
  'Alert': 'Mwangalifu (Alert)',
  'Voice': 'Huitikia Sauti (Voice)',
  'Pain': 'Huitikia Maumivu (Pain)',
  'Unresponsive': 'Hawezi Kuitikia (Unresponsive)',
  'ALERT': 'MWANGALIFU',
  'VOICE': 'HUITIKIA SAUTI',
  'PAIN': 'HUITIKIA MAUMIVU',
  'UNRESPONSIVE': 'HAWEZI KUITIKIA',

  // Common phrases & badges
  'LIVE SYNC': 'INASASISHA PAPO HAPO',
  'COMMAND CENTER LIVE • AUTO-SYNCING': 'KITUO CHA AMRI KINAENDELEA • INAJISASISHA',
  'Active Clinical Triage Alerts Registered by Nursing Staff':
    'Tahadhari za Dharura Zilizosajiliwa na Wauguzi',
  'Clinical Consultations': 'Ushauri wa Kimatibabu',
  'Active Prescriptions': 'Dawa Zinazotumika Hivi Sasa',
  'Visits': 'Ziara za Matibabu',
  'Issued': 'Iliyotolewa',
  'No consultations recorded for this patient.': 'Hakuna miadi iliyorekodiwa kwa mgonjwa huyu bado.',
  'No prescriptions issued to this patient yet.': 'Hakuna dawa zilizotolewa kwa mgonjwa huyu bado.',
  'No consultations match the selected filter': 'Hakuna miadi inayolingana na kichujio kilichochaguliwa',
  'Search patient, status or ID...': 'Tafuta mgonjwa, hali au nambari ya utambulisho...',
  'Reschedule consultation': 'Ahirisha au panga upya miadi',
  'Decline request': 'Kataa ombi la miadi',
  'Cancel consultation': 'Ghairi miadi ya matibabu',
};

// Build reverse dictionary (Kiswahili -> English) for restoring original text
const EN_DICTIONARY: Record<string, string> = {};
for (const [en, sw] of Object.entries(SW_DICTIONARY)) {
  EN_DICTIONARY[sw] = en;
}

const LanguageContext = createContext<LanguageContextType>({
  language: 'en',
  setLanguage: () => {},
  toggleLanguage: () => {},
  t: (text: string) => text,
});

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const stored = localStorage.getItem('telemed_lang');
      if (stored === 'sw' || stored === 'en') return stored;
    } catch (e) {}
    return 'en';
  });

  const languageRef = useRef(language);
  languageRef.current = language;

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

  // Automated Full-DOM Text Translator
  // Translates all visible rendered text nodes on the page dynamically when Kiswahili is active
  useEffect(() => {
    document.documentElement.lang = language;

    const translateNode = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.nodeValue;
        if (!text) return;
        const trimmed = text.trim();
        if (!trimmed) return;

        if (languageRef.current === 'sw') {
          // Direct match
          if (SW_DICTIONARY[trimmed]) {
            node.nodeValue = text.replace(trimmed, SW_DICTIONARY[trimmed]);
            return;
          }
          // Substring / multi-word match
          for (const [enPhrase, swPhrase] of Object.entries(SW_DICTIONARY)) {
            if (enPhrase.length > 3 && text.includes(enPhrase)) {
              node.nodeValue = node.nodeValue?.split(enPhrase).join(swPhrase) || text;
            }
          }
        } else {
          // English mode: revert Swahili words back to English if found
          if (EN_DICTIONARY[trimmed]) {
            node.nodeValue = text.replace(trimmed, EN_DICTIONARY[trimmed]);
            return;
          }
          for (const [swPhrase, enPhrase] of Object.entries(EN_DICTIONARY)) {
            if (swPhrase.length > 3 && text.includes(swPhrase)) {
              node.nodeValue = node.nodeValue?.split(swPhrase).join(enPhrase) || text;
            }
          }
        }
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        const tagName = el.tagName.toLowerCase();
        if (tagName === 'script' || tagName === 'style' || tagName === 'code') return;

        // Translate placeholders
        if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
          const ph = el.placeholder;
          if (ph) {
            if (languageRef.current === 'sw' && SW_DICTIONARY[ph]) {
              el.placeholder = SW_DICTIONARY[ph];
            } else if (languageRef.current === 'en' && EN_DICTIONARY[ph]) {
              el.placeholder = EN_DICTIONARY[ph];
            }
          }
        }

        // Translate child nodes
        el.childNodes.forEach(child => translateNode(child));
      }
    };

    // Run full page translation pass
    translateNode(document.body);

    // Set up MutationObserver to automatically translate dynamically injected content
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach(node => translateNode(node));
        if (mutation.type === 'characterData' && mutation.target) {
          translateNode(mutation.target);
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });

    return () => {
      observer.disconnect();
    };
  }, [language]);

  const t = (keyOrText: string, fallback?: string): string => {
    if (!keyOrText) return '';
    if (language === 'sw') {
      if (SW_DICTIONARY[keyOrText]) return SW_DICTIONARY[keyOrText];
      if (fallback && SW_DICTIONARY[fallback]) return SW_DICTIONARY[fallback];
      return fallback !== undefined ? fallback : keyOrText;
    }
    // English
    if (EN_DICTIONARY[keyOrText]) return EN_DICTIONARY[keyOrText];
    return fallback !== undefined ? fallback : keyOrText;
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
