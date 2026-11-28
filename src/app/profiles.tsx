import { Link, Stack } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, type TextInputInstance } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { loadAccount, type Profile } from '@/account';
import {
  addChild,
  deleteChild,
  loadProgressSummary,
  updateChild,
  type ChildInput,
  type ProfileError,
  type ProfileResult,
  type ProgressSummary,
} from '@/account/profiles';
import { useAccount } from '@/account/use-account';
import { BackLink } from '@/components/back-link';
import { ActionButton } from '@/components/lesson/action-button';
import { PicturePicker } from '@/components/picture-picker';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Border, Fonts, FontSize, MaxContentWidth, MinTouchTarget, Radius, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n';
import { MAX_CHILDREN, MAX_NICKNAME, PROFILE_PICTURES } from '@/profiles/child-profile';

type SummaryState = { status: 'loading' } | { status: 'ready'; summary: ProgressSummary } | { status: 'unavailable' };

/** What a child's row shows: its summary, its edit form, or the delete confirmation. */
type RowMode = 'view' | 'edit' | 'delete';

/** Each profile's progress summary, read once per set of profiles. */
function useSummaries(profiles: Profile[]): Record<string, SummaryState> {
  const [summaries, setSummaries] = useState<Record<string, SummaryState>>({});
  const ids = profiles.map((profile) => profile.id).join(' ');

  useEffect(() => {
    let current = true;
    const now = new Date();
    for (const id of ids.split(' ').filter(Boolean)) {
      loadProgressSummary(id, now).then(
        (summary): void => {
          if (current) setSummaries((all) => ({ ...all, [id]: summary ? { status: 'ready', summary } : { status: 'unavailable' } }));
        },
        () => current && setSummaries((all) => ({ ...all, [id]: { status: 'unavailable' } }))
      );
    }
    return () => {
      current = false;
    };
  }, [ids]);

  return summaries;
}

function summaryLine(state: SummaryState | undefined): string {
  if (!state || state.status === 'loading') return t('profiles.summaryLoading');
  if (state.status === 'unavailable') return t('profiles.summaryUnavailable');
  const { lessonsCompleted: lessons, wordsDue: due } = state.summary;
  return due === 0 ? t('profiles.summaryNoneDue', { lessons }) : t('profiles.summary', { lessons, due });
}

function displayName(profile: Profile): string {
  return profile.kind === 'owner' ? t('profiles.owner') : profile.name;
}

type ChildFormProps = {
  /** The inputs' ids start with it, e.g. `profile-new-name`. */
  nativeID: string;
  nameLabel: string;
  initial: ChildInput;
  submitLabel: string;
  submittingLabel: string;
  /** Empties the form after it was sent, for adding the next child. */
  clearOnSuccess?: boolean;
  onSubmit: (input: ChildInput) => Promise<ProfileResult>;
  onDone: () => void;
  onCancel?: () => void;
};

/** A child's nickname and picture; what the parent typed stays after an error. */
function ChildForm(props: ChildFormProps) {
  const { nativeID, initial, onSubmit, onDone, onCancel } = props;
  const [name, setName] = useState(initial.name);
  const [picture, setPicture] = useState(initial.picture);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<ProfileError | null>(null);
  const nameInput = useRef<TextInputInstance>(null);
  const message = error && t(`profiles.error.${error.code}`);
  const canSubmit = name !== '' && !submitting;

  async function submit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    const result = await onSubmit({ name: name.trim(), picture });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      if (result.error.field === 'name') nameInput.current?.focus();
      return;
    }
    if (props.clearOnSuccess) {
      setName('');
      setPicture(PROFILE_PICTURES[0]);
    }
    onDone();
  }

  return (
    <View style={styles.form}>
      <TextField
        ref={nameInput}
        nativeID={`${nativeID}-name`}
        label={props.nameLabel}
        hint={t('profiles.nameHint')}
        error={error?.field === 'name' ? (message ?? undefined) : undefined}
        value={name}
        onChangeText={setName}
        onSubmitEditing={submit}
        maxLength={MAX_NICKNAME}
        autoComplete="off"
        autoCorrect={false}
        returnKeyType="done"
        submitBehavior="blurAndSubmit"
        testID={`${nativeID}-name`}
      />
      <PicturePicker
        nativeID={`${nativeID}-picture`}
        label={t('profiles.picture')}
        value={picture}
        onChange={setPicture}
      />
      {error && error.field !== 'name' && <FormError message={message ?? ''} />}
      <ActionButton
        label={submitting ? props.submittingLabel : props.submitLabel}
        disabled={!canSubmit}
        onPress={submit}
        testID={`${nativeID}-submit`}
      />
      {onCancel && <ActionButton kind="secondary" label={t('profiles.cancel')} onPress={onCancel} />}
    </View>
  );
}

