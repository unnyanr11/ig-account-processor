import React, { useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

interface Props {
  uri: string | null | undefined;
  size: number;
  textColor: string;
  label?: string;
}

export default function FullScreenImage({ uri, size, textColor, label = 'Profile picture' }: Props) {
  const [visible, setVisible] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  if (!uri) return null;

  return (
    <>
      <Pressable
        onPress={(event) => { event.stopPropagation(); setZoomed(false); setVisible(true); }}
        accessibilityRole='imagebutton'
        accessibilityLabel={'View ' + label + ' full screen'}
      >
        <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />
      </Pressable>
      <Modal visible={visible} transparent animationType='fade' onRequestClose={() => setVisible(false)}>
        <View style={styles.backdrop}>
          <Pressable style={styles.close} onPress={() => setVisible(false)} accessibilityRole='button' accessibilityLabel='Close image'>
            <Text style={styles.closeText}>×</Text>
          </Pressable>
          <Pressable
            style={styles.imageArea}
            onPress={() => setZoomed((value) => !value)}
            accessibilityRole='button'
            accessibilityLabel={zoomed ? 'Return image to fit' : 'Zoom image'}
          >
            <Image source={{ uri }} resizeMode='contain' style={[styles.fullImage, zoomed ? styles.zoomed : null]} />
          </Pressable>
          <Text style={[styles.hint, { color: textColor }]}>{zoomed ? 'Tap image to fit' : 'Tap image to zoom'}</Text>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.96)', alignItems: 'center', justifyContent: 'center' },
  imageArea: { width: '100%', height: '78%', alignItems: 'center', justifyContent: 'center' },
  fullImage: { width: '100%', height: '100%' },
  zoomed: { width: '145%', height: '145%' },
  close: { position: 'absolute', top: 48, right: 20, width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  closeText: { color: '#fff', fontSize: 34, lineHeight: 38, fontWeight: '300' },
  hint: { position: 'absolute', bottom: 32, fontSize: 13, opacity: 0.8 },
});
