import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Image, KeyboardAvoidingView,
  Platform, Pressable, SafeAreaView, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useItems } from '../context/ItemsContext';
import { useAuth } from '../context/AuthContext';
import AppIcon from '../components/AppIcon';
import { imageService } from '../services/imageService';
import { permissionsService } from '../services/permissionsService';
import { storageService } from '../services/storageService';
import { CATEGORIES } from '../utils/constants';
import { generateItemImageUrl } from '../utils/imageFallback';
import { validateReport } from '../utils/validators';
import { DEFAULT_CAMPUS } from '../config/env';

const C = {
  blue:      '#1a6edb',
  blueSoft:  '#eff6ff',
  white:     '#ffffff',
  bg:        '#f5f7fb',
  card:      '#ffffff',
  border:    '#e5e7eb',
  text:      '#111827',
  muted:     '#6b7280',
  green:     '#15803d',
  red:       '#b42318',
  inputText: '#0f172a',
  inputPlaceholder: '#94a3b8',
  inputBorder: '#d8dee7',
  inputFocus: '#1a6edb',
};

const TITLE_MAX = 80;
const ITEM_MAX = 50;
const DESC_MAX = 600;
const LOCATION_MAX = 120;
const LAST_SEEN = ['Today', 'Yesterday', 'This Week', 'Last Week', 'Not Sure'];

const defaultForm = {
  status: 'lost', title: '', description: '', category: 'Other',
  otherItemName: '', locationText: '', imageUrl: '', lastSeenHint: '',
  secretQuestions: [{ question: '', answer: '' }],
};

const buildEditForm = (item = {}) => ({
  status: item?.status === 'found' ? 'found' : 'lost',
  title: item?.title || '',
  description: item?.description || '',
  category: item?.category || 'Other',
  otherItemName: '',
  locationText: item?.locationText || '',
  imageUrl: item?.imageUrl || '',
  lastSeenHint: '',
  secretQuestions: Array.isArray(item?.secretQuestions) && item.secretQuestions.length
    ? item.secretQuestions.map((entry) => ({ question: entry?.question || '', answer: '' }))
    : [{ question: '', answer: '' }],
});

