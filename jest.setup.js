// AsyncStorage saknar native-modul i testmiljön — officiella jest-mocken
// ger en fungerande in-memory-implementation
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'))
