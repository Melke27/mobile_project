const USB_REVERSE_API_BASE_URL = 'http://127.0.0.1:5000/api';
const EMULATOR_API_BASE_URL = 'http://10.0.2.2:5000/api';
const LOCAL_PHONE_API_BASE_URL = 'http://192.168.1.20:5000/api';
const HOSTED_API_BASE_URL = 'https://mobile-project-xvez.onrender.com/api';

// Modes: auto | usb_reverse | emulator | phone_wifi | hosted
// auto prefers live hosted API first so the app still works after USB disconnect.
// For strict USB local backend testing, switch to 'usb_reverse'.
const DEV_BACKEND_MODE = 'auto';

const MODE_TARGETS = {
  auto: [
    HOSTED_API_BASE_URL,
    USB_REVERSE_API_BASE_URL,
    EMULATOR_API_BASE_URL,
    LOCAL_PHONE_API_BASE_URL,
  ],
  usb_reverse: [USB_REVERSE_API_BASE_URL, HOSTED_API_BASE_URL],
  emulator: [EMULATOR_API_BASE_URL, HOSTED_API_BASE_URL],
  phone_wifi: [LOCAL_PHONE_API_BASE_URL, HOSTED_API_BASE_URL],
  hosted: [HOSTED_API_BASE_URL],
};

const resolveDevCandidates = () => {
  const selected = MODE_TARGETS[DEV_BACKEND_MODE] || MODE_TARGETS.auto;
  return [...new Set(selected)];
};

const DEV_API_BASE_URL_CANDIDATES = resolveDevCandidates();
let activeDevApiBaseUrl = DEV_API_BASE_URL_CANDIDATES[0] || HOSTED_API_BASE_URL;

export const API_BASE_URL = __DEV__ ? activeDevApiBaseUrl : HOSTED_API_BASE_URL;
export const DEFAULT_CAMPUS = 'Findit';

export const getDevApiBaseUrlCandidates = () => DEV_API_BASE_URL_CANDIDATES;

export const getActiveDevApiBaseUrl = () => activeDevApiBaseUrl;

export const setActiveDevApiBaseUrl = (url) => {
  if (__DEV__ && DEV_API_BASE_URL_CANDIDATES.includes(url)) {
    activeDevApiBaseUrl = url;
  }
  return activeDevApiBaseUrl;
};
