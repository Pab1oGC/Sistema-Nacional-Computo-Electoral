import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface Props {
  height?: number;
  marginVertical?: number;
}

export function FlagStripe({ height = 3, marginVertical = 16 }: Props) {
  return (
    <LinearGradient
      colors={['#C8102E', '#F4C430', '#007A33']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={{ height, borderRadius: height / 2, marginVertical }}
    />
  );
}
