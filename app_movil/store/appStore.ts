import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ActaEstado = 'VALIDADA' | 'REVISION' | 'RECHAZADA' | null;

export interface ActaHistorial {
  id: string;
  codigoMesa: string;
  timestamp: Date;
  estado: 'VALIDADA' | 'REVISION' | 'RECHAZADA';
}

interface AppState {
  // Mesa config
  codigoMesa: string;
  codigoRecinto: string;
  codigoTerritorial: string;
  setMesaConfig: (mesa: string, recinto: string, territorial: string) => void;
  loadSavedMesa: () => Promise<void>;

  // Capture
  capturedPhotoUri: string | null;
  setCapturedPhoto: (uri: string | null) => void;

  // Submit result (rotates for demo)
  submitCounter: number;
  getSimulatedEstado: () => ActaEstado;
  incrementCounter: () => void;

  // History
  historial: ActaHistorial[];
  addToHistorial: (acta: ActaHistorial) => void;

  // Guide shown
  guideShown: boolean;
  markGuideShown: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  codigoMesa:         '',
  codigoRecinto:      '',
  codigoTerritorial:  '',

  setMesaConfig: async (mesa, recinto, territorial) => {
    set({ codigoMesa: mesa, codigoRecinto: recinto, codigoTerritorial: territorial });
    await AsyncStorage.setItem('codigoMesa', mesa);
    await AsyncStorage.setItem('codigoRecinto', recinto);
    await AsyncStorage.setItem('codigoTerritorial', territorial);
  },

  loadSavedMesa: async () => {
    const mesa        = await AsyncStorage.getItem('codigoMesa')        ?? '';
    const recinto     = await AsyncStorage.getItem('codigoRecinto')     ?? '';
    const territorial = await AsyncStorage.getItem('codigoTerritorial') ?? '';
    set({ codigoMesa: mesa, codigoRecinto: recinto, codigoTerritorial: territorial });
    const guideShown = await AsyncStorage.getItem('guideShown');
    if (guideShown === 'true') set({ guideShown: true });
  },

  capturedPhotoUri: null,
  setCapturedPhoto: (uri) => set({ capturedPhotoUri: uri }),

  submitCounter: 0,
  getSimulatedEstado: (): ActaEstado => {
    const estados: ActaEstado[] = ['VALIDADA', 'REVISION', 'RECHAZADA'];
    return estados[get().submitCounter % 3];
  },
  incrementCounter: () => set((s) => ({ submitCounter: s.submitCounter + 1 })),

  historial: [],
  addToHistorial: (acta) =>
    set((s) => ({ historial: [acta, ...s.historial].slice(0, 50) })),

  guideShown: false,
  markGuideShown: async () => {
    set({ guideShown: true });
    await AsyncStorage.setItem('guideShown', 'true');
  },
}));
