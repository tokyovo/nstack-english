import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Border, FontSize, MinTouchTarget, Radius, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { t, type MessageKey } from '@/i18n';
import { PROFILE_PICTURES, type ProfilePicture } from '@/profiles/child-profile';

/** The Vietnamese name of each picture, read out in its place. */
export const pictureName: Record<ProfilePicture, MessageKey> = {
  '🐱': 'picture.cat',
  '🐶': 'picture.dog',
  '🐰': 'picture.rabbit',
  '🐻': 'picture.bear',
  '🐼': 'picture.panda',
  '🦊': 'picture.fox',
  '🐯': 'picture.tiger',
  '🐨': 'picture.koala',
};

type Props = {
  label: string;
  value: ProfilePicture;
  onChange: (picture: ProfilePicture) => void;
  /** The group's id; its label gets `<nativeID>-label`. */
  nativeID: string;
};

/** One animal picture out of the fixed set, as a group of radio buttons. */
export function PicturePicker({ label, value, onChange, nativeID }: Props) {
  const labelId = `${nativeID}-label`;
  return (
    <View style={styles.field}>
      <ThemedText type="label" nativeID={labelId}>
        {label}
      </ThemedText>
      <View role="radiogroup" aria-labelledby={labelId} nativeID={nativeID} style={styles.grid}>
        {PROFILE_PICTURES.map((picture) => (
          <PictureOption key={picture} picture={picture} selected={picture === value} onSelect={onChange} />
        ))}
      </View>
    </View>
  );
}

function PictureOption({
  picture,
  selected,
  onSelect,
}: {
  picture: ProfilePicture;
  selected: boolean;
  onSelect: (picture: ProfilePicture) => void;
}) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const name = t(pictureName[picture]);
  return (
    <Pressable
      role="radio"
      aria-checked={selected}
      accessibilityState={{ checked: selected }}
      accessibilityLabel={name}
      aria-label={name}
      onPress={() => onSelect(picture)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={(state) => [
        styles.option,
        {
          backgroundColor: theme.surface,
          borderColor: selected ? theme.accent : state.pressed ? theme.muted : theme.line,
          borderWidth: selected ? 3 : Border,
        },
        focused && { outlineColor: theme.text, outlineStyle: 'solid', outlineWidth: 2, outlineOffset: 2 },
      ]}>
      <Text style={styles.picture} aria-hidden>
        {picture}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  field: { gap: Space.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Space.sm },
  option: {
    width: MinTouchTarget + Space.md,
    height: MinTouchTarget + Space.md,
    borderRadius: Radius.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  picture: { fontSize: FontSize.title, lineHeight: 40 },
});
