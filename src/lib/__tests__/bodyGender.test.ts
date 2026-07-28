import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  getBodyGender, setBodyGender, loadBodyGender, syncBodyGenderFromProfile,
} from '../bodyGender'

describe('bodyGender', () => {
  afterEach(async () => {
    // Återställ värdet FÖRE clear, setBodyGender skriver till lagringen
    setBodyGender('male')
    await AsyncStorage.clear()
  })

  it('man är standard och val sparas', async () => {
    expect(getBodyGender()).toBe('male')
    setBodyGender('female')
    expect(getBodyGender()).toBe('female')
    expect(await AsyncStorage.getItem('bodyGender')).toBe('female')
  })

  it('sparat val läses vid appstart', async () => {
    await AsyncStorage.setItem('bodyGender', 'female')
    expect(await loadBodyGender()).toBe('female')
    expect(getBodyGender()).toBe('female')
  })

  it('profilens kön styr standarden men skriver aldrig över ett eget val', async () => {
    await syncBodyGenderFromProfile('Kvinna')
    expect(getBodyGender()).toBe('female')
    // Inget sparas av syncen, ett senare eget val vinner
    expect(await AsyncStorage.getItem('bodyGender')).toBeNull()

    setBodyGender('male')
    await syncBodyGenderFromProfile('Kvinna')
    expect(getBodyGender()).toBe('male')
  })

  it('Annat och Vill inte ange lämnar modellen orörd', async () => {
    await syncBodyGenderFromProfile('Annat')
    expect(getBodyGender()).toBe('male')
    await syncBodyGenderFromProfile(null)
    expect(getBodyGender()).toBe('male')
  })
})
