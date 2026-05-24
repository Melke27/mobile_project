import { PermissionsAndroid, Platform } from 'react-native';

const request = async (permission, title, message) => {
  if (Platform.OS !== 'android') {
    return true;
  }

  const granted = await PermissionsAndroid.request(permission, {
    title,
    message,
    buttonPositive: 'Allow',
    buttonNegative: 'Deny',
  });

  return granted === PermissionsAndroid.RESULTS.GRANTED;
};

export const permissionsService = {
  async requestCameraPermission() {
    return request(
      PermissionsAndroid.PERMISSIONS.CAMERA,
      'Camera Permission',
      'Camera access is required to attach item photos.'
    );
  },

  async requestGalleryPermission() {
    if (Platform.OS !== 'android') {
      return true;
    }

    const permission =
      Platform.Version >= 33
        ? PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES
        : PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE;

    return request(
      permission,
      'Gallery Permission',
      'Gallery access is required to select item photos.'
    );
  },

  async requestLocationPermission() {
    return request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      'Location Permission',
      'Location access is required to tag where the item was lost or found.'
    );
  },

  async requestNotificationPermission() {
    if (Platform.OS !== 'android') {
      return true;
    }

    if (Platform.Version < 33) {
      return true;
    }

    return request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
      'Notification Permission',
      'Notifications help you receive report updates.'
    );
  },
};