const ReportItemScreen = ({ route, navigation }) => {
  const { createReport, updateReport } = useItems();
  const { user } = useAuth();
  const editItem = route?.params?.item || null;
  const isEditMode = route?.params?.mode === 'edit' && Boolean(editItem?._id);

  const [form, setForm] = useState(defaultForm);
  const [submitting, setSubmitting] = useState(false);
  const [busyAction, setBusyAction] = useState('');
  const [activeField, setActiveField] = useState('');
  const skipDraft = useRef(false);
  const draftReady = useRef(false);

  const patch = (next) => setForm(prev => ({ ...prev, ...next }));
  const isBusy = Boolean(busyAction) || submitting;

  // Draft persistence
  useEffect(() => {
    if (isEditMode) {
      skipDraft.current = true;
      setForm(buildEditForm(editItem));
      draftReady.current = true;
      return;
    }

    storageService.getJSON(storageService.keys.LAST_REPORT_DRAFT, null).then(draft => {
      if (draft) setForm({ ...defaultForm, ...draft });
      draftReady.current = true;
    });
  }, [editItem, isEditMode]);

  useEffect(() => {
    if (!draftReady.current || isEditMode) return;
    if (skipDraft.current) { skipDraft.current = false; return; }
    const t = setTimeout(() => 
      storageService.setJSON(storageService.keys.LAST_REPORT_DRAFT, form).catch(console.warn), 400);
    return () => clearTimeout(t);
  }, [form, isEditMode]);

  const getAutoTitle = (status, category, otherItemName) =>
    category === 'Other' && otherItemName?.trim()
      ? `${status === 'lost' ? 'Lost' : 'Found'} ${otherItemName.trim()}`
      : `${status === 'lost' ? 'Lost' : 'Found'} ${category}`;

  const updateWithAutoTitle = (changes) => {
    setForm(prev => {
      const next = { ...prev, ...changes };
      const shouldAuto = !prev.title.trim() || prev.title === getAutoTitle(prev.status, prev.category, prev.otherItemName);
      if (shouldAuto) {
        next.title = getAutoTitle(next.status, next.category, next.otherItemName ?? prev.otherItemName);
      }
      return next;
    });
  };

  const resolvedTitle = useMemo(() =>
    form.title.trim() || getAutoTitle(form.status, form.category, form.otherItemName),
  [form.title, form.status, form.category, form.otherItemName]);

  const isValid = useMemo(() =>
    !validateReport({ ...form, title: resolvedTitle }), [form, resolvedTitle]);

  const attachPhoto = async (source) => {
    const key = source === 'gallery' ? 'galleryPhoto' : 'cameraPhoto';
    setBusyAction(key);
    try {
      const allowed = source === 'gallery'
        ? await permissionsService.requestGalleryPermission()
        : await permissionsService.requestCameraPermission();
      if (!allowed) return Alert.alert('Permission Denied');

      const asset = source === 'gallery'
        ? await imageService.openGallery()
        : await imageService.openCamera();

      if (asset?.uri) patch({ imageUrl: asset.uri });
    } finally {
      setBusyAction('');
    }
  };

  const clearForm = async () => {
    setBusyAction('clear');
    skipDraft.current = true;
    setForm(defaultForm);
    await storageService.remove(storageService.keys.LAST_REPORT_DRAFT);
    setBusyAction('');
  };

  const onSubmit = async () => {
    if (!user?._id) {
      Alert.alert('Login required', 'Please sign in before posting a report.');
      navigation.navigate('Account');
      return;
    }

    const title = resolvedTitle;
    const err = validateReport({ ...form, title });
    if (err) return Alert.alert('Validation Error', err);

    if (form.status === 'found' && !form.secretQuestions.some(q => q.question && q.answer)) {
      return Alert.alert('Validation', 'Please add at least one secret question for found items.');
    }

    setSubmitting(true);
    setBusyAction('submit');

    try {
      if (isEditMode) {
        await updateReport(editItem._id, {
          status: form.status,
          title,
          description: form.description.trim(),
          locationText: form.locationText.trim(),
          category: form.category,
          imageUrl: form.imageUrl || '',
          secretQuestions: form.status === 'found'
            ? form.secretQuestions.filter(q => q.question && q.answer)
            : [],
        });
        Alert.alert('Success', user?.role === 'admin' ? 'Report updated.' : 'Report updated. It may wait for admin approval.');
        navigation.goBack();
      } else {
        await createReport({
          ...form,
          title,
          description: form.description.trim(),
          locationText: form.locationText.trim(),
          imageUrl: form.imageUrl || generateItemImageUrl(form),
          campus: DEFAULT_CAMPUS,
          secretQuestions: form.status === 'found'
            ? form.secretQuestions.filter(q => q.question && q.answer)
            : [],
        });

        skipDraft.current = true;
        setForm(defaultForm);
        await storageService.remove(storageService.keys.LAST_REPORT_DRAFT);
        Alert.alert(
          'Success',
          user?.role === 'admin'
            ? 'Report posted and visible now.'
            : 'Report submitted. It will be visible after admin approval.'
        );
      }
    } catch (e) {
      Alert.alert('Failed', e?.response?.data?.message || 'Could not post report.');
    } finally {
      setSubmitting(false);
      setBusyAction('');
    }
  };

  const updateQuestion = (index, field, text) => {
    patch({
      secretQuestions: form.secretQuestions.map((q, i) =>
        i === index ? { ...q, [field]: text } : q
      )
    });
  };

  const withFocus = (fieldName, style = s.input) => [
    style,
    activeField === fieldName && s.inputFocused,
  ];

  return (
    <SafeAreaView style={s.root}>
      <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        
        {/* Blue Header */}
        <View style={s.header}>
          <View style={s.headerLeft}>
            <AppIcon name="plus-circle-outline" size={22} color={C.white} />
            <Text style={s.headerTitle}>{isEditMode ? 'Edit Report' : 'Post an Item'}</Text>
          </View>
          
          {/* Lost / Found Toggle */}
          <View style={s.toggleContainer}>
            {['lost', 'found'].map((st) => {
              const isActive = form.status === st;
              return (
                <Pressable
                  key={st}
                  style={[s.toggleBtn, isActive && s.toggleBtnActive]}
                  onPress={() => updateWithAutoTitle({ status: st })}
                >
                  <Text style={[s.toggleTxt, isActive && s.toggleTxtActive]}>
                    {st.toUpperCase()}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">

          <View style={s.card}>

            {/* Photo Section */}
            <View style={s.photoSection}>
              <Text style={s.sectionLabel}>PHOTO (OPTIONAL)</Text>
              <Pressable style={s.photoBox} onPress={() => attachPhoto('camera')}>
                {form.imageUrl ? (
                  <Image source={{ uri: form.imageUrl }} style={s.previewImg} />
                ) : (
                  <View style={s.photoPlaceholder}>
                    <AppIcon name="camera-outline" size={32} color={C.muted} />
                    <Text style={s.photoPlaceholderText}>Add photo</Text>
                  </View>
                )}
              </Pressable>
            </View>

            {/* Title */}
            <Text style={s.sectionLabel}>ITEM TITLE</Text>
            <TextInput
              style={withFocus('title')}
              placeholder="e.g. Black HP Laptop"
              placeholderTextColor={C.inputPlaceholder}
              selectionColor={C.inputFocus}
              cursorColor={C.inputFocus}
              value={form.title}
              onChangeText={(t) => patch({ title: t })}
              onFocus={() => setActiveField('title')}
              onBlur={() => setActiveField('')}
              maxLength={TITLE_MAX}
              autoCapitalize="sentences"
              underlineColorAndroid="transparent"
            />

            {/* Category */}
            <Text style={s.sectionLabel}>CATEGORY</Text>
            <View style={s.chips}>
              {CATEGORIES.map((cat) => (
                <Pressable
                  key={cat}
                  style={[s.chip, form.category === cat && s.chipActive]}
                  onPress={() => updateWithAutoTitle({ category: cat })}
                >
                  <Text style={[s.chipTxt, form.category === cat && s.chipTxtActive]}>{cat}</Text>
                </Pressable>
              ))}
            </View>

            {/* Other Item Name */}
            {form.category === 'Other' && (
              <>
                <Text style={s.sectionLabel}>ITEM NAME</Text>
                <TextInput
                  style={withFocus('otherItemName')}
                  placeholder="e.g. Red water bottle"
                  placeholderTextColor={C.inputPlaceholder}
                  selectionColor={C.inputFocus}
                  cursorColor={C.inputFocus}
                  value={form.otherItemName}
                  onChangeText={(v) => updateWithAutoTitle({ otherItemName: v })}
                  onFocus={() => setActiveField('otherItemName')}
                  onBlur={() => setActiveField('')}
                  autoCapitalize="sentences"
                  underlineColorAndroid="transparent"
                />
              </>
            )}

            {/* Location */}
            <Text style={s.sectionLabel}>LOCATION</Text>
            <TextInput
              style={withFocus('locationText')}
              placeholder="e.g. Library, 2nd floor near entrance"
              placeholderTextColor={C.inputPlaceholder}
              selectionColor={C.inputFocus}
              cursorColor={C.inputFocus}
              value={form.locationText}
              onChangeText={(v) => patch({ locationText: v })}
              onFocus={() => setActiveField('locationText')}
              onBlur={() => setActiveField('')}
              autoCapitalize="sentences"
              underlineColorAndroid="transparent"
            />

            {/* Description */}
            <Text style={s.sectionLabel}>DESCRIPTION</Text>
            <TextInput
              style={[...withFocus('description'), s.multiline]}
              placeholder="Color, brand, unique features, condition..."
              placeholderTextColor={C.inputPlaceholder}
              selectionColor={C.inputFocus}
              cursorColor={C.inputFocus}
              value={form.description}
              onChangeText={(d) => patch({ description: d })}
              onFocus={() => setActiveField('description')}
              onBlur={() => setActiveField('')}
              multiline
              maxLength={DESC_MAX}
              autoCapitalize="sentences"
              underlineColorAndroid="transparent"
            />

            {/* Secret Questions for Found Items */}
            {form.status === 'found' && (
              <View style={s.claimBox}>
                <Text style={s.claimTitle}>Secret Questions for Claim</Text>
                <Text style={s.claimHint}>Only the real owner should know the answers</Text>

                {form.secretQuestions.map((q, i) => (
                  <View key={i} style={s.questionBlock}>
                    <Text style={s.qLabel}>Question {i + 1}</Text>
                    <TextInput
                      style={withFocus(`question-${i}`)}
                      placeholder="e.g. What is written on the case?"
                      placeholderTextColor={C.inputPlaceholder}
                      selectionColor={C.inputFocus}
                      cursorColor={C.inputFocus}
                      value={q.question}
                      onChangeText={(t) => updateQuestion(i, 'question', t)}
                      onFocus={() => setActiveField(`question-${i}`)}
                      onBlur={() => setActiveField('')}
                      autoCapitalize="sentences"
                      underlineColorAndroid="transparent"
                    />
                    <TextInput
                      style={withFocus(`answer-${i}`)}
                      placeholder="Answer"
                      placeholderTextColor={C.inputPlaceholder}
                      selectionColor={C.inputFocus}
                      cursorColor={C.inputFocus}
                      value={q.answer}
                      onChangeText={(t) => updateQuestion(i, 'answer', t)}
                      onFocus={() => setActiveField(`answer-${i}`)}
                      onBlur={() => setActiveField('')}
                      autoCapitalize="sentences"
                      underlineColorAndroid="transparent"
                    />
                  </View>
                ))}

                <Pressable style={s.addBtn} onPress={() => patch({ secretQuestions: [...form.secretQuestions, { question: '', answer: '' }].slice(0, 5) })}>
                  <AppIcon name="plus" size={16} color={C.blue} />
                  <Text style={s.addBtnText}>Add Another Question</Text>
                </Pressable>
              </View>
            )}

          </View>

          {/* Submit Button */}
          <Pressable
            style={[s.submitBtn, (!isValid || isBusy) && s.submitDisabled]}
            onPress={onSubmit}
            disabled={!isValid || isBusy}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={s.submitTxt}>{isEditMode ? 'UPDATE REPORT' : `POST ${form.status.toUpperCase()} ITEM`}</Text>
            )}
          </Pressable>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { backgroundColor: C.blue, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },

  toggleContainer: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 999, padding: 3 },
  toggleBtn: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 999 },
  toggleBtnActive: { backgroundColor: '#fff' },
  toggleTxt: { color: 'rgba(255,255,255,0.9)', fontWeight: '600', fontSize: 13 },
  toggleTxtActive: { color: C.blue },

  content: { padding: 14, paddingBottom: 40 },
  card: { backgroundColor: C.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.border },

  sectionLabel: { fontSize: 13, fontWeight: '700', color: C.text, marginTop: 12, marginBottom: 6 },

  photoSection: { marginBottom: 12 },
  photoBox: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#9ca3af', borderRadius: 12, height: 160, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f9fafb' },
  photoPlaceholder: { alignItems: 'center', gap: 6 },
  photoPlaceholderText: { color: C.muted, fontSize: 13 },
  previewImg: { width: '100%', height: '100%', borderRadius: 10 },

  input: {
    borderWidth: 1.2,
    borderColor: C.inputBorder,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    backgroundColor: '#f8fafc',
    color: C.inputText,
    fontWeight: '500',
  },
  inputFocused: {
    borderColor: C.inputFocus,
    backgroundColor: '#ffffff',
    shadowColor: '#1a6edb',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 1,
  },
  multiline: { minHeight: 100, textAlignVertical: 'top' },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: C.border, backgroundColor: '#f3f4f6' },
  chipActive: { backgroundColor: C.blueSoft, borderColor: C.blue },
  chipTxt: { fontSize: 12, fontWeight: '600', color: C.muted },
  chipTxtActive: { color: C.blue },

  claimBox: { marginTop: 12, padding: 14, backgroundColor: C.blueSoft, borderRadius: 12, borderWidth: 1, borderColor: '#bfdbfe' },
  claimTitle: { fontWeight: '700', fontSize: 14, color: C.text },
  claimHint: { fontSize: 12, color: C.muted, marginTop: 4 },
  questionBlock: { marginTop: 12 },
  qLabel: { fontSize: 12, fontWeight: '600', color: C.blue, marginBottom: 4 },

  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, justifyContent: 'center', padding: 10 },
  addBtnText: { color: C.blue, fontWeight: '600' },

  submitBtn: { backgroundColor: C.blue, padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 20 },
  submitDisabled: { backgroundColor: '#94a3b8' },
  submitTxt: { color: '#fff', fontWeight: '700', fontSize: 16 },
});

export default ReportItemScreen;
