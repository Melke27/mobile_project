import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useAuth } from '../context/AuthContext';
import AppIcon from '../components/AppIcon';

const C = {
  blue: '#1a6edb',
  white: '#ffffff',
  bg: '#f5f7fb',
  text: '#111827',
  muted: '#6b7280',
};

const LoginScreen = ({ navigation }) => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');

  const onSubmit = async () => {
    setError('');
    if (!email.trim()) {
      setError('Email is required');
      return Alert.alert('Validation', 'Please enter your email');
    }
    if (!password) {
      setError('Password is required');
      return Alert.alert('Validation', 'Please enter your password');
    }

    setSubmitting(true);
    try {
      await login(email.trim(), password);
    } catch (err) {
      setError(err?.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.root}>
      <LinearGradient
        colors={['#1a6edb', '#0f4ca8', '#0a3a7f']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <KeyboardAvoidingView
          style={styles.keyboardWrap}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Logo & Header */}
            <View style={styles.header}>
              <View style={styles.logoContainer}>
                <View style={styles.logoCircle}>
                  <AppIcon name="map-search" size={48} color="#ffffff" />
                </View>
              </View>
              <Text style={styles.appTitle}>Findit</Text>
              <Text style={styles.appSubtitle}>Campus Lost & Found</Text>
              <Text style={styles.tagline}>Sign in to connect and recover items</Text>
            </View>

            {/* Login Card */}
            <View style={styles.card}>
              {error && (
                <View style={styles.errorBox}>
                  <AppIcon name="alert-circle-outline" size={18} color="#ef4444" />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              {/* Email */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Email Address</Text>
                <View style={styles.inputWrapper}>
                  <AppIcon name="email-outline" size={20} color={C.muted} />
                  <TextInput
                    style={styles.input}
                    placeholder="you@example.com"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={email}
                    onChangeText={(text) => {
                      setEmail(text);
                      setError('');
                    }}
                    editable={!submitting}
                  />
                </View>
              </View>

              {/* Password */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Password</Text>
                <View style={styles.inputWrapper}>
                  <AppIcon name="lock-outline" size={20} color={C.muted} />
                  <TextInput
                    style={styles.input}
                    placeholder="Enter your password"
                    secureTextEntry={!showPassword}
                    value={password}
                    onChangeText={(text) => {
                      setPassword(text);
                      setError('');
                    }}
                    editable={!submitting}
                  />
                  <Pressable onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                    <AppIcon
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color={C.muted}
                    />
                  </Pressable>
                </View>
              </View>

              {/* Options */}
              <View style={styles.optionsRow}>
                <Pressable style={styles.rememberRow} onPress={() => setRememberMe(!rememberMe)}>
                  <View style={[styles.checkbox, rememberMe && styles.checkboxActive]}>
                    {rememberMe && <AppIcon name="check" size={14} color="#fff" />}
                  </View>
                  <Text style={styles.rememberText}>Remember me</Text>
                </Pressable>

                <Pressable onPress={() => navigation.navigate('Register')}>
                  <Text style={styles.forgotText}>Create Account</Text>
                </Pressable>
              </View>

              {/* Sign In Button */}
              <Pressable
                style={[styles.loginButton, submitting && styles.buttonDisabled]}
                onPress={onSubmit}
                disabled={submitting}
              >
                <LinearGradient
                  colors={['#1a6edb', '#0f4ca8']}
                  style={styles.buttonGradient}
                >
                  {submitting ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <View style={styles.buttonContent}>
                      <AppIcon name="login" size={18} color="#fff" />
                      <Text style={styles.loginButtonText}>Sign In</Text>
                    </View>
                  )}
                </LinearGradient>
              </Pressable>

              {/* Register Link */}
              <Pressable
                style={styles.registerButton}
                onPress={() => navigation.navigate('Register')}
              >
                <Text style={styles.registerText}>
                  Don't have an account? <Text style={styles.registerHighlight}>Create one</Text>
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  gradient: { flex: 1 },
  keyboardWrap: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },

  header: { alignItems: 'center', marginBottom: 32 },
  logoContainer: { marginBottom: 12 },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  appTitle: { fontSize: 32, fontWeight: '800', color: '#fff', marginBottom: 4 },
  appSubtitle: { fontSize: 15, color: 'rgba(255,255,255,0.85)', fontWeight: '600' },
  tagline: { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 4 },

  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 12,
  },

  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fef2f2',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#ef4444',
  },
  errorText: { color: '#ef4444', fontSize: 13, fontWeight: '500', flex: 1 },

  inputGroup: { marginBottom: 18 },
  label: { fontSize: 13, fontWeight: '700', color: C.text, marginBottom: 6 },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 14,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 15,
    color: C.text,
  },
  eyeIcon: { padding: 6 },

  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  rememberRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: C.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: { backgroundColor: C.blue },

  rememberText: { color: C.muted, fontSize: 14 },
  forgotText: { color: C.blue, fontWeight: '600' },

  loginButton: { borderRadius: 12, overflow: 'hidden', marginBottom: 16 },
  buttonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loginButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  buttonDisabled: { opacity: 0.7 },

  registerButton: { alignItems: 'center', paddingVertical: 12 },
  registerText: { fontSize: 14, color: C.muted },
  registerHighlight: { color: C.blue, fontWeight: '700' },
});

export default LoginScreen;
