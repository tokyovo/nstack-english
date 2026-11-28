import { Stack } from 'expo-router';
import { useRef, useState } from 'react';
import { ScrollView, StyleSheet, View, type TextInputInstance } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { signIn, signOut, signUp, type AccountError, type Profile, type User } from '@/account';
import { useAccount } from '@/account/use-account';
import { BackLink } from '@/components/back-link';
import { ActionButton } from '@/components/lesson/action-button';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n';

type Mode = 'signIn' | 'signUp';

const copy = {
  signIn: {
    heading: 'account.signInHeading',
    submit: 'account.signIn',
    submitting: 'account.signingIn',
    switchTo: 'account.toSignUp',
    passwordAutoComplete: 'current-password',
  },
  signUp: {
    heading: 'account.signUpHeading',
    submit: 'account.signUp',
    submitting: 'account.signingUp',
    switchTo: 'account.toSignIn',
    passwordAutoComplete: 'new-password',
  },
} as const;

/** Sign in or create an account; what the learner typed stays after an error. */
function AccountForm({ onSignedIn }: { onSignedIn: (user: User, profiles: Profile[]) => void }) {
  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<AccountError | null>(null);
  const emailInput = useRef<TextInputInstance>(null);
  const passwordInput = useRef<TextInputInstance>(null);
  const text = copy[mode];
  const canSubmit = email.trim() !== '' && password !== '' && !submitting;
  const message = error && t(`account.error.${error.code}`);

  async function submit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    const result = await (mode === 'signIn' ? signIn : signUp)(email.trim(), password);
    setSubmitting(false);
    if (result.ok) {
      onSignedIn(result.user, result.profiles);
      return;
    }
    setError(result.error);
    if (result.error.field === 'email') emailInput.current?.focus();
    if (result.error.field === 'password') passwordInput.current?.focus();
  }

  function switchMode() {
    setMode(mode === 'signIn' ? 'signUp' : 'signIn');
    setError(null);
  }

  return (
    <View style={styles.section}>
      <ThemedText type="heading" role="heading" aria-level={2}>
        {t(text.heading)}
      </ThemedText>
      <ThemedText>{t('account.intro')}</ThemedText>
      <TextField
        ref={emailInput}
        nativeID="account-email"
        label={t('account.email')}
        error={error?.field === 'email' ? (message ?? undefined) : undefined}
        value={email}
        onChangeText={setEmail}
        onSubmitEditing={() => passwordInput.current?.focus()}
        autoComplete="email"
        textContentType="emailAddress"
        keyboardType="email-address"
        inputMode="email"
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        returnKeyType="next"
        submitBehavior="submit"
        testID="account-email"
      />
      <TextField
        ref={passwordInput}
        nativeID="account-password"
        label={t('account.password')}
        hint={mode === 'signUp' ? t('account.passwordRule') : undefined}
        error={error?.field === 'password' ? (message ?? undefined) : undefined}
        value={password}
        onChangeText={setPassword}
        onSubmitEditing={submit}
        secureTextEntry
        autoComplete={text.passwordAutoComplete}
        textContentType={mode === 'signIn' ? 'password' : 'newPassword'}
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        returnKeyType="go"
        submitBehavior="submit"
        testID="account-password"
      />
      {error && !error.field && <FormError message={message ?? ''} />}
      <ActionButton
        label={t(submitting ? text.submitting : text.submit)}
        disabled={!canSubmit}
        onPress={submit}
        testID="account-submit"
      />
      <ActionButton kind="secondary" label={t(text.switchTo)} onPress={switchMode} testID="account-switch" />
    </View>
  );
}

function FormError({ message }: { message: string }) {
  const theme = useTheme();
  return (
    <ThemedText role="alert" nativeID="account-form-error" style={{ color: theme.danger }}>
      {message}
    </ThemedText>
  );
}

function SignedIn({ user, onSignedOut }: { user: User; onSignedOut: () => void }) {
  const [signingOut, setSigningOut] = useState(false);

  const label = signingOut ? t('account.signingOut') : t('account.signOut');

  async function leave() {
    setSigningOut(true);
    await signOut();
    onSignedOut();
  }

  return (
    <View style={styles.section}>
      <ThemedText type="lead">{t('account.signedInAs', { email: user.email })}</ThemedText>
      <ActionButton
        kind="secondary"
        label={label}
        disabled={signingOut}
        onPress={leave}
        testID="account-signout"
      />
    </View>
  );
}

export default function AccountScreen() {
  const theme = useTheme();
  const [account, setAccount] = useAccount();
  const showSignedIn = (user: User, profiles: Profile[]) => setAccount({ status: 'signedIn', user, profiles });
  const showSignedOut = () => setAccount({ status: 'signedOut' });

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ title: t('account.title') }} />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.column}>
          <BackLink href="/" label={t('account.back')} />
          <ThemedText type="title" role="heading" aria-level={1}>
            {t('account.title')}
          </ThemedText>
          {account.status === 'loading' && <ThemedText>{t('account.loading')}</ThemedText>}
          {account.status === 'signedOut' && (
            <AccountForm onSignedIn={showSignedIn} />
          )}
          {account.status === 'signedIn' && (
            <SignedIn user={account.user} onSignedOut={showSignedOut} />
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    alignItems: 'center',
  },
  column: {
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Space.xl,
    paddingVertical: Space.xxxl,
    gap: Space.xl,
  },
  section: {
    gap: Space.lg,
  },
});