function FormError({ message }: { message: string }) {
  const theme = useTheme();
  return (
    <ThemedText role="alert" style={{ color: theme.danger }}>
      {message}
    </ThemedText>
  );
}

type ProfileRowProps = {
  profile: Profile;
  summary: SummaryState | undefined;
  mode: RowMode;
  onMode: (mode: RowMode) => void;
  onChanged: () => void;
  onDeleted: (name: string) => void;
};

function ProfileRow({ profile, summary, mode, onMode, onChanged, onDeleted }: ProfileRowProps) {
  const theme = useTheme();
  const name = displayName(profile);
  const child = profile.kind === 'child';
  const startEditing = () => onMode('edit');
  const startDeleting = () => onMode('delete');
  const close = () => onMode('view');

  return (
    <View
      testID={`profile-${profile.id}`}
      style={[styles.row, { backgroundColor: theme.surface, borderColor: theme.line }]}>
      <View style={styles.rowHeader}>
        {profile.picture && (
          <Text style={styles.picture} aria-hidden>
            {profile.picture}
          </Text>
        )}
        <View style={styles.rowText}>
          <ThemedText type="label">{name}</ThemedText>
          <ThemedText type="meta">{summaryLine(summary)}</ThemedText>
        </View>
      </View>
      {child && mode === 'view' && (
        <View style={styles.rowActions}>
          <ActionButton
            kind="secondary"
            label={t('profiles.edit')}
            accessibilityLabel={t('profiles.editLabel', { name })}
            onPress={startEditing}
            style={styles.rowAction}
            testID={`profile-${profile.id}-edit`}
          />
          <ActionButton
            kind="secondary"
            label={t('profiles.delete')}
            accessibilityLabel={t('profiles.deleteLabel', { name })}
            onPress={startDeleting}
            style={styles.rowAction}
            testID={`profile-${profile.id}-delete`}
          />
        </View>
      )}
      {child && profile.picture && mode === 'edit' && (
        <ChildForm
          nativeID={`profile-${profile.id}`}
          nameLabel={t('profiles.newName', { name })}
          initial={{ name: profile.name, picture: profile.picture }}
          submitLabel={t('profiles.save')}
          submittingLabel={t('profiles.saving')}
          onSubmit={(input) => updateChild(profile.id, input)}
          onDone={onChanged}
          onCancel={close}
        />
      )}
      {child && mode === 'delete' && (
        <DeleteConfirmation profile={profile} onKeep={close} onDeleted={() => onDeleted(name)} />
      )}
    </View>
  );
}

function DeleteConfirmation({ profile, onKeep, onDeleted }: { profile: Profile; onKeep: () => void; onDeleted: () => void }) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<ProfileError | null>(null);

  async function confirm() {
    setDeleting(true);
    setError(null);
    const result = await deleteChild(profile.id);
    setDeleting(false);
    if (result.ok) onDeleted();
    else setError(result.error);
  }

  return (
    <View style={styles.form}>
      <ThemedText role="alert">{t('profiles.deleteWarning', { name: profile.name })}</ThemedText>
      {error && <FormError message={t(`profiles.error.${error.code}`)} />}
      <ActionButton
        kind="danger"
        label={deleting ? t('profiles.deleting') : t('profiles.deleteConfirm')}
        disabled={deleting}
        onPress={confirm}
        testID={`profile-${profile.id}-confirm-delete`}
      />
      <ActionButton kind="secondary" label={t('profiles.keep')} onPress={onKeep} />
    </View>
  );
}

function SignedOut() {
  const theme = useTheme();
  return (
    <View style={styles.section}>
      <ThemedText>{t('profiles.signedOut')}</ThemedText>
      <Link href="/account" style={[styles.link, { color: theme.accent }]}>
        {t('profiles.signIn')}
      </Link>
    </View>
  );
}

function Profiles({ profiles, onChanged }: { profiles: Profile[]; onChanged: () => void }) {
  const summaries = useSummaries(profiles);
  const [open, setOpen] = useState<{ id: string; mode: RowMode } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const children = profiles.filter((profile) => profile.kind === 'child');

  const modeOf = (id: string): RowMode => (open?.id === id ? open.mode : 'view');

  function openRow(id: string, mode: RowMode) {
    setNotice(null);
    setOpen(mode === 'view' ? null : { id, mode });
  }

  function changed() {
    setOpen(null);
    onChanged();
  }

  return (
    <>
      <View style={styles.section}>
        <ThemedText type="heading" role="heading" aria-level={2}>
          {t('profiles.learners')}
        </ThemedText>
        {notice && <ThemedText role="status">{notice}</ThemedText>}
        {profiles.map((profile) => (
          <ProfileRow
            key={profile.id}
            profile={profile}
            summary={summaries[profile.id]}
            mode={modeOf(profile.id)}
            onMode={(mode) => openRow(profile.id, mode)}
            onChanged={changed}
            onDeleted={(name) => {
              setNotice(t('profiles.deleted', { name }));
              changed();
            }}
          />
        ))}
      </View>
      <View style={styles.section}>
        <ThemedText type="heading" role="heading" aria-level={2}>
          {t('profiles.addHeading')}
        </ThemedText>
        {children.length >= MAX_CHILDREN ? (
          <ThemedText>{t('profiles.full')}</ThemedText>
        ) : (
          <ChildForm
            nativeID="profile-new"
            nameLabel={t('profiles.name')}
            initial={{ name: '', picture: PROFILE_PICTURES[0] }}
            submitLabel={t('profiles.add')}
            submittingLabel={t('profiles.adding')}
            clearOnSuccess
            onSubmit={(input) => {
              setNotice(null);
              return addChild(input);
            }}
            onDone={changed}
          />
        )}
      </View>
    </>
  );
}

export default function ProfilesScreen() {
  const theme = useTheme();
  const [account, setAccount] = useAccount();
  // A session the server no longer knows comes back signed out, and the screen says so.
  const reload = () => loadAccount().then(setAccount, () => setAccount({ status: 'signedOut' }));

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ title: t('profiles.title') }} />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.column}>
          <BackLink href="/account" label={t('profiles.back')} />
          <View style={styles.section}>
            <ThemedText type="title" role="heading" aria-level={1}>
              {t('profiles.title')}
            </ThemedText>
            <ThemedText>{t('profiles.intro')}</ThemedText>
          </View>
          {account.status === 'loading' && <ThemedText>{t('profiles.loading')}</ThemedText>}
          {account.status === 'signedOut' && <SignedOut />}
          {account.status === 'signedIn' && <Profiles profiles={account.profiles} onChanged={reload} />}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { flexGrow: 1, alignItems: 'center' },
  column: {
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Space.xl,
    paddingVertical: Space.xxxl,
    gap: Space.xxl,
  },
  section: { gap: Space.lg },
  form: { gap: Space.lg },
  row: {
    borderWidth: Border,
    borderRadius: Radius.card,
    padding: Space.lg,
    gap: Space.lg,
  },
  rowHeader: { flexDirection: 'row', alignItems: 'center', gap: Space.md },
  rowText: { flex: 1, minWidth: 0, gap: Space.xs },
  rowActions: { flexDirection: 'row', gap: Space.md },
  rowAction: { flex: 1 },
  picture: { fontSize: FontSize.title, lineHeight: 44 },
  link: {
    alignSelf: 'flex-start',
    minHeight: MinTouchTarget,
    paddingVertical: Space.md,
    fontFamily: Fonts.semiBold,
    fontSize: FontSize.body,
  },
});
